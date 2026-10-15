import { useState } from 'react';
import { Plus, X, BarChart3 } from 'lucide-react';

interface PollCreatorProps {
  onPollChange: (poll: { question: string; options: string[] } | null) => void;
}

export function PollCreator({ onPollChange }: PollCreatorProps) {
  const [enabled, setEnabled] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const updateOption = (idx: number, value: string) => {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
    emit(next, question);
  };

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, '']);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== idx);
    setOptions(next);
    emit(next, question);
  };

  const emit = (opts: string[], q: string) => {
    const cleanOpts = opts.map((o) => o.trim()).filter(Boolean);
    if (q.trim() && cleanOpts.length >= 2) {
      onPollChange({ question: q.trim(), options: cleanOpts });
    } else {
      onPollChange(null);
    }
  };

  if (!enabled) {
    return (
      <button
        type="button"
        onClick={() => setEnabled(true)}
        className="flex items-center gap-2 text-xs text-white/40 hover:text-sky-400 transition-colors px-3 py-2 rounded-lg border border-white/8 hover:border-sky-500/20"
      >
        <BarChart3 className="w-3.5 h-3.5" />
        Add a poll
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold text-white/60">
          <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
          Poll
        </span>
        <button
          type="button"
          onClick={() => {
            setEnabled(false);
            setQuestion('');
            setOptions(['', '']);
            onPollChange(null);
          }}
          className="text-white/25 hover:text-red-400 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={question}
        onChange={(e) => {
          setQuestion(e.target.value);
          emit(options, e.target.value);
        }}
        placeholder="Ask a question..."
        maxLength={200}
        className="w-full bg-transparent text-sm text-white/80 placeholder-white/30 outline-none border-b border-white/8 pb-2 focus:border-sky-500/30 transition-colors"
      />
      <div className="flex flex-col gap-2">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-xs text-white/30 font-mono w-5 flex-shrink-0">
              {String.fromCharCode(65 + idx)}
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              maxLength={100}
              className="flex-1 bg-white/[0.03] text-sm text-white/80 placeholder-white/25 outline-none rounded-lg px-3 py-2 border border-white/8 focus:border-white/15 transition-colors"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(idx)}
                className="text-white/20 hover:text-red-400 transition-colors p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {options.length < 6 && (
          <button
            type="button"
            onClick={addOption}
            className="flex items-center gap-1 text-xs text-white/40 hover:text-sky-400 transition-colors mt-1"
          >
            <Plus className="w-3 h-3" />
            Add option
          </button>
        )}
      </div>
    </div>
  );
}
