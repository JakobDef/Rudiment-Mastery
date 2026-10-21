import { clampBpm } from "@/lib/audio-scheduler";

export type BpmStep = 2 | 5 | 10;
export type BarsPerStep = 2 | 4 | 8 | 16;
export type WorkoutMode = "speed" | "queue";

export interface WorkoutConfig {
  mode: WorkoutMode;
  startBpm: number;
  targetBpm: number;
  bpmStep: BpmStep;
  barsPerStep: BarsPerStep;
  rudimentIds: readonly string[];
}

export interface WorkoutState {
  mode: WorkoutMode;
  startBpm: number;
  targetBpm: number;
  bpmStep: BpmStep;
  barsPerStep: BarsPerStep;
  bpm: number;
  barsIntoStep: number;
  rudimentIds: readonly string[];
  rudimentCursor: number;
  targetReached: boolean;
}

export function createWorkout(config: WorkoutConfig): WorkoutState {
  const startBpm = clampBpm(config.startBpm);
  const targetBpm = clampBpm(Math.max(config.targetBpm, startBpm));
  return {
    mode: config.mode,
    startBpm,
    targetBpm,
    bpmStep: config.bpmStep,
    barsPerStep: config.barsPerStep,
    bpm: startBpm,
    barsIntoStep: 0,
    rudimentIds: config.rudimentIds,
    rudimentCursor: 0,
    targetReached: config.mode === "speed" && startBpm >= targetBpm,
  };
}

export function reduceCompletedBar(state: WorkoutState): WorkoutState {
  const completed = state.barsIntoStep + 1;
  if (completed < state.barsPerStep) {
    return { ...state, barsIntoStep: completed };
  }

  if (state.mode === "queue") {
    const count = state.rudimentIds.length;
    const nextCursor = count === 0 ? 0 : (state.rudimentCursor + 1) % count;
    return { ...state, barsIntoStep: 0, rudimentCursor: nextCursor };
  }

  const bpm = Math.min(state.targetBpm, state.bpm + state.bpmStep);
  return {
    ...state,
    barsIntoStep: 0,
    bpm,
    targetReached: bpm >= state.targetBpm,
  };
}

export function currentRudimentId(state: WorkoutState): string | null {
  const index = state.mode === "queue" ? state.rudimentCursor : 0;
  return state.rudimentIds[index] ?? null;
}

export function nextRudimentId(state: WorkoutState): string | null {
  if (state.mode !== "queue" || state.rudimentIds.length === 0) return null;
  const index = (state.rudimentCursor + 1) % state.rudimentIds.length;
  return state.rudimentIds[index] ?? null;
}

export function nextTempoJump(state: WorkoutState): number | null {
  if (state.mode !== "speed" || state.bpm >= state.targetBpm) return null;
  return Math.min(state.targetBpm, state.bpm + state.bpmStep);
}

export function barInStep(state: WorkoutState): number {
  return state.barsIntoStep + 1;
}

export function workoutProgress(state: WorkoutState): number {
  if (state.mode === "queue") {
    const count = state.rudimentIds.length;
    if (count <= 1) return 1;
    return state.rudimentCursor / count;
  }

  const span = state.targetBpm - state.startBpm;
  if (span <= 0) return 1;
  const partial = (state.barsIntoStep / state.barsPerStep) * state.bpmStep;
  return Math.min(1, Math.max(0, (state.bpm - state.startBpm + partial) / span));
}
