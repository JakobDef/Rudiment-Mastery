"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function PracticeTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <section className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-ink">Clock</h1>
        <p className="mt-1 max-w-md text-sm text-muted">
          The clock pauses on other pages and keeps your time when you come back. The gauntlet does
          not change it.
        </p>
      </div>
      <p className="font-mono text-5xl text-ink" aria-live="polite">
        {formatClock(elapsed)}
      </p>
      <div className="flex gap-2">
        <Button tone="accent" onClick={() => setRunning((value) => !value)}>
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          tone="quiet"
          onClick={() => {
            setRunning(false);
            setElapsed(0);
          }}
        >
          Reset
        </Button>
      </div>
    </section>
  );
}
