export type GameState = 'title' | 'story' | 'playing' | 'waveComplete' | 'gameOver' | 'sectorPreview';

export type WeaponType = 'standard' | 'spread' | 'laser' | 'rapid';

export type EnemyType = 'drone' | 'striker' | 'heavy' | 'speeder' | 'bomber';

export type EnemyVariant = 'A' | 'B' | 'C';

export type EnemyPattern = 'swoop' | 'zigzag' | 'pincer' | 'spiral' | 'diamond' | 'stream';

export type EnemyState = 'entering' | 'formation' | 'diving' | 'returning';

export type AttackPattern = 'standard' | 'kamikaze' | 'loop' | 'strafe';

export interface FormationPosition {
  row: number;
  col: number;
  x: number;
  y: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  shield: number;
  lives: number;
  weapon: WeaponType;
  weaponTimer: number;
  deflectCooldown: number;
  isDeflecting: boolean;
  invincibilityFrames: number;
}

export interface Enemy {
  id: string;
  type: EnemyType;
  variant: EnemyVariant;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  shootCooldown: number;
  pattern: EnemyPattern;
  patternPhase: number;
  isElite: boolean;
  state: EnemyState;
  formationPosition: FormationPosition | null;
  entryProgress: number;
  entryPathIndex: number;
  diveProgress: number;
  attackPattern: AttackPattern;
  shotsFired: number;
  guaranteedShotsStatus: { start: boolean; mid: boolean; end: boolean };
}

export interface Boss extends Omit<Enemy, 'type' | 'pattern'> {
  phase: 1 | 2;
  turrets: Turret[];
  name: string;
  entryComplete: boolean;
}

export interface Turret {
  offsetX: number;
  offsetY: number;
  angle: number;
  cooldown: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  damage: number;
  owner: 'player' | 'enemy';
  type: WeaponType;
  color: string;
  isDeflected: boolean;
}

export interface Powerup {
  id: string;
  x: number;
  y: number;
  vy: number;
  type: WeaponType;
  width: number;
  height: number;
}

export interface Sector {
  number: number;
  name: string;
  hueStart: string;
  hueEnd: string;
  starDensity: number;
  starColors: string[];
  starSizes: [number, number];
  twinkle: boolean;
  feature: SectorFeature;
  mood: string;
  storyBeat: string;
}

export interface SectorFeature {
  type: 'planet' | 'asteroids' | 'nebula' | 'debris' | 'suns' | 'ice' | 'void' | 'structures' | 'core';
  elements: FeatureElement[];
}

export interface FeatureElement {
  type: 'circle' | 'ellipse' | 'rect' | 'polygon';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  rx?: number;
  ry?: number;
  color: string;
  opacity: number;
  blur?: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  color: string;
  layer: number;
  speed: number;
  twinklePhase?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'explosion' | 'spark' | 'trail' | 'impact';
}

export interface GameStats {
  score: number;
  wave: number;
  sector: number;
  enemiesRemaining: number;
  combo: number;
  highScore: number;
  comboMultiplier: number;
  lastKillTime: number;
  damageTaken: boolean;
}
