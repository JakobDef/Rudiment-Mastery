import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotationView, beamLevels } from "@/components/gauntlet/notation-view";
import { n, RUDIMENTS_DB, type Rudiment } from "@/lib/rudiments";
import { noteOnsetSeconds, patternSeconds } from "@/lib/audio-scheduler";
import { metronomeForStrokeBpm, strokeEquivalentBpm } from "@/lib/practice-plan";

const quintuplet: Rudiment = {
  ...RUDIMENTS_DB[0]!, subdivision: 5,
  notes: [n("R"), n("l"), n("r"), n("l"), n("r")],
};
it("plays five evenly spaced strokes per quarter note", () => {
  expect(noteOnsetSeconds(quintuplet, 120)).toEqual([0, 0.1, 0.2, 0.30000000000000004, 0.4]);
  expect(patternSeconds(quintuplet, 120)).toBeCloseTo(0.5);
  expect(metronomeForStrokeBpm(100, 5)).toBe(80);
  expect(strokeEquivalentBpm(80, 5)).toBe(100);
});
it("renders a five-tuplet bracket with two beams", () => {
  expect(beamLevels(1, 5)).toBe(2);
  expect(beamLevels(0.5, 5)).toBe(3);
  const html = renderToStaticMarkup(createElement(NotationView, { rudiment: quintuplet, activeIndex: null }));
  expect(html).toMatch(/>5<\/text>/);
});
