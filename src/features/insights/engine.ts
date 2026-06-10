import type { InsightCard, ReflectionAtom } from "./types";
import { runDeterministicGenerators } from "./generators";
import { getStarterFallbackInsights } from "./starterFallback";

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
