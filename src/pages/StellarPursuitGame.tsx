import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SECTORS, GAME_WIDTH, GAME_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_SPEED,
  STARTING_LIVES, BULLET_SPEED, ENEMY_BULLET_SPEED, SHIELD_MAX, SHIELD_REGEN,
  DEFLECT_COST, DEFLECT_COOLDOWN, DEFLECT_DURATION, DEFLECT_RADIUS,
  POWERUP_DURATION, POWERUP_DROP_RATE, WEAPON_CONFIGS, ENEMY_CONFIGS,
  MOVEMENT_PATTERNS, SCORING, SCREEN_SHAKE, AUTO_FIRE_RATE, MANUAL_FIRE_RATE,
  FORMATION, DIVE_CONFIG, getWaveConfig, getSectorForWave, seededRandom, getDifficultyForWave,
  ATTACK_PATTERNS, DIFFICULTY_SCALING
} from '../config/stellarPursuitConstants';
import {
  Player, Enemy, Boss, Bullet, Powerup, Star, Particle, GameState, WeaponType, EnemyType,
  EnemyPattern, EnemyVariant, GameStats, Sector, FormationPosition, AttackPattern
} from '../types/stellarPursuit';
import { saveGameSession, getHighScores } from '../services/stellarPursuitDatabase';
import { supabase } from '../shared/supabase/client';

export function StellarPursuitGame() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>('title');
  const [isPaused, setIsPaused] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'cadet' | 'pilot' | 'commander'>('pilot');
  const [sectorMessage, setSectorMessage] = useState<string | null>(null);
  const [sectorMessageTimer, setSectorMessageTimer] = useState(0);
  const lastSectorRef = useRef(1);

  const [player, setPlayer] = useState<Player>({
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT - 60,
    vx: 0,
    vy: 0,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    shield: SHIELD_MAX,
    lives: STARTING_LIVES,
    weapon: 'standard',
    weaponTimer: 0,
    deflectCooldown: 0,
    isDeflecting: false,
    invincibilityFrames: 0
  });

  const [stats, setStats] = useState<GameStats>({
    score: 0,
    wave: 1,
    sector: 1,
    enemiesRemaining: 0,
    combo: 0,
    highScore: 0,
    comboMultiplier: 1,
    lastKillTime: 0,
    damageTaken: false
  });

  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [boss, setBoss] = useState<Boss | null>(null);
  const [bullets, setBullets] = useState<Bullet[]>([]);
  const [powerups, setPowerups] = useState<Powerup[]>([]);
  const [stars, setStars] = useState<Star[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [screenShake, setScreenShake] = useState(0);

  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());
  const [weaponPowerupTimer, setWeaponPowerupTimer] = useState(0);

  const waveCountRef = useRef(0);
  const enemySpawnTimerRef = useRef(0);
  const gameStartTimeRef = useRef<number>(0);
  const enemiesDefeatedRef = useRef(0);
  const bossesDefeatedRef = useRef(0);
  const shotsFiredRef = useRef(0);
  const isDeflectingRef = useRef(false);
  const playerPosRef = useRef({ x: GAME_WIDTH / 2, y: GAME_HEIGHT - 60 });

  // Formation system refs
  const formationPositionsRef = useRef<(FormationPosition | null)[]>([]);
  const diveTimerRef = useRef(0);
  const formationBobPhaseRef = useRef(0);

  // Compute current sector
  const currentSector = SECTORS[Math.min(stats.sector - 1, SECTORS.length - 1)];

  // Refs for game state to avoid stale closures - AAA game architecture pattern
  const gameStateRef = useRef({
    player,
    enemies,
    boss,
    bullets,
    powerups,
    stars,
    particles,
    keysPressed,
    screenShake,
    weaponPowerupTimer,
    stats,
    currentSector
  });

  // Update refs whenever state changes
  useEffect(() => {
    gameStateRef.current = {
      player,
      enemies,
      boss,
      bullets,
      powerups,
      stars,
      particles,
      keysPressed,
      screenShake,
      weaponPowerupTimer,
      stats,
      currentSector
    };
  }, [player, enemies, boss, bullets, powerups, stars, particles, keysPressed, screenShake, weaponPowerupTimer, stats, currentSector]);

  useEffect(() => {
    generateStarsForSector(currentSector);
  }, [stats.sector]);

  useEffect(() => {
    loadHighScore();
  }, []);

  const loadHighScore = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const highScores = await getHighScores(user.id);
    if (highScores) {
      setStats(s => ({ ...s, highScore: highScores.highest_score }));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeysPressed(prev => new Set(prev).add(e.key.toLowerCase()));

      // Dev mode toggle (D key on title screen)
      if (e.key.toLowerCase() === 'd' && gameState === 'title') {
        e.preventDefault();
        setDevMode(prev => !prev);
        return;
      }

      // Dev mode shortcuts (while playing)
      if (devMode && gameState === 'playing') {
        if (e.key === 'i') {
          // Toggle invincibility
          setPlayer(p => ({ ...p, invincibilityFrames: p.invincibilityFrames > 0 ? 0 : 99999 }));
          e.preventDefault();
          return;
        }
        if (e.key === 'n') {
          // Skip to next wave
          setEnemies([]);
          setBoss(null);
          e.preventDefault();
          return;
        }
        if (e.key === 'l') {
          // Add extra life
          setPlayer(p => ({ ...p, lives: p.lives + 1 }));
          e.preventDefault();
          return;
        }
        if (e.key === 's') {
          // Max shield
          setPlayer(p => ({ ...p, shield: SHIELD_MAX }));
          e.preventDefault();
          return;
        }
      }

      if (e.key === ' ' && gameState === 'playing') {
        e.preventDefault();
      }
      if (e.key === 'x' && gameState === 'playing') {
        e.preventDefault();
        handleDeflect();
      }
      if (e.key === 'Escape' && gameState === 'playing') {
        setIsPaused(p => !p);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeysPressed(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key.toLowerCase());
        return newSet;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, devMode]);

  useEffect(() => {
    if (gameState !== 'playing' || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const gameLoop = (currentTime: number) => {
      if (!running) return;

      const deltaTime = currentTime - lastFrameTimeRef.current;

      // Run at 60 FPS - simple and direct
      if (deltaTime >= 16.67) {
        lastFrameTimeRef.current = currentTime;
        updateGame();
        renderGame(ctx);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    lastFrameTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      running = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, isPaused]);

  const generateStarsForSector = (sector: Sector) => {
    const newStars: Star[] = [];
    const seed = sector.number * 1000;

    const starCount = sector.starDensity;

    for (let i = 0; i < starCount; i++) {
      const layer = Math.floor(seededRandom(seed + i * 3) * 3);
      const speeds = [0.5, 1.5, 3.5];

      newStars.push({
        x: seededRandom(seed + i) * GAME_WIDTH,
        y: seededRandom(seed + i + 1) * GAME_HEIGHT,
        size: sector.starSizes[0] + seededRandom(seed + i + 2) * (sector.starSizes[1] - sector.starSizes[0]),
        color: sector.starColors[Math.floor(seededRandom(seed + i + 3) * sector.starColors.length)],
        layer,
        speed: speeds[layer],
        twinklePhase: sector.twinkle ? seededRandom(seed + i + 4) * Math.PI * 2 : 0
      });
    }

    setStars(newStars);
  };

  const handleDeflect = () => {
    const { player: p } = gameStateRef.current;
    if (p.deflectCooldown <= 0 && p.shield >= DEFLECT_COST && !p.isDeflecting) {
      isDeflectingRef.current = true;

      setPlayer(p => ({
        ...p,
        shield: p.shield - DEFLECT_COST,
        deflectCooldown: DEFLECT_COOLDOWN,
        isDeflecting: true
      }));

      setTimeout(() => {
        isDeflectingRef.current = false;
        setPlayer(p => ({ ...p, isDeflecting: false }));
      }, DEFLECT_DURATION);

      setScreenShake(SCREEN_SHAKE.deflect);
      spawnParticles(p.x, p.y, 8, 'deflect', ['#00ffff', '#00ffff', '#ffffff']);
    }
  };

  const difficultyMultipliers = {
    cadet: { lives: 5, shieldRegen: 1.5, enemySpeed: 0.75, enemyShoot: 0.6 },
    pilot: { lives: 3, shieldRegen: 1.0, enemySpeed: 1.0, enemyShoot: 1.0 },
    commander: { lives: 2, shieldRegen: 0.7, enemySpeed: 1.3, enemyShoot: 1.5 },
  };

  const getDiffMult = () => difficultyMultipliers[selectedDifficulty];

  const startGame = () => {
    setGameState('playing');
    setSectorMessage(null);
    lastSectorRef.current = 1;
    const diff = getDiffMult();
    setPlayer({
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 100,
      vx: 0,
      vy: 0,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      shield: SHIELD_MAX,
      lives: diff.lives,
      weapon: 'standard',
      weaponTimer: 0,
      deflectCooldown: 0,
      isDeflecting: false,
      invincibilityFrames: 0
    });
    setStats({
      score: 0,
      wave: 1,
      sector: 1,
      enemiesRemaining: 0,
      combo: 0,
      highScore: stats.highScore,
      comboMultiplier: 1,
      lastKillTime: 0,
      damageTaken: false
    });
    setEnemies([]);
    setBoss(null);
    setBullets([]);
    setPowerups([]);
    waveCountRef.current = 0;
    gameStartTimeRef.current = Date.now();
    enemiesDefeatedRef.current = 0;
    bossesDefeatedRef.current = 0;
    shotsFiredRef.current = 0;
    startWave(1);
  };

  const startWave = (waveNum: number) => {
    const config = getWaveConfig(waveNum);
    const sector = getSectorForWave(waveNum);

    if (sector !== lastSectorRef.current && sector <= SECTORS.length) {
      lastSectorRef.current = sector;
      const sectorData = SECTORS[sector - 1];
      setSectorMessage(`SECTOR ${sectorData.number}: ${sectorData.name}\n${sectorData.storyBeat}`);
      setSectorMessageTimer(240);
    }

    setStats(s => ({
      ...s,
      wave: waveNum,
      sector,
      enemiesRemaining: config.totalEnemies,
      damageTaken: false
    }));

    if (config.isBoss) {
      spawnBoss(config.bossHealth);
    } else {
      initializeFormation();
      spawnWaveEnemies();
    }
  };

  const spawnBoss = (health: number) => {
    const newBoss: Boss = {
      id: 'boss-' + Date.now(),
      x: GAME_WIDTH / 2,
      y: -100,
      vx: 0,
      vy: 0.5,
      width: 120,
      height: 100,
      health,
      maxHealth: health,
      shootCooldown: 0,
      variant: 'A',
      patternPhase: 0,
      isElite: false,
      phase: 1,
      turrets: [
        { offsetX: -40, offsetY: 25, angle: 0, cooldown: 0 },
        { offsetX: 40, offsetY: 25, angle: 0, cooldown: 0 },
        { offsetX: 0, offsetY: 50, angle: 0, cooldown: 0 }
      ],
      name: 'WARDEN-CLASS DESTROYER',
      entryComplete: false,
      state: 'entering',
      formationPosition: null,
      entryProgress: 0,
      entryPathIndex: 0,
      diveProgress: 0,
      attackPattern: 'standard',
      shotsFired: 0,
      guaranteedShotsStatus: { start: false, mid: false, end: false }
    };

    setBoss(newBoss);
  };

  // Initialize formation grid
  const initializeFormation = () => {
    const positions: (FormationPosition | null)[] = [];
    const totalCols = FORMATION.cols;
    const totalRows = FORMATION.rows;

    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const xOffset = (col - totalCols / 2 + 0.5) * FORMATION.colSpacing;
        positions.push({
          row,
          col,
          x: FORMATION.centerX + xOffset,
          y: FORMATION.startY + row * FORMATION.rowSpacing
        });
      }
    }

    formationPositionsRef.current = positions;
  };

  // Get entry path for an enemy based on which side they enter from
  const getEntryPath = (pathIndex: number, targetX: number, targetY: number) => {
    // 4 entry patterns: left arc, right arc, center-left loop, center-right loop
    return (progress: number): { x: number; y: number } => {
      const t = progress; // 0 to 1

      if (pathIndex === 0) {
        // Left side arc
        const startX = -50;
        const startY = -50;
        const arc = Math.sin(t * Math.PI);
        return {
          x: startX + (targetX - startX) * t + arc * 100,
          y: startY + (targetY - startY) * t
        };
      } else if (pathIndex === 1) {
        // Right side arc
        const startX = GAME_WIDTH + 50;
        const startY = -50;
        const arc = Math.sin(t * Math.PI);
        return {
          x: startX + (targetX - startX) * t - arc * 100,
          y: startY + (targetY - startY) * t
        };
      } else if (pathIndex === 2) {
        // Center-left loop
        const startX = GAME_WIDTH / 2 - 100;
        const startY = -50;
        const loop = Math.sin(t * Math.PI * 2) * 60;
        return {
          x: startX + (targetX - startX) * t + loop,
          y: startY + (targetY - startY) * t
        };
      } else {
        // Center-right loop
        const startX = GAME_WIDTH / 2 + 100;
        const startY = -50;
        const loop = Math.sin(t * Math.PI * 2) * 60;
        return {
          x: startX + (targetX - startX) * t - loop,
          y: startY + (targetY - startY) * t
        };
      }
    };
  };

  // Spawn all enemies for the wave at once
  const spawnWaveEnemies = () => {
    const waveConfig = getWaveConfig(stats.wave);
    const types: EnemyType[] = ['drone', 'striker', 'heavy', 'speeder', 'bomber'];
    const variants: EnemyVariant[] = ['A', 'B', 'C'];
    const patterns: EnemyPattern[] = ['swoop', 'zigzag', 'pincer'];

    const newEnemies: Enemy[] = [];
    const availablePositions = [...formationPositionsRef.current];

    // Shuffle positions for variety
    for (let i = availablePositions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
    }

    for (let i = 0; i < waveConfig.totalEnemies && i < availablePositions.length; i++) {
      const formationPos = availablePositions[i];
      if (!formationPos) continue;

      const type = types[Math.floor(Math.random() * types.length)];
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      const config = ENEMY_CONFIGS[type];
      const entryPathIndex = Math.floor(Math.random() * 4);

      const newEnemy: Enemy = {
        id: 'enemy-' + Date.now() + Math.random() + i,
        type,
        variant,
        x: -100,
        y: -100,
        vx: 0,
        vy: 0,
        width: config.width,
        height: config.height,
        health: waveConfig.enemyHealth,
        maxHealth: waveConfig.enemyHealth,
        shootCooldown: Math.random() * DIVE_CONFIG.shootCooldown,
        pattern,
        patternPhase: 0,
        isElite: Math.random() < 0.08,
        state: 'entering',
        formationPosition: formationPos,
        entryProgress: 0,
        entryPathIndex,
        diveProgress: 0,
        attackPattern: 'standard',
        shotsFired: 0,
        guaranteedShotsStatus: { start: false, mid: false, end: false }
      };

      newEnemies.push(newEnemy);
    }

    setEnemies(newEnemies);
    diveTimerRef.current = DIVE_CONFIG.minInterval;
  };

  const playerShoot = () => {
    const { player: p } = gameStateRef.current;
    const weaponConfig = WEAPON_CONFIGS[p.weapon];

    weaponConfig.spreadAngles.forEach(angle => {
      const radians = (angle * Math.PI) / 180;
      const newBullet: Bullet = {
        id: 'bullet-' + Date.now() + Math.random(),
        x: p.x,
        y: p.y,
        vx: Math.sin(radians) * BULLET_SPEED,
        vy: -BULLET_SPEED * Math.cos(radians),
        width: 4,
        height: 12,
        damage: weaponConfig.damage,
        owner: 'player',
        type: p.weapon,
        color: weaponConfig.color,
        isDeflected: false
      };

      setBullets(prev => [...prev, newBullet]);
      shotsFiredRef.current++;
    });
  };

  const saveGameData = async (completed: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const timePlayed = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
    const accuracy = shotsFiredRef.current > 0
      ? (enemiesDefeatedRef.current / shotsFiredRef.current) * 100
      : 0;

    await saveGameSession({
      user_id: user.id,
      score: stats.score,
      wave_reached: stats.wave,
      sector_reached: stats.sector,
      enemies_defeated: enemiesDefeatedRef.current,
      bosses_defeated: bossesDefeatedRef.current,
      shots_fired: shotsFiredRef.current,
      accuracy,
      time_played: timePlayed,
      completed
    });
  };

  const spawnParticles = (x: number, y: number, count: number, type: Particle['type'], colors: string[]) => {
    const reducedCount = Math.ceil(count * 0.4);
    const newParticles: Particle[] = [];
    for (let i = 0; i < reducedCount; i++) {
      const angle = (Math.PI * 2 * i) / reducedCount + (Math.random() * 0.5);
      const speed = 2 + Math.random() * 3;
      newParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: type === 'explosion' ? 2 + Math.random() * 2 : 1 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: type === 'explosion' ? 30 : type === 'spark' ? 20 : 15,
        maxLife: type === 'explosion' ? 30 : type === 'spark' ? 20 : 15,
        type
      });
    }
    setParticles(prev => {
      const updated = [...prev, ...newParticles];
      return updated.slice(-80);
    });
  };

  const updateParticles = () => {
    setParticles(prev =>
      prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vx: p.vx * 0.95,
          vy: p.vy * 0.95,
          life: p.life - 1
        }))
        .filter(p => p.life > 0)
    );
  };

  const updateGame = () => {
    const { screenShake: shake, weaponPowerupTimer: weaponTimer, player: p, stats: s, enemies: e, boss: b } = gameStateRef.current;

    updatePlayer();
    updateEnemies();
    updateBoss();
    updateBullets();
    updatePowerups();
    updateStars();
    updateParticles();
    checkCollisions();

    // Combo decay system
    setStats(s => {
      if (s.lastKillTime > 0 && Date.now() - s.lastKillTime > SCORING.comboDecayTime * 16.67) {
        return {
          ...s,
          combo: 0,
          comboMultiplier: 1
        };
      }
      return s;
    });

    if (shake > 0) {
      setScreenShake(s => Math.max(0, s - 0.5));
    }

    if (sectorMessageTimer > 0) {
      setSectorMessageTimer(t => t - 1);
      if (sectorMessageTimer === 1) setSectorMessage(null);
    }

    if (weaponTimer > 0) {
      setWeaponPowerupTimer(t => t - 1);
      if (weaponTimer === 1) {
        setPlayer(p => ({ ...p, weapon: 'standard' }));
      }
    }

    if (p.lives <= 0) {
      setGameState('gameOver');
      if (s.score > s.highScore) {
        setStats(s => ({ ...s, highScore: s.score }));
      }
      saveGameData(false);
    }

    if (e.length === 0 && !b) {
      // Check for perfect wave bonus
      if (!s.damageTaken) {
        setStats(s => ({
          ...s,
          score: s.score + SCORING.perfectWaveBonus
        }));
      }

      const nextWave = s.wave + 1;
      startWave(nextWave);
    }
  };

  const updatePlayer = () => {
    const { keysPressed: keys, player: p } = gameStateRef.current;
    let vx = 0;

    if (keys.has('arrowleft') || keys.has('a')) vx -= PLAYER_SPEED;
    if (keys.has('arrowright') || keys.has('d')) vx += PLAYER_SPEED;

    if (Math.random() < 0.6) {
      spawnParticles(p.x, p.y + p.height / 2, 1, 'trail', ['#ff8800', '#ff6600', '#ff4400']);
    }

    setPlayer(p => {
      let newX = p.x + vx;

      newX = Math.max(p.width / 2, Math.min(GAME_WIDTH - p.width / 2, newX));

      // Update ref for deflect collision detection
      playerPosRef.current = { x: newX, y: p.y };

      let newShield = Math.max(0, p.shield);
      if (newShield < SHIELD_MAX) {
        newShield = Math.min(SHIELD_MAX, newShield + SHIELD_REGEN);
      }

      let newWeaponTimer = p.weaponTimer > 0 ? p.weaponTimer - 1 : 0;
      let newDeflectCooldown = p.deflectCooldown > 0 ? p.deflectCooldown - 1 : 0;
      let newInvincibilityFrames = p.invincibilityFrames > 0 ? p.invincibilityFrames - 1 : 0;

      if (newWeaponTimer === 0) {
        const weaponConfig = WEAPON_CONFIGS[p.weapon];
        const isManualFire = keys.has(' ') && p.weapon === 'standard' && weaponConfig.manualFireRate !== null;
        const fireRate = isManualFire ? weaponConfig.manualFireRate : weaponConfig.fireRate;
        newWeaponTimer = fireRate / (1000 / 60);
        playerShoot();
      }

      return {
        ...p,
        x: newX,
        vx,
        vy: 0,
        shield: newShield,
        weaponTimer: newWeaponTimer,
        deflectCooldown: newDeflectCooldown,
        invincibilityFrames: newInvincibilityFrames
      };
    });
  };

  const updateEnemies = () => {
    // Update formation bob animation
    formationBobPhaseRef.current += FORMATION.bobFrequency;

    // Update dive timer
    diveTimerRef.current--;

    setEnemies(prevEnemies => {
      // Filter out dead or off-screen enemies
      let updatedEnemies = prevEnemies.filter(enemy => {
        if (enemy.health <= 0) return false;
        if (enemy.state === 'diving' && enemy.y > GAME_HEIGHT + 50) return false;
        return true;
      });

      // Check if we should start a dive (with multiple divers based on difficulty)
      const formationEnemies = updatedEnemies.filter(e => e.state === 'formation');
      const divingEnemies = updatedEnemies.filter(e => e.state === 'diving' || e.state === 'returning');
      const difficulty = getDifficultyForWave(stats.wave);
      const maxSimultaneousDivers = difficulty.divers;

      if (diveTimerRef.current <= 0 && formationEnemies.length > 0 && divingEnemies.length < maxSimultaneousDivers) {
        // Determine how many enemies should dive this time
        const diversNeeded = Math.min(
          maxSimultaneousDivers - divingEnemies.length,
          formationEnemies.length,
          stats.wave >= 6 ? 2 : 1 // Start with single divers, then allow bursts
        );

        // Select random attack pattern based on weights
        const selectAttackPattern = (): AttackPattern => {
          const totalWeight = Object.values(ATTACK_PATTERNS).reduce((sum, p) => sum + p.weight, 0);
          let random = Math.random() * totalWeight;

          for (const [key, pattern] of Object.entries(ATTACK_PATTERNS)) {
            random -= pattern.weight;
            if (random <= 0) return key as AttackPattern;
          }
          return 'standard';
        };

        // Pick random enemies to dive and assign attack patterns
        const shuffled = [...formationEnemies].sort(() => Math.random() - 0.5);
        const diversToPick = shuffled.slice(0, diversNeeded);

        updatedEnemies = updatedEnemies.map(e => {
          const shouldDive = diversToPick.find(d => d.id === e.id);
          if (shouldDive) {
            const attackPattern = selectAttackPattern();
            return {
              ...e,
              state: 'diving',
              diveProgress: 0,
              attackPattern,
              shotsFired: 0,
              guaranteedShotsStatus: { start: false, mid: false, end: false }
            };
          }
          return e;
        });

        diveTimerRef.current = DIVE_CONFIG.minInterval + Math.random() * (DIVE_CONFIG.maxInterval - DIVE_CONFIG.minInterval);
      }

      // Update each enemy based on its state
      return updatedEnemies.map(enemy => {
        let newX = enemy.x;
        let newY = enemy.y;
        let newVx = enemy.vx;
        let newVy = enemy.vy;
        let newState = enemy.state;
        let newEntryProgress = enemy.entryProgress;
        let newDiveProgress = enemy.diveProgress;
        let newShootCooldown = enemy.shootCooldown > 0 ? enemy.shootCooldown - 1 : 0;

        if (enemy.state === 'entering') {
          // Follow entry path to formation
          newEntryProgress += 0.02;

          if (newEntryProgress >= 1) {
            newState = 'formation';
            newEntryProgress = 1;
            if (enemy.formationPosition) {
              newX = enemy.formationPosition.x;
              newY = enemy.formationPosition.y;
            }
          } else {
            if (enemy.formationPosition) {
              const pathFn = getEntryPath(enemy.entryPathIndex, enemy.formationPosition.x, enemy.formationPosition.y);
              const pos = pathFn(newEntryProgress);
              newX = pos.x;
              newY = pos.y;
            }
          }
        } else if (enemy.state === 'formation') {
          // Gentle bob in formation with horizontal sway
          if (enemy.formationPosition) {
            const bobOffset = Math.sin(formationBobPhaseRef.current + enemy.formationPosition.col * 0.5) * FORMATION.bobAmplitude;
            const swayOffset = Math.sin(formationBobPhaseRef.current * FORMATION.swayFrequency) * FORMATION.swayAmplitude;
            newX = enemy.formationPosition.x + swayOffset;
            newY = enemy.formationPosition.y + bobOffset;
          }

          // Formation shooting - enemies shoot straight down occasionally
          if (newShootCooldown === 0 && Math.random() < FORMATION.formationShootChance) {
            const enemyCenterX = newX + enemy.width / 2;
            const enemyCenterY = newY + enemy.height / 2;

            const newBullet: Bullet = {
              id: 'bullet-' + Date.now() + Math.random(),
              x: enemyCenterX,
              y: enemyCenterY,
              vx: 0,
              vy: ENEMY_BULLET_SPEED,
              width: 8,
              height: 8,
              damage: 1,
              owner: 'enemy',
              type: 'standard',
              color: enemy.isElite ? '#ff00ff' : '#ff6600',
              isDeflected: false
            };
            setBullets(prev => [...prev, newBullet]);
            newShootCooldown = FORMATION.formationShootCooldown;
          }
        } else if (enemy.state === 'diving') {
          // Different dive patterns based on attackPattern
          const difficulty = getDifficultyForWave(stats.wave);
          newDiveProgress += 0.015 * difficulty.speedMult;
          const playerPos = playerPosRef.current;
          const startX = enemy.formationPosition?.x || enemy.x;
          const startY = enemy.formationPosition?.y || enemy.y;

          if (enemy.attackPattern === 'kamikaze') {
            // Straight dive - fast and deadly, doesn't return
            newY += DIVE_CONFIG.diveSpeed * 1.5 * difficulty.speedMult;
            const t = Math.min(newDiveProgress, 1);
            newX = startX + (playerPos.x - startX) * t;

            // Kamikazes don't return, just dive off screen
            if (newY > GAME_HEIGHT * 0.95) {
              newState = 'returning'; // Will be filtered out
              newDiveProgress = 1;
            }
          } else if (enemy.attackPattern === 'loop') {
            // Full loop pattern
            if (newDiveProgress < 1) {
              const angle = newDiveProgress * Math.PI * 2;
              const loopRadius = 150;
              newX = startX + Math.sin(angle) * loopRadius;
              newY = startY + (1 - Math.cos(angle)) * loopRadius + newDiveProgress * 200;
            }

            if (newDiveProgress >= 1) {
              newState = 'returning';
              newDiveProgress = 0;
            }
          } else if (enemy.attackPattern === 'strafe') {
            // Dive to side, strafe horizontally, then return
            if (newDiveProgress < 0.3) {
              // Dive to side
              const t = newDiveProgress / 0.3;
              const sideOffset = startX < GAME_WIDTH / 2 ? -200 : 200;
              newX = startX + sideOffset * t;
              newY = startY + 150 * t;
            } else if (newDiveProgress < 0.7) {
              // Strafe horizontally
              const t = (newDiveProgress - 0.3) / 0.4;
              const sideOffset = startX < GAME_WIDTH / 2 ? -200 : 200;
              newX = startX + sideOffset + (GAME_WIDTH * (startX < GAME_WIDTH / 2 ? 1 : -1)) * t;
              newY = startY + 150;
            } else {
              // Dive down
              newY += DIVE_CONFIG.diveSpeed * 2;
              if (newY > GAME_HEIGHT * 0.8 || newDiveProgress >= 0.95) {
                newState = 'returning';
                newDiveProgress = 0;
              }
            }
          } else {
            // Standard dive pattern - arc toward player
            if (newDiveProgress < 0.5) {
              const t = newDiveProgress / 0.5;
              const arc = Math.sin(t * Math.PI) * 100;
              newX = startX + (playerPos.x - startX) * t + (Math.random() - 0.5) * arc;
              newY = startY + (GAME_HEIGHT - startY) * t * 0.7;
            } else if (newDiveProgress < 1) {
              newY += DIVE_CONFIG.diveSpeed * difficulty.speedMult;

              if (newY > GAME_HEIGHT * 0.8 || newDiveProgress >= 0.9) {
                newState = 'returning';
                newDiveProgress = 0;
              }
            }
          }

          // Improved shooting system with guaranteed shots and difficulty scaling
          let shouldShoot = false;

          // Check for guaranteed shots at key dive progress points
          const guaranteedShots = enemy.guaranteedShotsStatus;
          if (newDiveProgress >= DIVE_CONFIG.guaranteedShots.start && !guaranteedShots.start) {
            shouldShoot = true;
            enemy.guaranteedShotsStatus.start = true;
          } else if (newDiveProgress >= DIVE_CONFIG.guaranteedShots.mid && !guaranteedShots.mid) {
            shouldShoot = true;
            enemy.guaranteedShotsStatus.mid = true;
          } else if (newDiveProgress >= DIVE_CONFIG.guaranteedShots.end && !guaranteedShots.end) {
            shouldShoot = true;
            enemy.guaranteedShotsStatus.end = true;
          }

          // Random shooting with difficulty, elite, and attack pattern multipliers
          const eliteMultiplier = enemy.isElite ? DIVE_CONFIG.eliteShootMultiplier : 1;
          const patternConfig = ATTACK_PATTERNS[enemy.attackPattern] as { shootMultiplier?: number; weight: number; kamikazeChance?: number; name: string };
          const patternMultiplier = patternConfig.shootMultiplier || 1;
          const shootChance = DIVE_CONFIG.shootChancePerFrame * difficulty.shootMult * eliteMultiplier * patternMultiplier;

          if (newShootCooldown === 0 && (shouldShoot || Math.random() < shootChance)) {
            const playerPos = playerPosRef.current;
            const enemyCenterX = newX + enemy.width / 2;
            const enemyCenterY = newY + enemy.height / 2;
            const angle = Math.atan2(playerPos.y - enemyCenterY, playerPos.x - enemyCenterX);
            const inaccuracy = (Math.random() - 0.5) * 0.4;
            const finalAngle = angle + inaccuracy;

            const newBullet: Bullet = {
              id: 'bullet-' + Date.now() + Math.random(),
              x: enemyCenterX,
              y: enemyCenterY,
              vx: Math.cos(finalAngle) * ENEMY_BULLET_SPEED * difficulty.speedMult,
              vy: Math.sin(finalAngle) * ENEMY_BULLET_SPEED * difficulty.speedMult,
              width: 8,
              height: 8,
              damage: 1,
              owner: 'enemy',
              type: 'standard',
              color: enemy.isElite ? '#ff00ff' : '#ff6600',
              isDeflected: false
            };
            setBullets(prev => [...prev, newBullet]);
            newShootCooldown = DIVE_CONFIG.shootCooldown;
            enemy.shotsFired++;
          }
        } else if (enemy.state === 'returning') {
          // Return to formation
          newDiveProgress += 0.02;

          if (enemy.formationPosition) {
            const targetX = enemy.formationPosition.x;
            const targetY = enemy.formationPosition.y;

            if (newDiveProgress >= 1) {
              newState = 'formation';
              newX = targetX;
              newY = targetY;
              newDiveProgress = 0;
            } else {
              // Arc back to formation
              const startX = newX;
              const startY = newY;
              const arc = Math.sin(newDiveProgress * Math.PI) * 80;

              newX = startX + (targetX - startX) * newDiveProgress + arc;
              newY = startY + (targetY - startY) * newDiveProgress;
            }
          }
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy,
          state: newState,
          entryProgress: newEntryProgress,
          diveProgress: newDiveProgress,
          shootCooldown: newShootCooldown
        };
      });
    });
  };

  const updateBoss = () => {
    if (!boss) return;

    setBoss(prevBoss => {
      if (!prevBoss) return null;

      let newY = prevBoss.y;
      let newEntryComplete = prevBoss.entryComplete;

      if (!newEntryComplete) {
        newY += prevBoss.vy;
        if (newY >= 100) {
          newY = 100;
          newEntryComplete = true;
        }
      } else {
        newY = 100 + Math.sin(Date.now() * 0.001) * 20;
      }

      const newTurrets = prevBoss.turrets.map((turret, index) => {
        let newCooldown = turret.cooldown > 0 ? turret.cooldown - 1 : 0;

        if (newCooldown === 0 && newEntryComplete) {
          const turretX = prevBoss.x + turret.offsetX;
          const turretY = newY + turret.offsetY;
          const playerPos = playerPosRef.current;
          const baseAngle = Math.atan2(playerPos.y - turretY, playerPos.x - turretX);
          const spreadOffset = (index - 1) * 0.15; // Each turret aims slightly different
          const angle = baseAngle + spreadOffset;

          const newBullet: Bullet = {
            id: 'bullet-' + Date.now() + Math.random(),
            x: turretX,
            y: turretY,
            vx: Math.cos(angle) * ENEMY_BULLET_SPEED * 1.2,
            vy: Math.sin(angle) * ENEMY_BULLET_SPEED * 1.2,
            width: 8,
            height: 8,
            damage: 1,
            owner: 'enemy',
            type: 'standard',
            color: '#ff0000',
            isDeflected: false
          };
          setBullets(prev => [...prev, newBullet]);
          newCooldown = 45;
        }

        return { ...turret, cooldown: newCooldown };
      });

      if (prevBoss.health <= 0) {
        setStats(s => ({ ...s, score: s.score + SCORING.bossKill }));
        setScreenShake(SCREEN_SHAKE.bossDeath);
        return null;
      }

      return {
        ...prevBoss,
        y: newY,
        entryComplete: newEntryComplete,
        turrets: newTurrets
      };
    });
  };

  const updateBullets = () => {
    setBullets(prevBullets =>
      prevBullets.filter(bullet => {
        const outOfBounds = bullet.x < -10 || bullet.x > GAME_WIDTH + 10 ||
          bullet.y < -10 || bullet.y > GAME_HEIGHT + 10;
        return !outOfBounds;
      }).map(bullet => {
        let updatedBullet = {
          ...bullet,
          x: bullet.x + bullet.vx,
          y: bullet.y + bullet.vy
        };

        // Check deflect collision every frame while deflecting
        if (isDeflectingRef.current && bullet.owner === 'enemy' && !bullet.isDeflected) {
          const playerPos = playerPosRef.current;
          const dx = bullet.x - playerPos.x;
          const dy = bullet.y - playerPos.y;

          // Circle collision: distance <= radius
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= DEFLECT_RADIUS) {
            // Bullet is inside the circle - DEFLECT IT
            setStats(s => ({
              ...s,
              score: s.score + SCORING.deflectedBullet,
              combo: s.combo + 1,
              comboMultiplier: Math.min(s.comboMultiplier + SCORING.comboMultiplierIncrement, 3),
              lastKillTime: Date.now()
            }));
            spawnParticles(bullet.x, bullet.y, 8, 'deflect', ['#00ffff', '#00ffff', '#ffffff']);
            setScreenShake(SCREEN_SHAKE.deflect);

            const deflectAngle = Math.atan2(dy, dx);
            const speed = BULLET_SPEED * 1.8;

            updatedBullet = {
              ...updatedBullet,
              owner: 'player',
              vx: Math.cos(deflectAngle) * speed * 0.4,
              vy: -speed, // Strong upward
              damage: SCORING.deflectedBulletDamage,
              isDeflected: true,
              color: '#00ffff'
            };
          }
        }

        return updatedBullet;
      })
    );
  };

  const updatePowerups = () => {
    setPowerups(prevPowerups =>
      prevPowerups.filter(p => p.y < GAME_HEIGHT + 50).map(p => ({
        ...p,
        y: p.y + p.vy
      }))
    );
  };

  const updateStars = () => {
    setStars(prevStars =>
      prevStars.map(star => {
        let newY = star.y + star.speed;
        if (newY > GAME_HEIGHT) {
          newY = 0;
          // Randomize x position slightly when wrapping
          return {
            ...star,
            x: (star.x + (Math.random() - 0.5) * 50) % GAME_WIDTH,
            y: newY,
            twinklePhase: currentSector.twinkle ? (star.twinklePhase || 0) + 0.05 : 0
          };
        }

        let newTwinklePhase = star.twinklePhase || 0;
        if (currentSector.twinkle) {
          newTwinklePhase += 0.05;
        }

        return {
          ...star,
          y: newY,
          twinklePhase: newTwinklePhase
        };
      })
    );
  };


  const checkCollisions = () => {
    // CRITICAL: Read from ref, NOT closure. Closure player/boss are stale (frozen at game start).
    const currentPlayer = gameStateRef.current.player;
    const currentBoss = gameStateRef.current.boss;

    setBullets(prevBullets => {
      let bulletsToKeep = [...prevBullets];

      bulletsToKeep.forEach(bullet => {
        if (bullet.owner === 'player') {
          // Player bullets vs Enemies (enemies use top-left coords, bulletBoxCollision is correct here)
          setEnemies(prevEnemies => {
            return prevEnemies.map(enemy => {
              if (bulletBoxCollision(bullet, enemy) && bullet.owner === 'player') {
                const newHealth = enemy.health - bullet.damage;
                bulletsToKeep = bulletsToKeep.filter(b => b.id !== bullet.id);
                spawnParticles(bullet.x, bullet.y, 3, 'spark', [bullet.color]);

                if (newHealth <= 0) {
                  enemiesDefeatedRef.current++;
                  spawnParticles(
                    enemy.x + enemy.width / 2,
                    enemy.y + enemy.height / 2,
                    enemy.isElite ? 25 : 15,
                    'explosion',
                    enemy.isElite ? ['#ff4444', '#ff8800', '#ffff00', '#ffffff'] : ['#ff6600', '#ff9900', '#ffcc00']
                  );
                  setStats(s => {
                    const baseScore = enemy.isElite ? SCORING.eliteKill : SCORING.normalKill;
                    const bonusScore = Math.floor(baseScore * (s.comboMultiplier - 1));
                    return {
                      ...s,
                      score: s.score + baseScore + bonusScore,
                      combo: s.combo + 1,
                      comboMultiplier: Math.min(s.comboMultiplier + SCORING.comboMultiplierIncrement, 3),
                      lastKillTime: Date.now(),
                      enemiesRemaining: Math.max(0, s.enemiesRemaining - 1)
                    };
                  });

                  if (Math.random() < POWERUP_DROP_RATE) {
                    const weaponTypes: WeaponType[] = ['spread', 'laser', 'rapid'];
                    const powerupType = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];

                    const newPowerup: Powerup = {
                      id: 'powerup-' + Date.now(),
                      x: enemy.x + enemy.width / 2,
                      y: enemy.y + enemy.height / 2,
                      vy: 2,
                      type: powerupType,
                      width: 20,
                      height: 20
                    };

                    setPowerups(prev => [...prev, newPowerup]);
                  }
                }

                return { ...enemy, health: newHealth };
              }
              return enemy;
            });
          });

          // Player bullets vs Boss — use currentBoss from ref, not stale closure
          if (currentBoss && bulletBoxCollision(bullet, currentBoss)) {
            setBoss(prevBoss => {
              if (!prevBoss) return null;
              bulletsToKeep = bulletsToKeep.filter(b => b.id !== bullet.id);
              const newHealth = prevBoss.health - bullet.damage;

              spawnParticles(bullet.x, bullet.y, 5, 'impact', ['#00ffff', '#ffffff']);

              if (newHealth <= 0) {
                bossesDefeatedRef.current++;
                spawnParticles(
                  prevBoss.x + prevBoss.width / 2,
                  prevBoss.y + prevBoss.height / 2,
                  50,
                  'explosion',
                  ['#ff0000', '#ff4444', '#ff8800', '#ffff00', '#ffffff']
                );
              }
              return { ...prevBoss, health: newHealth };
            });
          }
        }

        // Enemy bullets vs Player — use currentPlayer from ref + center-based collision
        if (bullet.owner === 'enemy') {
          if (bulletPlayerCollision(bullet, currentPlayer) && currentPlayer.invincibilityFrames === 0) {
            setStats(s => ({ ...s, damageTaken: true }));

            setPlayer(p => {
              const newShield = p.shield - 20;
              let newLives = p.lives;
              let newInvincibilityFrames = 0;

              if (newShield <= 0) {
                newLives = p.lives - 1;
                newInvincibilityFrames = 60;
                setScreenShake(SCREEN_SHAKE.playerHit);
                return {
                  ...p,
                  shield: newLives > 0 ? SHIELD_MAX : 0,
                  lives: newLives,
                  invincibilityFrames: newInvincibilityFrames,
                  x: GAME_WIDTH / 2,
                  y: GAME_HEIGHT - 100
                };
              }

              return { ...p, shield: newShield };
            });

            bulletsToKeep = bulletsToKeep.filter(b => b.id !== bullet.id);
          }
        }
      });

      return bulletsToKeep;
    });

    // Powerup pickup — use currentPlayer from ref + center-based collision
    setPowerups(prevPowerups => {
      return prevPowerups.filter(powerup => {
        if (centerCollision(powerup, currentPlayer)) {
          setPlayer(p => ({ ...p, weapon: powerup.type }));
          setWeaponPowerupTimer(POWERUP_DURATION / 16);
          return false;
        }
        return true;
      });
    });
  };

  const boxCollision = (a: any, b: any): boolean => {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  };

  // Collision detection for bullets (which use center positioning) against boxes (which use top-left)
  const bulletBoxCollision = (bullet: any, box: any): boolean => {
    const bulletLeft = bullet.x - bullet.width / 2;
    const bulletRight = bullet.x + bullet.width / 2;
    const bulletTop = bullet.y - bullet.height / 2;
    const bulletBottom = bullet.y + bullet.height / 2;

    return (
      bulletLeft < box.x + box.width &&
      bulletRight > box.x &&
      bulletTop < box.y + box.height &&
      bulletBottom > box.y
    );
  };

  // Bullet (center-based) vs Player (center-based)
  const bulletPlayerCollision = (bullet: any, p: any): boolean => {
    const bulletLeft = bullet.x - bullet.width / 2;
    const bulletRight = bullet.x + bullet.width / 2;
    const bulletTop = bullet.y - bullet.height / 2;
    const bulletBottom = bullet.y + bullet.height / 2;

    const playerLeft = p.x - p.width / 2;
    const playerRight = p.x + p.width / 2;
    const playerTop = p.y - p.height / 2;
    const playerBottom = p.y + p.height / 2;

    return (
      bulletLeft < playerRight &&
      bulletRight > playerLeft &&
      bulletTop < playerBottom &&
      bulletBottom > playerTop
    );
  };

  // Center-based entity vs center-based entity (for powerup pickup)
  const centerCollision = (a: any, b: any): boolean => {
    const aLeft = a.x - a.width / 2;
    const aRight = a.x + a.width / 2;
    const aTop = a.y - a.height / 2;
    const aBottom = a.y + a.height / 2;

    const bLeft = b.x - b.width / 2;
    const bRight = b.x + b.width / 2;
    const bTop = b.y - b.height / 2;
    const bBottom = b.y + b.height / 2;

    return (
      aLeft < bRight &&
      aRight > bLeft &&
      aTop < bBottom &&
      aBottom > bTop
    );
  };

  const renderGame = (ctx: CanvasRenderingContext2D) => {
    const { screenShake: shake, currentSector: sector } = gameStateRef.current;

    ctx.save();

    if (shake > 0) {
      const shakeX = (Math.random() - 0.5) * shake;
      const shakeY = (Math.random() - 0.5) * shake;
      ctx.translate(shakeX, shakeY);
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, sector.hueStart);
    gradient.addColorStop(0.5, sector.hueMid || sector.hueEnd);
    gradient.addColorStop(1, sector.hueEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    renderFeatures(ctx, sector);

    const starsByLayer = [
      gameStateRef.current.stars.filter(s => s.layer === 0),
      gameStateRef.current.stars.filter(s => s.layer === 1),
      gameStateRef.current.stars.filter(s => s.layer === 2)
    ];

    starsByLayer.forEach((layerStars, layerIndex) => {
      const opacity = [0.25, 0.4, 0.6][layerIndex];

      layerStars.forEach(star => {
        let starOpacity = opacity;
        if (sector.twinkle && star.twinklePhase !== undefined) {
          starOpacity *= 0.7 + 0.3 * Math.sin(star.twinklePhase);
        }

        ctx.fillStyle = star.color;
        ctx.globalAlpha = starOpacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.globalAlpha = 1.0;

    renderPlayer(ctx);
    renderEnemies(ctx);
    renderBoss(ctx);
    renderBullets(ctx);
    renderParticles(ctx);
    renderPowerups(ctx);
    renderUI(ctx);

    if (sectorMessage && sectorMessageTimer > 0) {
      const alpha = sectorMessageTimer > 200 ? (240 - sectorMessageTimer) / 40 : sectorMessageTimer > 40 ? 1 : sectorMessageTimer / 40;
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
      ctx.fillRect(0, GAME_HEIGHT * 0.3, GAME_WIDTH, GAME_HEIGHT * 0.25);
      ctx.globalAlpha = alpha;
      const lines = sectorMessage.split('\n');
      ctx.fillStyle = '#00ffff';
      ctx.font = `bold ${Math.min(36, GAME_WIDTH * 0.03)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(lines[0] || '', GAME_WIDTH / 2, GAME_HEIGHT * 0.42);
      if (lines[1]) {
        ctx.fillStyle = '#88ccff';
        ctx.font = `${Math.min(18, GAME_WIDTH * 0.016)}px monospace`;
        ctx.fillText(lines[1], GAME_WIDTH / 2, GAME_HEIGHT * 0.48);
      }
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  const renderFeatures = (ctx: CanvasRenderingContext2D, sector: Sector) => {
    sector.feature.elements.forEach(element => {
      ctx.save();

      if (element.blur) {
        ctx.filter = `blur(${element.blur}px)`;
      }

      ctx.fillStyle = element.color;
      ctx.globalAlpha = element.opacity;

      switch (element.type) {
        case 'circle':
          if (element.radius) {
            ctx.beginPath();
            ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'ellipse':
          if (element.rx && element.ry) {
            ctx.beginPath();
            ctx.ellipse(element.x, element.y, element.rx, element.ry, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'rect':
          if (element.width && element.height) {
            ctx.fillRect(
              element.x - element.width / 2,
              element.y - element.height / 2,
              element.width,
              element.height
            );
          }
          break;
      }

      ctx.restore();
    });
  };

  const renderPlayer = (ctx: CanvasRenderingContext2D) => {
    const { player: p } = gameStateRef.current;
    ctx.save();

    const w = p.width;
    const h = p.height;
    const px = p.x;
    const py = p.y;

    // Invincibility flash
    if (p.invincibilityFrames > 0) {
      const flashAlpha = (p.invincibilityFrames % 10) < 5 ? 0.3 : 1.0;
      ctx.globalAlpha = flashAlpha;
    }

    // Single shadow for depth
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(0, 255, 255, 0.5)';

    // Main body - simple diamond
    ctx.fillStyle = p.invincibilityFrames > 0 ? '#ffffff' : '#00ffff';
    ctx.beginPath();
    ctx.moveTo(px, py - h / 2);
    ctx.lineTo(px - w / 3, py);
    ctx.lineTo(px, py + h / 2);
    ctx.lineTo(px + w / 3, py);
    ctx.closePath();
    ctx.fill();

    // Left wing
    ctx.fillStyle = '#00cccc';
    ctx.beginPath();
    ctx.moveTo(px - w / 3, py - h / 6);
    ctx.lineTo(px - w / 2, py + h / 4);
    ctx.lineTo(px - w / 3, py + h / 6);
    ctx.closePath();
    ctx.fill();

    // Right wing
    ctx.beginPath();
    ctx.moveTo(px + w / 3, py - h / 6);
    ctx.lineTo(px + w / 2, py + h / 4);
    ctx.lineTo(px + w / 3, py + h / 6);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(px, py - h / 6, w / 7, 0, Math.PI * 2);
    ctx.fill();

    // Engine glow (pulsing)
    const time = Date.now() * 0.01;
    const pulse = 0.7 + Math.sin(time) * 0.3;
    ctx.fillStyle = `rgba(255, 150, 0, ${pulse})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff6600';
    ctx.beginPath();
    ctx.arc(px - w / 8, py + h / 3, w / 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + w / 8, py + h / 3, w / 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;

    // Deflect cooldown indicator
    if (p.deflectCooldown > 0 && !p.isDeflecting) {
      const cooldownPercent = 1 - (p.deflectCooldown / DEFLECT_COOLDOWN);
      const endAngle = -Math.PI / 2 + (Math.PI * 2 * cooldownPercent);

      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(px, py, w * 0.7, -Math.PI / 2, endAngle);
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // Deflect shield visual
    if (p.isDeflecting) {
      const shieldTime = Date.now() * 0.008;
      const pulseScale = 1 + Math.sin(shieldTime * 4) * 0.1;
      const radius = DEFLECT_RADIUS * pulseScale;

      // Main shield circle
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#00ffff';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating particles
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 10;
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 / 8) * i + shieldTime * 2;
        const particleX = px + Math.cos(angle) * radius;
        const particleY = py + Math.sin(angle) * radius;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(particleX, particleY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Powerup timer bar
    const weaponTimer = gameStateRef.current.weaponPowerupTimer;
    if (p.weapon !== 'standard' && weaponTimer > 0) {
      const timerPercent = weaponTimer / (POWERUP_DURATION / (1000 / 60));
      const barWidth = w * 1.2;
      const barX = px - barWidth / 2;
      const barY = py - h / 2 - 15;

      ctx.shadowBlur = 0;
      ctx.fillStyle = WEAPON_CONFIGS[p.weapon].color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(barX, barY, barWidth * timerPercent, 3);
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  };

  const renderEnemies = (ctx: CanvasRenderingContext2D) => {
    const { enemies: enemyList } = gameStateRef.current;
    enemyList.forEach(enemy => {
      const config = ENEMY_CONFIGS[enemy.type];
      ctx.save();

      const ex = enemy.x + enemy.width / 2;
      const ey = enemy.y + enemy.height / 2;
      const ew = enemy.width;
      const eh = enemy.height;

      // Single shadow per enemy
      ctx.shadowBlur = 10;
      ctx.shadowColor = config.colors.accent;

      // Simplified enemy types: Scout (drone/speeder), Fighter (striker), Cruiser (heavy/bomber)
      if (enemy.type === 'drone' || enemy.type === 'speeder') {
        // SCOUT - Simple triangle
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(ex, ey + eh / 2);
        ctx.lineTo(ex - ew / 2, ey - eh / 2);
        ctx.lineTo(ex + ew / 2, ey - eh / 2);
        ctx.closePath();
        ctx.fill();

        // Core
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(ex, ey, ew / 6, 0, Math.PI * 2);
        ctx.fill();

      } else if (enemy.type === 'striker') {
        // FIGHTER - Diamond
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(ex, ey - eh / 2);
        ctx.lineTo(ex + ew / 2, ey);
        ctx.lineTo(ex, ey + eh / 2);
        ctx.lineTo(ex - ew / 2, ey);
        ctx.closePath();
        ctx.fill();

        // Core
        ctx.fillStyle = '#ff88ff';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(ex, ey, ew / 5, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // CRUISER - Rectangle with triangle nose (heavy/bomber)
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(ex - ew / 2, ey - eh / 3, ew, eh * 0.75);

        // Nose
        ctx.beginPath();
        ctx.moveTo(ex, ey + eh / 2);
        ctx.lineTo(ex - ew / 2, ey - eh / 3);
        ctx.lineTo(ex + ew / 2, ey - eh / 3);
        ctx.closePath();
        ctx.fill();

        // Core
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(ex, ey, ew / 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // Elite outline
      if (enemy.isElite) {
        const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.5;
        ctx.strokeStyle = `rgba(255, 255, 0, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00';
        ctx.beginPath();
        ctx.rect(ex - ew / 2 - 3, ey - eh / 2 - 3, ew + 6, eh + 6);
        ctx.stroke();
      }

      // Simple health bar
      if (enemy.maxHealth > 1) {
        const healthPercent = enemy.health / enemy.maxHealth;
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;

        const barWidth = ew;
        const barX = ex - barWidth / 2;
        const barY = ey - eh / 2 - 8;

        const healthColor = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = healthColor;
        ctx.fillRect(barX, barY, barWidth * healthPercent, 2);
      }

      ctx.restore();
    });
  };

  const renderBoss = (ctx: CanvasRenderingContext2D) => {
    const { boss: b } = gameStateRef.current;
    if (!b) return;

    ctx.save();

    // Single shadow for boss
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff0000';

    // Hexagon body
    ctx.fillStyle = '#660000';
    ctx.beginPath();
    const cx = b.x;
    const cy = b.y + b.height / 2;
    const radius = b.width / 2.2;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Pulsing core
    const pulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;
    ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(cx, cy, b.width / 6, 0, Math.PI * 2);
    ctx.fill();

    // Turrets
    b.turrets.forEach((turret) => {
      const turretX = b.x + turret.offsetX;
      const turretY = b.y + turret.offsetY;
      const firing = turret.cooldown > 0;

      ctx.fillStyle = firing ? '#ffff00' : '#aa0000';
      ctx.shadowBlur = firing ? 20 : 10;
      ctx.shadowColor = firing ? '#ffff00' : '#ff0000';
      ctx.beginPath();
      ctx.arc(turretX, turretY, 10, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    // Boss health bar
    const healthPercent = b.health / b.maxHealth;
    const barWidth = Math.min(400, GAME_WIDTH * 0.3);
    const barHeight = 25;
    const barX = (GAME_WIDTH - barWidth) / 2;
    const barY = 30;

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(barX - 3, barY - 3, barWidth + 6, barHeight + 6);

    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, GAME_WIDTH / 2, barY - 8);
    ctx.restore();
  };

  const renderBullets = (ctx: CanvasRenderingContext2D) => {
    const { bullets: bulletList } = gameStateRef.current;
    bulletList.forEach(bullet => {
      ctx.save();

      // Single shadow
      ctx.shadowBlur = 10;
      ctx.shadowColor = bullet.color;

      // Simple solid bullet
      if (bullet.isPlayer) {
        ctx.fillStyle = bullet.color;
        ctx.fillRect(
          bullet.x - bullet.width / 2,
          bullet.y - bullet.height / 2,
          bullet.width,
          bullet.height
        );
      } else {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Deflected indicator
      if (bullet.isDeflected) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.width, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });
  };

  const renderParticles = (ctx: CanvasRenderingContext2D) => {
    const { particles: particleList } = gameStateRef.current;
    particleList.forEach(particle => {
      const alpha = particle.life / particle.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.shadowBlur = particle.type === 'explosion' ? 4 : 2;
      ctx.shadowColor = particle.color;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  };

  const renderPowerups = (ctx: CanvasRenderingContext2D) => {
    const { powerups: powerupList } = gameStateRef.current;
    powerupList.forEach(powerup => {
      const config = WEAPON_CONFIGS[powerup.type];
      ctx.fillStyle = config.color;
      ctx.globalAlpha = 0.8;

      ctx.beginPath();
      ctx.arc(powerup.x, powerup.y, powerup.width / 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.globalAlpha = 1.0;
    });
  };

  const renderUI = (ctx: CanvasRenderingContext2D) => {
    const { stats: s, player: p } = gameStateRef.current;
    ctx.save();

    // Simple text styling
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${s.score}`, 20, 40);

    ctx.textAlign = 'right';
    ctx.fillText(`x${p.lives}`, GAME_WIDTH - 20, 40);

    // Combo display (center top)
    if (s.combo > 0) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 32px monospace';
      const comboAlpha = Math.min(1, (Date.now() - s.lastKillTime) / 1000);
      ctx.globalAlpha = 1 - (comboAlpha * 0.5);
      ctx.fillStyle = s.comboMultiplier > 2 ? '#ff00ff' : s.comboMultiplier > 1.5 ? '#ffff00' : '#00ffff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fillText(`${s.combo} COMBO x${s.comboMultiplier.toFixed(1)}`, GAME_WIDTH / 2, 50);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // Shield bar
    const shieldBarWidth = 120;
    const shieldBarHeight = 12;
    const shieldBarX = 20;
    const shieldBarY = GAME_HEIGHT - 30;

    const shieldPercent = Math.max(0, Math.min(1, p.shield / SHIELD_MAX));
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(shieldBarX, shieldBarY, shieldBarWidth * shieldPercent, shieldBarHeight);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(shieldBarX, shieldBarY, shieldBarWidth, shieldBarHeight);

    // Dev mode indicator
    if (devMode) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#ffff00';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#ffff00';
      ctx.fillText('🔧 DEV MODE', GAME_WIDTH / 2, GAME_HEIGHT - 10);
      ctx.shadowBlur = 0;

      // Invincibility indicator
      if (p.invincibilityFrames > 100) {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff00ff';
        ctx.fillText('INVINCIBLE', GAME_WIDTH / 2, GAME_HEIGHT - 30);
        ctx.shadowBlur = 0;
      }
    }

    ctx.restore();
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <div className="md:hidden fixed inset-0 bg-black z-50 flex flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="text-6xl">🚀</div>
        <h2 className="text-white text-2xl font-bold">Desktop Required</h2>
        <p className="text-gray-400 text-base leading-relaxed">
          Stellar Pursuit requires a keyboard for controls. Please play on a desktop or laptop.
        </p>
        <button
          onClick={() => navigate('/lobby')}
          className="mt-4 px-8 py-3 bg-cyan-900 hover:bg-cyan-800 text-white rounded-xl border border-cyan-500/50 transition-all font-medium"
        >
          Back to Lobby
        </button>
      </div>

      {gameState === 'title' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <h1 className="text-7xl md:text-8xl font-bold text-white mb-8" style={{
              textShadow: '0 0 40px rgba(0,255,255,0.9), 0 0 80px rgba(0,255,255,0.5)'
            }}>
              STELLAR PURSUIT
            </h1>
            <p className="text-cyan-400 text-2xl mb-6 max-w-2xl mx-auto px-4">
              Your children were taken by raiders. Fight through 9 sectors of space to bring them home.
            </p>
          <div className="grid grid-cols-3 gap-4 mb-6 max-w-2xl mx-auto text-center">
            <div className="bg-cyan-900/30 p-3 rounded-lg border border-cyan-500/30">
              <p className="text-cyan-400 font-bold text-sm">45 WAVES</p>
              <p className="text-gray-400 text-xs">Progressive difficulty</p>
            </div>
            <div className="bg-cyan-900/30 p-3 rounded-lg border border-cyan-500/30">
              <p className="text-cyan-400 font-bold text-sm">9 BOSSES</p>
              <p className="text-gray-400 text-xs">Epic sector guardians</p>
            </div>
            <div className="bg-cyan-900/30 p-3 rounded-lg border border-cyan-500/30">
              <p className="text-cyan-400 font-bold text-sm">3 WEAPONS</p>
              <p className="text-gray-400 text-xs">Powerup drops</p>
            </div>
          </div>
          <div className="space-y-4 mb-8">
            <div className="text-left text-gray-300 text-sm max-w-md mx-auto bg-black/50 p-4 rounded-lg border border-cyan-500/30">
              <p className="mb-2 text-cyan-400 font-bold">CONTROLS:</p>
              <p className="mb-1">⬅️➡️ Arrow Keys / A/D - Move Ship Left/Right</p>
              <p className="mb-1">🔫 Auto-Fires Continuously</p>
              <p className="mb-1">🛡️ SPACEBAR - Deflect Shield (Reflects Enemy Bullets)</p>
              <p className="mb-1">⏸️ ESC - Pause</p>
            </div>
          </div>
          <div className="mb-4">
            <p className="text-gray-400 text-sm mb-2">SELECT DIFFICULTY</p>
            <div className="flex gap-3 justify-center mb-6">
              {([
                { key: 'cadet' as const, label: 'CADET', desc: '5 lives, weaker foes', color: 'green' },
                { key: 'pilot' as const, label: 'PILOT', desc: 'Standard challenge', color: 'cyan' },
                { key: 'commander' as const, label: 'COMMANDER', desc: '2 lives, ruthless foes', color: 'red' },
              ]).map(d => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDifficulty(d.key)}
                  className={`px-5 py-3 rounded-lg font-bold text-sm transition-all border-2 ${
                    selectedDifficulty === d.key
                      ? d.color === 'green' ? 'bg-green-600/30 border-green-400 text-green-300 scale-105'
                        : d.color === 'cyan' ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 scale-105'
                        : 'bg-red-600/30 border-red-400 text-red-300 scale-105'
                      : 'bg-gray-800/50 border-gray-600 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  <div>{d.label}</div>
                  <div className="text-xs font-normal mt-1 opacity-70">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4 justify-center mb-4">
            <button
              onClick={startGame}
              className="px-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-white text-2xl font-bold rounded-xl transition-all transform hover:scale-105"
              style={{
                boxShadow: '0 0 30px rgba(0,255,255,0.6)'
              }}
            >
              BEGIN MISSION
            </button>
            <button
              onClick={() => navigate('/lobby')}
              className="px-10 py-5 bg-gray-700 hover:bg-gray-600 text-white text-2xl font-bold rounded-xl transition-all"
            >
              BACK TO LOBBY
            </button>
          </div>

          {/* Dev Mode Toggle */}
          <div className="text-center">
            <button
              onClick={() => setDevMode(!devMode)}
              className={`px-6 py-2 text-sm font-mono rounded-lg transition-all ${
                devMode
                  ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-400'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700'
              }`}
            >
              {devMode ? '🔧 DEV MODE: ON (Press D to toggle)' : 'Press D for Dev Mode'}
            </button>
            {devMode && (
              <div className="mt-3 text-xs text-yellow-400 font-mono bg-black/50 p-3 rounded-lg border border-yellow-400/30 max-w-md mx-auto">
                <p className="font-bold mb-1">DEV CONTROLS:</p>
                <p>I - Toggle Invincibility | N - Skip Wave</p>
                <p>L - Add Life | S - Restore Shield</p>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute inset-0 bg-black">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="w-full h-full"
          />

          {!isPaused && (
            <button
              onClick={() => navigate('/companion-lobby')}
              className="absolute top-4 left-4 z-10 px-6 py-3 bg-gray-900/80 hover:bg-gray-800/90 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all backdrop-blur-sm"
              style={{
                textShadow: '0 0 10px rgba(0,255,255,0.8)'
              }}
            >
              EXIT
            </button>
          )}

          {isPaused && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
              <div className="text-center bg-gray-900/90 p-12 rounded-2xl border-2 border-cyan-500">
                <h2 className="text-6xl font-bold text-white mb-8" style={{
                  textShadow: '0 0 20px rgba(0,255,255,0.8)'
                }}>
                  PAUSED
                </h2>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => setIsPaused(false)}
                    className="px-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-white text-2xl font-bold rounded-xl transition-colors"
                  >
                    RESUME
                  </button>
                  <button
                    onClick={() => {
                      setIsPaused(false);
                      setGameState('title');
                    }}
                    className="px-10 py-5 bg-gray-700 hover:bg-gray-600 text-white text-2xl font-bold rounded-xl transition-colors"
                  >
                    QUIT
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center bg-black/80 p-12 rounded-2xl border-2 border-red-500">
            <h1 className="text-6xl md:text-7xl font-bold text-red-500 mb-8" style={{
              textShadow: '0 0 30px rgba(255,0,0,0.8)'
            }}>
              MISSION FAILED
            </h1>
            <p className="text-white text-3xl mb-4">Final Score: {stats.score}</p>
            <p className="text-gray-400 text-2xl mb-8">Reached Wave {stats.wave}, Sector {stats.sector}</p>
            {stats.score === stats.highScore && stats.score > 0 && (
              <p className="text-yellow-400 text-2xl mb-8" style={{
                textShadow: '0 0 20px rgba(255,255,0,0.8)'
              }}>
                NEW HIGH SCORE!
              </p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={startGame}
                className="px-10 py-5 bg-cyan-600 hover:bg-cyan-500 text-white text-2xl font-bold rounded-xl transition-all"
              >
                TRY AGAIN
              </button>
              <button
                onClick={() => setGameState('title')}
                className="px-10 py-5 bg-gray-700 hover:bg-gray-600 text-white text-2xl font-bold rounded-xl transition-all"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
