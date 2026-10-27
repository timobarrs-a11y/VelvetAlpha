import { useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '../../components/Avatar';
import type { AvatarConfigV2 } from '../../types/avatar-v2';

interface Props {
  name: string;
  kind: 'coach' | 'assistant';
  domain: string;
  avatarConfig: AvatarConfigV2;
  text: string;
  busy: boolean;
  /** True once they've been created, so their look can be changed. */
  created: boolean;
  onContinue: () => void;
  /** Leave these out and the card is just an introduction: ready-made helpers aren't redesigned here. */
  onChangeAnything?: () => void;
  onChangeLook?: () => void;
  onRename?: (name: string) => void;
  onRefine?: () => void;
}

/**
 * "Meet Maya, your assistant." Their look and name are randomized; most people
 * just continue, and anyone who wants to can change everything.
 */
export function MeetCard({
  name, kind, domain, avatarConfig, text, busy, created,
  onContinue, onChangeAnything, onChangeLook, onRename, onRefine,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const role = kind === 'coach' ? 'coach' : 'assistant';

  const startEditing = () => {
    setDraftName(name);
    setEditing(true);
    onChangeAnything?.();
  };

  const finishEditing = () => {
    const next = draftName.trim();
    if (next && next !== name) onRename?.(next);
    setEditing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl p-4 sm:p-5"
      style={{ background: 'var(--shell-surface)', border: '1px solid var(--shell-border-strong)' }}
    >
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ background: 'var(--shell-accent-soft)' }}>
          <Avatar config={avatarConfig} className="h-full w-full" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--shell-accent)' }}>
            Meet your {role}
          </p>
          <h3 className="text-xl font-bold" style={{ color: 'var(--shell-text-primary)', fontFamily: 'var(--shell-display-font)' }}>{name}</h3>
          <p className="text-xs" style={{ color: 'var(--shell-text-muted)' }}>{domain}</p>
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed" style={{ color: 'var(--shell-text-primary)' }}>{text}</p>

      {editing ? (
        <div className="mt-4 space-y-3">
          <label className="block text-xs" style={{ color: 'var(--shell-text-muted)' }}>
            Their name
            <input
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              maxLength={40}
              className="mt-1 block w-full rounded-lg bg-transparent px-3 py-2 text-sm"
              style={{ border: '1px solid var(--shell-border)', color: 'var(--shell-text-primary)' }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onChangeLook?.()} disabled={!created} className="rounded-xl px-3.5 py-2 text-sm disabled:opacity-50" style={{ border: '1px solid var(--shell-border)', color: 'var(--shell-text-primary)' }}>
              {created ? 'Change their look' : 'Getting them ready…'}
            </button>
            <button type="button" onClick={finishEditing} className="rounded-xl px-3.5 py-2 text-sm font-semibold" style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onContinue} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60" style={{ background: 'var(--shell-accent)', color: 'var(--shell-bg)' }}>
            Continue
          </button>
          {onChangeAnything && (
            <button type="button" onClick={startEditing} disabled={busy} className="rounded-xl px-4 py-2 text-sm disabled:opacity-60" style={{ border: '1px solid var(--shell-border)', color: 'var(--shell-text-primary)' }}>
              Change anything
            </button>
          )}
          {!created && onRefine && (
            <button type="button" onClick={onRefine} disabled={busy} className="ml-auto text-xs disabled:opacity-60" style={{ color: 'var(--shell-text-muted)' }}>
              Not quite the goal
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
