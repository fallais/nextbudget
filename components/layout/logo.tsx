/**
 * The NextBudget mark: a tirelire — piggy bank body, snout, ear, trotters, and
 * a coin going into the slot.
 *
 * Inline rather than an <img> so it inherits `currentColor` and works in both
 * themes; `public/logo.svg` is the fixed-colour lockup for the README and
 * anywhere outside the app.
 *
 * Drawn on the same 302×302 grid the old mark used, so every existing size
 * class still frames it correctly. The slot is a hole carved out of the body
 * with `evenodd` rather than a shape painted over it — painting would need a
 * background colour, and the mark has to sit on the dark sidebar and a light
 * page alike.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 302 302"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {/* The coin, dropping in. */}
      <circle cx="145" cy="40" r="26" />
      {/* Ear. */}
      <path d="M92 106 L136 74 L142 118 Z" />
      {/* Trotters. */}
      <rect x="64" y="230" width="36" height="42" rx="12" />
      <rect x="190" y="230" width="36" height="42" rx="12" />
      {/* Snout. */}
      <ellipse cx="248" cy="174" rx="32" ry="27" />
      {/* Body, with the coin slot carved out. */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M37 172a108 80 0 1 0 216 0a108 80 0 1 0-216 0Z
           M115 124h60a9 9 0 0 1 0 18h-60a9 9 0 0 1 0-18Z"
      />
    </svg>
  );
}

/**
 * The full lockup: mark left, wordmark right — the same arrangement as
 * `public/logo.svg`, but built from theme tokens so it stays legible on the
 * dark sidebar, where the fixed navy would disappear.
 */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="size-6 shrink-0 text-brand" />
      <span className="text-[17px] font-bold tracking-tight text-brand">
        Next<span className="text-brand-accent">Budget</span>
      </span>
    </span>
  );
}
