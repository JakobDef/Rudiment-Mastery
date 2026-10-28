"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/account/auth-provider";
import { clampBpm } from "@/lib/audio-scheduler";
import { addRudimentLog, deleteRudimentLog, watchRudimentLogs, type RudimentLog } from "@/lib/progress-store";
import { EASE_OPTIONS, formatBpmRange, formatLogStamp, type Ease } from "@/lib/progress";

export function FeelLog({
  rudimentId,
  title,
  defaultStartBpm,
  defaultEndBpm,
  lockBpm = false,
  showForm = true,
  showHistory = true,
}: {
  rudimentId: string;
  title?: string;
  defaultStartBpm?: number;
  defaultEndBpm?: number;
  lockBpm?: boolean;
  showForm?: boolean;
  showHistory?: boolean;
}) {
  const { user } = useAuth();
  const [ease, setEase] = useState<Ease>(3);
  const [note, setNote] = useState("");
  const [startBpm, setStartBpm] = useState(defaultStartBpm ?? 80);
  const [endBpm, setEndBpm] = useState(defaultEndBpm ?? defaultStartBpm ?? 80);
  const [logs, setLogs] = useState<RudimentLog[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    return watchRudimentLogs(rudimentId, setLogs);
  }, [user, rudimentId]);

  const shownLogs = user ? logs : [];

  if (!user) return null;

  async function save() {
    setSaving(true);
    try {
      await addRudimentLog(rudimentId, {
        ease,
        note,
        startBpm: clampBpm(startBpm),
        endBpm: clampBpm(endBpm),
      });
      setNote("");
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-canvas p-3">
      {title ? <p className="text-sm font-medium text-ink">{title}</p> : null}
      {showForm ? (
        <>
          <p className="mt-1 text-xs text-muted">How did this feel?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {EASE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                tone={ease === option.value ? "accent" : "panel"}
                className="px-3"
                aria-pressed={ease === option.value}
                onClick={() => setEase(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="mt-3">
            <p className="text-xs text-muted">Tempo</p>
            {lockBpm ? (
              <p className="mt-1 font-mono text-sm text-ink">{formatBpmRange(startBpm, endBpm)}</p>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <BpmBox label="From" value={startBpm} onChange={setStartBpm} />
                <span className="text-sm text-muted">to</span>
                <BpmBox label="To" value={endBpm} onChange={setEndBpm} />
                <span className="text-sm text-muted">BPM</span>
              </div>
            )}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Optional note. What felt better or worse?"
            className="mt-3 w-full resize-y rounded-2xl border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <Button tone="accent" className="mt-3" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving" : "Save log"}
          </Button>
        </>
      ) : null}
      {showHistory ? (
        shownLogs.length > 0 ? (
          <ul className={`${showForm ? "mt-4" : ""} space-y-2`}>
            {shownLogs.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-line bg-panel px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink">
                      {EASE_OPTIONS.find((option) => option.value === entry.ease)?.label ?? "Okay"}
                      {entry.startBpm > 0 ? ` · ${formatBpmRange(entry.startBpm, entry.endBpm)}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{formatLogStamp(entry.createdAt)}</p>
                    {entry.note ? <p className="mt-1 text-sm text-muted">{entry.note}</p> : null}
                  </div>
                  <Button
                    tone="quiet"
                    className="shrink-0 px-3"
                    onClick={() => void deleteRudimentLog(rudimentId, entry.id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`${showForm ? "mt-3" : ""} text-xs text-muted`}>No logs yet.</p>
        )
      ) : null}
    </div>
  );
}

function BpmBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        aria-label={label}
        value={String(value)}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value.replace(/[^\d]/g, ""), 10);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        onBlur={() => onChange(clampBpm(value))}
        className="w-[4.5ch] rounded-xl border border-line bg-panel px-2 py-1 text-center font-mono text-sm text-ink outline-none focus:border-accent"
      />
    </label>
  );
}
