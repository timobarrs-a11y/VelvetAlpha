/**
 * The designer reviews the house once a game day and gives it a letter grade. The grade comes from things that take
 * real effort, and the anti-cheese rules are written into the scoring:
 *  - Variety counts kinds of furniture, not how many pieces. Ten sofas is one kind.
 *  - Redesign counts *net* changes at review time. Moving a chair out and back again changes nothing.
 *  - Tidiness is a gate: a messy house can't get an A.
 *  - An A needs real variety and real change, not just a good score.
 *  - The first review only sets the baseline; no grade is given until the house has changed since.
 *  - One review a day, and a stored item doesn't count (only pieces placed in the house do).
 * Progress is shown in plain numbers: how many A grades until the next reward tier.
 */
import type { ObjectInstance } from './objects';

export type Grade = 'A' | 'B' | 'C' | 'D';

export interface DesignerPart { label: string; points: number; max: number; note: string }

export interface DesignerState {
  /** The game day of the last review, or null before the first. */
  day: number | null;
  /** The kinds of furniture and the placement of each piece at the last review. */
  types: string[];
  layout: Record<string, string>;
  /** Grades so far, and the last review's result for the phone. */
  aCount: number;
  reviews: number;
  last: { day: number; grade: Grade | null; score: number; parts: DesignerPart[]; note: string } | null;
}

export const EMPTY_DESIGNER: DesignerState = { day: null, types: [], layout: {}, aCount: 0, reviews: 0, last: null };

/** How many A grades each reward tier takes. Tier 1 is the first reward. */
export const TIER_AT = [1, 3, 6];

export function tierOf(aCount: number): number {
  return TIER_AT.filter((at) => aCount >= at).length;
}

/** The A count that unlocks the next tier, or null when every tier is open. */
export function nextTierAt(aCount: number): number | null {
  return TIER_AT.find((at) => aCount < at) ?? null;
}

export function designerOf(flags: Record<string, unknown>): DesignerState {
  const saved = (flags.designer ?? {}) as Partial<DesignerState>;
  return { ...EMPTY_DESIGNER, ...saved, layout: saved.layout ?? {}, types: saved.types ?? [] };
}

const placeKey = (o: ObjectInstance): string => `${o.level}:${o.x}:${o.y}:${o.rot}`;

export interface ReviewResult {
  grade: Grade | null;
  score: number;
  parts: DesignerPart[];
  note: string;
  state: DesignerState;
  tierUp: number | null;
}

/** Looks at the house as it is now and grades it. Pure: returns the new designer state, and the caller saves it. */
export function reviewHouse(objs: ObjectInstance[], tidy: number, day: number, prev: DesignerState): ReviewResult {
  const placed = objs.filter((o) => o.type !== 'garden' && o.type !== 'sprinkler');
  const types = [...new Set(placed.map((o) => o.type))];
  const looks = new Set(placed.filter((o) => o.col || o.skin).map((o) => `${o.type}:${o.col ?? ''}:${o.skin ?? ''}`));
  const layout: Record<string, string> = Object.fromEntries(placed.map((o) => [o.id, placeKey(o)]));

  const baseline = prev.reviews === 0 || Object.keys(prev.layout).length === 0;
  const changed = baseline ? 0 : new Set([
    ...Object.keys(layout).filter((id) => prev.layout[id] !== layout[id]),
    ...Object.keys(prev.layout).filter((id) => !(id in layout)),
  ]).size;
  const newKinds = types.filter((t) => !prev.types.includes(t)).length;

  const parts: DesignerPart[] = [
    { label: 'Variety', points: Math.round(Math.min(types.length, 12) / 12 * 35), max: 35, note: `${types.length} kinds of furniture` },
    { label: 'Looks', points: Math.round(Math.min(looks.size, 8) / 8 * 15), max: 15, note: `${looks.size} colours and styles` },
    { label: 'Tidiness', points: Math.round(Math.max(0, Math.min(100, tidy)) / 100 * 25), max: 25, note: `tidy at ${Math.round(tidy)}` },
    { label: 'Redesign', points: baseline ? 0 : Math.round(Math.min(changed, 6) / 6 * 15), max: 15, note: baseline ? 'first look, nothing to compare' : `${changed} pieces moved for good` },
    { label: 'New pieces', points: baseline ? 0 : Math.round(Math.min(newKinds, 3) / 3 * 10), max: 10, note: `${newKinds} new kinds since last review` },
  ];
  const score = parts.reduce((n, p) => n + p.points, 0);

  let grade: Grade | null = null;
  let note = '';
  if (baseline) {
    note = 'This is your first look. Change the house, then call me back for a grade.';
  } else {
    // An A needs the score and the effort: real variety, real change, and a tidy house.
    const aOk = types.length >= 8 && changed >= 2 && tidy >= 70;
    grade = score >= 85 && aOk ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
    if (grade === 'A' && !aOk) grade = 'B';
    if (tidy < 40 && grade !== 'D') grade = 'C';
    if (grade === 'A') note = 'A. Keep going: the next reward is at ' + (nextTierAt(prev.aCount + 1) ?? 'the top') + ' A grades.';
    else if (score >= 85 && !aOk) note = [types.length < 8 && 'Try more kinds of furniture.', changed < 2 && 'Move a few things for good.', tidy < 70 && 'Clean up first.'].filter(Boolean).join(' ');
    else note = 'Keep at it. Look at what is lowest on the card.';
  }

  const aCount = prev.aCount + (grade === 'A' ? 1 : 0);
  const tierUp = tierOf(aCount) > tierOf(prev.aCount) ? tierOf(aCount) : null;
  const state: DesignerState = {
    day, types, layout, aCount, reviews: prev.reviews + 1,
    last: { day, grade, score, parts, note },
  };
  return { grade, score, parts, note, state, tierUp };
}
