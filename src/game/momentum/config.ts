// Static Momentum content: theme presets and career levels.

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

export const careerLevels: CareerLevel[] = [
  { number: 1, name: "First Steps", theme: "Neon Cityscape", timeLimit: 45, threeStarTime: 30, twoStarTime: 37, difficulty: 1 },
  { number: 2, name: "Rising Fast", theme: "Crystal Caves", timeLimit: 50, threeStarTime: 35, twoStarTime: 42, difficulty: 2 },
  { number: 3, name: "Quick Reflexes", theme: "Candy Kingdom", timeLimit: 40, threeStarTime: 28, twoStarTime: 34, difficulty: 3 },
  { number: 4, name: "Under Pressure", theme: "Deep Ocean", timeLimit: 38, threeStarTime: 26, twoStarTime: 32, difficulty: 4 },
  { number: 5, name: "Speed Demon", theme: "Volcanic Forge", timeLimit: 35, threeStarTime: 24, twoStarTime: 29, difficulty: 5 },
  { number: 6, name: "Against the Clock", theme: "Ancient Ruins", timeLimit: 33, threeStarTime: 22, twoStarTime: 27, difficulty: 6 },
  { number: 7, name: "Time Trial", theme: "Neon Cityscape", timeLimit: 30, threeStarTime: 20, twoStarTime: 25, difficulty: 7 },
  { number: 8, name: "Racing Shadows", theme: "Crystal Caves", timeLimit: 28, threeStarTime: 19, twoStarTime: 23, difficulty: 8 },
  { number: 9, name: "Final Sprint", theme: "Volcanic Forge", timeLimit: 25, threeStarTime: 17, twoStarTime: 21, difficulty: 9 },
  { number: 10, name: "Legend", theme: "Deep Ocean", timeLimit: 22, threeStarTime: 15, twoStarTime: 18, difficulty: 10 }
];
