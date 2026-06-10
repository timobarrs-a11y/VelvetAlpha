export type ThoughtPatternTag =
  | 'worst_case_jump'
  | 'mind_reading'
  | 'all_or_nothing'
  | 'self_blame'
  | 'future_assuming';

export function detectThoughtPattern(thought?: string): ThoughtPatternTag | null {
  if (!thought) return null;

  if (/\balways\b|\bnever\b/i.test(thought)) return 'all_or_nothing';
  if (/\bthey think\b|\bthey must think\b|\bthey probably think\b/i.test(thought)) return 'mind_reading';
  if (/\bwhat if\b.*\bworst\b/i.test(thought)) return 'worst_case_jump';
  if (/\bmy fault\b|\bi ruined\b|\bi messed up\b/i.test(thought)) return 'self_blame';
  if (/\bgoing to fail\b|\bwon't work\b|\bwill never work\b/i.test(thought)) return 'future_assuming';

  return null;
}
