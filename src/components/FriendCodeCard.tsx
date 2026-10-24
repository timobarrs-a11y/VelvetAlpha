import { useEffect, useState } from 'react';
import { Check, Copy, Link2, UserPlus } from 'lucide-react';
import {
  addFriendByCode, formatFriendCode, friendCodeLink, getMyFriendCode,
  type AddByCodeResult, type FriendCodeMatch,
} from '../shared/supabase/queries/messaging';

const RESULT_TEXT: Record<AddByCodeResult['kind'], (name?: string) => string> = {
  invalid: () => 'Friend codes are 8 digits.',
  not_found: () => 'No one has that code.',
  self: () => "That's your own code.",
  friends: (n) => `You and ${n} are already friends. Opening your chat.`,
  accepted: (n) => `${n} had already asked. You're friends now.`,
  requested: (n) => `Friend request sent to ${n}.`,
  already_requested: (n) => `You've already sent ${n} a request.`,
};

interface Props {
  /** Open a chat once you're friends. */
  onOpenChat: (peer: FriendCodeMatch) => void;
  /** Something changed (request sent or accepted): refresh lists. */
  onChanged: () => void;
  /** Prefill and submit, e.g. from an /add/<code> link. */
  initialCode?: string | null;
}

/** Your friend code to share, and a box to add someone by theirs. */
export function FriendCodeCard({ onOpenChat, onChanged, initialCode }: Props) {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  useEffect(() => { getMyFriendCode().then(setMyCode); }, []);

  const submit = async (value: string) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await addFriendByCode(value);
      const name = 'peer' in result ? result.peer.display_name : undefined;
      setMessage(RESULT_TEXT[result.kind](name));
      if (result.kind === 'friends' || result.kind === 'accepted') onOpenChat(result.peer);
      if (result.kind === 'requested' || result.kind === 'accepted') { setCode(''); onChanged(); }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initialCode) submit(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const copy = async (what: 'code' | 'link') => {
    if (!myCode) return;
    const text = what === 'code' ? myCode : friendCodeLink(myCode);
    try {
      if (what === 'link' && navigator.share) await navigator.share({ title: 'Add me on Velvet', url: text });
      else await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* share cancelled */ }
  };

  return (
    <div className="mx-3 my-2 space-y-2.5 rounded-xl border border-yellow-300/20 bg-yellow-300/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-yellow-200/70">Your friend code</p>
          <p className="font-mono text-lg font-semibold tracking-widest text-yellow-200">{myCode ? formatFriendCode(myCode) : '…'}</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => copy('code')} disabled={!myCode} className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-ink hover:bg-white/10 disabled:opacity-40" title="Copy code">
            {copied === 'code' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
          </button>
          <button type="button" onClick={() => copy('link')} disabled={!myCode} className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-[11px] text-ink hover:bg-white/10 disabled:opacity-40" title="Share a link that adds you">
            {copied === 'link' ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />} Link
          </button>
        </div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); submit(code); }} className="flex gap-1.5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="Add a friend by code"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-sm tracking-widest text-ink placeholder:font-sans placeholder:tracking-normal placeholder:text-ink-muted/60 focus:border-yellow-300/40 focus:outline-none"
        />
        <button type="submit" disabled={busy || code.replace(/\D/g, '').length !== 8} className="flex items-center gap-1 rounded-lg bg-yellow-300/90 px-3 py-2 text-xs font-semibold text-[#2a1424] hover:bg-yellow-300 disabled:opacity-40">
          <UserPlus className="h-3.5 w-3.5" /> Add
        </button>
      </form>
      {message && <p className="text-xs text-ink-muted">{message}</p>}
    </div>
  );
}
