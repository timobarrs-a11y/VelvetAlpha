/** mentor = a coach (teaches a skill); assistant = helps get a goal done. */
export type RelationshipType = 'friend' | 'romantic' | 'mentor' | 'assistant';

/** Coaches and assistants: the user's team for goals, as opposed to companions. */
export function isHelper(relationshipType: string | null | undefined): boolean {
  return relationshipType === 'mentor' || relationshipType === 'assistant';
}
