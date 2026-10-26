"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/account/auth-provider";
import { addRudimentLog, watchRudimentLogs, type RudimentLog } from "@/lib/progress-store";
import { EASE_OPTIONS, type Ease } from "@/lib/progress";

export function FeelLog({
  rudimentId,
  title,
}: {
  rudimentId: string;
  title?: string;
}) {
  const { user } = useAuth();
  const [ease, setEase] = useState<Ease>(3);
  const [note, setNote] = useState("");
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
      await addRudimentLog(rudimentId, ease, note);
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
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={3}
        placeholder="Optional note. What felt better or worse?"
        className="mt-3 w-full resize-y rounded-2xl border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent"
      />
      <Button tone="accent" className="mt-3" disabled={saving} onClick={() => void save()}>
        {saving ? "Saving" : "Save note"}
      </Button>
      {shownLogs.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {shownLogs.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-line bg-panel px-3 py-2">
              <p className="text-sm text-ink">
                {EASE_OPTIONS.find((option) => option.value === entry.ease)?.label ?? "Okay"}
                {entry.createdAt
                  ? ` · ${new Date(entry.createdAt).toLocaleDateString()}`
                  : ""}
              </p>
              {entry.note ? <p className="mt-1 text-sm text-muted">{entry.note}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">No notes yet.</p>
      )}
    </div>
  );
}
