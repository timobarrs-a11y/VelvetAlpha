import { useCallback, useEffect, useRef } from 'react';

interface ButtonHoverCanvasProps {
  hoverStyle: string;
  particleColors?: string[];
  previewStyle?: string | null;
}

interface VortexMote {
  id: number;
  angle: number;
  radius: number;
  angularSpeed: number;
  drainSpeed: number;
  color: string;
  size: number;
  alpha: number;
  exiting: boolean;
  exitVx: number;
  exitVy: number;
  exitLife: number;
  cx: number;
  cy: number;
  tailLength: number;
}

interface RippleRing {
  id: number;
  cx: number;
  cy: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
  borderWidth: number;
}

interface AuroraBand {
  id: number;
  cx: number;
  cy: number;
  rw: number;
  rh: number;
  phase: number;
  speed: number;
  hue: number;
  alpha: number;
}

interface SparkBolt {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  angle: number;
  length: number;
  fork?: SparkFork[];
}

interface SparkFork {
  x: number;
  y: number;
  angle: number;
  length: number;
  life: number;
  color: string;
}

interface EmberParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  glow: number;
}

let _mid = 0;
function mid() { return ++_mid; }

const PORTAL_COLORS = ['#f472b6', '#c084fc', '#818cf8', '#60a5fa', '#a5f3fc'];
const RIPPLE_COLORS = ['#60a5fa', '#93c5fd', '#bfdbfe', '#38bdf8'];
const AURORA_HUES   = [0, 30, 60, 100, 150, 190, 220, 260, 300, 340, 10, 170];
const SPARK_COLORS  = ['#ffffff', '#fbbf24', '#f59e0b', '#fcd34d', '#60a5fa', '#f472b6'];
const EMBER_HUES    = [10, 20, 30, 40, 50, 15, 5];

export function ButtonHoverCanvas({ hoverStyle, particleColors, previewStyle }: ButtonHoverCanvasProps) {
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const rafRef            = useRef<number>(0);
  const hoverElRef        = useRef<HTMLElement | null>(null);
  const hoverStartRef     = useRef<number>(0);
  const vortexRef         = useRef<VortexMote[]>([]);
  const rippleRef         = useRef<RippleRing[]>([]);
  const auroraRef         = useRef<AuroraBand[]>([]);
  const sparkRef          = useRef<SparkBolt[]>([]);
  const emberRef          = useRef<EmberParticle[]>([]);
  const hoverStyleRef     = useRef(hoverStyle);
  const previewStyleRef   = useRef<string | null>(previewStyle ?? null);
  const lastSparkRef      = useRef(0);
  const lastRippleRef     = useRef(0);
  const lastEmberRef      = useRef(0);
  const frameRef          = useRef(0);
  const auroraHueRef      = useRef(0);

  const clearAll = () => {
    vortexRef.current  = [];
    rippleRef.current  = [];
    auroraRef.current  = [];
    sparkRef.current   = [];
    emberRef.current   = [];
    hoverElRef.current = null;
  };

  useEffect(() => {
    hoverStyleRef.current = hoverStyle;
    if (hoverStyle === 'none' && !previewStyleRef.current) {
      clearAll();
    }
  }, [hoverStyle]);

  useEffect(() => {
    previewStyleRef.current = previewStyle ?? null;
  }, [previewStyle]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const loopFnRef = useRef<(() => void) | null>(null);

  const startLoop = useCallback(() => {
    if (rafRef.current) return;
    if (loopFnRef.current) {
      rafRef.current = requestAnimationFrame(loopFnRef.current);
    }
  }, []);

  useEffect(() => {
    const onOver = (e: MouseEvent) => {
      const activeStyle = previewStyleRef.current ?? hoverStyleRef.current;
      if (activeStyle === 'none') {
        hoverElRef.current = null;
        return;
      }
      const el = (e.target as HTMLElement).closest('button, a, [data-interactive]') as HTMLElement | null;
      if (el) {
        const prev = hoverElRef.current;
        if (prev !== el) {
          hoverStartRef.current = performance.now();
          vortexRef.current  = [];
          rippleRef.current  = [];
          auroraRef.current  = [];
          sparkRef.current   = [];
          emberRef.current   = [];
          lastRippleRef.current = 0;
          lastSparkRef.current  = 0;
          lastEmberRef.current  = 0;
        }
        hoverElRef.current = el;
        startLoop();
      } else {
        if (hoverElRef.current) {
          vortexRef.current.forEach(m => {
            if (!m.exiting) {
              m.exiting = true;
              m.exitVx  = Math.cos(m.angle) * (3 + Math.random() * 4);
              m.exitVy  = Math.sin(m.angle) * (3 + Math.random() * 4);
              m.exitLife = 1;
            }
          });
        }
        hoverElRef.current = null;
      }
    };
    window.addEventListener('mouseover', onOver);
    return () => window.removeEventListener('mouseover', onOver);
  }, [startLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = particleColors ?? PORTAL_COLORS;

    const loop = () => {
      frameRef.current++;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const style = previewStyleRef.current ?? hoverStyleRef.current;
      const el    = hoverElRef.current;

      const hasParticles =
        vortexRef.current.length > 0 ||
        rippleRef.current.length > 0 ||
        sparkRef.current.length > 0 ||
        emberRef.current.length > 0;

      if (!el && !hasParticles) {
        rafRef.current = 0;
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
      loopFnRef.current = loop;

      if (el) {
        const rect    = el.getBoundingClientRect();
        const cx      = rect.left + rect.width  / 2;
        const cy      = rect.top  + rect.height / 2;
        const elapsed = (performance.now() - hoverStartRef.current) / 1000;
        const now     = performance.now();

        if (style === 'portal') {
          drawPortal(ctx, rect, cx, cy, elapsed, colors);
        } else if (style === 'ripple') {
          drawRipple(ctx, rect, cx, cy, now, elapsed);
        } else if (style === 'aurora') {
          drawAurora(ctx, rect, cx, cy, elapsed);
        } else if (style === 'sparks') {
          drawSparks(ctx, rect, cx, cy, now, colors);
        } else if (style === 'ember') {
          drawEmber(ctx, rect, cx, cy, now, elapsed);
        }
      } else {
        if ((previewStyleRef.current ?? hoverStyleRef.current) === 'portal' && vortexRef.current.length > 0) {
          drawExitingPortal(ctx);
        }
      }
    };

    loopFnRef.current = loop;
    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      loopFnRef.current = null;
    };
  }, [particleColors]);

  function drawPortal(
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    cx: number, cy: number,
    elapsed: number,
    colors: string[],
  ) {
    const chargeRamp = Math.min(1, elapsed / 0.7);
    const rx = rect.left, ry = rect.top, rw = rect.width, rh = rect.height;
    const cornerRadius = 14;
    const spawnRing    = Math.sqrt(rw * rw + rh * rh) * 0.52;
    const MAX_MOTES    = 110;

    const spawnCount = vortexRef.current.length < MAX_MOTES
      ? Math.round(1.2 + chargeRamp * 5.5)
      : 0;

    for (let i = 0; i < spawnCount; i++) {
      const angle        = Math.random() * Math.PI * 2;
      const radiusJitter = spawnRing * (0.85 + Math.random() * 0.30);
      const color        = colors[Math.floor(Math.random() * colors.length)];
      vortexRef.current.push({
        id: mid(), angle, radius: radiusJitter,
        angularSpeed: (0.022 + Math.random() * 0.022) * (Math.random() < 0.5 ? 1 : -1),
        drainSpeed:   0.006 + Math.random() * 0.010,
        color,
        size:   0.7 + Math.random() * 1.1,
        alpha:  0.50 + Math.random() * 0.35,
        exiting: false, exitVx: 0, exitVy: 0, exitLife: 1,
        cx, cy,
        tailLength: 0.12 + Math.random() * 0.18,
      });
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, cornerRadius);
    ctx.clip();

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, spawnRing * 0.55);
    coreGrad.addColorStop(0,   `rgba(0,0,0,${0.18 * chargeRamp})`);
    coreGrad.addColorStop(0.5, `rgba(0,0,0,${0.06 * chargeRamp})`);
    coreGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rx, ry, rw, rh, cornerRadius);
    ctx.clip();

    const alive: VortexMote[] = [];
    for (const m of vortexRef.current) {
      if (m.exiting) {
        m.exitLife -= 0.08;
        if (m.exitLife > 0) {
          const mx = m.cx + Math.cos(m.angle) * m.radius + m.exitVx * (1 - m.exitLife) * 12;
          const my = m.cy + Math.sin(m.angle) * m.radius + m.exitVy * (1 - m.exitLife) * 12;
          ctx.globalAlpha = m.exitLife * 0.5;
          ctx.fillStyle = m.color;
          ctx.beginPath();
          ctx.arc(mx, my, m.size * m.exitLife, 0, Math.PI * 2);
          ctx.fill();
          alive.push(m);
        }
        continue;
      }
      m.cx = cx; m.cy = cy;
      const radiusRatio = Math.max(0.05, m.radius / spawnRing);
      const angAccel    = 1 + (1 - radiusRatio) * 1.8;
      const drainAccel  = 1 + (1 - radiusRatio) * 1.2;
      m.angle  += m.angularSpeed * angAccel * (1 + chargeRamp * 0.6);
      m.radius -= m.drainSpeed * drainAccel * spawnRing * (0.25 + chargeRamp * 0.35);
      if (m.radius < 2.5) continue;

      const mx        = m.cx + Math.cos(m.angle) * m.radius;
      const my        = m.cy + Math.sin(m.angle) * m.radius;
      const proximity = 1 - radiusRatio;
      const finalAlpha = m.alpha * (0.6 + proximity * 0.4) * chargeRamp;

      const tailAngle = m.angle - m.tailLength * Math.sign(m.angularSpeed) * angAccel;
      const tailX     = m.cx + Math.cos(tailAngle) * m.radius;
      const tailY     = m.cy + Math.sin(tailAngle) * m.radius;

      ctx.strokeStyle = m.color;
      ctx.lineCap     = 'round';

      ctx.globalAlpha = finalAlpha * 0.35;
      ctx.lineWidth   = m.size * (1.6 + proximity * 1.2);
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(mx, my); ctx.stroke();

      ctx.globalAlpha = finalAlpha * 0.9;
      ctx.lineWidth   = m.size * (0.5 + proximity * 0.4);
      ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(mx, my); ctx.stroke();

      ctx.globalAlpha = finalAlpha;
      ctx.fillStyle   = m.color;
      ctx.beginPath();
      ctx.arc(mx, my, m.size * (0.7 + proximity * 0.5), 0, Math.PI * 2);
      ctx.fill();

      alive.push(m);
    }
    vortexRef.current = alive;
    ctx.restore();
  }

  function drawExitingPortal(ctx: CanvasRenderingContext2D) {
    const toKeep: VortexMote[] = [];
    for (const m of vortexRef.current) {
      m.exitLife -= 0.07;
      if (m.exitLife > 0) {
        const mx = m.cx + Math.cos(m.angle) * m.radius + m.exitVx * (1 - m.exitLife) * 10;
        const my = m.cy + Math.sin(m.angle) * m.radius + m.exitVy * (1 - m.exitLife) * 10;
        ctx.save();
        ctx.globalAlpha  = m.exitLife * 0.6;
        ctx.shadowBlur   = 8;
        ctx.shadowColor  = m.color;
        ctx.fillStyle    = m.color;
        ctx.beginPath();
        ctx.arc(mx, my, m.size * m.exitLife, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        toKeep.push(m);
      }
    }
    vortexRef.current = toKeep;
  }

  function drawRipple(
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    cx: number, cy: number,
    now: number,
    elapsed: number,
  ) {
    const chargeRamp   = Math.min(1, elapsed / 0.5);
    const spawnInterval = Math.max(180, 400 - chargeRamp * 220);
    if (now - lastRippleRef.current > spawnInterval) {
      lastRippleRef.current = now;
      const maxR  = Math.max(rect.width, rect.height) * 0.7;
      const color = RIPPLE_COLORS[Math.floor(Math.random() * RIPPLE_COLORS.length)];
      rippleRef.current.push({
        id: mid(), cx, cy,
        radius: 4,
        maxRadius: maxR * (0.6 + Math.random() * 0.4),
        life: 1,
        color,
        borderWidth: 1 + Math.random() * 1.5,
      });
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 14);
    ctx.clip();

    const alive: RippleRing[] = [];
    for (const r of rippleRef.current) {
      r.cx = cx; r.cy = cy;
      const progress = r.radius / r.maxRadius;
      r.radius += (r.maxRadius - r.radius) * 0.045 + 0.6;
      r.life    = Math.max(0, 1 - progress);

      if (r.life > 0.01) {
        ctx.globalAlpha  = r.life * 0.55 * chargeRamp;
        ctx.strokeStyle  = r.color;
        ctx.lineWidth    = r.borderWidth * (1 - progress * 0.5);
        ctx.shadowColor  = r.color;
        ctx.shadowBlur   = 6 + progress * 4;
        ctx.beginPath();
        ctx.arc(r.cx, r.cy, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        alive.push(r);
      }
    }
    rippleRef.current = alive;

    const fadeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rect.width, rect.height) * 0.5);
    fadeGrad.addColorStop(0,   `rgba(56, 189, 248, ${0.06 * chargeRamp})`);
    fadeGrad.addColorStop(0.6, `rgba(56, 189, 248, ${0.03 * chargeRamp})`);
    fadeGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle   = fadeGrad;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

    ctx.restore();
  }

  function drawAurora(
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    cx: number, cy: number,
    elapsed: number,
  ) {
    const chargeRamp = Math.min(1, elapsed / 0.8);
    auroraHueRef.current = (auroraHueRef.current + 2.5) % 360;
    const t = elapsed * 2.5;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 14);
    ctx.clip();

    const bandCount = 6;
    for (let i = 0; i < bandCount; i++) {
      const hue      = (AURORA_HUES[i % AURORA_HUES.length] + auroraHueRef.current) % 360;
      const phase    = (i / bandCount) * Math.PI * 2 + t * (0.5 + i * 0.18);
      const yOffset  = Math.sin(phase) * rect.height * 0.30;
      const bandY    = cy + yOffset;
      const bandH    = rect.height * (0.28 + Math.sin(phase * 0.7 + i) * 0.10);
      const alpha    = (0.18 + Math.sin(phase + i * 0.8) * 0.10) * chargeRamp;

      const grad = ctx.createLinearGradient(rect.left, bandY - bandH, rect.left, bandY + bandH);
      grad.addColorStop(0,   `hsla(${hue},100%,65%,0)`);
      grad.addColorStop(0.4, `hsla(${hue},100%,70%,${alpha * 0.6})`);
      grad.addColorStop(0.5, `hsla(${hue},100%,65%,${alpha})`);
      grad.addColorStop(0.6, `hsla(${hue},100%,70%,${alpha * 0.6})`);
      grad.addColorStop(1,   `hsla(${hue},100%,65%,0)`);

      ctx.fillStyle   = grad;
      ctx.globalAlpha = 1;
      ctx.fillRect(rect.left, bandY - bandH, rect.width, bandH * 2);
    }

    const shimmerX = rect.left + ((Math.sin(t * 0.7) + 1) / 2) * rect.width;
    const shimmerGrad = ctx.createRadialGradient(shimmerX, cy, 0, shimmerX, cy, rect.width * 0.5);
    shimmerGrad.addColorStop(0,   `rgba(255,255,255,${0.10 * chargeRamp})`);
    shimmerGrad.addColorStop(0.5, `rgba(255,255,255,${0.03 * chargeRamp})`);
    shimmerGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle   = shimmerGrad;
    ctx.globalAlpha = 1;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

    ctx.restore();
  }

  function drawSparks(
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    cx: number, cy: number,
    now: number,
    colors: string[],
  ) {
    const elapsed    = (now - hoverStartRef.current) / 1000;
    const chargeRamp = Math.min(1, elapsed / 0.6);
    const spawnInterval = Math.max(30, 100 - chargeRamp * 70);

    if (now - lastSparkRef.current > spawnInterval) {
      lastSparkRef.current = now;
      const spawnCount = 1 + Math.floor(chargeRamp * 2);
      for (let s = 0; s < spawnCount; s++) {
        const edgePts = [
          { x: rect.left  + Math.random() * rect.width,  y: rect.top },
          { x: rect.left  + Math.random() * rect.width,  y: rect.bottom },
          { x: rect.left,                                  y: rect.top + Math.random() * rect.height },
          { x: rect.right,                                 y: rect.top + Math.random() * rect.height },
        ];
        const pt    = edgePts[Math.floor(Math.random() * edgePts.length)];
        const toCx  = cx - pt.x;
        const toCy  = cy - pt.y;
        const dist  = Math.sqrt(toCx * toCx + toCy * toCy);
        const speed = 4 + Math.random() * 6;
        const color = SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)];
        const baseAngle = Math.atan2(toCy, toCx);

        const forks: SparkFork[] = [];
        if (Math.random() < 0.5) {
          const forkAngle = baseAngle + (Math.random() - 0.5) * 1.2;
          forks.push({
            x: pt.x + Math.cos(baseAngle) * (8 + Math.random() * 12),
            y: pt.y + Math.sin(baseAngle) * (8 + Math.random() * 12),
            angle: forkAngle,
            length: 8 + Math.random() * 14,
            life: 0.7 + Math.random() * 0.3,
            color,
          });
        }

        sparkRef.current.push({
          id: mid(),
          x: pt.x, y: pt.y,
          vx: (toCx / dist) * speed * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * 2.5,
          vy: (toCy / dist) * speed * (0.8 + Math.random() * 0.4) + (Math.random() - 0.5) * 2.5,
          life: 1,
          color,
          angle: baseAngle,
          length: 10 + Math.random() * 18,
          fork: forks,
        });
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 14);
    ctx.clip();

    const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rect.width, rect.height) * 0.55);
    flashGrad.addColorStop(0,   `rgba(251,191,36,${0.08 * chargeRamp})`);
    flashGrad.addColorStop(0.5, `rgba(251,191,36,${0.04 * chargeRamp})`);
    flashGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle   = flashGrad;
    ctx.globalAlpha = 1;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

    const alive: SparkBolt[] = [];
    for (const s of sparkRef.current) {
      s.x  += s.vx;
      s.y  += s.vy;
      s.vx *= 0.90;
      s.vy *= 0.90;
      s.life -= 0.038;
      if (s.life <= 0) continue;

      s.angle = Math.atan2(s.vy, s.vx);

      const drawLightningBolt = (
        bx: number, by: number,
        bAngle: number,
        bLength: number,
        bLife: number,
        bColor: string,
        segs: number,
      ) => {
        const segLen = bLength / segs;
        const jitter = segLen * 0.55;
        let px = bx, py = by;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.globalAlpha  = bLife * 0.5 * chargeRamp;
        ctx.strokeStyle  = bColor;
        ctx.lineWidth    = 3.5;
        ctx.shadowColor  = bColor;
        ctx.shadowBlur   = 20;
        ctx.beginPath();
        ctx.moveTo(px, py);
        const pts: [number, number][] = [[px, py]];
        for (let i = 0; i < segs; i++) {
          const perp = bAngle + Math.PI / 2;
          const nx = px + Math.cos(bAngle) * segLen + Math.cos(perp) * (Math.random() - 0.5) * jitter * 2;
          const ny = py + Math.sin(bAngle) * segLen + Math.sin(perp) * (Math.random() - 0.5) * jitter * 2;
          ctx.lineTo(nx, ny);
          pts.push([nx, ny]);
          px = nx; py = ny;
        }
        ctx.stroke();

        ctx.globalAlpha  = bLife * 0.9 * chargeRamp;
        ctx.strokeStyle  = bColor;
        ctx.lineWidth    = 1.2;
        ctx.shadowBlur   = 8;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();

        ctx.globalAlpha  = bLife * chargeRamp;
        ctx.strokeStyle  = '#ffffff';
        ctx.lineWidth    = 0.5;
        ctx.shadowBlur   = 4;
        ctx.shadowColor  = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();

        ctx.restore();
      };

      drawLightningBolt(s.x, s.y, s.angle, s.length, s.life, s.color, 7);

      if (s.fork) {
        for (const f of s.fork) {
          f.life -= 0.05;
          if (f.life > 0) {
            drawLightningBolt(f.x, f.y, f.angle, f.length * f.life, f.life * s.life, f.color, 4);
          }
        }
        s.fork = s.fork.filter(f => f.life > 0);
      }

      ctx.save();
      ctx.globalAlpha = s.life * chargeRamp;
      ctx.fillStyle   = '#ffffff';
      ctx.shadowBlur  = 16;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      alive.push(s);
    }
    sparkRef.current = alive;
    ctx.restore();
  }

  function drawEmber(
    ctx: CanvasRenderingContext2D,
    rect: DOMRect,
    cx: number, cy: number,
    now: number,
    elapsed: number,
  ) {
    const chargeRamp = Math.min(1, elapsed / 0.8);
    const spawnInterval = Math.max(20, 80 - chargeRamp * 60);

    if (now - lastEmberRef.current > spawnInterval) {
      lastEmberRef.current = now;
      const spawnCount = 1 + Math.floor(chargeRamp * 3);
      for (let i = 0; i < spawnCount; i++) {
        const edgeX = rect.left + Math.random() * rect.width;
        const edgeY = rect.bottom - Math.random() * rect.height * 0.3;
        const hue   = EMBER_HUES[Math.floor(Math.random() * EMBER_HUES.length)];
        const life  = 0.6 + Math.random() * 0.6;
        emberRef.current.push({
          id: mid(),
          x: edgeX,
          y: edgeY,
          vx: (Math.random() - 0.5) * 1.8,
          vy: -(1.0 + Math.random() * 2.5),
          life,
          maxLife: life,
          size: 1.5 + Math.random() * 2.5,
          hue,
          glow: 6 + Math.random() * 10,
        });
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(rect.left, rect.top, rect.width, rect.height, 14);
    ctx.clip();

    const heatGrad = ctx.createRadialGradient(cx, rect.bottom, 0, cx, rect.bottom, rect.width * 0.7);
    heatGrad.addColorStop(0,   `rgba(255,100,20,${0.10 * chargeRamp})`);
    heatGrad.addColorStop(0.5, `rgba(255,60,10,${0.05 * chargeRamp})`);
    heatGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle   = heatGrad;
    ctx.globalAlpha = 1;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

    const alive: EmberParticle[] = [];
    for (const e of emberRef.current) {
      e.x  += e.vx;
      e.y  += e.vy;
      e.vx += (Math.random() - 0.5) * 0.3;
      e.vy *= 0.98;
      e.life -= 0.018;
      if (e.life <= 0) continue;

      const lifeRatio = e.life / e.maxLife;
      const curHue  = e.hue + (1 - lifeRatio) * 40;
      const sat     = 100;
      const lum     = 50 + lifeRatio * 25;
      const alpha   = lifeRatio * 0.9 * chargeRamp;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur  = e.glow * lifeRatio;
      ctx.shadowColor = `hsl(${curHue},${sat}%,${lum}%)`;
      ctx.fillStyle   = `hsl(${curHue},${sat}%,${lum}%)`;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();

      if (lifeRatio > 0.3) {
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = `hsl(${curHue + 20},100%,85%)`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * lifeRatio * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      alive.push(e);
    }
    emberRef.current = alive;
    ctx.restore();
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 9999 }}
    />
  );
}
