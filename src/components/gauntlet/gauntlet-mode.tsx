import { MAX_BPM, MIN_BPM } from "@/lib/audio-scheduler";
import {
  barInStep,
  nextTempoJump,
  nextRudimentId,
  workoutProgress,
  type BarsPerStep,
  type BpmStep,
  type WorkoutMode,
  type WorkoutState,
} from "@/lib/gauntlet-engine";
import { getRudimentById } from "@/lib/rudiments";
import { Button } from "@/components/ui/button";

const fieldClass =
  "w-full rounded-xl border border-line bg-canvas px-3 py-2 text-ink outline-none focus:border-accent";

type GauntletModeProps = {
  mode: WorkoutMode;
  startBpm: number;
  targetBpm: number;
  bpmStep: BpmStep;
  barsPerStep: BarsPerStep;
  running: boolean;
  repetition: number;
  workout: WorkoutState | null;
  onMode: (mode: WorkoutMode) => void;
  onStartBpm: (bpm: number) => void;
  onTargetBpm: (bpm: number) => void;
  onBpmStep: (step: BpmStep) => void;
  onBarsPerStep: (bars: BarsPerStep) => void;
  onStart: () => void;
  onStop: () => void;
};

function parseBpm(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(parsed)));
}

export function GauntletMode({
  mode,
  startBpm,
  targetBpm,
  bpmStep,
  barsPerStep,
  running,
  repetition,
  workout,
  onMode,
  onStartBpm,
  onTargetBpm,
  onBpmStep,
  onBarsPerStep,
  onStart,
  onStop,
}: GauntletModeProps) {
  const progress = workout ? workoutProgress(workout) : 0;
  const jump = workout ? nextTempoJump(workout) : null;
  const upcomingId = workout ? nextRudimentId(workout) : null;
  const upcoming = upcomingId ? getRudimentById(upcomingId) : undefined;
  const speedBlocked = mode === "speed" && targetBpm < startBpm;

  let status = "Set a start tempo, a target, and how long to stay on each step.";
  if (mode === "queue") {
    status = "The queue keeps going. Each step hands off to the next rudiment without a stop.";
  }
  if (!workout && speedBlocked) {
    status = "Target tempo needs to be at least the start tempo.";
  }
  if (workout) {
    const bar = barInStep(workout);
    const jumpText = jump === null ? "Target tempo reached." : `Next jump: ${jump} BPM.`;
    const queueText = upcoming ? `Next rudiment: ${upcoming.name}.` : "This rudiment keeps repeating.";
    status = `Bar ${bar} of ${workout.barsPerStep}. Rep ${repetition}. ${
      workout.mode === "speed" ? jumpText : queueText
    }`;
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Pad Gauntlet</h2>
          <p className="text-sm text-muted">Speed builder</p>
        </div>
        <div className="flex gap-2">
          <Button tone={mode === "speed" ? "accent" : "quiet"} disabled={running} onClick={() => onMode("speed")}>
            Speed builder
          </Button>
          <Button tone={mode === "queue" ? "accent" : "quiet"} disabled={running} onClick={() => onMode("queue")}>
            Workout queue
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-muted">
          Start BPM
          <input
            className={`mt-1 ${fieldClass}`}
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={startBpm}
            disabled={running}
            onChange={(event) => onStartBpm(parseBpm(event.target.value))}
          />
        </label>
        <label className="text-sm text-muted">
          Target BPM
          <input
            className={`mt-1 ${fieldClass}`}
            type="number"
            min={MIN_BPM}
            max={MAX_BPM}
            value={targetBpm}
            disabled={running || mode === "queue"}
            onChange={(event) => onTargetBpm(parseBpm(event.target.value))}
          />
        </label>
        <label className="text-sm text-muted">
          BPM step
          <select
            className={`mt-1 ${fieldClass}`}
            value={bpmStep}
            disabled={running || mode === "queue"}
            onChange={(event) => onBpmStep(Number(event.target.value) as BpmStep)}
          >
            <option value={2}>+2 BPM</option>
            <option value={5}>+5 BPM</option>
            <option value={10}>+10 BPM</option>
          </select>
        </label>
        <label className="text-sm text-muted">
          Bars per step
          <select
            className={`mt-1 ${fieldClass}`}
            value={barsPerStep}
            disabled={running}
            onChange={(event) => onBarsPerStep(Number(event.target.value) as BarsPerStep)}
          >
            <option value={2}>2 bars</option>
            <option value={4}>4 bars</option>
            <option value={8}>8 bars</option>
            <option value={16}>16 bars</option>
          </select>
        </label>
      </div>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Workout progress"
        >
          <div className="h-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm text-ink">{status}</p>
      </div>

      <div className="mt-4 flex gap-2">
        {running ? (
          <Button tone="accent" onClick={onStop}>
            Stop workout
          </Button>
        ) : (
          <Button tone="accent" onClick={onStart} disabled={speedBlocked}>
            Start workout
          </Button>
        )}
      </div>
    </section>
  );
}
