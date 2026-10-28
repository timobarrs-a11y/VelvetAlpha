import { useMemo, useState } from 'react';
import { toast } from '../../shared/ui';
import { moderationAdmin, ModerationTerm, ModerationTier, ModerationTestResult } from '../../services/moderation';
import { ErrorBanner, Spinner, Empty, panel, btnNeutral, btnDanger, btnGood, inputClass, useLoad, act, ago } from './ui';

const TIER_STYLE: Record<ModerationTier, string> = {
  block: 'border-red-500/40 text-red-300 bg-red-500/10',
  flag: 'border-amber-500/40 text-amber-200 bg-amber-500/10',
};

function TierChip({ tier }: { tier: ModerationTier }) {
  return <span className={`px-2 py-0.5 rounded-full text-[11px] border ${TIER_STYLE[tier]}`}>{tier}</span>;
}

function TestBox() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ModerationTestResult | null>(null);
  const run = async () => {
    if (!text.trim()) return;
    try {
      setResult(await moderationAdmin.test(text));
    } catch (e) {
      setResult(null);
      toast.error(e instanceof Error ? e.message : 'Check failed');
    }
  };
  return (
    <div className={`${panel} p-4 mb-5`}>
      <p className="text-sm text-white/70 mb-2">Try a phrase</p>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={e => { setText(e.target.value); setResult(null); }}
          onKeyDown={e => { if (e.key === 'Enter') run(); }}
          placeholder="Type anything to see what would happen"
          className={`${inputClass} flex-1`}
        />
        <button className={btnNeutral} onClick={run}>Check</button>
      </div>
      {result && (
        <p className="text-sm mt-2">
          {result.action === 'allow'
            ? <span className="text-emerald-300">Allowed.</span>
            : <span className={result.action === 'block' ? 'text-red-300' : 'text-amber-200'}>
                {result.action === 'block' ? 'Blocked' : 'Allowed but flagged'} by &ldquo;{result.term}&rdquo; ({result.category}).
              </span>}
        </p>
      )}
    </div>
  );
}

function AddTermForm({ onAdded }: { onAdded: () => void }) {
  const [term, setTerm] = useState('');
  const [tier, setTier] = useState<ModerationTier>('block');
  const [category, setCategory] = useState('');
  const [anywhere, setAnywhere] = useState(false);
  const add = async () => {
    const ok = await act(`Added "${term.trim()}"`, () => moderationAdmin.addTerm({ term, tier, category, match_anywhere: anywhere }));
    if (ok) { setTerm(''); setAnywhere(false); onAdded(); }
  };
  return (
    <div className={`${panel} p-4 mb-5`}>
      <p className="text-sm text-white/70 mb-2">Add a word or phrase</p>
      <div className="flex flex-wrap gap-2 items-center">
        <input value={term} onChange={e => setTerm(e.target.value)} placeholder="word or phrase" className={`${inputClass} flex-1 min-w-[160px]`} />
        <select value={tier} onChange={e => setTier(e.target.value as ModerationTier)} className={inputClass}>
          <option value="block">Block</option>
          <option value="flag">Flag only</option>
        </select>
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="category (racial, homophobic...)" className={`${inputClass} w-56`} />
        <label className="flex items-center gap-1.5 text-xs text-white/60">
          <input type="checkbox" checked={anywhere} onChange={e => setAnywhere(e.target.checked)} />
          Match inside other words
        </label>
        <button className={btnGood} onClick={add} disabled={!term.trim()}>Add</button>
      </div>
      <p className="text-xs text-white/35 mt-2">
        Block refuses the post. Flag lets it through and lists it below, for words with innocent or reclaimed uses.
        Spelling tricks (n1gg3r, f a g, accents, repeated letters, plurals) are caught automatically.
      </p>
    </div>
  );
}

/** The hate-speech word bank: what's in it, and what it has flagged. */
export function WordBankSection() {
  const terms = useLoad(() => moderationAdmin.listTerms(), []);
  const hits = useLoad(() => moderationAdmin.recentHits(), []);
  const [busy, setBusy] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ModerationTerm[]>();
    for (const t of terms.data ?? []) map.set(t.category, [...(map.get(t.category) ?? []), t]);
    return [...map.entries()];
  }, [terms.data]);

  const change = async (t: ModerationTerm, label: string, fn: () => Promise<void>) => {
    setBusy(t.id);
    if (await act(label, fn)) await terms.reload();
    setBusy(null);
  };

  return (
    <>
      <TestBox />
      <AddTermForm onAdded={terms.reload} />

      <h3 className="text-white font-semibold mb-3">Flagged recently</h3>
      {hits.error && <ErrorBanner message={hits.error} />}
      {hits.loading && !hits.data ? <Spinner /> : (
        <div className="space-y-2 mb-8">
          {(hits.data ?? []).map(h => (
            <div key={h.id} className={`${panel} p-3 flex items-start gap-3`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/40 mb-1">
                  &ldquo;{h.term}&rdquo; · {h.category} · {h.source.replace(/_/g, ' ')} · {ago(h.created_at)}
                </p>
                <p className="text-sm text-white/75 break-words">{h.excerpt}</p>
              </div>
              <button className={btnNeutral} onClick={async () => { if (await act('Dismissed', () => moderationAdmin.dismissHit(h.id))) await hits.reload(); }}>
                Dismiss
              </button>
            </div>
          ))}
          {hits.data?.length === 0 && <Empty>Nothing flagged.</Empty>}
        </div>
      )}

      <h3 className="text-white font-semibold mb-3">Word bank ({terms.data?.length ?? 0})</h3>
      {terms.error && <ErrorBanner message={terms.error} />}
      {terms.loading && !terms.data ? <Spinner /> : grouped.map(([category, list]) => (
        <div key={category} className="mb-5">
          <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">{category}</p>
          <div className="space-y-1.5">
            {list.map(t => (
              <div key={t.id} className={`${panel} px-3 py-2 flex flex-wrap items-center gap-2 ${t.active ? '' : 'opacity-50'}`}>
                <span className="text-sm text-white font-mono">{t.term}</span>
                <TierChip tier={t.tier} />
                {t.match_anywhere && <span className="text-[11px] text-white/40">inside words too</span>}
                {t.note && <span className="text-[11px] text-white/35">{t.note}</span>}
                <div className="ml-auto flex gap-1.5">
                  <button disabled={busy === t.id} className={btnNeutral}
                    onClick={() => change(t, `"${t.term}" set to ${t.tier === 'block' ? 'flag' : 'block'}`, () => moderationAdmin.updateTerm(t.id, { tier: t.tier === 'block' ? 'flag' : 'block' }))}>
                    {t.tier === 'block' ? 'Flag only' : 'Block'}
                  </button>
                  <button disabled={busy === t.id} className={btnNeutral}
                    onClick={() => change(t, t.active ? `"${t.term}" paused` : `"${t.term}" on`, () => moderationAdmin.updateTerm(t.id, { active: !t.active }))}>
                    {t.active ? 'Pause' : 'Turn on'}
                  </button>
                  <button disabled={busy === t.id} className={btnDanger}
                    onClick={() => { if (window.confirm(`Remove "${t.term}" from the word bank?`)) change(t, `Removed "${t.term}"`, () => moderationAdmin.removeTerm(t.id)); }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
