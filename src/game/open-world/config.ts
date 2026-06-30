// Velvet City — a small, original top-down open-world prototype.
// All tuning constants live here so the feel can be iterated quickly.
// No third-party game assets are used: every sprite is generated at runtime.

export const WORLD = {
  blocks: 9, // city is blocks x blocks
  block: 340, // px per city block (building + surrounding road)
  road: 96, // width of a road strip
  get size() {
    return this.blocks * this.block;
  },
};

export const CAR = {
  maxSpeed: 360,
  reverseSpeed: 150,
  accel: 360, // px/s added per second of throttle
  brake: 520,
  // idle friction: fraction of speed shed per second when coasting
  friction: 0.9,
  turnRate: 3.0, // rad/s at full speed
  width: 50, // length along travel axis
  height: 26,
};

export const COP = {
  maxSpeed: 330,
  accel: 300,
  turnRate: 2.6,
  // how close (px) a cop must be, and for how long (ms), to bust the player
  bustRange: 70,
  bustTime: 1600,
};

export const PLAYER = {
  speed: 150,
  size: 16,
};

export const PED = {
  count: 70,
  speed: 45,
  // car must be moving faster than this (px/s) to injure a pedestrian
  dangerSpeed: 120,
};

export const WANTED = {
  max: 5,
  // wanted gained per pedestrian hit
  perHit: 1,
  // ms of not committing crimes before one star cools off
  coolMs: 9000,
};

// Palette — a deliberately moody, neon-noir city.
export const COLORS = {
  grass: 0x10241c,
  road: 0x23262e,
  roadLine: 0x4a4f5c,
  sidewalk: 0x2f333d,
  buildings: [0x3b2f4a, 0x2f3b4a, 0x4a3b2f, 0x2f4a3b, 0x4a2f3b, 0x39394a],
  playerCar: 0xff5e7e,
  copCar: 0x3a7bff,
  ped: 0xc9c9d6,
  foot: 0xffd86b,
};
