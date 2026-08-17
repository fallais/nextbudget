/**
 * The BanqueJS mark: a neoclassical bank façade — pediment, three columns,
 * plinth. Inline rather than an <img> so it inherits `currentColor` and works
 * in both themes; `public/logo.svg` is the fixed-colour lockup for README and
 * anywhere outside the app.
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
      <path
        d="M151 6 L292 92 H10 Z"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinejoin="round"
      />
      {[25, 122, 219].map((x) => (
        <g key={x}>
          <rect x={x} y="120" width="58" height="18" rx="6" />
          <rect x={x + 12} y="134" width="34" height="114" rx="4" />
          <rect x={x} y="242" width="58" height="18" rx="6" />
        </g>
      ))}
      <rect x="0" y="280" width="302" height="22" rx="11" />
    </svg>
  );
}

/**
 * The full lockup: mark left, wordmark right — the same arrangement as
 * `public/logo.svg`, but built from theme tokens so it stays legible on the
 * dark sidebar, where the original navy would disappear.
 */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="size-6 shrink-0 text-brand" />
      <span className="text-[17px] font-bold tracking-tight text-brand">
        Banque<span className="text-brand-accent">JS</span>
      </span>
    </span>
  );
}
