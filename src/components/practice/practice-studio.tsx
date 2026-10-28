"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AudioScheduler, clampBpm } from "@/lib/audio-scheduler";
import {
  applyRudimentIds,
  buildPracticePlan,
  clampTempoShift,
  currentExercise,
  exerciseBpm,
  exerciseDue,
  localDayKey,
  replaceFromExercise,
  shiftExerciseTempo,
  slotForExercise,
  suggestReplacement,
  type PracticePlan,
  type RudimentBand,
  type SessionMinutes,
  type SkillLevel,
} from "@/lib/practice-plan";
import { getRudimentById, RUDIMENTS_DB } from "@/lib/rudiments";
import { useAuth } from "@/components/account/auth-provider";
import { FeelLog } from "@/components/account/feel-log";
import { Button } from "@/components/ui/button";
import { NotationView } from "@/components/gauntlet/notation-view";
import { PracticeSessionBar, PracticeTransport } from "@/components/practice/practice-session";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { creditFinishedSession, recordPracticeSeconds } from "@/lib/progress-store";
import { DAY_CREDIT_SECONDS } from "@/lib/progress";

function subscribeDay() {
  return () => undefined;
}

function readDayKey() {
  return localDayKey(new Date());
}

function serverDayKey() {
  return "today";
}

export function PracticeStudio() {
  const dayKey = useSyncExternalStore(subscribeDay, readDayKey, serverDayKey);
  const [minutes, setMinutes] = useState<SessionMinutes>(15);
  const [skill, setSkill] = useState<SkillLevel>(2);
  const [band, setBand] = useState<RudimentBand>("medium");
  const [slotIds, setSlotIds] = useState<readonly string[] | null>(null);
  const [plan, setPlan] = useState<PracticePlan | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [bpm, setBpm] = useState(80);
  const [tempoShift, setTempoShift] = useState(0);
  const [metronome, setMetronome] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const schedulerRef = useRef<AudioScheduler | null>(null);
  const playingRef = useRef(false);
  const elapsedRef = useRef(0);
  const startedAtRef = useRef(0);
  const exerciseIndexRef = useRef(0);
  const planRef = useRef<PracticePlan | null>(null);
  const bpmRef = useRef(80);
  const tempoShiftRef = useRef(0);
  const cuedRef = useRef(false);
  const creditedRef = useRef(0);
  const trackedIdRef = useRef<string | null>(null);
  const sessionSecondsRef = useRef(0);
  const temposRef = useRef<Record<number, { startBpm: number; endBpm: number }>>({});
  const [exerciseTempos, setExerciseTempos] = useState<
    Record<number, { startBpm: number; endBpm: number }>
  >({});
  const { user } = useAuth();

  function rememberTempo(
    index: number,
    current: NonNullable<ReturnType<typeof currentExercise>>,
    shift: number,
  ) {
    const shifted = shiftExerciseTempo(current, shift);
    const next = {
      ...temposRef.current,
      [index]: { startBpm: shifted.startBpm, endBpm: shifted.endBpm },
    };
    temposRef.current = next;
    setExerciseTempos(next);
  }

  const basePlan = useMemo(
    () => buildPracticePlan({ minutes, skill, band, dayKey }, RUDIMENTS_DB),
    [minutes, skill, band, dayKey],
  );
  const previewIds =
    slotIds && slotIds.length === basePlan.rudimentIds.length ? slotIds : basePlan.rudimentIds;
  const previewPlan = useMemo(
    () => applyRudimentIds(basePlan, previewIds),
    [basePlan, previewIds],
  );

  useEffect(() => {
    const scheduler = new AudioScheduler();
    schedulerRef.current = scheduler;
    scheduler.setHandlers({
      onActiveNote: (index) => setActiveIndex(index),
      onRepetition: () => undefined,
      onEnded: () => {
        playingRef.current = false;
        setPlaying(false);
      },
      onBarCompleted: () => undefined,
    });
    scheduler.setLoop(true);
    scheduler.setMetronome(true);
    return () => {
      scheduler.dispose();
      schedulerRef.current = null;
      playingRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      const id = trackedIdRef.current;
      const seconds = Math.floor(elapsedRef.current / 1000) - creditedRef.current;
      if (id && seconds > 0) {
        creditedRef.current += seconds;
        sessionSecondsRef.current += seconds;
        void recordPracticeSeconds(id, seconds);
      }
    };
  }, []);

  useEffect(() => {
    schedulerRef.current?.setMetronome(metronome);
  }, [metronome]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (!playingRef.current) return;
      const planNow = planRef.current;
      const exercise = planNow
        ? currentExercise(planNow, exerciseIndexRef.current)
        : null;
      if (!planNow || !exercise) return;
      const now = performance.now();
      if (startedAtRef.current === 0) startedAtRef.current = now;
      const nextElapsed = elapsedRef.current + (now - startedAtRef.current);
      startedAtRef.current = performance.now();
      elapsedRef.current = nextElapsed;
      setElapsedMs(nextElapsed);
      const seconds = nextElapsed / 1000;
      const nextBpm = exerciseBpm(shiftExerciseTempo(exercise, tempoShiftRef.current), seconds);
      if (nextBpm !== bpmRef.current) {
        bpmRef.current = nextBpm;
        schedulerRef.current?.setBpm(nextBpm);
        setBpm(nextBpm);
      }
      if (exerciseDue(exercise, seconds) && !cuedRef.current) {
        cuedRef.current = true;
        schedulerRef.current?.playCue();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const exercise = plan ? currentExercise(plan, exerciseIndex) : null;
  const rudiment = exercise ? getRudimentById(exercise.rudimentId) : undefined;
  const elapsedSeconds = elapsedMs / 1000;

  function flushPractice() {
    const id = trackedIdRef.current;
    const seconds = Math.floor(elapsedRef.current / 1000) - creditedRef.current;
    if (id && seconds > 0) {
      creditedRef.current += seconds;
      sessionSecondsRef.current += seconds;
      if (user) void recordPracticeSeconds(id, seconds);
    }
  }

  function loadExercise(nextPlan: PracticePlan, index: number, autoplay: boolean) {
    const leaving =
      trackedIdRef.current && planRef.current === nextPlan
        ? currentExercise(nextPlan, exerciseIndexRef.current)
        : null;
    if (leaving) rememberTempo(exerciseIndexRef.current, leaving, tempoShiftRef.current);
    flushPractice();
    const next = currentExercise(nextPlan, index);
    const nextRudiment = next ? getRudimentById(next.rudimentId) : undefined;
    if (!next || !nextRudiment) {
      finish();
      return;
    }
    exerciseIndexRef.current = index;
    elapsedRef.current = 0;
    startedAtRef.current = 0;
    cuedRef.current = false;
    tempoShiftRef.current = 0;
    setTempoShift(0);
    trackedIdRef.current = next.rudimentId;
    creditedRef.current = 0;
    if (temposRef.current[index] === undefined) rememberTempo(index, next, 0);
    const nextBpm = exerciseBpm(next, 0);
    bpmRef.current = nextBpm;
    setExerciseIndex(index);
    setElapsedMs(0);
    setBpm(nextBpm);
    setFinished(false);
    const sched = schedulerRef.current;
    if (!sched) return;
    sched.setLoop(true);
    sched.setMetronome(metronome);
    sched.setBpm(nextBpm);
    sched.setRudiment(nextRudiment);
    if (autoplay) {
      const started = sched.start();
      playingRef.current = started;
      startedAtRef.current = 0;
      setPlaying(started);
      setAudioError(started ? null : "The browser blocked sound. Click resume again.");
    }
  }

  function startPlan() {
    flushPractice();
    sessionSecondsRef.current = 0;
    temposRef.current = {};
    setExerciseTempos({});
    trackedIdRef.current = null;
    const existing = planRef.current;
    const nextPlan =
      existing && existing.minutes === minutes && existing.skill === skill && existing.band === band
        ? existing
        : previewPlan;
    planRef.current = nextPlan;
    setPlan(nextPlan);
    loadExercise(nextPlan, 0, true);
  }

  function swapSetupSlot(slot: number) {
    const nextId = suggestReplacement(previewPlan, slot, RUDIMENTS_DB);
    if (!nextId) return;
    setSlotIds(previewIds.map((id, index) => (index === slot ? nextId : id)));
  }

  function swapCurrent() {
    flushPractice();
    const currentPlan = planRef.current;
    if (!currentPlan) return;
    const slot = slotForExercise(currentPlan, exerciseIndexRef.current);
    const nextId = suggestReplacement(currentPlan, slot, RUDIMENTS_DB);
    if (!nextId) return;
    const nextPlan = replaceFromExercise(currentPlan, exerciseIndexRef.current, nextId);
    planRef.current = nextPlan;
    setPlan(nextPlan);
    const next = currentExercise(nextPlan, exerciseIndexRef.current);
    const nextRudiment = next ? getRudimentById(next.rudimentId) : undefined;
    if (!next || !nextRudiment) return;
    trackedIdRef.current = next.rudimentId;
    creditedRef.current = Math.floor(elapsedRef.current / 1000);
    rememberTempo(exerciseIndexRef.current, next, tempoShiftRef.current);
    const sched = schedulerRef.current;
    if (!sched) return;
    sched.setRudiment(nextRudiment);
    if (playingRef.current) {
      sched.setBpm(bpmRef.current);
      sched.setLoop(true);
    }
  }

  function applyTempoShift(nextShift: number) {
    const planNow = planRef.current;
    const current = planNow ? currentExercise(planNow, exerciseIndexRef.current) : null;
    if (!current) return;
    const shift = clampTempoShift(current, nextShift);
    tempoShiftRef.current = shift;
    setTempoShift(shift);
    rememberTempo(exerciseIndexRef.current, current, shift);
    const nextBpm = exerciseBpm(shiftExerciseTempo(current, shift), elapsedRef.current / 1000);
    bpmRef.current = nextBpm;
    setBpm(nextBpm);
    schedulerRef.current?.setBpm(nextBpm);
  }

  function nudgeTempo(delta: number) {
    applyTempoShift(tempoShiftRef.current + delta);
  }

  function setTempoFromBpm(next: number) {
    const planNow = planRef.current;
    const current = planNow ? currentExercise(planNow, exerciseIndexRef.current) : null;
    if (!current) return;
    const planned = exerciseBpm(current, elapsedRef.current / 1000);
    applyTempoShift(clampBpm(next) - planned);
  }

  function pause() {
    playingRef.current = false;
    startedAtRef.current = 0;
    schedulerRef.current?.stop();
    setElapsedMs(elapsedRef.current);
    setPlaying(false);
    setActiveIndex(null);
  }

  function resume() {
    const sched = schedulerRef.current;
    const nextPlan = planRef.current;
    const next = nextPlan ? currentExercise(nextPlan, exerciseIndexRef.current) : null;
    const nextRudiment = next ? getRudimentById(next.rudimentId) : undefined;
    if (!sched || !next || !nextRudiment) return;
    sched.setLoop(true);
    sched.setMetronome(metronome);
    sched.setBpm(bpmRef.current);
    sched.setRudiment(nextRudiment);
    const started = sched.start();
    playingRef.current = started;
    startedAtRef.current = 0;
    setPlaying(started);
    setAudioError(started ? null : "The browser blocked sound. Click resume again.");
  }

  function goTo(index: number) {
    const nextPlan = planRef.current;
    if (!nextPlan) return;
    if (index < 0 || index >= nextPlan.exercises.length) return;
    if (index === exerciseIndexRef.current && !finished) return;
    schedulerRef.current?.stop();
    loadExercise(nextPlan, index, playingRef.current);
  }

  function goPrevious() {
    if (finished) {
      goTo(exerciseIndexRef.current);
      return;
    }
    goTo(exerciseIndexRef.current - 1);
  }

  function goNext() {
    const nextPlan = planRef.current;
    if (!nextPlan) return;
    const nextIndex = exerciseIndexRef.current + 1;
    if (nextIndex >= nextPlan.exercises.length) {
      finish();
      return;
    }
    schedulerRef.current?.stop();
    loadExercise(nextPlan, nextIndex, playingRef.current);
  }

  function finish() {
    const leaving = planRef.current
      ? currentExercise(planRef.current, exerciseIndexRef.current)
      : null;
    if (leaving) rememberTempo(exerciseIndexRef.current, leaving, tempoShiftRef.current);
    flushPractice();
    if (user && sessionSecondsRef.current >= DAY_CREDIT_SECONDS) {
      void creditFinishedSession(sessionSecondsRef.current);
    }
    playingRef.current = false;
    schedulerRef.current?.stop();
    setPlaying(false);
    setFinished(true);
    setActiveIndex(null);
  }

  function backToSetup() {
    flushPractice();
    trackedIdRef.current = null;
    creditedRef.current = 0;
    const current = planRef.current;
    playingRef.current = false;
    schedulerRef.current?.stop();
    planRef.current = null;
    setPlan(null);
    setPlaying(false);
    setFinished(false);
    setElapsedMs(0);
    setActiveIndex(null);
    if (current) setSlotIds(current.rudimentIds);
  }

  if (!plan) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-6">
        <PracticeSetup
          minutes={minutes}
          skill={skill}
          band={band}
          plan={previewPlan}
          onMinutes={(next) => {
            setMinutes(next);
            setSlotIds(null);
          }}
          onSkill={(next) => {
            setSkill(next);
            setSlotIds(null);
          }}
          onBand={(next) => {
            setBand(next);
            setSlotIds(null);
          }}
          onSwapSlot={swapSetupSlot}
          onStart={startPlan}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-4">
      <PracticeSessionBar
        plan={plan}
        exerciseIndex={exerciseIndex}
        elapsedSeconds={elapsedSeconds}
        bpm={bpm}
        tempoShift={tempoShift}
        finished={finished}
        canSwap={suggestReplacement(plan, slotForExercise(plan, exerciseIndex), RUDIMENTS_DB) !== null}
        onBpm={setTempoFromBpm}
        onNudge={nudgeTempo}
        onBack={backToSetup}
        onAgain={startPlan}
        onSwap={swapCurrent}
      />
      {rudiment ? <NotationView rudiment={rudiment} activeIndex={activeIndex} /> : null}
      <PracticeTransport
        playing={playing}
        finished={finished}
        canGoPrevious={exerciseIndex > 0 || finished}
        canGoNext={exerciseIndex + 1 < plan.exercises.length}
        due={Boolean(exercise && exerciseDue(exercise, elapsedSeconds) && !finished)}
        onPrevious={goPrevious}
        onPause={pause}
        onResume={resume}
        onNext={goNext}
      />
      {audioError ? <p className="text-sm text-accent">{audioError}</p> : null}
      {finished && user ? (
        <section className="rounded-2xl border border-line bg-panel p-4">
          <h3 className="text-lg font-semibold text-ink">How did it feel?</h3>
          <p className="mt-1 text-sm text-muted">Save a short note for later.</p>
          <div className="mt-4 space-y-3">
            {plan.rudimentIds.map((id) => {
              const slots = plan.exercises
                .map((item, index) => ({ item, index }))
                .filter((slot) => slot.item.rudimentId === id);
              const warmup = slots.find((slot) => slot.item.phase === "warmup") ?? slots[0];
              const push = [...slots].reverse().find((slot) => slot.item.phase === "push") ?? slots[slots.length - 1];
              if (!warmup || !push) return null;
              const startBpm =
                exerciseTempos[warmup.index]?.startBpm ?? warmup.item.startBpm;
              const endBpm = exerciseTempos[push.index]?.endBpm ?? push.item.endBpm;
              const name = getRudimentById(id)?.name ?? id;
              return (
                <FeelLog
                  key={id}
                  rudimentId={id}
                  title={name}
                  defaultStartBpm={startBpm}
                  defaultEndBpm={endBpm}
                />
              );
            })}
          </div>
        </section>
      ) : null}
      {finished ? null : (
        <Button
          tone={metronome ? "accent" : "quiet"}
          className="self-start"
          aria-pressed={metronome}
          onClick={() => setMetronome((value) => !value)}
        >
          Metronome
        </Button>
      )}
    </div>
  );
}
