export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'circle' | 'text' | 'rect';
  text?: string;
  rotation?: number;
  rotationSpeed?: number;
  alpha?: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private nextId = 0;

  createMoneyCollectParticles(x: number, y: number, count: number = 5) {
    const colors = ['#10b981', '#22c55e', '#4ade80'];
    const texts = ['$', '+100', '💵', '💰'];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 2;

      this.particles.push({
        id: `money-${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        maxLife: 1,
        size: 8 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'text',
        text: texts[Math.floor(Math.random() * texts.length)],
        alpha: 1
      });
    }
  }

  createPowerUpExplosion(x: number, y: number, color: string) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 4;

      this.particles.push({
        id: `explosion-${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 4 + Math.random() * 6,
        color,
        type: 'circle',
        alpha: 1
      });
    }
  }

  createConfetti(x: number, y: number) {
    const colors = ['#fbbf24', '#ef4444', '#3b82f6', '#10b981', '#ec4899'];

    for (let i = 0; i < 30; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = 4 + Math.random() * 6;

      this.particles.push({
        id: `confetti-${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.5,
        maxLife: 1.5,
        size: 6 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'rect',
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        alpha: 1
      });
    }
  }

  createHitEffect(x: number, y: number) {
    const colors = ['#ef4444', '#dc2626', '#b91c1c'];

    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const speed = 3 + Math.random() * 2;

      this.particles.push({
        id: `hit-${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        size: 6 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: 'circle',
        alpha: 1
      });
    }
  }

  createComboText(x: number, y: number, combo: number) {
    this.particles.push({
      id: `combo-${this.nextId++}`,
      x,
      y,
      vx: 0,
      vy: -1.5,
      life: 1.2,
      maxLife: 1.2,
      size: 16 + combo * 2,
      color: combo > 5 ? '#fbbf24' : combo > 3 ? '#f97316' : '#10b981',
      type: 'text',
      text: `${combo}x COMBO!`,
      alpha: 1
    });
  }

  createScorePopup(x: number, y: number, score: number) {
    this.particles.push({
      id: `score-${this.nextId++}`,
      x,
      y,
      vx: 0,
      vy: -2,
      life: 0.8,
      maxLife: 0.8,
      size: 14,
      color: score > 500 ? '#fbbf24' : '#10b981',
      type: 'text',
      text: `+$${score}`,
      alpha: 1
    });
  }

  update(deltaTime: number = 0.016) {
    const gravity = 0.15;

    this.particles = this.particles.filter(p => {
      p.life -= deltaTime;

      if (p.life <= 0) return false;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;

      if (p.rotationSpeed !== undefined && p.rotation !== undefined) {
        p.rotation += p.rotationSpeed;
      }

      p.alpha = p.life / p.maxLife;

      return true;
    });
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  clear() {
    this.particles = [];
  }
}
