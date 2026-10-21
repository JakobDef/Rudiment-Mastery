import { clampBpm, MAX_BPM, MIN_BPM } from "@/lib/audio-scheduler";
import { getRudimentById, type Difficulty, type Rudiment, type RudimentCategory } from "@/lib/rudiments";

const SIXTEENTH_NOTES_PER_BEAT = 4;

export type SessionMinutes = 5 | 10 | 15 | 20;
export type SkillLevel = 1 | 2 | 3 | 4;
export type RudimentBand = "easy" | "medium" | "hard";
export type PracticePhase = "warmup" | "push";

export interface SkillBand {
  level: SkillLevel;
  low: number;
  high: number;
}

export const SKILL_BANDS: readonly SkillBand[] = [
  { level: 1, low: 50, high: 70 },
  { level: 2, low: 70, high: 90 },
  { level: 3, low: 90, high: 120 },
  { level: 4, low: 120, high: 150 },
];

export const SESSION_MINUTES: readonly SessionMinutes[] = [5, 10, 15, 20];

export const RUDIMENT_BANDS: readonly {
  id: RudimentBand;
  label: string;
  min: Difficulty;
  max: Difficulty;
}[] = [
  { id: "easy", label: "Easy", min: 1, max: 2 },
  { id: "medium", label: "Medium", min: 2, max: 3 },
  { id: "hard", label: "Hard", min: 4, max: 5 },
];

export interface PracticeExercise {
  rudimentId: string;
  phase: PracticePhase;
  startBpm: number;
  endBpm: number;
  durationSeconds: number;
}

export interface PracticePlan {
  minutes: SessionMinutes;
  skill: SkillLevel;
  band: RudimentBand;
  rudimentIds: readonly string[];
  exercises: readonly PracticeExercise[];
  warmupLow: number;
  warmupHigh: number;
  pushLow: number;
  pushHigh: number;
  estimatedSeconds: number;
}

export function skillBand(level: SkillLevel): SkillBand {
  const found = SKILL_BANDS.find((band) => band.level === level);
  return found ?? { level: 1, low: 50, high: 70 };
}

export function rudimentCountForMinutes(minutes: SessionMinutes): number {
  return minutes === 5 ? 2 : 3;
}

export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function currentExercise(plan: PracticePlan, index: number): PracticeExercise | null {
  return plan.exercises[index] ?? null;
}

export function remainingExerciseSeconds(exercise: PracticeExercise, elapsedSeconds: number): number {
  return Math.max(0, exercise.durationSeconds - Math.max(0, elapsedSeconds));
}

export function remainingSessionSeconds(
  plan: PracticePlan,
  exerciseIndex: number,
  elapsedSeconds: number,
): number {
  const current = currentExercise(plan, exerciseIndex);
  if (!current) return 0;
  let total = remainingExerciseSeconds(current, elapsedSeconds);
  for (let index = exerciseIndex + 1; index < plan.exercises.length; index += 1) {
    const exercise = plan.exercises[index];
    if (exercise) total += exercise.durationSeconds;
  }
  return total;
}

export function exerciseDue(exercise: PracticeExercise, elapsedSeconds: number): boolean {
  return elapsedSeconds >= exercise.durationSeconds;
}

export function exerciseBpm(exercise: PracticeExercise, elapsedSeconds: number): number {
  if (exercise.durationSeconds <= 0 || elapsedSeconds >= exercise.durationSeconds) {
    return clampBpm(exercise.endBpm);
  }
  const t = Math.min(1, Math.max(0, elapsedSeconds / exercise.durationSeconds));
  return clampBpm(exercise.startBpm + (exercise.endBpm - exercise.startBpm) * t);
}

export function clampTempoShift(exercise: PracticeExercise, shift: number): number {
  const low = Math.min(exercise.startBpm, exercise.endBpm);
  const high = Math.max(exercise.startBpm, exercise.endBpm);
  const minShift = MIN_BPM - low;
  const maxShift = MAX_BPM - high;
  if (!Number.isFinite(shift)) return 0;
  return Math.round(Math.min(maxShift, Math.max(minShift, shift)));
}

export function shiftExerciseTempo(exercise: PracticeExercise, shift: number): PracticeExercise {
  const next = clampTempoShift(exercise, shift);
  if (next === 0) return exercise;
  return {
    ...exercise,
    startBpm: clampBpm(exercise.startBpm + next),
    endBpm: clampBpm(exercise.endBpm + next),
  };
}

export function strokeEquivalentBpm(metronomeBpm: number, subdivision: number): number {
  const steps = subdivision > 0 ? subdivision : SIXTEENTH_NOTES_PER_BEAT;
  return metronomeBpm * (steps / SIXTEENTH_NOTES_PER_BEAT);
}

export function metronomeForStrokeBpm(strokeBpm: number, subdivision: number): number {
  const steps = subdivision > 0 ? subdivision : SIXTEENTH_NOTES_PER_BEAT;
  return clampBpm(strokeBpm * (SIXTEENTH_NOTES_PER_BEAT / steps));
}

export function fitsStrokeBand(rudiment: Rudiment, strokeLow: number, strokeHigh: number): boolean {
  const playLow = Math.min(rudiment.defaultBpm, rudiment.targetBpm);
  const playHigh = Math.max(rudiment.defaultBpm, rudiment.targetBpm);
  const equivalentLow = strokeEquivalentBpm(playLow, rudiment.subdivision);
  const equivalentHigh = strokeEquivalentBpm(playHigh, rudiment.subdivision);
  return strokeLow <= equivalentHigh && equivalentLow <= strokeHigh;
}

export function bandPool(
  catalog: readonly Rudiment[],
  band: RudimentBand,
  skill?: SkillBand,
): Rudiment[] {
  const spec = RUDIMENT_BANDS.find((item) => item.id === band) ?? RUDIMENT_BANDS[1];
  const min = spec?.min ?? 2;
  const max = spec?.max ?? 3;
  let low: number = min;
  let high: number = max;
  const byDifficulty = (diffLow: number, diffHigh: number) =>
    catalog.filter((rudiment) => rudiment.difficulty >= diffLow && rudiment.difficulty <= diffHigh);
  let pool = byDifficulty(low, high);
  while (pool.length < 3 && (low > 1 || high < 5)) {
    if (low > 1) low -= 1;
    if (pool.length < 3 && high < 5) high += 1;
    pool = byDifficulty(low, high);
  }
  if (!skill) return pool;
  const byStroke = pool.filter((rudiment) => fitsStrokeBand(rudiment, skill.low, skill.high));
  return byStroke.length >= 3 ? byStroke : pool;
}

export function applyRudimentIds(plan: PracticePlan, rudimentIds: readonly string[]): PracticePlan {
  const count = plan.rudimentIds.length;
  if (rudimentIds.length !== count) return plan;
  return {
    ...plan,
    rudimentIds: [...rudimentIds],
    exercises: plan.exercises.map((exercise, index) => {
      const slot = index % count;
      const rudimentId = rudimentIds[slot] ?? exercise.rudimentId;
      return withStrokeTempo(plan, { ...exercise, rudimentId });
    }),
  };
}

export function replaceFromExercise(
  plan: PracticePlan,
  exerciseIndex: number,
  rudimentId: string,
): PracticePlan {
  const count = plan.rudimentIds.length;
  if (count === 0 || exerciseIndex < 0 || exerciseIndex >= plan.exercises.length) return plan;
  const slot = exerciseIndex % count;
  const rudimentIds = plan.rudimentIds.map((id, index) => (index === slot ? rudimentId : id));
  return {
    ...plan,
    rudimentIds,
    exercises: plan.exercises.map((exercise, index) => {
      if (index < exerciseIndex) return exercise;
      if (index % count !== slot) return exercise;
      return withStrokeTempo(plan, { ...exercise, rudimentId });
    }),
  };
}

export function slotForExercise(plan: PracticePlan, exerciseIndex: number): number {
  const count = plan.rudimentIds.length;
  if (count === 0) return 0;
  return ((exerciseIndex % count) + count) % count;
}

export function suggestReplacement(
  plan: PracticePlan,
  slot: number,
  catalog: readonly Rudiment[],
): string | null {
  const currentId = plan.rudimentIds[slot];
  if (!currentId || slot < 0 || slot >= plan.rudimentIds.length) return null;
  const taken = new Set(plan.rudimentIds.filter((_, index) => index !== slot));
  const pool = bandPool(catalog, plan.band, skillBand(plan.skill));
  const alternatives = pool.filter((rudiment) => !taken.has(rudiment.id) && rudiment.id !== currentId);
  if (alternatives.length === 0) return null;

  const usedCategories = new Set<RudimentCategory>();
  for (const id of taken) {
    const rudiment = catalog.find((item) => item.id === id);
    if (rudiment) usedCategories.add(rudiment.category);
  }
  const preferred = alternatives.filter((rudiment) => !usedCategories.has(rudiment.category));
  const ranked = preferred.length > 0 ? preferred : alternatives;
  const currentIndex = pool.findIndex((rudiment) => rudiment.id === currentId);
  const rotated = [
    ...ranked.filter((rudiment) => pool.findIndex((item) => item.id === rudiment.id) > currentIndex),
    ...ranked.filter((rudiment) => pool.findIndex((item) => item.id === rudiment.id) <= currentIndex),
  ];
  return rotated[0]?.id ?? ranked[0]?.id ?? null;
}

export function buildPracticePlan(
  input: {
    minutes: SessionMinutes;
    skill: SkillLevel;
    band: RudimentBand;
    dayKey: string;
  },
  catalog: readonly Rudiment[],
): PracticePlan {
  const skill = skillBand(input.skill);
  const count = rudimentCountForMinutes(input.minutes);
  const chosen = pickRudiments(
    catalog,
    input.band,
    skill,
    count,
    `${input.dayKey}|${input.minutes}|${input.skill}|${input.band}`,
  );
  const warmupHigh = skill.low + Math.max(4, Math.round((skill.high - skill.low) * 0.4));
  const pushLow = Math.min(skill.high, warmupHigh + 2);
  const pushHigh = skill.high;
  const totalSeconds = input.minutes * 60;
  const warmupBudget = Math.round(totalSeconds * 0.4);
  const pushBudget = totalSeconds - warmupBudget;
  const warmupSlots = splitBudget(warmupBudget, chosen.length);
  const pushSlots = splitBudget(pushBudget, chosen.length);
  const exercises: PracticeExercise[] = [];

  chosen.forEach((rudiment, index) => {
    exercises.push(
      withStrokeTempo(
        { warmupLow: skill.low, warmupHigh, pushLow, pushHigh },
        {
          rudimentId: rudiment.id,
          phase: "warmup",
          startBpm: skill.low,
          endBpm: warmupHigh,
          durationSeconds: warmupSlots[index] ?? 0,
        },
      ),
    );
  });
  chosen.forEach((rudiment, index) => {
    exercises.push(
      withStrokeTempo(
        { warmupLow: skill.low, warmupHigh, pushLow, pushHigh },
        {
          rudimentId: rudiment.id,
          phase: "push",
          startBpm: pushLow,
          endBpm: pushHigh,
          durationSeconds: pushSlots[index] ?? 0,
        },
      ),
    );
  });

  return {
    minutes: input.minutes,
    skill: input.skill,
    band: input.band,
    rudimentIds: chosen.map((rudiment) => rudiment.id),
    exercises,
    warmupLow: skill.low,
    warmupHigh,
    pushLow,
    pushHigh,
    estimatedSeconds: totalSeconds,
  };
}

function splitBudget(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

function withStrokeTempo(
  plan: Pick<PracticePlan, "warmupLow" | "warmupHigh" | "pushLow" | "pushHigh">,
  exercise: PracticeExercise,
): PracticeExercise {
  const rudiment = getRudimentById(exercise.rudimentId);
  const subdivision = rudiment?.subdivision ?? SIXTEENTH_NOTES_PER_BEAT;
  const strokeStart = exercise.phase === "warmup" ? plan.warmupLow : plan.pushLow;
  const strokeEnd = exercise.phase === "warmup" ? plan.warmupHigh : plan.pushHigh;
  return {
    ...exercise,
    startBpm: metronomeForStrokeBpm(strokeStart, subdivision),
    endBpm: metronomeForStrokeBpm(strokeEnd, subdivision),
  };
}

function pickRudiments(
  catalog: readonly Rudiment[],
  band: RudimentBand,
  skill: SkillBand,
  count: number,
  seedKey: string,
): Rudiment[] {
  const pool = bandPool(catalog, band, skill);
  const shuffled = shuffle(pool, hashString(seedKey));
  const chosen: Rudiment[] = [];
  const usedCategories = new Set<RudimentCategory>();
  for (const rudiment of shuffled) {
    if (chosen.length >= count) break;
    if (usedCategories.has(rudiment.category)) continue;
    chosen.push(rudiment);
    usedCategories.add(rudiment.category);
  }
  for (const rudiment of shuffled) {
    if (chosen.length >= count) break;
    if (chosen.some((item) => item.id === rudiment.id)) continue;
    chosen.push(rudiment);
  }
  return chosen;
}

function shuffle(items: readonly Rudiment[], seed: number): Rudiment[] {
  const copy = [...items];
  let state = seed || 1;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(next() * (index + 1));
    const current = copy[index];
    const other = copy[swapIndex];
    if (current && other) {
      copy[index] = other;
      copy[swapIndex] = current;
    }
  }
  return copy;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
