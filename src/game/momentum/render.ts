// Canvas rendering for one Momentum frame. Pure drawing: reads game state, never advances it
// (apart from fading short-lived visual effects).
import { MAX_BOOST_CHARGES, PLATFORM_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH, PERFECT_WINDOW_FRAMES, OVERDRIVE_FRAMES, OVERDRIVE_SCORE_MULTIPLIER, comboMultiplier } from './physics';
import { type Platform, type Orb, PHASE_CYCLE_FRAMES, PHASE_SOLID_FRAMES } from './levelGen';
import { type GhostRun, ghostPositionAt } from './ghost';
import type { Skin } from './skins';
import { todayKey } from './leaderboard';
import type { ThemeColors, PlayerState, Particle, TrailPoint, GameMode } from './types';

type Ref<T> = { current: T };

export interface RenderState {
  GAME_WIDTH: number;
  GAME_HEIGHT: number;
  levelData: ThemeColors;
  player: PlayerState;
  platforms: Platform[];
  camY: number;
  isTrueFalling: boolean;
  isRisingFast: boolean;
  level: number;
  gameMode: GameMode;
  timeRemaining: number;
  hasTimeLimit: boolean;
  splitRef: Ref<{ text: string; color: string; life: number } | null>;
  isTouchDevice: boolean;
  chainRef: Ref<number>;
  comboRef: Ref<number>;
  landingFrameRef: Ref<number>;
  perfectedThisBounceRef: Ref<boolean>;
  overdriveRef: Ref<number>;
  elapsedTimeRef: Ref<number>;
  endlessRef: Ref<unknown>;
  flashRef: Ref<number>;
  ghostRef: Ref<GhostRun | null>;
  goalYRef: Ref<number>;
  highestYRef: Ref<number>;
  lavaYRef: Ref<number>;
  orbsRef: Ref<Orb[]>;
  particlesRef: Ref<Particle[]>;
  popupRef: Ref<{ text: string; life: number; color: string } | null>;
  runModeRef: Ref<GameMode>;
  scoreRef: Ref<number>;
  shakeRef: Ref<number>;
  simFrameRef: Ref<number>;
  skinRef: Ref<Skin>;
  speedLinesRef: Ref<Array<{ x: number; y: number; length: number; speed: number; opacity: number }>>;
  startYRef: Ref<number>;
  tapFxRef: Ref<Array<{ x: number; y: number; life: number }>>;
  trailRef: Ref<TrailPoint[]>;
}

export const renderFrame = (ctx: CanvasRenderingContext2D, r: RenderState) => {
  const {
    GAME_WIDTH, GAME_HEIGHT, levelData, player, platforms, camY, isTrueFalling, isRisingFast,
    level, timeRemaining, hasTimeLimit, splitRef, isTouchDevice,
    chainRef, comboRef, elapsedTimeRef, landingFrameRef, perfectedThisBounceRef, overdriveRef, endlessRef, flashRef, ghostRef, goalYRef, highestYRef, lavaYRef,
    orbsRef, particlesRef, popupRef, runModeRef, scoreRef, shakeRef, simFrameRef, skinRef, speedLinesRef,
    startYRef, tapFxRef, trailRef,
  } = r;
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
    const isCharge = platform.type === 'charge' && !platform.touched;
    const isDrain = platform.type === 'drain' && !platform.touched;
    if (isCharge) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 22 + Math.sin(simFrameRef.current * 0.15) * 8;
    } else if (isDrain) {
      ctx.shadowColor = '#ff2a2a';
      ctx.shadowBlur = 16;
    }

    if (isCharge) {
      ctx.fillStyle = '#ffffff';
    } else if (isDrain) {
      // Dark body with a red rim reads as "bad" on any theme, even red ones
      ctx.fillStyle = '#1c0306';
    } else if (platform.type === 'spring' && !platform.touched) {
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

    if (isCharge || isDrain) {
      // + gives a boost, - takes one away
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (isDrain) {
        ctx.strokeStyle = '#ff3b3b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(platform.x, screenY, platform.width, PLATFORM_HEIGHT, 7);
        ctx.stroke();
      }
      ctx.fillStyle = isCharge ? '#1a1a2e' : '#ff3b3b';
      const cx = platform.x + platform.width / 2;
      const cy = screenY + PLATFORM_HEIGHT / 2;
      ctx.fillRect(cx - 5, cy - 1.5, 10, 3);
      if (isCharge) ctx.fillRect(cx - 1.5, cy - 5, 3, 10);
    }

    if (platform.sectionLabel && !platform.touched) {
      // Name the upcoming section so its pattern reads at a glance
      ctx.shadowBlur = 0;
      ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
      ctx.globalAlpha = 0.75;
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(platform.sectionLabel, platform.x + platform.width / 2, screenY - (platform.isCheckpoint ? 22 : 10));
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
      // Get-ready ring: closes in as touchdown approaches, so the perfect timing is readable
      const framesToLand = player.vy > 0 ? dist / Math.max(1, player.vy) : Infinity;
      if (framesToLand < 14) {
        const k = framesToLand / 14;
        ctx.strokeStyle = `rgba(255,224,102,${0.8 - k * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ballCenterX, player.y + PLAYER_HEIGHT / 2 + camY, PLAYER_WIDTH * (0.7 + k * 1.3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Perfect window open: a bright ring on the ball until the window closes
  const framesSinceTouchdown = simFrameRef.current - landingFrameRef.current;
  if (framesSinceTouchdown >= 0 && framesSinceTouchdown <= PERFECT_WINDOW_FRAMES && !perfectedThisBounceRef.current) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1 - framesSinceTouchdown / (PERFECT_WINDOW_FRAMES + 1);
    ctx.beginPath();
    ctx.arc(player.x + PLAYER_WIDTH / 2, player.y + PLAYER_HEIGHT / 2 + camY, PLAYER_WIDTH * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
  const inOverdrive = overdriveRef.current > 0;
  const skinFill = skin.rainbow || inOverdrive ? `hsl(${(simFrameRef.current * (inOverdrive ? 8 : 3)) % 360}, 90%, 65%)` : skin.fill;
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
  // Time is the headline: a countdown when there's a limit, otherwise the run clock
  if (hasTimeLimit) {
    const isLowTime = timeRemaining < 10;
    const isVeryLowTime = timeRemaining < 5;
    ctx.fillStyle = isVeryLowTime ? 'rgba(255,50,50,0.95)' : isLowTime ? 'rgba(255,150,50,0.95)' : 'rgba(255,255,255,0.95)';
    ctx.font = isVeryLowTime ? 'bold 32px monospace' : isLowTime ? 'bold 28px monospace' : 'bold 24px monospace';
    const timeText = timeRemaining > 0 ? timeRemaining.toFixed(1) + 's' : 'TIME UP!';
    ctx.fillText(timeText, GAME_WIDTH / 2, 34);

    if (isVeryLowTime) {
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.02) * 0.3;
      ctx.fillStyle = 'rgba(255,0,0,0.8)';
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(elapsedTimeRef.current.toFixed(1) + 's', GAME_WIDTH / 2, 34);
  }

  const split = splitRef.current;
  if (split) {
    ctx.globalAlpha = Math.min(1, split.life);
    ctx.fillStyle = split.color;
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(split.text, GAME_WIDTH / 2, 92);
    ctx.globalAlpha = 1;
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
    const mult = comboMultiplier(comboRef.current) * (overdriveRef.current > 0 ? OVERDRIVE_SCORE_MULTIPLIER : 1);
    ctx.fillText(`×${mult.toFixed(1)} COMBO`, GAME_WIDTH - 40, 106);
    ctx.globalAlpha = 1;
  }

  const boostColor = levelData.boostTrailColor || '#00ffff';
  // Banked boosts: one pip each (up to the cap); an empty bank shows a single hollow pip
  const pips = Math.max(1, Math.min(MAX_BOOST_CHARGES, player.boostCharges));
  for (let i = 0; i < pips; i++) {
    const filled = i < player.boostCharges;
    ctx.fillStyle = filled ? '#ffffff' : 'rgba(255,255,255,0.12)';
    ctx.shadowColor = boostColor;
    ctx.shadowBlur = filled ? 10 : 0;
    ctx.beginPath();
    ctx.arc(24 + i * 18, GAME_HEIGHT - 24, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(isTouchDevice ? 'BOOST' : 'BOOST [SPACE]', 16, GAME_HEIGHT - 40);

  if (chainRef.current > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('MOMENTUM', 200, GAME_HEIGHT - 40);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < chainRef.current ? boostColor : 'rgba(255,255,255,0.1)';
      ctx.fillRect(200 + i * 12, GAME_HEIGHT - 30, 9, 10);
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

  if (overdriveRef.current > 0) {
    // Overdrive: pulsing rainbow frame and a countdown bar under the timer
    const hue = (simFrameRef.current * 4) % 360;
    const pulse = 0.45 + Math.sin(simFrameRef.current * 0.3) * 0.25;
    ctx.strokeStyle = `hsla(${hue}, 100%, 60%, ${pulse})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, GAME_WIDTH - 10, GAME_HEIGHT - 10);
    const barW = 200;
    const barX = (GAME_WIDTH - barW) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, 44, barW, 6);
    ctx.fillStyle = `hsl(${hue}, 100%, 62%)`;
    ctx.fillRect(barX, 44, barW * Math.min(1, overdriveRef.current / OVERDRIVE_FRAMES), 6);
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('OVERDRIVE ×2', GAME_WIDTH / 2, 64);
  }

  ctx.restore();

  if (flashRef.current > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashRef.current})`;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

};
