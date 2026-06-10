export interface DerbyOutcome {
  isHomeRun: boolean;
  distanceFeet: number;
  score: number;
}

const HOME_RUN_DISTANCE = 370;

export function toDisplayDistance(feet: number): number {
  return Math.max(0, Math.round(feet));
}

export function evaluateOutcome(distanceFeet: number, qualityBonus: number): DerbyOutcome {
  const roundedDistance = toDisplayDistance(distanceFeet);
  const isHomeRun = roundedDistance >= HOME_RUN_DISTANCE;
  const baseScore = isHomeRun ? 1000 : 150;
  const distanceScore = Math.floor(roundedDistance * 1.8);

  return {
    isHomeRun,
    distanceFeet: roundedDistance,
    score: baseScore + distanceScore + qualityBonus,
  };
}
