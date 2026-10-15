import { useState, useRef, useEffect, useCallback } from 'react';
import { Smile, X, Search } from 'lucide-react';
import { SMILIES, REACTION_SMILIES } from '../../config/smilieRegistry';

interface SmiliePickerProps {
  onInsert: (code: string) => void;
  className?: string;
  buttonClassName?: string;
}

export function SmiliePicker({ onInsert, className, buttonClassName }: SmiliePickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFilter('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleInsert = useCallback(
    (code: string) => {
      onInsert(code);
    },
    [onInsert],
  );

  const filtered = filter.trim()
    ? SMILIES.filter(
        (s) =>
          s.code.includes(filter.toLowerCase()) ||
          s.label.toLowerCase().includes(filter.toLowerCase()),
      )
    : SMILIES;

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors ${buttonClassName ?? ''}`}
        title="Smilies"
        aria-label="Open smilie picker"
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden"
          style={{ width: 340, maxHeight: 380 }}
        >
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8">
            <Search className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search smilies..."
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/30 outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setFilter('');
              }}
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-y-auto p-2" style={{ maxHeight: 320 }}>
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-white/30 py-8">No smilies found.</p>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {filtered.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => handleInsert(s.code)}
                    className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-white/8 transition-colors group"
                    title={`:${s.code}: — ${s.label}`}
                  >
                    <img
                      src={`/smilies/${s.file}`}
                      alt={`:${s.code}:`}
                      style={{ height: 24, width: 'auto' }}
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-3 py-2 border-t border-white/8 text-[10px] text-white/25">
            Type <code className="text-white/40">:name:</code> in your text to insert inline
          </div>
        </div>
      )}
    </div>
  );
}

interface SmilieReactionPickerProps {
  onReact: (code: string) => void;
  className?: string;
}

export function SmilieReactionPicker({ onReact, className }: SmilieReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
        title="React with a smilie"
      >
        <Smile className="w-4 h-4" />
        <span>React</span>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 rounded-xl border border-white/10 bg-[#0d1117] shadow-2xl p-2"
          style={{ width: 'auto' }}
        >
          <div className="flex flex-wrap gap-1 max-w-[280px]">
            {REACTION_SMILIES.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => {
                  onReact(entry.code);
                  setOpen(false);
                }}
                className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 hover:scale-110 transition-all"
                title={`:${entry.code}: — ${entry.label}`}
              >
                <img
                  src={`/smilies/${entry.file}`}
                  alt={`:${entry.code}:`}
                  style={{ height: 22, width: 'auto' }}
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


