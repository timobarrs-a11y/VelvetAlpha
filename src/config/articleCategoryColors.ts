export const CATEGORY_COLORS: Record<string, string> = {
  'Politics': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Science & Technology': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Entertainment': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Sports': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Basketball': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Gaming': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'Business & Finance': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Health & Wellness': 'bg-green-500/20 text-green-300 border-green-500/30',
  'World News': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'default': 'bg-white/10 text-white/60 border-white/20',
};

export function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default'];
}
