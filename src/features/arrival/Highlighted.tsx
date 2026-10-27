import { Fragment } from 'react';

/** The colour of Plans, Coaches and Goals, as on the splash page. */
export const PLAN_COLOR = '#34d399';

/** Bolds and colours feature words (like "plan") wherever they appear in a line of text. */
export function Highlighted({ text, words, color = PLAN_COLOR }: { text: string; words: string[]; color?: string }) {
  if (words.length === 0) return <>{text}</>;
  const pattern = new RegExp(`\\b(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) => (
        i % 2 === 1
          ? <b key={i} style={{ color }}>{part}</b>
          : <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
