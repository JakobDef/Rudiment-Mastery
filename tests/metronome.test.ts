import { describe, expect, it } from "vitest";
import {
  clickPattern,
  defaultAccents,
  isSilentBar,
  planClick,
  pushTap,
  timeSignatureById,
  toggleAccentAt,
  type ClickCursor,
  type MetronomeSettings,
} from "@/lib/metronome";

function settings(overrides: Partial<MetronomeSettings> = {}): MetronomeSettings {
  return {
    startBpm: 80,
    targetBpm: 120,
    rampEnabled: false,
    rampSeconds: 60,
    accents: ["high", "low", "mid", "low"],
    division: 1,
    heardBars: 1,
    silentBars: 0,
    volume: 1,
    ...overrides,
  };
}

function runClicks(count: number, raw: MetronomeSettings, elapsedAt = 0) {
  let cursor: ClickCursor = { beatIndex: 0, barIndex: 0 };
  const plans = [];
  for (let index = 0; index < count; index += 1) {
    const plan = planClick(cursor, elapsedAt, raw);
    plans.push(plan);
    cursor = plan.next;
  }
  return plans;
}

describe("practice metronome", () => {
  it("moves the tempo in a straight line and then holds the target", () => {
    const climbing = settings({ rampEnabled: true, rampSeconds: 60, startBpm: 60, targetBpm: 120 });
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 0, climbing).bpm).toBe(60);
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 30, climbing).bpm).toBe(90);
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 60, climbing).bpm).toBe(120);
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 90, climbing).bpm).toBe(120);
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 30, climbing).rampProgress).toBeCloseTo(0.5);
  });

  it("can also slow down in a straight line", () => {
    const slowing = settings({ rampEnabled: true, rampSeconds: 40, startBpm: 140, targetBpm: 80 });
    expect(planClick({ beatIndex: 0, barIndex: 0 }, 20, slowing).bpm).toBe(110);
  });

  it("keeps a steady tempo until speed up is turned on", () => {
    const steady = planClick({ beatIndex: 0, barIndex: 0 }, 30, settings());
    expect(steady.bpm).toBe(80);
    expect(steady.rampProgress).toBe(0);
  });

  it("plays some bars and leaves the following bars quiet", () => {
    expect(isSilentBar(0, 1, 1)).toBe(false);
    expect(isSilentBar(1, 1, 1)).toBe(true);
    expect(isSilentBar(2, 1, 1)).toBe(false);
    expect(isSilentBar(0, 2, 1)).toBe(false);
    expect(isSilentBar(1, 2, 1)).toBe(false);
    expect(isSilentBar(2, 2, 1)).toBe(true);
    expect(isSilentBar(5, 4, 0)).toBe(false);

    const plans = runClicks(8, settings({ heardBars: 1, silentBars: 1 }));
    expect(plans.slice(0, 4).every((plan) => !plan.silent)).toBe(true);
    expect(plans.slice(4, 8).every((plan) => plan.silent)).toBe(true);
    expect(plans[4]?.barIndex).toBe(1);
    expect(plans[4]?.beatIndex).toBe(0);
  });

  it("accents the bar and steps to the next beat", () => {
    const first = planClick({ beatIndex: 0, barIndex: 0 }, 0, settings({ startBpm: 120 }));
    const second = planClick(first.next, 0, settings({ startBpm: 120 }));
    expect(first.accent).toBe("high");
    expect(first.secondsUntilNext).toBeCloseTo(0.5);
    expect(second.beatIndex).toBe(1);
    expect(second.accent).toBe("low");
    expect(second.barIndex).toBe(0);
  });

  it("treats 6/8 as two big beats, or six clicks when the small beats are on", () => {
    const signature = timeSignatureById("6/8");
    const pulse = clickPattern(signature, false);
    const small = clickPattern(signature, true);
    expect(pulse.accents).toEqual(["high", "low"]);
    expect(pulse.division).toBe(1);
    expect(small.accents).toEqual(["high", "low", "low", "low", "low", "low"]);
    expect(small.division).toBe(3);
    const click = planClick(
      { beatIndex: 0, barIndex: 0 },
      0,
      settings({ startBpm: 120, accents: small.accents, division: small.division }),
    );
    expect(click.secondsUntilNext).toBeCloseTo(60 / 360);
  });

  it("starts with only the first beat accented, and a click flips that beat", () => {
    expect(defaultAccents(timeSignatureById("4/4"), false)).toEqual(["high", "low", "low", "low"]);
    expect(toggleAccentAt(["high", "low", "low", "low"], 2)).toEqual(["high", "low", "high", "low"]);
    expect(toggleAccentAt(["high", "low", "high", "low"], 2)).toEqual(["high", "low", "low", "low"]);
    expect(toggleAccentAt(["high", "low"], 9)).toEqual(["high", "low"]);
  });

  it("reads a steady tap as the tempo", () => {
    const first = pushTap([], 0);
    const second = pushTap(first.taps, 0.5);
    const third = pushTap(second.taps, 1);
    expect(first.bpm).toBeNull();
    expect(second.bpm).toBe(120);
    expect(third.bpm).toBe(120);
    expect(pushTap(third.taps, 4).bpm).toBeNull();
  });
});
