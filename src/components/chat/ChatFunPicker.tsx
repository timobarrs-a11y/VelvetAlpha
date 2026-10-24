import { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { SMILIES } from '../../config/smilieRegistry';

// Standard Unicode emoji: drawn by each device's own emoji font, free to use.
const EMOJI = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '😎', '🤩', '🥳', '😏',
  '😴', '🤔', '🙄', '😬', '😅', '😭', '😤', '😡', '🤯', '😱', '🥺', '😇',
  '🤗', '🤭', '🫶', '👍', '👎', '👏', '🙌', '🙏', '💪', '👀', '✌️', '🤞',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💯', '🔥', '✨',
  '⭐', '🌈', '☀️', '🌙', '🎉', '🎁', '🎮', '♟️', '🎨', '🎵', '🍕', '🍔',
  '🍟', '🍩', '☕', '🍷', '🍻', '🌹', '🐶', '🐱', '🦋', '👻', '💀', '🤡',
];

/** AIM-style: a smile button opening Velvet smilies and emoji, inserted into the message. */
export function ChatFunPicker({ onInsert }: { onInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'smilies' | 'emoji'>('smilies');
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`p-2 rounded-lg transition-colors ${open ? 'text-amber-300 bg-white/10' : 'text-ink-muted hover:text-amber-300 hover:bg-white/5'}`}
        title="Smilies and emoji"
        aria-label="Smilies and emoji"
        aria-expanded={open}
      >
        <Smile className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl">
          <div className="flex border-b border-white/8 text-xs font-semibold">
            {(['smilies', 'emoji'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 capitalize ${tab === t ? 'text-amber-300 border-b-2 border-amber-300' : 'text-white/50 hover:text-white/80'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="max-h-[260px] overflow-y-auto p-2">
            {tab === 'smilies' ? (
              <div className="grid grid-cols-7 gap-1">
                {SMILIES.map(s => (
                  <button key={s.code} type="button" onClick={() => onInsert(`:${s.code}:`)} className="flex h-10 items-center justify-center rounded-lg hover:bg-white/8" title={`:${s.code}:`}>
                    <img src={`/smilies/${s.file}`} alt={`:${s.code}:`} style={{ height: 24, width: 'auto' }} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {EMOJI.map(e => (
                  <button key={e} type="button" onClick={() => onInsert(e)} className="flex h-9 items-center justify-center rounded-lg text-xl hover:bg-white/8">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
