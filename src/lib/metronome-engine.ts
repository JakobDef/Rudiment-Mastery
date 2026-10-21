import { LOOKAHEAD_SECONDS, SCHEDULE_AHEAD_SECONDS } from "@/lib/audio-scheduler";
import {
  planClick,
  sanitizeSettings,
  type Accent,
  type ClickCursor,
  type MetronomeSettings,
} from "@/lib/metronome";

export interface MetronomeFrame {
  bpm: number;
  beatIndex: number;
  barIndex: number;
  silent: boolean;
  rampProgress: number;
  clicksInBar: number;
}

interface ScheduledBeat {
  time: number;
  bpm: number;
  beatIndex: number;
  barIndex: number;
  silent: boolean;
}

type FrameHandler = (frame: MetronomeFrame) => void;

export class MetronomeEngine {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private frame: number | null = null;
  private generation = 0;
  private playing = false;
  private settings: MetronomeSettings = sanitizeSettings({
    startBpm: 80,
    targetBpm: 120,
    rampEnabled: false,
    rampSeconds: 120,
    accents: ["high"],
    division: 1,
    heardBars: 1,
    silentBars: 0,
    volume: 0.8,
  });
  private cursor: ClickCursor = { beatIndex: 0, barIndex: 0 };
  private nextTime = 0;
  private rampAnchor = 0;
  private events: ScheduledBeat[] = [];
  private voices = new Set<() => void>();
  private lastPaint = "";

  constructor(private readonly onFrame: FrameHandler) {}

  start(settings: MetronomeSettings): boolean {
    this.stop();
    this.settings = sanitizeSettings(settings);
    const context = this.ensureContext();
    if (!context) return false;
    void context.resume();
    const startAt = context.currentTime + 0.06;
    this.playing = true;
    this.cursor = { beatIndex: 0, barIndex: 0 };
    this.nextTime = startAt;
    this.rampAnchor = startAt;
    this.events = [];
    this.lastPaint = "";
    this.generation += 1;
    this.pump();
    this.frame = window.requestAnimationFrame(this.draw);
    return true;
  }

  update(settings: MetronomeSettings) {
    const next = sanitizeSettings(settings);
    const rampChanged = rampKey(this.settings) !== rampKey(next);
    const patternChanged = patternKey(this.settings) !== patternKey(next);
    this.settings = next;
    if (!this.playing || !this.context) return;
    if (rampChanged) this.rampAnchor = this.context.currentTime;
    if (patternChanged) {
      const beatCount = Math.max(1, next.accents.length);
      this.cursor = {
        beatIndex: this.cursor.beatIndex % beatCount,
        barIndex: this.cursor.barIndex,
      };
    }
  }

  stop() {
    this.playing = false;
    this.generation += 1;
    this.haltClock();
    this.stopVoices();
    this.events = [];
    this.lastPaint = "";
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = null;
    this.noiseBuffer = null;
    if (context && context.state !== "closed") void context.close();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.context) this.context = new window.AudioContext();
    return this.context;
  }

  private pump = () => {
    const generation = this.generation;
    this.scheduleAhead();
    if (!this.playing || generation !== this.generation) return;
    this.timer = window.setTimeout(this.pump, LOOKAHEAD_SECONDS * 1000);
  };

  private scheduleAhead() {
    const context = this.context;
    if (!context || !this.playing) return;
    if (this.nextTime < context.currentTime - 0.05) {
      this.nextTime = context.currentTime + 0.05;
    }
    const horizon = context.currentTime + SCHEDULE_AHEAD_SECONDS;
    let guard = 0;
    while (this.nextTime <= horizon && guard < 32) {
      guard += 1;
      const plan = planClick(this.cursor, this.nextTime - this.rampAnchor, this.settings);
      if (!plan.silent) this.playClick(this.nextTime, plan.accent);
      this.events.push({
        time: this.nextTime,
        bpm: plan.bpm,
        beatIndex: plan.beatIndex,
        barIndex: plan.barIndex,
        silent: plan.silent,
      });
      this.cursor = plan.next;
      this.nextTime += plan.secondsUntilNext;
    }
    const cutoff = context.currentTime - 1;
    if (this.events.length > 32) {
      this.events = this.events.filter((event) => event.time >= cutoff);
    }
  }

  private draw = () => {
    if (!this.playing || !this.context) return;
    const now = this.context.currentTime;
    let current: ScheduledBeat | null = null;
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (!event) continue;
      if (event.time <= now + 0.03) {
        current = event;
        break;
      }
    }
    const elapsed = Math.max(0, now - this.rampAnchor);
    const progress = this.settings.rampEnabled ? Math.min(1, elapsed / this.settings.rampSeconds) : 0;
    const frame: MetronomeFrame = {
      bpm: current?.bpm ?? this.settings.startBpm,
      beatIndex: current?.beatIndex ?? 0,
      barIndex: current?.barIndex ?? 0,
      silent: current?.silent ?? false,
      rampProgress: progress,
      clicksInBar: this.settings.accents.length,
    };
    const paint = `${frame.barIndex}:${frame.beatIndex}:${frame.bpm}:${frame.silent}:${Math.round(progress * 250)}`;
    if (paint !== this.lastPaint) {
      this.lastPaint = paint;
      this.onFrame(frame);
    }
    this.frame = window.requestAnimationFrame(this.draw);
  };

  private playClick(time: number, accent: Accent) {
    const context = this.context;
    if (!context || time < context.currentTime - 0.03) return;
    const volume = this.settings.volume;
    if (volume <= 0.001) return;
    const when = Math.max(time, context.currentTime);
    const freq = accent === "high" ? 1560 : accent === "mid" ? 1240 : 980;
    const peak = (accent === "high" ? 0.28 : accent === "mid" ? 0.2 : 0.15) * volume;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), when + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    oscillator.connect(gain);
    gain.connect(context.destination);

    const noise = context.createBufferSource();
    noise.buffer = this.noise(context);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1800, when);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(Math.max(0.08 * volume, 0.0001), when);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.015);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(context.destination);

    oscillator.start(when);
    oscillator.stop(when + 0.06);
    noise.start(when);
    noise.stop(when + 0.03);

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      oscillator.disconnect();
      gain.disconnect();
      noise.disconnect();
      filter.disconnect();
      noiseGain.disconnect();
      this.voices.delete(stop);
    };
    const stop = () => {
      try {
        oscillator.stop();
      } catch {
        // Already finished.
      }
      try {
        noise.stop();
      } catch {
        // Already finished.
      }
      dispose();
    };
    oscillator.onended = dispose;
    this.voices.add(stop);
  }

  private noise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) return this.noiseBuffer;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.2));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private haltClock() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private stopVoices() {
    const stops = [...this.voices];
    this.voices.clear();
    for (const stop of stops) stop();
  }
}

function rampKey(settings: MetronomeSettings): string {
  return `${settings.startBpm}|${settings.targetBpm}|${settings.rampEnabled}|${settings.rampSeconds}`;
}

function patternKey(settings: MetronomeSettings): string {
  return `${settings.division}|${settings.accents.length}`;
}
