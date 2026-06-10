import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Home, Trophy } from 'lucide-react';
import { supabase } from '../shared/supabase/client';

const GAME_WIDTH = 800;
const GAME_HEIGHT = 500;
const GROUND_Y = 420;
const GRAVITY = 0.6;
const BALL_GRAVITY = 0.25;
const FRICTION = 0.99;
const GROUND_FRICTION = 0.99;
const BOUNCE = 0.88;
const SLIME_RADIUS = 50;
const BALL_RADIUS = 20;
const GOAL_WIDTH = 12;
const GOAL_HEIGHT = 130;
const GOAL_DEPTH = 55;

interface PowerUp {
  x: number;
  y: number;
  type: 'speed' | 'size' | 'freeze';
  active: boolean;
  timer: number;
  bobTimer: number;
}

interface MatchRecord {
  id: string;
  result: string;
  player_score: number;
  opponent_score: number;
  game_mode: string;
  created_at: string;
}

const POWER_UP_COLORS: Record<string, string> = {
  speed: '#00ff88',
  size: '#ff8800',
  freeze: '#88ccff',
};

const POWER_UP_LABELS: Record<string, string> = {
  speed: 'SPEED',
  size: 'BIG',
  freeze: 'FREEZE',
};

const SlimeSoccer = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [gameState, setGameState] = useState('menu');
  const [gameMode, setGameMode] = useState('single');
  const [gameDuration, setGameDuration] = useState(2);
  const [scores, setScores] = useState({ left: 0, right: 0 });
  const [timeLeft, setTimeLeft] = useState(120);
  const [winner, setWinner] = useState<string | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [powerUpsCollected, setPowerUpsCollected] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<any>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastTimeRef = useRef(0);
  const powerUpsCollectedRef = useRef(0);

  const initGame = useCallback(() => {
    return {
      slimes: [
        { x: 150, y: GROUND_Y, vx: 0, vy: 0, color: '#00ffff', side: 'left', campTime: 0, squash: 1, speedBoost: 0, sizeBoost: 0, frozen: 0, radius: SLIME_RADIUS },
        { x: GAME_WIDTH - 150, y: GROUND_Y, vx: 0, vy: 0, color: '#ff4444', side: 'right', campTime: 0, squash: 1, speedBoost: 0, sizeBoost: 0, frozen: 0, radius: SLIME_RADIUS }
      ],
      ball: { x: GAME_WIDTH / 2, y: 80, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, trail: [] },
      particles: [],
      powerUps: [] as PowerUp[],
      powerUpSpawnTimer: 8 + Math.random() * 5,
      screenShake: 0,
      goalFlash: 0,
      lastGoalSide: null
    };
  }, []);

  useEffect(() => {
    loadMatchHistory();
  }, []);

  const loadMatchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('slime_soccer_matches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setMatchHistory(data);
    } catch (err) {
      console.error('Failed to load match history:', err);
    }
  };

  const saveMatch = async (playerScore: number, opponentScore: number, mode: string, duration: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const result = playerScore > opponentScore ? 'win' : opponentScore > playerScore ? 'loss' : 'tie';
      await supabase.from('slime_soccer_matches').insert({
        user_id: user.id,
        game_mode: mode,
        player_score: playerScore,
        opponent_score: opponentScore,
        result,
        duration_seconds: duration,
        power_ups_collected: powerUpsCollectedRef.current,
      });
      loadMatchHistory();
    } catch (err) {
      console.error('Failed to save match:', err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: any) => {
      keysRef.current[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setGameState('gameover');
          setWinner(scores.left > scores.right ? 'Cyan' : scores.right > scores.left ? 'Red' : 'Tie');
          saveMatch(scores.left, scores.right, gameMode, gameDuration * 60);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState, scores]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    gameRef.current = initGame();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;

    const updateAI = (game) => {
      if (gameMode !== 'single') return;
      const ai = game.slimes[1];
      const ball = game.ball;
      const targetX = ball.x > GAME_WIDTH / 2 ? ball.x - 40 : GAME_WIDTH * 0.7;
      const diff = targetX - ai.x;
      const speed = 4.5 + Math.min(scores.left * 0.3, 2);
      
      if (Math.abs(diff) > 10) {
        ai.vx += (diff > 0 ? 1 : -1) * 0.5;
        ai.vx = Math.max(-speed, Math.min(speed, ai.vx));
      }
      
      const shouldJump = (ball.x > GAME_WIDTH / 2 - 100 && ball.y < 320 && Math.abs(ball.x - ai.x) < 120) ||
                         (ball.vy < -2 && Math.abs(ball.x - ai.x) < 80);
      if (shouldJump && ai.y >= GROUND_Y - 1) {
        ai.vy = -13 - Math.random() * 1;
      }
    };

    const updatePowerUps = (game: any, dt: number) => {
      game.powerUpSpawnTimer -= dt;
      if (game.powerUpSpawnTimer <= 0 && game.powerUps.filter((p: PowerUp) => p.active).length < 2) {
        const types: PowerUp['type'][] = ['speed', 'size', 'freeze'];
        game.powerUps.push({
          x: 100 + Math.random() * (GAME_WIDTH - 200),
          y: 100 + Math.random() * (GROUND_Y - 200),
          type: types[Math.floor(Math.random() * types.length)],
          active: true,
          timer: 12,
          bobTimer: 0,
        });
        game.powerUpSpawnTimer = 10 + Math.random() * 8;
      }

      for (const pu of game.powerUps) {
        if (!pu.active) continue;
        pu.timer -= dt;
        pu.bobTimer += dt * 3;
        if (pu.timer <= 0) { pu.active = false; continue; }

        game.slimes.forEach((slime: any) => {
          const dx = pu.x - slime.x;
          const dy = (pu.y + Math.sin(pu.bobTimer) * 5) - (slime.y - slime.radius / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < slime.radius + 15) {
            pu.active = false;
            powerUpsCollectedRef.current++;
            setPowerUpsCollected(powerUpsCollectedRef.current);
            if (pu.type === 'speed') slime.speedBoost = 5;
            else if (pu.type === 'size') slime.sizeBoost = 6;
            else if (pu.type === 'freeze') {
              const opponent = game.slimes.find((s: any) => s.side !== slime.side);
              if (opponent) opponent.frozen = 2;
            }
            for (let i = 0; i < 10; i++) {
              game.particles.push({
                x: pu.x, y: pu.y,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 5,
                life: 25,
                color: POWER_UP_COLORS[pu.type],
              });
            }
          }
        });
      }
      game.powerUps = game.powerUps.filter((p: PowerUp) => p.active);

      game.slimes.forEach((slime: any) => {
        if (slime.speedBoost > 0) slime.speedBoost -= dt;
        if (slime.sizeBoost > 0) {
          slime.sizeBoost -= dt;
          slime.radius = SLIME_RADIUS * 1.4;
        } else {
          slime.radius = SLIME_RADIUS;
        }
        if (slime.frozen > 0) slime.frozen -= dt;
      });
    };

    const handleCollisions = (game: any) => {
      const { slimes, ball, particles } = game;

      slimes.forEach((slime: any, idx: number) => {
        slime.vy += GRAVITY;
        if (slime.frozen > 0) {
          slime.vx *= 0.8;
        }
        slime.x += slime.vx;
        slime.y += slime.vy;
        slime.vx *= slime.y >= GROUND_Y ? 0.9 : FRICTION;

        if (slime.y >= GROUND_Y) {
          slime.y = GROUND_Y;
          if (slime.vy > 5) slime.squash = 0.7;
          slime.vy = 0;
        }
        slime.squash += (1 - slime.squash) * 0.15;

        const r = slime.radius || SLIME_RADIUS;
        const minX = idx === 0 ? r : GAME_WIDTH / 2 + r;
        const maxX = idx === 0 ? GAME_WIDTH / 2 - r : GAME_WIDTH - r;
        slime.x = Math.max(minX, Math.min(maxX, slime.x));
        
        const goalZone = idx === 0 ? slime.x < GOAL_DEPTH + 30 : slime.x > GAME_WIDTH - GOAL_DEPTH - 30;
        if (goalZone && slime.y >= GROUND_Y - 10) {
          slime.campTime++;
          if (slime.campTime > 120) slime.vx += idx === 0 ? 8 : -8;
        } else {
          slime.campTime = Math.max(0, slime.campTime - 2);
        }
      });

      ball.vy += BALL_GRAVITY;
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.rotation += ball.rotationSpeed;
      ball.rotationSpeed *= 0.995;
      ball.vx *= FRICTION;
      
      ball.trail.unshift({ x: ball.x, y: ball.y, age: 0 });
      if (ball.trail.length > 10) ball.trail.pop();
      ball.trail.forEach(t => t.age++);

      if (ball.y >= GROUND_Y - BALL_RADIUS) {
        ball.y = GROUND_Y - BALL_RADIUS;
        ball.vy *= -BOUNCE;
        ball.vx *= GROUND_FRICTION;
        ball.rotationSpeed = ball.vx * 0.1;
        if (Math.abs(ball.vy) > 2) {
          for (let i = 0; i < 5; i++) {
            particles.push({ x: ball.x, y: GROUND_Y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4, life: 30, color: '#8b7355' });
          }
        }
      }
      if (ball.y < BALL_RADIUS) { ball.y = BALL_RADIUS; ball.vy *= -BOUNCE; }

      const wallBounce = (side) => {
        for (let i = 0; i < 8; i++) {
          particles.push({ x: ball.x, y: ball.y, vx: (side === 'left' ? 1 : -1) * Math.random() * 5, vy: (Math.random() - 0.5) * 6, life: 25, color: '#ffffff' });
        }
      };

      if (ball.x <= BALL_RADIUS + GOAL_WIDTH) {
        if (ball.y > GROUND_Y - GOAL_HEIGHT) {
          if (ball.x < GOAL_WIDTH - GOAL_DEPTH + BALL_RADIUS) {
            return 'right';
          }
        } else {
          ball.x = BALL_RADIUS + GOAL_WIDTH;
          ball.vx *= -BOUNCE;
          wallBounce('left');
        }
      }
      if (ball.x >= GAME_WIDTH - BALL_RADIUS - GOAL_WIDTH) {
        if (ball.y > GROUND_Y - GOAL_HEIGHT) {
          if (ball.x > GAME_WIDTH - GOAL_WIDTH + GOAL_DEPTH - BALL_RADIUS) {
            return 'left';
          }
        } else {
          ball.x = GAME_WIDTH - BALL_RADIUS - GOAL_WIDTH;
          ball.vx *= -BOUNCE;
          wallBounce('right');
        }
      }

      if (ball.y > GROUND_Y - GOAL_HEIGHT && ball.y < GROUND_Y) {
        if (ball.x < GOAL_WIDTH + GOAL_DEPTH && ball.x > GOAL_WIDTH) {
          if (ball.y < GROUND_Y - GOAL_HEIGHT + BALL_RADIUS + 10) {
            ball.y = GROUND_Y - GOAL_HEIGHT + BALL_RADIUS + 10;
            ball.vy = Math.abs(ball.vy) * BOUNCE;
          }
        }
        if (ball.x > GAME_WIDTH - GOAL_WIDTH - GOAL_DEPTH && ball.x < GAME_WIDTH - GOAL_WIDTH) {
          if (ball.y < GROUND_Y - GOAL_HEIGHT + BALL_RADIUS + 10) {
            ball.y = GROUND_Y - GOAL_HEIGHT + BALL_RADIUS + 10;
            ball.vy = Math.abs(ball.vy) * BOUNCE;
          }
        }
      }

      slimes.forEach((slime: any) => {
        const dx = ball.x - slime.x;
        const dy = ball.y - slime.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = slime.radius || SLIME_RADIUS;
        const minDist = r + BALL_RADIUS;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          
          ball.x += nx * overlap;
          ball.y += ny * overlap;
          
          const relVx = ball.vx - slime.vx;
          const relVy = ball.vy - slime.vy;
          const relVn = relVx * nx + relVy * ny;
          
          if (relVn < 0) {
            const impulse = -2 * relVn;
            ball.vx += nx * impulse * 0.8 + slime.vx * 0.5;
            ball.vy += ny * impulse * 0.8 + slime.vy * 0.5;
            
            // Cap ball speed
            const newSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (newSpeed > 13) {
              ball.vx = (ball.vx / newSpeed) * 13;
              ball.vy = (ball.vy / newSpeed) * 13;
            }
            ball.rotationSpeed = (ball.vx - slime.vx) * 0.05;
            slime.squash = 0.8;
            
            for (let i = 0; i < 6; i++) {
              particles.push({ x: ball.x - nx * BALL_RADIUS, y: ball.y - ny * BALL_RADIUS, vx: -nx * Math.random() * 5 + (Math.random() - 0.5) * 3, vy: -ny * Math.random() * 5, life: 20, color: '#ffffff' });
            }
          }
        }
      });

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }

      return null;
    };

    const handleInput = (game: any) => {
      const keys = keysRef.current;
      const p1 = game.slimes[0];
      const p1Speed = p1.frozen > 0 ? 0.3 : p1.speedBoost > 0 ? 1.5 : 1.0;
      const p1Max = p1.frozen > 0 ? 2 : p1.speedBoost > 0 ? 9 : 6;

      if (keys['ArrowLeft']) p1.vx -= p1Speed;
      if (keys['ArrowRight']) p1.vx += p1Speed;
      if ((keys['ArrowUp'] || keys['Space']) && p1.y >= GROUND_Y - 1 && p1.frozen <= 0) p1.vy = -13;
      p1.vx = Math.max(-p1Max, Math.min(p1Max, p1.vx));

      if (gameMode === 'multi') {
        const p2 = game.slimes[1];
        const p2Speed = p2.frozen > 0 ? 0.3 : p2.speedBoost > 0 ? 1.5 : 1.0;
        const p2Max = p2.frozen > 0 ? 2 : p2.speedBoost > 0 ? 9 : 6;
        if (keys['KeyA']) p2.vx -= p2Speed;
        if (keys['KeyD']) p2.vx += p2Speed;
        if (keys['KeyW'] && p2.y >= GROUND_Y - 1 && p2.frozen <= 0) p2.vy = -13;
        p2.vx = Math.max(-p2Max, Math.min(p2Max, p2.vx));
      }
    };

    const drawNet = (ctx, x, y, width, height, side) => {
      const netColor = side === 'left' ? 'rgba(0, 255, 255, 0.6)' : 'rgba(255, 68, 68, 0.6)';
      const netColorDark = side === 'left' ? 'rgba(0, 180, 180, 0.8)' : 'rgba(180, 40, 40, 0.8)';
      const meshSize = 12;
      
      ctx.save();
      
      // Net background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(x, y, width, height);
      
      // Draw mesh pattern
      ctx.strokeStyle = netColor;
      ctx.lineWidth = 1.5;
      
      // Horizontal lines
      for (let row = 0; row <= height; row += meshSize) {
        ctx.beginPath();
        ctx.moveTo(x, y + row);
        ctx.lineTo(x + width, y + row);
        ctx.stroke();
      }
      
      // Vertical lines with slight curve for realism
      for (let col = 0; col <= width; col += meshSize) {
        ctx.beginPath();
        ctx.moveTo(x + col, y);
        // Add slight sag to vertical lines
        const sag = Math.sin((col / width) * Math.PI) * 3;
        ctx.quadraticCurveTo(x + col + sag, y + height / 2, x + col, y + height);
        ctx.stroke();
      }
      
      // Diamond pattern overlay
      ctx.strokeStyle = netColorDark;
      ctx.lineWidth = 1;
      for (let row = 0; row < height; row += meshSize) {
        for (let col = 0; col < width; col += meshSize) {
          ctx.beginPath();
          ctx.moveTo(x + col + meshSize / 2, y + row);
          ctx.lineTo(x + col + meshSize, y + row + meshSize / 2);
          ctx.lineTo(x + col + meshSize / 2, y + row + meshSize);
          ctx.lineTo(x + col, y + row + meshSize / 2);
          ctx.closePath();
          ctx.stroke();
        }
      }
      
      ctx.restore();
    };

    const render = (game) => {
      ctx.save();
      if (game.screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * game.screenShake, (Math.random() - 0.5) * game.screenShake);
        game.screenShake *= 0.9;
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      gradient.addColorStop(0, '#1a0a2e');
      gradient.addColorStop(0.5, '#16213e');
      gradient.addColorStop(1, '#0f0f23');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      for (let i = 0; i < GAME_WIDTH; i += 4) {
        ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.sin(i * 0.1 + Date.now() * 0.001) * 0.01})`;
        ctx.fillRect(i, 0, 2, GAME_HEIGHT);
      }

      ctx.fillStyle = '#2d2d44';
      ctx.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
      ctx.strokeStyle = '#4a4a6a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(GAME_WIDTH, GROUND_Y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(GAME_WIDTH / 2, 50);
      ctx.lineTo(GAME_WIDTH / 2, GROUND_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw left goal
      const leftGoalX = GOAL_WIDTH;
      const goalY = GROUND_Y - GOAL_HEIGHT;
      
      // Left net
      drawNet(ctx, 0, goalY, GOAL_DEPTH, GOAL_HEIGHT, 'left');
      
      // Left goal frame
      ctx.fillStyle = '#00cccc';
      ctx.fillRect(GOAL_DEPTH, goalY - 8, GOAL_WIDTH + 2, GOAL_HEIGHT + 8); // Post
      ctx.fillRect(0, goalY - 8, GOAL_DEPTH + GOAL_WIDTH, 8); // Crossbar
      
      // Right net
      drawNet(ctx, GAME_WIDTH - GOAL_DEPTH, goalY, GOAL_DEPTH, GOAL_HEIGHT, 'right');
      
      // Right goal frame
      ctx.fillStyle = '#cc4444';
      ctx.fillRect(GAME_WIDTH - GOAL_DEPTH - GOAL_WIDTH - 2, goalY - 8, GOAL_WIDTH + 2, GOAL_HEIGHT + 8); // Post
      ctx.fillRect(GAME_WIDTH - GOAL_DEPTH - GOAL_WIDTH, goalY - 8, GOAL_DEPTH + GOAL_WIDTH, 8); // Crossbar

      if (game.goalFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${game.goalFlash * 0.3})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        game.goalFlash *= 0.9;
      }

      game.ball.trail.forEach((t, i) => {
        const alpha = (1 - t.age / 10) * 0.3;
        const size = BALL_RADIUS * (1 - t.age / 15);
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,100,${alpha})`;
        ctx.fill();
      });

      const { ball } = game;
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rotation);
      
      const ballGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, BALL_RADIUS);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.5, '#ffee00');
      ballGrad.addColorStop(1, '#ffaa00');
      ctx.beginPath();
      ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = ballGrad;
      ctx.fill();
      
      ctx.strokeStyle = '#cc8800';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(-BALL_RADIUS * 0.5, 0);
      ctx.lineTo(BALL_RADIUS * 0.5, 0);
      ctx.moveTo(0, -BALL_RADIUS * 0.5);
      ctx.lineTo(0, BALL_RADIUS * 0.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      ctx.shadowColor = 'rgba(255,200,0,0.5)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_RADIUS + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,200,0,0.3)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      game.powerUps.forEach((pu: PowerUp) => {
        if (!pu.active) return;
        const puY = pu.y + Math.sin(pu.bobTimer) * 5;
        const blink = pu.timer < 3 ? (Math.sin(Date.now() * 0.02) > 0 ? 1 : 0.3) : 1;
        ctx.globalAlpha = blink;
        ctx.shadowColor = POWER_UP_COLORS[pu.type];
        ctx.shadowBlur = 15;
        ctx.fillStyle = POWER_UP_COLORS[pu.type];
        ctx.beginPath();
        ctx.arc(pu.x, puY, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(POWER_UP_LABELS[pu.type], pu.x, puY);
        ctx.textBaseline = 'alphabetic';
        ctx.globalAlpha = 1;
      });

      game.slimes.forEach((slime: any, idx: number) => {
        const isWarning = slime.campTime > 60;
        
        const r = slime.radius || SLIME_RADIUS;
        ctx.save();
        ctx.translate(slime.x, slime.y);
        ctx.scale(1 / slime.squash, slime.squash);

        const slimeGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
        if (slime.frozen > 0) {
          slimeGrad.addColorStop(0, '#aaddff');
          slimeGrad.addColorStop(1, '#6699cc');
        } else if (slime.speedBoost > 0) {
          slimeGrad.addColorStop(0, idx === 0 ? '#88ffcc' : '#ffcc88');
          slimeGrad.addColorStop(1, '#00ff88');
        } else {
          slimeGrad.addColorStop(0, idx === 0 ? '#88ffff' : '#ff8888');
          slimeGrad.addColorStop(1, slime.color);
        }

        ctx.beginPath();
        ctx.arc(0, 0, r, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = slimeGrad;
        ctx.fill();

        ctx.strokeStyle = slime.frozen > 0 ? '#4488aa' : idx === 0 ? '#00aaaa' : '#aa0000';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(idx === 0 ? 15 : -15, -20, 12, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        
        const lookX = (ball.x - slime.x) * 0.05;
        const lookY = (ball.y - slime.y) * 0.03;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc((idx === 0 ? 15 : -15) + Math.max(-5, Math.min(5, lookX)), -20 + Math.max(-3, Math.min(3, lookY)), 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        if (isWarning) {
          ctx.fillStyle = `rgba(255,0,0,${0.5 + Math.sin(Date.now() * 0.01) * 0.3})`;
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('⚠ CAMPING!', slime.x, slime.y - SLIME_RADIUS - 20);
        }

        ctx.shadowColor = slime.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(slime.x, GROUND_Y, SLIME_RADIUS * 0.8, Math.PI, 0);
        ctx.strokeStyle = 'transparent';
        ctx.stroke();
        ctx.shadowBlur = 0;
      });

      game.particles.forEach(p => {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.restore();
    };

    const gameLoop = (timestamp) => {
      const targetFPS = 60;
      const frameInterval = 1000 / targetFPS;
      
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      
      if (delta >= frameInterval) {
        lastTimeRef.current = timestamp - (delta % frameInterval);
        const game = gameRef.current;
        
        handleInput(game);
        updateAI(game);
        updatePowerUps(game, frameInterval / 1000);
        const goal = handleCollisions(game);
        
        if (goal) {
          setScores(prev => ({ ...prev, [goal]: prev[goal] + 1 }));
          game.screenShake = 20;
          game.goalFlash = 1;
          game.lastGoalSide = goal;
          
          for (let i = 0; i < 30; i++) {
            game.particles.push({
              x: goal === 'left' ? GOAL_WIDTH : GAME_WIDTH - GOAL_WIDTH,
              y: GROUND_Y - GOAL_HEIGHT / 2,
              vx: (goal === 'left' ? 1 : -1) * (Math.random() * 10 + 5),
              vy: (Math.random() - 0.5) * 15,
              life: 50,
              color: goal === 'left' ? '#00ffff' : '#ff4444'
            });
          }
          
          setTimeout(() => {
            if (gameRef.current) {
              gameRef.current.ball = { x: GAME_WIDTH / 2, y: 80, vx: 0, vy: 0, rotation: 0, rotationSpeed: 0, trail: [] };
              gameRef.current.slimes[0] = { ...gameRef.current.slimes[0], x: 150, y: GROUND_Y, vx: 0, vy: 0 };
              gameRef.current.slimes[1] = { ...gameRef.current.slimes[1], x: GAME_WIDTH - 150, y: GROUND_Y, vx: 0, vy: 0 };
            }
          }, 1000);
        }
        
        render(game);
      }
      
      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationId);
  }, [gameState, gameMode, initGame, scores.left]);

  const startGame = (mode: string) => {
    setGameMode(mode);
    setScores({ left: 0, right: 0 });
    setTimeLeft(gameDuration * 60);
    setWinner(null);
    setPowerUpsCollected(0);
    powerUpsCollectedRef.current = 0;
    setGameState('playing');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (gameState === 'menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-black text-white p-4">
        <div className="absolute top-4 left-4">
          <button
            onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg shadow-md transition-all"
          >
            <Home className="w-5 h-5" />
            <span>Exit Game</span>
          </button>
        </div>

        <h1 className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
          SLIME SOCCER
        </h1>
        <p className="text-xl mb-8 text-cyan-300">SHOWDOWN</p>
        
        <div className="mb-8">
          <p className="text-center mb-2 text-gray-300">Match Duration</p>
          <div className="flex gap-2">
            {[1, 2, 3, 5, 8].map(min => (
              <button
                key={min}
                onClick={() => setGameDuration(min)}
                className={`px-4 py-2 rounded-lg font-bold transition-all ${
                  gameDuration === min 
                    ? 'bg-cyan-500 text-black scale-110' 
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                {min}m
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <button
            onClick={() => startGame('single')}
            className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl font-bold text-xl hover:scale-105 transition-transform shadow-lg shadow-cyan-500/30"
          >
            🤖 VS AI
          </button>
          <button
            onClick={() => startGame('multi')}
            className="px-8 py-4 bg-gradient-to-r from-pink-500 to-red-500 rounded-xl font-bold text-xl hover:scale-105 transition-transform shadow-lg shadow-pink-500/30"
          >
            👥 LOCAL 2P
          </button>
        </div>

        <div className="text-sm text-gray-400 text-center max-w-md">
          <p className="mb-2"><span className="text-cyan-400">CYAN:</span> Arrow Keys (up or Space to Jump)</p>
          <p><span className="text-red-400">RED:</span> WASD (W to Jump)</p>
          <p className="mt-2 text-green-400 text-xs">Collect power-ups: SPEED / BIG / FREEZE</p>
        </div>

        {matchHistory.length > 0 && (
          <div className="mt-8 w-full max-w-md">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 mx-auto text-gray-400 hover:text-white transition-colors text-sm"
            >
              <Trophy className="w-4 h-4" />
              {showHistory ? 'Hide' : 'Show'} Match History
            </button>
            {showHistory && (
              <div className="mt-4 bg-white/5 rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                {matchHistory.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${m.result === 'win' ? 'text-green-400' : m.result === 'loss' ? 'text-red-400' : 'text-gray-400'}`}>
                      {m.result.toUpperCase()}
                    </span>
                    <span className="text-white/60">
                      {m.player_score} - {m.opponent_score}
                    </span>
                    <span className="text-white/30">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-900 via-blue-900 to-black text-white p-4">
        <div className="absolute top-4 left-4">
          <button
            onClick={() => {
              const companionId = searchParams.get('companion');
              navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg shadow-md transition-all"
          >
            <Home className="w-5 h-5" />
            <span>Exit Game</span>
          </button>
        </div>

        <h1 className="text-5xl font-bold mb-4">GAME OVER</h1>
        <div className="text-6xl font-bold mb-4">
          <span className="text-cyan-400">{scores.left}</span>
          <span className="mx-4">-</span>
          <span className="text-red-400">{scores.right}</span>
        </div>
        <p className="text-3xl mb-8">
          {winner === 'Tie' ? "IT'S A TIE!" : <><span className={winner === 'Cyan' ? 'text-cyan-400' : 'text-red-400'}>{winner.toUpperCase()}</span> WINS!</>}
        </p>
        <button
          onClick={() => setGameState('menu')}
          className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-bold text-xl hover:scale-105 transition-transform"
        >
          PLAY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black p-2">
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => {
            const companionId = searchParams.get('companion');
            navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-all"
        >
          <Home className="w-5 h-5" />
          <span>Exit Game</span>
        </button>
      </div>

      <div className="flex justify-between w-full max-w-4xl mb-2 px-4">
        <div className="text-4xl font-bold text-cyan-400">{scores.left}</div>
        <div className="text-2xl font-mono text-white bg-gray-800 px-4 py-1 rounded-lg">{formatTime(timeLeft)}</div>
        <div className="text-4xl font-bold text-red-400">{scores.right}</div>
      </div>
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="border-4 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/30"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
      <button
        onClick={() => setGameState('menu')}
        className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
      >
        ← Back to Menu
      </button>
    </div>
  );
};

export default SlimeSoccer;
