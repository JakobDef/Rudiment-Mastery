import { localDayKey } from "@/lib/practice-plan";

export const MIN_PRACTICE_SECONDS = 1;
export const DAY_CREDIT_SECONDS = 5 * 60;
export const METRONOME_SOURCE = "metronome";

export function qualifiesForDayCredit(seconds: number): boolean {
  return Math.floor(seconds) >= DAY_CREDIT_SECONDS;
}

export type Ease = 1 | 2 | 3 | 4 | 5;

export const EASE_OPTIONS: readonly { value: Ease; label: string }[] = [
  { value: 1, label: "Very hard" },
  { value: 2, label: "Hard" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Easy" },
  { value: 5, label: "Very easy" },
];

export type CalendarCell = {
  dayKey: string;
  day: number;
  inMonth: boolean;
  today: boolean;
  future: boolean;
  practiced: boolean;
};

export function addDayKey(dayKey: string, delta: number): string {
  const parts = dayKey.split("-").map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (year === undefined || month === undefined || day === undefined) return dayKey;
  return localDayKey(new Date(year, month - 1, day + delta));
}

export function currentStreak(practicedDays: ReadonlySet<string>, todayKey: string): number {
  let cursor = practicedDays.has(todayKey) ? todayKey : addDayKey(todayKey, -1);
  if (!practicedDays.has(cursor)) return 0;
  let count = 0;
  while (practicedDays.has(cursor)) {
    count += 1;
    cursor = addDayKey(cursor, -1);
  }
  return count;
}

export function monthGrid(
  year: number,
  month: number,
  practicedDays: ReadonlySet<string>,
  todayKey: string,
): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(year, month - 1, 1 - lead);
  const cells: CalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const dayKey = localDayKey(date);
    cells.push({
      dayKey,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      today: dayKey === todayKey,
      future: dayKey > todayKey,
      practiced: practicedDays.has(dayKey),
    });
  }
  return cells;
}

export function formatLogStamp(createdAt: number): string {
  if (!createdAt) return "Just now";
  return new Date(createdAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBpmRange(startBpm: number, endBpm: number): string {
  if (startBpm === endBpm) return `${startBpm} BPM`;
  const low = Math.min(startBpm, endBpm);
  const high = Math.max(startBpm, endBpm);
  return `${low}-${high} BPM`;
}

export function formatPracticeTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${seconds}s`;
}
