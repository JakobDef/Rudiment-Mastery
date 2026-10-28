import { describe, expect, it } from "vitest";
import {
  addDayKey,
  currentStreak,
  formatBpmRange,
  formatLogStamp,
  formatPracticeTime,
  monthGrid,
  qualifiesForDayCredit,
} from "@/lib/progress";

describe("progress", () => {
  it("counts a streak through today", () => {
    const days = new Set(["2026-10-19", "2026-10-20", "2026-10-21"]);
    expect(currentStreak(days, "2026-10-21")).toBe(3);
  });

  it("keeps yesterday's streak if today is still empty", () => {
    const days = new Set(["2026-10-19", "2026-10-20"]);
    expect(currentStreak(days, "2026-10-21")).toBe(2);
  });

  it("breaks after a missed day", () => {
    const days = new Set(["2026-10-18", "2026-10-20"]);
    expect(currentStreak(days, "2026-10-21")).toBe(1);
    expect(currentStreak(new Set(), "2026-10-21")).toBe(0);
  });

  it("builds a Monday-first month grid", () => {
    const cells = monthGrid(2026, 10, new Set(["2026-10-20"]), "2026-10-21");
    expect(cells).toHaveLength(42);
    expect(cells[0]?.dayKey).toBe("2026-09-28");
    const today = cells.find((cell) => cell.dayKey === "2026-10-21");
    expect(today?.today).toBe(true);
    expect(today?.practiced).toBe(false);
    expect(cells.find((cell) => cell.dayKey === "2026-10-20")?.practiced).toBe(true);
    expect(addDayKey("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("formats practice time", () => {
    expect(formatPracticeTime(40)).toBe("40s");
    expect(formatPracticeTime(90)).toBe("1 min");
    expect(formatPracticeTime(3720)).toBe("1h 2m");
  });

  it("formats tempo ranges and log dates", () => {
    expect(formatBpmRange(80, 80)).toBe("80 BPM");
    expect(formatBpmRange(70, 78)).toBe("70-78 BPM");
    expect(formatLogStamp(0)).toBe("Just now");
    expect(formatLogStamp(new Date(2026, 9, 21, 12, 0).getTime())).toContain("2026");
  });

  it("credits a day only after five minutes", () => {
    expect(qualifiesForDayCredit(299)).toBe(false);
    expect(qualifiesForDayCredit(300)).toBe(true);
    expect(qualifiesForDayCredit(301)).toBe(true);
  });
});
