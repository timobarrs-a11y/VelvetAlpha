import type { ConfidenceTier } from './types';

export interface MemorySeed {
  key: string;
  value: string | string[];
  confidence: number;
  source: 'questionnaire';
}

const CONFIDENCE_SCORES: Record<ConfidenceTier, number> = {
  confirmed: 0.95,
  tapped: 0.8,
  play: 0.4,
};

export function buildMemorySeeds(
  answers: Record<string, string | string[]>,
  confidenceMap: Record<string, ConfidenceTier>
): MemorySeed[] {
  const seeds: MemorySeed[] = [];
  for (const [key, value] of Object.entries(answers)) {
    if (value === undefined || value === null || value === '') continue;
    const tier = confidenceMap[key] || 'tapped';
    seeds.push({
      key,
      value,
      confidence: CONFIDENCE_SCORES[tier],
      source: 'questionnaire',
    });
  }
  return seeds;
}

export function shouldOverwrite(existing: MemorySeed | undefined, incoming: MemorySeed): boolean {
  if (!existing) return true;
  return incoming.confidence > existing.confidence;
}

export function mergeSeeds(existing: MemorySeed[], incoming: MemorySeed[]): MemorySeed[] {
  const map = new Map<string, MemorySeed>();
  for (const s of existing) map.set(s.key, s);
  for (const s of incoming) {
    const prev = map.get(s.key);
    if (shouldOverwrite(prev, s)) {
      map.set(s.key, s);
    }
  }
  return Array.from(map.values());
}
