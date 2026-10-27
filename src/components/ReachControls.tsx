import { motion } from 'framer-motion';
import { MessageCircle, UserPlus, Mail, MessagesSquare, Trophy, Users } from 'lucide-react';
import type { CommentPolicy, MessagePolicy, ProfileMode } from '../services/memberProfileService';

export interface ReachValues {
  share_accomplishments: boolean;
  profile_mode: ProfileMode;
  who_can_message: MessagePolicy;
  accepts_friend_requests: boolean;
  accepts_mail: boolean;
  comments_from: CommentPolicy;
}

function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-white/5 p-0.5 flex-shrink-0">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`px-2.5 py-1.5 rounded-[10px] text-[11.5px] font-semibold transition-colors ${value === o.id ? 'bg-pink-400/80 text-white' : 'text-white/50 hover:text-white'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{ background: on ? 'rgba(244,114,182,0.80)' : 'rgba(255,255,255,0.12)' }}
    >
      <motion.div animate={{ x: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md" />
    </button>
  );
}

function Row({ icon: Icon, title, text, children }: { icon: typeof Mail; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 flex-shrink-0">
          <Icon className="w-[18px] h-[18px] text-white/45" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          <p className="text-xs text-white/40 mt-0.5">{text}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Your wins, your full page, and how people can reach you. Everyone can always see that you are
 * here (your name, interests, favorite color, zodiac and what you are working on); these choose
 * the rest.
 */
export function ReachControls({ values, onChange }: { values: ReachValues; onChange: (next: ReachValues) => void }) {
  const set = <K extends keyof ReachValues>(key: K, v: ReachValues[K]) => onChange({ ...values, [key]: v });
  return (
    <div className="space-y-6">
      <section aria-label="Share my wins" className="rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-300/15 flex-shrink-0">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white">Share my wins</h3>
              <p className="text-xs text-white/55 mt-0.5 leading-relaxed">
                When you finish a goal, task or commitment, it shows up in Discover with what you did, so people can cheer you on.
                Turn this off to keep your wins to yourself and your friends. Friends always see them.
              </p>
            </div>
          </div>
          <Switch label="Share my wins" on={values.share_accomplishments} onChange={v => set('share_accomplishments', v)} />
        </div>
      </section>

      <section aria-label="Who sees your full page" className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white">Who sees your full page</h3>
        <p className="text-xs text-white/40 mt-0.5">
          Everyone can see that you are here: your name, interests, favorite color, zodiac and what you are working on.
          Your full page (bio, goals and posts) is for friends, unless you make it public-facing.
        </p>
        <div className="mt-2">
          <Row icon={Users} title="Full page" text="Friends only, or anyone without a friend request">
            <Segmented
              label="Who sees your full page"
              value={values.profile_mode}
              onChange={v => set('profile_mode', v)}
              options={[{ id: 'friends', label: 'Friends' }, { id: 'open', label: 'Everyone' }]}
            />
          </Row>
        </div>
      </section>

      <section aria-label="How people can reach you" className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white">How people can reach you</h3>
        <p className="text-xs text-white/40 mt-0.5">
          Accepting a friend request is how someone gets into your world. These choose how else they can get to you.
        </p>
        <div className="mt-2 divide-y divide-white/6">
          <Row icon={MessageCircle} title="Messages" text="Who can send you a message">
            <Segmented
              label="Who can message you"
              value={values.who_can_message}
              onChange={v => set('who_can_message', v)}
              options={[{ id: 'everyone', label: 'Everyone' }, { id: 'friends', label: 'Friends' }, { id: 'nobody', label: 'No one' }]}
            />
          </Row>
          <Row icon={UserPlus} title="Friend requests" text="Let people ask to be your friend">
            <Switch label="Accept friend requests" on={values.accepts_friend_requests} onChange={v => set('accepts_friend_requests', v)} />
          </Row>
          <Row icon={Mail} title="Mail" text="Letters from Velvet in your mailbox">
            <Switch label="Receive mail" on={values.accepts_mail} onChange={v => set('accepts_mail', v)} />
          </Row>
          <Row icon={MessagesSquare} title="Comments" text="Who can comment on your posts and wins">
            <Segmented
              label="Who can comment on your posts"
              value={values.comments_from}
              onChange={v => set('comments_from', v)}
              options={[{ id: 'everyone', label: 'Everyone' }, { id: 'friends', label: 'Friends' }]}
            />
          </Row>
        </div>
      </section>
    </div>
  );
}
