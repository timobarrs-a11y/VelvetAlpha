import { Sector } from '../types/stellarPursuit';

export const GAME_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 1920;
export const GAME_HEIGHT = typeof window !== 'undefined' ? window.innerHeight : 1080;

export const PLAYER_WIDTH = 70;
export const PLAYER_HEIGHT = 55;
export const PLAYER_SPEED = 16;
export const STARTING_LIVES = 3;

export const BULLET_SPEED = 14;
export const ENEMY_BULLET_SPEED = 6;
export const AUTO_FIRE_RATE = 180;
export const MANUAL_FIRE_RATE = 80;
export const INVINCIBILITY_DURATION = 60;

export const SHIELD_MAX = 100;
export const SHIELD_REGEN = 0.15;
export const DEFLECT_COST = 20;
export const DEFLECT_COOLDOWN = 20;
export const DEFLECT_DURATION = 300;
export const DEFLECT_RADIUS = 60;

export const POWERUP_DURATION = 6000;
export const POWERUP_DROP_RATE = 0.18;

export const WEAPON_CONFIGS = {
  standard: {
    color: '#00ffff',
    spread: 1,
    damage: 1,
    fireRate: 180,
    manualFireRate: 80,
    spreadAngles: [0]
  },
  spread: {
    color: '#ff00ff',
    spread: 3,
    damage: 1,
    fireRate: 200,
    manualFireRate: null,
    spreadAngles: [-15, 0, 15]
  },
  laser: {
    color: '#ff0000',
    spread: 1,
    damage: 3,
    fireRate: 280,
    manualFireRate: null,
    spreadAngles: [0]
  },
  rapid: {
    color: '#ffff00',
    spread: 1,
    damage: 1,
    fireRate: 100,
    manualFireRate: null,
    spreadAngles: [0]
  }
};

export const ENEMY_CONFIGS = {
  drone: {
    width: 30,
    height: 25,
    baseHealth: 1,
    colors: {
      hull: '#333333',
      hullDark: '#222222',
      accent: '#ff6600',
      eye: '#ff0000'
    }
  },
  striker: {
    width: 35,
    height: 28,
    baseHealth: 1,
    colors: {
      hull: '#2a1a2a',
      hullDark: '#3a2a4a',
      accent: '#ff00ff',
      eye: '#ff00ff'
    }
  },
  heavy: {
    width: 45,
    height: 35,
    baseHealth: 2,
    colors: {
      hull: '#2a0a0a',
      hullDark: '#3a1515',
      accent: '#ff3333',
      eye: '#ff0000'
    }
  },
  speeder: {
    width: 25,
    height: 40,
    baseHealth: 1,
    colors: {
      hull: '#111111',
      hullDark: '#000000',
      accent: '#ffffff',
      eye: '#00ffff'
    }
  },
  bomber: {
    width: 50,
    height: 30,
    baseHealth: 3,
    colors: {
      hull: '#2a2a20',
      hullDark: '#1a1a10',
      accent: '#ffcc00',
      eye: '#ff8800'
    }
  }
};

export const MOVEMENT_PATTERNS = {
  swoop: {
    descendSpeed: 1.5,
    sineAmplitude: 2,
    sineFrequency: 0.05
  },
  zigzag: {
    descendSpeed: 1,
    sineAmplitude: 3,
    sineFrequency: 0.08
  },
  pincer: {
    descendSpeed: 2.5,
    sineAmplitude: 1.5,
    sineFrequency: 0.03
  },
  spiral: {
    descendSpeed: 1.5,
    sineAmplitude: 2.5,
    sineFrequency: 0.04
  },
  diamond: {
    descendSpeed: 2,
    sineAmplitude: 1,
    sineFrequency: 0.02
  },
  stream: {
    descendSpeed: 1.8,
    sineAmplitude: 2,
    sineFrequency: 0.06
  }
};

export const FORMATION = {
  rows: 5,
  cols: 8,
  startY: 100,
  rowSpacing: 60,
  colSpacing: 80,
  centerX: GAME_WIDTH / 2,
  bobAmplitude: 3,
  bobFrequency: 0.02,
  swayAmplitude: 60,
  swayFrequency: 0.005,
  formationShootChance: 0.004,
  formationShootCooldown: 100
};

export const DIVE_CONFIG = {
  minInterval: 120,
  maxInterval: 240,
  diveSpeed: 4,
  returnSpeed: 3,
  shootChancePerFrame: 0.25,
  shootCooldown: 18,
  eliteShootMultiplier: 1.5,
  guaranteedShots: {
    start: 0.1,
    mid: 0.5,
    end: 0.9
  }
};

export const ATTACK_PATTERNS = {
  standard: {
    name: 'Standard Dive',
    weight: 1.0,
    kamikazeChance: 0
  },
  kamikaze: {
    name: 'Kamikaze Dive',
    weight: 0.15,
    kamikazeChance: 1,
    shootMultiplier: 2
  },
  loop: {
    name: 'Loop Dive',
    weight: 0.2,
    shootMultiplier: 1.3
  },
  strafe: {
    name: 'Strafe Dive',
    weight: 0.15,
    shootMultiplier: 1.2
  }
};

export const DIFFICULTY_SCALING = {
  waves: [
    { min: 1, max: 2, divers: 1, speedMult: 0.8, shootMult: 0.7 },
    { min: 3, max: 5, divers: 1, speedMult: 1.0, shootMult: 1.0 },
    { min: 6, max: 10, divers: 2, speedMult: 1.15, shootMult: 1.3 },
    { min: 11, max: 20, divers: 3, speedMult: 1.3, shootMult: 1.6 },
    { min: 21, max: 999, divers: 4, speedMult: 1.5, shootMult: 2.0 }
  ]
};

export const SCORING = {
  normalKill: 100,
  eliteKill: 200,
  deflectedBullet: 50,
  deflectedBulletDamage: 2,
  bossKill: 5000,
  perfectWaveBonus: 1000,
  comboMultiplierIncrement: 0.1,
  comboDecayTime: 180
};

export const SCREEN_SHAKE = {
  deflect: 1.5,
  playerHit: 3,
  bossPhase: 4.5,
  bossDeath: 6
};

export const SECTORS: Sector[] = [
  {
    number: 1,
    name: 'OUTER RIM',
    hueStart: '#000022',
    hueEnd: '#000044',
    starDensity: 20,
    starColors: ['#ffffff', '#f0f0ff'],
    starSizes: [1, 2],
    twinkle: true,
    mood: 'Lonely, just left home',
    storyBeat: 'TRANSMISSION INTERCEPTED... They took them toward the Vega Expanse...',
    feature: {
      type: 'planet',
      elements: [
        {
          type: 'circle',
          x: 350,
          y: 100,
          radius: 20,
          color: '#4a90e2',
          opacity: 0.6,
          blur: 2
        }
      ]
    }
  },
  {
    number: 2,
    name: 'ASTEROID BELT',
    hueStart: '#0a0808',
    hueEnd: '#1a1515',
    starDensity: 30,
    starColors: ['#ffffff', '#fff8e0'],
    starSizes: [1, 2.5],
    twinkle: false,
    mood: 'Industrial, mining territory',
    storyBeat: 'SCANNER ALERT: Hostile signatures detected. They don\'t want you following.',
    feature: {
      type: 'asteroids',
      elements: [
        { type: 'circle', x: 80, y: 150, radius: 15, color: '#4a4038', opacity: 0.5 },
        { type: 'circle', x: 300, y: 250, radius: 20, color: '#3a3028', opacity: 0.6 },
        { type: 'circle', x: 150, y: 400, radius: 12, color: '#5a5048', opacity: 0.4 },
        { type: 'circle', x: 320, y: 450, radius: 18, color: '#4a4038', opacity: 0.55 }
      ]
    }
  },
  {
    number: 3,
    name: 'NEBULA VEIL',
    hueStart: '#110022',
    hueEnd: '#220044',
    starDensity: 60,
    starColors: ['#ff88ff', '#cc66ff', '#ffffff'],
    starSizes: [1, 3],
    twinkle: true,
    mood: 'Beautiful but dangerous',
    storyBeat: 'CORRUPTED DATA RECOVERED: ...the children are valuable to them...',
    feature: {
      type: 'nebula',
      elements: [
        { type: 'ellipse', x: 100, y: 200, rx: 120, ry: 80, color: '#8844aa', opacity: 0.15, blur: 20 },
        { type: 'ellipse', x: 300, y: 350, rx: 150, ry: 100, color: '#aa44cc', opacity: 0.12, blur: 25 },
        { type: 'ellipse', x: 200, y: 100, rx: 100, ry: 60, color: '#cc66ff', opacity: 0.1, blur: 18 }
      ]
    }
  },
  {
    number: 4,
    name: 'DEAD ZONE',
    hueStart: '#080a08',
    hueEnd: '#101510',
    starDensity: 13,
    starColors: ['#88aa88', '#aaccaa'],
    starSizes: [1, 1.5],
    twinkle: false,
    mood: 'Graveyard, ominous',
    storyBeat: 'DEEP SPACE BEACON: You\'re getting closer. They know you\'re coming.',
    feature: {
      type: 'debris',
      elements: [
        { type: 'rect', x: 120, y: 180, width: 40, height: 20, color: '#334433', opacity: 0.4 },
        { type: 'rect', x: 250, y: 320, width: 30, height: 35, color: '#445544', opacity: 0.35 },
        { type: 'rect', x: 80, y: 420, width: 25, height: 25, color: '#223322', opacity: 0.3 }
      ]
    }
  },
  {
    number: 5,
    name: 'BINARY STAR',
    hueStart: '#0a0500',
    hueEnd: '#1a0a00',
    starDensity: 25,
    starColors: ['#ffaa66', '#ffcc88', '#ffffff'],
    starSizes: [1, 2],
    twinkle: true,
    mood: 'Heat, intensity',
    storyBeat: 'WARNING: CAPITAL SHIP DETECTED. Designation: WARDEN-CLASS',
    feature: {
      type: 'suns',
      elements: [
        { type: 'circle', x: 80, y: 80, radius: 50, color: '#ff8844', opacity: 0.3, blur: 30 },
        { type: 'circle', x: 320, y: 520, radius: 45, color: '#ffaa44', opacity: 0.25, blur: 28 }
      ]
    }
  },
  {
    number: 6,
    name: 'ICE FIELD',
    hueStart: '#001015',
    hueEnd: '#002025',
    starDensity: 35,
    starColors: ['#aaffff', '#ccffff', '#ffffff'],
    starSizes: [1, 2.5],
    twinkle: true,
    mood: 'Cold, silent',
    storyBeat: 'SYSTEMS WARNING: Temperature dropping. Hull integrity at 85%.',
    feature: {
      type: 'ice',
      elements: [
        { type: 'circle', x: 100, y: 200, radius: 18, color: '#88ccff', opacity: 0.3 },
        { type: 'circle', x: 280, y: 300, radius: 22, color: '#aaddff', opacity: 0.35 },
        { type: 'circle', x: 160, y: 450, radius: 15, color: '#99ddff', opacity: 0.28 }
      ]
    }
  },
  {
    number: 7,
    name: 'DARK MATTER RIFT',
    hueStart: '#000005',
    hueEnd: '#0a0010',
    starDensity: 18,
    starColors: ['#8866ff', '#aa88ff'],
    starSizes: [1, 2],
    twinkle: false,
    mood: 'Wrong, alien',
    storyBeat: 'NAVIGATION ERROR: Space-time anomaly detected. Sensors malfunctioning.',
    feature: {
      type: 'void',
      elements: [
        { type: 'ellipse', x: 200, y: 300, rx: 80, ry: 150, color: '#4400aa', opacity: 0.2, blur: 15 },
        { type: 'ellipse', x: 200, y: 300, rx: 60, ry: 120, color: '#2200aa', opacity: 0.3, blur: 10 }
      ]
    }
  },
  {
    number: 8,
    name: 'ENEMY TERRITORY',
    hueStart: '#0a0000',
    hueEnd: '#150500',
    starDensity: 45,
    starColors: ['#ff8866', '#ffaa88'],
    starSizes: [1.5, 2],
    twinkle: false,
    mood: 'You\'re in their space now',
    storyBeat: 'PROXIMITY ALERT: Multiple hostiles. This is their home. Fight harder.',
    feature: {
      type: 'structures',
      elements: [
        { type: 'rect', x: 320, y: 120, width: 60, height: 80, color: '#aa3300', opacity: 0.15 },
        { type: 'rect', x: 50, y: 400, width: 50, height: 60, color: '#cc4400', opacity: 0.12 }
      ]
    }
  },
  {
    number: 9,
    name: 'THE CORE',
    hueStart: '#0a0a05',
    hueEnd: '#151510',
    starDensity: 75,
    starColors: ['#ffffaa', '#ffffff', '#ffeecc'],
    starSizes: [1, 3],
    twinkle: true,
    mood: 'Final destination, hope',
    storyBeat: 'VISUAL CONFIRMED: Massive structure ahead. They\'re inside. You\'re here.',
    feature: {
      type: 'core',
      elements: [
        { type: 'rect', x: 150, y: 50, width: 100, height: 120, color: '#ffcc66', opacity: 0.2, blur: 5 },
        { type: 'rect', x: 160, y: 60, width: 80, height: 100, color: '#ffdd88', opacity: 0.15, blur: 8 }
      ]
    }
  }
];

export function getWaveConfig(wave: number) {
  const isBossWave = wave % 5 === 0;

  if (isBossWave) {
    return {
      isBoss: true,
      totalEnemies: 0,
      enemyHealth: 0,
      bossHealth: 80 + (wave * 15)
    };
  }

  // Start with 20-24 enemies (5 rows, not all positions filled)
  // Gradually increase to fill all 40 positions
  const baseEnemies = 20;
  const maxEnemies = 40;
  const increasePerWave = 2;
  const totalEnemies = Math.min(maxEnemies, baseEnemies + (wave - 1) * increasePerWave);

  return {
    isBoss: false,
    totalEnemies,
    enemyHealth: 1 + Math.floor(wave / 3),
    bossHealth: 0
  };
}

export function getSectorForWave(wave: number): number {
  return Math.floor((wave - 1) / 5) + 1;
}

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getDifficultyForWave(wave: number) {
  const config = DIFFICULTY_SCALING.waves.find(w => wave >= w.min && wave <= w.max);
  return config || DIFFICULTY_SCALING.waves[DIFFICULTY_SCALING.waves.length - 1];
}
