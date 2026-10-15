import { ReactNode, useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '../../shared/ui';

export const panel = 'rounded-2xl border border-white/10 bg-white/[0.04]';
export const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed';
export const btnNeutral = `${btn} border-white/15 text-white/70 hover:bg-white/10 hover:text-white`;
export const btnDanger = `${btn} border-red-500/40 text-red-300 hover:bg-red-500/15`;
export const btnGood = `${btn} border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15`;
export const inputClass = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-white/45 text-sm mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {message}
    </div>
  );
}

export function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-white/40 animate-spin" /></div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-white/35 text-sm py-8 text-center">{children}</p>;
}

/** Load data on mount and whenever `deps` change; exposes reload(). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await run());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [run]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload };
}

/** Run a mutation, toast the outcome, and return whether it succeeded. */
export async function act(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    toast.success(label);
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Action failed');
    return false;
  }
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
