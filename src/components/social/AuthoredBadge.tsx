import { PenLine } from 'lucide-react';

const SIZES = {
  xs: { box: 'gap-0.5 px-1 py-0.5 text-[9px]', icon: 'w-2 h-2' },
  sm: { box: 'gap-0.5 px-1.5 py-0.5 text-[10px]', icon: 'w-2.5 h-2.5' },
  md: { box: 'gap-1 px-2 py-0.5 text-xs', icon: 'w-3 h-3' },
} as const;

/** Marks a character Velvet writes, as opposed to a member. */
export function AuthoredBadge({ size = 'sm' }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-semibold ${s.box}`}
      title="Written by Velvet, not a member"
      aria-label="Authored: written by Velvet, not a member"
    >
      <PenLine className={s.icon} aria-hidden="true" />
      Authored
    </span>
  );
}
