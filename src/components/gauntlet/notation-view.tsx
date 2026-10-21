import type { ReactNode } from "react";
import {
  noteDuration,
  type NoteOrnament,
  type Rudiment,
  type RudimentNote,
} from "@/lib/rudiments";

const STAFF_Y = 78;
const UNIT = 36;

interface LaidOutNote {
  index: number;
  x: number;
  duration: number;
  beamCount: number;
  note: RudimentNote;
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

function layoutRudiment(rudiment: Rudiment): {
  notes: LaidOutNote[];
  groups: LaidOutNote[][];
  width: number;
} {
  const notes: LaidOutNote[] = [];
  let cursor = 0;
  rudiment.notes.forEach((note, index) => {
    const duration = noteDuration(note);
    notes.push({
      index,
      x: 58 + cursor * UNIT,
      duration,
      beamCount: beamLevels(duration, rudiment.subdivision),
      note,
    });
    cursor += duration;
  });

  const groups: LaidOutNote[][] = [];
  let group: LaidOutNote[] = [];
  let filled = 0;
  for (const item of notes) {
    group.push(item);
    filled += item.duration;
    if (filled >= rudiment.subdivision - 1e-6) {
      groups.push(group);
      group = [];
      filled = 0;
    }
  }
  if (group.length > 0) groups.push(group);

  return {
    notes,
    groups,
    width: Math.max(320, 58 + cursor * UNIT + 40),
  };
}

function noteFill(note: RudimentNote, active: boolean): string {
  if (active) return "fill-active stroke-active";
  if (note.ghost) return "fill-canvas stroke-ghost";
  if (note.accent) return "fill-accent stroke-accent";
  return "fill-tap stroke-ink";
}

function BeamGroups({ groups }: { groups: LaidOutNote[][] }) {
  const stemTop = STAFF_Y - 36;
  const marks: ReactNode[] = [];

  groups.forEach((group, groupIndex) => {
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
  const stemTop = STAFF_Y - 36;
  const bracketY = stemTop - 22;
  return (
    <g>
      {groups.map((group, groupIndex) => {
        const first = group[0];
        const last = group[group.length - 1];
        if (!first || !last) return null;
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
  const layout = layoutRudiment(rudiment);
  const [beats, division] = rudiment.timeSignature;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-panel p-3">
      <svg
        width={layout.width}
        height={180}
        viewBox={`0 0 ${layout.width} 180`}
        role="img"
        aria-label={`${rudiment.name} on a single snare line`}
        className="mx-auto block max-w-none"
      >
        <text x={14} y={STAFF_Y - 8} className="fill-ink text-lg font-semibold">
          {beats}
        </text>
        <text x={14} y={STAFF_Y + 16} className="fill-ink text-lg font-semibold">
          {division}
        </text>
        <line
          x1={48}
          y1={STAFF_Y}
          x2={layout.width - 16}
          y2={STAFF_Y}
          className="stroke-staff"
          strokeWidth={1.75}
        />
        {layout.notes.map((item) => {
          const active = item.index === activeIndex;
          if (!active) return null;
          return (
            <line
              key={`playhead-${item.index}`}
              x1={item.x}
              y1={16}
              x2={item.x}
              y2={168}
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
          const stemTop = item.beamCount > 0 ? STAFF_Y - 36 : STAFF_Y - 30;
          const graces = gracePositions(ornament, item.x);
          const firstGrace = graces[0];
          const lastGrace = graces[graces.length - 1];
          return (
            <g key={`${rudiment.id}-${item.index}`} aria-current={active ? "true" : undefined}>
              {graces.map((graceX) => (
                <g key={`${item.index}-grace-${graceX}`}>
                  <ellipse cx={graceX} cy={STAFF_Y - 18} rx={4} ry={3} className="fill-ghost" />
                  <line
                    x1={graceX + 4}
                    y1={STAFF_Y - 18}
                    x2={graceX + 4}
                    y2={STAFF_Y - 32}
                    className="stroke-ghost"
                    strokeWidth={1}
                  />
                </g>
              ))}
              {firstGrace !== undefined && lastGrace !== undefined ? (
                <path
                  d={`M ${lastGrace} ${STAFF_Y - 12} Q ${item.x - 10} ${STAFF_Y - 6} ${item.x - 7} ${STAFF_Y}`}
                  className="fill-none stroke-muted"
                  strokeWidth={1}
                />
              ) : null}
              <line
                x1={item.x + 7}
                y1={STAFF_Y - 2}
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
                cy={STAFF_Y}
                rx={7}
                ry={5}
                className={noteFill(item.note, active)}
                strokeWidth={1.5}
              />
              {item.note.accent ? (
                <text
                  x={item.x}
                  y={STAFF_Y - 44}
                  textAnchor="middle"
                  className="fill-accent text-sm font-semibold"
                >
                  {">"}
                </text>
              ) : null}
              {item.note.ghost ? (
                <g className="fill-ghost text-sm">
                  <text x={item.x - 14} y={STAFF_Y + 4} textAnchor="middle">
                    {"("}
                  </text>
                  <text x={item.x + 14} y={STAFF_Y + 4} textAnchor="middle">
                    {")"}
                  </text>
                </g>
              ) : null}
              <text
                x={item.x}
                y={STAFF_Y + 32}
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
