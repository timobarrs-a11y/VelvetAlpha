/** mentor = a coach (teaches a skill); assistant = helps get a goal done. */
export type RelationshipType = 'friend' | 'romantic' | 'mentor' | 'assistant';

/** Coaches and assistants: the user's team for goals, as opposed to companions. */
export function isHelper(relationshipType: string | null | undefined): boolean {
  return relationshipType === 'mentor' || relationshipType === 'assistant';
}

export type HelperRole = 'Coach' | 'Assistant';

/** "Coach" or "Assistant" for the user's team; null for companions. */
export function helperRole(relationshipType: string | null | undefined): HelperRole | null {
  if (relationshipType === 'mentor') return 'Coach';
  if (relationshipType === 'assistant') return 'Assistant';
  return null;
}

/** Badge colors that tell a coach from an assistant at a glance. */
export const HELPER_BADGE_COLOR: Record<HelperRole, string> = {
  Coach: '#34d399',
  Assistant: '#60a5fa',
};
