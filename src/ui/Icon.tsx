// A small authored icon set: 24px grid, 1.6 stroke, round caps. One weight everywhere.
const P: Record<string, React.ReactNode> = {
  'arrow-right': <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  'arrow-left': <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  'arrow-up-right': <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="1.5" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
};
export type IconName = keyof typeof P;
export function Icon({name, size = 18, className = ''}: {name: IconName; size?: number; className?: string}) {
  return (
    <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}
