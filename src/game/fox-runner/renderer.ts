import type { GameState, Player, Enemy, Platform, Collectible, Particle, Spike, Checkpoint, LevelGoal, BackgroundTheme, HazardZone, ScorePopup } from './types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, T, PLAYER_WIDTH, PLAYER_HEIGHT, TIME_BONUS_PER_SECOND } from './config';
import { LEVELS } from './levels';

const THEME_COLORS: Record<BackgroundTheme, { sky: string[]; ground: string; platformTop: string; platformSide: string; hills: string[] }> = {
  forest: {
    sky: ['#87CEEB', '#5BA3D9', '#3A7BC8'],
    ground: '#5D8A3C',
    platformTop: '#6B9B4A',
    platformSide: '#4A6B33',
    hills: ['#4A7A2E', '#3D6B25', '#2F5A1C'],
  },
  cave: {
    sky: ['#1A1A2E', '#16213E', '#0F3460'],
    ground: '#3D3D5C',
    platformTop: '#4A4A6A',
    platformSide: '#2D2D44',
    hills: ['#252540', '#1E1E35', '#17172A'],
  },
  mountain: {
    sky: ['#E8D5B7', '#C9A96E', '#A67B5B'],
    ground: '#8B7355',
    platformTop: '#9B8365',
    platformSide: '#6B5340',
    hills: ['#7A6B55', '#6B5C45', '#5C4D38'],
  },
  sky: {
    sky: ['#B0D4F1', '#7CB8DE', '#4A9CCB'],
    ground: '#C4A882',
    platformTop: '#D4C4A2',
    platformSide: '#A89070',
    hills: ['#90C0E0', '#70A0C8', '#5088B0'],
  },
};

export function renderBackground(ctx: CanvasRenderingContext2D, theme: BackgroundTheme, camX: number, _camY: number, time: number) {
  const colors = THEME_COLORS[theme];
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  grad.addColorStop(0, colors.sky[0]);
  grad.addColorStop(0.5, colors.sky[1]);
  grad.addColorStop(1, colors.sky[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (theme === 'sky') {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 180 + time * 8 - camX * 0.05) % (CANVAS_WIDTH + 200)) - 100;
      const cy = 40 + i * 30 + Math.sin(i * 2.1) * 20;
      drawCloud(ctx, cx, cy, 30 + i * 8);
    }
  }

  for (let layer = 0; layer < 3; layer++) {
    const parallax = 0.1 + layer * 0.1;
    const offsetX = -camX * parallax;
    const amplitude = 60 - layer * 15;
    const baseY = CANVAS_HEIGHT - 80 - layer * 40;
    ctx.fillStyle = colors.hills[layer];
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_HEIGHT);
    for (let x = 0; x <= CANVAS_WIDTH; x += 4) {
      const wx = x + offsetX;
      const y = baseY + Math.sin(wx * 0.005 + layer * 2) * amplitude + Math.sin(wx * 0.012 + layer) * (amplitude * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y - size * 0.15, size * 0.4, 0, Math.PI * 2);
  ctx.arc(x + size * 0.8, y, size * 0.35, 0, Math.PI * 2);
  ctx.arc(x + size * 0.4, y + size * 0.1, size * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export function renderPlatform(ctx: CanvasRenderingContext2D, p: Platform, theme: BackgroundTheme) {
  const colors = THEME_COLORS[theme];

  if (p.crumbled) return;

  if (p.type === 'spring') {
    const compression = p.springTimer > 0 ? Math.sin(p.springTimer * 10) * 4 : 0;
    ctx.fillStyle = '#DD4444';
    ctx.fillRect(p.x + 4, p.y + T - 10 + compression, p.width - 8, 10 - compression);
    ctx.fillStyle = '#EEAA22';
    ctx.fillRect(p.x + 2, p.y + T - 14 + compression, p.width - 4, 6);
    ctx.fillStyle = '#888';
    ctx.fillRect(p.x + 6, p.y + T - 6, p.width - 12, 6);
    return;
  }

  const alpha = p.crumbling ? Math.max(0, 1 - p.crumbleTimer * 1.5) : 1;
  ctx.globalAlpha = alpha;

  if (p.type === 'crumbling') {
    const shake = p.crumbling ? (Math.random() - 0.5) * 3 : 0;
    ctx.fillStyle = '#AA8866';
    ctx.fillRect(p.x + shake, p.y, p.width, p.height);
    ctx.fillStyle = '#C4A882';
    ctx.fillRect(p.x + shake, p.y, p.width, 4);
    if (p.crumbling) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      for (let i = 0; i < p.width; i += 8) {
        if (Math.random() > 0.5) ctx.fillRect(p.x + i + shake, p.y, 4, p.height);
      }
    }
  } else if (p.type === 'moving_h' || p.type === 'moving_v') {
    ctx.fillStyle = '#7788AA';
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = '#99AABB';
    ctx.fillRect(p.x, p.y, p.width, 4);
    ctx.fillStyle = '#668899';
    ctx.fillRect(p.x + 4, p.y + p.height - 4, p.width - 8, 2);
  } else {
    ctx.fillStyle = colors.platformSide;
    ctx.fillRect(p.x, p.y, p.width, p.height);
    ctx.fillStyle = colors.platformTop;
    ctx.fillRect(p.x, p.y, p.width, 6);
    ctx.fillStyle = colors.ground;
    ctx.fillRect(p.x, p.y + 6, p.width, 3);
  }

  ctx.globalAlpha = 1;
}

export function renderSpike(ctx: CanvasRenderingContext2D, s: Spike) {
  ctx.fillStyle = '#CC3333';
  const count = Math.floor(s.width / 12);
  const spikeW = s.width / count;
  for (let i = 0; i < count; i++) {
    const sx = s.x + i * spikeW;
    ctx.beginPath();
    ctx.moveTo(sx, s.y + s.height);
    ctx.lineTo(sx + spikeW / 2, s.y);
    ctx.lineTo(sx + spikeW, s.y + s.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#AA2222';
  for (let i = 0; i < count; i++) {
    const sx = s.x + i * spikeW;
    ctx.beginPath();
    ctx.moveTo(sx + spikeW * 0.3, s.y + s.height);
    ctx.lineTo(sx + spikeW / 2, s.y + 2);
    ctx.lineTo(sx + spikeW * 0.7, s.y + s.height);
    ctx.closePath();
    ctx.fill();
  }
}

export function renderHazardZone(ctx: CanvasRenderingContext2D, hz: HazardZone, time: number) {
  if (hz.type === 'lava') {
    const grad = ctx.createLinearGradient(hz.x, hz.y, hz.x, hz.y + hz.height);
    grad.addColorStop(0, 'rgba(255, 80, 0, 0.8)');
    grad.addColorStop(0.3, 'rgba(255, 40, 0, 0.9)');
    grad.addColorStop(1, 'rgba(180, 0, 0, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(hz.x, hz.y, hz.width, hz.height);

    ctx.fillStyle = 'rgba(255, 200, 50, 0.5)';
    for (let x = hz.x; x < hz.x + hz.width; x += 16) {
      const waveY = hz.y + Math.sin((x + time * 40) * 0.08) * 3;
      ctx.fillRect(x, waveY, 12, 4);
    }

    ctx.fillStyle = 'rgba(255, 255, 100, 0.15)';
    ctx.fillRect(hz.x, hz.y - 8, hz.width, 8);
  } else {
    const grad = ctx.createLinearGradient(hz.x, hz.y, hz.x, hz.y + hz.height);
    grad.addColorStop(0, 'rgba(40, 120, 200, 0.5)');
    grad.addColorStop(0.5, 'rgba(30, 90, 180, 0.6)');
    grad.addColorStop(1, 'rgba(20, 60, 140, 0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(hz.x, hz.y, hz.width, hz.height);

    ctx.fillStyle = 'rgba(150, 200, 255, 0.3)';
    for (let x = hz.x; x < hz.x + hz.width; x += 20) {
      const waveY = hz.y + Math.sin((x + time * 25) * 0.06) * 2;
      ctx.fillRect(x, waveY, 14, 3);
    }
  }
}

export function renderScorePopup(ctx: CanvasRenderingContext2D, sp: ScorePopup) {
  const alpha = sp.life / sp.maxLife;
  const scale = 1 + (1 - alpha) * 0.3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = sp.color;
  ctx.font = `bold ${Math.round(13 * scale)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(sp.text, sp.x, sp.y);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

export function renderCheckpoint(ctx: CanvasRenderingContext2D, cp: Checkpoint, time: number) {
  const flagColor = cp.activated ? '#44DD44' : '#AAAAAA';
  ctx.fillStyle = '#886644';
  ctx.fillRect(cp.x + 12, cp.y - 40, 4, 44);
  ctx.fillStyle = flagColor;
  ctx.beginPath();
  ctx.moveTo(cp.x + 16, cp.y - 40);
  ctx.lineTo(cp.x + 36 + (cp.activated ? Math.sin(time * 5) * 3 : 0), cp.y - 30);
  ctx.lineTo(cp.x + 16, cp.y - 20);
  ctx.closePath();
  ctx.fill();
}

export function renderGoal(ctx: CanvasRenderingContext2D, g: LevelGoal, time: number) {
  const glow = 0.3 + Math.sin(time * 3) * 0.15;
  ctx.fillStyle = `rgba(255, 215, 0, ${glow})`;
  ctx.beginPath();
  ctx.arc(g.x + g.width / 2, g.y + g.height / 2, g.width, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  const cx = g.x + g.width / 2;
  const cy = g.y + g.height / 2;
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2 + time * 0.5;
    const outer = 16;
    const inner = 7;
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    const midAngle = angle + Math.PI / 5;
    ctx.lineTo(cx + Math.cos(midAngle) * inner, cy + Math.sin(midAngle) * inner);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FFF8DC';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
}

export function renderCollectible(ctx: CanvasRenderingContext2D, c: Collectible, time: number) {
  if (c.collected) return;
  const bob = Math.sin(c.bobTimer + time * 3) * 3;
  const x = c.pos.x;
  const y = c.pos.y + bob;

  if (c.type === 'berry') {
    ctx.fillStyle = '#FF4466';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FF8899';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#44AA44';
    ctx.fillRect(x - 2, y - 10, 4, 4);
  } else if (c.type === 'gem') {
    ctx.fillStyle = '#44DDFF';
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#88EEFF';
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 4, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 4, y);
    ctx.closePath();
    ctx.fill();
  } else if (c.type === 'heart') {
    ctx.fillStyle = '#FF4444';
    const s = 8;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.6);
    ctx.bezierCurveTo(x - s, y - s * 0.2, x - s * 0.5, y - s, x, y - s * 0.4);
    ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.2, x, y + s * 0.6);
    ctx.fill();
    ctx.fillStyle = '#FF8888';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.type === 'powerup') {
    const glow = 0.4 + Math.sin(time * 4) * 0.2;
    ctx.fillStyle = `rgba(255, 215, 0, ${glow})`;
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y - 10);
    ctx.moveTo(x - 3, y - 3);
    ctx.lineTo(x - 6, y - 7);
    ctx.moveTo(x + 3, y - 3);
    ctx.lineTo(x + 6, y - 7);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
}

export function renderFox(ctx: CanvasRenderingContext2D, p: Player, time: number) {
  const { pos, vel, facing, grounded, invulnerableTimer, squash, animFrame, dead, wallSliding, hasDoubleJump } = p;
  if (dead) return;
  if (invulnerableTimer > 0 && Math.floor(invulnerableTimer * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(pos.x + PLAYER_WIDTH / 2, pos.y + PLAYER_HEIGHT);

  if (wallSliding) {
    ctx.scale(-p.wallSlideDir, 1);
  } else {
    ctx.scale(facing, 1);
  }
  ctx.scale(1 / Math.max(0.7, squash), squash);

  const bodyW = PLAYER_WIDTH;
  const bodyH = PLAYER_HEIGHT - 4;

  ctx.fillStyle = '#E87A22';
  roundRect(ctx, -bodyW / 2, -bodyH, bodyW, bodyH, 4);
  ctx.fill();

  ctx.fillStyle = '#F5DEB3';
  roundRect(ctx, -bodyW / 2 + 3, -bodyH + 10, bodyW - 6, bodyH - 12, 3);
  ctx.fill();

  ctx.fillStyle = '#E87A22';
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2 + 2, -bodyH);
  ctx.lineTo(-bodyW / 2 + 6, -bodyH - 8);
  ctx.lineTo(-bodyW / 2 + 10, -bodyH);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 10, -bodyH);
  ctx.lineTo(bodyW / 2 - 6, -bodyH - 8);
  ctx.lineTo(bodyW / 2 - 2, -bodyH);
  ctx.fill();

  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2 + 3, -bodyH - 1);
  ctx.lineTo(-bodyW / 2 + 6, -bodyH - 8);
  ctx.lineTo(-bodyW / 2 + 7, -bodyH - 1);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 7, -bodyH - 1);
  ctx.lineTo(bodyW / 2 - 6, -bodyH - 8);
  ctx.lineTo(bodyW / 2 - 3, -bodyH - 1);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.ellipse(3, -bodyH + 6, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.arc(4, -bodyH + 6, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.arc(bodyW / 2 - 2, -bodyH + 10, 2, 0, Math.PI * 2);
  ctx.fill();

  const tailWag = Math.sin(time * 8 + (grounded && Math.abs(vel.x) > 0.5 ? animFrame * 2 : 0)) * 0.3;
  ctx.save();
  ctx.translate(-bodyW / 2 - 2, -bodyH + 14);
  ctx.rotate(-0.8 + tailWag);
  ctx.fillStyle = '#E87A22';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.ellipse(0, 10, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (wallSliding) {
    ctx.fillStyle = '#C06A18';
    ctx.fillRect(4, -4, 4, 6);
    ctx.fillRect(-6, -8, 4, 6);
  } else if (grounded && Math.abs(vel.x) > 0.5) {
    const legAngle = Math.sin(animFrame * 0.8) * 0.5;
    ctx.fillStyle = '#C06A18';
    ctx.save();
    ctx.translate(4, 0);
    ctx.rotate(legAngle);
    ctx.fillRect(-2, -2, 4, 6);
    ctx.restore();
    ctx.save();
    ctx.translate(-4, 0);
    ctx.rotate(-legAngle);
    ctx.fillRect(-2, -2, 4, 6);
    ctx.restore();
  } else if (!grounded) {
    ctx.fillStyle = '#C06A18';
    ctx.fillRect(2, -2, 4, 5);
    ctx.fillRect(-6, -2, 4, 5);
  }

  if (hasDoubleJump) {
    const sparkle = Math.sin(time * 6) * 0.4 + 0.6;
    ctx.globalAlpha = sparkle * 0.5;
    ctx.fillStyle = '#88DDFF';
    ctx.beginPath();
    ctx.arc(0, -bodyH - 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy, time: number) {
  if (!e.active) return;

  if (e.deathTimer > 0) {
    ctx.globalAlpha = Math.max(0, 1 - e.deathTimer * 3);
    ctx.save();
    ctx.translate(e.pos.x + e.width / 2, e.pos.y + e.height / 2);
    ctx.scale(1 + e.deathTimer * 2, 1 + e.deathTimer * 2);
    ctx.translate(-(e.pos.x + e.width / 2), -(e.pos.y + e.height / 2));
  }

  const cx = e.pos.x + e.width / 2;
  const cy = e.pos.y + e.height / 2;

  if (e.type === 'slime') {
    const squish = 1 + Math.sin(time * 4 + e.sineTimer) * 0.08;
    ctx.save();
    ctx.translate(cx, e.pos.y + e.height);
    ctx.scale(squish, 1 / squish);
    ctx.fillStyle = '#44CC44';
    ctx.beginPath();
    ctx.ellipse(0, -e.height / 2, e.width / 2, e.height / 2, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#66EE66';
    ctx.beginPath();
    ctx.ellipse(0, -e.height / 2, e.width / 2 - 3, e.height / 2 - 3, 0, Math.PI, Math.PI * 1.7);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(-4 * e.facing, -e.height / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(-3 * e.facing, -e.height / 2 - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (e.type === 'bat') {
    const wingAngle = Math.sin(time * 10 + e.sineTimer) * 0.6;
    ctx.fillStyle = '#6644AA';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cx - 8, cy - 2);
    ctx.rotate(-wingAngle);
    ctx.fillStyle = '#7755BB';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 4, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(cx + 8, cy - 2);
    ctx.rotate(wingAngle);
    ctx.fillStyle = '#7755BB';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 2, 0, Math.PI * 2);
    ctx.arc(cx + 3, cy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.type === 'chaser') {
    const pulse = 1 + Math.sin(time * 6) * 0.05;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(e.facing, 1);
    ctx.scale(pulse, pulse);

    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.width / 2, e.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FF4444';
    ctx.beginPath();
    ctx.ellipse(-2, -3, e.width / 2 - 4, e.height / 2 - 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFF00';
    ctx.beginPath();
    ctx.arc(4, -3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(5, -3, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#CC2222';
    ctx.beginPath();
    ctx.moveTo(-e.width / 2 + 2, -e.height / 2 + 2);
    ctx.lineTo(-e.width / 2 + 5, -e.height / 2 - 6);
    ctx.lineTo(-e.width / 2 + 8, -e.height / 2 + 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(e.width / 2 - 8, -e.height / 2 + 2);
    ctx.lineTo(e.width / 2 - 5, -e.height / 2 - 6);
    ctx.lineTo(e.width / 2 - 2, -e.height / 2 + 2);
    ctx.fill();

    ctx.restore();
  } else {
    const bob = Math.sin(time * 3) * 2;
    ctx.fillStyle = '#8866AA';
    ctx.beginPath();
    ctx.ellipse(cx, e.pos.y + e.height + bob, e.width / 2, e.height / 2, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#CC4444';
    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI + (i / 3) * Math.PI;
      const sx = cx + Math.cos(angle) * (e.width / 2 - 4);
      const sy = e.pos.y + e.height - Math.sin(angle) * (e.height / 2 - 2) + bob;
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy);
      ctx.lineTo(sx, sy - 8);
      ctx.lineTo(sx + 3, sy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(cx - 4, cy + bob, 3, 0, Math.PI * 2);
    ctx.arc(cx + 4, cy + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(cx - 3, cy + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, cy + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (e.deathTimer > 0) {
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export function renderParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const alpha = p.life / p.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.pos.x, p.pos.y, p.size * alpha, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function renderHUD(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, 8, 8, 200, 36, 8);
  ctx.fill();

  ctx.fillStyle = '#FF4466';
  ctx.font = 'bold 14px monospace';
  for (let i = 0; i < state.player.lives; i++) {
    const hx = 20 + i * 22;
    ctx.beginPath();
    ctx.moveTo(hx, 30);
    ctx.bezierCurveTo(hx - 8, 18, hx - 4, 12, hx, 18);
    ctx.bezierCurveTo(hx + 4, 12, hx + 8, 18, hx, 30);
    ctx.fill();
  }

  ctx.fillStyle = '#FF4466';
  ctx.beginPath();
  ctx.arc(120, 24, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`${state.berries}`, 130, 28);

  if (state.player.hasDoubleJump) {
    ctx.fillStyle = 'rgba(136, 221, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(180, 24, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state.player.doubleJumpUsed ? '#555' : '#88DDFF';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('2x', 180, 28);
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, CANVAS_WIDTH - 130, 8, 122, 36, 8);
  ctx.fill();
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.score}`, CANVAS_WIDTH - 18, 32);
  ctx.textAlign = 'left';

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, CANVAS_WIDTH / 2 - 80, 8, 160, 24, 6);
  ctx.fill();

  const levelName = LEVELS[state.currentLevel]?.name || '';
  ctx.fillStyle = '#FFF';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.currentLevel + 1}/${state.totalLevels} - ${levelName}`, CANVAS_WIDTH / 2, 24);
  ctx.textAlign = 'left';

  const timeRemaining = Math.max(0, state.timeLimit - state.time);
  const timeColor = timeRemaining < 15 ? '#FF4444' : timeRemaining < 30 ? '#FFAA44' : '#44FF44';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, CANVAS_WIDTH / 2 - 40, 36, 80, 20, 5);
  ctx.fill();
  ctx.fillStyle = timeColor;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  const mins = Math.floor(timeRemaining / 60);
  const secs = Math.floor(timeRemaining % 60);
  ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, CANVAS_WIDTH / 2, 50);
  ctx.textAlign = 'left';

  if (state.comboCount > 1 && state.comboTimer > 0) {
    const comboAlpha = Math.min(1, state.comboTimer);
    ctx.globalAlpha = comboAlpha;
    const comboScale = 1 + (state.comboCount - 1) * 0.1;
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.round(18 * comboScale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`COMBO x${state.comboCount}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}
