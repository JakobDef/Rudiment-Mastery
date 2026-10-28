"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/account/auth-provider";
import { localDayKey } from "@/lib/practice-plan";
import {
  currentStreak,
  formatPracticeTime,
  METRONOME_SOURCE,
  monthGrid,
} from "@/lib/progress";
import { creditPracticeDay, watchPracticeDays, watchRudimentStats, type RudimentStat } from "@/lib/progress-store";
import { getRudimentById } from "@/lib/rudiments";

function subscribeNothing() {
  return () => undefined;
}

export function DashboardStudio() {
  const { configured, ready, user, error, signIn } = useAuth();
  const todayKey = useSyncExternalStore(subscribeNothing, () => localDayKey(new Date()), () => "today");
  const today = useMemo(() => {
    if (todayKey === "today") return new Date(2026, 9, 21);
    const parts = todayKey.split("-").map((part) => Number(part));
    return new Date(parts[0] ?? 2026, (parts[1] ?? 10) - 1, parts[2] ?? 21);
  }, [todayKey]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [days, setDays] = useState<string[]>([]);
  const [stats, setStats] = useState<RudimentStat[]>([]);

  useEffect(() => {
    if (!user) return;
    const stopDays = watchPracticeDays((records) => {
      setDays(records.filter((record) => record.counted).map((record) => record.dayKey));
    });
    const stopStats = watchRudimentStats(setStats);
    return () => {
      stopDays();
      stopStats();
    };
  }, [user]);

  const shownStats = user ? stats : [];
  const cursorDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const cursor = { year: cursorDate.getFullYear(), month: cursorDate.getMonth() + 1 };
  const practiced = useMemo(() => new Set(user ? days : []), [user, days]);
  const streak = todayKey === "today" ? 0 : currentStreak(practiced, todayKey);
  const cells = monthGrid(cursor.year, cursor.month, practiced, todayKey);
  const monthLabel = new Date(cursor.year, cursor.month - 1, 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
  const practicedRudiments = shownStats
    .filter((item) => item.totalSeconds > 0 && item.rudimentId !== METRONOME_SOURCE)
    .slice()
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <p className="text-muted">Loading</p>
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-3 text-ink">
          Sign in is not connected yet. Once this app is linked to your Google project, you can
          keep a streak and notes here.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-3 text-ink">
          Sign in with Google if you want a streak and a calendar. Practice still works without it.
        </p>
        <Button tone="accent" className="mt-4" onClick={() => void signIn()}>
          Sign in with Google
        </Button>
        {error ? <p className="mt-3 text-sm text-accent">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-xs font-medium tracking-wide text-muted">Practice streak</p>
        <p className="mt-2 font-mono text-6xl text-ink">{streak}</p>
        <p className="mt-1 text-sm text-muted">
          {streak === 1 ? "day in a row" : "days in a row"}
        </p>
        {todayKey !== "today" && !practiced.has(todayKey) ? (
          <Button tone="quiet" className="mt-4" onClick={() => void creditPracticeDay(todayKey)}>
            Count today
          </Button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">{monthLabel}</h2>
          <div className="flex gap-2">
            <Button tone="quiet" onClick={() => setMonthOffset((value) => value - 1)}>
              Prev
            </Button>
            <Button tone="quiet" onClick={() => setMonthOffset((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((cell) => {
            let tone = "bg-panel-raised text-muted";
            if (!cell.inMonth) tone = "bg-transparent text-muted/40";
            else if (cell.future) tone = "bg-panel-raised text-muted";
            else if (cell.practiced) tone = "bg-active text-canvas-ink";
            else tone = "bg-line text-muted";
            return (
              <div
                key={cell.dayKey}
                title={
                  cell.future
                    ? cell.dayKey
                    : cell.practiced
                      ? `${cell.dayKey} practiced`
                      : `${cell.dayKey} missed`
                }
                className={`flex h-10 items-center justify-center rounded-xl text-sm ${tone} ${
                  cell.today ? "ring-2 ring-accent" : ""
                }`}
              >
                {cell.day}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-active" /> Practiced
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-line" /> Missed
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink">Rudiments</h2>
        <p className="mt-1 text-sm text-muted">
          A day turns green after a full practice session of at least 5 minutes, or 5 minutes on
          the metronome, or 5 minutes on one rudiment. Write logs in Pad Gauntlet or after
          Practice.
        </p>
        {practicedRudiments.length === 0 ? (
          <p className="mt-4 text-sm text-ink">Nothing saved yet. Play a rudiment first.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {practicedRudiments.map((item) => {
              const rudiment = getRudimentById(item.rudimentId);
              const name = rudiment?.name ?? item.rudimentId;
              return (
                <li
                  key={item.rudimentId}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3"
                >
                  <span className="text-sm font-medium text-ink">{name}</span>
                  <span className="font-mono text-sm text-muted">
                    {formatPracticeTime(item.totalSeconds)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
