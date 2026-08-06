import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface TouchRippleCanvasProps {
  animationStyle?: string;
  particleColors?: string[];
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
}

interface RippleRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

export function TouchRippleCanvas({
  animationStyle = 'stars',
  particleColors = ['#f43f6b', '#fb7185', '#fda4af', '#e11d48'],
}: TouchRippleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<RippleRing[]>([]);
  const idRef = useRef(0);
  const frameRef = useRef<number>(0);
  const colorRef = useRef({ particleColors });
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    colorRef.current = { particleColors };
  }, [particleColors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function spawnParticles(x: number, y: number) {
      const colors = colorRef.current.particleColors;
      const count = animationStyle === 'confetti' ? 20 : animationStyle === 'bubbles' ? 12 : 16;

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 2 + Math.random() * 4;
        particlesRef.current.push({
          id: idRef.current++,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - Math.random() * 2,
          life: 1,
          maxLife: 1,
          size: animationStyle === 'confetti' ? 4 + Math.random() * 4 : 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
        });
      }

      ripplesRef.current.push({
        id: idRef.current++,
        x,
        y,
        radius: 0,
        maxRadius: 60 + Math.random() * 40,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const decayRate = animationStyle === 'bubbles' ? 0.012 : animationStyle === 'confetti' ? 0.018 : 0.022;

    function drawStar(cx: number, cy: number, r: number, rot: number) {
      const spikes = 5;
      const inner = r * 0.45;
      ctx!.beginPath();
      for (let s = 0; s < spikes * 2; s++) {
        const angle = rot + (s * Math.PI) / spikes;
        const radius = s % 2 === 0 ? r : inner;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (s === 0) { ctx!.moveTo(px, py); } else { ctx!.lineTo(px, py); }
      }
      ctx!.closePath();
      ctx!.fill();
    }

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      ripplesRef.current = ripplesRef.current.filter(r => r.life > 0);

      for (const r of ripplesRef.current) {
        r.radius += (r.maxRadius - r.radius) * 0.12;
        r.life -= 0.035;
        if (r.life <= 0) continue;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, r.life * 0.6);
        ctx!.strokeStyle = r.color;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }

      for (const p of particlesRef.current) {
        p.life -= decayRate;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.97;
        p.rotation += p.rotationSpeed;
        if (p.life <= 0) continue;

        ctx!.save();
        ctx!.globalAlpha = Math.max(0, p.life);
        ctx!.fillStyle = p.color;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);

        if (animationStyle === 'stars') {
          ctx!.translate(-p.x, -p.y);
          drawStar(p.x, p.y, p.size, p.rotation);
        } else if (animationStyle === 'confetti') {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (animationStyle === 'bubbles') {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx!.globalAlpha = Math.max(0, p.life * 0.5);
          ctx!.fill();
          ctx!.globalAlpha = Math.max(0, p.life * 0.8);
          ctx!.strokeStyle = p.color;
          ctx!.lineWidth = 1;
          ctx!.stroke();
        } else {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }

        ctx!.restore();
      }
    }

    animate();

    const handleTouch = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        spawnParticles(t.clientX, t.clientY);
      }
    };

    window.addEventListener('touchstart', handleTouch, { passive: true });

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('touchstart', handleTouch);
    };
  }, [animationStyle]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 40 }}
    />
  );
}
