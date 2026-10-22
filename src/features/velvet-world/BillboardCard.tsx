import { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  resolvePlot, houseInfo, MEDALS, TIER_COLORS, glyph,
  type Plot, type ResolvedPlot,
} from './art/streetArt';
import { sendFriendRequest, getFriends, getOutgoingRequests, type FriendPeer } from '../../shared/supabase/queries/messaging';

interface BillboardCardProps {
  plot: Plot;
  isYou: boolean;
  onClose: () => void;
  onCustomize: () => void;
}

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

export function BillboardCard({ plot, isYou, onClose, onCustomize }: BillboardCardProps) {
  const resolved = resolvePlot(plot);
  const prof = plot.profile;
  const medalListRef = useRef<HTMLDivElement>(null);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [outgoing, setOutgoing] = useState<FriendPeer[]>([]);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getFriends().then(setFriends).catch(() => {});
    getOutgoingRequests().then(setOutgoing).catch(() => {});
  }, []);

  useEffect(() => {
    if (!medalListRef.current) return;
    const list = medalListRef.current;
    list.innerHTML = '';
    (prof.medals || []).forEach((slug) => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2 text-[13px]';
      const canvas = medalCanvas(slug);
      canvas.style.width = '24px';
      canvas.style.height = '24px';
      canvas.style.flex = 'none';
      row.appendChild(canvas);
      const span = document.createElement('span');
      const m = MEDALS[slug] || { name: slug, tier: '' };
      span.innerHTML = `${m.name} <small class="text-white/40 capitalize">· ${m.tier}</small>`;
      row.appendChild(span);
      list.appendChild(row);
    });
  }, [prof.medals]);

  const isFriend = friends.some((f) => f.user_id === plot.id);
  const alreadySent = outgoing.some((f) => f.user_id === plot.id) || sent;
  const isPrivate = prof.name === 'A neighbor';
  const initials = prof.name.split(' ').map((w) => w[0]).join('').slice(0, 2);

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
    <section className="grid gap-3 p-[18px_18px_14px]">
      {/* Head */}
      <div className="flex items-center gap-3">
        <div
          className="grid h-[46px] w-[46px] place-items-center rounded-[14px] font-extrabold text-white text-[20px]"
          style={{ background: resolved.member ? resolved.sign.color : '#6B6070', fontFamily: '"Bricolage Grotesque", sans-serif' }}
        >
          {initials}
        </div>
        <div className="min-w-0 grid gap-0.5">
          <h2 className="m-0 font-extrabold text-[21px] leading-tight tracking-tight text-white" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
            {prof.name}
          </h2>
          <p className="m-0 text-[12.5px] text-white/40">{prof.address}</p>
        </div>
        <button onClick={onClose} className="ml-auto flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-white/8 text-[18px] text-white/60 hover:bg-white/12" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5">
        {resolved.member && <span className="chip" style={{ background: 'rgba(245,184,46,0.16)', color: '#F5B82E' }}>★ Member</span>}
        {prof.newNeighbor && <span className="chip" style={{ background: 'rgba(89,201,138,0.16)', color: '#59C98A' }}>New neighbor</span>}
        {isFriend && <span className="chip" style={{ background: 'rgba(89,201,138,0.16)', color: '#59C98A' }}>Friend</span>}
        {(prof.spaces || []).map((s) => (
          <span key={s} className="chip" style={{ background: 'rgba(255,255,255,0.08)', color: '#C9C0D3' }}>{s}</span>
        ))}
      </div>

      {/* Headline */}
      {prof.headline && <p className="m-0 text-[15px] leading-relaxed text-white">{prof.headline}</p>}

      {/* House line */}
      <p className="m-0 text-[12px] text-white/40">{houseLine(resolved)}</p>

      {/* Goal */}
      {prof.goal && (
        <div className="grid gap-1.5">
          <span className="label">Working on</span>
          <div className="flex justify-between text-[13.5px] font-semibold text-white">
            <span>{prof.goal.label}</span>
            <span>{Math.round(prof.goal.pct)}%</span>
          </div>
          <div className="h-[7px] rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, prof.goal.pct)}%`, background: 'linear-gradient(90deg, #F06A9B, #F5A3C1)' }} />
          </div>
        </div>
      )}

      {/* Medals */}
      <div className="grid gap-1.5">
        <span className="label">Pinned medals</span>
        <div ref={medalListRef} className="grid gap-1.5" />
      </div>

      {/* Buttons */}
      {!isPrivate && (
        <div className="flex gap-2 flex-wrap">
          {isYou ? (
            <>
              <button
                onClick={onCustomize}
                className="rounded-[12px] bg-white/8 px-3.5 py-2.5 font-bold text-[14px] text-white hover:bg-white/12 transition-colors"
              >
                Customize my plot
              </button>
              <a
                href="/velvet-house"
                className="rounded-[12px] border border-white/15 bg-transparent px-3.5 py-2.5 font-bold text-[14px] text-white/60 hover:text-white hover:border-white/30 transition-colors"
              >
                Play inside
              </a>
            </>
          ) : (
            <button
              onClick={handleAddFriend}
              disabled={isFriend || alreadySent || sending}
              className="rounded-[12px] px-3.5 py-2.5 font-bold text-[15px] transition-colors"
              style={{
                background: isFriend || alreadySent ? 'rgba(255,255,255,0.1)' : '#F06A9B',
                color: isFriend || alreadySent ? '#C9C0D3' : '#2A0F1C',
              }}
            >
              {isFriend ? 'Friends' : alreadySent ? 'Request sent' : 'Add friend'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
