import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { clampBpm, MAX_BPM, MIN_BPM } from "@/lib/audio-scheduler";
import {
  currentExercise,
  formatClock,
  remainingExerciseSeconds,
  remainingSessionSeconds,
  shiftExerciseTempo,
  type PracticePlan,
} from "@/lib/practice-plan";
import { getRudimentById } from "@/lib/rudiments";

const BPM_STEPS = [-5, -1, 1, 5] as const;

type PracticeSessionProps = {
  plan: PracticePlan;
  exerciseIndex: number;
  elapsedSeconds: number;
  bpm: number;
  tempoShift: number;
  finished: boolean;
  canSwap: boolean;
  onBpm: (bpm: number) => void;
  onNudge: (delta: number) => void;
  onBack: () => void;
  onAgain: () => void;
  onSwap: () => void;
};

export function PracticeSessionBar({
  plan,
  exerciseIndex,
  elapsedSeconds,
  bpm,
  tempoShift,
  finished,
  canSwap,
  onBpm,
  onNudge,
  onBack,
  onAgain,
  onSwap,
}: PracticeSessionProps) {
  const exercise = currentExercise(plan, exerciseIndex);
  const rudiment = exercise ? getRudimentById(exercise.rudimentId) : undefined;
  const upcoming = currentExercise(plan, exerciseIndex + 1);
  const leftHere = exercise ? remainingExerciseSeconds(exercise, elapsedSeconds) : 0;
  const leftSession = remainingSessionSeconds(plan, exerciseIndex, elapsedSeconds);
  const due = Boolean(exercise && leftHere <= 0 && !finished);
  const overtime = due ? Math.max(0, Math.floor(elapsedSeconds - (exercise?.durationSeconds ?? 0))) : 0;
  const phaseLabel = exercise?.phase === "push" ? "Faster round" : "Warmup";
  const tempo = exercise ? shiftExerciseTempo(exercise, tempoShift) : null;
  const exerciseProgress =
    !exercise || exercise.durationSeconds <= 0
      ? 0
      : Math.min(100, Math.round((elapsedSeconds / exercise.durationSeconds) * 100));
  const sessionProgress =
    plan.estimatedSeconds <= 0
      ? 0
      : Math.min(100, Math.round(((plan.estimatedSeconds - leftSession) / plan.estimatedSeconds) * 100));

  let status = `${phaseLabel}. Tempo climbs from ${tempo?.startBpm ?? 0} to ${tempo?.endBpm ?? 0} BPM.`;
  if (finished) {
    status = "Done. You can start the same plan again, go back a step, or pick a new plan.";
  } else if (due) {
    status = upcoming
      ? "Time's up. Keep going, go back, or tap Next for the next one."
      : "Time's up. Keep going, go back, or tap Next to finish.";
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            {finished ? "Practice complete" : phaseLabel}
          </h2>
          <p className="text-sm text-muted">{rudiment?.name ?? "Practice"}</p>
        </div>
        <Button tone="quiet" onClick={onBack}>
          Back
        </Button>
      </div>

      <ProgressMarks plan={plan} exerciseIndex={exerciseIndex} finished={finished} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted">This exercise</p>
          <p className="mt-1 font-mono text-5xl text-ink">{formatClock(leftHere)}</p>
          {due && overtime > 0 ? (
            <p className="mt-1 text-sm text-accent">+{formatClock(overtime)} extra</p>
          ) : null}
          {finished ? (
            <p className="mt-1 text-sm text-muted">{bpm} BPM</p>
          ) : (
            <TempoOverride bpm={bpm} onBpm={onBpm} onNudge={onNudge} />
          )}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-accent" style={{ width: `${finished ? 100 : exerciseProgress}%` }} />
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted">Session left</p>
          <p className="mt-1 font-mono text-5xl text-ink">{formatClock(finished ? 0 : leftSession)}</p>
          <p className="mt-1 text-sm text-muted">
            {finished ? "All done" : `${plan.minutes} min plan`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div className="h-full bg-muted" style={{ width: `${finished ? 100 : sessionProgress}%` }} />
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-ink">{status}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {finished ? (
          <Button tone="accent" onClick={onAgain}>
            Start again
          </Button>
        ) : (
          <Button tone="quiet" onClick={onSwap} disabled={!canSwap}>
            Change
          </Button>
        )}
      </div>
    </section>
  );
}

function TempoOverride({
  bpm,
  onBpm,
  onNudge,
}: {
  bpm: number;
  onBpm: (bpm: number) => void;
  onNudge: (delta: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <BpmField value={bpm} onChange={onBpm} />
        <span className="text-sm text-muted">BPM</span>
        {BPM_STEPS.map((step) => (
          <Button
            key={step}
            tone="panel"
            className="min-w-10 px-2 font-mono"
            onClick={() => onNudge(step)}
          >
            {step > 0 ? `+${step}` : step}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">Buttons move the start and end. The tempo still climbs.</p>
    </div>
  );
}

function BpmField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const fieldRef = useRef<HTMLInputElement | null>(null);

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
      className="w-[4.5ch] rounded-xl border border-line bg-canvas px-2 py-1 text-center font-mono text-lg text-ink outline-none focus:border-accent"
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

export function PracticeTransport({
  playing,
  finished,
  canGoPrevious,
  canGoNext,
  due,
  onPrevious,
  onPause,
  onResume,
  onNext,
}: {
  playing: boolean;
  finished: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  due: boolean;
  onPrevious: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel px-4 py-5">
      <div className="flex items-center justify-center gap-5 sm:gap-8">
        <TransportButton
          label="Previous"
          disabled={!canGoPrevious}
          onClick={onPrevious}
        >
          <SkipBackIcon />
        </TransportButton>
        <TransportButton
          label={playing ? "Pause" : "Resume"}
          size="lg"
          disabled={finished}
          onClick={playing ? onPause : onResume}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </TransportButton>
        <TransportButton
          label={canGoNext ? "Next" : "Finish"}
          glow={due && !finished}
          disabled={finished}
          onClick={onNext}
        >
          {canGoNext ? <SkipForwardIcon /> : <FinishIcon />}
        </TransportButton>
      </div>
    </section>
  );
}

function TransportButton({
  label,
  children,
  onClick,
  disabled,
  glow,
  size = "md",
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  glow?: boolean;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-24 w-24" : "h-16 w-16";
  const toneClass = glow ? "bg-accent text-canvas-ink" : "bg-panel-raised text-ink";
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border border-line transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${sizeClass} ${toneClass}`}
    >
      {children}
    </button>
  );
}

function SkipBackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path d="M18.5 5.5v13L9 12l9.5-6.5Z" fill="currentColor" />
      <path d="M6.2 5.5h2.4v13H6.2Z" fill="currentColor" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path d="M5.5 5.5v13L15 12 5.5 5.5Z" fill="currentColor" />
      <path d="M15.4 5.5h2.4v13h-2.4Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-11 w-11" aria-hidden="true">
      <path d="M7 5.5h3.2v13H7Z" fill="currentColor" />
      <path d="M13.8 5.5H17v13h-3.2Z" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-11 w-11" aria-hidden="true">
      <path d="M8 5.5v13L19 12 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

function FinishIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9" aria-hidden="true">
      <path
        d="M6 12.5 10.2 16.7 18.2 8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProgressMarks({
  plan,
  exerciseIndex,
  finished,
}: {
  plan: PracticePlan;
  exerciseIndex: number;
  finished: boolean;
}) {
  const warmupCount = plan.exercises.filter((exercise) => exercise.phase === "warmup").length;
  const total = plan.exercises.length;
  const doneCount = finished ? total : exerciseIndex;
  const leftCount = finished ? 0 : Math.max(0, total - exerciseIndex - 1);
  const label = finished
    ? `All ${total} done`
    : `${doneCount} done, this one, ${leftCount} coming`;

  return (
    <ol className="mt-4 flex items-center justify-center gap-2" aria-label={label}>
      {plan.exercises.flatMap((exercise, index) => {
        const done = finished || index < exerciseIndex;
        const current = !finished && index === exerciseIndex;
        const mark = (
          <li key={`${exercise.phase}-${index}`}>
            <span
              className={
                current
                  ? "flex h-11 w-11 items-center justify-center rounded-full border-2 border-accent bg-panel-raised text-accent"
                  : done
                    ? "flex h-11 w-11 items-center justify-center rounded-full bg-active text-canvas-ink"
                    : "flex h-11 w-11 items-center justify-center rounded-full border border-line bg-panel text-muted"
              }
              aria-current={current ? "step" : undefined}
              aria-label={current ? "Now" : done ? "Done" : "Coming"}
            >
              {current ? <HourglassIcon /> : done ? <CheckIcon /> : <SticksIcon />}
            </span>
          </li>
        );
        if (index === warmupCount - 1 && index < total - 1) {
          return [
            mark,
            <li key="split" aria-hidden="true" className="mx-1 h-5 w-px bg-line" />,
          ];
        }
        return [mark];
      })}
    </ol>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M6 12.5 10.2 16.7 18.2 8.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HourglassIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path
        d="M7 5h10M7 19h10M7 5c0 3.6 3.2 5.2 5 7 1.8-1.8 5-3.4 5-7M7 19c0-3.6 3.2-5.2 5-7 1.8 1.8 5 3.4 5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9.2 7.4h5.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M10.4 16.6h3.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SticksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path d="M6.5 18.5 12 6.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12.5 18.5 18 6.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="12" cy="5.4" rx="2.1" ry="1.5" transform="rotate(-62 12 5.4)" fill="currentColor" />
      <ellipse cx="18" cy="5.4" rx="2.1" ry="1.5" transform="rotate(-62 18 5.4)" fill="currentColor" />
      <circle cx="6.5" cy="18.5" r="1.35" fill="currentColor" />
      <circle cx="12.5" cy="18.5" r="1.35" fill="currentColor" />
    </svg>
  );
}
