import { Suspense, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <Suspense fallback={<div className="h-14 border-b border-line bg-panel" />}>
        <AppNav />
      </Suspense>
      {children}
    </div>
  );
}
