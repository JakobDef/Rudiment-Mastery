import {
  noteDuration,
  quarterNotesPerBar,
  type NoteOrnament,
  type Rudiment,
  type RudimentNote,
} from "@/lib/rudiments";

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const LOOKAHEAD_SECONDS = 0.025;
export const SCHEDULE_AHEAD_SECONDS = 0.12;

const FLAM_LEAD_SECONDS = 0.025;
const DRAG_LEAD_SECONDS = [0.045, 0.022] as const;
const RUFF_LEAD_SECONDS = [0.066, 0.044, 0.022] as const;

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

export function quarterNoteSeconds(bpm: number): number {
  return 60 / clampBpm(bpm);
}

export function stepSeconds(bpm: number, subdivision: number): number {
  return quarterNoteSeconds(bpm) / subdivision;
}

export function tempoScale(bpm: number): number {
  return Math.min(1.15, Math.max(0.65, 100 / clampBpm(bpm)));
}

export function graceLeadSeconds(
  ornament: Extract<NoteOrnament, "flam" | "drag" | "ruff">,
  bpm: number,
): readonly number[] {
  const scale = tempoScale(bpm);
  if (ornament === "flam") return [FLAM_LEAD_SECONDS * scale];
  if (ornament === "drag") return DRAG_LEAD_SECONDS.map((lead) => lead * scale);
  return RUFF_LEAD_SECONDS.map((lead) => lead * scale);
}

export function diddleGapSeconds(_bpm: number, noteSeconds: number): number {
  return Math.max(0.018, noteSeconds * 0.5);
}

export function noteOnsetSeconds(rudiment: Rudiment, bpm: number): number[] {
  const step = stepSeconds(bpm, rudiment.subdivision);
  const onsets: number[] = [];
  let cursor = 0;
  for (const note of rudiment.notes) {
    onsets.push(cursor);
    cursor += noteDuration(note) * step;
  }
  return onsets;
}

export function patternSeconds(rudiment: Rudiment, bpm: number): number {
  const step = stepSeconds(bpm, rudiment.subdivision);
  return rudiment.notes.reduce((sum, note) => sum + noteDuration(note) * step, 0);
}

export interface SchedulerHandlers {
  onActiveNote: (index: number | null) => void;
  onBarCompleted: () => void;
  onRepetition: (repetition: number) => void;
  onEnded: () => void;
}

const EMPTY_HANDLERS: SchedulerHandlers = {
  onActiveNote: () => undefined,
  onBarCompleted: () => undefined,
  onRepetition: () => undefined,
  onEnded: () => undefined,
};

type VoiceKind = "accent" | "tap" | "ghost" | "clickHigh" | "clickLow";

interface VoiceProfile {
  freq: number;
  gain: number;
  attack: number;
  decay: number;
  noiseGain: number;
  noiseFreq: number;
  noiseDecay: number;
}

const VOICES: Record<VoiceKind, VoiceProfile> = {
  accent: {
    freq: 312,
    gain: 0.9,
    attack: 0.001,
    decay: 0.11,
    noiseGain: 0.42,
    noiseFreq: 2400,
    noiseDecay: 0.03,
  },
  tap: {
    freq: 198,
    gain: 0.4,
    attack: 0.002,
    decay: 0.07,
    noiseGain: 0.2,
    noiseFreq: 1900,
    noiseDecay: 0.02,
  },
  ghost: {
    freq: 168,
    gain: 0.09,
    attack: 0.007,
    decay: 0.05,
    noiseGain: 0.05,
    noiseFreq: 1400,
    noiseDecay: 0.018,
  },
  clickHigh: {
    freq: 1560,
    gain: 0.26,
    attack: 0.001,
    decay: 0.04,
    noiseGain: 0.08,
    noiseFreq: 3200,
    noiseDecay: 0.012,
  },
  clickLow: {
    freq: 980,
    gain: 0.16,
    attack: 0.001,
    decay: 0.035,
    noiseGain: 0.04,
    noiseFreq: 2200,
    noiseDecay: 0.01,
  },
};

function voiceFor(note: RudimentNote): VoiceKind {
  if (note.accent) return "accent";
  if (note.ghost) return "ghost";
  return "tap";
}

export class AudioScheduler {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private frame: number | null = null;
  private voices = new Set<() => void>();
  private handlers: SchedulerHandlers = EMPTY_HANDLERS;
  private rudiment: Rudiment | null = null;
  private bpm = 80;
  private metronome = true;
  private loop = true;
  private playing = false;
  private generation = 0;
  private nextNoteTime = 0;
  private nextClickTime = 0;
  private noteIndex = 0;
  private clickIndex = 0;
  private repetition = 1;
  private repetitionArmed = false;
  private draining = false;
  private endTime = 0;
  private boundaryTime = 0;
  private dispatchingBoundary = false;
  private scheduled: { index: number; time: number }[] = [];
  private lastActive: number | null = null;

  setHandlers(handlers: SchedulerHandlers) {
    this.handlers = handlers;
  }

  setBpm(bpm: number) {
    this.bpm = clampBpm(bpm);
  }

  playCue() {
    if (typeof window === "undefined") return;
    const context = this.ensureContext();
    void context.resume();
    const when = context.currentTime + 0.02;
    this.playBell(when, 880);
    this.playBell(when + 0.16, 1174);
  }

  setMetronome(enabled: boolean) {
    this.metronome = enabled;
  }

  setLoop(enabled: boolean) {
    this.loop = enabled;
    if (enabled) this.draining = false;
  }

  setRudiment(rudiment: Rudiment) {
    this.rudiment = rudiment;
    this.noteIndex = 0;
    this.repetition = 1;
    this.repetitionArmed = false;
    if (this.playing) this.handlers.onRepetition(1);
    if (this.dispatchingBoundary) {
      this.nextNoteTime = this.boundaryTime;
    }
  }

  start(): boolean {
    if (!this.rudiment || typeof window === "undefined") return false;
    this.haltClock();
    this.stopVoices();
    try {
      const context = this.ensureContext();
      void context.resume();
      this.generation += 1;
      const startAt = context.currentTime + 0.06;
      this.nextNoteTime = startAt;
      this.nextClickTime = startAt;
      this.noteIndex = 0;
      this.clickIndex = 0;
      this.repetition = 1;
      this.repetitionArmed = false;
      this.draining = false;
      this.endTime = 0;
      this.boundaryTime = 0;
      this.scheduled = [];
      this.lastActive = null;
      this.playing = true;
      this.handlers.onRepetition(1);
      this.handlers.onActiveNote(null);
      this.pump();
      this.draw();
      return true;
    } catch {
      this.playing = false;
      return false;
    }
  }

  stop() {
    this.playing = false;
    this.draining = false;
    this.haltClock();
    this.stopVoices();
    this.scheduled = [];
    if (this.lastActive !== null) {
      this.lastActive = null;
      this.handlers.onActiveNote(null);
    }
    if (this.context && this.context.state === "running") {
      void this.context.suspend();
    }
  }

  dispose() {
    this.handlers = EMPTY_HANDLERS;
    this.stop();
    const context = this.context;
    this.context = null;
    this.noiseBuffer = null;
    if (context && context.state !== "closed") {
      void context.close();
    }
  }

  private haltClock() {
    this.generation += 1;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private ensureContext(): AudioContext {
    if (this.context && this.context.state !== "closed") return this.context;
    this.context = new window.AudioContext();
    this.noiseBuffer = null;
    return this.context;
  }

  private pump = () => {
    if (!this.playing) return;
    const generation = this.generation;
    this.scheduleAhead();
    if (!this.playing || generation !== this.generation) return;
    this.timer = window.setTimeout(this.pump, LOOKAHEAD_SECONDS * 1000);
  };

  private scheduleAhead() {
    const context = this.context;
    if (!context || !this.rudiment) return;

    if (this.nextNoteTime < context.currentTime - 0.05) {
      const resumeAt = context.currentTime + 0.05;
      this.nextNoteTime = resumeAt;
      this.nextClickTime = Math.max(this.nextClickTime, resumeAt);
    }

    const horizon = context.currentTime + SCHEDULE_AHEAD_SECONDS;
    let guard = 0;
    while (guard < 48) {
      guard += 1;
      const rudiment = this.rudiment;
      if (!rudiment) break;
      const noteDue = !this.draining && this.nextNoteTime <= horizon;
      const clickDue = this.nextClickTime <= horizon;
      if (!noteDue && !clickDue) break;
      const clickFirst = clickDue && (!noteDue || this.nextClickTime <= this.nextNoteTime + 0.001);
      if (clickFirst) {
        this.handleClick(rudiment);
      } else {
        this.handleNote(rudiment);
      }
    }
  }

  private handleClick(rudiment: Rudiment) {
    const beats = Math.max(1, Math.round(quarterNotesPerBar(rudiment)));
    const beatInBar = this.clickIndex % beats;
    const clickTime = this.nextClickTime;
    if (this.clickIndex > 0 && beatInBar === 0) {
      this.boundaryTime = clickTime;
      this.dispatchingBoundary = true;
      this.handlers.onBarCompleted();
      this.dispatchingBoundary = false;
    }
    if (this.metronome) {
      this.playVoice(clickTime, beatInBar === 0 ? "clickHigh" : "clickLow");
    }
    this.clickIndex += 1;
    this.nextClickTime += quarterNoteSeconds(this.bpm);
  }

  private handleNote(rudiment: Rudiment) {
    const note = rudiment.notes[this.noteIndex];
    if (!note) {
      this.draining = true;
      this.endTime = this.nextNoteTime;
      return;
    }

    if (this.noteIndex === 0 && this.repetitionArmed) {
      this.repetition += 1;
      this.repetitionArmed = false;
      this.handlers.onRepetition(this.repetition);
    }

    const time = this.nextNoteTime;
    this.playRudimentNote(rudiment, note, time);
    this.scheduled.push({ index: this.noteIndex, time });

    const duration = noteDuration(note);
    this.nextNoteTime += duration * stepSeconds(this.bpm, rudiment.subdivision);
    const nextIndex = this.noteIndex + 1;
    if (nextIndex < rudiment.notes.length) {
      this.noteIndex = nextIndex;
      return;
    }

    if (this.loop) {
      this.noteIndex = 0;
      this.repetitionArmed = true;
      return;
    }

    this.draining = true;
    this.endTime = this.nextNoteTime;
    this.noteIndex = 0;
  }

  private playRudimentNote(rudiment: Rudiment, note: RudimentNote, time: number) {
    const ornament = note.ornament ?? "none";
    if (ornament === "flam" || ornament === "drag" || ornament === "ruff") {
      for (const lead of graceLeadSeconds(ornament, this.bpm)) {
        this.playVoice(time - lead, "ghost");
      }
    }

    this.playVoice(time, voiceFor(note));
    const noteSeconds = noteDuration(note) * stepSeconds(this.bpm, rudiment.subdivision);

    if (ornament === "diddle") {
      const second = note.ghost ? "ghost" : "tap";
      this.playVoice(time + diddleGapSeconds(this.bpm, noteSeconds), second);
    }

    if (ornament === "buzz") {
      for (let tick = 0; tick < 5; tick += 1) {
        this.playVoice(time + (noteSeconds * tick) / 5, "ghost");
      }
    }
  }

  private draw = () => {
    if (!this.playing || !this.context) return;
    const now = this.context.currentTime;
    let active: number | null = null;
    for (let index = this.scheduled.length - 1; index >= 0; index -= 1) {
      const event = this.scheduled[index];
      if (!event) continue;
      if (event.time <= now + 0.03) {
        active = event.index;
        break;
      }
    }

    if (active !== this.lastActive) {
      this.lastActive = active;
      this.handlers.onActiveNote(active);
    }

    if (this.scheduled.length > 48) {
      const cutoff = now - 1;
      this.scheduled = this.scheduled.filter((event) => event.time >= cutoff);
    }

    if (this.draining && now >= this.endTime) {
      this.stop();
      this.handlers.onEnded();
      return;
    }

    this.frame = window.requestAnimationFrame(this.draw);
  };

  private playBell(time: number, freq: number) {
    const context = this.context;
    if (!context) return;
    const when = Math.max(time, context.currentTime);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.22, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.32);
    const stop = () => {
      try {
        oscillator.stop();
      } catch {
        // Already finished.
      }
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(stop);
    };
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(stop);
    };
    this.voices.add(stop);
  }

  private playVoice(time: number, kind: VoiceKind) {
    const context = this.context;
    if (!context || time < context.currentTime - 0.03) return;

    const when = Math.max(time, context.currentTime);
    const profile = VOICES[kind];
    const master = context.createGain();
    master.gain.setValueAtTime(1, when);
    master.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = kind === "clickHigh" || kind === "clickLow" ? "square" : "triangle";
    oscillator.frequency.setValueAtTime(profile.freq, when);
    const oscillatorGain = context.createGain();
    oscillator.connect(oscillatorGain);
    oscillatorGain.connect(master);
    oscillatorGain.gain.setValueAtTime(0.0001, when);
    oscillatorGain.gain.exponentialRampToValueAtTime(profile.gain, when + profile.attack);
    oscillatorGain.gain.exponentialRampToValueAtTime(0.0001, when + profile.decay);

    const noise = context.createBufferSource();
    noise.buffer = this.getNoise(context);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(profile.noiseFreq, when);
    filter.Q.setValueAtTime(0.8, when);
    const noiseGain = context.createGain();
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseGain.gain.setValueAtTime(Math.max(profile.noiseGain, 0.0001), when);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, when + profile.noiseDecay);

    const stopAt = when + Math.max(profile.decay, profile.noiseDecay) + 0.03;
    oscillator.start(when);
    oscillator.stop(stopAt);
    noise.start(when);
    noise.stop(when + profile.noiseDecay + 0.02);

    let disposed = false;
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      oscillator.disconnect();
      oscillatorGain.disconnect();
      noise.disconnect();
      filter.disconnect();
      noiseGain.disconnect();
      master.disconnect();
      this.voices.delete(stop);
    };
    const stop = () => {
      try {
        oscillator.stop();
      } catch {
        // The oscillator already ended.
      }
      try {
        noise.stop();
      } catch {
        // The noise burst already ended.
      }
      dispose();
    };

    oscillator.onended = dispose;
    this.voices.add(stop);
  }

  private getNoise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === context.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.max(1, Math.floor(context.sampleRate * 0.2));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private stopVoices() {
    const stops = [...this.voices];
    this.voices.clear();
    for (const stop of stops) stop();
  }
}
