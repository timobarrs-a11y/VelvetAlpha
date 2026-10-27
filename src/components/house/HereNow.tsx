import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { getSpaceMembers } from '../../services/spacesService';
import { getUserMedals, type UserMedal } from '../../services/medalsService';
import { MedalBadge } from '../medals/MedalBadge';
import type { SpaceMember } from '../../types/spaces';

interface Props {
  boardId: string;
  myDisplayName: string;
}

interface PresenceEntry {
  userId: string;
  name: string;
}

export function HereNow({ boardId, myDisplayName }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hereNow, setHereNow] = useState<PresenceEntry[]>([]);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [medalCache, setMedalCache] = useState<Record<string, UserMedal | null>>({});

  useEffect(() => {
    getSpaceMembers(boardId).then(setMembers).catch(() => {});
  }, [boardId]);

  useEffect(() => {
    if (members.length === 0) return;
    members.forEach(m => {
      if (medalCache[m.user_id] !== undefined) return;
      getUserMedals(m.user_id)
        .then(medals => {
          const showcase = medals.find(md => md.showcase_slot === 1) ?? null;
          setMedalCache(prev => ({ ...prev, [m.user_id]: showcase }));
        })
        .catch(() => {});
    });
  }, [members, medalCache]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`space-presence-${boardId}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ display_name: string }>();
        setHereNow(
          Object.entries(state).map(([userId, metas]) => ({
            userId,
            name: metas[0]?.display_name ?? 'Member',
          })),
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ display_name: myDisplayName });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [boardId, user, myDisplayName]);

  const hereNowIds = new Set(hereNow.map(h => h.userId));
  const onlineMembers = members.filter(m => hereNowIds.has(m.user_id));
  const offlineMembers = members.filter(m => !hereNowIds.has(m.user_id));
  const sorted = [...onlineMembers, ...offlineMembers];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {hereNow.slice(0, 5).map(p => (
              <span
                key={p.userId}
                className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 border-2 border-[var(--ds-surface-2)] flex items-center justify-center text-[10px] text-white font-bold"
                title={p.name}
              >
                {p.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
          <span className="text-xs text-ink-muted">
            {hereNow.length} here now
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-muted/60 font-semibold px-2 py-1.5">Members</p>
        {sorted.map(member => (
          <button
            type="button"
            key={member.user_id}
            onClick={() => navigate(member.user_id === user?.id ? '/my-profile' : `/member/${member.user_id}`)}
            title={`View ${member.display_name}'s profile`}
            aria-label={`View ${member.display_name}'s profile`}
            className="flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left hover:bg-white/5 transition-colors"
          >
            <span className="relative flex-shrink-0">
              <span className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-[11px] text-white font-bold">
                {member.display_name.charAt(0).toUpperCase()}
              </span>
              {hereNowIds.has(member.user_id) && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[var(--ds-surface-2)]" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink truncate">{member.display_name}</span>
                {member.is_bot && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">AI</span>
                )}
                {medalCache[member.user_id] && (
                  <MedalBadge icon={(medalCache[member.user_id] as UserMedal).icon} tier={(medalCache[member.user_id] as UserMedal).tier as any} size="sm" />
                )}
              </div>
              <span className="text-[10px] text-ink-muted">
                {member.role === 'owner' ? 'Owner' : member.role === 'mod' ? 'Moderator' : 'Member'}
              </span>
            </div>
          </button>
        ))}
        {members.length === 0 && (
          <p className="text-xs text-ink-muted text-center py-4">No members yet.</p>
        )}
      </div>
    </div>
  );
}
