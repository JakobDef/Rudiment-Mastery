"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AudioScheduler, clampBpm } from "@/lib/audio-scheduler";
import {
  createWorkout,
  currentRudimentId,
  reduceCompletedBar,
  type BarsPerStep,
  type BpmStep,
  type WorkoutMode,
  type WorkoutState,
} from "@/lib/gauntlet-engine";
import {
  getRudimentById,
  RUDIMENTS_DB,
  type Difficulty,
  type RudimentCategory,
} from "@/lib/rudiments";
import { FeelLog } from "@/components/account/feel-log";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";
import { GauntletMode } from "@/components/gauntlet/gauntlet-mode";
import { NotationView } from "@/components/gauntlet/notation-view";
import { RudimentLibrary } from "@/components/gauntlet/rudiment-library";
import { TransportBar } from "@/components/gauntlet/transport-bar";
import { recordPracticeSeconds } from "@/lib/progress-store";

export function GauntletStudio() {
  const initial = RUDIMENTS_DB[0];
  const [rudimentId, setRudimentId] = useState(initial?.id ?? "");
  const [bpm, setBpm] = useState(initial?.defaultBpm ?? 80);
  const [startBpm, setStartBpm] = useState(initial?.defaultBpm ?? 80);
  const [targetBpm, setTargetBpm] = useState(initial?.targetBpm ?? 120);
  const [bpmStep, setBpmStep] = useState<BpmStep>(5);
  const [barsPerStep, setBarsPerStep] = useState<BarsPerStep>(4);
  const [mode, setMode] = useState<WorkoutMode>("speed");
  const [metronome, setMetronome] = useState(true);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [repetition, setRepetition] = useState(1);
  const [workout, setWorkout] = useState<WorkoutState | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [category, setCategory] = useState<RudimentCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<Difficulty | "all">("all");
  const [query, setQuery] = useState("");
  const [queueIds, setQueueIds] = useState<string[]>(initial ? [initial.id] : []);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const { user, configured, signIn } = useAuth();

  const schedulerRef = useRef<AudioScheduler | null>(null);
  const workoutRef = useRef<WorkoutState | null>(null);
  const tapsRef = useRef<number[]>([]);
  const playStartedRef = useRef(0);
  const playRudimentRef = useRef("");

  function flushGauntlet(nextId?: string) {
    const id = playRudimentRef.current;
    const started = playStartedRef.current;
    if (id && started > 0) {
      const seconds = Math.floor((performance.now() - started) / 1000);
      if (seconds > 0) void recordPracticeSeconds(id, seconds);
    }
    playRudimentRef.current = nextId ?? "";
    playStartedRef.current = nextId ? performance.now() : 0;
  }

  useLayoutEffect(() => {
    return () => setLibraryOpen(false);
  }, []);

  useEffect(() => {
    const scheduler = new AudioScheduler();
    schedulerRef.current = scheduler;
    scheduler.setHandlers({
      onActiveNote: (index) => setActiveIndex(index),
      onRepetition: (next) => setRepetition(next),
      onEnded: () => {
        flushGauntlet();
        setPlaying(false);
        workoutRef.current = null;
        setWorkout(null);
      },
      onBarCompleted: () => {
        const sched = schedulerRef.current;
        if (!sched) return;
        const current = workoutRef.current;
        if (!current) return;
        const next = reduceCompletedBar(current);
        const previousId = currentRudimentId(current);
        const nextId = currentRudimentId(next);
        workoutRef.current = next;
        setWorkout(next);
        sched.setBpm(next.bpm);
        setBpm(next.bpm);
        if (next.mode === "queue" && nextId && nextId !== previousId) {
          const rudiment = getRudimentById(nextId);
          if (rudiment) {
            flushGauntlet(rudiment.id);
            sched.setRudiment(rudiment);
            setRudimentId(rudiment.id);
          }
        }
      },
    });

    return () => {
      flushGauntlet();
      scheduler.dispose();
      schedulerRef.current = null;
      workoutRef.current = null;
      setPlaying(false);
      setWorkout(null);
      setActiveIndex(null);
    };
  }, []);

  useEffect(() => {
    schedulerRef.current?.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    schedulerRef.current?.setMetronome(metronome);
  }, [metronome]);

  useEffect(() => {
    schedulerRef.current?.setLoop(loop || workoutRef.current !== null);
  }, [loop, workout]);

  useEffect(() => {
    if (workoutRef.current) return;
    const rudiment = getRudimentById(rudimentId);
    if (rudiment) schedulerRef.current?.setRudiment(rudiment);
  }, [rudimentId]);

  const rudiment = getRudimentById(rudimentId) ?? initial;

  function stopPlayback() {
    flushGauntlet();
    schedulerRef.current?.stop();
    workoutRef.current = null;
    setWorkout(null);
    setPlaying(false);
    setActiveIndex(null);
  }

  function begin(nextBpm: number, nextId: string, looped: boolean): boolean {
    const sched = schedulerRef.current;
    const nextRudiment = getRudimentById(nextId);
    if (!sched || !nextRudiment) return false;
    sched.setLoop(looped);
    sched.setMetronome(metronome);
    sched.setBpm(nextBpm);
    sched.setRudiment(nextRudiment);
    const started = sched.start();
    setPlaying(started);
    setAudioError(started ? null : "The browser blocked sound. Click play again.");
    if (started) {
      playRudimentRef.current = nextId;
      playStartedRef.current = performance.now();
    } else {
      playRudimentRef.current = "";
      playStartedRef.current = 0;
      workoutRef.current = null;
      setWorkout(null);
    }
    return started;
  }

  function togglePlay() {
    if (playing) {
      stopPlayback();
      return;
    }
    begin(bpm, rudimentId, loop);
  }

  function applyBpm(next: number) {
    if (workoutRef.current) return;
    setBpm(clampBpm(next));
  }

  function tapTempo() {
    if (workoutRef.current) return;
    const now = performance.now();
    const recent = tapsRef.current.filter((stamp) => now - stamp < 2000);
    recent.push(now);
    tapsRef.current = recent.slice(-5);
    if (recent.length < 2) return;
    const intervals: number[] = [];
    for (let index = 1; index < recent.length; index += 1) {
      const previous = recent[index - 1];
      const current = recent[index];
      if (previous === undefined || current === undefined) continue;
      intervals.push(current - previous);
    }
    if (intervals.length === 0) return;
    const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    applyBpm(60000 / average);
  }

  function selectRudiment(id: string) {
    const next = getRudimentById(id);
    if (!next) return;
    if (workoutRef.current || playing) stopPlayback();
    setRudimentId(next.id);
    setBpm(next.defaultBpm);
    setStartBpm(next.defaultBpm);
    setTargetBpm(next.targetBpm);
    setLibraryOpen(false);
    setLogOpen(false);
  }

  function startWorkout() {
    flushGauntlet();
    const ids =
      mode === "queue" ? (queueIds.length > 0 ? queueIds : [rudimentId]) : [rudimentId];
    const next = createWorkout({
      mode,
      startBpm,
      targetBpm,
      bpmStep,
      barsPerStep,
      rudimentIds: ids,
    });
    const id = currentRudimentId(next) ?? rudimentId;
    const nextRudiment = getRudimentById(id);
    if (!nextRudiment) return;
    workoutRef.current = next;
    setWorkout(next);
    setRudimentId(nextRudiment.id);
    setBpm(next.bpm);
    const started = begin(next.bpm, nextRudiment.id, true);
    if (!started) workoutRef.current = null;
  }

  if (!rudiment) {
    return <p className="p-6 text-ink">No rudiments are loaded.</p>;
  }

  const library = (
    <RudimentLibrary
      category={category}
      difficulty={difficulty}
      query={query}
      selectedId={rudiment.id}
      queueIds={queueIds}
      onCategory={setCategory}
      onDifficulty={setDifficulty}
      onQuery={setQuery}
      onSelect={selectRudiment}
      onToggleQueue={(id) =>
        setQueueIds((current) =>
          current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
        )
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 lg:flex-row">
      <aside className="hidden w-80 shrink-0 lg:block">{library}</aside>
      {libraryOpen ? (
        <div className="fixed inset-0 z-20 flex flex-col bg-canvas p-4 lg:hidden">
          <div className="mb-3 flex justify-end">
            <Button tone="quiet" onClick={() => setLibraryOpen(false)}>
              Close
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{library}</div>
        </div>
      ) : null}
      <main className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ink">{rudiment.name}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">{rudiment.description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button tone="panel" className="lg:hidden" onClick={() => setLibraryOpen(true)}>
              Library
            </Button>
            {configured && !user ? (
              <Button tone="quiet" onClick={() => void signIn()}>
                Sign in to log
              </Button>
            ) : null}
            {user ? (
              <Button tone={logOpen ? "accent" : "panel"} onClick={() => setLogOpen((value) => !value)}>
                {logOpen ? "Close log" : "Add log"}
              </Button>
            ) : null}
          </div>
        </header>
        <NotationView rudiment={rudiment} activeIndex={activeIndex} />
        {user ? (
          <section className="rounded-2xl border border-line bg-panel p-4">
            <h2 className="text-sm font-semibold text-ink">Logs</h2>
            <p className="mt-1 text-xs text-muted">Notes from Practice and Pad Gauntlet show up here.</p>
            {logOpen ? (
              <div className="mt-3">
                <FeelLog
                  key={`${rudiment.id}-${startBpm}-${targetBpm}`}
                  rudimentId={rudiment.id}
                  defaultStartBpm={startBpm}
                  defaultEndBpm={targetBpm}
                  showHistory={false}
                />
              </div>
            ) : null}
            <div className="mt-3">
              <FeelLog rudimentId={rudiment.id} showForm={false} />
            </div>
          </section>
        ) : null}
        {audioError ? <p className="text-sm text-accent">{audioError}</p> : null}
        <TransportBar
          bpm={bpm}
          playing={playing}
          metronome={metronome}
          loop={loop || workout !== null}
          locked={workout !== null}
          onBpmChange={applyBpm}
          onTogglePlay={togglePlay}
          onToggleMetronome={() => setMetronome((value) => !value)}
          onToggleLoop={() => setLoop((value) => !value)}
          onTapTempo={tapTempo}
        />
        <GauntletMode
          mode={mode}
          startBpm={startBpm}
          targetBpm={targetBpm}
          bpmStep={bpmStep}
          barsPerStep={barsPerStep}
          running={workout !== null && playing}
          repetition={repetition}
          workout={workout}
          onMode={setMode}
          onStartBpm={setStartBpm}
          onTargetBpm={setTargetBpm}
          onBpmStep={setBpmStep}
          onBarsPerStep={setBarsPerStep}
          onStart={startWorkout}
          onStop={stopPlayback}
        />
      </main>
    </div>
  );
}
