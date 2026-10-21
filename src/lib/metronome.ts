import { clampBpm } from "@/lib/audio-scheduler";

export type Accent = "high" | "mid" | "low";

export interface TimeSignature {
  id: string;
  label: string;
  hint: string;
  tempoLabel: string;
  innerClicks: number;
  accents: readonly Accent[];
}

const FOUR_FOUR: TimeSignature = {
  id: "4/4",
  label: "4/4",
  hint: "Four beats",
  tempoLabel: "Clicks per minute",
  innerClicks: 1,
  accents: ["high", "low", "low", "low"],
};

export const TIME_SIGNATURES: readonly TimeSignature[] = [
  {
    id: "2/4",
    label: "2/4",
    hint: "Two beats",
    tempoLabel: "Clicks per minute",
    innerClicks: 1,
    accents: ["high", "low"],
  },
  {
    id: "3/4",
    label: "3/4",
    hint: "Three beats",
    tempoLabel: "Clicks per minute",
    innerClicks: 1,
    accents: ["high", "low", "low"],
  },
  FOUR_FOUR,
  {
    id: "5/4",
    label: "5/4",
    hint: "Five beats",
    tempoLabel: "Clicks per minute",
    innerClicks: 1,
    accents: ["high", "low", "low", "low", "low"],
  },
  {
    id: "6/8",
    label: "6/8",
    hint: "Two big beats",
    tempoLabel: "Big beats per minute",
    innerClicks: 3,
    accents: ["high", "low"],
  },
  {
    id: "7/8",
    label: "7/8",
    hint: "Seven beats",
    tempoLabel: "Clicks per minute",
    innerClicks: 1,
    accents: ["high", "low", "low", "low", "low", "low", "low"],
  },
  {
    id: "9/8",
    label: "9/8",
    hint: "Three big beats",
    tempoLabel: "Big beats per minute",
    innerClicks: 3,
    accents: ["high", "low", "low"],
  },
  {
    id: "12/8",
    label: "12/8",
    hint: "Four big beats",
    tempoLabel: "Big beats per minute",
    innerClicks: 3,
    accents: ["high", "low", "low", "low"],
  },
];

export const HEARD_BAR_CHOICES = [1, 2, 4] as const;
export const SILENT_BAR_CHOICES = [0, 1, 2, 4] as const;
export const RAMP_CHOICES = [
  { seconds: 30, label: "30 sec" },
  { seconds: 60, label: "1 min" },
  { seconds: 120, label: "2 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
] as const;

export interface ClickCursor {
  beatIndex: number;
  barIndex: number;
}

export interface MetronomeSettings {
  startBpm: number;
  targetBpm: number;
  rampEnabled: boolean;
  rampSeconds: number;
  accents: readonly Accent[];
  division: number;
  heardBars: number;
  silentBars: number;
  volume: number;
}

export interface ClickPlan {
  bpm: number;
  beatIndex: number;
  barIndex: number;
  silent: boolean;
  accent: Accent;
  rampProgress: number;
  rampDone: boolean;
  secondsUntilNext: number;
  next: ClickCursor;
}

export function timeSignatureById(id: string): TimeSignature {
  return TIME_SIGNATURES.find((signature) => signature.id === id) ?? FOUR_FOUR;
}

export function clickCount(signature: TimeSignature, subdivide: boolean): number {
  const pulses = Math.max(1, signature.accents.length);
  if (!subdivide || signature.innerClicks <= 1) return pulses;
  return pulses * signature.innerClicks;
}

export function clickDivision(signature: TimeSignature, subdivide: boolean): number {
  if (!subdivide || signature.innerClicks <= 1) return 1;
  return signature.innerClicks;
}

export function defaultAccents(signature: TimeSignature, subdivide: boolean): Accent[] {
  const count = clickCount(signature, subdivide);
  return Array.from({ length: count }, (_, index) => (index === 0 ? "high" : "low"));
}

export function clickPattern(
  signature: TimeSignature,
  subdivide: boolean,
): { accents: readonly Accent[]; division: number } {
  return { accents: defaultAccents(signature, subdivide), division: clickDivision(signature, subdivide) };
}

export function toggleAccentAt(accents: readonly Accent[], index: number): Accent[] {
  if (index < 0 || index >= accents.length) return [...accents];
  return accents.map((accent, current) => {
    if (current !== index) return accent;
    return accent === "high" ? "low" : "high";
  });
}

export function isSilentBar(barIndex: number, heardBars: number, silentBars: number): boolean {
  const heard = Math.max(1, Math.round(heardBars));
  const silent = Math.max(0, Math.round(silentBars));
  if (silent === 0) return false;
  const cycle = heard + silent;
  const place = ((barIndex % cycle) + cycle) % cycle;
  return place >= heard;
}

export function sanitizeSettings(settings: MetronomeSettings): MetronomeSettings {
  const accents = settings.accents.length > 0 ? settings.accents : (["high"] as const);
  const division = Math.min(6, Math.max(1, Math.round(settings.division) || 1));
  return {
    startBpm: clampBpm(settings.startBpm),
    targetBpm: clampBpm(settings.targetBpm),
    rampEnabled: settings.rampEnabled,
    rampSeconds: Math.max(1, settings.rampSeconds),
    accents,
    division,
    heardBars: Math.max(1, Math.round(settings.heardBars) || 1),
    silentBars: Math.max(0, Math.round(settings.silentBars) || 0),
    volume: Math.min(1, Math.max(0, settings.volume)),
  };
}

export function planClick(cursor: ClickCursor, elapsedSeconds: number, raw: MetronomeSettings): ClickPlan {
  const settings = sanitizeSettings(raw);
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const rampProgress = settings.rampEnabled ? Math.min(1, elapsed / settings.rampSeconds) : 0;
  const bpm = settings.rampEnabled
    ? clampBpm(settings.startBpm + (settings.targetBpm - settings.startBpm) * rampProgress)
    : settings.startBpm;
  const beatCount = settings.accents.length;
  const beatIndex = ((cursor.beatIndex % beatCount) + beatCount) % beatCount;
  const barIndex = cursor.barIndex;
  const nextBeat = beatIndex + 1;
  const next =
    nextBeat >= beatCount ? { beatIndex: 0, barIndex: barIndex + 1 } : { beatIndex: nextBeat, barIndex };

  return {
    bpm,
    beatIndex,
    barIndex,
    silent: isSilentBar(barIndex, settings.heardBars, settings.silentBars),
    accent: settings.accents[beatIndex] ?? "low",
    rampProgress,
    rampDone: settings.rampEnabled && rampProgress >= 1,
    secondsUntilNext: 60 / (bpm * settings.division),
    next,
  };
}

export function pushTap(
  previous: readonly number[],
  now: number,
): { taps: number[]; bpm: number | null } {
  const last = previous[previous.length - 1];
  if (last === undefined || now - last > 2 || now <= last) {
    return { taps: [now], bpm: null };
  }
  const taps = [...previous, now].slice(-5);
  let total = 0;
  for (let index = 1; index < taps.length; index += 1) {
    const current = taps[index];
    const earlier = taps[index - 1];
    if (current === undefined || earlier === undefined) continue;
    total += current - earlier;
  }
  const gaps = taps.length - 1;
  if (gaps <= 0 || total <= 0) return { taps, bpm: null };
  return { taps, bpm: clampBpm(60 / (total / gaps)) };
}
