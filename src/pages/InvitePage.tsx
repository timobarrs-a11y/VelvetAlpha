import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Gift, Users, Sparkles, MessageCircle } from 'lucide-react';
import { referralService, ReferralSummary } from '../services/referralService';
import { toast } from '../shared/ui';

const VELVET_BG = 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

// Kept in sync with track_referral_progress() in the referral migration.
const REFERRED_BONUS = 25;

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl px-4 py-5 text-center"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
    >
      <div className="mb-2 text-[rgba(150,170,255,0.9)]">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-[rgba(190,200,255,0.6)]">{label}</div>
    </div>
  );
}

export function InvitePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    referralService
      .getSummary()
      .then((s) => mounted && setSummary(s))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Invite link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press to copy manually');
    }
  }

  async function share() {
    if (!summary?.inviteLink) return;
    const shareData = {
      title: 'Come find me on Velvet',
      text: 'I want you to try this with me — you get bonus messages when you join.',
      url: summary.inviteLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user dismissed */
      }
    } else {
      copy(summary.inviteLink);
    }
  }

  return (
    <div className="min-h-screen text-white" style={{ background: VELVET_BG }}>
      <div className="min-h-screen" style={{ background: VELVET_RADIAL }}>
        <div className="mx-auto max-w-xl px-6 py-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-8 flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            <ArrowLeft size={16} /> Back
          </button>

          <div className="mb-8 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(244,63,107,0.15)', border: '1px solid rgba(244,63,107,0.3)' }}
            >
              <Gift size={26} className="text-[#f43f6b]" />
            </div>
            <h1 className="text-2xl font-bold">Invite someone in</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[rgba(190,200,255,0.65)]">
              Share your code. When a friend joins and actually settles in, you both get bonus
              messages — they get {REFERRED_BONUS} the moment they arrive.
            </p>
          </div>

          {loading ? (
            <div className="py-16 text-center text-sm text-[rgba(190,200,255,0.5)]">Loading…</div>
          ) : !summary?.code ? (
            <div className="py-16 text-center text-sm text-[rgba(190,200,255,0.5)]">
              Your invite code isn’t ready yet. Try refreshing in a moment.
            </div>
          ) : (
            <>
              {/* Code + link */}
              <div
                className="rounded-2xl p-5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                <div className="mb-1 text-xs uppercase tracking-wide text-[rgba(190,200,255,0.5)]">
                  Your code
                </div>
                <div className="mb-4 font-mono text-3xl font-bold tracking-[0.2em] text-white">
                  {summary.code}
                </div>

                <div
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <span className="flex-1 truncate text-sm text-[rgba(210,215,255,0.8)]">
                    {summary.inviteLink}
                  </span>
                  <button
                    onClick={() => summary.inviteLink && copy(summary.inviteLink)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: 'rgba(100,120,255,0.25)', color: 'white' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <button
                  onClick={share}
                  className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white transition-transform active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg, #f43f6b 0%, #b02a8f 100%)' }}
                >
                  Share invite
                </button>
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                <StatTile icon={<Users size={20} />} value={summary.invitedCount} label="Invited" />
                <StatTile icon={<Sparkles size={20} />} value={summary.qualifiedCount} label="Activated" />
                <StatTile
                  icon={<MessageCircle size={20} />}
                  value={summary.rewardMessagesEarned}
                  label="Msgs earned"
                />
              </div>

              {summary.pendingCount > 0 && (
                <p className="mt-4 text-center text-xs text-[rgba(190,200,255,0.55)]">
                  {summary.pendingCount} {summary.pendingCount === 1 ? 'friend has' : 'friends have'} joined
                  and {summary.pendingCount === 1 ? 'is' : 'are'} settling in — you’re rewarded once they’re
                  active.
                </p>
              )}

              <p className="mt-8 text-center text-xs leading-relaxed text-[rgba(190,200,255,0.4)]">
                Rewards are granted when the people you invite become active — not just for signing up.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
