import { describe, expect, it } from "vitest";
import { beatsPerNotationLine } from "@/components/gauntlet/notation-view";

describe("notation wrap", () => {
  it("keeps a short pattern on one line when there is room", () => {
    expect(
      beatsPerNotationLine({ width: 900, subdivision: 2, beats: 4, totalUnits: 8 }),
    ).toBe(4);
  });

  it("wraps a two-bar 16th pattern after one bar", () => {
    expect(
      beatsPerNotationLine({ width: 720, subdivision: 4, beats: 4, totalUnits: 32 }),
    ).toBe(4);
  });

  it("wraps sooner on a narrow screen", () => {
    expect(
      beatsPerNotationLine({ width: 360, subdivision: 4, beats: 4, totalUnits: 32 }),
    ).toBeLessThan(4);
  });

  it("uses one bar before the width is known", () => {
    expect(
      beatsPerNotationLine({ width: 0, subdivision: 4, beats: 4, totalUnits: 32 }),
    ).toBe(4);
  });
});
