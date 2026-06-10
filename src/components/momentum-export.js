// ============================================
// MOMENTUM - AI-Generated Platformer
// ============================================
// 
// DEPENDENCIES:
// - React 18+
// - Tailwind CSS (for UI screens only, game uses Canvas)
//
// API REQUIREMENT:
// - Anthropic API access (for theme generation)
// - Replace the fetch URL if using a proxy/backend
//
// INTEGRATION NOTES:
// - This is a self-contained component
// - Export as default, import wherever needed
// - Canvas renders at 800x600, adjust GAME_WIDTH/HEIGHT if needed
// - Mobile touch controls included
//
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';

// === GAME CONSTANTS ===
const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const PLAYER_WIDTH = 22;
const PLAYER_HEIGHT = 22;
const GRAVITY = 0.55;
const HORIZONTAL_SPEED = 4.5;
const BOUNCE_VELOCITY = -13;
const BOOST_VELOCITY = -8;
const BOOST_HORIZONTAL = 2.5;
const PLATFORM_HEIGHT = 14;
const MAX_BOOST_FUEL = 100;
const BOOST_COST = 50;
const FUEL_REGEN = 35;

// === THEME PRESETS ===
const themePresets = [
  { name: 'Neon Cityscape', icon: '🌃', hint: 'Cyberpunk rooftops' },
  { name: 'Ancient Ruins', icon: '🏛️', hint: 'Crumbling temples' },
  { name: 'Candy Kingdom', icon: '🍭', hint: 'Sweet dreamland' },
  { name: 'Deep Ocean', icon: '🌊', hint: 'Bioluminescent depths' },
  { name: 'Volcanic Forge', icon: '🌋', hint: 'Molten fire' },
  { name: 'Crystal Caves', icon: '💎', hint: 'Shimmering underground' },
];

// === PROCEDURAL PLATFORM GENERATION ===
const generatePlatforms = (level, themeColors) => {
  const platformCount = 60 + level * 10;
  const platforms = [];
  let currentY = 520;
  let lastFarIndex = -5;
  
  for (let i = 0; i < platformCount; i++) {
    const isFirst = i === 0;
    const isCheckpoint = i > 0 && i % 20 === 0;
    
    const canBeFar = i - lastFarIndex >= 3 && i > 5 && !isCheckpoint;
    const farChance = Math.min(0.12 + level * 0.02, 0.22);
    const isFar = canBeFar && Math.random() < farChance;
    if (isFar) lastFarIndex = i;
    
    let gap;
    if (isFirst) gap = 0;
    else if (isCheckpoint) gap = 60;
    else if (isFar) gap = 140 + Math.random() * (50 + level * 5);
    else gap = 55 + Math.random() * (35 + level * 3);
    
    currentY -= gap;
    
    const width = isFirst ? 150 : isCheckpoint ? 180 : isFar ? 70 + Math.random() * 30 : 80 + Math.random() * (50 - level * 2);
    const startX = isFirst ? 325 : isCheckpoint ? GAME_WIDTH / 2 - 90 : 50 + Math.random() * (GAME_WIDTH - 150 - width);
    const moveRange = isFirst ? 100 : isCheckpoint ? 60 : 120 + Math.random() * 140;
    const speed = isFirst ? 0.3 : isCheckpoint ? 0.4 : (0.4 + level * 0.1) + Math.random() * (0.6 + level * 0.15);
    
    const colorIndex = i % themeColors.platforms.length;
    
    platforms.push({
      id: i,
      y: currentY,
      width: Math.max(60, width),
      startX,
      x: startX,
      moveRange,
      speed: Math.min(speed, 2.5),
      direction: Math.random() > 0.5 ? 1 : -1,
      color: isCheckpoint ? themeColors.checkpoint : themeColors.platforms[colorIndex],
      glow: isCheckpoint ? themeColors.checkpointGlow : themeColors.glows[colorIndex],
      isFar,
      isCheckpoint,
      touched: false,
      minX: Math.max(0, startX - moveRange / 2),
      maxX: Math.min(GAME_WIDTH - width, startX + moveRange / 2)
    });
  }
  
  return { platforms, goalY: currentY - 50 };
};

// === MAIN COMPONENT ===
export default function MomentumGame() {
  const [gameState, setGameState] = useState('menu');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [level, setLevel] = useState(1);
  const [levelData, setLevelData] = useState(null);
  const [score, setScore] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [finalTime, setFinalTime] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(0);
  
  const playerRef = useRef({ x: 100, y: 300, prevY: 300, vx: 0, vy: 0, boostFuel: MAX_BOOST_FUEL, isBoosting: false, boostTimer: 0 });
  const trailRef = useRef([]);
  const platformsRef = useRef([]);
  const particlesRef = useRef([]);
  const keysRef = useRef({ left: false, right: false, boost: false, boostUsed: false });
  const cameraYRef = useRef(0);
  const gameLoopRef = useRef();
  const canvasRef = useRef(null);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const lastPlatformRef = useRef(-1);
  const startYRef = useRef(0);
  const goalYRef = useRef(0);
  const highestYRef = useRef(520);
  const checkpointYRef = useRef(520);
  const startTimeRef = useRef(0);
  const elapsedTimeRef = useRef(0);

  // === AI THEME GENERATION ===
  // NOTE: If you're using a backend proxy, change this URL
  const generateThemeWithAI = async (selectedTheme, currentLevel) => {
    setLoadingText('Painting your world...');
    
    const prompt = `Generate a color theme for: "${selectedTheme}"

Return ONLY valid JSON, no markdown:
{
  "levelName": "creative 2-4 word name",
  "background": ["#hex1", "#hex2"],
  "playerColor": "#hex",
  "playerGlow": "#hex",
  "boostTrailColor": "#hex (bright/electric)",
  "platforms": ["#hex1", "#hex2", "#hex3"],
  "glows": ["#hex1", "#hex2", "#hex3"],
  "checkpoint": "#hex (distinct, safe color)",
  "checkpointGlow": "#hex",
  "flavorText": "5-8 word atmosphere"
}

Make colors cohesive and atmospheric for the theme.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content[0].text;
      const cleaned = text.replace(/```json\n?|```\n?/g, '').trim();
      const themeConfig = JSON.parse(cleaned);
      
      const { platforms, goalY } = generatePlatforms(currentLevel, themeConfig);
      
      platformsRef.current = platforms;
      const firstPlatform = platforms[0];
      playerRef.current = { 
        x: firstPlatform.startX + firstPlatform.width / 2 - PLAYER_WIDTH / 2, 
        y: 520 - PLAYER_HEIGHT - 2, 
        prevY: 520 - PLAYER_HEIGHT - 2,
        vx: 0, 
        vy: 0,
        boostFuel: MAX_BOOST_FUEL,
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
      startTimeRef.current = Date.now();
      elapsedTimeRef.current = 0;
      
      setLevelData({ ...themeConfig, goalY });
      setScore(0);
      setGameState('playing');
    } catch (error) {
      console.error('Theme generation failed:', error);
      setLoadingText('Retrying...');
      setTimeout(() => generateThemeWithAI(selectedTheme, currentLevel), 1000);
    }
  };

  // === PARTICLE EFFECTS ===
  const spawnParticles = (x, y, color, count = 6, spread = 8) => {
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

  const spawnBoostParticles = (x, y, color) => {
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

  // === COLLISION DETECTION ===
  const checkCollision = (player, platform) => {
    const playerBottom = player.y + PLAYER_HEIGHT;
    const playerPrevBottom = player.prevY + PLAYER_HEIGHT;
    const platformTop = platform.y;
    const platformLeft = platform.x - 10;
    const platformRight = platform.x + platform.width + 10;
    const playerCenterX = player.x + PLAYER_WIDTH / 2;
    
    const wasAbove = playerPrevBottom <= platformTop + 6;
    const nowAtOrBelow = playerBottom >= platformTop - 2;
    const horizontalOverlap = playerCenterX >= platformLeft && playerCenterX <= platformRight;
    const isFalling = player.vy > 0;
    
    return wasAbove && nowAtOrBelow && horizontalOverlap && isFalling;
  };

  // === CHECKPOINT RESPAWN ===
  const respawnAtCheckpoint = () => {
    const player = playerRef.current;
    const checkpointPlatform = platformsRef.current.find(p => p.isCheckpoint && p.y >= checkpointYRef.current && p.touched) 
      || platformsRef.current[0];
    
    player.x = checkpointPlatform.x + checkpointPlatform.width / 2 - PLAYER_WIDTH / 2;
    player.y = checkpointPlatform.y - PLAYER_HEIGHT - 2;
    player.prevY = player.y;
    player.vx = 0;
    player.vy = 0;
    player.boostFuel = MAX_BOOST_FUEL;
    cameraYRef.current = Math.max(0, GAME_HEIGHT / 2.5 - player.y);
    comboRef.current = 0;
  };

  // === MAIN GAME LOOP ===
  const gameLoop = useCallback(() => {
    if (gameState !== 'playing' || !levelData) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const player = playerRef.current;
    const platforms = platformsRef.current;
    const keys = keysRef.current;

    elapsedTimeRef.current = (Date.now() - startTimeRef.current) / 1000;

    // Update platforms
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

    // Input
    if (keys.left) player.vx = -HORIZONTAL_SPEED;
    else if (keys.right) player.vx = HORIZONTAL_SPEED;
    else player.vx *= 0.82;

    // Boost
    if (keys.boost && !keys.boostUsed && player.boostFuel >= BOOST_COST && player.vy > -10) {
      player.vy += BOOST_VELOCITY;
      if (keys.left) player.vx -= BOOST_HORIZONTAL;
      if (keys.right) player.vx += BOOST_HORIZONTAL;
      player.boostFuel -= BOOST_COST;
      player.isBoosting = true;
      player.boostTimer = 25;
      keys.boostUsed = true;
      spawnParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.boostTrailColor || '#00ffff', 12, 12);
    }
    if (!keys.boost) keys.boostUsed = false;

    if (player.boostTimer > 0) {
      player.boostTimer--;
      spawnBoostParticles(player.x + PLAYER_WIDTH/2, player.y + PLAYER_HEIGHT, levelData.boostTrailColor || '#00ffff');
    } else {
      player.isBoosting = false;
    }

    // Trail
    if (player.isBoosting || player.boostTimer > 0) {
      trailRef.current.push({ x: player.x + PLAYER_WIDTH/2, y: player.y + PLAYER_HEIGHT/2, life: 1 });
      if (trailRef.current.length > 20) trailRef.current.shift();
    }
    trailRef.current = trailRef.current.filter(t => { t.life -= 0.08; return t.life > 0; });

    // Physics
    player.vy += GRAVITY;
    if (player.vy > 18) player.vy = 18;
    player.x += player.vx;
    player.y += player.vy;

    // Boundaries
    if (player.x < 0) { player.x = 0; player.vx = 0; }
    if (player.x > GAME_WIDTH - PLAYER_WIDTH) { player.x = GAME_WIDTH - PLAYER_WIDTH; player.vx = 0; }

    // Running score
    if (player.y < highestYRef.current) {
      const heightGained = highestYRef.current - player.y;
      scoreRef.current += Math.floor(heightGained * (1 + comboRef.current * 0.1));
      highestYRef.current = player.y;
      setScore(scoreRef.current);
    }

    // Platform collision
    for (let i = 0; i < platforms.length; i++) {
      const platform = platforms[i];
      
      if (checkCollision(player, platform)) {
        player.y = platform.y - PLAYER_HEIGHT;
        player.vy = BOUNCE_VELOCITY - (level * 0.3);
        
        if (lastPlatformRef.current !== platform.id) {
          if (!platform.touched) {
            platform.touched = true;
            player.boostFuel = Math.min(MAX_BOOST_FUEL, player.boostFuel + FUEL_REGEN);
            scoreRef.current += 50 * (1 + comboRef.current);
            setScore(scoreRef.current);
            
            if (platform.isCheckpoint) {
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

    // Camera
    const targetCameraY = Math.max(0, GAME_HEIGHT / 2.5 - player.y);
    cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.06;
    const camY = cameraYRef.current;

    // Particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12;
      p.life -= 0.025;
      return p.life > 0;
    });

    // Win
    if (player.y < levelData.goalY) {
      const time = elapsedTimeRef.current;
      const targetTime = 45 + level * 5;
      const bonus = Math.max(0, Math.floor((targetTime - time) * 100));
      setFinalTime(time);
      setSpeedBonus(bonus);
      scoreRef.current += bonus;
      setScore(scoreRef.current);
      setGameState('levelComplete');
      return;
    }

    // Death
    if (player.y - camY > GAME_HEIGHT + 80) {
      if (checkpointYRef.current < 500) {
        respawnAtCheckpoint();
        comboRef.current = 0;
      } else {
        setGameState('gameOver');
        return;
      }
    }

    // === RENDER ===
    const bg = levelData.background || ['#1a1a2e', '#0f3460'];
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, bg[0]);
    gradient.addColorStop(1, bg[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Progress bar
    const progress = Math.max(0, Math.min(1, (startYRef.current - player.y) / (startYRef.current - goalYRef.current)));
    const barHeight = GAME_HEIGHT - 140;
    const barX = GAME_WIDTH - 20;
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

    // Goal
    const goalScreenY = levelData.goalY + camY;
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

    // Platforms
    platforms.forEach(platform => {
      const screenY = platform.y + camY;
      if (screenY < -30 || screenY > GAME_HEIGHT + 30) return;
      
      const alpha = platform.touched ? 0.4 : 1;
      const glowSize = platform.touched ? 6 : platform.isCheckpoint ? 30 : platform.isFar ? 22 : 14;
      
      ctx.shadowColor = platform.glow || platform.color;
      ctx.shadowBlur = glowSize;
      ctx.fillStyle = platform.color;
      ctx.globalAlpha = alpha;
      
      ctx.beginPath();
      ctx.roundRect(platform.x, screenY, platform.width, PLATFORM_HEIGHT, platform.isCheckpoint ? 4 : 7);
      ctx.fill();
      
      if (platform.isCheckpoint && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.8;
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('⚑ CHECKPOINT', platform.x + platform.width/2, screenY - 8);
      }
      
      if (platform.isFar && !platform.touched) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.008) * 0.3;
        ctx.beginPath();
        ctx.arc(platform.x + platform.width/2, screenY + PLATFORM_HEIGHT/2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    });

    // Boost trail
    if (trailRef.current.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < trailRef.current.length; i++) {
        const t = trailRef.current[i];
        const prev = trailRef.current[i-1];
        ctx.strokeStyle = levelData.boostTrailColor || '#00ffff';
        ctx.globalAlpha = t.life * 0.7;
        ctx.lineWidth = t.life * 12;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y + camY);
        ctx.lineTo(t.x, t.y + camY);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Particles
    particlesRef.current.forEach(p => {
      const screenY = p.y + camY;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, screenY, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Player
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
    
    ctx.fillStyle = player.isBoosting ? (levelData.boostTrailColor || '#00ffff') : (levelData.playerColor || '#ffffff');
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_WIDTH/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`LEVEL ${level}`, 16, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '16px system-ui';
    ctx.fillText(levelData.levelName || '', 16, 42);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'italic 10px system-ui';
    ctx.fillText(levelData.flavorText || '', 16, 58);
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(elapsedTimeRef.current.toFixed(1) + 's', GAME_WIDTH / 2, 24);
    
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px system-ui';
    ctx.fillText('SCORE', GAME_WIDTH - 40, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '20px system-ui';
    ctx.fillText(scoreRef.current.toLocaleString(), GAME_WIDTH - 40, 46);
    
    if (comboRef.current > 1) {
      ctx.fillStyle = levelData.boostTrailColor || '#00ffff';
      ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.01) * 0.3;
      ctx.font = 'bold 13px system-ui';
      ctx.fillText(`${comboRef.current}x COMBO`, GAME_WIDTH - 40, 64);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(16, GAME_HEIGHT - 28, 100, 6);
    const fuelColor = player.boostFuel >= BOOST_COST ? (levelData.boostTrailColor || '#00ffff') : 'rgba(255,100,100,0.6)';
    ctx.fillStyle = fuelColor;
    ctx.fillRect(16, GAME_HEIGHT - 28, player.boostFuel, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('BOOST [SPACE]', 16, GAME_HEIGHT - 36);

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, levelData, level]);

  // === EFFECTS ===
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState, gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = true;
      if (e.key === ' ') { e.preventDefault(); keysRef.current.boost = true; }
    };
    const handleKeyUp = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keysRef.current.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keysRef.current.right = false;
      if (e.key === ' ') keysRef.current.boost = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // === GAME ACTIONS ===
  const selectTheme = (t) => {
    setTheme(t);
    setGameState('loading');
    generateThemeWithAI(t, level);
  };

  const nextLevel = () => {
    setLevel(l => l + 1);
    setGameState('themeSelect');
  };

  const restart = () => {
    setLevel(1);
    setScore(0);
    scoreRef.current = 0;
    setGameState('themeSelect');
  };

  const retryLevel = () => {
    const { platforms, goalY } = generatePlatforms(level, levelData);
    platformsRef.current = platforms;
    
    const firstPlatform = platforms[0];
    playerRef.current = { 
      x: firstPlatform.startX + firstPlatform.width / 2 - PLAYER_WIDTH / 2, 
      y: 520 - PLAYER_HEIGHT - 2, 
      prevY: 520 - PLAYER_HEIGHT - 2,
      vx: 0, 
      vy: 0,
      boostFuel: MAX_BOOST_FUEL,
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
    startTimeRef.current = Date.now();
    elapsedTimeRef.current = 0;
    
    setScore(0);
    setLevelData(prev => ({ ...prev, goalY }));
    setGameState('playing');
  };

  // === RENDER SCREENS ===
  if (gameState === 'menu') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #0d0d1a 0%, #1a1a3e 50%, #0a1628 100%)', maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <h1 className="text-5xl font-extralight tracking-[0.3em] text-white mb-1" style={{ textShadow: '0 0 60px rgba(255,255,255,0.2)' }}>MOMENTUM</h1>
        <p className="text-gray-500 text-xs tracking-[0.2em] mb-10">AI-GENERATED PLATFORMER</p>
        
        <div className="text-gray-400 text-sm mb-4 text-center space-y-3">
          <p>Auto-bounce up • Score while ascending</p>
          <div className="flex justify-center gap-3">
            <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">← A</span>
            <span className="px-4 py-2 bg-white/5 rounded-lg text-white/80 text-xs">D →</span>
            <span className="px-4 py-2 bg-cyan-500/20 rounded-lg text-cyan-300 text-xs">SPACE Boost</span>
          </div>
          <p className="text-gray-600 text-xs">Checkpoints save progress • Speed bonus at finish</p>
        </div>
        
        <button onClick={() => setGameState('themeSelect')} className="mt-6 px-14 py-4 bg-white/5 hover:bg-white/10 text-white/90 rounded-full transition-all duration-500 tracking-[0.15em] text-sm border border-white/10">
          BEGIN
        </button>
      </div>
    );
  }

  if (gameState === 'themeSelect') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #0d0d1a 0%, #1a1a3e 50%, #0a1628 100%)', maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {level}</p>
        <h2 className="text-2xl font-extralight text-white tracking-wider mb-8">Choose Your World</h2>
        
        <div className="grid grid-cols-3 gap-3 mb-8 w-full max-w-lg">
          {themePresets.map((t) => (
            <button key={t.name} onClick={() => selectTheme(t.name)} className="group p-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl transition-all duration-300 text-left border border-white/5 hover:border-white/10">
              <span className="text-xl block mb-1 opacity-80 group-hover:opacity-100">{t.icon}</span>
              <span className="text-white/90 text-xs block leading-tight">{t.name}</span>
              <span className="text-white/30 text-[10px]">{t.hint}</span>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2 w-full max-w-md">
          <input type="text" value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Or describe your own world..." className="flex-1 px-4 py-3 bg-white/[0.03] rounded-xl text-white placeholder-white/20 outline-none focus:bg-white/[0.06] transition-all text-sm border border-white/5" onKeyDown={(e) => e.key === 'Enter' && customTheme && selectTheme(customTheme)} />
          <button onClick={() => customTheme && selectTheme(customTheme)} disabled={!customTheme} className="px-5 py-3 bg-white/10 hover:bg-white/15 disabled:opacity-20 text-white rounded-xl transition-all text-sm">Create</button>
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #0d0d1a 0%, #1a1a3e 50%, #0a1628 100%)', maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <div className="w-12 h-12 border border-white/20 border-t-cyan-400 rounded-full animate-spin mb-8" />
        <p className="text-white/50 text-sm tracking-wider">{loadingText}</p>
        <p className="text-white/25 text-xs mt-2">{theme}</p>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="relative" style={{ maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="block" />
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 md:hidden">
          <button onTouchStart={() => keysRef.current.left = true} onTouchEnd={() => keysRef.current.left = false} className="w-16 h-16 rounded-full bg-white/10 active:bg-white/25 text-white text-xl select-none">←</button>
          <button onTouchStart={() => { keysRef.current.boost = true; }} onTouchEnd={() => { keysRef.current.boost = false; keysRef.current.boostUsed = false; }} className="w-16 h-16 rounded-full bg-cyan-500/20 active:bg-cyan-500/40 text-cyan-300 text-xs select-none">BOOST</button>
          <button onTouchStart={() => keysRef.current.right = true} onTouchEnd={() => keysRef.current.right = false} className="w-16 h-16 rounded-full bg-white/10 active:bg-white/25 text-white text-xl select-none">→</button>
        </div>
      </div>
    );
  }

  if (gameState === 'levelComplete') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #0d1a0d 0%, #1a3e1a 50%, #0a2810 100%)', maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <p className="text-white/30 text-xs tracking-[0.2em] mb-1">LEVEL {level}</p>
        <h2 className="text-3xl font-extralight text-white mb-1">{levelData?.levelName}</h2>
        <p className="text-emerald-400/80 tracking-[0.2em] text-sm mb-6">COMPLETE</p>
        
        <div className="text-center mb-8 space-y-2">
          <p className="text-white/40 text-xs">TIME</p>
          <p className="text-white text-2xl font-light">{finalTime.toFixed(1)}s</p>
          {speedBonus > 0 && (
            <p className="text-emerald-400 text-sm">+{speedBonus.toLocaleString()} SPEED BONUS</p>
          )}
        </div>
        
        <p className="text-white/40 text-xs mb-1">TOTAL SCORE</p>
        <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>
        
        <button onClick={nextLevel} className="px-14 py-4 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all tracking-[0.15em] text-sm border border-white/10">
          NEXT LEVEL
        </button>
      </div>
    );
  }

  if (gameState === 'gameOver') {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center" style={{ background: 'linear-gradient(160deg, #1a0d0d 0%, #3e1a1a 50%, #280a0a 100%)', maxWidth: GAME_WIDTH, margin: '0 auto' }}>
        <h2 className="text-3xl font-extralight text-white mb-1">MOMENTUM LOST</h2>
        <p className="text-white/30 text-xs tracking-wider mb-8">Level {level} · {levelData?.levelName}</p>
        
        <p className="text-white/40 text-xs mb-1">FINAL SCORE</p>
        <p className="text-white text-4xl font-extralight mb-10">{score.toLocaleString()}</p>
        
        <div className="flex gap-4">
          <button onClick={retryLevel} className="px-10 py-3 bg-white/10 hover:bg-white/15 text-white rounded-full transition-all text-sm border border-white/10">RETRY</button>
          <button onClick={restart} className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/50 rounded-full transition-all text-sm">RESTART</button>
        </div>
      </div>
    );
  }

  return null;
}
