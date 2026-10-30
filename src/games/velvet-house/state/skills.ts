/**
 * Skills grow from hobbies. Doing a hobby activity adds points to the skill it trains, a little for every game minute,
 * and each full level of points is a level. The points live in the flags (saved with everything else), as fitness does,
 * so the game can say "Logic went up to 2" the moment it happens.
 */

export const SKILLS = ['cooking', 'fitness', 'logic', 'creativity', 'charisma'] as const;
export type SkillKey = typeof SKILLS[number];

export const SKILL_LABEL: Record<SkillKey, string> = {
  cooking: 'Cooking', fitness: 'Fitness', logic: 'Logic', creativity: 'Creativity', charisma: 'Charisma',
};

/** The hobby activities (see activities.ts) and the skill each one trains. */
export const HOBBY_SKILL: Record<string, SkillKey> = {
  cook: 'cooking', grill: 'cooking',
  workout: 'fitness', lift: 'fitness', boxing: 'fitness', bike: 'fitness', swim: 'fitness', jumprope: 'fitness',
  shadowbox: 'fitness', yardWorkout: 'fitness',
  read: 'logic', journal: 'logic',
  piano: 'creativity', guitar: 'creativity', easel: 'creativity',
  dance: 'charisma', danceTogether: 'charisma', jukebox: 'charisma',
};

/** Game minutes of practice per point. A 30-minute piano session is two points. */
export const MINUTES_PER_POINT = 15;
/** Points for one full level. */
export const POINTS_PER_LEVEL = 10;
export const MAX_SKILL_LEVEL = 10;

export type SkillPoints = Record<SkillKey, number>;

export function skillPointsOf(flags: Record<string, unknown>): SkillPoints {
  const saved = (flags.skillPoints ?? {}) as Partial<SkillPoints>;
  return Object.fromEntries(SKILLS.map((k) => [k, typeof saved[k] === 'number' ? saved[k]! : 0])) as SkillPoints;
}

export function skillLevel(points: number): number {
  return Math.min(MAX_SKILL_LEVEL, Math.floor(points / POINTS_PER_LEVEL));
}

/**
 * Adds practice from the activity being done. Returns the skill and its new level when that level was just reached,
 * so the game can say so; otherwise null.
 */
export function tickHobby(flags: Record<string, unknown>, act: string | undefined, gameMin: number): { skill: SkillKey; level: number } | null {
  const skill = act ? HOBBY_SKILL[act] : undefined;
  if (!skill || gameMin <= 0) return null;
  const points = skillPointsOf(flags);
  const before = skillLevel(points[skill]);
  points[skill] += gameMin / MINUTES_PER_POINT;
  flags.skillPoints = points;
  const after = skillLevel(points[skill]);
  return after > before ? { skill, level: after } : null;
}
