import { Copy } from 'lucide-react';
import { UNLOCK_CODES } from '../../games/velvet-house/state/unlockCodes';
import { catalogById } from '../../games/velvet-house/state/catalog';
import { fetchPromoStats } from '../../services/promoCodesService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, btnNeutral, useLoad, ago } from './ui';
import { toast } from '../../shared/ui';

/** The promo codes in the game, ready to hand out, with how much each has been used. */
export function AdminPromoCodesPage() {
  const { data, error, loading } = useLoad(fetchPromoStats, []);
  const stats = new Map((data ?? []).map(s => [s.code, s]));
  const codes = Object.entries(UNLOCK_CODES);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copied ${code}`);
    } catch {
      toast.error('Could not copy. Select the code and copy it by hand.');
    }
  };

  return (
    <>
      <PageHeader
        title="Promo codes"
        subtitle="Codes for the Velvet Sims promo packs. Give one to a player: they say it to their companion in the game, or type it on the start menu's Cheats screen. Once an account redeems a code, every house on that account has the packs. There's no limit on how many accounts use a code."
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : (
        <div className="space-y-3">
          {codes.map(([code, c]) => {
            const s = stats.get(code);
            const sets = c.setIds.map(id => catalogById(id)).filter(Boolean);
            const pieces = sets.reduce((n, set) => n + (set!.set?.items.length ?? 0), 0);
            return (
              <div key={code} className={`${panel} p-5`}>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="text-lg font-bold text-white tracking-wide select-all">{code}</code>
                  <button className={`${btnNeutral} inline-flex items-center gap-1.5`} onClick={() => copy(code)}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <span className="ml-auto text-xs text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">Active</span>
                </div>
                <p className="text-sm text-white/80 mt-3 font-medium">{c.packName}</p>
                <p className="text-xs text-white/45 mt-0.5">
                  {sets.map(set => set!.name).join(' + ')} · {pieces} pieces, free
                </p>
                <div className="mt-4 flex flex-wrap gap-6 text-xs text-white/50">
                  <span><span className="text-white text-base font-semibold mr-1">{s?.accounts ?? 0}</span> {s?.accounts === 1 ? 'account has' : 'accounts have'} used it</span>
                  <span>Last used {s?.last_used ? ago(s.last_used) : 'never'}</span>
                </div>
                {s && s.recent.length > 0 && (
                  <p className="mt-2 text-xs text-white/40">
                    Latest: {s.recent.map(r => `${r.name} (${ago(r.at)})`).join(', ')}
                  </p>
                )}
              </div>
            );
          })}
          {codes.length === 0 && <Empty>No promo codes yet.</Empty>}
          {(data ?? []).filter(s => !(s.code in UNLOCK_CODES)).map(s => (
            <div key={s.code} className={`${panel} p-5 opacity-60`}>
              <div className="flex items-center gap-3">
                <code className="text-white">{s.code}</code>
                <span className="ml-auto text-xs text-white/40 border border-white/15 rounded-full px-2 py-0.5">Retired</span>
              </div>
              <p className="text-xs text-white/45 mt-2">No longer in the game. Used by {s.accounts} {s.accounts === 1 ? 'account' : 'accounts'}, last {ago(s.last_used)}.</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-white/35 mt-6">
        To add a code, mark the pack promo in the game's catalog and add a line to <code>state/unlockCodes.ts</code>.
      </p>
    </>
  );
}
