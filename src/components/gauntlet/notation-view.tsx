"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  noteDuration,
  type NoteOrnament,
  type Rudiment,
  type RudimentNote,
} from "@/lib/rudiments";

const STAFF_Y = 78;
const UNIT = 36;
const LEFT = 58;
const ROW_HEIGHT = 120;

interface LaidOutNote {
  index: number;
  x: number;
  y: number;
  row: number;
  duration: number;
  beamCount: number;
  note: RudimentNote;
}

export function beatsPerNotationLine({
  width,
  subdivision,
  beats,
  totalUnits,
}: {
  width: number;
  subdivision: number;
  beats: number;
  totalUnits: number;
}): number {
  const unitsPerBeat = subdivision > 0 ? subdivision : 4;
  const totalBeats = Math.max(1, Math.ceil(totalUnits / unitsPerBeat));
  const needed = LEFT + totalUnits * UNIT + 40;
  if (width <= 0) return Math.max(1, beats);
  if (needed <= width) return totalBeats;
  const usable = Math.max(UNIT, width - LEFT - 40);
  const fitBeats = Math.max(1, Math.floor(usable / (unitsPerBeat * UNIT)));
  if (fitBeats >= beats) return Math.max(beats, Math.floor(fitBeats / beats) * beats);
  return fitBeats;
}

function beamLevels(duration: number, subdivision: number): number {
  const fraction = duration / subdivision;
  if (fraction >= 0.999) return 0;
  if (fraction >= 0.49) return 1;
  if (fraction >= 0.24) return 2;
  return 3;
}

function gracePositions(ornament: NoteOrnament, x: number): number[] {
  if (ornament === "flam") return [x - 16];
  if (ornament === "drag") return [x - 28, x - 16];
  if (ornament === "ruff") return [x - 40, x - 28, x - 16];
  return [];
}

function layoutRudiment(rudiment: Rudiment, lineBeats: number): {
  notes: LaidOutNote[];
  groups: LaidOutNote[][];
  width: number;
  height: number;
  rows: number;
} {
  const raw: Omit<LaidOutNote, "x" | "y" | "row">[] = [];
  rudiment.notes.forEach((note, index) => {
    const duration = noteDuration(note);
    raw.push({
      index,
      duration,
      beamCount: beamLevels(duration, rudiment.subdivision),
      note,
    });
  });

  const beatGroups: (typeof raw)[] = [];
  let group: typeof raw = [];
  let filled = 0;
  for (const item of raw) {
    group.push(item);
    filled += item.duration;
    if (filled >= rudiment.subdivision - 1e-6) {
      beatGroups.push(group);
      group = [];
      filled = 0;
    }
  }
  if (group.length > 0) beatGroups.push(group);

  const placed: LaidOutNote[][] = [];
  let row = 0;
  let rowCursor = 0;
  let beatsOnRow = 0;
  let maxRowUnits = 0;
  const safeLineBeats = Math.max(1, lineBeats);

  const laid: LaidOutNote[] = [];
  beatGroups.forEach((items) => {
    if (beatsOnRow >= safeLineBeats && rowCursor > 0) {
      maxRowUnits = Math.max(maxRowUnits, rowCursor);
      row += 1;
      rowCursor = 0;
      beatsOnRow = 0;
    }
    const y = STAFF_Y + row * ROW_HEIGHT;
    const nextGroup: LaidOutNote[] = [];
    items.forEach((item) => {
      const next: LaidOutNote = {
        ...item,
        x: LEFT + rowCursor * UNIT,
        y,
        row,
      };
      rowCursor += item.duration;
      nextGroup.push(next);
      laid.push(next);
    });
    placed.push(nextGroup);
    beatsOnRow += 1;
  });
  maxRowUnits = Math.max(maxRowUnits, rowCursor);

  const rows = row + 1;
  return {
    notes: laid,
    groups: placed,
    width: Math.max(320, LEFT + maxRowUnits * UNIT + 40),
    height: STAFF_Y + (rows - 1) * ROW_HEIGHT + 72,
    rows,
  };
}

function noteFill(note: RudimentNote, active: boolean): string {
  if (active) return "fill-active stroke-active";
  if (note.ghost) return "fill-canvas stroke-ghost";
  if (note.accent) return "fill-accent stroke-accent";
  return "fill-tap stroke-ink";
}

function BeamGroups({ groups }: { groups: LaidOutNote[][] }) {
  const marks: ReactNode[] = [];

  groups.forEach((group, groupIndex) => {
    const staffY = group[0]?.y ?? STAFF_Y;
    const stemTop = staffY - 36;
    const peak = group.reduce((highest, item) => Math.max(highest, item.beamCount), 0);
    for (let level = 1; level <= peak; level += 1) {
      let run: LaidOutNote[] = [];
      const flush = (key: string) => {
        const first = run[0];
        const last = run[run.length - 1];
        if (!first || !last) {
          run = [];
          return;
        }
        const y = stemTop + (level - 1) * 6;
        if (first.index === last.index) {
          marks.push(
            <path
              key={key}
              d={`M ${first.x + 7} ${y} C ${first.x + 18} ${y + 2}, ${first.x + 16} ${y + 10}, ${first.x + 8} ${y + 14}`}
              className="fill-none stroke-ink"
              strokeWidth={2}
            />,
          );
        } else {
          marks.push(
            <line
              key={key}
              x1={first.x + 7}
              y1={y}
              x2={last.x + 7}
              y2={y}
              className="stroke-ink"
              strokeWidth={3}
            />,
          );
        }
        run = [];
      };

      group.forEach((item, noteIndex) => {
        if (item.beamCount >= level) {
          run.push(item);
          return;
        }
        if (run.length > 0) flush(`g${groupIndex}-l${level}-n${noteIndex}`);
      });
      if (run.length > 0) flush(`g${groupIndex}-l${level}-end`);
    }
  });

  return marks;
}

function TupletMarks({
  groups,
  subdivision,
}: {
  groups: LaidOutNote[][];
  subdivision: number;
}) {
  if (subdivision !== 3 && subdivision !== 6) return null;
  return (
    <g>
      {groups.map((group, groupIndex) => {
        const first = group[0];
        const last = group[group.length - 1];
        if (!first || !last) return null;
        const stemTop = first.y - 36;
        const bracketY = stemTop - 22;
        const left = first.x + 7;
        const right = last.x + 7;
        const mid = (left + right) / 2;
        const gap = 16;
        return (
          <g key={`tuplet-${groupIndex}`}>
            <path
              d={`M ${left} ${bracketY + 8} V ${bracketY} H ${mid - gap}`}
              className="fill-none stroke-ink"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={`M ${mid + gap} ${bracketY} H ${right} V ${bracketY + 8}`}
              className="fill-none stroke-ink"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text
              x={mid}
              y={bracketY + 6}
              textAnchor="middle"
              fill="currentColor"
              fontSize={18}
              fontWeight={700}
              className="fill-ink"
            >
              {subdivision}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function NotationView({
  rudiment,
  activeIndex,
}: {
  rudiment: Rudiment;
  activeIndex: number | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const totalUnits = rudiment.notes.reduce((sum, note) => sum + noteDuration(note), 0);
  const lineBeats = beatsPerNotationLine({
    width,
    subdivision: rudiment.subdivision,
    beats: rudiment.timeSignature[0],
    totalUnits,
  });
  const layout = layoutRudiment(rudiment, lineBeats);
  const [beats, division] = rudiment.timeSignature;

  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const staffRows = Array.from({ length: layout.rows }, (_, row) => STAFF_Y + row * ROW_HEIGHT);

  return (
    <div ref={boxRef} className="overflow-x-auto rounded-2xl border border-line bg-panel p-3">
      <svg
        width="100%"
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label={`${rudiment.name} on a single snare line`}
        className="mx-auto block"
      >
        <text x={14} y={STAFF_Y - 8} className="fill-ink text-lg font-semibold">
          {beats}
        </text>
        <text x={14} y={STAFF_Y + 16} className="fill-ink text-lg font-semibold">
          {division}
        </text>
        {staffRows.map((y) => (
          <line
            key={`staff-${y}`}
            x1={48}
            y1={y}
            x2={layout.width - 16}
            y2={y}
            className="stroke-staff"
            strokeWidth={1.75}
          />
        ))}
        {layout.notes.map((item) => {
          const active = item.index === activeIndex;
          if (!active) return null;
          return (
            <line
              key={`playhead-${item.index}`}
              x1={item.x}
              y1={item.y - 62}
              x2={item.x}
              y2={item.y + 90}
              className="stroke-active"
              strokeWidth={2}
            />
          );
        })}
        <BeamGroups groups={layout.groups} />
        <TupletMarks groups={layout.groups} subdivision={rudiment.subdivision} />
        {layout.notes.map((item) => {
          const active = item.index === activeIndex;
          const ornament = item.note.ornament ?? "none";
          const stemTop = item.beamCount > 0 ? item.y - 36 : item.y - 30;
          const graces = gracePositions(ornament, item.x);
          const firstGrace = graces[0];
          const lastGrace = graces[graces.length - 1];
          return (
            <g key={`${rudiment.id}-${item.index}`} aria-current={active ? "true" : undefined}>
              {graces.map((graceX) => (
                <g key={`${item.index}-grace-${graceX}`}>
                  <ellipse cx={graceX} cy={item.y - 18} rx={4} ry={3} className="fill-ghost" />
                  <line
                    x1={graceX + 4}
                    y1={item.y - 18}
                    x2={graceX + 4}
                    y2={item.y - 32}
                    className="stroke-ghost"
                    strokeWidth={1}
                  />
                </g>
              ))}
              {firstGrace !== undefined && lastGrace !== undefined ? (
                <path
                  d={`M ${lastGrace} ${item.y - 12} Q ${item.x - 10} ${item.y - 6} ${item.x - 7} ${item.y}`}
                  className="fill-none stroke-muted"
                  strokeWidth={1}
                />
              ) : null}
              <line
                x1={item.x + 7}
                y1={item.y - 2}
                x2={item.x + 7}
                y2={stemTop}
                className="stroke-ink"
                strokeWidth={1.6}
              />
              {ornament === "diddle" || ornament === "buzz"
                ? [0, 1, ornament === "buzz" ? 2 : -1]
                    .filter((slash) => slash >= 0)
                    .map((slash) => (
                      <line
                        key={`${item.index}-slash-${slash}`}
                        x1={item.x + 1}
                        y1={stemTop + 16 + slash * 6}
                        x2={item.x + 13}
                        y2={stemTop + 8 + slash * 6}
                        className="stroke-ink"
                        strokeWidth={1.4}
                      />
                    ))
                : null}
              <ellipse
                cx={item.x}
                cy={item.y}
                rx={7}
                ry={5}
                className={noteFill(item.note, active)}
                strokeWidth={1.5}
              />
              {item.note.accent ? (
                <text
                  x={item.x}
                  y={item.y - 44}
                  textAnchor="middle"
                  className="fill-accent text-sm font-semibold"
                >
                  {">"}
                </text>
              ) : null}
              {item.note.ghost ? (
                <g className="fill-ghost text-sm">
                  <text x={item.x - 14} y={item.y + 4} textAnchor="middle">
                    {"("}
                  </text>
                  <text x={item.x + 14} y={item.y + 4} textAnchor="middle">
                    {")"}
                  </text>
                </g>
              ) : null}
              <text
                x={item.x}
                y={item.y + 32}
                textAnchor="middle"
                className={active ? "fill-active text-sm font-semibold" : "fill-ink text-sm font-semibold"}
              >
                {item.note.hand}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
