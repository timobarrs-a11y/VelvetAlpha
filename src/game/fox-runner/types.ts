export interface Vec2 {
  x: number;
  y: number;
}

export interface Player {
  pos: Vec2;
  vel: Vec2;
  width: number;
  height: number;
  facing: 1 | -1;
  grounded: boolean;
  jumping: boolean;
  jumpHeld: boolean;
  jumpTimer: number;
  coyoteTimer: number;
  lives: number;
  invulnerableTimer: number;
  animFrame: number;
  animTimer: number;
  squash: number;
  dustTimer: number;
  dead: boolean;
  respawnTimer: number;
  stompBounce: boolean;
  wallSliding: boolean;
  wallSlideDir: 1 | -1;
  wallJumpCooldown: number;
  hasDoubleJump: boolean;
  doubleJumpUsed: boolean;
}

export interface Enemy {
  id: string;
  type: 'slime' | 'bat' | 'spiky' | 'chaser';
  pos: Vec2;
  vel: Vec2;
  width: number;
  height: number;
  active: boolean;
  facing: 1 | -1;
  animFrame: number;
  animTimer: number;
  patrolMin: number;
  patrolMax: number;
  baseY: number;
  sineTimer: number;
  deathTimer: number;
}

export interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'solid' | 'moving_h' | 'moving_v' | 'crumbling' | 'spring';
  moveMin: number;
  moveMax: number;
  moveSpeed: number;
  moveDir: number;
  crumbleTimer: number;
  crumbling: boolean;
  crumbled: boolean;
  springTimer: number;
  origX: number;
  origY: number;
}

export interface Collectible {
  id: string;
  pos: Vec2;
  type: 'berry' | 'gem' | 'heart' | 'powerup';
  collected: boolean;
  bobTimer: number;
}

export interface HazardZone {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'water' | 'lava';
}

export interface ScorePopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface Spike {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  activated: boolean;
}

export interface LevelGoal {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface EnemySpawn {
  type: 'slime' | 'bat' | 'spiky' | 'chaser';
  x: number;
  y: number;
  patrolMin: number;
  patrolMax: number;
}

export interface CollectibleSpawn {
  type: 'berry' | 'gem' | 'heart' | 'powerup';
  x: number;
  y: number;
}

export interface HazardZoneSpawn {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'water' | 'lava';
}

export type BackgroundTheme = 'forest' | 'cave' | 'sky' | 'mountain';

export interface LevelDef {
  id: string;
  name: string;
  width: number;
  height: number;
  platforms: Omit<Platform, 'moveDir' | 'crumbleTimer' | 'crumbling' | 'crumbled' | 'springTimer' | 'origX' | 'origY'>[];
  enemies: EnemySpawn[];
  collectibles: CollectibleSpawn[];
  spikes: Spike[];
  hazardZones: HazardZoneSpawn[];
  checkpoints: { x: number; y: number }[];
  goal: LevelGoal;
  playerSpawn: Vec2;
  background: BackgroundTheme;
  deathY: number;
  timeLimit: number;
}

export interface GameState {
  player: Player;
  platforms: Platform[];
  enemies: Enemy[];
  collectibles: Collectible[];
  spikes: Spike[];
  hazardZones: HazardZone[];
  checkpoints: Checkpoint[];
  goal: LevelGoal;
  particles: Particle[];
  scorePopups: ScorePopup[];
  camera: Vec2;
  score: number;
  berries: number;
  currentLevel: number;
  totalLevels: number;
  phase: 'title' | 'playing' | 'paused' | 'level_complete' | 'game_over' | 'victory';
  levelCompleteTimer: number;
  deathY: number;
  background: BackgroundTheme;
  levelWidth: number;
  levelHeight: number;
  lastCheckpoint: Vec2;
  time: number;
  timeLimit: number;
  enemiesStomped: number;
  deaths: number;
  comboCount: number;
  comboTimer: number;
  gemsCollected: number;
  powerupsCollected: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpJustPressed: boolean;
  pause: boolean;
  pauseJustPressed: boolean;
}
