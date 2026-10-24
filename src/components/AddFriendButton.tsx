import { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';

/** Add a friend by their 8-digit code: a pink button with a small form that drops down. */
export function AddFriendButton({ onAdd }: { onAdd: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const digits = code.replace(/\D/g, '');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digits.length !== 8) return;
    onAdd(digits);
    setCode('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-lg bg-pink-500 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-pink-600"
        aria-expanded={open}
        aria-label="Add a friend"
        title="Add a friend by their friend code"
      >
        <UserPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add friend</span>
      </button>
      {open && (
        <form onSubmit={submit} className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#f5cfe0] bg-white p-3 text-[#2a1424] shadow-xl">
          <label className="block text-[11px] font-semibold text-[#2a1424]/70" htmlFor="dock-add-friend">Their friend code</label>
          <input
            id="dock-add-friend"
            autoFocus
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d\s-]/g, '').slice(0, 10))}
            placeholder="1234 5678"
            className="mt-1 w-full rounded-lg border border-[#2a1424]/15 px-2.5 py-1.5 font-mono text-sm tracking-widest outline-none focus:border-pink-400"
          />
          <p className="mt-1.5 text-[10px] text-[#2a1424]/55">Sends a friend request. Once they accept, you can chat and play.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2.5 py-1 text-xs text-[#2a1424]/60 hover:bg-pink-50">Cancel</button>
            <button type="submit" disabled={digits.length !== 8} className="rounded-lg bg-pink-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Add</button>
          </div>
        </form>
      )}
    </div>
  );
}
