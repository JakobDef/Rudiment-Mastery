"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/account/auth-provider";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/", label: "Metronome" },
  { href: "/practice", label: "Practice" },
  { href: "/gauntlet", label: "Pad Gauntlet" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { configured, ready, user, signIn, signOutUser } = useAuth();

  return (
    <header className="border-b border-line bg-panel">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-3 font-semibold text-ink">Rudiment Mastery</span>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "rounded-full bg-accent px-3 py-1 text-sm font-medium text-canvas-ink"
                  : "rounded-full px-3 py-1 text-sm text-muted"
              }
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {ready && configured && user ? (
            <>
              <span className="max-w-36 truncate text-sm text-muted">{user.displayName}</span>
              <Button tone="quiet" onClick={() => void signOutUser()}>
                Sign out
              </Button>
            </>
          ) : null}
          {ready && configured && !user ? (
            <Button tone="quiet" onClick={() => void signIn()}>
              Sign in
            </Button>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
