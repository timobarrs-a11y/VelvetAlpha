import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Heart, Users, Brain, Newspaper, Sparkles } from 'lucide-react';
import { Avatar } from '../Avatar';
import { Badge } from '../../shared/ui/Badge';
import type { CompanionWithLastMessage } from '../../services/companionService';
import { TONE_COLOR, STATUS_DOT, formatTimeAgo, companionAvatarConfig, type CompanionTone } from './lobbyUtils';
import { getVoiceById } from '../../config/signatureVoices';
import { getExpertById } from '../../config/signatureExperts';

interface CompanionCardProps {
  companion: CompanionWithLastMessage;
  tone: CompanionTone;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  delay?: number;
}

function RoleBadge({ companion, tone }: { companion: CompanionWithLastMessage; tone: CompanionTone }) {
  if (tone === 'coach') {
    return <Badge overlay tone={TONE_COLOR.coach} icon={<Brain className="w-2.5 h-2.5" />}>Coach</Badge>;
  }
  if (tone === 'correspondent') {
    return <Badge overlay tone={TONE_COLOR.correspondent} icon={<Newspaper className="w-2.5 h-2.5" />}>Correspondent</Badge>;
  }
  return companion.relationship_type === 'romantic'
    ? <Badge overlay tone="#f472b6" icon={<Heart className="w-2.5 h-2.5" />}>Partner</Badge>
    : <Badge overlay tone="#38bdf8" icon={<Users className="w-2.5 h-2.5" />}>Friend</Badge>;
}

/** Unified companion card for Velvet Voices / Coaches / Correspondents. */
export function CompanionCard({ companion, tone, onOpen, onDelete, delay = 0 }: CompanionCardProps) {
  const accent = TONE_COLOR[tone];
  const deleteTitle = tone === 'coach' ? 'Delete coach' : tone === 'correspondent' ? 'Delete correspondent' : 'Delete companion';

  let secondaryBadge: ReactNode = null;
  if (tone === 'voice' && companion.signature_voice) {
    secondaryBadge = (
      <Badge overlay size="xs" tone="#c084fc" icon={<Sparkles className="w-2.5 h-2.5" />} className="absolute bottom-2.5 left-2.5">
        {getVoiceById(companion.signature_voice).name}
      </Badge>
    );
  } else if (tone === 'coach' && companion.signature_expert) {
    secondaryBadge = (
      <Badge overlay size="xs" tone="#818cf8" icon={<Brain className="w-2.5 h-2.5" />} className="absolute bottom-2.5 right-2.5">
        {companion.signature_expert_source === 'curated'
          ? (getExpertById(companion.signature_expert)?.domain ?? 'Expert')
          : 'Expert'}
      </Badge>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      data-interactive
      data-tone={tone}
      className="ds-card ds-card--interactive ds-companion-card group"
      style={{ '--ds-tone': accent } as React.CSSProperties}
    >
      <div className="ds-companion-portrait relative h-44 overflow-hidden">
        <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          type="button"
          onClick={onDelete}
          className="absolute top-2.5 left-2.5 p-1.5 bg-danger-500/90 hover:bg-danger-600 text-white rounded-lg shadow-card opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all z-10"
          title={deleteTitle}
          aria-label={deleteTitle}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <span className="absolute top-2.5 right-2.5"><RoleBadge companion={companion} tone={tone} /></span>
        {secondaryBadge}
      </div>

      <div className="p-4">
        <h3
          className="font-semibold text-ink mb-1.5 transition-colors group-hover:text-[var(--ds-tone)]"
          style={{ fontFamily: companion.font_family ?? undefined, fontSize: '1rem', lineHeight: 1.3 }}
        >
          {companion.custom_name}
        </h3>
        {companion.current_status && (
          <p className="text-xs mb-3 flex items-center gap-1.5 text-ink-secondary"
            style={{ fontFamily: companion.font_family ?? undefined, lineHeight: 1.45 }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[tone] }} />
            {companion.current_status}
          </p>
        )}
        <div className="ds-divider flex items-center justify-between text-xs text-ink-subtle pt-3">
          <span>{formatTimeAgo(companion.last_message_at)}</span>
          {(companion.unread_count ?? 0) > 0 && (
            <Badge tone={accent} size="xs">{companion.unread_count}</Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface AddCardProps {
  title: string;
  subtitle: string;
  tone: CompanionTone;
  onClick: () => void;
  delay?: number;
}

/** Dashed "add another" tile that closes out each companion grid. */
export function AddCompanionCard({ title, subtitle, tone, onClick, delay = 0 }: AddCardProps) {
  const accent = TONE_COLOR[tone];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      data-interactive
      className="ds-card ds-card--dashed ds-focus group flex items-center justify-center min-h-[260px] w-full"
      style={{ '--ds-tone': accent, '--ds-card-hover-border': accent } as React.CSSProperties}
    >
      <div className="text-center p-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 60%, var(--ds-accent)) 100%)`,
            boxShadow: `0 0 20px color-mix(in srgb, ${accent} 40%, transparent)`,
          }}
        >
          <PlusIcon />
        </div>
        <p className="font-semibold text-ink font-display text-sm transition-colors group-hover:text-[var(--ds-tone)]">{title}</p>
        <p className="text-xs text-ink-muted mt-1">{subtitle}</p>
      </div>
    </motion.button>
  );
}

function PlusIcon() {
  return (
    <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
