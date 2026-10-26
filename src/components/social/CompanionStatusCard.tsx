import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Loader2, Send, Sparkles } from 'lucide-react';
import { Avatar } from '../Avatar';
import { companionAvatarConfig } from '../lobby/lobbyUtils';
import { timeAgo } from '../../utils/timeAgo';
import { toast } from '../../shared/ui/Toast';
import {
  commentOnStatus, COMPANION_STATUS_COMMENT_MAX,
  type CompanionStatusPost, type CompanionStatusComment,
} from '../../services/companionStatusService';
import type { CompanionWithLastMessage } from '../../services/companionService';

/**
 * One of your companions' statuses, on your own feed. Comment on it any time; a companion
 * answers only when you @-mention it, so a plain comment is just you talking.
 */
export function CompanionStatusCard({ post, index, companion, companions, initialComments }: {
  post: CompanionStatusPost;
  index: number;
  companion: CompanionWithLastMessage | undefined;
  /** Everyone you can @-mention (your companions, not coaches). */
  companions: CompanionWithLastMessage[];
  initialComments: CompanionStatusComment[];
}) {
  const [showComments, setShowComments] = useState(initialComments.length > 0);
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const name = companion?.custom_name ?? 'Companion';
  const nameOf = (id: string | null) => companions.find(c => c.id === id)?.custom_name ?? name;
  const faceOf = (id: string | null) => companions.find(c => c.id === id) ?? companion;

  const mention = (who: CompanionWithLastMessage) => {
    const tag = `@${who.custom_name} `;
    setShowComments(true);
    setText(t => (t.includes(tag.trim()) ? t : `${t}${t && !t.endsWith(' ') ? ' ' : ''}${tag}`));
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const result = await commentOnStatus(post.id, body);
      setComments(prev => [...prev, result.comment, ...(result.reply ? [result.reply] : [])]);
      setText('');
      if (result.replySkipped === 'post_limit') toast.info(`${name} has said all they're going to on this one.`);
      else if (result.replySkipped === 'daily_limit') toast.info('Your companions are all talked out for today.');
      else if (result.replySkipped === 'cooldown') toast.info('Give it a few seconds before tagging again.');
      else if (result.replySkipped === 'unavailable') toast.info("They couldn't answer just now. Try again in a bit.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post that. Try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden hover:border-white/12 transition-colors"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
          {companion && <Avatar config={companionAvatarConfig(companion)} className="h-full w-full" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate" style={{ fontFamily: companion?.font_family ?? undefined }}>{name}</span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-300 text-[10px] font-semibold">
              <Sparkles className="w-2.5 h-2.5" />
              Companion
            </span>
          </div>
          <p className="text-[11px] text-white/35 mt-0.5">{timeAgo(post.visible_at)}</p>
        </div>
      </div>

      <p className="px-4 pb-3 text-[15px] text-white/90 leading-relaxed break-words">{post.body}</p>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06]">
        <button
          onClick={() => setShowComments(s => !s)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          {comments.length > 0 ? comments.length : 'Comment'}
        </button>
      </div>

      {showComments && (
        <div className="px-4 pb-3 border-t border-white/[0.06]">
          {comments.map(c => {
            const mine = c.author_type === 'user';
            const who = mine ? undefined : faceOf(c.companion_id);
            return (
              <div key={c.id} className="flex items-start gap-2.5 py-2">
                <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
                  {who
                    ? <Avatar config={companionAvatarConfig(who)} className="w-full h-full" />
                    : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/40">You</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-white">{mine ? 'You' : nameOf(c.companion_id)}</span>
                  <span className="text-[10px] text-white/25 ml-1.5">{timeAgo(c.created_at)}</span>
                  <p className="text-xs text-white/65 leading-relaxed mt-0.5 break-words">{c.body}</p>
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
            {companions.map(c => (
              <button
                key={c.id}
                onClick={() => mention(c)}
                className="px-2 py-0.5 rounded-full border border-white/10 text-[11px] text-pink-300/80 hover:bg-white/5 transition-colors"
                aria-label={`Tag ${c.custom_name}`}
              >
                @{c.custom_name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={e => setText(e.target.value.slice(0, COMPANION_STATUS_COMMENT_MAX))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`Comment. Tag @${name} to get an answer`}
              aria-label={`Comment on ${name}'s status`}
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-full px-3.5 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-pink-400/40"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              aria-label="Send comment"
              className="p-2 rounded-full bg-pink-500/80 hover:bg-pink-500 text-white transition-colors disabled:opacity-30"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
