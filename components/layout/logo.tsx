/**
 * The NextBudget mark: a tirelire — piggy bank body, snout, ear, trotters, and
 * a coin going into the slot.
 *
 * Inline rather than an <img> so it inherits `currentColor` and works on the
 * dark sidebar and a light page alike; `public/logo.svg` is the fixed-colour
 * lockup for the README.
 *
 * The slot is a hole carved out of the body with `evenodd` rather than a shape
 * painted over it — painting would need a background colour, and this mark has
 * to sit on more than one.
 */
export function LogoMark({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 302 302"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="145" cy="40" r="26" />
      <path d="M92 106 L136 74 L142 118 Z" />
      <rect x="64" y="230" width="36" height="42" rx="12" />
      <rect x="190" y="230" width="36" height="42" rx="12" />
      <ellipse cx="248" cy="174" rx="32" ry="27" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M37 172a108 80 0 1 0 216 0a108 80 0 1 0-216 0Z
           M115 124h60a9 9 0 0 1 0 18h-60a9 9 0 0 1 0-18Z"
      />
    </svg>
  );
}
