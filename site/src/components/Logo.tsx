/**
 * The Frontend Field Guide logo: a bug with a path from the bug (hollow dot) to the fix (mint dot).
 * Drawn inline so it follows the site's own light/dark toggle, not only the OS setting.
 * Source files: public/logo/frontend-field-guide-logo.svg and frontend-field-guide-mark.svg (favicon).
 */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 128 128" aria-hidden focusable="false">
      <g fill="none" stroke="var(--primary)" strokeWidth={5} strokeLinecap="round">
        <path d="M58 25 C54 16 48 12 41 11" />
        <path d="M70 25 C74 16 80 12 87 11" />
      </g>
      <ellipse cx="64" cy="33" rx="13" ry="9.5" fill="var(--primary)" />
      <path d="M64 46 C88 46 97 63 97 82 C97 104 82 118 64 118 C46 118 31 104 31 82 C31 63 40 46 64 46 Z" fill="var(--primary)" />
      <path d="M64 59 C90 70 38 92 64 105" fill="none" stroke="var(--mint)" strokeWidth={5} strokeLinecap="round" />
      <circle cx="64" cy="59" r="5" fill="var(--primary)" stroke="var(--mint)" strokeWidth={4} />
      <circle cx="64" cy="105" r="6" fill="var(--mint)" />
    </svg>
  );
}
