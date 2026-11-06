import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase", () => ({
  getFirebase: () => ({ db: {}, auth: { currentUser: { uid: "test-user" } } }),
}));
vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  doc: (...parts: unknown[]) => parts.slice(1).join("/"),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: () => "timestamp",
  setDoc: vi.fn(),
}));

import { addDoc, runTransaction } from "firebase/firestore";
import { addRudimentLog, recordPracticeSeconds } from "@/lib/progress-store";
import { clearStorageError, getStorageError } from "@/lib/storage-errors";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  clearStorageError();
});

describe("progress persistence", () => {
  it("reports a failed save and returns failure to the form", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(addDoc).mockRejectedValueOnce(new Error("permission-denied"));
    const saved = await addRudimentLog("herta", {
      ease: 3, note: "Keep this note", startBpm: 80, endBpm: 100,
    });
    expect(saved).toBe(false);
    expect(getStorageError()).toBe("The log could not be saved.");
  });

  it("accumulates time in the nested rudiment map and credits five minutes", async () => {
    const set = vi.fn();
    const get = vi.fn().mockResolvedValueOnce({
      data: () => ({ seconds: 350, rudiments: { herta: 290, cheese: 60 } }),
    }).mockResolvedValueOnce({ data: () => ({ totalSeconds: 500 }) });
    vi.mocked(runTransaction).mockImplementationOnce(async (_db, update) =>
      update({ get, set } as never));
    expect(await recordPracticeSeconds("herta", 10)).toBe(true);
    expect(set.mock.calls[0]?.[1]).toEqual({
      seconds: 360, counted: true, rudiments: { herta: 300 },
    });
    expect(set.mock.calls[1]?.[1].totalSeconds).toBe(510);
  });
});
