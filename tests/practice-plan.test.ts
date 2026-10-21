import { describe, expect, it } from "vitest";
import {
  applyRudimentIds,
  buildPracticePlan,
  clampTempoShift,
  currentExercise,
  exerciseBpm,
  exerciseDue,
  fitsStrokeBand,
  metronomeForStrokeBpm,
  remainingExerciseSeconds,
  remainingSessionSeconds,
  replaceFromExercise,
  rudimentCountForMinutes,
  shiftExerciseTempo,
  strokeEquivalentBpm,
  suggestReplacement,
} from "@/lib/practice-plan";
import { RUDIMENTS_DB, getRudimentById } from "@/lib/rudiments";

describe("practice plan", () => {
  it("uses two rudiments for 5 minutes and three for longer sessions", () => {
    expect(rudimentCountForMinutes(5)).toBe(2);
    const shortPlan = buildPracticePlan(
      { minutes: 5, skill: 2, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const longPlan = buildPracticePlan(
      { minutes: 15, skill: 2, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    expect(shortPlan.rudimentIds).toHaveLength(2);
    expect(shortPlan.exercises).toHaveLength(4);
    expect(longPlan.rudimentIds).toHaveLength(3);
    expect(longPlan.exercises).toHaveLength(6);
  });

  it("warms up every chosen rudiment before playing them faster", () => {
    const plan = buildPracticePlan(
      { minutes: 15, skill: 2, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const warmupIds = plan.exercises
      .filter((exercise) => exercise.phase === "warmup")
      .map((exercise) => exercise.rudimentId);
    const pushIds = plan.exercises
      .filter((exercise) => exercise.phase === "push")
      .map((exercise) => exercise.rudimentId);
    expect(new Set(warmupIds)).toEqual(new Set(plan.rudimentIds));
    expect(new Set(pushIds)).toEqual(new Set(plan.rudimentIds));
    const firstPush = plan.exercises.findIndex((exercise) => exercise.phase === "push");
    expect(plan.exercises.slice(0, firstPush).every((exercise) => exercise.phase === "warmup")).toBe(
      true,
    );
    expect(plan.warmupHigh).toBeLessThanOrEqual(plan.pushLow);
  });

  it("keeps medium rudiments inside the medium band", () => {
    const plan = buildPracticePlan(
      { minutes: 10, skill: 1, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    for (const id of plan.rudimentIds) {
      const rudiment = getRudimentById(id);
      expect(rudiment).toBeDefined();
      expect(rudiment?.difficulty).toBeGreaterThanOrEqual(2);
      expect(rudiment?.difficulty).toBeLessThanOrEqual(3);
    }
  });

  it("fills the requested length and holds the last tempo after time is up", () => {
    const plan = buildPracticePlan(
      { minutes: 15, skill: 2, band: "easy", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    expect(plan.estimatedSeconds).toBe(15 * 60);
    expect(plan.exercises.reduce((sum, exercise) => sum + exercise.durationSeconds, 0)).toBe(
      15 * 60,
    );
    const first = currentExercise(plan, 0);
    expect(first).toBeDefined();
    if (!first) return;
    expect(exerciseBpm(first, 0)).toBe(first.startBpm);
    expect(exerciseBpm(first, first.durationSeconds / 2)).toBeGreaterThan(first.startBpm);
    expect(exerciseBpm(first, first.durationSeconds + 30)).toBe(first.endBpm);
    expect(exerciseDue(first, first.durationSeconds - 1)).toBe(false);
    expect(exerciseDue(first, first.durationSeconds)).toBe(true);
  });

  it("counts leftover time on this exercise and on the whole session", () => {
    const plan = buildPracticePlan(
      { minutes: 5, skill: 2, band: "hard", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const first = currentExercise(plan, 0);
    expect(first).toBeDefined();
    if (!first) return;
    expect(remainingExerciseSeconds(first, 10)).toBe(first.durationSeconds - 10);
    expect(remainingSessionSeconds(plan, 0, 10)).toBe(plan.estimatedSeconds - 10);
    expect(remainingExerciseSeconds(first, first.durationSeconds + 20)).toBe(0);
    expect(remainingSessionSeconds(plan, 0, first.durationSeconds + 20)).toBe(
      plan.estimatedSeconds - first.durationSeconds,
    );
  });

  it("can swap one slot and keep the rest of the plan", () => {
    const plan = buildPracticePlan(
      { minutes: 15, skill: 2, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const replacement = RUDIMENTS_DB.find(
      (rudiment) => rudiment.difficulty >= 2 && rudiment.difficulty <= 3 && !plan.rudimentIds.includes(rudiment.id),
    );
    expect(replacement).toBeDefined();
    if (!replacement) return;
    const swapped = applyRudimentIds(plan, [replacement.id, plan.rudimentIds[1] ?? "", plan.rudimentIds[2] ?? ""]);
    expect(swapped.exercises[0]?.rudimentId).toBe(replacement.id);
    expect(swapped.exercises[3]?.rudimentId).toBe(replacement.id);
    expect(swapped.exercises[1]?.rudimentId).toBe(plan.rudimentIds[1]);
    expect(swapped.estimatedSeconds).toBe(plan.estimatedSeconds);

    const later = replaceFromExercise(plan, 3, replacement.id);
    expect(later.exercises[0]?.rudimentId).toBe(plan.rudimentIds[0]);
    expect(later.exercises[3]?.rudimentId).toBe(replacement.id);
  });

  it("picks another matching rudiment and a different one on the next change", () => {
    const plan = buildPracticePlan(
      { minutes: 15, skill: 2, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const first = suggestReplacement(plan, 0, RUDIMENTS_DB);
    expect(first).toBeTruthy();
    expect(first).not.toBe(plan.rudimentIds[0]);
    expect(plan.rudimentIds.slice(1)).not.toContain(first);
    const firstRudiment = first ? getRudimentById(first) : undefined;
    expect(firstRudiment?.difficulty).toBeGreaterThanOrEqual(2);
    expect(firstRudiment?.difficulty).toBeLessThanOrEqual(3);

    const swapped = applyRudimentIds(plan, [
      first ?? "",
      plan.rudimentIds[1] ?? "",
      plan.rudimentIds[2] ?? "",
    ]);
    const second = suggestReplacement(swapped, 0, RUDIMENTS_DB);
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(second).not.toBe(swapped.rudimentIds[1]);
    expect(second).not.toBe(swapped.rudimentIds[2]);
  });

  it("treats sextuplet 100 BPM like 16th notes at 150 BPM", () => {
    expect(strokeEquivalentBpm(100, 6)).toBe(150);
    expect(metronomeForStrokeBpm(150, 6)).toBe(100);
    expect(metronomeForStrokeBpm(100, 6)).toBe(67);
  });

  it("lets a 75 BPM sextuplet sit in a 100-120 16th-note band", () => {
    const sextuplet = RUDIMENTS_DB.find((rudiment) => rudiment.subdivision === 6);
    expect(sextuplet).toBeDefined();
    if (!sextuplet) return;
    const atSeventyFive = { ...sextuplet, defaultBpm: 75, targetBpm: 90 };
    expect(fitsStrokeBand(atSeventyFive, 100, 120)).toBe(true);
    expect(strokeEquivalentBpm(75, 6)).toBe(112.5);
  });

  it("scales practice tempos so sextuplet strokes match the chosen 16th-note speed", () => {
    const plan = buildPracticePlan(
      { minutes: 15, skill: 3, band: "medium", dayKey: "2026-10-18" },
      RUDIMENTS_DB,
    );
    const sextuplet = RUDIMENTS_DB.find((rudiment) => rudiment.subdivision === 6);
    expect(sextuplet).toBeDefined();
    if (!sextuplet) return;
    const swapped = applyRudimentIds(plan, [
      sextuplet.id,
      plan.rudimentIds[1] ?? sextuplet.id,
      plan.rudimentIds[2] ?? sextuplet.id,
    ]);
    const warmup = swapped.exercises[0];
    expect(warmup?.rudimentId).toBe(sextuplet.id);
    expect(warmup?.startBpm).toBe(metronomeForStrokeBpm(plan.warmupLow, 6));
    expect(warmup?.startBpm).toBeLessThan(plan.warmupLow);
  });

  it("shifts the whole climb when tempo is nudged", () => {
    const exercise = {
      rudimentId: "single-stroke-roll",
      phase: "warmup" as const,
      startBpm: 70,
      endBpm: 78,
      durationSeconds: 120,
    };
    const slower = shiftExerciseTempo(exercise, -5);
    expect(slower.startBpm).toBe(65);
    expect(slower.endBpm).toBe(73);
    expect(exerciseBpm(slower, 0)).toBe(65);
    expect(exerciseBpm(slower, 120)).toBe(73);
    expect(exerciseBpm(slower, 60)).toBeGreaterThan(65);
    expect(exerciseBpm(slower, 60)).toBeLessThan(73);
    expect(clampTempoShift(exercise, -100)).toBe(-30);
    expect(shiftExerciseTempo(exercise, -100).startBpm).toBe(40);
    expect(shiftExerciseTempo(exercise, 200).endBpm).toBe(240);
  });
});
