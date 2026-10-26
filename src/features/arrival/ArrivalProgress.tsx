const STEPS = ['You', 'Your look', 'Your home', 'Your goals'] as const;

/**
 * The strip across the top of the first session, so it reads as one arrival
 * rather than a series of forms: You · Your look · Your home · Your goals.
 */
export function ArrivalProgress({ step, accent }: { step: 0 | 1 | 2 | 3; accent?: string }) {
  const tone = accent ?? '#f43f5e';
  return (
    <ol className="mx-auto flex w-full max-w-md gap-1.5" aria-label="Your arrival">
      {STEPS.map((label, i) => (
        <li key={label} className="flex-1" aria-current={i === step ? 'step' : undefined}>
          <div className="h-1 rounded-full" style={{ background: i <= step ? tone : 'rgba(255,255,255,0.12)' }} />
          <span
            className="mt-1.5 block text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: i === step ? '#fff' : 'rgba(255,255,255,0.45)' }}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}
