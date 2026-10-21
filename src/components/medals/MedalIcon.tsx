import {
  Crown, Footprints, Flag, Target, Handshake, Trophy, CalendarCheck, Repeat,
  Flame, Gem, Users, HeartHandshake, ThumbsUp, UserPlus, DoorOpen, PenLine,
  MessageSquarePlus, MessageCircle, Star, Sparkles, PartyPopper, GraduationCap,
  RotateCcw, Award,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Crown, Footprints, Flag, Target, Handshake, Trophy, CalendarCheck, Repeat,
  Flame, Gem, Users, HeartHandshake, ThumbsUp, UserPlus, DoorOpen, PenLine,
  MessageSquarePlus, MessageCircle, Star, Sparkles, PartyPopper, GraduationCap,
  RotateCcw, Award,
};

export function MedalIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Award;
  return <Icon className={className} />;
}
