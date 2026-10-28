"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebase, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { creditPracticeDay } from "@/lib/progress-store";

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
        await creditPracticeDay("2026-10-26");
      } catch {
        return;
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
