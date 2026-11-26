import { expect, it } from "vitest";
import { oneOffStreak } from "@/lib/progress";

it("counts practice days across repeated isolated gaps", () => {
  expect(oneOffStreak(new Set(["2026-11-20", "2026-11-22", "2026-11-24"]), "2026-11-25")).toBe(3);
});
it("allows yesterday to be missed without counting it or unfinished today", () => {
  expect(oneOffStreak(new Set(["2026-11-22", "2026-11-23"]), "2026-11-25")).toBe(2);
});
it("resets after two completed missed days and starts anew today", () => {
  const days = new Set(["2026-11-21", "2026-11-22"]);
  expect(oneOffStreak(days, "2026-11-25")).toBe(0);
  days.add("2026-11-25");
  expect(oneOffStreak(days, "2026-11-25")).toBe(1);
});
it("handles month boundaries, empty history, and ignores future days", () => {
  expect(oneOffStreak(new Set(["2026-10-30", "2026-11-01"]), "2026-11-02")).toBe(2);
  expect(oneOffStreak(new Set(), "2026-11-25")).toBe(0);
  expect(oneOffStreak(new Set(["2026-11-26"]), "2026-11-25")).toBe(0);
});
