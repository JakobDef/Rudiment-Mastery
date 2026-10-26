import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { localDayKey } from "@/lib/practice-plan";
import {
  DAY_CREDIT_SECONDS,
  METRONOME_SOURCE,
  MIN_PRACTICE_SECONDS,
  qualifiesForDayCredit,
  type Ease,
} from "@/lib/progress";

export type DayRecord = {
  dayKey: string;
  seconds: number;
  counted: boolean;
};

export type RudimentStat = {
  rudimentId: string;
  totalSeconds: number;
};

export type RudimentLog = {
  id: string;
  ease: Ease;
  note: string;
  createdAt: number;
};

function userId(): string | null {
  return getFirebase()?.auth.currentUser?.uid ?? null;
}

export async function recordPracticeSeconds(sourceId: string, seconds: number): Promise<void> {
  const services = getFirebase();
  const uid = userId();
  const safeSeconds = Math.floor(seconds);
  if (!services || !uid || !sourceId || safeSeconds < MIN_PRACTICE_SECONDS) return;
  const dayKey = localDayKey(new Date());
  const dayRef = doc(services.db, "users", uid, "days", dayKey);
  const rudimentRef = doc(services.db, "users", uid, "rudiments", sourceId);
  try {
    await runTransaction(services.db, async (tx) => {
      const daySnap = await tx.get(dayRef);
      const rudimentSnap = sourceId === METRONOME_SOURCE ? null : await tx.get(rudimentRef);
      const day = daySnap.data() ?? {};
      const rudiments = (day.rudiments ?? {}) as Record<string, number>;
      const previous =
        sourceId === METRONOME_SOURCE
          ? Number(day.metronomeSeconds ?? 0)
          : Number(rudiments[sourceId] ?? 0);
      const next = previous + safeSeconds;
      const dayUpdate: Record<string, unknown> = {
        seconds: Number(day.seconds ?? 0) + safeSeconds,
        counted: Boolean(day.counted) || qualifiesForDayCredit(next),
      };
      if (sourceId === METRONOME_SOURCE) dayUpdate.metronomeSeconds = next;
      else dayUpdate[`rudiments.${sourceId}`] = next;
      tx.set(dayRef, dayUpdate, { merge: true });
      if (rudimentSnap) {
        tx.set(
          rudimentRef,
          {
            totalSeconds: Number(rudimentSnap.data()?.totalSeconds ?? 0) + safeSeconds,
            lastPracticedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    });
  } catch {
    return;
  }
}

export async function creditFinishedSession(sessionSeconds: number): Promise<void> {
  const services = getFirebase();
  const uid = userId();
  if (!services || !uid || !qualifiesForDayCredit(sessionSeconds)) return;
  const dayKey = localDayKey(new Date());
  try {
    await setDoc(
      doc(services.db, "users", uid, "days", dayKey),
      {
        counted: true,
        sessionSeconds: Math.floor(sessionSeconds),
      },
      { merge: true },
    );
  } catch {
    return;
  }
}

export async function addRudimentLog(rudimentId: string, ease: Ease, note: string): Promise<void> {
  const services = getFirebase();
  const uid = userId();
  if (!services || !uid || !rudimentId) return;
  try {
    await addDoc(collection(services.db, "users", uid, "rudiments", rudimentId, "logs"), {
      ease,
      note: note.trim(),
      createdAt: serverTimestamp(),
    });
  } catch {
    return;
  }
}

export function watchPracticeDays(
  onNext: (days: DayRecord[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const services = getFirebase();
  const uid = userId();
  if (!services || !uid) {
    onNext([]);
    return () => undefined;
  }
  return onSnapshot(
    collection(services.db, "users", uid, "days"),
    (snap) => {
      onNext(
        snap.docs.map((item) => ({
          dayKey: item.id,
          seconds: Number(item.data().seconds ?? 0),
          counted: Boolean(item.data().counted) || Number(item.data().seconds ?? 0) >= DAY_CREDIT_SECONDS,
        })),
      );
    },
    (error) => onError?.(error),
  );
}

export function watchRudimentStats(
  onNext: (stats: RudimentStat[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const services = getFirebase();
  const uid = userId();
  if (!services || !uid) {
    onNext([]);
    return () => undefined;
  }
  return onSnapshot(
    collection(services.db, "users", uid, "rudiments"),
    (snap) => {
      onNext(
        snap.docs.map((item) => ({
          rudimentId: item.id,
          totalSeconds: Number(item.data().totalSeconds ?? 0),
        })),
      );
    },
    (error) => onError?.(error),
  );
}

export function watchRudimentLogs(
  rudimentId: string,
  onNext: (logs: RudimentLog[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const services = getFirebase();
  const uid = userId();
  if (!services || !uid || !rudimentId) {
    onNext([]);
    return () => undefined;
  }
  return onSnapshot(
    query(
      collection(services.db, "users", uid, "rudiments", rudimentId, "logs"),
      orderBy("createdAt", "desc"),
    ),
    (snap) => {
      onNext(
        snap.docs.map((item) => {
          const data = item.data();
          const created = data.createdAt as { toMillis?: () => number } | undefined;
          const ease = Number(data.ease);
          return {
            id: item.id,
            ease: (ease >= 1 && ease <= 5 ? ease : 3) as Ease,
            note: typeof data.note === "string" ? data.note : "",
            createdAt: created?.toMillis?.() ?? 0,
          };
        }),
      );
    },
    (error) => onError?.(error),
  );
}
