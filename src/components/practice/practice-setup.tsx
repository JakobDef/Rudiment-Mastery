"use client";

import {
  SESSION_MINUTES,
  SKILL_BANDS,
  RUDIMENT_BANDS,
  metronomeForStrokeBpm,
  suggestReplacement,
  type PracticePlan,
  type RudimentBand,
  type SessionMinutes,
  type SkillLevel,
} from "@/lib/practice-plan";
import { getRudimentById, RUDIMENTS_DB } from "@/lib/rudiments";
import { Button } from "@/components/ui/button";

type PracticeSetupProps = {
  minutes: SessionMinutes;
  skill: SkillLevel;
  band: RudimentBand;
  plan: PracticePlan;
  onMinutes: (minutes: SessionMinutes) => void;
  onSkill: (skill: SkillLevel) => void;
  onBand: (band: RudimentBand) => void;
  onSwapSlot: (slot: number) => void;
  onStart: () => void;
};

function cardClass(selected: boolean): string {
  return selected
    ? "rounded-2xl border-2 border-accent bg-panel-raised px-3 py-4 text-left text-accent"
    : "rounded-2xl border border-line bg-panel px-3 py-4 text-left text-muted";
}

export function PracticeSetup({
  minutes,
  skill,
  band,
  plan,
  onMinutes,
  onSkill,
  onBand,
  onSwapSlot,
  onStart,
}: PracticeSetupProps) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Practice</h1>
        <p className="mt-2 text-sm text-muted">
          Pick a length, a tempo range, and how hard the rudiments should be. Tap Change if you want
          another matching exercise in that slot.
        </p>
      </div>

      <section>
        <h2 className="text-xs font-medium tracking-wide text-muted">How long?</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SESSION_MINUTES.map((option) => (
            <button
              key={option}
              type="button"
              className={cardClass(option === minutes)}
              onClick={() => onMinutes(option)}
            >
              <span className="block text-2xl font-semibold">{option}</span>
              <span className="text-sm">min</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium tracking-wide text-muted">Skill level</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {SKILL_BANDS.map((option) => (
            <button
              key={option.level}
              type="button"
              className={cardClass(option.level === skill)}
              onClick={() => onSkill(option.level)}
            >
              <span className="block text-lg font-semibold">Level {option.level}</span>
              <span className="text-sm">
                {option.low}-{option.high} BPM
              </span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-medium tracking-wide text-muted">Rudiment difficulty</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {RUDIMENT_BANDS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cardClass(option.id === band)}
              onClick={() => onBand(option.id)}
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="text-sm">
                Level {option.min}-{option.max}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-4">
        <h2 className="text-sm font-semibold text-ink">Today&apos;s plan</h2>
        <p className="mt-1 text-sm text-muted">
          Speeds match 16th notes at {plan.warmupLow}-{plan.warmupHigh} BPM, then the same ones faster
          at {plan.pushLow}-{plan.pushHigh} BPM. Sextuplets and triplets are scaled so the strokes
          stay in that range.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {plan.rudimentIds.map((id, slot) => {
            const rudiment = getRudimentById(id);
            const subdivision = rudiment?.subdivision ?? 4;
            const warmupStart = metronomeForStrokeBpm(plan.warmupLow, subdivision);
            const warmupEnd = metronomeForStrokeBpm(plan.warmupHigh, subdivision);
            return (
              <li
                key={`${slot}-${id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-3 py-3"
              >
                <span>
                  <span className="block text-xs text-muted">
                    Slot {slot + 1}
                    {rudiment ? ` · warmup ${warmupStart}-${warmupEnd} BPM` : ""}
                  </span>
                  <span className="block font-semibold text-ink">{rudiment?.name ?? id}</span>
                </span>
                <Button
                  tone="quiet"
                  onClick={() => onSwapSlot(slot)}
                  disabled={suggestReplacement(plan, slot, RUDIMENTS_DB) === null}
                >
                  Change
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button tone="accent" className="w-full py-4 text-base" onClick={onStart}>
        Start practice
      </Button>
    </div>
  );
}
