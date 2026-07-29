import Phaser from 'phaser';
import { computeHitResult, initializeBallFlight, stepBallFlight, type FlightSnapshot } from './physics';
import { evaluateOutcome, toDisplayDistance } from './scoring';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number; rot?: number; rotV?: number;
}

interface CrowdFan {
  x: number; y: number; row: number;
  jersey: string; skin: string; hat: string;
  wavePhase: number; waveSpeed: number;
  isWaving: boolean; waveTimer: number;
}

interface DerbyState {
  pitchClockMs: number;
  pitchTravelMs: number;
  chargeStartMs: number | null;
  chargePower: number;
  swingResolved: boolean;
  flight: FlightSnapshot | null;
  launchQualityBonus: number;
  ballInFlight: boolean;
  ballLanded: boolean;
  score: number;
  round: number;
  batAngle: number;
  swingAnimating: boolean;
  swingPhase: number;
  contactFlash: number;
  pitcherWindup: number;
  groundBallX: number | null;
  resultText: string;
  resultColor: string;
  resultAlpha: number;
  homeRunBanner: number;
  crowdCheer: number;
  fans: CrowdFan[];
  particles: Particle[];
  ballTrail: Array<{ x: number; y: number; a: number }>;
  cameraShake: number;
}

const W = 960;
const H = 640;

const BAT_ORIGIN_X = 310;
const BAT_ORIGIN_Y = 468;
const PLATE_X = 295;
const PLATE_Y = 510;
const MOUND_X = 450;
const MOUND_Y = 388;

const JERSEYS = ['#c41e3a','#003087','#1b5e20','#7b1fa2','#e65100','#006064','#880e4f','#1a237e','#33691e','#bf360c'];
const SKINS   = ['#fddbb4','#e8b88a','#c68642','#a0522d','#7d4427','#5c2e0e','#f5cba7','#d4956a'];
const HATS    = ['#1a1a1a','#c41e3a','#003087','#ffffff','#2e7d32','#4a0080','#b71c1c'];

export class HomeRunDerbyScene extends Phaser.Scene {
  private oc?: HTMLCanvasElement;
  private cx?: CanvasRenderingContext2D;
  private state!: DerbyState;

  constructor() { super('HomeRunDerbyScene'); }

  create() {
    this.oc = document.createElement('canvas');
    this.oc.width = W; this.oc.height = H;
    Object.assign(this.oc.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '10',
    });
    this.game.canvas.parentElement?.appendChild(this.oc);
    this.cx = this.oc.getContext('2d') ?? undefined;

    const fans: CrowdFan[] = [];
    const rowConfig = [
      { count: 52, baseY: 88,  xL: 80,  xR: 880 },
      { count: 60, baseY: 112, xL: 68,  xR: 892 },
      { count: 68, baseY: 136, xL: 55,  xR: 905 },
      { count: 76, baseY: 160, xL: 42,  xR: 918 },
    ];
    rowConfig.forEach((row, ri) => {
      for (let i = 0; i < row.count; i++) {
        const t = i / (row.count - 1);
        fans.push({
          x: row.xL + t * (row.xR - row.xL),
          y: row.baseY + (Math.random() - 0.5) * 6,
          row: ri,
          jersey: JERSEYS[Math.floor(Math.random() * JERSEYS.length)],
          skin:   SKINS[Math.floor(Math.random() * SKINS.length)],
          hat:    HATS[Math.floor(Math.random() * HATS.length)],
          wavePhase: Math.random() * Math.PI * 2,
          waveSpeed: 0.8 + Math.random() * 2,
          isWaving: false, waveTimer: 0,
        });
      }
    });

    this.state = {
      pitchClockMs: 0, pitchTravelMs: 1500,
      chargeStartMs: null, chargePower: 0,
      swingResolved: false, flight: null, launchQualityBonus: 0,
      ballInFlight: false, ballLanded: false,
      score: 0, round: 1,
      batAngle: 0.55, swingAnimating: false, swingPhase: 0,
      contactFlash: 0, pitcherWindup: 0,
      groundBallX: null,
      resultText: '', resultColor: '#fff', resultAlpha: 0,
      homeRunBanner: 0, crowdCheer: 0,
      fans, particles: [], ballTrail: [],
      cameraShake: 0,
    };

    this.input.keyboard?.on('keydown-SPACE', this.beginCharge, this);
    this.input.keyboard?.on('keyup-SPACE', this.releaseSwing, this);
    this.input.on('pointerdown', this.beginCharge, this);
    this.input.on('pointerup', this.releaseSwing, this);

    this.resetPitch();
  }

  update(_t: number, dt: number) {
    const s = this.state;
    s.pitchClockMs += dt;
    s.pitcherWindup += dt * 0.002;
    s.crowdCheer = Math.max(0, s.crowdCheer - dt * 0.0005);
    s.contactFlash = Math.max(0, s.contactFlash - dt * 0.005);
    s.homeRunBanner = Math.max(0, s.homeRunBanner - dt * 0.0006);
    s.resultAlpha = Math.max(0, s.resultAlpha - dt * 0.0008);
    s.cameraShake = Math.max(0, s.cameraShake - dt * 0.006);

    if (s.swingAnimating) {
      s.swingPhase = Math.min(1, s.swingPhase + dt * 0.012);
      s.batAngle = Phaser.Math.Linear(0.55, -1.1, easeOut(Math.min(s.swingPhase * 1.6, 1)));
    }

    this.tickFans(dt);
    this.tickParticles(dt);

    if (!s.ballInFlight && !s.swingResolved) {
      const prog = s.pitchClockMs / s.pitchTravelMs;
      if (prog >= 1) this.miss('No swing');
    }

    if (s.ballInFlight) this.tickFlight(dt / 1000);

    this.render();
  }

  private tickFans(dt: number) {
    const cheer = this.state.crowdCheer;
    this.state.fans.forEach(f => {
      f.wavePhase += dt * 0.001 * f.waveSpeed * (1 + cheer * 4);
      if (f.isWaving) {
        f.waveTimer -= dt;
        if (f.waveTimer <= 0) f.isWaving = false;
      } else if (cheer > 0.3 && Math.random() < cheer * 0.015) {
        f.isWaving = true;
        f.waveTimer = 400 + Math.random() * 800;
      }
    });
  }

  private tickParticles(dt: number) {
    this.state.particles = this.state.particles.filter(p => {
      p.x += p.vx * dt * 0.055;
      p.y += p.vy * dt * 0.055;
      p.vy += 0.12;
      p.life -= dt * 0.0012;
      if (p.rot !== undefined && p.rotV !== undefined) p.rot += p.rotV * dt * 0.04;
      return p.life > 0;
    });
  }

  private tickFlight(dts: number) {
    const s = this.state;
    if (!s.flight) return;
    s.flight = stepBallFlight(s.flight, dts * 1.7);
    const { bx, by } = this.flightToScreen(s.flight);
    s.ballTrail.push({ x: bx, y: by, a: 0.6 });
    if (s.ballTrail.length > 14) s.ballTrail.shift();
    s.ballTrail.forEach(t => { t.a -= 0.04; });

    if (s.flight.z <= 0) this.landBall();
  }

  private flightToScreen(f: FlightSnapshot) {
    const progress = Math.min(1, f.x / 140);
    const bx = PLATE_X + progress * (W * 0.52 - PLATE_X);
    const by = PLATE_Y - 20 - f.z * 3.8 - progress * (PLATE_Y - 230);
    return { bx, by };
  }

  private landBall() {
    const s = this.state;
    if (!s.flight) return;
    const dist = toDisplayDistance(s.flight.x * 3.05);
    const out = evaluateOutcome(dist, s.launchQualityBonus);
    s.score += out.score;
    s.ballTrail = [];
    const { bx, by } = this.flightToScreen(s.flight);

    if (out.isHomeRun) {
      this.cameras.main.shake(300, 0.012);
      s.cameraShake = 1;
      s.homeRunBanner = 1;
      s.crowdCheer = 1;
      s.fans.forEach(f => { f.isWaving = true; f.waveTimer = 3000; });
      this.burst(bx, by, ['#fbbf24','#fff','#f43f5e','#34d399','#38bdf8'], 55, 10);
      this.confetti(bx, by);
      s.resultText = `HOME RUN! ${out.distanceFeet} ft  +${out.score}`;
      s.resultColor = '#fbbf24';
      s.resultAlpha = 3;
    } else {
      this.burst(bx, by, ['#94a3b8','#cbd5e1'], 12, 4);
      s.resultText = `${out.distanceFeet} ft  +${out.score}`;
      s.resultColor = '#e2e8f0';
      s.resultAlpha = 2;
    }
    this.nextRound();
  }

  private burst(x: number, y: number, colors: string[], n: number, spd: number) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i / n) + (Math.random() - 0.5) * 0.6;
      const sp = spd * (0.5 + Math.random() * 0.9);
      this.state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - spd * 0.3,
        life: 1, maxLife: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 5,
      });
    }
  }

  private confetti(x: number, y: number) {
    const cols = ['#fbbf24','#f43f5e','#22d3ee','#a3e635','#e879f9','#fff','#fb923c'];
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 9;
      this.state.particles.push({
        x: x + (Math.random() - 0.5) * 80,
        y: y + (Math.random() - 0.5) * 40,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 7,
        life: 2, maxLife: 2,
        color: cols[Math.floor(Math.random() * cols.length)],
        size: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 6,
      });
    }
  }

  private render() {
    const ctx = this.cx;
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    this.drawSky(ctx);
    this.drawUpperStands(ctx);
    this.drawFans(ctx);
    this.drawFenceWall(ctx);
    this.drawField(ctx);
    this.drawFieldLines(ctx);
    this.drawDirt(ctx);
    this.drawPitcher(ctx);
    this.drawBatter(ctx);
    this.drawBallTrail(ctx);
    this.drawBall(ctx);
    this.drawParticles(ctx);
    this.drawHUD(ctx);
    if (this.state.contactFlash > 0) {
      ctx.fillStyle = `rgba(255,245,150,${this.state.contactFlash * 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.state.homeRunBanner > 0) this.drawHRBanner(ctx);
    if (this.state.resultAlpha > 0) this.drawResult(ctx);
  }

  private drawSky(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0,   '#0a1a3e');
    g.addColorStop(0.4, '#1a4a8c');
    g.addColorStop(1,   '#4a9fd4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 260);

    const sunX = 760; const sunY = 55;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 90);
    sunGlow.addColorStop(0, 'rgba(255,230,100,0.35)');
    sunGlow.addColorStop(1, 'rgba(255,200,50,0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath(); ctx.arc(sunX, sunY, 90, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ffee88';
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff8cc';
    ctx.beginPath(); ctx.arc(sunX - 4, sunY - 4, 8, 0, Math.PI * 2); ctx.fill();

    const clouds = [[110,50,70,22],[260,35,90,26],[440,45,60,18],[580,30,80,24],[820,58,55,16]];
    clouds.forEach(([cx2,cy2,rx,ry]) => {
      const cg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, rx);
      cg.addColorStop(0, 'rgba(255,255,255,0.95)');
      cg.addColorStop(1, 'rgba(220,235,255,0.3)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.ellipse(cx2, cy2, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.ellipse(cx2 - rx*0.3, cy2 - ry*0.3, rx*0.55, ry*0.6, 0, 0, Math.PI * 2); ctx.fill();
    });
  }

  private drawUpperStands(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 60, 0, 190);
    g.addColorStop(0, '#0d1c3e');
    g.addColorStop(1, '#162050');
    ctx.fillStyle = g; ctx.fillRect(50, 60, 860, 130);

    for (let row = 0; row < 6; row++) {
      const y = 68 + row * 20;
      ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,200,0.04)';
      ctx.fillRect(50, y, 860, 20);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let row = 0; row < 7; row++) {
      ctx.beginPath();
      ctx.moveTo(50, 68 + row * 20);
      ctx.lineTo(910, 68 + row * 20);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(50, 60, 3, 130);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(907, 60, 3, 130);

    const jx = W/2 - 90; const jy = 68;
    const jg = ctx.createLinearGradient(jx, jy, jx, jy+55);
    jg.addColorStop(0, '#111'); jg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = jg; ctx.fillRect(jx, jy, 180, 55);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.strokeRect(jx, jy, 180, 55);
    ctx.fillStyle = '#111'; ctx.fillRect(jx+3, jy+3, 174, 49);

    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24'; ctx.fillText('VELVET PARK', W/2, jy+17);
    ctx.fillStyle = '#aaa'; ctx.font = '9px monospace'; ctx.fillText('HOME RUN DERBY', W/2, jy+30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace';
    ctx.fillText(`${this.state.score} PTS`, W/2, jy+47);
    ctx.textAlign = 'left';

    const scoreboardLights = ['#f43f5e','#fbbf24','#22c55e'];
    for (let i = 0; i < 12; i++) {
      const lx = jx - 14 + i * (180+28) / 12;
      ctx.fillStyle = scoreboardLights[i % scoreboardLights.length];
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.003 + i) * 0.3;
      ctx.beginPath(); ctx.arc(lx, jy + 2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawFans(ctx: CanvasRenderingContext2D) {
    const scales = [0.65, 0.75, 0.85, 1.0];
    this.state.fans.forEach(f => {
      const sc = scales[f.row] ?? 1;
      const size = 9 * sc;
      const wave = f.isWaving
        ? -Math.abs(Math.sin(f.wavePhase)) * 14 * sc
        : Math.sin(f.wavePhase * 0.3) * 2 * sc;

      ctx.fillStyle = f.jersey;
      ctx.fillRect(f.x - size * 0.55, f.y, size * 1.1, size * 1.5);

      ctx.fillStyle = f.skin;
      ctx.beginPath(); ctx.arc(f.x, f.y - size * 0.1, size * 0.6, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = f.hat;
      ctx.beginPath();
      ctx.arc(f.x, f.y - size * 0.55, size * 0.65, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(f.x - size * 0.75, f.y - size * 0.6, size * 1.5, size * 0.2);

      ctx.strokeStyle = f.jersey; ctx.lineWidth = size * 0.35;
      ctx.beginPath(); ctx.moveTo(f.x - size*0.55, f.y + size*0.35); ctx.lineTo(f.x - size, f.y + size*0.35 + wave); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(f.x + size*0.55, f.y + size*0.35); ctx.lineTo(f.x + size, f.y + size*0.35 + wave); ctx.stroke();
    });
  }

  private drawFenceWall(ctx: CanvasRenderingContext2D) {
    const fy = 192;
    const fg = ctx.createLinearGradient(0, fy, 0, fy+30);
    fg.addColorStop(0, '#2a5c1a'); fg.addColorStop(1, '#1a3c0e');
    ctx.fillStyle = fg; ctx.fillRect(50, fy, 860, 30);

    ctx.fillStyle = '#fbbf24'; ctx.fillRect(50, fy, 860, 4);

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
    for (let x = 70; x < 910; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, fy+4); ctx.lineTo(x, fy+30); ctx.stroke();
    }

    const sx = W/2 - 70;
    ctx.fillStyle = '#0a1628'; ctx.fillRect(sx, fy+5, 140, 20);
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(sx, fy+5, 140, 20);
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fbbf24'; ctx.fillText('HOME RUN DERBY  •  370 FT', W/2, fy+18);
    ctx.textAlign = 'left';

    ctx.font = 'bold 7px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('410', W/2, fy-4);
    ctx.fillText('330', 200, fy-4);
    ctx.fillText('330', 760, fy-4);
    ctx.textAlign = 'left';
  }

  private drawField(ctx: CanvasRenderingContext2D) {
    const g = ctx.createLinearGradient(0, 220, 0, H);
    g.addColorStop(0, '#2a6b2a'); g.addColorStop(0.3, '#33803a'); g.addColorStop(1, '#1e5c22');
    ctx.fillStyle = g; ctx.fillRect(0, 220, W, H - 220);

    for (let i = 0; i < 7; i++) {
      const stripe = i % 2 === 0 ? 'rgba(0,0,0,0.07)' : 'rgba(60,150,60,0.10)';
      ctx.fillStyle = stripe; ctx.fillRect(0, 220 + i * 60, W, 60);
    }

    const highW = ctx.createRadialGradient(W/2, 440, 60, W/2, 440, 320);
    highW.addColorStop(0, 'rgba(200,255,200,0.06)');
    highW.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = highW; ctx.fillRect(0, 220, W, H - 220);
  }

  private drawFieldLines(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(PLATE_X, PLATE_Y + 15);
    ctx.lineTo(80, 222); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PLATE_X, PLATE_Y + 15);
    ctx.lineTo(880, 222); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    for (let t = 0.25; t < 1; t += 0.25) {
      const lx1 = Phaser.Math.Linear(PLATE_X, 80, t);
      const rx1 = Phaser.Math.Linear(PLATE_X, 880, t);
      const y1 = Phaser.Math.Linear(PLATE_Y+15, 222, t);
      ctx.beginPath(); ctx.moveTo(lx1, y1); ctx.lineTo(rx1, y1); ctx.stroke();
    }
  }

  private drawDirt(ctx: CanvasRenderingContext2D) {
    const dirtColor = '#c8955a';
    const dirtDark = '#a07040';

    const moundGrad = ctx.createRadialGradient(MOUND_X, MOUND_Y+4, 0, MOUND_X, MOUND_Y+4, 38);
    moundGrad.addColorStop(0, '#d4a870'); moundGrad.addColorStop(1, dirtDark);
    ctx.fillStyle = moundGrad;
    ctx.beginPath(); ctx.ellipse(MOUND_X, MOUND_Y+8, 38, 15, 0, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = dirtDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(MOUND_X, MOUND_Y+8, 38, 15, 0, 0, Math.PI*2); ctx.stroke();

    const plateArea = ctx.createRadialGradient(PLATE_X, PLATE_Y+6, 0, PLATE_X, PLATE_Y+6, 55);
    plateArea.addColorStop(0, '#d4a870'); plateArea.addColorStop(0.7, dirtColor); plateArea.addColorStop(1, 'rgba(200,149,90,0)');
    ctx.fillStyle = plateArea;
    ctx.beginPath(); ctx.ellipse(PLATE_X, PLATE_Y+6, 55, 22, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.save(); ctx.translate(PLATE_X, PLATE_Y+8);
    ctx.beginPath();
    ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(14, 2);
    ctx.lineTo(0, 10); ctx.lineTo(-14, 2); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(PLATE_X, PLATE_Y+6, 55, 22, 0, 0, Math.PI*2); ctx.stroke();
  }

  private drawPitcher(ctx: CanvasRenderingContext2D) {
    const px = MOUND_X; const py = MOUND_Y - 8;
    const sc = 0.62;
    const prog = Phaser.Math.Clamp(this.state.pitchClockMs / (this.state.pitchTravelMs * 0.12), 0, 1);
    const windup = Math.sin(this.state.pitcherWindup * 2) * 0.15;
    const throwEx = prog * 0.8;

    ctx.save();
    ctx.translate(px, py);
    ctx.scale(sc, sc);

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(0, 52, 14, 5, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#cc2200';
    ctx.save(); ctx.translate(0, 18);
    ctx.beginPath(); ctx.moveTo(-7, -18); ctx.lineTo(7, -18); ctx.lineTo(8, 16); ctx.lineTo(-8, 16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(7, -5); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-7, 36, 6, 20); ctx.fillRect(1, 36, 6, 20);

    ctx.strokeStyle = '#cc2200'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(7, 4);
    ctx.quadraticCurveTo(20 + throwEx*25, -20 - throwEx*15, 18 + throwEx*30, -10 + throwEx*8);
    ctx.stroke();
    ctx.strokeStyle = '#cc2200';
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.quadraticCurveTo(-18 + windup*8, 8 + windup*10, -14, 25);
    ctx.stroke();

    const headGrad = ctx.createRadialGradient(-2, -16, 0, 0, -12, 12);
    headGrad.addColorStop(0, '#f5cba7'); headGrad.addColorStop(1, '#d4956a');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.arc(0, -12, 12, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#cc2200';
    ctx.beginPath(); ctx.arc(0, -20, 11, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillRect(-12, -22, 24, 4);
    ctx.fillStyle = '#aa1800';
    ctx.fillRect(-11, -19, 5, 3);

    ctx.restore();
  }

  private drawBatter(ctx: CanvasRenderingContext2D) {
    const bx = PLATE_X - 28; const by = PLATE_Y - 80;
    const isCharging = this.state.chargeStartMs !== null;
    const chargePct = isCharging
      ? Phaser.Math.Clamp((this.time.now - this.state.chargeStartMs!) / 900, 0, 1) : 0;
    const lean = isCharging ? chargePct * 0.12 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(bx+8, by+84, 16, 6, 0, 0, Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(bx, by + 40); ctx.rotate(lean);
    ctx.fillStyle = '#002b7f';
    ctx.beginPath(); ctx.moveTo(-10, -32); ctx.lineTo(10, -32);
    ctx.lineTo(11, 28); ctx.lineTo(-11, 28); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    for (let stripe = -20; stripe < 30; stripe += 14) {
      ctx.beginPath(); ctx.moveTo(-10, stripe); ctx.lineTo(10, stripe); ctx.stroke();
    }
    ctx.fillStyle = '#001a55'; ctx.fillRect(-9, -32, 18, 8);
    ctx.restore();

    ctx.fillStyle = '#001a55';
    ctx.fillRect(bx-8, by+68, 7, 28); ctx.fillRect(bx+1, by+68, 7, 28);
    ctx.fillStyle = '#002b7f'; ctx.fillRect(bx-8, by+82, 7, 14); ctx.fillRect(bx+1, by+82, 7, 14);

    const kneePad = '#1a3a9f';
    ctx.fillStyle = kneePad;
    ctx.beginPath(); ctx.ellipse(bx-5, by+74, 6, 5, 0.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx+5, by+74, 6, 5, -0.3, 0, Math.PI*2); ctx.fill();

    ctx.save();
    ctx.translate(bx + 12, by + 34);
    ctx.rotate(this.state.batAngle + (isCharging ? chargePct * 0.25 : 0));

    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
    const batH = 52;
    const btg = ctx.createLinearGradient(-4, -batH, 4, -batH);
    btg.addColorStop(0, '#6b3a1a'); btg.addColorStop(0.4, '#c89660'); btg.addColorStop(1, '#5a2e10');
    ctx.fillStyle = btg;
    ctx.beginPath();
    ctx.moveTo(-2.5, 12); ctx.quadraticCurveTo(-3, -8, -4, -batH);
    ctx.lineTo(4, -batH); ctx.quadraticCurveTo(3, -8, 2.5, 12);
    ctx.closePath(); ctx.fill();

    const barrelGrad = ctx.createRadialGradient(-2, -batH, 0, 0, -batH, 10);
    barrelGrad.addColorStop(0, '#d4a870'); barrelGrad.addColorStop(1, '#7a4020');
    ctx.fillStyle = barrelGrad;
    ctx.beginPath(); ctx.ellipse(0, -batH, 10, 10, 0, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#f0dbb8';
    ctx.beginPath(); ctx.ellipse(0, 12, 5, 6, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#333'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI*2); ctx.fillStyle = '#222'; ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    const armCol = '#f5cba7'; const armStroke = '#002b7f';
    ctx.strokeStyle = armStroke; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx+10, by+8);
    ctx.quadraticCurveTo(bx+26, by+2, bx+20, by+26);
    ctx.stroke();
    ctx.strokeStyle = armCol; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx+10, by+8);
    ctx.quadraticCurveTo(bx+26, by+2, bx+20, by+26);
    ctx.stroke();

    ctx.strokeStyle = armStroke; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx-10, by+8);
    ctx.quadraticCurveTo(bx-22, by+18, bx-14, by+30);
    ctx.stroke();
    ctx.strokeStyle = armCol; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bx-10, by+8);
    ctx.quadraticCurveTo(bx-22, by+18, bx-14, by+30);
    ctx.stroke();

    const headGrad = ctx.createRadialGradient(bx-3, by-12, 0, bx, by-8, 14);
    headGrad.addColorStop(0, '#f5cba7'); headGrad.addColorStop(1, '#d4956a');
    ctx.fillStyle = headGrad;
    ctx.beginPath(); ctx.arc(bx, by-8, 14, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#002b7f';
    ctx.beginPath(); ctx.arc(bx, by-17, 13, Math.PI, Math.PI*2); ctx.fill();
    ctx.fillRect(bx-14, by-19, 28, 5);
    ctx.fillStyle = '#001a55'; ctx.fillRect(bx-3, by-20, 6, 5);

    const earGrad = ctx.createRadialGradient(bx+12, by-7, 0, bx+12, by-7, 5);
    earGrad.addColorStop(0, '#f5cba7'); earGrad.addColorStop(1, '#d4956a');
    ctx.fillStyle = earGrad;
    ctx.beginPath(); ctx.arc(bx+13, by-7, 4, 0, Math.PI*2); ctx.fill();

    if (isCharging && chargePct > 0.05) {
      ctx.save();
      const glowR = 25 + chargePct * 35;
      const glowCol = chargePct > 0.8 ? 'rgba(255,60,60,' : chargePct > 0.5 ? 'rgba(255,180,0,' : 'rgba(80,200,80,';
      const gg = ctx.createRadialGradient(bx+12, by+20, 0, bx+12, by+20, glowR);
      gg.addColorStop(0, glowCol + (0.45 * chargePct) + ')');
      gg.addColorStop(1, glowCol + '0)');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.arc(bx+12, by+20, glowR, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
  }

  private drawBallTrail(ctx: CanvasRenderingContext2D) {
    this.state.ballTrail.forEach((t, i) => {
      const r = 2 + (i / this.state.ballTrail.length) * 4;
      ctx.globalAlpha = Math.max(0, t.a * (i / this.state.ballTrail.length));
      ctx.fillStyle = '#fffde7';
      ctx.beginPath(); ctx.arc(t.x, t.y, r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private drawBall(ctx: CanvasRenderingContext2D) {
    const s = this.state;
    if (s.ballInFlight && s.flight) {
      const { bx, by } = this.flightToScreen(s.flight);
      const ht = Math.max(0, PLATE_Y - by);
      const ballR = Math.max(5, 11 - ht * 0.015);
      const shadowR = Math.max(2, 10 - ht * 0.04);
      const shadowA = Math.max(0.08, 0.5 - ht * 0.002);

      ctx.fillStyle = `rgba(0,0,0,${shadowA})`;
      ctx.beginPath(); ctx.ellipse(bx, PLATE_Y+4, shadowR, shadowR * 0.3, 0, 0, Math.PI*2); ctx.fill();

      const bg = ctx.createRadialGradient(bx - ballR*0.3, by - ballR*0.3, 0, bx, by, ballR);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.35, '#f5f0e8'); bg.addColorStop(1, '#d8ccb8');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by, ballR, 0, Math.PI*2); ctx.fill();

      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx + ballR*0.25, by, ballR*0.72, -0.45, 0.45); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - ballR*0.25, by, ballR*0.72, Math.PI-0.45, Math.PI+0.45); ctx.stroke();

    } else if (!s.swingResolved) {
      const prog = Phaser.Math.Clamp(s.pitchClockMs / s.pitchTravelMs, 0, 1);
      const bx = Phaser.Math.Linear(MOUND_X, PLATE_X + 15, prog);
      const arc = Math.sin(prog * Math.PI) * 10;
      const by2 = Phaser.Math.Linear(MOUND_Y - 16, PLATE_Y - 32, prog) - arc;
      const sc = 0.42 + prog * 0.68;
      const ballR = 10 * sc;

      ctx.fillStyle = `rgba(0,0,0,${0.15 * sc})`;
      ctx.beginPath(); ctx.ellipse(bx, PLATE_Y+2, 7*sc, 2.5*sc, 0, 0, Math.PI*2); ctx.fill();

      const bg2 = ctx.createRadialGradient(bx - ballR*0.3, by2 - ballR*0.3, 0, bx, by2, ballR);
      bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.4, '#f5f0e8'); bg2.addColorStop(1, '#d8ccb8');
      ctx.fillStyle = bg2;
      ctx.beginPath(); ctx.arc(bx, by2, ballR, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(bx + ballR*0.25, by2, ballR*0.7, -0.45, 0.45); ctx.stroke();
      ctx.beginPath(); ctx.arc(bx - ballR*0.25, by2, ballR*0.7, Math.PI-0.45, Math.PI+0.45); ctx.stroke();

    } else if (s.groundBallX !== null) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(s.groundBallX, PLATE_Y+8, 9, 3.5, 0, 0, Math.PI*2); ctx.fill();
      const bg3 = ctx.createRadialGradient(s.groundBallX-2, PLATE_Y+1, 0, s.groundBallX, PLATE_Y+4, 8);
      bg3.addColorStop(0, '#fff'); bg3.addColorStop(1, '#d8ccb8');
      ctx.fillStyle = bg3;
      ctx.beginPath(); ctx.arc(s.groundBallX, PLATE_Y+4, 8, 0, Math.PI*2); ctx.fill();
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D) {
    this.state.particles.forEach(p => {
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.rot !== undefined) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size/2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI*2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, 18, 18, 200, 110, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    roundRect(ctx, 18, 18, 200, 110, 10); ctx.stroke();

    ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 32px monospace';
    ctx.fillText(`${this.state.score}`, 34, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace';
    ctx.fillText('SCORE', 34, 76);
    ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '14px monospace';
    ctx.fillText(`ROUND  ${this.state.round}`, 34, 100);
    ctx.fillText(`HIGH: ${Math.max(this.state.score, 0)}`, 130, 100);

    const isCharging = this.state.chargeStartMs !== null;
    const cp = isCharging
      ? Phaser.Math.Clamp((this.time.now - this.state.chargeStartMs!) / 900, 0, 1) : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, 18, 140, 200, 65, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    roundRect(ctx, 18, 140, 200, 65, 10); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px monospace';
    ctx.fillText('POWER', 34, 158);

    ctx.fillStyle = 'rgba(255,255,255,0.12)'; roundRect(ctx, 34, 163, 166, 16, 6); ctx.fill();

    if (cp > 0) {
      const pColor = cp > 0.85 ? '#ef4444' : cp > 0.55 ? '#fbbf24' : '#22c55e';
      const pg = ctx.createLinearGradient(34, 0, 34 + 166 * cp, 0);
      pg.addColorStop(0, pColor); pg.addColorStop(0.7, pColor); pg.addColorStop(1, '#fff');
      ctx.fillStyle = pg;
      roundRect(ctx, 34, 163, 166 * cp, 16, 6); ctx.fill();

      if (cp > 0.85) {
        ctx.fillStyle = `rgba(239,68,68,${(Math.sin(Date.now() * 0.015) * 0.3 + 0.3)})`;
        roundRect(ctx, 34, 163, 166 * cp, 16, 6); ctx.fill();
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '10px monospace';
    ctx.fillText(isCharging ? `${Math.round(cp * 100)}%  ${cp > 0.85 ? 'MAX!' : cp > 0.55 ? 'POWER' : 'BUILDING'}` : 'Hold SPACE / Click', 34, 192);

    if (!this.state.ballInFlight && !this.state.swingResolved) {
      const prog = Phaser.Math.Clamp(this.state.pitchClockMs / this.state.pitchTravelMs, 0, 1);
      if (prog > 0.75 && prog < 0.99) {
        const pulse = Math.sin(Date.now() * 0.018) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(251,191,36,${0.18 * pulse})`;
        roundRect(ctx, W-230, 18, 212, 44, 10); ctx.fill();
        ctx.strokeStyle = `rgba(251,191,36,${0.65 * pulse})`;
        ctx.lineWidth = 2; roundRect(ctx, W-230, 18, 212, 44, 10); ctx.stroke();
        ctx.fillStyle = `rgba(251,191,36,${pulse})`;
        ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
        ctx.fillText('SWING NOW!', W-124, 45); ctx.textAlign = 'left';
      }
    }

    ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, W-230, H-44, 220, 34, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '11px monospace';
    ctx.textAlign = 'right'; ctx.fillText('SPACE / Click to swing', W-20, H-22); ctx.textAlign = 'left';

    if (!this.state.ballInFlight && !this.state.swingResolved) {
      const prog = Phaser.Math.Clamp(this.state.pitchClockMs / this.state.pitchTravelMs, 0, 1);
      const trackW = 180; const trackX = W/2 - trackW/2; const trackY = H - 42;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, trackX-6, trackY-6, trackW+12, 20, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(ctx, trackX, trackY, trackW, 8, 3); ctx.fill();

      const zoneStart = 0.75; const zoneEnd = 0.99;
      const zx1 = trackX + zoneStart * trackW; const zx2 = trackX + zoneEnd * trackW;
      ctx.fillStyle = 'rgba(251,191,36,0.3)';
      ctx.fillRect(zx1, trackY, zx2 - zx1, 8);
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1;
      ctx.strokeRect(zx1, trackY, zx2 - zx1, 8);

      const ballIndicX = trackX + prog * trackW;
      const bic = ctx.createRadialGradient(ballIndicX, trackY+4, 0, ballIndicX, trackY+4, 7);
      bic.addColorStop(0, '#ffffff'); bic.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = bic;
      ctx.beginPath(); ctx.arc(ballIndicX, trackY+4, 7, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ballIndicX, trackY+4, 4, 0, Math.PI*2); ctx.fill();
    }
  }

  private drawHRBanner(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.state.homeRunBanner * 2.5);
    const scl = 0.7 + Math.min(0.3, (1 - this.state.homeRunBanner) * 0.5);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(W/2, H/2 - 80); ctx.scale(scl, scl);

    ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    roundRect(ctx, -280, -60, 560, 120, 18); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3;
    roundRect(ctx, -280, -60, 560, 120, 18); ctx.stroke();

    const tg = ctx.createLinearGradient(-280, 0, 280, 0);
    tg.addColorStop(0, '#fbbf24'); tg.addColorStop(0.5, '#ffffff'); tg.addColorStop(1, '#fbbf24');
    ctx.font = 'bold 64px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = tg;
    ctx.fillText('HOME RUN!', 0, 22);
    ctx.shadowBlur = 0;
    ctx.restore(); ctx.textAlign = 'left';
  }

  private drawResult(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.state.resultAlpha);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
    ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = this.state.resultColor;
    ctx.fillText(this.state.resultText, W/2, H/2 + 120);
    ctx.restore(); ctx.textAlign = 'left';
  }

  private beginCharge() {
    const s = this.state;
    if (s.ballInFlight || s.chargeStartMs !== null || s.swingResolved) return;
    s.chargeStartMs = this.time.now;
  }

  private releaseSwing() {
    const s = this.state;
    if (s.ballInFlight || s.chargeStartMs === null || s.swingResolved) return;
    s.chargePower = Phaser.Math.Clamp((this.time.now - s.chargeStartMs) / 900, 0.08, 1);
    s.chargeStartMs = null;
    this.swing();
  }

  private swing() {
    const s = this.state;
    s.swingResolved = true;
    s.swingAnimating = true;
    s.swingPhase = 0;

    const windowMs = s.pitchTravelMs * 0.93;
    const err = s.pitchClockMs - windowMs;
    if (Math.abs(err) > 285) {
      this.time.delayedCall(280, () => this.miss('Swing and miss'));
      return;
    }

    const hit = computeHitResult({ power: s.chargePower, timingErrorMs: err });
    s.launchQualityBonus = hit.qualityLabel === 'Perfect' ? 260 : hit.qualityLabel === 'Good' ? 120 : 40;
    s.flight = initializeBallFlight(hit);
    s.ballInFlight = true;
    s.contactFlash = 1;

    const cols = hit.qualityLabel === 'Perfect' ? ['#fbbf24','#fff','#fcd34d'] :
                  hit.qualityLabel === 'Good'    ? ['#fff','#fca5a5'] : ['#d1d5db'];
    this.burst(PLATE_X+15, PLATE_Y-20, cols, hit.qualityLabel === 'Perfect' ? 20 : 10, 8);

    if (hit.qualityLabel === 'Perfect') {
      this.cameras.main.shake(140, 0.005);
      s.crowdCheer = 0.55;
    }
    s.resultText = `${hit.qualityLabel} contact!`;
    s.resultColor = hit.qualityLabel === 'Perfect' ? '#fbbf24' : hit.qualityLabel === 'Good' ? '#fff' : '#9ca3af';
    s.resultAlpha = 1.5;
  }

  private miss(label: string) {
    const s = this.state;
    s.swingResolved = true;
    s.groundBallX = PLATE_X + 15;
    s.resultText = label;
    s.resultColor = '#f87171';
    s.resultAlpha = 1.8;
    this.nextRound();
  }

  private nextRound() {
    const s = this.state;
    s.ballInFlight = false;
    s.flight = null;
    s.chargePower = 0;
    s.ballTrail = [];
    this.time.delayedCall(1600, () => {
      s.round++;
      s.groundBallX = null;
      this.resetPitch();
    });
  }

  private resetPitch() {
    const s = this.state;
    s.pitchClockMs = 0;
    s.swingResolved = false;
    s.chargeStartMs = null;
    s.swingAnimating = false;
    s.swingPhase = 0;
    s.batAngle = 0.55;
    s.pitcherWindup = 0;
  }

  getScore() { return this.state.score; }
  getRound() { return this.state.round; }

  shutdown() { this.oc?.remove(); (super as any).shutdown?.(); }
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
