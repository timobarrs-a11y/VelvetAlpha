import { useEffect, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react';

/** Add a friend by their 8-digit code, next to Friends HQ (people live in the dock). */
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
        className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${open ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-[#2a1424]/12 bg-white text-pink-600 hover:bg-pink-50'}`}
        aria-expanded={open}
        aria-label="Add a friend"
        title="Add a friend by their friend code"
      >
        <UserPlus className="h-4 w-4" />
      </button>
      {open && (
        <form onSubmit={submit} className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-[#f5cfe0] bg-white p-3 text-[#2a1424] shadow-xl">
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
