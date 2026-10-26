// Static Momentum content: theme presets and career levels.
import { createRng, generateLevel, seedFromString } from './levelGen';

export const themePresets = [
  { name: 'Neon Cityscape', icon: '🌃', hint: 'Cyberpunk rooftops' },
  { name: 'Ancient Ruins', icon: '🏛️', hint: 'Crumbling temples' },
  { name: 'Candy Kingdom', icon: '🍭', hint: 'Sweet dreamland' },
  { name: 'Deep Ocean', icon: '🌊', hint: 'Bioluminescent depths' },
  { name: 'Volcanic Forge', icon: '🌋', hint: 'Molten fire' },
  { name: 'Crystal Caves', icon: '💎', hint: 'Shimmering underground' },
];

export interface CareerLevel {
  number: number;
  name: string;
  theme: string;
  timeLimit: number;
  threeStarTime: number;
  twoStarTime: number;
  difficulty: number;
}

const careerLevelDefs: Omit<CareerLevel, 'timeLimit' | 'threeStarTime' | 'twoStarTime'>[] = [
  { number: 1, name: "First Steps", theme: "Neon Cityscape", difficulty: 1 },
  { number: 2, name: "Rising Fast", theme: "Crystal Caves", difficulty: 2 },
  { number: 3, name: "Quick Reflexes", theme: "Candy Kingdom", difficulty: 3 },
  { number: 4, name: "Under Pressure", theme: "Deep Ocean", difficulty: 4 },
  { number: 5, name: "Speed Demon", theme: "Volcanic Forge", difficulty: 5 },
  { number: 6, name: "Against the Clock", theme: "Ancient Ruins", difficulty: 6 },
  { number: 7, name: "Time Trial", theme: "Neon Cityscape", difficulty: 7 },
  { number: 8, name: "Racing Shadows", theme: "Crystal Caves", difficulty: 8 },
  { number: 9, name: "Final Sprint", theme: "Volcanic Forge", difficulty: 9 },
  { number: 10, name: "Legend", theme: "Deep Ocean", difficulty: 10 }
];

/** Climb rates (px/s) a player needs for each tier; they rise gently with difficulty. */
const RATE_LIMIT = (d: number) => 110 + d * 8;
const RATE_THREE_STAR = (d: number) => 210 + d * 12;

/** Career levels are seeded, so time limits come from each level's real climb height. */
export const careerTimes = (number: number, difficulty: number) => {
  const palette = { platforms: ['#fff'], glows: ['#fff'], checkpoint: '#fff', checkpointGlow: '#fff' };
  const { goalY } = generateLevel(difficulty, palette, createRng(seedFromString(`career-${number}`)));
  const height = 520 - goalY;
  const timeLimit = Math.round(height / RATE_LIMIT(difficulty));
  const threeStarTime = Math.round(height / RATE_THREE_STAR(difficulty));
  const twoStarTime = Math.round((timeLimit + threeStarTime) / 2);
  return { timeLimit, threeStarTime, twoStarTime };
};

export const careerLevels: CareerLevel[] = careerLevelDefs.map(l => ({ ...l, ...careerTimes(l.number, l.difficulty) }));
