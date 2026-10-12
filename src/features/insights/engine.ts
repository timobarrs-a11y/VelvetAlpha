import type { InsightCard, ReflectionAtom } from "./types";
import { runDeterministicGenerators } from "./generators";
import { getStarterFallbackInsights } from "./starterFallback";
import { generateProfileInsights, type ProfileData } from "./profileInsights";

export function generateInsights(atoms: ReflectionAtom[]): InsightCard[] {
  const safeAtoms = Array.isArray(atoms) ? atoms : [];

  const generated = runDeterministicGenerators(safeAtoms);

  if (!safeAtoms.length) {
    return getStarterFallbackInsights().slice(0, 6);
  }

  if (generated.length >= 3) return generated.slice(0, 6);

  const fallback = getStarterFallbackInsights();
  const merged: InsightCard[] = [...generated];

  for (const card of fallback) {
    if (merged.length >= 3) break;
    merged.push(card);
  }

  return merged.slice(0, 6);
}

export function generateInsightsWithProfile(
  atoms: ReflectionAtom[],
  profile: ProfileData | null
): InsightCard[] {
  if (!profile) return generateInsights(atoms);

  const safeAtoms = Array.isArray(atoms) ? atoms : [];
  const profileCards = generateProfileInsights(profile);
  const deterministicCards = safeAtoms.length > 0 ? runDeterministicGenerators(safeAtoms) : [];

  // Profile insights always come first (confirmed confidence), then deterministic,
  // then starter fallback to fill remaining slots.
  const merged: InsightCard[] = [...profileCards, ...deterministicCards];

  if (merged.length >= 6) return merged.slice(0, 8);

  const fallback = getStarterFallbackInsights();
  for (const card of fallback) {
    if (merged.length >= 8) break;
    if (!merged.some(c => c.id === card.id)) merged.push(card);
  }

  return merged.slice(0, 8);
}
