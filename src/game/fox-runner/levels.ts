import type { LevelDef } from './types';
import { T } from './config';

function solid(tx: number, ty: number, tw: number, th = 1) {
  return { x: tx * T, y: ty * T, width: tw * T, height: th * T, type: 'solid' as const, moveMin: 0, moveMax: 0, moveSpeed: 0 };
}

function movingH(tx: number, ty: number, tw: number, minTx: number, maxTx: number, speed = 1.5) {
  return { x: tx * T, y: ty * T, width: tw * T, height: T, type: 'moving_h' as const, moveMin: minTx * T, moveMax: maxTx * T, moveSpeed: speed };
}

function movingV(tx: number, ty: number, tw: number, minTy: number, maxTy: number, speed = 1.2) {
  return { x: tx * T, y: ty * T, width: tw * T, height: T, type: 'moving_v' as const, moveMin: minTy * T, moveMax: maxTy * T, moveSpeed: speed };
}

function crumble(tx: number, ty: number, tw: number) {
  return { x: tx * T, y: ty * T, width: tw * T, height: T, type: 'crumbling' as const, moveMin: 0, moveMax: 0, moveSpeed: 0 };
}

function spring(tx: number, ty: number) {
  return { x: tx * T, y: ty * T, width: T, height: T, type: 'spring' as const, moveMin: 0, moveMax: 0, moveSpeed: 0 };
}

function berry(tx: number, ty: number) {
  return { type: 'berry' as const, x: tx * T + T / 2, y: ty * T + T / 2 };
}

function gem(tx: number, ty: number) {
  return { type: 'gem' as const, x: tx * T + T / 2, y: ty * T + T / 2 };
}

function heart(tx: number, ty: number) {
  return { type: 'heart' as const, x: tx * T + T / 2, y: ty * T + T / 2 };
}

function powerup(tx: number, ty: number) {
  return { type: 'powerup' as const, x: tx * T + T / 2, y: ty * T + T / 2 };
}

function slime(tx: number, ty: number, pMinTx: number, pMaxTx: number) {
  return { type: 'slime' as const, x: tx * T, y: ty * T, patrolMin: pMinTx * T, patrolMax: pMaxTx * T };
}

function bat(tx: number, ty: number, pMinTx: number, pMaxTx: number) {
  return { type: 'bat' as const, x: tx * T, y: ty * T, patrolMin: pMinTx * T, patrolMax: pMaxTx * T };
}

function spiky(tx: number, ty: number, pMinTx: number, pMaxTx: number) {
  return { type: 'spiky' as const, x: tx * T, y: ty * T, patrolMin: pMinTx * T, patrolMax: pMaxTx * T };
}

function chaser(tx: number, ty: number, pMinTx: number, pMaxTx: number) {
  return { type: 'chaser' as const, x: tx * T, y: ty * T, patrolMin: pMinTx * T, patrolMax: pMaxTx * T };
}

function spike(tx: number, ty: number, tw = 1) {
  return { x: tx * T, y: ty * T + T / 2, width: tw * T, height: T / 2 };
}

function water(tx: number, ty: number, tw: number, th: number) {
  return { x: tx * T, y: ty * T, width: tw * T, height: th * T, type: 'water' as const };
}

function lava(tx: number, ty: number, tw: number, th: number) {
  return { x: tx * T, y: ty * T, width: tw * T, height: th * T, type: 'lava' as const };
}

const GY = 14;

export const LEVELS: LevelDef[] = [
  {
    id: 'meadow_path',
    name: 'Meadow Path',
    width: 90 * T,
    height: 20 * T,
    background: 'forest',
    deathY: 20 * T,
    timeLimit: 90,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 85 * T, y: (GY - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 10),
      solid(12, GY, 12),
      solid(26, GY, 16),
      solid(44, GY, 14),
      solid(60, GY, 8),
      solid(70, GY, 20),
      solid(10, 12, 3),
      solid(17, 11, 3),
      solid(30, 11, 4),
      solid(38, 10, 3),
      solid(50, 12, 3),
      solid(56, 10, 2),
      solid(64, 11, 3),
      solid(75, 11, 3),
      solid(81, 10, 2),
    ],
    enemies: [
      slime(16, GY - 1, 14, 22),
      slime(32, GY - 1, 28, 40),
      slime(48, GY - 1, 46, 56),
      slime(74, GY - 1, 72, 78),
    ],
    collectibles: [
      berry(5, GY - 1), berry(7, GY - 1),
      berry(14, GY - 1), berry(15, GY - 1),
      berry(11, 11), berry(18, 10), berry(19, 10),
      berry(31, 10), berry(32, 10), berry(33, 10),
      gem(39, 9),
      berry(50, 11), berry(51, 11),
      berry(57, 9),
      berry(72, GY - 1), berry(74, GY - 1),
      berry(76, 10), berry(77, 10),
      heart(65, 10),
      berry(82, 9), berry(83, GY - 1),
    ],
    spikes: [],
    hazardZones: [],
    checkpoints: [{ x: 30 * T, y: (GY - 1) * T }, { x: 64 * T, y: (GY - 1) * T }],
  },
  {
    id: 'treeline_trail',
    name: 'Treeline Trail',
    width: 105 * T,
    height: 20 * T,
    background: 'forest',
    deathY: 20 * T,
    timeLimit: 100,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 100 * T, y: (GY - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 8),
      solid(11, GY, 6),
      solid(20, GY, 10),
      solid(33, GY, 8),
      solid(46, GY, 6),
      solid(55, GY, 10),
      solid(68, GY, 6),
      solid(78, GY, 8),
      solid(90, GY, 15),
      movingH(8, 12, 3, 8, 11, 1.5),
      solid(17, 11, 3),
      solid(25, 10, 4),
      movingH(30, 10, 3, 28, 33, 1.8),
      solid(37, 11, 3),
      movingH(42, 12, 3, 41, 46, 2),
      solid(50, 10, 3),
      spring(53, GY - 1),
      solid(58, 8, 3),
      solid(62, 7, 2),
      movingV(65, 10, 2, 7, 13, 1.2),
      solid(72, 11, 3),
      solid(82, 10, 4),
      solid(87, 9, 2),
      solid(95, 11, 3),
    ],
    enemies: [
      slime(14, GY - 1, 12, 16),
      slime(24, GY - 1, 21, 28),
      bat(30, 8, 28, 36),
      slime(36, GY - 1, 34, 40),
      slime(58, GY - 1, 56, 64),
      bat(70, 7, 68, 76),
      slime(82, GY - 1, 79, 86),
      chaser(93, GY - 1, 90, 100),
    ],
    collectibles: [
      berry(4, GY - 1), berry(5, GY - 1),
      berry(9, 11), berry(10, 11),
      berry(18, 10),
      berry(26, 9), berry(27, 9), berry(28, 9),
      gem(31, 9),
      berry(43, 11), berry(44, 11),
      berry(51, 9), berry(52, 9),
      berry(59, 7), berry(60, 7),
      gem(63, 6),
      berry(73, 10), berry(74, 10),
      berry(83, 9), berry(84, 9),
      heart(88, 8),
      berry(92, GY - 1), berry(93, GY - 1),
      berry(96, 10), berry(97, 10),
    ],
    spikes: [],
    hazardZones: [
      water(8, GY + 1, 3, 3),
      water(17, GY + 1, 3, 3),
    ],
    checkpoints: [
      { x: 25 * T, y: (GY - 1) * T },
      { x: 60 * T, y: (GY - 1) * T },
    ],
  },
  {
    id: 'crystal_cavern',
    name: 'Crystal Cavern',
    width: 105 * T,
    height: 20 * T,
    background: 'cave',
    deathY: 20 * T,
    timeLimit: 110,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 100 * T, y: (GY - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 10),
      solid(13, GY, 5),
      solid(21, GY, 8),
      solid(32, GY, 6),
      solid(42, GY, 10),
      solid(56, GY, 6),
      solid(66, GY, 8),
      solid(78, GY, 6),
      solid(88, GY, 17),
      crumble(10, 12, 3),
      solid(15, 11, 3),
      crumble(19, 10, 2),
      solid(25, 9, 3),
      crumble(29, 10, 3),
      solid(35, 11, 3),
      crumble(39, 10, 3),
      solid(48, 10, 3),
      crumble(52, 11, 2),
      solid(58, 10, 3),
      crumble(62, 11, 2),
      solid(68, 10, 3),
      movingH(72, 11, 3, 72, 78, 1.5),
      solid(82, 10, 3),
      solid(86, 11, 2),
      solid(92, 11, 3),
      solid(96, 10, 2),
    ],
    enemies: [
      bat(12, 9, 10, 18),
      bat(27, 7, 23, 31),
      slime(34, GY - 1, 33, 37),
      bat(45, 8, 43, 51),
      bat(60, 8, 57, 65),
      slime(70, GY - 1, 67, 73),
      bat(80, 7, 78, 86),
      chaser(94, GY - 1, 90, 100),
    ],
    collectibles: [
      berry(4, GY - 1), berry(6, GY - 1),
      berry(11, 11), berry(12, 11),
      berry(16, 10), berry(17, 10),
      gem(26, 8),
      berry(30, 9), berry(31, 9),
      berry(36, 10), berry(37, 10),
      berry(49, 9), berry(50, 9),
      gem(59, 9),
      berry(69, 9), berry(70, 9),
      berry(73, 10), berry(74, 10),
      heart(83, 9),
      berry(90, GY - 1), berry(92, GY - 1),
      powerup(93, 10),
      berry(97, 9),
    ],
    spikes: [
      spike(18, GY - 1, 2),
      spike(38, GY - 1, 3),
      spike(54, GY - 1, 2),
      spike(76, GY - 1, 2),
    ],
    hazardZones: [
      lava(10, GY + 1, 3, 3),
    ],
    checkpoints: [
      { x: 26 * T, y: (GY - 1) * T },
      { x: 58 * T, y: (GY - 1) * T },
    ],
  },
  {
    id: 'cliffside',
    name: 'Cliffside',
    width: 100 * T,
    height: 22 * T,
    background: 'mountain',
    deathY: 22 * T,
    timeLimit: 120,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 95 * T, y: (6 - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 12),
      solid(14, GY, 6),
      solid(22, GY, 8),
      solid(32, 12, 5),
      solid(32, GY, 5),
      solid(38, 10, 4),
      solid(44, 8, 3),
      spring(48, GY - 1),
      solid(46, GY, 6),
      solid(50, 5, 4),
      solid(55, 7, 3),
      movingV(59, 8, 2, 5, 12, 1.3),
      solid(63, 5, 4),
      solid(68, 6, 3),
      movingH(72, 6, 3, 70, 76, 1.5),
      solid(78, 5, 4),
      spring(83, 7),
      solid(82, 8, 3),
      solid(86, 6, 4),
      solid(90, 6, 5),
      solid(95, 6, 5),
      solid(14, 10, 2, 4),
      solid(29, 10, 2, 4),
    ],
    enemies: [
      slime(17, GY - 1, 15, 19),
      spiky(26, GY - 1, 23, 29),
      slime(33, GY - 1, 33, 36),
      bat(40, 7, 38, 44),
      spiky(47, GY - 1, 47, 51),
      bat(56, 4, 53, 60),
      spiky(64, 4, 64, 67),
      bat(74, 4, 70, 78),
      chaser(91, 5, 90, 96),
    ],
    collectibles: [
      berry(5, GY - 1), berry(7, GY - 1),
      berry(16, GY - 1), berry(17, GY - 1),
      berry(33, 11), berry(34, 11),
      gem(40, 9),
      berry(45, 7), berry(46, 7),
      berry(51, 4), berry(52, 4),
      gem(56, 6),
      berry(64, 4), berry(65, 4),
      berry(69, 5), berry(70, 5),
      heart(80, 4),
      berry(87, 5), berry(88, 5),
      berry(92, 5), berry(93, 5),
    ],
    spikes: [
      spike(20, GY - 1, 2),
      spike(36, GY - 1, 2),
    ],
    hazardZones: [
      lava(12, GY + 1, 2, 4),
      water(52, GY, 3, 6),
    ],
    checkpoints: [
      { x: 26 * T, y: (GY - 1) * T },
      { x: 55 * T, y: 6 * T },
    ],
  },
  {
    id: 'sky_ruins',
    name: 'Sky Ruins',
    width: 125 * T,
    height: 22 * T,
    background: 'sky',
    deathY: 22 * T,
    timeLimit: 140,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 120 * T, y: (8 - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 8),
      movingH(9, 12, 3, 8, 14, 1.8),
      solid(16, 11, 4),
      crumble(21, 10, 3),
      solid(25, 9, 3),
      movingV(29, 9, 2, 6, 12, 1.4),
      solid(33, 7, 4),
      crumble(38, 8, 2),
      movingH(41, 7, 3, 40, 48, 2),
      solid(50, 8, 5),
      spring(56, 9),
      solid(55, 10, 3),
      solid(58, 5, 3),
      crumble(62, 6, 3),
      movingV(66, 7, 2, 4, 10, 1.5),
      solid(70, 5, 4),
      movingH(75, 6, 3, 74, 82, 2.2),
      solid(84, 5, 4),
      crumble(89, 6, 3),
      solid(93, 7, 3),
      spring(97, 8),
      solid(96, 9, 3),
      solid(99, 4, 3),
      movingH(103, 5, 3, 102, 108, 1.8),
      solid(110, 6, 3),
      solid(114, 8, 6),
      solid(119, 8, 6),
    ],
    enemies: [
      bat(12, 9, 9, 16),
      slime(17, 10, 17, 19),
      bat(28, 5, 25, 33),
      spiky(34, 6, 34, 36),
      bat(44, 5, 40, 50),
      slime(51, 7, 51, 54),
      bat(60, 3, 58, 66),
      spiky(71, 4, 71, 73),
      bat(78, 3, 74, 84),
      slime(85, 4, 85, 88),
      bat(94, 4, 92, 98),
      spiky(111, 5, 111, 113),
      chaser(115, 7, 114, 120),
    ],
    collectibles: [
      berry(3, GY - 1), berry(5, GY - 1),
      berry(10, 11), berry(11, 11),
      berry(17, 10), berry(18, 10),
      gem(26, 8),
      berry(34, 6), berry(35, 6),
      berry(42, 6), berry(43, 6),
      berry(51, 7), berry(52, 7),
      gem(59, 4),
      berry(62, 5), berry(63, 5),
      berry(71, 4), berry(72, 4),
      gem(77, 5),
      berry(85, 4), berry(86, 4),
      heart(94, 6),
      berry(100, 3), berry(101, 3),
      gem(105, 4),
      berry(111, 5), berry(112, 5),
      berry(116, 7), berry(117, 7),
    ],
    spikes: [
      spike(20, 11, 1),
      spike(37, 9, 1),
      spike(61, 7, 1),
      spike(88, 7, 2),
    ],
    hazardZones: [],
    checkpoints: [
      { x: 33 * T, y: 6 * T },
      { x: 70 * T, y: 4 * T },
      { x: 99 * T, y: 3 * T },
    ],
  },
  {
    id: 'molten_fortress',
    name: 'Molten Fortress',
    width: 130 * T,
    height: 24 * T,
    background: 'cave',
    deathY: 24 * T,
    timeLimit: 150,
    playerSpawn: { x: 2 * T, y: (GY - 1) * T },
    goal: { x: 125 * T, y: (6 - 2) * T, width: T * 2, height: T * 2 },
    platforms: [
      solid(0, GY, 8),
      solid(0, 8, 1, 6),
      solid(10, GY, 4),
      solid(16, GY, 6),
      solid(24, GY, 4),
      solid(30, GY, 6),
      solid(38, GY, 4),
      solid(44, GY, 8),
      solid(54, 12, 4),
      solid(60, GY, 6),
      solid(68, GY, 4),
      solid(74, GY, 6),
      solid(82, GY, 4),
      solid(88, GY, 8),
      solid(98, GY, 4),
      solid(104, GY, 6),
      solid(112, GY, 4),
      solid(118, GY, 12),

      solid(7, 10, 1, 4),
      solid(23, 8, 1, 6),
      solid(37, 8, 1, 6),
      solid(53, 8, 1, 4),
      solid(67, 8, 1, 6),
      solid(81, 8, 1, 6),

      solid(11, 11, 3),
      solid(19, 10, 3),
      crumble(27, 11, 3),
      solid(33, 10, 3),
      spring(42, GY - 1),
      solid(46, 9, 3),
      movingH(50, 10, 3, 49, 55, 1.8),
      solid(58, 8, 3),
      crumble(63, 11, 3),
      solid(70, 10, 3),
      movingV(76, 10, 2, 7, 13, 1.4),
      solid(80, 7, 4),
      crumble(85, 10, 3),
      movingH(90, 9, 3, 89, 96, 2),
      spring(96, GY - 1),
      solid(100, 8, 3),
      movingV(106, 9, 2, 6, 12, 1.5),
      solid(110, 6, 4),
      crumble(115, 8, 3),
      solid(120, 7, 3),
      solid(124, 6, 6),
    ],
    enemies: [
      slime(12, GY - 1, 10, 14),
      chaser(18, GY - 1, 16, 22),
      bat(26, 8, 24, 30),
      spiky(32, GY - 1, 30, 36),
      slime(46, GY - 1, 44, 52),
      bat(52, 7, 49, 58),
      chaser(62, GY - 1, 60, 66),
      spiky(70, GY - 1, 68, 74),
      bat(78, 5, 74, 84),
      chaser(90, GY - 1, 88, 96),
      bat(102, 6, 98, 108),
      spiky(114, GY - 1, 112, 116),
      chaser(120, GY - 1, 118, 126),
    ],
    collectibles: [
      berry(3, GY - 1), berry(5, GY - 1),
      berry(11, 10), berry(12, 10),
      gem(20, 9),
      berry(28, 10), berry(29, 10),
      berry(34, 9), berry(35, 9),
      berry(47, 8), berry(48, 8),
      gem(51, 9),
      berry(59, 7), berry(60, 7),
      berry(64, 10),
      gem(71, 9),
      berry(77, 9),
      berry(81, 6), berry(82, 6),
      heart(86, 9),
      berry(91, 8), berry(92, 8),
      gem(101, 7),
      berry(107, 8),
      berry(111, 5), berry(112, 5),
      heart(116, 7),
      powerup(121, 6),
      berry(125, 5), berry(126, 5),
    ],
    spikes: [
      spike(14, GY - 1, 2),
      spike(28, GY - 1, 2),
      spike(40, GY - 1, 2),
      spike(56, GY - 1, 2),
      spike(72, GY - 1, 2),
      spike(84, GY - 1, 2),
      spike(102, GY - 1, 2),
    ],
    hazardZones: [
      lava(8, GY + 1, 2, 6),
      lava(22, GY + 1, 2, 6),
      lava(36, GY + 1, 2, 6),
      lava(52, GY + 1, 2, 6),
      lava(66, GY + 1, 2, 6),
      lava(96, GY + 1, 2, 6),
      lava(110, GY + 1, 2, 6),
    ],
    checkpoints: [
      { x: 33 * T, y: (GY - 1) * T },
      { x: 70 * T, y: (GY - 1) * T },
      { x: 110 * T, y: 5 * T },
    ],
  },
];
