import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import {
  STEP_MS,
  MAX_FRAME_MS,
  MAX_BOOST_CHARGES,
  BOOST_BUFFER_FRAMES,
  BOOST_COOLDOWN_FRAMES,
  PERFECT_WINDOW_FRAMES,
  BOOST_HORIZONTAL,
  bounceVelocity,
  boostVelocity,
  perfectBounceVelocity,
  nextChain,
} from '../game/momentum/physics';
import {
  type TouchSettings,
  type SteerSensitivity,
  isTap,
  steerTarget,
  steerVelocity,
  haptic,
  isCoarsePointer,
  loadTouchSettings,
  saveTouchSettings,
  hasSeenTutorial,
  markTutorialSeen,
} from '../game/momentum/touchControls';
import { momentumSfx } from '../game/momentum/sfx';
import { loadTheme } from '../game/momentum/themes';
import {
  type Platform,
  type Orb,
  type Rng,
  generateLevel,
  generateChunk,
  createRng,
  seedFromString,
  isPhaseSolid,
  createEndlessState,
  endlessDifficulty,
  lavaSpeed,
  PHASE_CYCLE_FRAMES,
  PHASE_SOLID_FRAMES,
} from '../game/momentum/levelGen';
import { type GhostRun, GHOST_SAMPLE_STEPS, ghostPositionAt, loadLocalGhost, saveLocalGhostIfBest } from '../game/momentum/ghost';
import { SKINS, loadStats, updateStats, loadSkinId, saveSkinId, skinById } from '../game/momentum/skins';
import { todayKey, submitRun, fetchLeaderboard } from '../game/momentum/leaderboard';
import { LeaderboardPanel } from '../components/games/momentum/LeaderboardPanel';
import { analyticsService } from '../services/analyticsService';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 22;
const PLAYER_HEIGHT = 22;
const GRAVITY = 0.55;
const HORIZONTAL_SPEED = 4.5;
const PLATFORM_HEIGHT = 14;

const themePresets = [
  { name: 'Neon Cityscape', icon: '🌃', hint: 'Cyberpunk rooftops' },
  { name: 'Ancient Ruins', icon: '🏛️', hint: 'Crumbling temples' },
  { name: 'Candy Kingdom', icon: '🍭', hint: 'Sweet dreamland' },
  { name: 'Deep Ocean', icon: '🌊', hint: 'Bioluminescent depths' },
  { name: 'Volcanic Forge', icon: '🌋', hint: 'Molten fire' },
  { name: 'Crystal Caves', icon: '💎', hint: 'Shimmering underground' },
];

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
  boostCharges: number;
  isBoosting: boolean;
  boostTimer: number;
}

type GameMode = 'freeplay' | 'career' | 'daily' | 'endless';

const DAILY_DIFFICULTY = 5;
const ENDLESS_CHUNK = 30;

const trackMomentum = (action: string, metadata: Record<string, unknown>) => {
  void analyticsService.trackEvent({
    action_type: 'feature_used',
    action_target: `momentum_${action}`,
    page_path: '/momentum',
    metadata,
  });
};

const dailyThemeName = (day: string) => themePresets[seedFromString(day) % themePresets.length].name;

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
  const [gameMode, setGameMode] = useState<GameMode>('freeplay');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [level, setLevel] = useState(1);
  const [careerProgress, setCareerProgress] = useState<any[]>([]);
  const [currentCareerLevel, setCurrentCareerLevel] = useState<CareerLevel | null>(null);
  const [levelData, setLevelData] = useState<ThemeColors | null>(null);
  const [score, setScore] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [finalTime, setFinalTime] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const playerRef = useRef<PlayerState>({ x: 100, y: 300, prevY: 300, vx: 0, vy: 0, boostCharges: MAX_BOOST_CHARGES, isBoosting: false, boostTimer: 0 });
  const trailRef = useRef<TrailPoint[]>([]);
  const platformsRef = useRef<Platform[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef({ left: false, right: false });
  // Boost / momentum state (frame counts are fixed 60Hz steps)
  const boostBufferRef = useRef(0);
  const boostCooldownRef = useRef(0);
  const framesSinceLandingRef = useRef(9999);
  const chainRef = useRef(0);
  const prevLandingYRef = useRef<number | null>(null);
  const lastLandingSpringRef = useRef(false);
  // Fixed timestep + game feel
  const accumulatorRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);
  const hitStopRef = useRef(0);
  const shakeRef = useRef(0);
  const flashRef = useRef(0);
  const popupRef = useRef<{ text: string; life: number; color: string } | null>(null);
  const pauseStartRef = useRef(0);
  // Latest render values for the rAF loop, which is not recreated on every state change
  const liveRef = useRef({ isPaused, gameMode, currentCareerLevel, level });
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
  const touchTargetXRef = useRef<number | null>(null);
  // Steering finger (one at a time); boost taps are handled independently so both thumbs work together
  const steerPointerRef = useRef<{ id: number; startClientX: number; startClientY: number; startTime: number; startBallCenter: number; maxMove: number } | null>(null);
  const tapFxRef = useRef<Array<{ x: number; y: number; life: number }>>([]);
  const simFrameRef = useRef(0);
  const landingFrameRef = useRef(-9999);
  const boostPressFrameRef = useRef(0);
  const [touchSettings, setTouchSettings] = useState<TouchSettings>(loadTouchSettings);
  const touchSettingsRef = useRef(touchSettings);
  touchSettingsRef.current = touchSettings;
  const [isTouchDevice] = useState(isCoarsePointer);
  const [showTutorial, setShowTutorial] = useState(false);
  const [muted, setMuted] = useState(momentumSfx.muted);
  const [skinId, setSkinId] = useState(loadSkinId);
  const [lifetimeStats, setLifetimeStats] = useState(loadStats);
  const [runResult, setRunResult] = useState<{ newBest: boolean; height: number; bestHeight: number; leaderboardKey: number }>({ newBest: false, height: 0, bestHeight: 0, leaderboardKey: 0 });
  const orbsRef = useRef<Orb[]>([]);
  const endlessRef = useRef<{ state: ReturnType<typeof createEndlessState>; rng: Rng; topY: number } | null>(null);
  const lavaYRef = useRef(Infinity);
  const carryVxRef = useRef(0);
  const ghostRecRef = useRef<number[]>([]);
  const ghostRef = useRef<GhostRun | null>(null);
  const runModeRef = useRef<GameMode>('freeplay');
  const skinRef = useRef(skinById(skinId));
  skinRef.current = skinById(skinId);
  liveRef.current = { isPaused: isPaused || showTutorial, gameMode, currentCareerLevel, level };

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

  const generateThemeWithAI = async (selectedTheme: string, currentLevel: number, careerLevel?: CareerLevel, mode: GameMode = careerLevel ? 'career' : 'freeplay') => {
    setLoadingText('Painting your world...');

    try {
      const themeConfig: ThemeColors = await loadTheme(selectedTheme, async () => {
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
        if (!response.ok) throw new Error('Failed to generate theme');
        return response.json();
      });

      startRun(themeConfig, careerLevel?.difficulty || currentLevel, mode, careerLevel);
    } catch (error) {
      console.error('Failed to start level:', error);
      setGameState('menu');
    }
  };

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const resetMomentum = () => {
    boostBufferRef.current = 0;
    boostCooldownRef.current = 0;
    framesSinceLandingRef.current = 9999;
    chainRef.current = 0;
    prevLandingYRef.current = null;
    lastLandingSpringRef.current = false;
    hitStopRef.current = 0;
    simFrameRef.current = 0;
    landingFrameRef.current = -9999;
    carryVxRef.current = 0;
    ghostRecRef.current = [];
    shakeRef.current = 0;
    flashRef.current = 0;
    popupRef.current = null;
  };

  const pauseGame = () => {
    if (liveRef.current.isPaused) return;
    pauseStartRef.current = Date.now();
    setIsPaused(true);
  };

  const resumeGame = () => {
    if (!liveRef.current.isPaused) return;
    pauseTimeRef.current += Date.now() - pauseStartRef.current;
    lastFrameTimeRef.current = null;
    setIsPaused(false);
  };

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
    // Forgiving edges: count a landing if most of the ball is still over the platform
    const platformLeft = platform.x - PLAYER_WIDTH * 0.5 - 6;
    const platformRight = platform.x + platform.width + PLAYER_WIDTH * 0.5 + 6;
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
    player.boostCharges = MAX_BOOST_CHARGES;
    resetMomentum();
    cameraYRef.current = Math.max(0, GAME_HEIGHT / 2.5 - player.y);
    comboRef.current = 0;
    lastPlatformYRef.current = player.y; // Reset last platform Y on respawn
    touchTargetXRef.current = null;
    steerPointerRef.current = null;
  };

  const saveGameStats = async (completed: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('momentum_game_stats').insert({
        user_id: user.id,
        level,
        theme_name: levelData?.levelName || theme,
        score: scoreRef.current,
        completion_time: elapsedTimeRef.current,
        completed
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

  // Presses are buffered for a few frames so an early or mistimed press is never lost
  // framesAgo lets a tap that is recognised on release count from when the finger went down
  const triggerBoost = (framesAgo = 0) => {
    momentumSfx.unlock();
    if (playerRef.current.boostCharges === 0) momentumSfx.empty();
    boostBufferRef.current = BOOST_BUFFER_FRAMES;
    boostPressFrameRef.current = simFrameRef.current - framesAgo;
  };

  const updateTouchSettings = (patch: Partial<TouchSettings>) => {
    const next = { ...touchSettingsRef.current, ...patch };
    setTouchSettings(next);
    saveTouchSettings(next);
  };

  const dismissTutorial = () => {
    markTutorialSeen();
    pauseTimeRef.current += Date.now() - pauseStartRef.current;
    lastFrameTimeRef.current = null;
    setShowTutorial(false);
  };

  const pointerToCanvasX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return clientX * (GAME_WIDTH / rect.width);
  };

  const spawnTapFx = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = GAME_WIDTH / rect.width;
    tapFxRef.current.push({ x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale, life: 1 });
  };

  const boostFromTouch = (clientX: number, clientY: number, framesAgo = 0) => {
    triggerBoost(framesAgo);
    haptic(8);
    spawnTapFx(clientX, clientY);
  };

  // One-thumb controls, anywhere on screen: drag to steer, tap to boost.
  // A second finger landing while one is steering boosts immediately.
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') return;
    momentumSfx.unlock();
    if (gameState !== 'playing' || liveRef.current.isPaused) return;
    if ((e.target as HTMLElement).closest('button')) return;
    if (steerPointerRef.current) {
      boostFromTouch(e.clientX, e.clientY);
      return;
    }
    steerPointerRef.current = {
      id: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTime: performance.now(),
      startBallCenter: playerRef.current.x + PLAYER_WIDTH / 2,
      maxMove: 0,
    };
    touchTargetXRef.current = steerPointerRef.current.startBallCenter;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const steer = steerPointerRef.current;
    if (!steer || steer.id !== e.pointerId) return;
    steer.maxMove = Math.max(steer.maxMove, Math.hypot(e.clientX - steer.startClientX, e.clientY - steer.startClientY));
    const drag = pointerToCanvasX(e.clientX) - pointerToCanvasX(steer.startClientX);
    touchTargetXRef.current = steerTarget(steer.startBallCenter, drag, touchSettingsRef.current.sensitivity);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const steer = steerPointerRef.current;
    if (!steer || steer.id !== e.pointerId) return;
    steerPointerRef.current = null;
    touchTargetXRef.current = null;
    const heldMs = performance.now() - steer.startTime;
    if (e.type === 'pointerup' && isTap(heldMs, steer.maxMove) && !liveRef.current.isPaused) {
      boostFromTouch(steer.startClientX, steer.startClientY, Math.round(heldMs / STEP_MS));
    }
  };

  const gameLoop = useCallback((now: number) => {
    if (gameState !== 'playing' || !levelData) return;
    const { isPaused, gameMode, currentCareerLevel, level } = liveRef.current;
    if (isPaused) {
      lastFrameTimeRef.current = null;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    const platforms = platformsRef.current;
    const keys = keysRef.current;

    elapsedTimeRef.current = (Date.now() - startTimeRef.current - pauseTimeRef.current) / 1000;

    // Career timer is derived from the game clock so it pauses with the game
    let timeRemaining = 0;
    if (gameMode === 'career' && currentCareerLevel) {
      timeRemaining = Math.max(0, currentCareerLevel.timeLimit - elapsedTimeRef.current);
    }

    const frameMs = lastFrameTimeRef.current === null ? STEP_MS : Math.min(MAX_FRAME_MS, now - lastFrameTimeRef.current);
    lastFrameTimeRef.current = now;
    accumulatorRef.current += frameMs;

    const getMotion = () => {
    const fallenDistance = player.y - lastPlatformYRef.current;
    const isTrueFalling = player.vy > 0 && fallenDistance > 150; // ~2 platform gaps (true free fall)

    // Rising lines must wait until ball has actually traveled 80px UP from the bounce point
    // This prevents lines firing at the moment of contact when vy goes negative
    const risenFromBounce = bounceYRef.current !== null ? (bounceYRef.current - player.y) : 9999;
    if (risenFromBounce > 250) bounceYRef.current = null; // Clear once well past bounce
    const isRisingFast = player.vy < -8 && (bounceYRef.current === null || risenFromBounce >= 80);
    const speedIntensity = isTrueFalling ? Math.abs(player.vy) / 15 : isRisingFast ? Math.abs(player.vy) / 20 : 0;
    return { isTrueFalling, isRisingFast, speedIntensity };
    };

    // One fixed 60Hz physics step. Returns true when the run has ended.
    const simulate = (): boolean => {
    const { isTrueFalling, isRisingFast, speedIntensity } = getMotion();

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

    // Horizontal intent: touch takes priority over keyboard
    const touchX = touchTargetXRef.current;
    if (touchX !== null) {
      const ballCenter = player.x + PLAYER_WIDTH / 2;
      player.vx = steerVelocity(player.vx, touchX, ballCenter, HORIZONTAL_SPEED);
    } else if (keys.left) {
      player.vx = -HORIZONTAL_SPEED;
    } else if (keys.right) {
      player.vx = HORIZONTAL_SPEED;
    } else {
      player.vx *= 0.82;
    }

    if (boostCooldownRef.current > 0) boostCooldownRef.current--;
    framesSinceLandingRef.current++;
    simFrameRef.current++;
    if (shakeRef.current > 0) shakeRef.current *= 0.85;
    if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.06);
    if (popupRef.current) {
      popupRef.current.life -= 0.02;
      if (popupRef.current.life <= 0) popupRef.current = null;
    }

    if (boostBufferRef.current > 0) {
      const boostColor = levelData.boostTrailColor || '#00ffff';
      const pressAfterLanding = boostPressFrameRef.current - landingFrameRef.current;
      const isPerfect = pressAfterLanding >= -3 && pressAfterLanding <= PERFECT_WINDOW_FRAMES
        && framesSinceLandingRef.current <= PERFECT_WINDOW_FRAMES + BOOST_BUFFER_FRAMES && player.vy < 0;
      if (isPerfect) {
        // Perfect bounce: pressing right after landing is free and launches much higher
        player.vy = Math.min(player.vy, perfectBounceVelocity(level, chainRef.current, lastLandingSpringRef.current));
        boostBufferRef.current = 0;
        framesSinceLandingRef.current = 9999;
        landingFrameRef.current = -9999;
        player.boostTimer = 30;
        player.isBoosting = true;
        hitStopRef.current = 3;
        shakeRef.current = 7;
        flashRef.current = 0.35;
        popupRef.current = { text: 'PERFECT!', life: 1, color: '#ffe066' };
        haptic(25);
        momentumSfx.perfect();
        updateStats(st => ({ perfects: st.perfects + 1 }));
        scoreRef.current += 100 * (1 + chainRef.current);
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#ffe066', 18, 14);
      } else if (player.boostCharges > 0 && boostCooldownRef.current === 0) {
        player.vy = boostVelocity(player.vy);
        // Apply horizontal kick based on current intent (touch or keyboard)
        if (touchX !== null) {
          const ballCenter = player.x + PLAYER_WIDTH / 2;
          const delta = touchX - ballCenter;
          if (Math.abs(delta) > 4) {
            player.vx += Math.sign(delta) * BOOST_HORIZONTAL;
          }
        } else {
          if (keys.left) player.vx -= BOOST_HORIZONTAL;
          if (keys.right) player.vx += BOOST_HORIZONTAL;
        }
        player.boostCharges--;
        haptic(12);
        momentumSfx.boost();
        player.isBoosting = true;
        player.boostTimer = 25;
        boostBufferRef.current = 0;
        boostCooldownRef.current = BOOST_COOLDOWN_FRAMES;
        hitStopRef.current = 2;
        shakeRef.current = 4;
        flashRef.current = 0.18;
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, boostColor, 14, 12);
      } else {
        boostBufferRef.current--;
      }
    }

    if (player.boostTimer > 0) {
      player.boostTimer--;
      spawnBoostParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.boostTrailColor || '#00ffff');
    } else {
      player.isBoosting = false;
    }

    if (player.isBoosting || player.boostTimer > 0 || (chainRef.current >= 3 && player.vy < -6)) {
      trailRef.current.push({ x: player.x + PLAYER_WIDTH/2, y: player.y + PLAYER_HEIGHT/2, life: 1 });
      if (trailRef.current.length > 20) trailRef.current.shift();
    }
    trailRef.current = trailRef.current.filter(t => { t.life -= 0.08; return t.life > 0; });

    player.vy += GRAVITY;
    if (player.vy > 18) player.vy = 18;
    player.x += player.vx + carryVxRef.current;
    player.y += player.vy;
    carryVxRef.current *= 0.97;

    if (simFrameRef.current % GHOST_SAMPLE_STEPS === 0 && ghostRecRef.current.length < 20000) {
      ghostRecRef.current.push(Math.round(player.x), Math.round(player.y));
    }

    for (const orb of orbsRef.current) {
      if (orb.collected) continue;
      const dx = player.x + PLAYER_WIDTH / 2 - orb.x;
      const dy = player.y + PLAYER_HEIGHT / 2 - orb.y;
      if (dx * dx + dy * dy < 24 * 24) {
        orb.collected = true;
        player.boostCharges = Math.min(MAX_BOOST_CHARGES, player.boostCharges + 1);
        scoreRef.current += 250;
        momentumSfx.orb();
        haptic(10);
        popupRef.current = { text: '+1 BOOST', life: 0.7, color: levelData.boostTrailColor || '#00ffff' };
        spawnParticles(orb.x, orb.y, levelData.boostTrailColor || '#00ffff', 14, 10);
      }
    }

    // Endless: keep building upward, drop what's far below, and raise the lava
    const endless = endlessRef.current;
    if (endless) {
      if (endless.topY > player.y - 1400) {
        const { platforms: more, orbs: moreOrbs } = generateChunk(
          endless.state, ENDLESS_CHUNK, endlessDifficulty(520 - player.y), levelData, endless.rng, Number.MAX_SAFE_INTEGER,
        );
        endless.topY = endless.state.y;
        platformsRef.current = [...platformsRef.current.filter(pl => pl.y < lavaYRef.current + 200), ...more].sort((a, b) => b.y - a.y);
        orbsRef.current = [...orbsRef.current.filter(o => !o.collected && o.y < lavaYRef.current), ...moreOrbs];
      }
      // Lava never trails too far behind, so the pressure stays on
      lavaYRef.current = Math.min(lavaYRef.current - lavaSpeed(elapsedTimeRef.current), player.y + 700);
      if (player.y + PLAYER_HEIGHT > lavaYRef.current) {
        endRunInLava();
        return true;
      }
    }

    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x > GAME_WIDTH - PLAYER_WIDTH) { player.x = GAME_WIDTH - PLAYER_WIDTH; player.vx = 0; }

    if (player.y < highestYRef.current) {
      const heightGained = highestYRef.current - player.y;
      scoreRef.current += Math.floor(heightGained * (1 + comboRef.current * 0.1));
      highestYRef.current = player.y;
    }

    const currentPlatforms = platformsRef.current;
    for (let i = 0; i < currentPlatforms.length; i++) {
      const platform = currentPlatforms[i];
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

      if (isPhaseSolid(platform, simFrameRef.current) && checkCollision(player, platform)) {
        player.y = platform.y - PLAYER_HEIGHT;

        const isSpring = platform.type === 'spring';
        const prevChain = chainRef.current;
        chainRef.current = nextChain(prevChain, player.y, prevLandingYRef.current, framesSinceLandingRef.current);
        prevLandingYRef.current = player.y;
        framesSinceLandingRef.current = 0;
        landingFrameRef.current = simFrameRef.current;
        lastLandingSpringRef.current = isSpring;
        player.vy = bounceVelocity(level, chainRef.current, isSpring);
        if (isSpring) momentumSfx.spring();
        else momentumSfx.bounce(chainRef.current);

        carryVxRef.current = platform.type === 'conveyor' ? platform.param * 3.2 : 0;
        if (isSpring) {
          platform.springBounce = 1;
          shakeRef.current = Math.max(shakeRef.current, 5);
          spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#00ff88', 15, 12);
        }
        if (chainRef.current > prevChain && chainRef.current >= 2) {
          popupRef.current = {
            text: chainRef.current >= 6 ? 'MAX MOMENTUM!' : `MOMENTUM x${chainRef.current}`,
            life: 0.8,
            color: levelData.boostTrailColor || '#00ffff',
          };
        }

        if (platform.type === 'crumbling' && platform.crumbleTimer <= 0) {
          platform.crumbleTimer = 0.5;
        }

        lastPlatformYRef.current = player.y;
        bounceYRef.current = player.y; // Record exact Y at bounce for rising lines delay

        if (lastPlatformRef.current !== platform.id) {
          if (!platform.touched) {
            platform.touched = true;
            player.boostCharges = Math.min(MAX_BOOST_CHARGES, player.boostCharges + 1);
            const pointMultiplier = platform.type === 'spring' ? 2 : 1;
            scoreRef.current += 50 * (1 + comboRef.current) * pointMultiplier;

            if (platform.isCheckpoint) {
              player.boostCharges = MAX_BOOST_CHARGES;
              haptic(30);
              momentumSfx.checkpoint();
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
      setScore(scoreRef.current);
      saveGameStats(false);
      return true;
    }

    if (player.y < levelData.goalY!) {
      const time = elapsedTimeRef.current;
      finishRun(time);

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
        saveGameStats(true);
      } else {
        const targetTime = 45 + level * 5;
        const bonus = Math.max(0, Math.floor((targetTime - time) * 100));
        setFinalTime(time);
        setSpeedBonus(bonus);
        scoreRef.current += bonus;
        setScore(scoreRef.current);
        setGameState('levelComplete');
        saveGameStats(true);
      }
      return true;
    }

    if (player.y - camY > GAME_HEIGHT + 80) {
      if (checkpointYRef.current < 500) {
        momentumSfx.fall();
        trackMomentum('respawn', { mode: runModeRef.current, level, checkpoint_y: Math.round(checkpointYRef.current) });
        respawnAtCheckpoint();
        comboRef.current = 0;
      } else {
        if (endlessRef.current) {
          endRunInLava();
          return true;
        }
        momentumSfx.fall();
        trackMomentum('death', {
          mode: runModeRef.current,
          level,
          progress: Number(Math.min(1, (520 - highestYRef.current) / (520 - goalYRef.current)).toFixed(2)),
          time: Number(elapsedTimeRef.current.toFixed(1)),
        });
        setGameState('gameOver');
        setScore(scoreRef.current);
        saveGameStats(false);
        return true;
      }
    }

    return false;
    };

    while (accumulatorRef.current >= STEP_MS) {
      accumulatorRef.current -= STEP_MS;
      if (hitStopRef.current > 0) {
        hitStopRef.current--;
        continue;
      }
      if (simulate()) return;
    }

    const { isTrueFalling, isRisingFast } = getMotion();
    const camY = cameraYRef.current;

    ctx.save();
    if (shakeRef.current > 0.3) {
      ctx.translate((Math.random() - 0.5) * shakeRef.current, (Math.random() - 0.5) * shakeRef.current);
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

    const isEndless = endlessRef.current !== null;
    const progress = isEndless ? 0 : Math.max(0, Math.min(1, (startYRef.current - player.y) / (startYRef.current - goalYRef.current)));
    const barHeight = GAME_HEIGHT - 140;
    const barX = GAME_WIDTH - 20;
    if (!isEndless) {
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
    }

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

      if (platform.type === 'phase') {
        const t = (simFrameRef.current + platform.param) % PHASE_CYCLE_FRAMES;
        if (t >= PHASE_SOLID_FRAMES) alpha *= 0.12;
        else if (t > PHASE_SOLID_FRAMES - 40) alpha *= 0.4 + 0.6 * (Math.floor(t / 5) % 2);
      }

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

      if (platform.type === 'conveyor') {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2;
        const offset = ((simFrameRef.current * 0.8 * platform.param) % 14 + 14) % 14;
        for (let cx = platform.x + offset; cx < platform.x + platform.width - 6; cx += 14) {
          const dir = platform.param;
          ctx.beginPath();
          ctx.moveTo(cx - 3 * dir, screenY + 3);
          ctx.lineTo(cx + 2 * dir, screenY + PLATFORM_HEIGHT / 2);
          ctx.lineTo(cx - 3 * dir, screenY + PLATFORM_HEIGHT - 3);
          ctx.stroke();
        }
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
        ctx.strokeStyle = skinRef.current.rainbow ? `hsl(${(i * 18 + simFrameRef.current * 3) % 360}, 90%, 65%)` : (skinRef.current.trail || levelData.boostTrailColor || '#00ffff');
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

    // Landing guide: mark where the ball will touch down on the next platform below
    if (player.vy > -3) {
      const ballCenterX = player.x + PLAYER_WIDTH / 2;
      const ballBottom = player.y + PLAYER_HEIGHT;
      let target: Platform | null = null;
      for (const pl of platforms) {
        if (pl.crumbled || pl.y < ballBottom - 2) continue;
        if (ballCenterX < pl.x - PLAYER_WIDTH * 0.5 - 6 || ballCenterX > pl.x + pl.width + PLAYER_WIDTH * 0.5 + 6) continue;
        if (!target || pl.y < target.y) target = pl;
      }
      if (target) {
        const dist = target.y - ballBottom;
        const alpha = Math.max(0.15, 0.6 - dist / 600);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.ellipse(Math.min(Math.max(ballCenterX, target.x), target.x + target.width), target.y + camY - 1, PLAYER_WIDTH * 0.6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const boostTint = levelData.boostTrailColor || '#00ffff';
    orbsRef.current.forEach(orb => {
      if (orb.collected) return;
      const sy = orb.y + camY;
      if (sy < -20 || sy > GAME_HEIGHT + 20) return;
      const pulse = 1 + Math.sin(simFrameRef.current * 0.12) * 0.15;
      ctx.shadowColor = boostTint;
      ctx.shadowBlur = 20;
      ctx.fillStyle = boostTint;
      ctx.beginPath();
      ctx.arc(orb.x, sy, 8 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(orb.x, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const ghost = ghostRef.current;
    const ghostPos = ghost ? ghostPositionAt(ghost, simFrameRef.current) : null;
    if (ghost && ghostPos) {
      const gy = ghostPos.y + camY;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ghostPos.x + PLAYER_WIDTH / 2, gy + PLAYER_HEIGHT / 2, PLAYER_WIDTH / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(ghost.name ? ghost.name : 'BEST', ghostPos.x + PLAYER_WIDTH / 2, gy - 6);
      ctx.globalAlpha = 1;
    }

    if (Number.isFinite(lavaYRef.current)) {
      const lavaTop = lavaYRef.current + camY;
      if (lavaTop < GAME_HEIGHT) {
        const lava = ctx.createLinearGradient(0, lavaTop, 0, GAME_HEIGHT);
        lava.addColorStop(0, 'rgba(255,90,0,0.95)');
        lava.addColorStop(1, 'rgba(140,0,0,0.95)');
        ctx.fillStyle = lava;
        ctx.beginPath();
        ctx.moveTo(0, GAME_HEIGHT);
        for (let x = 0; x <= GAME_WIDTH; x += 20) {
          ctx.lineTo(x, lavaTop + Math.sin(x * 0.03 + simFrameRef.current * 0.08) * 6);
        }
        ctx.lineTo(GAME_WIDTH, GAME_HEIGHT);
        ctx.closePath();
        ctx.shadowColor = '#ff5a00';
        ctx.shadowBlur = 30;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

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

    const skin = skinRef.current;
    const skinFill = skin.rainbow ? `hsl(${(simFrameRef.current * 3) % 360}, 90%, 65%)` : skin.fill;
    ctx.fillStyle = player.isBoosting ? (skin.trail || levelData.boostTrailColor || '#00ffff') : (skinFill || levelData.playerColor || '#ffffff');
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_WIDTH/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Soft dark halo keeps HUD text readable on light themes
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(isEndless ? `ENDLESS · ${Math.max(0, Math.round(520 - highestYRef.current)).toLocaleString()}m` : runModeRef.current === 'daily' ? `DAILY CLIMB · ${todayKey()}` : `LEVEL ${level}`, 16, 24);
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
    ctx.fillText('SCORE', GAME_WIDTH - 40, 66);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '20px system-ui';
    ctx.fillText(scoreRef.current.toLocaleString(), GAME_WIDTH - 40, 88);

    if (comboRef.current > 1) {
      ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(`${comboRef.current}x COMBO`, GAME_WIDTH - 40, 106);
      ctx.globalAlpha = 1;
    }

    const boostColor = levelData.boostTrailColor || '#00ffff';
    for (let i = 0; i < MAX_BOOST_CHARGES; i++) {
      const filled = i < player.boostCharges;
      ctx.fillStyle = filled ? boostColor : 'rgba(255,255,255,0.12)';
      ctx.shadowColor = boostColor;
      ctx.shadowBlur = filled ? 10 : 0;
      ctx.beginPath();
      ctx.arc(24 + i * 22, GAME_HEIGHT - 24, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(isTouchDevice ? 'BOOST' : 'BOOST [SPACE]', 16, GAME_HEIGHT - 40);

    if (chainRef.current > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText('MOMENTUM', 100, GAME_HEIGHT - 40);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i < chainRef.current ? boostColor : 'rgba(255,255,255,0.1)';
        ctx.fillRect(100 + i * 12, GAME_HEIGHT - 30, 9, 10);
      }
    }

    const popup = popupRef.current;
    if (popup) {
      ctx.globalAlpha = Math.min(1, popup.life * 1.5);
      ctx.fillStyle = popup.color;
      ctx.font = 'bold 22px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(popup.text, player.x + PLAYER_WIDTH / 2, player.y + camY - 24 - (1 - popup.life) * 30);
      ctx.globalAlpha = 1;
    }

    tapFxRef.current = tapFxRef.current.filter(t => {
      t.life -= 0.06;
      if (t.life <= 0) return false;
      ctx.strokeStyle = boostColor;
      ctx.globalAlpha = t.life * 0.6;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 12 + (1 - t.life) * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return true;
    });

    ctx.restore();

    if (flashRef.current > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashRef.current})`;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, levelData, isTouchDevice]);

  useEffect(() => {
    if (gameState === 'playing' && isTouchDevice && !hasSeenTutorial()) {
      pauseStartRef.current = Date.now();
      setShowTutorial(true);
    }
    if (gameState !== 'playing') {
      steerPointerRef.current = null;
      touchTargetXRef.current = null;
    }
  }, [gameState, isTouchDevice]);

  useEffect(() => {
    if (gameState === 'playing') {
      lastFrameTimeRef.current = null;
      accumulatorRef.current = 0;
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      momentumSfx.unlock();
      if ((gameState === 'gameOver' || gameState === 'careerFailed') && (e.key === 'r' || e.key === 'R' || e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        retryLevel();
        return;
      }
      if (gameState === 'playing') {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (isPaused) resumeGame();
          else pauseGame();
          return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = true;
        if (e.key === ' ') { e.preventDefault(); if (!e.repeat) triggerBoost(); }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
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
    generateThemeWithAI(t, gameMode === 'endless' ? 1 : level, undefined, gameMode);
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

  const ghostKeyFor = (mode: GameMode, careerLevel?: CareerLevel | null) =>
    mode === 'career' && careerLevel ? `career-${careerLevel.number}` : mode === 'daily' ? `daily-${todayKey()}` : null;

  // Builds a fresh run. Career and daily levels are seeded so they are identical every attempt.
  const startRun = (theme: ThemeColors, difficulty: number, mode: GameMode, careerLevel?: CareerLevel | null) => {
    runModeRef.current = mode;
    const seed = mode === 'career' && careerLevel
      ? seedFromString(`career-${careerLevel.number}`)
      : mode === 'daily'
        ? seedFromString(`daily-${todayKey()}`)
        : Math.floor(Math.random() * 2 ** 32);
    const rng = createRng(seed);

    let platforms: Platform[];
    let orbs: Orb[];
    let goalY: number;
    if (mode === 'endless') {
      const state = createEndlessState();
      ({ platforms, orbs } = generateChunk(state, ENDLESS_CHUNK, 1, theme, rng, Number.MAX_SAFE_INTEGER));
      endlessRef.current = { state, rng, topY: state.y };
      goalY = -Infinity;
      lavaYRef.current = 520 + 420;
    } else {
      ({ platforms, orbs, goalY } = generateLevel(difficulty, theme, rng));
      endlessRef.current = null;
      lavaYRef.current = Infinity;
    }
    platforms.sort((a, b) => b.y - a.y);
    platformsRef.current = platforms;
    orbsRef.current = orbs;

    const firstPlatform = platforms[0];
    playerRef.current = {
      x: firstPlatform.startX + firstPlatform.width / 2 - PLAYER_WIDTH / 2,
      y: 520 - PLAYER_HEIGHT - 2,
      prevY: 520 - PLAYER_HEIGHT - 2,
      vx: 0,
      vy: 0,
      boostCharges: MAX_BOOST_CHARGES,
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
    lastPlatformYRef.current = 520;
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
    resetMomentum();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Ghost: your own best, or for the daily climb today's fastest run if it beats yours
    const ghostKey = ghostKeyFor(mode, careerLevel);
    ghostRef.current = ghostKey ? loadLocalGhost(ghostKey) : null;
    if (mode === 'daily') {
      fetchLeaderboard('daily', todayKey(), 1).then(([top]) => {
        if (top?.ghost && runModeRef.current === 'daily' && (!ghostRef.current || Number(top.time) < ghostRef.current.time)) {
          ghostRef.current = { time: Number(top.time), path: top.ghost, name: top.display_name };
        }
      });
    }

    trackMomentum('run_start', { mode, difficulty, career_level: careerLevel?.number ?? null });

    setLevelData({ ...theme, goalY });
    setScore(0);
    setIsPaused(false);
    pauseTimeRef.current = 0;
    initSpeedLines();
    setGameState('playing');
  };

  const retryLevel = () => {
    if (!levelData) return;
    startRun(levelData, level, gameMode, currentCareerLevel);
  };

  const startDaily = () => {
    setGameMode('daily');
    setCurrentCareerLevel(null);
    setLevel(DAILY_DIFFICULTY);
    setGameState('loading');
    generateThemeWithAI(dailyThemeName(todayKey()), DAILY_DIFFICULTY, undefined, 'daily');
  };

  // Bookkeeping shared by every completed run: unlock progress, ghosts, leaderboards, analytics
  const finishRun = (time: number) => {
    const mode = runModeRef.current;
    momentumSfx.win();
    const stats = updateStats(st => ({
      levelsCompleted: st.levelsCompleted + 1,
      dailyCompletions: st.dailyCompletions + (mode === 'daily' ? 1 : 0),
    }));
    setLifetimeStats(stats);
    const ghostKey = ghostKeyFor(mode, liveRef.current.currentCareerLevel);
    const run: GhostRun = { time, path: ghostRecRef.current };
    const newBest = ghostKey ? saveLocalGhostIfBest(ghostKey, run) : false;
    setRunResult(r => ({ ...r, newBest }));
    if (mode === 'daily') {
      submitRun('daily', todayKey(), scoreRef.current, time, run).then(() =>
        setRunResult(r => ({ ...r, leaderboardKey: r.leaderboardKey + 1 })));
    }
    trackMomentum('complete', { mode, level: liveRef.current.level, time: Number(time.toFixed(2)), score: scoreRef.current });
  };

  const endRunInLava = () => {
    momentumSfx.fall();
    const height = Math.max(0, Math.round(520 - highestYRef.current));
    const previousBest = loadStats().bestEndlessHeight;
    const stats = updateStats(st => ({ bestEndlessHeight: Math.max(st.bestEndlessHeight, height) }));
    setLifetimeStats(stats);
    setRunResult(r => ({ ...r, newBest: height > previousBest, height, bestHeight: stats.bestEndlessHeight }));
    submitRun('endless', todayKey(), height, elapsedTimeRef.current, null).then(() =>
      setRunResult(r => ({ ...r, leaderboardKey: r.leaderboardKey + 1 })));
    trackMomentum('death', { mode: 'endless', height, time: Number(elapsedTimeRef.current.toFixed(1)) });
    setScore(scoreRef.current);
    setGameState('gameOver');
    saveGameStats(false);
  };

  const exitRun = () => {
    const player = playerRef.current;
    trackMomentum('quit', {
      mode: runModeRef.current,
      level,
      height: Math.round(520 - player.y),
      time: Number(elapsedTimeRef.current.toFixed(1)),
    });
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setGameState(gameMode === 'career' ? 'careerLevelSelect' : 'menu');
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
              {isTouchDevice ? (
                <p className="text-white/80 text-sm">Drag to steer · Tap to boost</p>
              ) : (
              <div className="flex justify-center gap-3">
                <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">← A</span>
                <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">D →</span>
                <span className="px-4 py-2 bg-cyan-500/20 rounded-lg text-cyan-300 text-xs">SPACE Boost</span>
              </div>
              )}
              <p className="text-gray-600 text-xs">Checkpoints save progress • Speed bonus at finish</p>
            </div>

            <div className="mt-8">
              <p className="text-white/40 text-xs tracking-[0.2em] mb-3">BALL</p>
              <div className="flex flex-wrap justify-center gap-3">
                {SKINS.map(skin => {
                  const unlocked = skin.isUnlocked(lifetimeStats, careerProgress.reduce((sum, p) => sum + (p.stars_earned || 0), 0));
                  const selected = skin.id === skinId;
                  return (
                    <button
                      key={skin.id}
                      disabled={!unlocked}
                      title={unlocked ? skin.name : `Locked: ${skin.requirement}`}
                      onClick={() => { setSkinId(skin.id); saveSkinId(skin.id); }}
                      className={`flex flex-col items-center gap-1 w-16 py-2 rounded-xl border transition-all ${selected ? 'border-white/60 bg-white/10' : 'border-white/10'} ${unlocked ? 'hover:bg-white/10' : 'opacity-40'}`}
                    >
                      <span
                        className="w-7 h-7 rounded-full"
                        style={{
                          background: skin.rainbow
                            ? 'conic-gradient(#ff5f6d, #ffc371, #7dffc4, #4cc9f0, #c77dff, #ff5f6d)'
                            : skin.fill || '#ffffff',
                          boxShadow: `0 0 12px ${skin.trail || 'rgba(255,255,255,0.6)'}`,
                        }}
                      />
                      <span className="text-[10px] text-white/70">{unlocked ? skin.name : '🔒'}</span>
                    </button>
                  );
                })}
              </div>
              {(() => {
                const next = SKINS.find(sk => !sk.isUnlocked(lifetimeStats, careerProgress.reduce((sum, p) => sum + (p.stars_earned || 0), 0)));
                return next ? <p className="text-white/30 text-xs mt-3">Next unlock: {next.name} · {next.requirement}</p> : null;
              })()}
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
                setCurrentCareerLevel(null);
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 -mt-2">
            <button
              onClick={startDaily}
              className="group p-8 bg-gradient-to-br from-pink-500/10 to-amber-500/10 hover:from-pink-500/20 hover:to-amber-500/20 rounded-2xl transition-all duration-300 border border-pink-500/20 hover:border-pink-500/40 text-left"
            >
              <div className="text-4xl mb-3">🌅</div>
              <h3 className="text-2xl font-light text-white mb-2">Daily Climb</h3>
              <p className="text-white/50 text-sm mb-3">Same level for everyone today. Race the leader's ghost.</p>
              <div className="flex items-center gap-2 text-pink-300 text-xs">
                <span>New every day</span>
                <span>•</span>
                <span>Leaderboard</span>
              </div>
            </button>

            <button
              onClick={() => {
                setGameMode('endless');
                setCurrentCareerLevel(null);
                setGameState('themeSelect');
              }}
              className="group p-8 bg-gradient-to-br from-red-500/10 to-orange-500/10 hover:from-red-500/20 hover:to-orange-500/20 rounded-2xl transition-all duration-300 border border-red-500/20 hover:border-red-500/40 text-left"
            >
              <div className="text-4xl mb-3">🌋</div>
              <h3 className="text-2xl font-light text-white mb-2">Endless</h3>
              <p className="text-white/50 text-sm mb-3">Climb forever. The lava keeps rising.</p>
              <div className="flex items-center gap-2 text-orange-300 text-xs">
                <span>Best: {lifetimeStats.bestEndlessHeight.toLocaleString()}m</span>
                <span>•</span>
                <span>Leaderboard</span>
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
      <div
        className="fixed inset-0 bg-black flex items-center justify-center select-none overflow-hidden"
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          padding: 'env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="block rounded-lg shadow-2xl select-none"
            style={{
              width: 'min(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * 4 / 3), 1100px)',
              height: 'auto',
              touchAction: 'none',
            }}
          />

          {isPaused && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center">
              <h2 className="text-4xl font-extralight text-white mb-8 tracking-wider">PAUSED</h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={resumeGame}
                  className="px-12 py-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all text-sm border border-white/20"
                >
                  Resume
                </button>
                <button
                  onClick={exitRun}
                  className="px-12 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm"
                >
                  Exit
                </button>
              </div>
              {isTouchDevice ? (
                <div className="mt-8 flex flex-col items-center gap-3 text-xs text-white/60">
                  <div className="flex items-center gap-2">
                    <span className="w-20 text-right">Steer feel</span>
                    {(['low', 'medium', 'high'] as SteerSensitivity[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateTouchSettings({ sensitivity: s })}
                        className={`px-3 py-2 rounded-full border ${touchSettings.sensitivity === s ? 'bg-white/20 border-white/40 text-white' : 'border-white/10'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-white/30 text-xs mt-8">Press ESC to resume</p>
              )}
            </div>
          )}

          {!isPaused && (
            <div className="fixed z-10 flex gap-1" style={{ top: 'max(8px, env(safe-area-inset-top, 0px))', right: 'max(8px, env(safe-area-inset-right, 0px))' }}>
              <button
                onClick={() => { momentumSfx.setMuted(!muted); setMuted(!muted); }}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className="w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-lg transition-all text-xs backdrop-blur-sm border border-white/10"
              >
                {muted ? '🔇' : '🔊'}
              </button>
              <button
                onClick={pauseGame}
                aria-label="Pause"
                className="w-9 h-9 flex items-center justify-center bg-black/40 hover:bg-black/60 text-white/80 hover:text-white rounded-lg transition-all text-xs backdrop-blur-sm border border-white/10"
              >
                ❚❚
              </button>
              <button
                onClick={exitRun}
                aria-label="Exit"
                className="w-9 h-9 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 rounded-lg transition-all text-xs backdrop-blur-sm border border-red-500/20"
              >
                ✕
              </button>
            </div>
          )}

        </div>

        {showTutorial && (
          <div className="fixed inset-0 z-20 bg-black/85 flex flex-col items-center justify-center px-6 text-center" onPointerDown={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-light text-white mb-6 tracking-wider">How to play</h2>
            <div className="flex w-full max-w-md gap-3 mb-6">
              <div className="flex-1 rounded-2xl border border-white/20 p-4 text-white/80 text-sm">
                <div className="text-3xl mb-2">👈 👉</div>
                Drag anywhere to steer
              </div>
              <div className="flex-1 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 p-4 text-cyan-100 text-sm">
                <div className="text-3xl mb-2">👆</div>
                Tap anywhere to boost
              </div>
            </div>
            <p className="text-white/60 text-sm mb-2">Everything works with one thumb.</p>
            <p className="text-white/60 text-sm mb-2">Climb higher each bounce to build momentum.</p>
            <p className="text-white/60 text-sm mb-8">Boost right as you land for a free PERFECT bounce.</p>
            <button
              onClick={dismissTutorial}
              className="px-12 py-3 bg-white/15 text-white rounded-full text-sm border border-white/30"
            >
              Let's go
            </button>
          </div>
        )}
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
              {runResult.newBest && <p className="text-yellow-300 text-sm -mt-4 mb-4">New best — your ghost will race you next time</p>}

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
                <button onClick={retryLevel} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RETRY</button>
                <button onClick={() => setGameState('careerLevelSelect')} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">LEVEL SELECT</button>
                <button onClick={() => {
                  const companionId = searchParams.get('companion');
                  navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
                }} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">
                  EXIT GAME
                </button>
              </div>
            </>
          ) : gameMode === 'daily' ? (
            <>
              <p className="text-white/30 text-xs tracking-[0.2em] mb-1">DAILY CLIMB · {todayKey()}</p>
              <h2 className="text-3xl font-extralight text-white mb-1">{levelData?.levelName}</h2>
              <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>
              <p className="text-white/40 text-xs">TIME</p>
              <p className="text-white text-4xl font-light mb-1">{finalTime.toFixed(2)}s</p>
              {runResult.newBest && <p className="text-yellow-300 text-sm mb-4">New personal best!</p>}
              <div className="my-6">
                <LeaderboardPanel mode="daily" period={todayKey()} refreshKey={runResult.leaderboardKey} />
              </div>
              <div className="flex gap-3 justify-center">
                <button autoFocus onClick={retryLevel} className="px-12 py-4 bg-white/20 hover:bg-white/25 text-white rounded-full transition-all text-base font-medium border border-white/30 whitespace-nowrap">RETRY ↻</button>
                <button onClick={() => setGameState('modeSelect')} className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-full transition-all text-sm border border-white/5">MODES</button>
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
              <button autoFocus onClick={retryLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
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
          <h2 className="text-3xl font-extralight text-white mb-1">{gameMode === 'endless' ? 'SWALLOWED BY LAVA' : 'MOMENTUM LOST'}</h2>
          <p className="text-white/30 text-xs tracking-wider mb-8">
            {gameMode === 'endless' ? `Endless · ${levelData?.levelName}` : gameMode === 'daily' ? `Daily Climb · ${todayKey()}` : `Level ${level} · ${levelData?.levelName}`}
          </p>

          {gameMode === 'endless' ? (
            <>
              <p className="text-white/40 text-xs mb-1">HEIGHT</p>
              <p className="text-white text-5xl font-extralight mb-1">{runResult.height.toLocaleString()}m</p>
              <p className={`text-sm mb-6 ${runResult.newBest ? 'text-yellow-300' : 'text-white/40'}`}>
                {runResult.newBest ? 'New personal best!' : `Best: ${runResult.bestHeight.toLocaleString()}m`}
              </p>
              <div className="mb-8">
                <LeaderboardPanel mode="endless" period={todayKey()} refreshKey={runResult.leaderboardKey} />
              </div>
            </>
          ) : (
            <>
              <p className="text-white/40 text-xs mb-1">FINAL SCORE</p>
              <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>
            </>
          )}

          <div className="flex gap-4 justify-center">
            <button autoFocus onClick={retryLevel} className="px-12 py-4 bg-white/20 hover:bg-white/25 text-white rounded-full transition-all text-base font-medium border border-white/30 whitespace-nowrap">RETRY ↻</button>
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
