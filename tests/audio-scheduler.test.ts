import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioScheduler } from "@/lib/audio-scheduler";
import { RUDIMENTS_DB, type Rudiment, type RudimentNote } from "@/lib/rudiments";

type SchedulerClock = {
  scheduleAhead: () => void;
  playVoice: (time: number, kind: string) => void;
  playRudimentNote: (rudiment: Rudiment, note: RudimentNote, time: number) => void;
};

function harness(rudiment: Rudiment) {
  const context = { currentTime: 0, state: "running", resume: vi.fn(), close: vi.fn(), suspend: vi.fn() };
  vi.stubGlobal("window", {
    AudioContext: class { constructor() { return context; } },
    setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(),
    requestAnimationFrame: vi.fn(() => 1), cancelAnimationFrame: vi.fn(),
  });
  const scheduler = new AudioScheduler();
  const clock = scheduler as unknown as SchedulerClock;
  const clicks: number[] = [];
  const notes: number[] = [];
  vi.spyOn(clock, "playVoice").mockImplementation((time, kind) => {
    if (kind.startsWith("click")) clicks.push(time);
  });
  vi.spyOn(clock, "playRudimentNote").mockImplementation((_rudiment, _note, time) => notes.push(time));
  scheduler.setRudiment(rudiment);
  scheduler.setBpm(80);
  expect(scheduler.start()).toBe(true);
  return { scheduler, clock, context, clicks, notes };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pattern(subdivision: 2 | 3 | 4 | 6, duration = 1): Rudiment {
  return {
    ...RUDIMENTS_DB[0]!, subdivision, timeSignature: [4, 4],
    notes: Array.from({ length: 4 * subdivision / duration }, () => ({ hand: "R", duration })),
  };
}

function expectAligned(clicks: number[], notes: number[], notesPerBeat: number) {
  expect(clicks.length).toBeGreaterThan(100);
  // The final click can already be scheduled while its note is just outside the horizon.
  for (let i = 0; i < clicks.length - 1; i += 1) {
    expect(notes[i * notesPerBeat], `beat ${i}`).toBeCloseTo(clicks[i]!, 8);
    for (let step = 1; step < notesPerBeat; step += 1) {
      expect(notes[i * notesPerBeat + step]).toBeCloseTo(
        clicks[i]! + (clicks[i + 1]! - clicks[i]!) * step / notesPerBeat, 8,
      );
    }
  }
}

describe("shared rudiment and metronome clock", () => {
  it.each([2, 3, 4, 6] as const)("keeps subdivision %i aligned through five minutes of tempo changes", (subdivision) => {
    const { scheduler, clock, context, clicks, notes } = harness(pattern(subdivision));
    for (let tick = 1; tick <= 12000; tick += 1) {
      context.currentTime = tick * 0.025;
      // Includes a gradual climb and abrupt manual changes at arbitrary beat phases.
      scheduler.setBpm(tick < 6000 ? 80 + tick / 60 : tick % 137 < 60 ? 220 : 95);
      clock.scheduleAhead();
    }
    expectAligned(clicks, notes, subdivision);
  });

  it("keeps fractional note durations aligned", () => {
    const { scheduler, clock, context, clicks, notes } = harness(pattern(4, 0.5));
    for (let tick = 1; tick <= 4000; tick += 1) {
      context.currentTime = tick * 0.025;
      scheduler.setBpm(60 + tick / 25);
      clock.scheduleAhead();
    }
    expectAligned(clicks, notes, 8);
  });

  it("applies a gauntlet tempo step to both streams on the bar boundary", () => {
    const { scheduler, clock, context, clicks, notes } = harness(pattern(4));
    scheduler.setHandlers({
      onActiveNote: () => undefined, onRepetition: () => undefined, onEnded: () => undefined,
      onBarCompleted: () => scheduler.setBpm(160),
    });
    for (let tick = 1; tick <= 4000; tick += 1) {
      context.currentTime = tick * 0.025;
      clock.scheduleAhead();
    }
    expect(clicks[4]! - clicks[3]!).toBeCloseTo(60 / 80);
    expect(clicks[5]! - clicks[4]!).toBeCloseTo(60 / 160);
    expectAligned(clicks, notes, 4);
  });

  it("keeps every catalog pattern on the beat grid while accelerating", () => {
    for (const rudiment of RUDIMENTS_DB) {
      const { scheduler, clock, context, clicks, notes } = harness(rudiment);
      for (let tick = 1; tick <= 1200; tick += 1) {
        context.currentTime = tick * 0.025;
        scheduler.setBpm(80 + tick / 10);
        clock.scheduleAhead();
      }
      let position = 0;
      notes.forEach((time, index) => {
        const beat = Math.floor(position + 1e-8);
        if (beat + 1 < clicks.length) {
          const fraction = Math.max(0, position - beat);
          expect(time, `${rudiment.id}, note ${index}`).toBeCloseTo(
            clicks[beat]! + fraction * (clicks[beat + 1]! - clicks[beat]!), 8,
          );
        }
        position += (rudiment.notes[index % rudiment.notes.length]!.duration ?? 1) / rudiment.subdivision;
      });
      scheduler.dispose();
    }
  });

  it("aligns a queued rudiment with a different subdivision at the bar boundary", () => {
    const { scheduler, clock, context, clicks, notes } = harness(pattern(4));
    let switched = false;
    scheduler.setHandlers({
      onActiveNote: () => undefined, onRepetition: () => undefined, onEnded: () => undefined,
      onBarCompleted: () => {
        if (switched) return;
        switched = true;
        scheduler.setRudiment(pattern(6));
        scheduler.setBpm(140);
      },
    });
    for (let tick = 1; tick <= 800; tick += 1) {
      context.currentTime = tick * 0.025;
      clock.scheduleAhead();
    }
    for (let beat = 4; beat < clicks.length - 1; beat += 1) {
      expect(notes[16 + (beat - 4) * 6]).toBeCloseTo(clicks[beat]!, 8);
    }
  });
});
