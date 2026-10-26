import { useRef, useEffect, useState, type ReactNode } from 'react';
import { X, Footprints, Users, Flame, Award, UserPlus, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  resolvePlot, houseInfo, MEDALS, TIER_COLORS, glyph,
  type Plot, type ResolvedPlot,
} from './art/streetArt';
import { sendFriendRequest, getFriends, getOutgoingRequests, type FriendPeer } from '../../shared/supabase/queries/messaging';
import { getCardDetails, recordVisit, type CardDetails } from '../../services/worldService';
import { Avatar } from '../../components/Avatar';

interface BillboardCardProps {
  plot: Plot;
  isYou: boolean;
  onClose: () => void;
  onCustomize: () => void;
  /** Your main companion: "Look inside" opens their Velvet Sims game. */
  mainCompanionId?: string | null;
}

const DISPLAY_FONT = '"Bricolage Grotesque", sans-serif';

function medalCanvas(slug: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const o = c.getContext('2d')!;
  o.scale(2, 2);
  const m = MEDALS[slug] || { tier: 'bronze', glyph: 'star' };
  if (m.tier === 'legendary') {
    const g = o.createLinearGradient(2, 2, 22, 22);
    g.addColorStop(0, '#F472B6');
    g.addColorStop(1, '#7C5CE8');
    o.fillStyle = g;
  } else {
    o.fillStyle = TIER_COLORS[m.tier];
  }
  o.beginPath();
  o.arc(12, 12, 10.5, 0, Math.PI * 2);
  o.fill();
  glyph(o, m.glyph, 12, 12, 11, m.tier === 'silver' ? '#4A5260' : '#FFFFFF');
  return c;
}

function houseLine(r: ResolvedPlot): string {
  const h = houseInfo(r.house.style);
  if (r.houseBy === 'member') return `${h.label} · member house`;
  if (r.houseBy === 'medal') return `${h.label} · earned with ${MEDALS[h.medal!].name}`;
  return `${h.label} · starter house`;
}

/** A medal the art kit doesn't know: "first-post" → "First post". */
export function medalName(slug: string): string {
  const s = slug.replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Neighbor since Oct 2026", or "Moved in this week". */
export function neighborSince(movedIn: string | undefined, now = new Date()): string | null {
  if (!movedIn) return null;
  const d = new Date(movedIn);
  if (Number.isNaN(d.getTime())) return null;
  if (now.getTime() - d.getTime() < 7 * 86400000) return 'Moved in this week';
  return `Neighbor since ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
}

function Chip({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none" style={{ background: bg, color }}>
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/40">{children}</span>;
}

function Stat({ icon, value, label, accent }: { icon: ReactNode; value: ReactNode; label: string; accent: string }) {
  return (
    <div className="grid justify-items-center gap-0.5 rounded-[12px] bg-white/[0.05] px-1 py-2.5">
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-[17px] font-extrabold leading-none text-white tabular-nums" style={{ fontFamily: DISPLAY_FONT }}>{value}</span>
      <span className="text-[10.5px] text-white/45">{label}</span>
    </div>
  );
}

export function BillboardCard({ plot, isYou, onClose, onCustomize, mainCompanionId = null }: BillboardCardProps) {
  const navigate = useNavigate();
  const resolved = resolvePlot(plot);
  const prof = plot.profile;
  const medalListRef = useRef<HTMLDivElement>(null);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [outgoing, setOutgoing] = useState<FriendPeer[]>([]);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [details, setDetails] = useState<CardDetails | null>(null);

  useEffect(() => {
    getFriends().then(setFriends).catch(() => {});
    getOutgoingRequests().then(setOutgoing).catch(() => {});
  }, []);

  // Opening someone else's billboard counts as a visit; then load the rest of the card.
  useEffect(() => {
    let live = true;
    setDetails(null);
    setSent(false);
    const visit = isYou ? Promise.resolve() : recordVisit(plot.id).then(() => {}, () => {});
    visit.then(() => getCardDetails(plot.id)).then((d) => { if (live) setDetails(d); }).catch(() => {});
    return () => { live = false; };
  }, [plot.id, isYou]);

  useEffect(() => {
    if (!medalListRef.current) return;
    const list = medalListRef.current;
    list.innerHTML = '';
    (prof.medals || []).forEach((slug) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-1 pr-2.5 text-[12px] text-white/85';
      const canvas = medalCanvas(slug);
      canvas.style.width = '20px';
      canvas.style.height = '20px';
      canvas.style.flex = 'none';
      row.appendChild(canvas);
      const span = document.createElement('span');
      span.textContent = MEDALS[slug]?.name ?? medalName(slug);
      row.appendChild(span);
      list.appendChild(row);
    });
  }, [prof.medals]);

  const isFriend = friends.some((f) => f.user_id === plot.id);
  const alreadySent = outgoing.some((f) => f.user_id === plot.id) || sent;
  const isPrivate = prof.name === 'A neighbor';
  const initials = prof.name.split(' ').map((w) => w[0]).join('').slice(0, 2);
  const accent = resolved.member ? resolved.sign.color : '#8A7F96';
  const firstName = prof.name.split(' ')[0];
  // The New neighbor chip already says it for this week's arrivals.
  const since = prof.newNeighbor ? null : neighborSince(details?.moved_in_at);
  const bio = details?.bio && details.bio !== prof.headline?.trim() ? details.bio : null;
  const goals = details?.goals?.length
    ? details.goals
    : prof.goal ? [{ label: prof.goal.label, pct: prof.goal.pct, done: false }] : [];
  const visitors = details?.visitors;
  const inCommon: string[] = [];
  if (details?.mutual_friends) inCommon.push(`${details.mutual_friends} friend${details.mutual_friends === 1 ? '' : 's'} in common`);
  if (details?.shared_spaces?.length) {
    const s = details.shared_spaces;
    inCommon.push(`You're both in ${s.slice(0, 2).join(' and ')}${s.length > 2 ? ` +${s.length - 2}` : ''}`);
  }

  const handleAddFriend = async () => {
    if (sending || alreadySent) return;
    setSending(true);
    try {
      await sendFriendRequest(plot.id);
      setSent(true);
    } catch {
      // silently ignore duplicates
    }
    setSending(false);
  };

  return (
    <section className="relative grid gap-3.5 overflow-hidden">
      {/* Banner in their sign color */}
      <div
        className="absolute inset-x-0 top-0 h-[92px]"
        style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent}33 70%, transparent)` }}
        aria-hidden
      />
      <button onClick={onClose} className="absolute right-3 top-3 z-[1] flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-black/25 text-white/80 hover:bg-black/40" aria-label="Close">
        <X className="h-4 w-4" />
      </button>

      {/* Head */}
      <div className="relative flex items-end gap-3 px-[18px] pt-[44px]">
        <div
          className="grid h-[72px] w-[72px] flex-none place-items-center overflow-hidden rounded-full border-[3px] font-extrabold text-white text-[26px]"
          style={{ borderColor: 'rgba(24,19,34,0.95)', background: details?.avatar_config ? '#2B2238' : accent, fontFamily: DISPLAY_FONT }}
        >
          {details?.avatar_config
            ? <Avatar config={details.avatar_config} className="h-full w-full" />
            : initials}
        </div>
        <div className="min-w-0 grid gap-0.5 pb-1">
          <h2 className="m-0 truncate font-extrabold text-[21px] leading-tight tracking-tight text-white" style={{ fontFamily: DISPLAY_FONT }}>
            {prof.name}
          </h2>
          <p className="m-0 truncate text-[12.5px] text-white/45">{prof.address}{since ? ` · ${since}` : ''}</p>
        </div>
      </div>

      <div className="grid gap-3.5 px-[18px] pb-[16px]">
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {isYou && <Chip bg="rgba(240,106,155,0.16)" color="#F06A9B">Your house</Chip>}
          {resolved.member && <Chip bg="rgba(245,184,46,0.16)" color="#F5B82E">★ Member</Chip>}
          {prof.newNeighbor && <Chip bg="rgba(89,201,138,0.16)" color="#59C98A">New neighbor</Chip>}
          {isFriend && <Chip bg="rgba(89,201,138,0.16)" color="#59C98A">Friend</Chip>}
          {(prof.spaces || []).map((s) => (
            <Chip key={s} bg="rgba(255,255,255,0.08)" color="#C9C0D3">{s}</Chip>
          ))}
        </div>

        {/* Headline and bio */}
        {(prof.headline || bio) && (
          <div className="grid gap-1">
            {prof.headline && <p className="m-0 text-[15.5px] font-semibold leading-snug text-white">{prof.headline}</p>}
            {bio && <p className="m-0 text-[13.5px] leading-relaxed text-white/65">{bio}</p>}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-1.5">
          <Stat icon={<Footprints className="h-4 w-4" />} value={visitors ?? '–'} label={visitors === 1 ? 'visitor' : 'visitors'} accent="#F06A9B" />
          {isPrivate ? (
            <div className="col-span-3 grid place-items-center rounded-[12px] bg-white/[0.04] px-3 text-center text-[12px] text-white/45">
              This neighbor keeps their profile private.
            </div>
          ) : (
            <>
              <Stat icon={<Users className="h-4 w-4" />} value={details?.friends ?? '–'} label={details?.friends === 1 ? 'friend' : 'friends'} accent="#59C98A" />
              <Stat icon={<Flame className="h-4 w-4" />} value={details?.streak ?? '–'} label="day streak" accent="#F5A524" />
              <Stat icon={<Award className="h-4 w-4" />} value={prof.medalCount ?? 0} label={prof.medalCount === 1 ? 'medal' : 'medals'} accent="#A78BFA" />
            </>
          )}
        </div>
        {!!details?.visitors_week && (
          <p className="-mt-2 m-0 text-[11.5px] text-white/40">
            {isYou
              ? `${details.visitors_week} new ${details.visitors_week === 1 ? 'visitor' : 'visitors'} this week`
              : `${details.visitors_week} stopped by this week`}
          </p>
        )}

        {/* In common */}
        {inCommon.length > 0 && (
          <div className="rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white/75">
            {inCommon.join(' · ')}
          </div>
        )}

        {/* Goals */}
        {goals.length > 0 && (
          <div className="grid gap-2">
            <SectionLabel>Working on</SectionLabel>
            {goals.map((g) => (
              <div key={g.label} className="grid gap-1">
                <div className="flex justify-between gap-3 text-[13px] font-semibold text-white">
                  <span className="min-w-0">{g.label}</span>
                  <span className="flex-none text-white/60">{g.done ? 'Done' : g.pct != null ? `${Math.round(g.pct)}%` : ''}</span>
                </div>
                <div className="h-[6px] overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${g.done ? 100 : Math.min(100, g.pct ?? 0)}%`, background: g.done ? '#59C98A' : 'linear-gradient(90deg, #F06A9B, #F5A3C1)' }} />
                </div>
              </div>
            ))}
            {(!!details?.goals_done || !!details?.commitments_kept) && (
              <p className="m-0 text-[11.5px] text-white/40">
                {[
                  details.goals_done ? `${details.goals_done} goal${details.goals_done === 1 ? '' : 's'} finished` : null,
                  details.commitments_kept ? `${details.commitments_kept} commitment${details.commitments_kept === 1 ? '' : 's'} kept` : null,
                ].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Medals */}
        {(prof.medals || []).length > 0 && (
          <div className="grid gap-1.5">
            <SectionLabel>Pinned medals</SectionLabel>
            <div ref={medalListRef} className="flex flex-wrap gap-1.5" />
          </div>
        )}

        <p className="m-0 text-[11.5px] text-white/35">{houseLine(resolved)}</p>

        {/* Buttons */}
        {isYou ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onCustomize}
              className="rounded-[12px] bg-white/10 px-3.5 py-2.5 font-bold text-[14px] text-white hover:bg-white/15 transition-colors"
            >
              Customize my plot
            </button>
            {/* Only on your own house: the inside is the Velvet Sims game */}
            <button
              type="button"
              onClick={() => navigate(mainCompanionId ? `/velvet-house?companion=${encodeURIComponent(mainCompanionId)}` : '/velvet-house')}
              className="rounded-[12px] border border-white/15 bg-transparent px-3.5 py-2.5 font-bold text-[14px] text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              Look inside
            </button>
          </div>
        ) : !isPrivate && (
          <div className="flex gap-2">
            <button
              onClick={handleAddFriend}
              disabled={isFriend || alreadySent || sending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] px-3.5 py-2.5 font-bold text-[15px] transition-colors"
              style={{
                background: isFriend || alreadySent ? 'rgba(255,255,255,0.1)' : '#F06A9B',
                color: isFriend || alreadySent ? '#C9C0D3' : '#2A0F1C',
              }}
            >
              {isFriend ? <Check className="h-4 w-4" /> : alreadySent ? <Clock className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {isFriend ? 'Friends' : alreadySent ? 'Request sent' : `Add ${firstName}`}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/member/${plot.id}`)}
              className="rounded-[12px] border border-white/15 px-3.5 py-2.5 font-bold text-[14px] text-white/75 hover:text-white hover:border-white/30 transition-colors"
            >
              Profile
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
