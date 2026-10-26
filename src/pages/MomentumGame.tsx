import { useState, useEffect, useRef, useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import {
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  STEP_MS,
  MAX_FRAME_MS,
  MAX_BOOST_CHARGES,
  START_BOOST_CHARGES,
  timeBudget,
  BOOST_BUFFER_FRAMES,
  BOOST_COOLDOWN_FRAMES,
  PERFECT_WINDOW_FRAMES,
  BOOST_HORIZONTAL,
  bounceVelocity,
  boostVelocity,
  perfectBounceVelocity,
  nextChain,
  MAX_CHAIN,
  comboMultiplier,
  climbBroken,
  OVERDRIVE_FRAMES,
  OVERDRIVE_EXTEND_FRAMES,
  OVERDRIVE_MAX_FRAMES,
  OVERDRIVE_SCORE_MULTIPLIER,
  magnetVx,
} from '../game/momentum/physics';
import { momentumMusic, musicIntensity } from '../game/momentum/music';
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
import { loadTheme, reserveBoostWhite } from '../game/momentum/themes';
import type { ThemeColors, PlayerState, Particle, TrailPoint, GameMode, CareerProgressRow } from '../game/momentum/types';
import { renderFrame } from '../game/momentum/render';
import { themePresets, type CareerLevel } from '../game/momentum/config';
import { MenuScreen, ModeSelectScreen, CareerSelectScreen, ThemeSelectScreen, LoadingScreen, LevelCompleteScreen, CareerFailedScreen, GameOverScreen, type ScreenProps } from '../components/games/momentum/MomentumScreens';
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
  LANDSCAPE_WIDTH,
  PORTRAIT_WIDTH,
} from '../game/momentum/levelGen';
import { type GhostRun, GHOST_SAMPLE_STEPS, loadLocalGhost, saveLocalGhostIfBest } from '../game/momentum/ghost';
import { loadStats, updateStats, loadSkinId, skinById } from '../game/momentum/skins';
import { todayKey, submitRun, fetchLeaderboard } from '../game/momentum/leaderboard';
import { analyticsService } from '../services/analyticsService';

// The playfield is chosen per run: landscape 800x600, or a taller, narrower world in portrait.
let GAME_WIDTH = 800;
let GAME_HEIGHT = 600;
const choosePlayfield = () => {
  const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth * 1.15;
  if (portrait) {
    GAME_WIDTH = PORTRAIT_WIDTH;
    GAME_HEIGHT = Math.round(Math.min(1000, Math.max(720, PORTRAIT_WIDTH * (window.innerHeight / window.innerWidth))));
  } else {
    GAME_WIDTH = LANDSCAPE_WIDTH;
    GAME_HEIGHT = 600;
  }
};
const GRAVITY = 0.55;
const HORIZONTAL_SPEED = 4.5;



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


export function MomentumGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [gameState, setGameState] = useState<'menu' | 'modeSelect' | 'careerLevelSelect' | 'themeSelect' | 'loading' | 'playing' | 'levelComplete' | 'gameOver' | 'careerFailed'>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('freeplay');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [level, setLevel] = useState(1);
  const [careerProgress, setCareerProgress] = useState<CareerProgressRow[]>([]);
  const [currentCareerLevel, setCurrentCareerLevel] = useState<CareerLevel | null>(null);
  const [levelData, setLevelData] = useState<ThemeColors | null>(null);
  const [score, setScore] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [finalTime, setFinalTime] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  const [starsEarned, setStarsEarned] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const playerRef = useRef<PlayerState>({ x: 100, y: 300, prevY: 300, vx: 0, vy: 0, boostCharges: START_BOOST_CHARGES, isBoosting: false, boostTimer: 0 });
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
  const perfectStreakRef = useRef(0);
  const overdriveRef = useRef(0);
  // Seconds allowed for the run (Infinity = no limit); Free Play extends it at each checkpoint
  const timeLimitRef = useRef(Infinity);
  const checkpointBudgetsRef = useRef<number[]>([]);
  const splitRef = useRef<{ text: string; color: string; life: number } | null>(null);
  const musicLevelRef = useRef(0);
  const perfectedThisBounceRef = useRef(false);
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

      // Read the row fresh: careerProgress state can be stale when a run is retried right after a save
      const { data: existingProgress } = await supabase
        .from('momentum_career_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('level_number', levelNum)
        .maybeSingle<CareerProgressRow>();

      if (existingProgress) {
        const shouldUpdate = !existingProgress.completed ||
                            (completed && time < (existingProgress.best_time ?? Infinity)) ||
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
    perfectStreakRef.current = 0;
    perfectedThisBounceRef.current = false;
    overdriveRef.current = 0;
    musicLevelRef.current = 0;
    momentumMusic.setIntensity(0);
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
    player.boostCharges = Math.max(1, player.boostCharges);
    resetMomentum();
    cameraYRef.current = Math.max(0, GAME_HEIGHT * (GAME_HEIGHT > 600 ? 0.45 : 0.4) - player.y);
    comboRef.current = 0;
    lastPlatformYRef.current = player.y; // Reset last platform Y on respawn
    touchTargetXRef.current = null;
    steerPointerRef.current = null;
    endOverdrive();
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

  const scoreMultiplier = () =>
    comboMultiplier(comboRef.current) * (overdriveRef.current > 0 ? OVERDRIVE_SCORE_MULTIPLIER : 1);

  const endOverdrive = () => {
    if (overdriveRef.current <= 0) return;
    overdriveRef.current = 0;
    momentumSfx.overdriveEnd();
  };

  // Presses are buffered for a few frames so an early or mistimed press is never lost
  // framesAgo lets a tap that is recognised on release count from when the finger went down
  const triggerBoost = (framesAgo = 0) => {
    momentumSfx.unlock();
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

    // Countdown (Career and Free Play) is derived from the game clock so it pauses with the game
    const timeRemaining = Math.max(0, timeLimitRef.current - elapsedTimeRef.current);

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
    } else if (keys.left !== keys.right) {
      // Ease toward full speed so keyboard steering feels like touch
      const target = keys.left ? -HORIZONTAL_SPEED : HORIZONTAL_SPEED;
      player.vx += (target - player.vx) * 0.4;
    } else {
      player.vx *= 0.82;
    }

    if (boostCooldownRef.current > 0) boostCooldownRef.current--;
    framesSinceLandingRef.current++;
    simFrameRef.current++;
    if (shakeRef.current > 0) shakeRef.current *= 0.85;
    if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.06);
    if (splitRef.current) {
      splitRef.current.life -= 1 / 60;
      if (splitRef.current.life <= 0) splitRef.current = null;
    }
    if (popupRef.current) {
      popupRef.current.life -= 0.02;
      if (popupRef.current.life <= 0) popupRef.current = null;
    }

    if (boostBufferRef.current > 0) {
      const boostColor = levelData.boostTrailColor || '#00ffff';
      const pressAfterLanding = boostPressFrameRef.current - landingFrameRef.current;
      const isPerfect = pressAfterLanding >= -3 && pressAfterLanding <= PERFECT_WINDOW_FRAMES
        && framesSinceLandingRef.current <= PERFECT_WINDOW_FRAMES + BOOST_BUFFER_FRAMES && player.vy < 0
        && !perfectedThisBounceRef.current;
      if (isPerfect) {
        // Perfect bounce: pressing right after landing is free, builds momentum and launches much higher
        perfectStreakRef.current++;
        perfectedThisBounceRef.current = true;
        const wasMaxMomentum = chainRef.current >= MAX_CHAIN;
        chainRef.current = Math.min(MAX_CHAIN, chainRef.current + 1);
        player.vy = Math.min(player.vy, perfectBounceVelocity(level, chainRef.current, lastLandingSpringRef.current));
        boostBufferRef.current = 0;
        player.boostTimer = 30;
        player.isBoosting = true;
        hitStopRef.current = 3;
        shakeRef.current = 7;
        flashRef.current = 0.35;
        const streak = perfectStreakRef.current;
        popupRef.current = { text: streak >= 2 ? `PERFECT x${streak}` : 'PERFECT!', life: 1, color: '#ffe066' };
        haptic(25);
        momentumSfx.perfect(streak);
        updateStats(st => ({ perfects: st.perfects + 1 }));
        if (overdriveRef.current > 0) {
          overdriveRef.current = Math.min(OVERDRIVE_MAX_FRAMES, overdriveRef.current + OVERDRIVE_EXTEND_FRAMES);
        } else if (wasMaxMomentum) {
          // Overdrive: a perfect bounce at max momentum
          overdriveRef.current = OVERDRIVE_FRAMES;
          hitStopRef.current = 6;
          shakeRef.current = 10;
          flashRef.current = 0.5;
          popupRef.current = { text: 'OVERDRIVE!', life: 1.4, color: '#ff4fd8' };
          momentumSfx.overdrive();
          haptic(40);
          const stats = updateStats(st => ({ overdrives: st.overdrives + 1 }));
          setLifetimeStats(stats);
          trackMomentum('overdrive', { mode: runModeRef.current, level, time: Number(elapsedTimeRef.current.toFixed(1)) });
        }
        scoreRef.current += Math.round(100 * streak * scoreMultiplier());
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#ffe066', 18, 14);
      } else if ((player.boostCharges > 0 || overdriveRef.current > 0) && boostCooldownRef.current === 0) {
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
        if (overdriveRef.current <= 0) player.boostCharges--;
        haptic(12);
        momentumSfx.boost();
        player.isBoosting = true;
        player.boostTimer = 25;
        boostBufferRef.current = 0;
        boostCooldownRef.current = overdriveRef.current > 0 ? Math.floor(BOOST_COOLDOWN_FRAMES / 2) : BOOST_COOLDOWN_FRAMES;
        hitStopRef.current = 2;
        shakeRef.current = 4;
        flashRef.current = 0.18;
        spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, boostColor, 14, 12);
      } else {
        boostBufferRef.current--;
        // The press expired without a perfect or a charge to spend
        if (boostBufferRef.current === 0) momentumSfx.empty();
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

    if (overdriveRef.current > 0) {
      overdriveRef.current--;
      if (overdriveRef.current === 0) {
        momentumSfx.overdriveEnd();
        popupRef.current = { text: 'OVERDRIVE OVER', life: 0.6, color: '#ffffff' };
      }
      // Landing assist: pull toward the platform the ball is falling onto
      if (player.vy > 0) {
        const ballCenterX = player.x + PLAYER_WIDTH / 2;
        const ballBottom = player.y + PLAYER_HEIGHT;
        let target: Platform | null = null;
        for (const pl of platformsRef.current) {
          if (pl.crumbled || pl.y < ballBottom || pl.y > ballBottom + 260) continue;
          if (!isPhaseSolid(pl, simFrameRef.current)) continue;
          if (!target || Math.abs(pl.x + pl.width / 2 - ballCenterX) < Math.abs(target.x + target.width / 2 - ballCenterX)) target = pl;
        }
        if (target) player.vx = magnetVx(player.vx, ballCenterX, target.x + target.width / 2);
      }
    }

    const musicLevel = musicIntensity(chainRef.current, overdriveRef.current > 0);
    if (musicLevel !== musicLevelRef.current) {
      musicLevelRef.current = musicLevel;
      momentumMusic.setIntensity(musicLevel);
    }

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
      scoreRef.current += Math.floor(heightGained * scoreMultiplier());
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
        if (climbBroken(player.y, prevLandingYRef.current, framesSinceLandingRef.current)) {
          comboRef.current = 0;
          if (prevChain > 0) momentumMusic.drop();
          endOverdrive();
        }
        // A landing that wasn't perfected ends the perfect streak
        if (!perfectedThisBounceRef.current) perfectStreakRef.current = 0;
        perfectedThisBounceRef.current = false;
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
            if (platform.type === 'charge') {
              player.boostCharges = Math.min(MAX_BOOST_CHARGES, player.boostCharges + 1);
              popupRef.current = { text: '+1 BOOST', life: 0.8, color: '#ffffff' };
              momentumSfx.orb();
              haptic(10);
              spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#ffffff', 14, 10);
            } else if (platform.type === 'drain') {
              if (player.boostCharges > 0 && overdriveRef.current <= 0) {
                player.boostCharges--;
                popupRef.current = { text: '-1 BOOST', life: 0.8, color: '#ff4d4d' };
                momentumSfx.drain();
                haptic(30);
                shakeRef.current = Math.max(shakeRef.current, 4);
              }
              spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, '#ff4d4d', 12, 10);
            }
            const pointMultiplier = platform.type === 'spring' || platform.isFar ? 2 : 1;
            scoreRef.current += Math.round(50 * scoreMultiplier() * pointMultiplier);

            if (platform.isFar && platform.type !== 'charge') {
              // Sky hop: the fast side platforms are a risky shortcut, so pay out double points
              popupRef.current = { text: 'SKY HOP ×2', life: 0.8, color: levelData.boostTrailColor || '#00ffff' };
            }

            if (platform.isCheckpoint) {
              onCheckpoint(platform.y);
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

    const targetCameraY = Math.max(0, GAME_HEIGHT * (GAME_HEIGHT > 600 ? 0.45 : 0.4) - player.y);
    cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.06;
    const camY = cameraYRef.current;

    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.025;
      return p.life > 0;
    });

    if (Number.isFinite(timeLimitRef.current) && timeRemaining <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      momentumSfx.fall();
      trackMomentum('time_up', { mode: runModeRef.current, level, progress: Number(Math.min(1, (520 - highestYRef.current) / (520 - goalYRef.current)).toFixed(2)) });
      setGameState('careerFailed');
      if (gameMode === 'career' && currentCareerLevel) {
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

    renderFrame(ctx, {
      GAME_WIDTH, GAME_HEIGHT, levelData, player, platforms, camY, isTrueFalling, isRisingFast,
      level, gameMode, timeRemaining, hasTimeLimit: Number.isFinite(timeLimitRef.current), splitRef, isTouchDevice,
      chainRef, comboRef, elapsedTimeRef, landingFrameRef, perfectedThisBounceRef, overdriveRef, endlessRef, flashRef, ghostRef, goalYRef, highestYRef, lavaYRef,
      orbsRef, particlesRef, popupRef, runModeRef, scoreRef, shakeRef, simFrameRef, skinRef, speedLinesRef,
      startYRef, tapFxRef, trailRef,
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, levelData, isTouchDevice]);

  // Music plays only while a run is live
  useEffect(() => {
    if (gameState === 'playing' && !isPaused && !showTutorial) momentumMusic.start();
    else momentumMusic.stop();
  }, [gameState, isPaused, showTutorial]);

  useEffect(() => () => momentumMusic.stop(), []);

  // Dev-only hooks for automated tests and tuning; stripped from production builds
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __momentumDebug?: unknown };
    w.__momentumDebug = {
      state: () => ({
        chain: chainRef.current,
        combo: comboRef.current,
        overdrive: overdriveRef.current,
        charges: playerRef.current.boostCharges,
        score: scoreRef.current,
        music: musicLevelRef.current,
      }),
      triggerOverdrive: () => {
        chainRef.current = MAX_CHAIN;
        overdriveRef.current = OVERDRIVE_FRAMES;
        momentumSfx.overdrive();
      },
    };
    return () => {
      delete w.__momentumDebug;
    };
  }, []);

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

  // First touch of a checkpoint: Free Play earns more time; ghost runs show a split
  const onCheckpoint = (checkpointY: number) => {
    const extension = checkpointBudgetsRef.current.shift();
    if (runModeRef.current === 'freeplay' && extension) {
      timeLimitRef.current += extension;
      splitRef.current = { text: `+${extension}s`, color: '#7dffc4', life: 1.6 };
      return;
    }
    const ghost = ghostRef.current;
    if (!ghost) return;
    for (let i = 1; i < ghost.path.length; i += 2) {
      if (ghost.path[i] + PLAYER_HEIGHT <= checkpointY + 4) {
        const delta = (simFrameRef.current - ((i - 1) / 2) * GHOST_SAMPLE_STEPS) / 60;
        splitRef.current = {
          text: `${delta <= 0 ? '-' : '+'}${Math.abs(delta).toFixed(1)}s`,
          color: delta <= 0 ? '#7dffc4' : '#ff6b6b',
          life: 1.6,
        };
        return;
      }
    }
  };

  const ghostKeyFor = (mode: GameMode, careerLevel?: CareerLevel | null) =>
    mode === 'career' && careerLevel ? `career-${careerLevel.number}-${GAME_WIDTH}` : mode === 'daily' ? `daily-${todayKey()}-${GAME_WIDTH}` : null;

  // Builds a fresh run. Career and daily levels are seeded so they are identical every attempt.
  const startRun = (rawTheme: ThemeColors, difficulty: number, mode: GameMode, careerLevel?: CareerLevel | null) => {
    const theme = reserveBoostWhite(rawTheme);
    runModeRef.current = mode;
    const seed = mode === 'career' && careerLevel
      ? seedFromString(`career-${careerLevel.number}`)
      : mode === 'daily'
        ? seedFromString(`daily-${todayKey()}`)
        : Math.floor(Math.random() * 2 ** 32);
    const rng = createRng(seed);
    choosePlayfield();

    let platforms: Platform[];
    let orbs: Orb[];
    let goalY: number;
    if (mode === 'endless') {
      const state = createEndlessState(GAME_WIDTH);
      ({ platforms, orbs } = generateChunk(state, ENDLESS_CHUNK, 1, theme, rng, Number.MAX_SAFE_INTEGER));
      endlessRef.current = { state, rng, topY: state.y };
      goalY = -Infinity;
      lavaYRef.current = 520 + 420;
    } else {
      ({ platforms, orbs, goalY } = generateLevel(difficulty, theme, rng, GAME_WIDTH));
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
      boostCharges: START_BOOST_CHARGES,
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
        // Leaderboard ghosts start with -worldWidth so portrait and landscape runs are not mixed
        const path = top?.ghost;
        if (!path || path[0] !== -GAME_WIDTH || runModeRef.current !== 'daily') return;
        if (!ghostRef.current || Number(top.time) < ghostRef.current.time) {
          ghostRef.current = { time: Number(top.time), path: path.slice(1), name: top.display_name };
        }
      });
    }

    // Time limits: Career has a fixed limit; Free Play is a time attack topped up at each checkpoint
    splitRef.current = null;
    if (mode === 'career' && careerLevel) {
      timeLimitRef.current = careerLevel.timeLimit;
      checkpointBudgetsRef.current = [];
    } else if (mode === 'freeplay') {
      const marks = [520, ...platforms.filter(pl => pl.isCheckpoint).map(pl => pl.y).sort((a, b) => b - a), goalY];
      const budgets = marks.slice(1).map((y, i) => timeBudget(marks[i] - y, difficulty));
      timeLimitRef.current = budgets[0];
      checkpointBudgetsRef.current = budgets.slice(1);
    } else {
      timeLimitRef.current = Infinity;
      checkpointBudgetsRef.current = [];
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
      submitRun('daily', todayKey(), scoreRef.current, time, { ...run, path: [-GAME_WIDTH, ...run.path] }).then(() =>
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

  const screenProps: ScreenProps = {
    careerProgress, currentCareerLevel, customTheme, finalTime, gameMode, isTouchDevice, level, levelData, lifetimeStats, loadingText, navigate, nextLevel, restart, retryLevel, runResult, score, searchParams, selectTheme, setCurrentCareerLevel, setCustomTheme, setGameMode, setGameState, setSkinId, skinId, speedBonus, starsEarned, startCareerLevel, startDaily, theme,
  };

  if (gameState === 'menu') return <MenuScreen {...screenProps} />;

  if (gameState === 'modeSelect') return <ModeSelectScreen {...screenProps} />;

  if (gameState === 'careerLevelSelect') return <CareerSelectScreen {...screenProps} />;

  if (gameState === 'themeSelect') return <ThemeSelectScreen {...screenProps} />;

  if (gameState === 'loading') return <LoadingScreen {...screenProps} />;

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
              width: `min(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)) * ${GAME_WIDTH} / ${GAME_HEIGHT}), 1100px)`,
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
            <p className="text-white/60 text-sm mb-2">White ledges bank a boost, red ones take one away.</p>
            <p className="text-white/60 text-sm mb-2">Boost right as you land for a free PERFECT bounce.</p>
            <p className="text-white/60 text-sm mb-8">Hit a PERFECT at max momentum to trigger OVERDRIVE.</p>
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

  if (gameState === 'levelComplete') return <LevelCompleteScreen {...screenProps} />;

  if (gameState === 'careerFailed') return <CareerFailedScreen {...screenProps} />;

  if (gameState === 'gameOver') return <GameOverScreen {...screenProps} />;

  return null;
}
