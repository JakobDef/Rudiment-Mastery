"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { clampBpm, MAX_BPM, MIN_BPM } from "@/lib/audio-scheduler";
import { MetronomeEngine, type MetronomeFrame } from "@/lib/metronome-engine";
import {
  clickDivision,
  defaultAccents,
  HEARD_BAR_CHOICES,
  pushTap,
  RAMP_CHOICES,
  SILENT_BAR_CHOICES,
  TIME_SIGNATURES,
  timeSignatureById,
  toggleAccentAt,
  type Accent,
  type MetronomeSettings,
} from "@/lib/metronome";

function choiceClass(selected: boolean): string {
  return selected
    ? "rounded-2xl border-2 border-accent bg-panel-raised px-3 py-3 text-sm font-semibold text-accent"
    : "rounded-2xl border border-line bg-canvas px-3 py-3 text-sm font-medium text-muted";
}

function rampWord(start: number, target: number, progress: number): string {
  if (progress >= 1) return "Target tempo";
  if (target < start) return "Slowing down";
  if (target > start) return "Speeding up";
  return "Steady tempo";
}

export function PracticeMetronome() {
  const [signatureId, setSignatureId] = useState("4/4");
  const [subdivide, setSubdivide] = useState(false);
  const [accents, setAccents] = useState<Accent[]>(() => defaultAccents(timeSignatureById("4/4"), false));
  const [startBpm, setStartBpm] = useState(80);
  const [targetBpm, setTargetBpm] = useState(120);
  const [rampEnabled, setRampEnabled] = useState(false);
  const [rampSeconds, setRampSeconds] = useState(120);
  const [heardBars, setHeardBars] = useState(1);
  const [silentBars, setSilentBars] = useState(0);
  const [volume, setVolume] = useState(80);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<MetronomeFrame | null>(null);

  const engineRef = useRef<MetronomeEngine | null>(null);
  const tapsRef = useRef<number[]>([]);
  const signature = timeSignatureById(signatureId);
  const division = clickDivision(signature, subdivide);
  const settings: MetronomeSettings = {
    startBpm,
    targetBpm,
    rampEnabled,
    rampSeconds,
    accents,
    division,
    heardBars,
    silentBars,
    volume: volume / 100,
  };

  useEffect(() => {
    const engine = new MetronomeEngine((next) => setFrame(next));
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
      setPlaying(false);
      setFrame(null);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.update({
      startBpm,
      targetBpm,
      rampEnabled,
      rampSeconds,
      accents,
      division,
      heardBars,
      silentBars,
      volume: volume / 100,
    });
  }, [startBpm, targetBpm, rampEnabled, rampSeconds, accents, division, heardBars, silentBars, volume]);

  const live = playing ? frame : null;
  const bpm = live?.bpm ?? startBpm;
  const beatIndex = live?.beatIndex ?? 0;
  const silent = live?.silent ?? false;
  const status = !playing
    ? "Ready"
    : silent
      ? "Quiet bar"
      : rampEnabled
        ? rampWord(startBpm, targetBpm, live?.rampProgress ?? 0)
        : "Clicking";
  const cycle = heardBars + silentBars;
  const activeInCycle = live && silentBars > 0 ? live.barIndex % cycle : -1;
  const liveRamp = playing && rampEnabled;

  function applySignature(id: string) {
    const next = timeSignatureById(id);
    setSignatureId(id);
    setAccents(defaultAccents(next, subdivide && next.innerClicks > 1));
  }

  function applySubdivide(next: boolean) {
    setSubdivide(next);
    setAccents(defaultAccents(signature, next));
  }

  function togglePlay() {
    const engine = engineRef.current;
    if (!engine) return;
    if (playing) {
      engine.stop();
      setPlaying(false);
      setFrame(null);
      return;
    }
    const started = engine.start(settings);
    setPlaying(started);
    setFrame(null);
    setError(started ? null : "The browser blocked sound. Click play again.");
  }

  function tap() {
    const result = pushTap(tapsRef.current, performance.now() / 1000);
    tapsRef.current = result.taps;
    if (result.bpm) setStartBpm(result.bpm);
  }

  return (
    <section className="w-full rounded-2xl border border-line bg-panel p-5 sm:p-6">
      <h2 className="text-2xl font-semibold text-ink">Metronome</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Type the tempo, turn the ring, or click a dot to set an accent.
      </p>

      <BeatFace
        accents={accents}
        beatIndex={beatIndex}
        silent={silent}
        playing={playing}
        bpm={liveRamp ? bpm : startBpm}
        status={status}
        tempoLocked={liveRamp}
        onBpm={setStartBpm}
        onToggleAccent={(index) => setAccents((current) => toggleAccentAt(current, index))}
      />
      <p className="mt-3 text-center text-sm text-muted">
        {signature.label}, {signature.hint.toLowerCase()}. Click a dot to accent it. {signature.tempoLabel}.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Button
          tone="accent"
          className="min-w-28 px-8 py-3 text-base"
          aria-pressed={playing}
          onClick={togglePlay}
        >
          {playing ? "Stop" : "Play"}
        </Button>
        <Button tone="quiet" onClick={tap}>
          Tap tempo
        </Button>
      </div>
      {error ? <p className="mt-3 text-center text-sm text-accent">{error}</p> : null}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className="text-xs font-medium tracking-wide text-muted">Time signature</h3>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {TIME_SIGNATURES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={choiceClass(option.id === signatureId)}
                aria-pressed={option.id === signatureId}
                onClick={() => applySignature(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {signature.innerClicks > 1 ? (
            <button
              type="button"
              className={`mt-3 w-full text-left ${choiceClass(subdivide)}`}
              aria-pressed={subdivide}
              onClick={() => applySubdivide(!subdivide)}
            >
              <span className="block">Small clicks</span>
              <span className="mt-1 block text-xs font-normal">
                Also click the notes between the big beats.
              </span>
            </button>
          ) : null}
        </section>

        <section>
          <h3 className="text-xs font-medium tracking-wide text-muted">Quiet bars</h3>
          <p className="mt-2 text-sm text-muted">The dots keep moving, so you can count through the gap.</p>
          <p className="mt-3 text-sm text-ink">Click for</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {HEARD_BAR_CHOICES.map((option) => (
              <button
                key={option}
                type="button"
                className={choiceClass(option === heardBars)}
                aria-pressed={option === heardBars}
                onClick={() => setHeardBars(option)}
              >
                {option} {option === 1 ? "bar" : "bars"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink">Then quiet for</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {SILENT_BAR_CHOICES.map((option) => (
              <button
                key={option}
                type="button"
                className={choiceClass(option === silentBars)}
                aria-pressed={option === silentBars}
                onClick={() => setSilentBars(option)}
              >
                {option === 0 ? "Off" : option}
              </button>
            ))}
          </div>
          {silentBars > 0 ? (
            <PatternPreview
              heardBars={heardBars}
              silentBars={silentBars}
              activeIndex={activeInCycle}
            />
          ) : null}
        </section>
      </div>

      <section className="mt-6 border-t border-line pt-6">
        <button
          type="button"
          className={`flex w-full items-center justify-between gap-3 text-left ${choiceClass(rampEnabled)}`}
          aria-pressed={rampEnabled}
          onClick={() => setRampEnabled((value) => !value)}
        >
          <span>
            <span className="block">Speed up over time</span>
            <span className="mt-1 block text-xs font-normal">
              The tempo moves evenly from the start to the target.
            </span>
          </span>
          <span>{rampEnabled ? "On" : "Off"}</span>
        </button>
        {rampEnabled ? (
          <div className="mt-4 flex flex-col gap-4">
            <TempoRow label="Start" value={startBpm} onChange={setStartBpm} />
            <TempoRow label="Target" value={targetBpm} onChange={setTargetBpm} />
            <div>
              <p className="text-sm text-ink">Over</p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {RAMP_CHOICES.map((option) => (
                  <button
                    key={option.seconds}
                    type="button"
                    className={choiceClass(option.seconds === rampSeconds)}
                    aria-pressed={option.seconds === rampSeconds}
                    onClick={() => setRampSeconds(option.seconds)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div
                className="h-2 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((live?.rampProgress ?? 0) * 100)}
                aria-label="Tempo change"
              >
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.round((live?.rampProgress ?? 0) * 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted">
                {startBpm} to {targetBpm}
                {playing ? `, ${rampWord(startBpm, targetBpm, live?.rampProgress ?? 0).toLowerCase()}` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <div className="mt-6 border-t border-line pt-6">
        <Slider label="Volume" min={0} max={100} value={volume} onChange={setVolume} />
      </div>
    </section>
  );
}

function BeatFace({
  accents,
  beatIndex,
  silent,
  playing,
  bpm,
  status,
  tempoLocked,
  onBpm,
  onToggleAccent,
}: {
  accents: readonly Accent[];
  beatIndex: number;
  silent: boolean;
  playing: boolean;
  bpm: number;
  status: string;
  tempoLocked: boolean;
  onBpm: (value: number) => void;
  onToggleAccent: (index: number) => void;
}) {
  const faceRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ angle: number; bpm: number } | null>(null);
  const clicks = Math.max(1, accents.length);

  useEffect(() => {
    const node = faceRef.current;
    if (!node || tempoLocked) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = event.shiftKey || Math.abs(event.deltaY) > 40 ? 5 : 1;
      const direction = event.deltaY > 0 ? -1 : 1;
      onBpm(clampBpm(bpm + direction * step));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [bpm, onBpm, tempoLocked]);

  function angleFromEvent(event: ReactPointerEvent<SVGCircleElement>): number {
    const node = faceRef.current;
    if (!node) return 0;
    const box = node.getBoundingClientRect();
    return Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2));
  }

  function onRingDown(event: ReactPointerEvent<SVGCircleElement>) {
    if (tempoLocked) return;
    event.preventDefault();
    dragRef.current = { angle: angleFromEvent(event), bpm };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some browsers only capture a real pointer.
    }
  }

  function onRingMove(event: ReactPointerEvent<SVGCircleElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const angle = angleFromEvent(event);
    let delta = angle - drag.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    const steps = Math.round((delta * 180) / Math.PI);
    if (steps === 0) return;
    drag.angle = angle;
    drag.bpm = clampBpm(drag.bpm + steps);
    onBpm(drag.bpm);
  }

  function onRingUp(event: ReactPointerEvent<SVGCircleElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div ref={faceRef} className="relative mx-auto mt-6 aspect-square w-full max-w-[300px] select-none">
      <svg viewBox="0 0 280 280" className="h-full w-full">
        <circle
          cx="140"
          cy="140"
          r="128"
          fill="none"
          strokeWidth="2"
          className={playing && !silent ? "stroke-accent" : "stroke-line"}
        />
        <circle
          cx="140"
          cy="140"
          r="116"
          fill="none"
          strokeWidth="36"
          className={tempoLocked ? "stroke-transparent" : "cursor-grab stroke-transparent active:cursor-grabbing"}
          onPointerDown={onRingDown}
          onPointerMove={onRingMove}
          onPointerUp={onRingUp}
          onPointerCancel={onRingUp}
        />
      </svg>
      {accents.map((accent, index) => {
        const angle = -Math.PI / 2 + (index / clicks) * Math.PI * 2;
        const current = playing && index === beatIndex;
        const accented = accent === "high";
        return (
          <button
            key={index}
            type="button"
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${
              current ? "h-9 w-9" : "h-8 w-8"
            }`}
            style={{
              left: `${50 + Math.cos(angle) * 37}%`,
              top: `${50 + Math.sin(angle) * 37}%`,
            }}
            aria-label={
              accented
                ? `Beat ${index + 1}, accent. Click for a normal click.`
                : `Beat ${index + 1}, normal. Click to accent.`
            }
            aria-pressed={accented}
            onClick={() => onToggleAccent(index)}
          >
            <span
              className={`rounded-full ${current ? "h-5 w-5" : accented ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} ${
                current ? (silent ? "bg-ghost" : "bg-accent") : accented ? "bg-muted" : "bg-line"
              }`}
            />
          </button>
        );
      })}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center">
        <div className="pointer-events-auto">
          <BpmInput value={bpm} onChange={onBpm} size="hero" disabled={tempoLocked} />
        </div>
        <p className="mt-3 text-sm text-ink">
          Beat {Math.min(clicks, beatIndex + 1)} of {clicks}
        </p>
        <p className={`mt-1 text-sm font-medium ${playing && !silent ? "text-accent" : "text-muted"}`}>{status}</p>
      </div>
    </div>
  );
}

function BpmInput({
  value,
  onChange,
  size,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  size: "hero" | "row";
  disabled?: boolean;
}) {
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const className =
    size === "hero"
      ? "w-[4.5ch] bg-transparent text-center font-mono text-6xl leading-none text-ink outline-none disabled:opacity-100"
      : "w-[4.5ch] rounded-xl border border-line bg-canvas px-2 py-1 text-center font-mono text-lg text-ink outline-none focus:border-accent";

  useEffect(() => {
    const node = fieldRef.current;
    if (!node || document.activeElement === node) return;
    node.value = String(value);
  }, [value]);

  function commit(raw: string) {
    const parsed = Number.parseInt(raw.replace(/[^\d-]/g, ""), 10);
    if (Number.isFinite(parsed)) onChange(clampBpm(parsed));
    else if (fieldRef.current) fieldRef.current.value = String(value);
  }

  if (disabled) {
    return (
      <p className="font-mono text-6xl leading-none text-ink" aria-live="polite">
        {value}
      </p>
    );
  }

  return (
    <input
      ref={fieldRef}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="Tempo"
      defaultValue={String(value)}
      min={MIN_BPM}
      max={MAX_BPM}
      className={className}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => commit(event.currentTarget.value)}
      onInput={(event) => {
        event.currentTarget.value = event.currentTarget.value.replace(/[^\d]/g, "").slice(0, 3);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const step = event.shiftKey ? 5 : 1;
          const shown = Number.parseInt(event.currentTarget.value, 10);
          const base = Number.isFinite(shown) ? shown : value;
          const next = clampBpm(base + (event.key === "ArrowUp" ? step : -step));
          event.currentTarget.value = String(next);
          onChange(next);
        }
      }}
    />
  );
}

function PatternPreview({
  heardBars,
  silentBars,
  activeIndex,
}: {
  heardBars: number;
  silentBars: number;
  activeIndex: number;
}) {
  const total = heardBars + silentBars;
  return (
    <div className="mt-4 flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => {
        const sounding = index < heardBars;
        const current = index === activeIndex;
        return (
          <span
            key={index}
            className={`flex-1 rounded-full ${current ? "h-3" : "h-2"} ${sounding ? "bg-accent" : "bg-line"}`}
          />
        );
      })}
    </div>
  );
}

function TempoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const dragRef = useRef<{ x: number; bpm: number } | null>(null);

  function onScrubDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, bpm: value };
  }

  function onScrubMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const steps = Math.round((event.clientX - drag.x) / 3);
    if (steps === 0) return;
    drag.x = event.clientX;
    drag.bpm = clampBpm(drag.bpm + steps);
    onChange(drag.bpm);
  }

  function onScrubUp(event: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-ink">{label}</p>
      <div className="flex items-center gap-2">
        <BpmInput value={value} onChange={onChange} size="row" />
        <button
          type="button"
          className="h-10 w-16 cursor-ew-resize rounded-full border border-line bg-canvas"
          aria-label={`Drag to change ${label.toLowerCase()} tempo`}
          onPointerDown={onScrubDown}
          onPointerMove={onScrubMove}
          onPointerUp={onScrubUp}
          onPointerCancel={onScrubUp}
        >
          <span className="mx-auto block h-1 w-8 rounded-full bg-muted" />
        </button>
      </div>
    </div>
  );
}
