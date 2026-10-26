// Canvas rendering for one Momentum frame. Pure drawing: reads game state, never advances it
// (apart from fading short-lived visual effects).
import { MAX_BOOST_CHARGES, PLATFORM_HEIGHT, PLAYER_HEIGHT, PLAYER_WIDTH } from './physics';
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
  isTouchDevice: boolean;
  chainRef: Ref<number>;
  comboRef: Ref<number>;
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
    level, gameMode, timeRemaining, isTouchDevice,
    chainRef, comboRef, elapsedTimeRef, endlessRef, flashRef, ghostRef, goalYRef, highestYRef, lavaYRef,
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

};
