// Single-weight line icons (2px stroke, Lucide geometry). Decorative by default: give the
// surrounding button an aria-label, or pass `label` when the icon carries meaning on its own.
import type { ReactNode } from 'react';

function Svg({ size = 16, label, children }: { size?: number; label?: string; children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className="icon"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

type P = { size?: number; label?: string };

export const CheckIcon = (p: P) => <Svg {...p}><path d="M20 6 9 17l-5-5" /></Svg>;
export const MenuIcon = (p: P) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const XIcon = (p: P) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const ArrowRightIcon = (p: P) => <Svg {...p}><path d="M5 12h14M12 5l7 7-7 7" /></Svg>;
export const MoonIcon = (p: P) => <Svg {...p}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></Svg>;
export const SunIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </Svg>
);
