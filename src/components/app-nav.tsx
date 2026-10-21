"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Metronome" },
  { href: "/practice", label: "Practice" },
  { href: "/gauntlet", label: "Pad Gauntlet" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-panel">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3">
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
      </nav>
    </header>
  );
}
