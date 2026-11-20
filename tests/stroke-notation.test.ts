import { describe, expect, it } from "vitest";
import { n, noteDuration } from "@/lib/rudiments";

describe("stroke shorthand", () => {
  it.each([
    ["R", "R", true], ["r", "R", false],
    ["L", "L", true], ["l", "L", false],
  ] as const)("decodes %s", (stroke, hand, accent) => {
    expect(n(stroke)).toEqual({ hand, accent });
    expect(noteDuration(n(stroke))).toBe(1);
  });
  it("preserves explicit ornaments, dynamics and durations", () => {
    expect(n("l", { ghost: true, ornament: "drag", duration: 0.5 })).toEqual({
      hand: "L", accent: false, ghost: true, ornament: "drag", duration: 0.5,
    });
  });
});
