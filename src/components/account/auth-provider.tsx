"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { clearStorageError, getStorageError, reportStorageError, subscribeStorageError } from "@/lib/storage-errors";

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  user: User | null;
  error: string | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const storageError = useSyncExternalStore(subscribeStorageError, getStorageError, () => null);
  const configured = isFirebaseConfigured();
  const [ready, setReady] = useState(!configured);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = getFirebase();
    if (!services) return;
    return onAuthStateChanged(services.auth, async (next) => {
      setUser(next);
      setReady(true);
      if (!next) return;
      try {
        await setDoc(
          doc(services.db, "users", next.uid),
          {
            displayName: next.displayName ?? "",
            photoURL: next.photoURL ?? "",
            lastSeenAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (error) {
        reportStorageError("Your profile could not be saved.", error);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      ready,
      user,
      error,
      async signIn() {
        const services = getFirebase();
        if (!services) {
          setError("Sign in is not connected yet.");
          return;
        }
        setError(null);
        try {
          await signInWithPopup(services.auth, googleProvider());
        } catch {
          setError("Google sign in was cancelled or blocked.");
        }
      },
      async signOutUser() {
        const services = getFirebase();
        if (!services) return;
        setError(null);
        await signOut(services.auth);
      },
    }),
    [configured, ready, user, error],
  );

  return (
    <AuthContext.Provider value={value}>
      {storageError ? (
        <div role="alert" className="flex items-center justify-between gap-3 border-b border-accent bg-panel px-4 py-3 text-sm text-accent">
          <span>{storageError} Check your connection and try again.</span>
          <button type="button" onClick={clearStorageError} className="shrink-0 underline">Dismiss</button>
        </div>
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    return {
      configured: false,
      ready: true,
      user: null,
      error: null,
      async signIn() {},
      async signOutUser() {},
    };
  }
  return value;
}
