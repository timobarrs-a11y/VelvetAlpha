import type { InsightConfidence } from "./types";

export function calculateConfidence(atomCount: number): InsightConfidence {
  if (atomCount >= 6) return "confirmed";
  if (atomCount >= 3) return "early";
  return "starter";
}
