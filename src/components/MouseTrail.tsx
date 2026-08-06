import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface TrailDot {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  type: string;
  w?: number;
  h?: number;
}

interface MouseTrailProps {
  pointerSymbol?: string;
  showTrail?: boolean;
  trailStyle?: string;
  animationStyle?: string;
  trailColor?: string;
  particleColors?: string[];
}

const TRAIL_LIFETIME_MS = 700;
const TRAIL_TICK_MS = 80;
const SPAWN_THROTTLE_MS = 40;

export function MouseTrail({
  pointerSymbol,
  showTrail = true,
  trailStyle = 'solid',
  animationStyle = 'stars',
  trailColor = 'rgba(244,63,107,0.85)',
  particleColors = ['#f43f6b', '#fb7185', '#fda4af', '#e11d48'],
}: MouseTrailProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [, forceUpdate] = useState(0);
  const canvasRef         = useRef<HTMLCanvasElement>(null);
  const trailIdRef        = useRef(0);
  const particleIdRef     = useRef(0);
  const particlesRef      = useRef<Particle[]>([]);
  const trailDotsRef      = useRef<TrailDot[]>([]);
  const lastSpawnRef      = useRef(0);
  const animFrameRef      = useRef<number>(0);
  const isRunningRef      = useRef(false);
  const colorRef          = useRef({ trailColor, particleColors });
  const hueRef            = useRef(0);
  const pulseRef          = useRef(0);
  const trailTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { colorRef.current = { trailColor, particleColors }; }, [trailColor, particleColors]);

  const startCanvas = useCallback(() => {
    if (isRunningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isRunningRef.current = true;

    const decay: Record<string, number> = {
      comet: 0.012, bubbles: 0.008, snow: 0.006, firework: 0.025,
      lightning: 0.06, confetti: 0.018, default: 0.022,
    };

    function drawStar(cx: number, cy: number, r: number, rot: number) {
      const spikes = 5;
      const inner  = r * 0.45;
      let a = rot - Math.PI / 2;
      const step = Math.PI / spikes;
      ctx!.beginPath();
      ctx!.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      for (let i = 0; i < spikes; i++) {
        a += step; ctx!.lineTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        a += step; ctx!.lineTo(cx + Math.cos(a) * r,     cy + Math.sin(a) * r);
      }
      ctx!.closePath();
    }

    function drawSnowflake(cx: number, cy: number, r: number) {
      const arms = 6;
      for (let i = 0; i < arms; i++) {
        const angle = (i / arms) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
        ctx!.stroke();
        const ax = cx + Math.cos(angle) * r * 0.5;
        const ay = cy + Math.sin(angle) * r * 0.5;
        const cross = angle + Math.PI / 3;
        ctx!.beginPath();
        ctx!.moveTo(ax - Math.cos(cross) * r * 0.25, ay - Math.sin(cross) * r * 0.25);
        ctx!.lineTo(ax + Math.cos(cross) * r * 0.25, ay + Math.sin(cross) * r * 0.25);
        ctx!.stroke();
      }
    }

    function drawLightningBolt(cx: number, cy: number, length: number, angle: number) {
      const segs = 4;
      const segLen = length / segs;
      const jitter = segLen * 0.5;
      ctx!.beginPath();
      let px = cx, py = cy;
      ctx!.moveTo(px, py);
      for (let i = 0; i < segs; i++) {
        const nx = px + Math.cos(angle) * segLen + (Math.random() - 0.5) * jitter;
        const ny = py + Math.sin(angle) * segLen + (Math.random() - 0.5) * jitter;
        ctx!.lineTo(nx, ny);
        px = nx; py = ny;
      }
      ctx!.stroke();
    }

    const tick = () => {
      const ps = particlesRef.current;

      if (ps.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        isRunningRef.current = false;
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hueRef.current   = (hueRef.current + 1.2) % 360;
      pulseRef.current = (pulseRef.current + 0.08) % (Math.PI * 2);

      const next: Particle[] = [];

      for (const p of ps) {
        const d = decay[p.type] ?? decay.default;
        p.x    += p.vx;
        p.vy   = p.type === 'circle'   ? p.vy * 0.98
               : p.type === 'confetti' ? p.vy + 0.12
               : p.type === 'snow' || p.type === 'comet' ? p.vy
               : p.vy + 0.04;
        p.y    += p.vy + (p.type === 'star' || p.type === 'spark' ? 0.12 : 0);
        if (p.type === 'confetti') p.vx *= 0.97;
        p.life     -= d;
        p.rotation += p.rotationSpeed;
        if (p.type === 'comet') p.size *= 0.97;
        if (p.life <= 0) continue;
        next.push(p);
      }

      particlesRef.current = next;

      for (const p of next) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life * (p.type === 'circle' ? 0.6 : 0.9));

        if (p.type === 'snow') {
          ctx.strokeStyle = '#c8e8ff';
          ctx.lineWidth   = 1.2;
          ctx.shadowColor = '#a0d4ff';
          ctx.shadowBlur  = 4;
          drawSnowflake(p.x, p.y, p.size);
        } else if (p.type === 'lightning') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth   = 1.5;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = 8;
          drawLightningBolt(p.x, p.y, p.size * 4, p.rotation);
        } else if (p.type === 'confetti') {
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillRect(-(p.w ?? p.size) / 2, -(p.h ?? p.size / 2) / 2, p.w ?? p.size, p.h ?? p.size / 2);
        } else if (p.type === 'firework') {
          ctx.fillStyle   = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = p.size * 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - p.life * 0.3), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'star') {
          ctx.fillStyle = p.color;
          drawStar(p.x, p.y, p.size, p.rotation);
          ctx.fill();
        } else if (p.type === 'circle') {
          ctx.shadowColor = p.color;
          ctx.shadowBlur  = p.size * 1.5;
          ctx.fillStyle   = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'petal') {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.beginPath();
          ctx.ellipse(0, -p.size / 2, p.size * 0.35, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.restore();
          ctx.fill();
        } else if (p.type === 'spark') {
          const hw = p.size * 0.3;
          const hl = p.size * 1.2;
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(Math.atan2(p.vy, p.vx));
          ctx.fillRect(-hl, -hw, hl * 2, hw * 2);
          ctx.restore();
        } else if (p.type === 'comet') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.4, p.color + '99');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const spawnParticles = useCallback((x: number, y: number, style: string, colors: string[]) => {
    const now = Date.now();
    if (now - lastSpawnRef.current < SPAWN_THROTTLE_MS) return;
    lastSpawnRef.current = now;

    const newP: Particle[] = [];

    if (style === 'confetti') {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1.5;
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.5,
          life: 1, maxLife: 1,
          size: Math.random() * 5 + 3,
          w: Math.random() * 8 + 4,
          h: Math.random() * 4 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.25,
          type: 'confetti',
        });
      }
    } else if (style === 'bubbles') {
      for (let i = 0; i < 2; i++) {
        newP.push({
          id: particleIdRef.current++, x: x + (Math.random() - 0.5) * 20, y,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -(Math.random() * 1.5 + 0.8),
          life: 1, maxLife: 1,
          size: Math.random() * 6 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: 0, rotationSpeed: 0,
          type: 'circle',
        });
      }
    } else if (style === 'snow') {
      if (Math.random() < 0.4) {
        newP.push({
          id: particleIdRef.current++, x: x + (Math.random() - 0.5) * 30, y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: Math.random() * 0.5 + 0.3,
          life: 1, maxLife: 1,
          size: Math.random() * 5 + 3,
          color: '#c8e8ff',
          rotation: 0, rotationSpeed: 0,
          type: 'snow',
        });
      }
    } else if (style === 'firework') {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, maxLife: 1,
          size: Math.random() * 3 + 1.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: 0, rotationSpeed: 0,
          type: 'firework',
        });
      }
    } else if (style === 'lightning') {
      if (Math.random() < 0.35) {
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: (Math.random() - 0.5) * 2,
          vy: Math.random() * 2,
          life: 1, maxLife: 1,
          size: Math.random() * 10 + 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: 0,
          type: 'lightning',
        });
      }
    } else if (style === 'sakura') {
      if (Math.random() < 0.4) {
        newP.push({
          id: particleIdRef.current++,
          x: x + (Math.random() - 0.5) * 20,
          y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 0.8 + 0.4,
          life: 1, maxLife: 1,
          size: Math.random() * 7 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.08,
          type: 'petal',
        });
      }
    } else if (style === 'comet') {
      if (Math.random() < 0.25) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 2;
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, maxLife: 1,
          size: Math.random() * 4 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: 0, rotationSpeed: 0,
          type: 'comet',
        });
      }
    } else if (style === 'sparks') {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 6 + 3;
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1, maxLife: 1,
          size: Math.random() * 5 + 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: 0,
          type: 'spark',
        });
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        newP.push({
          id: particleIdRef.current++, x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          life: 1, maxLife: 1,
          size: Math.random() * 4 + 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.15,
          type: 'star',
        });
      }
    }

    if (newP.length > 0) {
      particlesRef.current = [...particlesRef.current, ...newP];
      startCanvas();
    }
  }, [startCanvas]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (showTrail) {
        const dot: TrailDot = { id: trailIdRef.current++, x: e.clientX, y: e.clientY, timestamp: Date.now() };
        trailDotsRef.current = [...trailDotsRef.current, dot].slice(-32);
      }
      if (animationStyle !== 'none') {
        spawnParticles(e.clientX, e.clientY, animationStyle, colorRef.current.particleColors);
      }
    };
    window.addEventListener('mousemove', handleMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMove);
  }, [showTrail, animationStyle, spawnParticles]);

  useEffect(() => {
    if (!showTrail) {
      trailDotsRef.current = [];
      return;
    }
    trailTimerRef.current = setInterval(() => {
      const now = Date.now();
      const before = trailDotsRef.current.length;
      trailDotsRef.current = trailDotsRef.current.filter(d => now - d.timestamp < TRAIL_LIFETIME_MS);
      if (trailDotsRef.current.length !== before) {
        forceUpdate(n => n + 1);
      }
    }, TRAIL_TICK_MS);
    return () => {
      if (trailTimerRef.current) clearInterval(trailTimerRef.current);
    };
  }, [showTrail]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animFrameRef.current);
      isRunningRef.current = false;
    };
  }, []);

  const renderTrail = () => {
    const trailDots = trailDotsRef.current;
    if (!showTrail || trailDots.length < 2) return null;
    const color = colorRef.current.trailColor;

    if (trailStyle === 'dots') {
      return (
        <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <filter id="dotGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {trailDots.filter((_, i) => i % 3 === 0).map(dot => {
            const age      = Date.now() - dot.timestamp;
            const progress = Math.min(age / TRAIL_LIFETIME_MS, 1);
            const opacity  = (0.85 - progress * 0.75).toFixed(3);
            const size     = 5 - progress * 3;
            return (
              <circle key={dot.id} cx={dot.x} cy={dot.y} r={size}
                fill={color} opacity={opacity} filter="url(#dotGlow)" />
            );
          })}
        </svg>
      );
    }

    if (trailStyle === 'dashes') {
      return (
        <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <filter id="dashGlow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path
            d={`M ${trailDots.map(d => `${d.x},${d.y}`).join(' L ')}`}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="6 8"
            filter="url(#dashGlow)"
            opacity="0.80"
          />
        </svg>
      );
    }

    if (trailStyle === 'neon') {
      return (
        <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <filter id="neonGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path
            d={`M ${trailDots.map(d => `${d.x},${d.y}`).join(' L ')}`}
            stroke={color} strokeWidth="6" fill="none"
            strokeLinecap="round" opacity="0.35" filter="url(#neonGlow)"
          />
          <path
            d={`M ${trailDots.map(d => `${d.x},${d.y}`).join(' L ')}`}
            stroke="white" strokeWidth="1.5" fill="none"
            strokeLinecap="round" opacity="0.90"
          />
        </svg>
      );
    }

    if (trailStyle === 'rainbow') {
      const segments: Array<{ x1: number; y1: number; x2: number; y2: number; hue: number }> = [];
      const total = trailDots.length;
      for (let i = 1; i < total; i++) {
        segments.push({
          x1: trailDots[i - 1].x, y1: trailDots[i - 1].y,
          x2: trailDots[i].x,     y2: trailDots[i].y,
          hue: (i / total) * 360,
        });
      }
      return (
        <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <filter id="rainbowGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {segments.map((seg, i) => (
            <line key={i}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke={`hsl(${seg.hue}, 100%, 65%)`}
              strokeWidth="2.5" strokeLinecap="round"
              opacity="0.85" filter="url(#rainbowGlow)"
            />
          ))}
        </svg>
      );
    }

    if (trailStyle === 'pulse') {
      const t   = Date.now() / 300;
      const w   = 2 + Math.sin(t) * 1.5;
      return (
        <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
          <defs>
            <linearGradient id="pulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={color} stopOpacity="0" />
              <stop offset="50%"  stopColor={color} stopOpacity="0.7" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
            <filter id="pulseGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path
            d={`M ${trailDots.map(d => `${d.x},${d.y}`).join(' L ')}`}
            stroke="url(#pulseGrad)"
            strokeWidth={w}
            fill="none" strokeLinecap="round" strokeLinejoin="round"
            filter="url(#pulseGlow)" opacity="0.85"
          />
        </svg>
      );
    }

    return (
      <svg className="fixed inset-0 pointer-events-none z-[10000]" style={{ width: '100vw', height: '100vh' }}>
        <defs>
          <linearGradient id="trailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={color} stopOpacity="0" />
            <stop offset="50%"  stopColor={color} stopOpacity="0.5" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
          <filter id="trailGlow">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path
          d={`M ${trailDots.map(d => `${d.x},${d.y}`).join(' L ')}`}
          stroke="url(#trailGrad)" strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
          filter="url(#trailGlow)" opacity="0.75"
        />
        {trailDots.map(dot => {
          const age      = Date.now() - dot.timestamp;
          const progress = Math.min(age / TRAIL_LIFETIME_MS, 1);
          const opacity  = (0.85 - progress * 0.75).toFixed(3);
          const size     = 9 - progress * 5;
          if (pointerSymbol) {
            return (
              <g key={dot.id} transform={`translate(${dot.x - size},${dot.y - size})`}
                opacity={opacity} filter="url(#trailGlow)">
                <svg width={size * 2} height={size * 2} viewBox="0 0 24 24" fill={color}>
                  <path d={pointerSymbol} />
                </svg>
              </g>
            );
          }
          return (
            <circle key={dot.id} cx={dot.x} cy={dot.y} r={size}
              fill={color} opacity={opacity} filter="url(#trailGlow)" />
          );
        })}
      </svg>
    );
  };

  if (prefersReducedMotion || !showTrail) return null;

  return (
    <>
      {renderTrail()}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[9998]" />
    </>
  );
}
