"use client";

import { Suspense } from "react";
import { PeriodSelector } from "./period-selector";
import { ThemeToggle } from "./theme-toggle";

export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        {title && <h1 className="text-base font-semibold">{title}</h1>}
      </div>
      <div className="flex items-center gap-3">
        <Suspense fallback={null}>
          <PeriodSelector />
        </Suspense>
        <ThemeToggle />
      </div>
    </header>
  );
}
