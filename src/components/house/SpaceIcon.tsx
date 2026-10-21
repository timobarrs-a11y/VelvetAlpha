import {
  BookOpen, Briefcase, Cat, ChefHat, Coffee, Cpu, Dumbbell, Film,
  Gamepad2, Heart, MessageSquare, Palette, Plane, Sparkles, Sun, Trophy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Briefcase, Cat, ChefHat, Coffee, Cpu, Dumbbell, Film,
  Gamepad2, Heart, MessageSquare, Palette, Plane, Sparkles, Sun, Trophy,
};

const COLOR_MAP: Record<string, string> = {
  amber: 'text-amber-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  green: 'text-green-400',
  pink: 'text-pink-400',
  purple: 'text-purple-400',
  rose: 'text-rose-400',
  teal: 'text-teal-400',
  violet: 'text-violet-400',
};

export function SpaceIcon({ name, color, className }: { name: string; color?: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? MessageSquare;
  const colorClass = color ? COLOR_MAP[color] ?? 'text-blue-400' : 'text-blue-400';
  return <Icon className={`${colorClass} ${className ?? ''}`} />;
}

export function spaceColorClass(color: string | null | undefined): string {
  if (!color) return 'text-blue-400';
  return COLOR_MAP[color] ?? 'text-blue-400';
}
