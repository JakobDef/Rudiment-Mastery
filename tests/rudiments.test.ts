import { describe, expect, it } from "vitest";
import {
  graceLeadSeconds,
  noteOnsetSeconds,
  patternSeconds,
  quarterNoteSeconds,
  stepSeconds,
  tempoScale,
} from "@/lib/audio-scheduler";
import { createWorkout, reduceCompletedBar, currentRudimentId } from "@/lib/gauntlet-engine";
import {
  RUDIMENTS_DB,
  hasCompleteBeats,
  hasPositiveDurations,
  hasValidSticking,
  noteDuration,
  patternQuarterBeats,
} from "@/lib/rudiments";

describe("rudiment database", () => {
  it("keeps a unique id on every rudiment", () => {
    const ids = RUDIMENTS_DB.map((rudiment) => rudiment.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(30);
  });

  it("sums each pattern to complete beats with valid sticking", () => {
    for (const rudiment of RUDIMENTS_DB) {
      expect(hasPositiveDurations(rudiment), rudiment.id).toBe(true);
      expect(hasValidSticking(rudiment), rudiment.id).toBe(true);
      expect(hasCompleteBeats(rudiment), rudiment.id).toBe(true);
      expect(patternQuarterBeats(rudiment)).toBeGreaterThan(0);
    }
  });
});

describe("scheduler timing", () => {
  it("spaces 16th notes at 120 bpm by an eighth of a second", () => {
    expect(quarterNoteSeconds(120)).toBeCloseTo(0.5);
    expect(stepSeconds(120, 4)).toBeCloseTo(0.125);
  });

  it("keeps onsets increasing and the release aligned with the pattern length", () => {
    for (const rudiment of RUDIMENTS_DB) {
      const onsets = noteOnsetSeconds(rudiment, rudiment.defaultBpm);
      expect(onsets).toHaveLength(rudiment.notes.length);
      for (let index = 1; index < onsets.length; index += 1) {
        const previous = onsets[index - 1];
        const current = onsets[index];
        expect(current).toBeGreaterThan(previous ?? 0);
      }
      const lastNote = rudiment.notes[rudiment.notes.length - 1];
      const lastOnset = onsets[onsets.length - 1];
      expect(lastNote).toBeDefined();
      expect(lastOnset).toBeDefined();
      const release =
        (lastOnset ?? 0) +
        noteDuration(lastNote ?? { hand: "R" }) * stepSeconds(rudiment.defaultBpm, rudiment.subdivision);
      expect(release).toBeCloseTo(patternSeconds(rudiment, rudiment.defaultBpm));
    }
  });

  it("places flam and drag grace notes at 25ms, 45ms, and 22ms when the tempo is 100", () => {
    expect(tempoScale(100)).toBeCloseTo(1);
    expect(graceLeadSeconds("flam", 100)[0]).toBeCloseTo(0.025);
    const drag = graceLeadSeconds("drag", 100);
    expect(drag[0]).toBeCloseTo(0.045);
    expect(drag[1]).toBeCloseTo(0.022);
    expect(drag[0]).toBeGreaterThan(drag[1] ?? 0);
    const fastFlam = graceLeadSeconds("flam", 200)[0];
    expect(fastFlam).toBeLessThan(0.025);
    expect(fastFlam).toBeGreaterThan(0);
    const ruff = graceLeadSeconds("ruff", 100);
    expect(ruff).toHaveLength(3);
    expect(ruff[0]).toBeGreaterThan(ruff[1] ?? 0);
    expect(ruff[1]).toBeGreaterThan(ruff[2] ?? 0);
  });
});

describe("workout steps", () => {
  it("raises the tempo after the chosen number of bars", () => {
    let state = createWorkout({
      mode: "speed",
      startBpm: 80,
      targetBpm: 100,
      bpmStep: 5,
      barsPerStep: 2,
      rudimentIds: ["single-stroke-roll"],
    });
    state = reduceCompletedBar(state);
    expect(state.bpm).toBe(80);
    expect(state.barsIntoStep).toBe(1);
    state = reduceCompletedBar(state);
    expect(state.bpm).toBe(85);
    expect(state.barsIntoStep).toBe(0);
  });

  it("cycles a queue without changing tempo", () => {
    let state = createWorkout({
      mode: "queue",
      startBpm: 90,
      targetBpm: 140,
      bpmStep: 5,
      barsPerStep: 2,
      rudimentIds: ["herta", "cheese"],
    });
    state = reduceCompletedBar(state);
    expect(currentRudimentId(state)).toBe("herta");
    state = reduceCompletedBar(state);
    expect(currentRudimentId(state)).toBe("cheese");
    expect(state.bpm).toBe(90);
    state = reduceCompletedBar(state);
    expect(currentRudimentId(state)).toBe("cheese");
    state = reduceCompletedBar(state);
    expect(currentRudimentId(state)).toBe("herta");
    expect(state.bpm).toBe(90);
  });
});
