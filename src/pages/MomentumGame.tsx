import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../shared/supabase/client';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 22;
const PLAYER_HEIGHT = 22;
const GRAVITY = 0.55;
const HORIZONTAL_SPEED = 4.5;
const BOUNCE_VELOCITY = -13;
const BOOST_VELOCITY = -8;
const BOOST_HORIZONTAL = 2.5;
const PLATFORM_HEIGHT = 14;
const MAX_BOOST_FUEL = 100;
const BOOST_COST = 50;
const FUEL_REGEN = 35;

const themePresets = [
  { name: 'Neon Cityscape', icon: '🌃', hint: 'Cyberpunk rooftops' },
  { name: 'Ancient Ruins', icon: '🏛️', hint: 'Crumbling temples' },
  { name: 'Candy Kingdom', icon: '🍭', hint: 'Sweet dreamland' },
  { name: 'Deep Ocean', icon: '🌊', hint: 'Bioluminescent depths' },
  { name: 'Volcanic Forge', icon: '🌋', hint: 'Molten fire' },
  { name: 'Crystal Caves', icon: '💎', hint: 'Shimmering underground' },
];

interface Platform {
  id: number;
  y: number;
  width: number;
  startX: number;
  x: number;
  moveRange: number;
  speed: number;
  direction: number;
  color: string;
  glow: string;
  isFar: boolean;
  isCheckpoint: boolean;
  touched: boolean;
  minX: number;
  maxX: number;
  type: 'normal' | 'crumbling' | 'spring';
  crumbleTimer: number;
  crumbled: boolean;
  springBounce: number;
}

interface ThemeColors {
  levelName: string;
  background: [string, string];
  playerColor: string;
  playerGlow: string;
  boostTrailColor: string;
  platforms: string[];
  glows: string[];
  checkpoint: string;
  checkpointGlow: string;
  flavorText: string;
  goalY?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

interface PlayerState {
  x: number;
  y: number;
  prevY: number;
  vx: number;
  vy: number;
  boostFuel: number;
  isBoosting: boolean;
  boostTimer: number;
}

const generatePlatforms = (level: number, themeColors: ThemeColors) => {
  const safeJumpCount = 60 + level * 10;
  const platforms: Platform[] = [];
  let currentY = 520;
  let platformId = 0;

  for (let i = 0; i < safeJumpCount; i++) {
    const isFirst = i === 0;
    const isCheckpoint = i > 0 && i % 20 === 0;

    const safeGap = isFirst ? 0 : isCheckpoint ? 65 : 60 + Math.random() * 40;
    currentY -= safeGap;

    const safeWidth = isFirst ? 150 : isCheckpoint ? 180 : 90 + Math.random() * (40 - level);
    const safeStartX = isFirst ? 325 : isCheckpoint ? GAME_WIDTH / 2 - 90 : 50 + Math.random() * (GAME_WIDTH - 200 - safeWidth);
    const safeMoveRange = isFirst ? 100 : isCheckpoint ? 60 : 100 + Math.random() * 100;
    const safeSpeed = isFirst ? 0.3 : isCheckpoint ? 0.35 : 0.4 + Math.random() * (0.3 + level * 0.05);

    const safeColorIndex = platformId % themeColors.platforms.length;

    let platType: Platform['type'] = 'normal';
    if (!isFirst && !isCheckpoint && i > 5) {
      const roll = Math.random();
      if (roll < 0.12 + level * 0.01) platType = 'crumbling';
      else if (roll < 0.20 + level * 0.015) platType = 'spring';
    }

    platforms.push({
      id: platformId++,
      y: currentY,
      width: Math.max(60, safeWidth),
      startX: safeStartX,
      x: safeStartX,
      moveRange: safeMoveRange,
      speed: Math.min(safeSpeed, 1.5),
      direction: Math.random() > 0.5 ? 1 : -1,
      color: isCheckpoint ? themeColors.checkpoint : themeColors.platforms[safeColorIndex],
      glow: isCheckpoint ? themeColors.checkpointGlow : themeColors.glows[safeColorIndex],
      isFar: false,
      isCheckpoint,
      touched: false,
      minX: Math.max(0, safeStartX - safeMoveRange / 2),
      maxX: Math.min(GAME_WIDTH - safeWidth, safeStartX + safeMoveRange / 2),
      type: platType,
      crumbleTimer: 0,
      crumbled: false,
      springBounce: 0,
    });

    if (!isFirst && !isCheckpoint && i > 3 && Math.random() < 0.4) {
      const boostGap = 80 + Math.random() * (70 + level * 5);
      const boostY = currentY - boostGap;

      const boostWidth = 60 + Math.random() * 40;
      const boostStartX = 40 + Math.random() * (GAME_WIDTH - 120 - boostWidth);
      const boostMoveRange = 140 + Math.random() * 160;
      const boostSpeed = (0.8 + level * 0.15) + Math.random() * (0.8 + level * 0.2);

      const boostColorIndex = platformId % themeColors.platforms.length;

      platforms.push({
        id: platformId++,
        y: boostY,
        width: boostWidth,
        startX: boostStartX,
        x: boostStartX,
        moveRange: boostMoveRange,
        speed: Math.min(boostSpeed, 2.8),
        direction: Math.random() > 0.5 ? 1 : -1,
        color: themeColors.platforms[boostColorIndex],
        glow: themeColors.glows[boostColorIndex],
        isFar: true,
        isCheckpoint: false,
        touched: false,
        minX: Math.max(0, boostStartX - boostMoveRange / 2),
        maxX: Math.min(GAME_WIDTH - boostWidth, boostStartX + boostMoveRange / 2),
        type: 'normal',
        crumbleTimer: 0,
        crumbled: false,
        springBounce: 0,
      });
    }
  }

  platforms.sort((a, b) => b.y - a.y);

  return { platforms, goalY: currentY - 50 };
};

interface CareerLevel {
  number: number;
  name: string;
  theme: string;
  timeLimit: number;
  threeStarTime: number;
  twoStarTime: number;
  difficulty: number;
}

const careerLevels: CareerLevel[] = [
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

export function MomentumGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [gameState, setGameState] = useState<'menu' | 'modeSelect' | 'careerLevelSelect' | 'themeSelect' | 'loading' | 'playing' | 'levelComplete' | 'gameOver' | 'careerFailed'>('menu');
  const [gameMode, setGameMode] = useState<'freeplay' | 'career'>('freeplay');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [level, setLevel] = useState(1);
  const [careerProgress, setCareerProgress] = useState<any[]>([]);
  const [currentCareerLevel, setCurrentCareerLevel] = useState<CareerLevel | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [levelData, setLevelData] = useState<ThemeColors | null>(null);
  const [score, setScore] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [finalTime, setFinalTime] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const playerRef = useRef<PlayerState>({ x: 100, y: 300, prevY: 300, vx: 0, vy: 0, boostFuel: MAX_BOOST_FUEL, isBoosting: false, boostTimer: 0 });
  const trailRef = useRef<TrailPoint[]>([]);
  const platformsRef = useRef<Platform[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef({ left: false, right: false, boost: false, boostUsed: false });
  const cameraYRef = useRef(0);
  const gameLoopRef = useRef<number>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastPlatformRef = useRef(-1);
  const startYRef = useRef(0);
  const goalYRef = useRef(0);
  const highestYRef = useRef(520);
  const checkpointYRef = useRef(520);
  const startTimeRef = useRef(0);
  const elapsedTimeRef = useRef(0);
  const timerIntervalRef = useRef<number>();
  const speedLinesRef = useRef<Array<{ x: number; y: number; length: number; speed: number; opacity: number }>>([]);
  const pauseTimeRef = useRef(0);
  const lastPlatformYRef = useRef(520); // Track last successful platform landing
  const bounceYRef = useRef<number | null>(null); // Y position at moment of bounce, null when not recently bounced

  useEffect(() => {
    if (gameMode === 'career') {
      loadCareerProgress();
    }
  }, [gameMode]);

  const loadCareerProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('momentum_career_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('level_number', { ascending: true });

      if (error) throw error;
      setCareerProgress(data || []);
    } catch (error) {
      console.error('Failed to load career progress:', error);
      setCareerProgress([]);
    }
  };

  const saveCareerProgress = async (levelNum: number, completed: boolean, time: number, stars: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existingProgress = careerProgress.find(p => p.level_number === levelNum);

      if (existingProgress) {
        const shouldUpdate = !existingProgress.completed ||
                            (completed && time < existingProgress.best_time) ||
                            stars > existingProgress.stars_earned;

        if (shouldUpdate) {
          await supabase
            .from('momentum_career_progress')
            .update({
              completed,
              best_time: completed && (!existingProgress.best_time || time < existingProgress.best_time) ? time : existingProgress.best_time,
              stars_earned: Math.max(stars, existingProgress.stars_earned || 0),
              score_achieved: Math.max(scoreRef.current, existingProgress.score_achieved || 0),
              attempts: existingProgress.attempts + 1,
              theme_used: levelData?.levelName || theme
            })
            .eq('id', existingProgress.id);
        } else {
          await supabase
            .from('momentum_career_progress')
            .update({ attempts: existingProgress.attempts + 1 })
            .eq('id', existingProgress.id);
        }
      } else {
        await supabase
          .from('momentum_career_progress')
          .insert({
            user_id: user.id,
            level_number: levelNum,
            completed,
            best_time: completed ? time : null,
            stars_earned: stars,
            score_achieved: scoreRef.current,
            attempts: 1,
            theme_used: levelData?.levelName || theme
          });
      }

      await loadCareerProgress();
    } catch (error) {
      console.error('Failed to save career progress:', error);
    }
  };

  const generateThemeWithAI = async (selectedTheme: string, currentLevel: number, careerLevel?: CareerLevel) => {
    setLoadingText('Painting your world...');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-momentum-theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ theme: selectedTheme })
      });

      if (!response.ok) {
        throw new Error('Failed to generate theme');
      }

      const themeConfig: ThemeColors = await response.json();

      const { platforms, goalY } = generatePlatforms(careerLevel?.difficulty || currentLevel, themeConfig);

      platformsRef.current = platforms;
      const firstPlatform = platforms[0];
      playerRef.current = {
        x: firstPlatform.startX + firstPlatform.width / 2 - PLAYER_WIDTH / 2,
        y: 520 - PLAYER_HEIGHT - 2,
        prevY: 520 - PLAYER_HEIGHT - 2,
        vx: 0,
        vy: 0,
        boostFuel: MAX_BOOST_FUEL,
        isBoosting: false,
        boostTimer: 0
      };
      cameraYRef.current = 0;
      scoreRef.current = 0;
      comboRef.current = 0;
      lastPlatformRef.current = -1;
      particlesRef.current = [];
      trailRef.current = [];
      startYRef.current = 520;
      goalYRef.current = goalY;
      highestYRef.current = 520;
      checkpointYRef.current = 520;
      lastPlatformYRef.current = 520; // Initialize last platform Y
      startTimeRef.current = Date.now();
      elapsedTimeRef.current = 0;

      if (careerLevel) {
        setTimeRemaining(careerLevel.timeLimit);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = window.setInterval(() => {
          setTimeRemaining(prev => {
            if (prev <= 0) {
              if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
              return 0;
            }
            return prev - 0.1;
          });
        }, 100);
      }

      setLevelData({ ...themeConfig, goalY });
      setScore(0);
      setIsPaused(false);
      pauseTimeRef.current = 0;
      initSpeedLines();
      setGameState('playing');
    } catch (error) {
      console.error('Theme generation failed:', error);
      setLoadingText('Retrying...');
      setTimeout(() => generateThemeWithAI(selectedTheme, currentLevel, careerLevel), 1000);
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const spawnParticles = (x: number, y: number, color: string, count = 6, spread = 8) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * spread,
        vy: -Math.random() * 5 - 2,
        life: 1,
        color,
        size: Math.random() * 5 + 2
      });
    }
    if (particlesRef.current.length > 100) {
      particlesRef.current = particlesRef.current.slice(-100);
    }
  };

  const spawnBoostParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 3; i++) {
      particlesRef.current.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + Math.random() * 10,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 1,
        life: 0.8,
        color,
        size: Math.random() * 4 + 3
      });
    }
  };

  const checkCollision = (player: PlayerState, platform: Platform) => {
    const playerBottom = player.y + PLAYER_HEIGHT;
    const playerPrevBottom = player.prevY + PLAYER_HEIGHT;
    const platformTop = platform.y;
    const platformLeft = platform.x - 10;
    const platformRight = platform.x + platform.width + 10;
    const playerCenterX = player.x + PLAYER_WIDTH / 2;

    const wasAbove = playerPrevBottom <= platformTop + 6;
    const nowAtOrBelow = playerBottom >= platformTop - 2;
    const horizontalOverlap = playerCenterX >= platformLeft && playerCenterX <= platformRight;
    const isFalling = player.vy > 0;

    return wasAbove && nowAtOrBelow && horizontalOverlap && isFalling;
  };

  const respawnAtCheckpoint = () => {
    const player = playerRef.current;
    const checkpointPlatform = platformsRef.current.find(p => p.isCheckpoint && p.y >= checkpointYRef.current && p.touched)
      || platformsRef.current[0];

    player.x = checkpointPlatform.x + checkpointPlatform.width / 2 - PLAYER_WIDTH / 2;
    player.y = checkpointPlatform.y - PLAYER_HEIGHT - 2;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.boostFuel = MAX_BOOST_FUEL;
    cameraYRef.current = Math.max(0, GAME_HEIGHT / 2.5 - player.y);
    comboRef.current = 0;
    lastPlatformYRef.current = player.y; // Reset last platform Y on respawn
  };

  const saveGameStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('momentum_game_stats').insert({
        user_id: user.id,
        level,
        theme_name: levelData?.levelName || theme,
        score: scoreRef.current,
        completion_time: elapsedTimeRef.current,
        completed: gameState === 'levelComplete'
      });
    } catch (error) {
      console.error('Failed to save game stats:', error);
    }
  };

  const initSpeedLines = () => {
    speedLinesRef.current = [];
    for (let i = 0; i < 30; i++) {
      speedLinesRef.current.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        length: 20 + Math.random() * 40,
        speed: 2 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.3
      });
    }
  };

  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !levelData || isPaused) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const platforms = platformsRef.current;
    const keys = keysRef.current;

    elapsedTimeRef.current = (Date.now() - startTimeRef.current - pauseTimeRef.current) / 1000;

    // Calculate movement state for both speed lines and rendering
    const fallenDistance = player.y - lastPlatformYRef.current;
    const isTrueFalling = player.vy > 0 && fallenDistance > 150; // ~2 platform gaps (true free fall)

    // Rising lines must wait until ball has actually traveled 80px UP from the bounce point
    // This prevents lines firing at the moment of contact when vy goes negative
    const risenFromBounce = bounceYRef.current !== null ? (bounceYRef.current - player.y) : 9999;
    if (risenFromBounce > 250) bounceYRef.current = null; // Clear once well past bounce
    const isRisingFast = player.vy < -8 && (bounceYRef.current === null || risenFromBounce >= 80);
    const speedIntensity = isTrueFalling ? Math.abs(player.vy) / 15 : isRisingFast ? Math.abs(player.vy) / 20 : 0;

    speedLinesRef.current.forEach(line => {
      if (isTrueFalling) {
        // Falling: lines move downward (standard)
        line.y += line.speed * (1 + speedIntensity * 2);
        if (line.y > GAME_HEIGHT + line.length) {
          line.y = -line.length;
          line.x = Math.random() * GAME_WIDTH;
        }
      } else if (isRisingFast) {
        // Rising: lines move upward (reversed)
        line.y -= line.speed * (1 + speedIntensity * 2);
        if (line.y < -line.length) {
          line.y = GAME_HEIGHT + line.length;
          line.x = Math.random() * GAME_WIDTH;
        }
      } else {
        // No significant motion: gentle drift
        line.y += line.speed * 0.3;
        if (line.y > GAME_HEIGHT + line.length) {
          line.y = -line.length;
          line.x = Math.random() * GAME_WIDTH;
        }
      }
    });

    platforms.forEach(platform => {
      platform.x += platform.speed * platform.direction;
      if (platform.x <= platform.minX) {
        platform.x = platform.minX;
        platform.direction = 1;
      } else if (platform.x >= platform.maxX) {
        platform.x = platform.maxX;
        platform.direction = -1;
      }
    });

    player.prevY = player.y;

    if (keys.left) player.vx = -HORIZONTAL_SPEED;
    else if (keys.right) player.vx = HORIZONTAL_SPEED;
    else player.vx *= 0.82;

    if (keys.boost && !keys.boostUsed && player.boostFuel >= BOOST_COST && player.vy > -10) {
      player.vy += BOOST_VELOCITY;
      if (keys.left) player.vx -= BOOST_HORIZONTAL;
      if (keys.right) player.vx += BOOST_HORIZONTAL;
      player.boostFuel -= BOOST_COST;
      player.isBoosting = true;
      player.boostTimer = 25;
      keys.boostUsed = true;
      spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.boostTrailColor || '#00ffff', 12, 12);
    }
    if (!keys.boost) keys.boostUsed = false;

    if (player.boostTimer > 0) {
      player.boostTimer--;
      spawnBoostParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.boostTrailColor || '#00ffff');
    } else {
      player.isBoosting = false;
    }

    if (player.isBoosting || player.boostTimer > 0) {
      trailRef.current.push({ x: player.x + PLAYER_WIDTH/2, y: player.y + PLAYER_HEIGHT/2, life: 1 });
      if (trailRef.current.length > 20) trailRef.current.shift();
    }
    trailRef.current = trailRef.current.filter(t => { t.life -= 0.08; return t.life > 0; });

    player.vy += GRAVITY;
    if (player.vy > 18) player.vy = 18;
    player.x += player.vx;
    player.y += player.vy;

    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x > GAME_WIDTH - PLAYER_WIDTH) { player.x = GAME_WIDTH - PLAYER_WIDTH; player.vx = 0; }

    if (player.y < highestYRef.current) {
      const heightGained = highestYRef.current - player.y;
      scoreRef.current += Math.floor(heightGained * (1 + comboRef.current * 0.1));
      highestYRef.current = player.y;
      setScore(scoreRef.current);
    }

    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      if (platform.crumbled) continue;

      if (platform.crumbleTimer > 0) {
        platform.crumbleTimer -= 1/60;
        if (platform.crumbleTimer <= 0) {
          platform.crumbled = true;
          spawnParticles(platform.x + platform.width/2, platform.y, platform.color, 12, 10);
          continue;
        }
      }

      if (platform.springBounce > 0) {
        platform.springBounce -= 0.05;
      }

      if (checkCollision(player, platform)) {
        player.y = platform.y - PLAYER_HEIGHT;

        if (platform.type === 'spring') {
          player.vy = BOUNCE_VELOCITY * 1.6;
          platform.springBounce = 1;
          spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#00ff88', 15, 12);
        } else {
          player.vy = BOUNCE_VELOCITY - (level * 0.3);
        }

        if (platform.type === 'crumbling' && platform.crumbleTimer <= 0) {
          platform.crumbleTimer = 0.5;
        }

        lastPlatformYRef.current = player.y;
        bounceYRef.current = player.y; // Record exact Y at bounce for rising lines delay

        if (lastPlatformRef.current !== platform.id) {
          if (!platform.touched) {
            platform.touched = true;
            player.boostFuel = Math.min(MAX_BOOST_FUEL, player.boostFuel + FUEL_REGEN);
            const pointMultiplier = platform.type === 'spring' ? 2 : 1;
            scoreRef.current += 50 * (1 + comboRef.current) * pointMultiplier;
            setScore(scoreRef.current);

            if (platform.isCheckpoint) {
              checkpointYRef.current = platform.y;
              spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.checkpointGlow, 20, 15);
            }
          }

          comboRef.current++;
          lastPlatformRef.current = platform.id;
          spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, platform.glow || platform.color, platform.isFar ? 15 : 8);
        }
        break;
      }
    }

    const targetCameraY = Math.max(0, GAME_HEIGHT / 2.5 - player.y);
    cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.06;
    const camY = cameraYRef.current;

    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.025;
      return p.life > 0;
    });

    if (gameMode === 'career' && timeRemaining <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setGameState('careerFailed');
      if (currentCareerLevel) {
        saveCareerProgress(currentCareerLevel.number, false, 0, 0);
      }
      saveGameStats();
      return;
    }

    if (player.y < levelData.goalY!) {
      const time = elapsedTimeRef.current;

      if (gameMode === 'career' && currentCareerLevel) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        let stars = 1;
        if (time <= currentCareerLevel.threeStarTime) stars = 3;
        else if (time <= currentCareerLevel.twoStarTime) stars = 2;

        const bonus = Math.max(0, Math.floor((currentCareerLevel.timeLimit - time) * 100));
        setFinalTime(time);
        setSpeedBonus(bonus);
        setStarsEarned(stars);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        saveCareerProgress(currentCareerLevel.number, true, time, stars);
        setGameState('levelComplete');
        saveGameStats();
      } else {
        const targetTime = 45 + level * 5;
        const bonus = Math.max(0, Math.floor((targetTime - time) * 100));
        setFinalTime(time);
        setSpeedBonus(bonus);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        setGameState('levelComplete');
        saveGameStats();
      }
      return;
    }

    if (player.y - camY > GAME_HEIGHT + 80) {
      if (checkpointYRef.current < 500) {
        respawnAtCheckpoint();
        comboRef.current = 0;
      } else {
        setGameState('gameOver');
        saveGameStats();
        return;
      }
    }

    const bg = levelData.background || ['#1a1a2e', '#0f3460'];
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, bg[0]);
    gradient.addColorStop(1, bg[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Render speed lines only when truly falling or rising fast
    const showSpeedLines = isTrueFalling || isRisingFast;

    if (showSpeedLines) {
      speedLinesRef.current.forEach(line => {
        const intensity = Math.abs(player.vy) / 15;
        const alpha = line.opacity * Math.min(1, intensity * 1.2);
        if (alpha > 0.05) {
          // Different colors for falling vs rising
          const lineColor = isTrueFalling
            ? `rgba(255, 100, 100, ${alpha})` // Red tint for falling
            : `rgba(100, 200, 255, ${alpha})`; // Blue/cyan tint for rising
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = intensity > 0.8 ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(line.x, line.y);
          // Lines point in direction of movement
          if (isTrueFalling) {
            ctx.lineTo(line.x, line.y + line.length * intensity);
          } else {
            ctx.lineTo(line.x, line.y - line.length * intensity);
          }
          ctx.stroke();
        }
      });
    }

    const progress = Math.max(0, Math.min(1, (startYRef.current - player.y) / (startYRef.current - goalYRef.current)));
    const barHeight = GAME_HEIGHT - 140;
    const barX = GAME_WIDTH - 20;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(barX, 70, 6, barHeight);
    ctx.fillStyle = levelData.playerGlow || 'rgba(255,255,255,0.6)';
    ctx.fillRect(barX, 70 + barHeight * (1 - progress), 6, barHeight * progress);

    platforms.filter(p => p.isCheckpoint).forEach(cp => {
      const cpProgress = (startYRef.current - cp.y) / (startYRef.current - goalYRef.current);
      const markerY = 70 + barHeight * (1 - cpProgress);
      ctx.fillStyle = cp.touched ? levelData.checkpointGlow : 'rgba(255,255,255,0.3)';
      ctx.fillRect(barX - 4, markerY - 2, 14, 4);
    });

    const goalScreenY = levelData.goalY! + camY;
    if (goalScreenY > -50 && goalScreenY < GAME_HEIGHT + 50) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, goalScreenY);
      ctx.lineTo(GAME_WIDTH - 35, goalScreenY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('★ GOAL ★', GAME_WIDTH / 2, goalScreenY - 8);
    }

    platforms.forEach(platform => {
      if (platform.crumbled) return;
      const screenY = platform.y + camY;
      if (screenY < -30 || screenY > GAME_HEIGHT + 30) return;

      let alpha = platform.touched ? 0.4 : 1;
      const glowSize = platform.touched ? 6 : platform.isCheckpoint ? 30 : platform.isFar ? 22 : 14;

      if (platform.crumbleTimer > 0) {
        alpha *= platform.crumbleTimer / 0.5;
        const shakeX = (Math.random() - 0.5) * 4;
        const shakeY = (Math.random() - 0.5) * 2;
        ctx.save();
        ctx.translate(shakeX, shakeY);
      }

      ctx.shadowColor = platform.glow || platform.color;
      ctx.shadowBlur = glowSize;

      if (platform.type === 'spring' && !platform.touched) {
        ctx.fillStyle = '#00ff88';
      } else if (platform.type === 'crumbling' && !platform.touched) {
        ctx.fillStyle = platform.color;
        ctx.setLineDash([6, 4]);
      } else {
        ctx.fillStyle = platform.color;
      }
      ctx.globalAlpha = alpha;

      const springOffset = platform.springBounce > 0 ? Math.sin(platform.springBounce * Math.PI) * 6 : 0;
      ctx.beginPath();
      ctx.roundRect(platform.x, screenY + springOffset, platform.width, PLATFORM_HEIGHT, platform.isCheckpoint ? 4 : 7);
      ctx.fill();
      ctx.setLineDash([]);

      if (platform.type === 'spring' && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00ff88';
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.006) * 0.3;
        const cx = platform.x + platform.width / 2;
        ctx.beginPath();
        ctx.moveTo(cx - 6, screenY + springOffset - 2);
        ctx.lineTo(cx, screenY + springOffset - 8);
        ctx.lineTo(cx + 6, screenY + springOffset - 2);
        ctx.fill();
      }

      if (platform.type === 'crumbling' && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,200,100,0.5)';
        ctx.globalAlpha = 0.6;
        ctx.font = '8px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('FRAGILE', platform.x + platform.width/2, screenY + springOffset - 4);
      }

      if (platform.isCheckpoint && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('CHECKPOINT', platform.x + platform.width/2, screenY - 8);
      }

      if (platform.isFar && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;
        ctx.beginPath();
        ctx.arc(platform.x + platform.width/2, screenY + PLATFORM_HEIGHT/2, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      if (platform.crumbleTimer > 0) {
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    if (trailRef.current.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < trailRef.current.length; i++) {
        const t = trailRef.current[i];
        const prev = trailRef.current[i-1];
        ctx.strokeStyle = levelData.boostTrailColor || '#00ffff';
        ctx.globalAlpha = t.life * 0.7;
        ctx.lineWidth = t.life * 12;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y + camY);
        ctx.lineTo(t.x, t.y + camY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    particlesRef.current.forEach(p => {
      const screenY = p.y + camY;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, screenY, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    const playerScreenY = player.y + camY;
    const squash = player.vy > 6 ? 0.75 : player.vy < -6 ? 1.25 : 1;
    const stretch = 1 / squash;

    ctx.save();
    ctx.translate(player.x + PLAYER_WIDTH/2, playerScreenY + PLAYER_HEIGHT/2);
    ctx.scale(stretch, squash);

    if (player.isBoosting || player.boostTimer > 0) {
      ctx.shadowColor = levelData.boostTrailColor || '#00ffff';
      ctx.shadowBlur = 30;
    } else {
      ctx.shadowColor = levelData.playerGlow || 'rgba(255,255,255,0.8)';
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = player.isBoosting ? (levelData.boostTrailColor || '#00ffff') : (levelData.playerColor || '#ffffff');
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_WIDTH/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${level}`, 16, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui';
    ctx.fillText(levelData.levelName || '', 16, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'italic 10px system-ui';
    ctx.fillText(levelData.flavorText || '', 16, 58);

    ctx.textAlign = 'center';
    if (gameMode === 'career') {
      const isLowTime = timeRemaining < 10;
      const isVeryLowTime = timeRemaining < 5;
      ctx.fillStyle = isVeryLowTime ? 'rgba(255,50,50,0.9)' : isLowTime ? 'rgba(255,150,50,0.9)' : 'rgba(255,255,255,0.9)';
      ctx.font = isVeryLowTime ? 'bold 24px monospace' : isLowTime ? 'bold 18px monospace' : 'bold 16px monospace';
      const timeText = timeRemaining > 0 ? timeRemaining.toFixed(1) + 's' : 'TIME UP!';
      ctx.fillText(timeText, GAME_WIDTH / 2, isVeryLowTime ? 32 : 26);

      if (isVeryLowTime) {
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.3;
        ctx.fillStyle = 'rgba(255,0,0,0.8)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '12px monospace';
      ctx.fillText(elapsedTimeRef.current.toFixed(1) + 's', GAME_WIDTH / 2, 24);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px system-ui';
    ctx.fillText('SCORE', GAME_WIDTH - 40, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '20px system-ui';
    ctx.fillText(scoreRef.current.toLocaleString(), GAME_WIDTH - 40, 46);

    if (comboRef.current > 1) {
      ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(`${comboRef.current}x COMBO`, GAME_WIDTH - 40, 64);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(16, GAME_HEIGHT - 28, 100, 6);
    const fuelColor = player.boostFuel >= BOOST_COST ? (levelData.boostTrailColor || '#00ffff') : 'rgba(255,100,100,0.6)';
    ctx.fillStyle = fuelColor;
    ctx.fillRect(16, GAME_HEIGHT - 28, player.boostFuel, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('BOOST [SPACE]', 16, GAME_HEIGHT - 36);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, levelData, level]);

  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    const pauseStartTimeRef = { current: 0 };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (!isPaused) {
            pauseStartTimeRef.current = Date.now();
            setIsPaused(true);
            if (timerIntervalRef.current && gameMode === 'career') {
              clearInterval(timerIntervalRef.current);
            }
          } else {
            pauseTimeRef.current += Date.now() - pauseStartTimeRef.current;
            setIsPaused(false);
            if (gameMode === 'career' && currentCareerLevel) {
              timerIntervalRef.current = window.setInterval(() => {
                setTimeRemaining(prev => {
                  if (prev <= 0) {
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    return 0;
                  }
                  return prev - 0.1;
                });
              }, 100);
            }
          }
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = true;
        if (e.key === ' ') { e.preventDefault(); keysRef.current.boost = true; }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
      if (e.key === ' ') keysRef.current.boost = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, isPaused, gameMode, currentCareerLevel]);

  const selectTheme = (t: string) => {
    setTheme(t);
    setGameState('loading');
    generateThemeWithAI(t, level);
  };

  const startCareerLevel = (careerLevel: CareerLevel) => {
    setCurrentCareerLevel(careerLevel);
    setLevel(careerLevel.difficulty);
    setTheme(careerLevel.theme);
    setGameState('loading');
    generateThemeWithAI(careerLevel.theme, careerLevel.difficulty, careerLevel);
  };

  const nextLevel = () => {
    if (gameMode === 'career') {
      setGameState('careerLevelSelect');
    } else {
      setLevel(l => l + 1);
      setGameState('themeSelect');
    }
  };

  const restart = () => {
    setLevel(1);
    setScore(0);
    scoreRef.current = 0;
    if (gameMode === 'career') {
      setGameState('careerLevelSelect');
    } else {
      setGameState('themeSelect');
    }
  };

  const retryLevel = () => {
    if (!levelData) return;

    const { platforms, goalY } = generatePlatforms(level, levelData);
    platformsRef.current = platforms;

    const firstPlatform = platforms[0];
    playerRef.current = {
      x: firstPlatform.startX + firstPlatform.width / 2 - PLAYER_WIDTH / 2,
      y: 520 - PLAYER_HEIGHT - 2,
      prevY: 520 - PLAYER_HEIGHT - 2,
      vx: 0,
      vy: 0,
      boostFuel: MAX_BOOST_FUEL,
      isBoosting: false,
      boostTimer: 0
    };
    cameraYRef.current = 0;
    scoreRef.current = 0;
    comboRef.current = 0;
    lastPlatformRef.current = -1;
    particlesRef.current = [];
    trailRef.current = [];
    startYRef.current = 520;
    goalYRef.current = goalY;
    highestYRef.current = 520;
    checkpointYRef.current = 520;
    lastPlatformYRef.current = 520; // Reset last platform Y on retry
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;

    setScore(0);
    setIsPaused(false);
    pauseTimeRef.current = 0;
    initSpeedLines();
    setLevelData(prev => prev ? { ...prev, goalY } : null);
    setGameState('playing');
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center">
        <div className="max-w-2xl w-full p-6">
          <button
            onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }}
            className="mb-8 flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Exit Game
          </button>

          <div className="text-center">
            <h1 className="text-5xl font-extralight tracking-[0.3em] text-white mb-1" style={{ textShadow: '0 0 60px rgba(255,255,255,0.2)' }}>MOMENTUM</h1>
            <p className="text-gray-500 text-xs tracking-[0.2em] mb-10">AI-GENERATED PLATFORMER</p>

            <div className="text-gray-400 text-sm mb-4 text-center space-y-3">
              <p>Auto-bounce up • Score while ascending</p>
              <div className="flex justify-center gap-3">
                <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">← A</span>
                <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">D →</span>
                <span className="px-4 py-2 bg-cyan-500/20 rounded-lg text-cyan-300 text-xs">SPACE Boost</span>
              </div>
              <p className="text-gray-600 text-xs">Checkpoints save progress • Speed bonus at finish</p>
            </div>

            <button onClick={() => setGameState('modeSelect')} className="mt-6 px-14 py-4 bg-white/5 hover:bg-white/10 text-white/90 rounded-full transition-all duration-500 tracking-[0.15em] text-sm border border-white/10">
              BEGIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'modeSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <h2 className="text-3xl font-extralight text-white tracking-wider mb-8 text-center">Select Mode</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <button
              onClick={() => {
                setGameMode('career');
                setGameState('careerLevelSelect');
              }}
              className="group p-8 bg-gradient-to-br from-orange-500/10 to-red-500/10 hover:from-orange-500/20 hover:to-red-500/20 rounded-2xl transition-all duration-300 border border-orange-500/20 hover:border-orange-500/40 text-left"
            >
              <div className="text-4xl mb-3">⏱️</div>
              <h3 className="text-2xl font-light text-white mb-2">Career Mode</h3>
              <p className="text-white/50 text-sm mb-3">Time-based challenges with escalating difficulty</p>
              <div className="flex items-center gap-2 text-orange-400 text-xs">
                <span>10 Levels</span>
                <span>•</span>
                <span>Beat the clock</span>
                <span>•</span>
                <span>Earn stars</span>
              </div>
            </button>

            <button
              onClick={() => {
                setGameMode('freeplay');
                setGameState('themeSelect');
              }}
              className="group p-8 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 rounded-2xl transition-all duration-300 border border-cyan-500/20 hover:border-cyan-500/40 text-left"
            >
              <div className="text-4xl mb-3">🎨</div>
              <h3 className="text-2xl font-light text-white mb-2">Free Play</h3>
              <p className="text-white/50 text-sm mb-3">Endless progression with custom AI-generated themes</p>
              <div className="flex items-center gap-2 text-cyan-400 text-xs">
                <span>Infinite levels</span>
                <span>•</span>
                <span>No time limit</span>
                <span>•</span>
                <span>Relaxed</span>
              </div>
            </button>
          </div>

          <button
            onClick={() => setGameState('menu')}
            className="mx-auto block px-6 py-2 text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'careerLevelSelect') {
    const maxUnlockedLevel = Math.max(
      1,
      ...careerProgress.filter(p => p.completed).map(p => p.level_number + 1)
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6 overflow-y-auto">
        <div className="max-w-4xl w-full py-8">
          <h2 className="text-3xl font-extralight text-white tracking-wider mb-2 text-center">Career Mode</h2>
          <p className="text-white/40 text-sm text-center mb-8">Complete levels within the time limit to earn stars</p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {careerLevels.map((careerLevel) => {
              const progress = careerProgress.find(p => p.level_number === careerLevel.number);
              const isLocked = careerLevel.number > maxUnlockedLevel;
              const stars = progress?.stars_earned || 0;

              return (
                <button
                  key={careerLevel.number}
                  onClick={() => !isLocked && startCareerLevel(careerLevel)}
                  disabled={isLocked}
                  className={`
                    group relative p-4 rounded-xl transition-all duration-300 text-left
                    ${isLocked
                      ? 'bg-white/[0.02] border border-white/5 cursor-not-allowed opacity-40'
                      : progress?.completed
                        ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                        : 'bg-white/[0.05] border border-white/10 hover:bg-white/[0.1] hover:border-white/20'
                    }
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-white/90 font-bold text-lg">{careerLevel.number}</span>
                    {isLocked && <span className="text-white/30 text-xl">🔒</span>}
                  </div>
                  <h3 className="text-white/80 text-xs font-medium mb-1 leading-tight">{careerLevel.name}</h3>
                  <p className="text-white/30 text-[10px] mb-2">{careerLevel.timeLimit}s limit</p>

                  {progress?.completed && (
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(s => (
                        <span key={s} className={`text-sm ${s <= stars ? 'text-yellow-400' : 'text-white/10'}`}>★</span>
                      ))}
                    </div>
                  )}

                  {progress && !progress.completed && (
                    <p className="text-orange-400/60 text-[10px]">{progress.attempts} attempts</p>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setGameState('modeSelect')}
            className="mx-auto block px-6 py-2 text-white/40 hover:text-white/60 transition-colors text-sm"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'themeSelect') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <p className="text-white/30 text-xs tracking-[0.2em] mb-1 text-center">LEVEL {level}</p>
          <h2 className="text-2xl font-extralight text-white tracking-wider mb-8 text-center">Choose Your World</h2>

          <div className="grid grid-cols-3 gap-3 mb-8">
            {themePresets.map((t) => (
              <button key={t.name} onClick={() => selectTheme(t.name)} className="group p-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all duration-300 text-left border border-white/5 hover:border-white/10">
                <span className="text-xl block mb-1 opacity-80 group-hover:opacity-100">{t.icon}</span>
                <span className="text-white/90 text-xs block leading-tight">{t.name}</span>
                <span className="text-white/30 text-[10px]">{t.hint}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input type="text" value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Or describe your own world..." className="flex-1 px-4 py-3 bg-white/[0.03] rounded-xl text-white placeholder-white/20 outline-none focus:bg-white/[0.06] transition-all text-sm border border-white/5" onKeyDown={(e) => e.key === 'Enter' && customTheme && selectTheme(customTheme)} />
            <button onClick={() => customTheme && selectTheme(customTheme)} disabled={!customTheme} className="px-5 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 text-white rounded-xl transition-all text-sm">Create</button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border border-white/20 border-t-cyan-400 rounded-full animate-spin mb-8" />
        <p className="text-white/50 text-sm tracking-wider">{loadingText}</p>
        <p className="text-white/25 text-xs mt-2">{theme}</p>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="relative">
          <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="block rounded-lg shadow-2xl" />

          {isPaused && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center">
              <h2 className="text-4xl font-extralight text-white mb-8 tracking-wider">PAUSED</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    pauseTimeRef.current += Date.now() - (pauseTimeRef.current || Date.now());
                    setIsPaused(false);
                    if (gameMode === 'career' && currentCareerLevel && !timerIntervalRef.current) {
                      timerIntervalRef.current = window.setInterval(() => {
                        setTimeRemaining(prev => {
                          if (prev <= 0) {
                            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                            return 0;
                          }
                          return prev - 0.1;
                        });
                      }, 100);
                    }
                  }}
                  className="px-12 py-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all text-sm border border-white/20"
                >
                  Resume
                </button>
                <button
                  onClick={() => {
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    if (gameMode === 'career') {
                      setGameState('careerLevelSelect');
                    } else {
                      setGameState('menu');
                    }
                  }}
                  className="px-12 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm"
                >
                  Exit
                </button>
              </div>
              <p className="text-white/30 text-xs mt-8">Press ESC to resume</p>
            </div>
          )}

          {!isPaused && (
            <div className="absolute top-4 right-4 flex gap-2">
              <button
                onClick={() => setIsPaused(true)}
                className="px-4 py-2 bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-lg transition-all text-xs backdrop-blur-sm border border-white/10"
              >
                PAUSE
              </button>
              <button
                onClick={() => {
                  if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                  if (gameMode === 'career') {
                    setGameState('careerLevelSelect');
                  } else {
                    setGameState('menu');
                  }
                }}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-lg transition-all text-xs backdrop-blur-sm border border-red-500/20"
              >
                EXIT
              </button>
            </div>
          )}

          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 md:hidden">
            <button onTouchStart={() => keysRef.current.left = true} onTouchEnd={() => keysRef.current.left = false} className="w-16 h-16 rounded-full bg-white/10 active:bg-white/25 text-white text-xl select-none">←</button>
            <button onTouchStart={() => { keysRef.current.boost = true; }} onTouchEnd={() => { keysRef.current.boost = false; keysRef.current.boostUsed = false; }} className="w-16 h-16 rounded-full bg-cyan-500/20 active:bg-cyan-500/40 text-cyan-300 text-xs select-none">BOOST</button>
            <button onTouchStart={() => keysRef.current.right = true} onTouchEnd={() => keysRef.current.right = false} className="w-16 h-16 rounded-full bg-white/10 active:bg-white/25 text-white text-xl select-none">→</button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'levelComplete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-green-900 to-teal-950 flex items-center justify-center">
        <div className="max-w-md w-full text-center p-6">
          {gameMode === 'career' && currentCareerLevel ? (
            <>
              <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {currentCareerLevel.number}</p>
              <h2 className="text-3xl font-extralight text-white mb-1">{currentCareerLevel.name}</h2>
              <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>

              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3].map(s => (
                  <span key={s} className={`text-5xl ${s <= starsEarned ? 'text-yellow-400' : 'text-white/10'}`}>★</span>
                ))}
              </div>

              <div className="text-center mb-6 space-y-2">
                <p className="text-white/40 text-xs">TIME</p>
                <p className="text-white text-2xl font-light">{finalTime.toFixed(1)}s</p>
                {starsEarned === 3 && (
                  <p className="text-yellow-400 text-sm font-medium">PERFECT RUN!</p>
                )}
                {starsEarned === 2 && (
                  <p className="text-emerald-400 text-sm">Great time!</p>
                )}
                {speedBonus > 0 && (
                  <p className="text-emerald-400 text-sm">+{speedBonus.toLocaleString()} TIME BONUS</p>
                )}
              </div>

              <p className="text-white/40 text-xs mb-1">TOTAL SCORE</p>
              <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>

              <div className="flex flex-col gap-3 justify-center">
                {currentCareerLevel.number < careerLevels.length && (
                  <button onClick={nextLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
                    NEXT LEVEL
                  </button>
                )}
                <button onClick={() => startCareerLevel(currentCareerLevel)} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RETRY</button>
                <button onClick={() => setGameState('careerLevelSelect')} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">LEVEL SELECT</button>
                <button onClick={() => {
                  const companionId = searchParams.get('companion');
                  navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
                }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
                  EXIT GAME
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {level}</p>
              <h2 className="text-3xl font-extralight text-white mb-1">{levelData?.levelName}</h2>
              <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>

              <div className="text-center mb-8 space-y-2">
                <p className="text-white/40 text-xs">TIME</p>
                <p className="text-white text-2xl font-light">{finalTime.toFixed(1)}s</p>
                {speedBonus > 0 && (
                  <p className="text-emerald-400 text-sm">+{speedBonus.toLocaleString()} SPEED BONUS</p>
                )}
              </div>

              <p className="text-white/40 text-xs mb-1">TOTAL SCORE</p>
              <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>

              <div className="flex gap-4 justify-center">
                <button onClick={nextLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
                  NEXT LEVEL
                </button>
                <button onClick={() => {
                  const companionId = searchParams.get('companion');
                  navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
                }} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
                  EXIT GAME
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'careerFailed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-950 via-rose-900 to-orange-950 flex items-center justify-center">
        <div className="max-w-md w-full text-center p-6">
          <div className="text-6xl mb-4">⏱️</div>
          <h2 className="text-3xl font-extralight text-white mb-1">TIME'S UP</h2>
          <p className="text-white/30 text-xs tracking-wider mb-8">
            {currentCareerLevel ? `${currentCareerLevel.name} • ${currentCareerLevel.timeLimit}s limit` : ''}
          </p>

          <p className="text-white/60 text-sm mb-10">You need to complete the level faster. Use boost strategically and take the shortest path!</p>

          <div className="flex flex-col gap-3 justify-center">
            {currentCareerLevel && (
              <button onClick={() => startCareerLevel(currentCareerLevel)} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
                TRY AGAIN
              </button>
            )}
            <button onClick={() => setGameState('careerLevelSelect')} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">LEVEL SELECT</button>
            <button onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
              EXIT GAME
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-950 via-rose-900 to-pink-950 flex items-center justify-center">
        <div className="max-w-md w-full text-center p-6">
          <h2 className="text-3xl font-extralight text-white mb-1">MOMENTUM LOST</h2>
          <p className="text-white/30 text-xs tracking-wider mb-8">Level {level} · {levelData?.levelName}</p>

          <p className="text-white/40 text-xs mb-1">FINAL SCORE</p>
          <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>

          <div className="flex gap-4 justify-center">
            <button onClick={retryLevel} className="px-10 py-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all text-sm border border-white/10">RETRY</button>
            <button onClick={restart} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RESTART</button>
            <button onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
              EXIT GAME
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
