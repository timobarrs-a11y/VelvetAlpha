import { useEffect, useState } from 'react';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { pairKey, todaysPair, type TasteCard, type TastePicks } from './thisOrThat';

/** One "this or that" a day, at the top of the feed. Gone once they've answered them all. */
export function ThisOrThatCard() {
  const { user } = useAuth();
  const userId = user?.id;
  const [picks, setPicks] = useState<TastePicks | null>(null);
  const [card, setCard] = useState<TasteCard | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    supabase.from('user_profiles').select('taste_picks').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        const saved = (data?.taste_picks ?? {}) as TastePicks;
        setPicks(saved);
        setCard(todaysPair(saved));
      });
    return () => { live = false; };
  }, [userId]);

  if (!userId || !picks || !card) return null;

  const pick = async (label: string) => {
    setChosen(label);
    const next = { ...picks, [pairKey(card)]: label };
    setPicks(next);
    await supabase.from('user_profiles').update({ taste_picks: next }).eq('id', userId);
  };

  const option = (label: string) => (
    <button
      type="button"
      onClick={() => pick(label)}
      disabled={!!chosen}
      className="flex-1 rounded-xl px-3 py-3 text-sm font-semibold transition-colors"
      style={{
        background: chosen === label ? 'var(--ds-accent)' : 'var(--ds-pill-bg)',
        border: '1px solid var(--ds-pill-border)',
        color: chosen === label ? 'white' : 'var(--ds-ink)',
        opacity: chosen && chosen !== label ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );

  return (
    <section aria-label="This or that" className="mb-6 rounded-2xl p-4" style={{ background: 'var(--ds-surface-1)', border: '1px solid var(--ds-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ds-ink-3)' }}>This or that</p>
      <div className="mt-3 flex items-center gap-2">
        {option(card.left.label)}
        <span className="text-xs" style={{ color: 'var(--ds-ink-3)' }}>or</span>
        {option(card.right.label)}
      </div>
      {chosen && <p className="mt-2 text-xs" style={{ color: 'var(--ds-ink-3)' }}>Noted. Your companions will know.</p>}
    </section>
  );
}
