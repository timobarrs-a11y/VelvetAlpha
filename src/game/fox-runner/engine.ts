import type { GameState, InputState, Player, Platform, Enemy, Collectible, Checkpoint, HazardZone } from './types';
import { LEVELS } from './levels';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, T,
  GRAVITY, MAX_FALL_SPEED, PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_MAX_SPEED,
  JUMP_VELOCITY, JUMP_CUT_MULTIPLIER, COYOTE_TIME, STOMP_BOUNCE,
  WALL_SLIDE_SPEED, WALL_JUMP_VEL_X, WALL_JUMP_VEL_Y, WALL_JUMP_COOLDOWN,
  PLAYER_WIDTH, PLAYER_HEIGHT,
  ENEMY_SLIME_SPEED, ENEMY_BAT_SPEED, ENEMY_SPIKY_SPEED, ENEMY_CHASER_SPEED, ENEMY_CHASER_DETECT_RANGE,
  CAMERA_LOOKAHEAD, CAMERA_LERP_X, CAMERA_LERP_Y,
  BERRY_SCORE, GEM_SCORE, STOMP_SCORE, LEVEL_CLEAR_BONUS, POWERUP_SCORE,
  COMBO_WINDOW, COMBO_MULTIPLIER, TIME_BONUS_PER_SECOND,
} from './config';
import {
  renderBackground, renderPlatform, renderSpike, renderCheckpoint,
  renderGoal, renderCollectible, renderFox, renderEnemy, renderParticle, renderHUD,
  renderHazardZone, renderScorePopup,
} from './renderer';
import { FoxRunnerAudio } from './audio';

export interface EngineCallbacks {
  onGameComplete?: (score: number, berries: number, deaths: number, enemiesStomped: number) => void;
}

export class FoxRunnerEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state!: GameState;
  private input: InputState = { left: false, right: false, jump: false, jumpJustPressed: false, pause: false, pauseJustPressed: false };
  private running = false;
  private animFrameId = 0;
  private lastTime = 0;
  private callbacks: EngineCallbacks;
  private jumpBufferTimer = 0;
  private cleanupFn: (() => void) | null = null;
  readonly audio: FoxRunnerAudio = new FoxRunnerAudio();
  private phaseSoundFired = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.callbacks = callbacks;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
  }

  start() {
    this.setupInput();
    this.state = this.createState(0);
    this.state.phase = 'title';
    this.running = true;
    this.lastTime = performance.now();
    this.tick(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.cleanupFn) this.cleanupFn();
    this.audio.destroy();
  }

  getState(): GameState {
    return this.state;
  }

  private setupInput() {
    const keys = new Set<string>();
    const prevKeys = new Set<string>();

    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', ' ', 'w', 'a', 'd', 'escape', 'p'].includes(k)) e.preventDefault();
      keys.add(k);
    };
    const onUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const pollInput = () => {
      this.input.left = keys.has('arrowleft') || keys.has('a');
      this.input.right = keys.has('arrowright') || keys.has('d');
      const jumpNow = keys.has(' ') || keys.has('arrowup') || keys.has('w');
      this.input.jumpJustPressed = jumpNow && !prevKeys.has(' ') && !prevKeys.has('arrowup') && !prevKeys.has('w');
      this.input.jump = jumpNow;
      const pauseNow = keys.has('escape') || keys.has('p');
      this.input.pauseJustPressed = pauseNow && !prevKeys.has('escape') && !prevKeys.has('p');
      this.input.pause = pauseNow;
      prevKeys.clear();
      keys.forEach(k => prevKeys.add(k));
    };

    const origTick = this.tick.bind(this);
    this.tick = (ts: number) => {
      pollInput();
      origTick(ts);
    };

    this.cleanupFn = () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }

  private createState(levelIndex: number): GameState {
    const def = LEVELS[levelIndex];
    const player: Player = {
      pos: { ...def.playerSpawn },
      vel: { x: 0, y: 0 },
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      facing: 1,
      grounded: false,
      jumping: false,
      jumpHeld: false,
      jumpTimer: 0,
      coyoteTimer: 0,
      lives: this.state?.player.lives ?? 3,
      invulnerableTimer: 0,
      animFrame: 0,
      animTimer: 0,
      squash: 1,
      dustTimer: 0,
      dead: false,
      respawnTimer: 0,
      stompBounce: false,
      wallSliding: false,
      wallSlideDir: 1,
      wallJumpCooldown: 0,
      hasDoubleJump: this.state?.player.hasDoubleJump ?? false,
      doubleJumpUsed: false,
    };

    const platforms: Platform[] = def.platforms.map(p => ({
      ...p,
      moveDir: 1,
      crumbleTimer: 0,
      crumbling: false,
      crumbled: false,
      springTimer: 0,
      origX: p.x,
      origY: p.y,
    }));

    const enemies: Enemy[] = def.enemies.map((e, i) => ({
      id: `enemy_${i}`,
      type: e.type,
      pos: { x: e.x, y: e.y },
      vel: { x: 0, y: 0 },
      width: e.type === 'bat' ? 28 : e.type === 'chaser' ? 24 : 26,
      height: e.type === 'bat' ? 18 : e.type === 'chaser' ? 24 : 20,
      active: true,
      facing: 1,
      animFrame: 0,
      animTimer: 0,
      patrolMin: e.patrolMin,
      patrolMax: e.patrolMax,
      baseY: e.y,
      sineTimer: Math.random() * Math.PI * 2,
      deathTimer: 0,
    }));

    const collectibles: Collectible[] = def.collectibles.map((c, i) => ({
      id: `col_${i}`,
      pos: { x: c.x, y: c.y },
      type: c.type,
      collected: false,
      bobTimer: Math.random() * Math.PI * 2,
    }));

    const checkpoints: Checkpoint[] = def.checkpoints.map(c => ({
      x: c.x, y: c.y, activated: false,
    }));

    const hazardZones: HazardZone[] = (def.hazardZones || []).map(h => ({ ...h }));

    return {
      player,
      platforms,
      enemies,
      collectibles,
      spikes: [...def.spikes],
      hazardZones,
      checkpoints,
      goal: { ...def.goal },
      particles: [],
      scorePopups: [],
      camera: { x: def.playerSpawn.x - CANVAS_WIDTH / 3, y: def.playerSpawn.y - CANVAS_HEIGHT / 2 },
      score: this.state?.score ?? 0,
      berries: this.state?.berries ?? 0,
      currentLevel: levelIndex,
      totalLevels: LEVELS.length,
      phase: 'playing',
      levelCompleteTimer: 0,
      deathY: def.deathY,
      background: def.background,
      levelWidth: def.width,
      levelHeight: def.height,
      lastCheckpoint: { ...def.playerSpawn },
      time: 0,
      timeLimit: def.timeLimit || 120,
      enemiesStomped: this.state?.enemiesStomped ?? 0,
      deaths: this.state?.deaths ?? 0,
      comboCount: 0,
      comboTimer: 0,
      gemsCollected: this.state?.gemsCollected ?? 0,
      powerupsCollected: this.state?.powerupsCollected ?? 0,
    };
  }

  private tick = (timestamp: number) => {
    if (!this.running) return;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;
    this.update(dt);
    this.render();
    this.animFrameId = requestAnimationFrame(this.tick);
  };

  private update(dt: number) {
    const s = this.state;

    switch (s.phase) {
      case 'title':
        if (this.input.jumpJustPressed || this.input.pauseJustPressed) {
          this.state = this.createState(0);
          this.state.player.hasDoubleJump = false;
          this.state.phase = 'playing';
          this.phaseSoundFired = false;
          this.audio.startAmbient(this.state.background);
        }
        break;
      case 'playing':
        if (!this.phaseSoundFired) {
          this.audio.startAmbient(s.background);
          this.phaseSoundFired = true;
        }
        this.updatePlaying(dt);
        break;
      case 'paused':
        if (this.input.pauseJustPressed) s.phase = 'playing';
        break;
      case 'level_complete':
        if (!this.phaseSoundFired) {
          this.audio.stopAmbient();
          this.audio.playLevelComplete();
          this.phaseSoundFired = true;
        }
        s.levelCompleteTimer += dt;
        if (s.levelCompleteTimer > 2 && this.input.jumpJustPressed) {
          if (s.currentLevel + 1 >= LEVELS.length) {
            s.phase = 'victory';
            this.phaseSoundFired = false;
            this.callbacks.onGameComplete?.(s.score, s.berries, s.deaths, s.enemiesStomped);
          } else {
            this.state = this.createState(s.currentLevel + 1);
            this.phaseSoundFired = false;
          }
        }
        break;
      case 'game_over':
        if (!this.phaseSoundFired) {
          this.audio.stopAmbient();
          this.audio.playGameOver();
          this.phaseSoundFired = true;
        }
        if (this.input.jumpJustPressed) {
          this.state = this.createState(0);
          this.state.player.lives = 3;
          this.state.player.hasDoubleJump = false;
          this.state.score = 0;
          this.state.berries = 0;
          this.state.deaths = 0;
          this.state.enemiesStomped = 0;
          this.state.gemsCollected = 0;
          this.state.powerupsCollected = 0;
          this.state.phase = 'playing';
          this.phaseSoundFired = false;
        }
        break;
      case 'victory':
        if (!this.phaseSoundFired) {
          this.audio.stopAmbient();
          this.audio.playVictory();
          this.phaseSoundFired = true;
        }
        if (this.input.jumpJustPressed) {
          this.state = this.createState(0);
          this.state.player.lives = 3;
          this.state.player.hasDoubleJump = false;
          this.state.score = 0;
          this.state.berries = 0;
          this.state.deaths = 0;
          this.state.enemiesStomped = 0;
          this.state.gemsCollected = 0;
          this.state.powerupsCollected = 0;
          this.state.phase = 'title';
          this.phaseSoundFired = false;
        }
        break;
    }
  }

  private updatePlaying(dt: number) {
    const s = this.state;
    const p = s.player;
    s.time += dt;

    if (this.input.pauseJustPressed) { s.phase = 'paused'; return; }

    if (p.dead) {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) this.respawnPlayer();
      return;
    }

    if (p.invulnerableTimer > 0) p.invulnerableTimer -= dt;
    if (p.wallJumpCooldown > 0) p.wallJumpCooldown--;
    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.comboCount = 0;
    }

    if (this.input.left) { p.vel.x -= PLAYER_ACCEL; p.facing = -1; }
    else if (this.input.right) { p.vel.x += PLAYER_ACCEL; p.facing = 1; }
    else { p.vel.x *= PLAYER_FRICTION; }

    const maxSpd = PLAYER_MAX_SPEED;
    p.vel.x = Math.max(-maxSpd, Math.min(maxSpd, p.vel.x));
    if (Math.abs(p.vel.x) < 0.1 && !this.input.left && !this.input.right) p.vel.x = 0;

    if (this.input.jumpJustPressed) this.jumpBufferTimer = 6;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer--;

    if (this.jumpBufferTimer > 0 && (p.grounded || p.coyoteTimer > 0)) {
      p.vel.y = JUMP_VELOCITY;
      p.jumping = true;
      p.jumpHeld = true;
      p.grounded = false;
      p.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      p.squash = 1.3;
      p.doubleJumpUsed = false;
      p.wallSliding = false;
      this.spawnDust(p.pos.x + p.width / 2, p.pos.y + p.height, 4);
      this.audio.playJump();
    } else if (this.input.jumpJustPressed && p.wallSliding && p.wallJumpCooldown <= 0) {
      p.vel.y = WALL_JUMP_VEL_Y;
      p.vel.x = WALL_JUMP_VEL_X * (-p.wallSlideDir);
      p.facing = -p.wallSlideDir as 1 | -1;
      p.jumping = true;
      p.jumpHeld = true;
      p.wallSliding = false;
      p.wallJumpCooldown = WALL_JUMP_COOLDOWN;
      p.squash = 1.2;
      this.jumpBufferTimer = 0;
      this.spawnDust(p.pos.x + (p.wallSlideDir === 1 ? p.width : 0), p.pos.y + p.height / 2, 5);
      this.audio.playWallJump();
    } else if (this.input.jumpJustPressed && p.hasDoubleJump && !p.doubleJumpUsed && !p.grounded && !p.wallSliding) {
      p.vel.y = JUMP_VELOCITY * 0.85;
      p.jumping = true;
      p.jumpHeld = true;
      p.doubleJumpUsed = true;
      p.squash = 1.2;
      this.jumpBufferTimer = 0;
      this.spawnDoubleJumpParticles(p.pos.x + p.width / 2, p.pos.y + p.height);
      this.audio.playDoubleJump();
    }

    if (p.jumping && p.jumpHeld && !this.input.jump && p.vel.y < 0) {
      p.vel.y *= JUMP_CUT_MULTIPLIER;
      p.jumpHeld = false;
    }

    p.wallSliding = false;
    if (!p.grounded && p.vel.y > 0 && p.wallJumpCooldown <= 0) {
      const wallDir = this.checkWallContact(p);
      if (wallDir !== 0 && ((wallDir === 1 && this.input.right) || (wallDir === -1 && this.input.left))) {
        p.wallSliding = true;
        p.wallSlideDir = wallDir as 1 | -1;
        if (p.vel.y > WALL_SLIDE_SPEED) p.vel.y = WALL_SLIDE_SPEED;
      }
    }

    p.vel.y += GRAVITY;
    if (p.vel.y > MAX_FALL_SPEED) p.vel.y = MAX_FALL_SPEED;

    if (p.stompBounce) {
      p.vel.y = STOMP_BOUNCE;
      p.stompBounce = false;
      p.jumping = true;
      p.doubleJumpUsed = false;
    }

    this.updatePlatforms(dt);

    p.pos.x += p.vel.x;
    this.resolveHorizontalCollisions(p);

    const wasGrounded = p.grounded;
    p.grounded = false;
    p.pos.y += p.vel.y;
    this.resolveVerticalCollisions(p);

    if (wasGrounded && !p.grounded) p.coyoteTimer = COYOTE_TIME;
    if (p.coyoteTimer > 0 && !p.grounded) p.coyoteTimer--;
    if (p.grounded) {
      p.jumping = false;
      p.coyoteTimer = 0;
      p.doubleJumpUsed = false;
    }

    if (!wasGrounded && p.grounded) {
      p.squash = 0.7;
      this.spawnDust(p.pos.x + p.width / 2, p.pos.y + p.height, 3);
    }
    p.squash += (1 - p.squash) * 0.15;

    this.audio.tickFootsteps(p.grounded, Math.abs(p.vel.x) > 1, dt);

    if (p.grounded && Math.abs(p.vel.x) > 2) {
      p.dustTimer -= dt;
      if (p.dustTimer <= 0) {
        this.spawnDust(p.pos.x + p.width / 2, p.pos.y + p.height, 1);
        p.dustTimer = 0.15;
      }
    }

    p.animTimer += Math.abs(p.vel.x) * dt * 10;
    p.animFrame = p.animTimer;

    this.updateEnemies(dt);
    this.checkEnemyCollisions();
    this.checkCollectibles();
    this.checkSpikes();
    this.checkHazardZones();
    this.checkCheckpoints();
    this.checkGoal();
    this.updateParticles(dt);
    this.updateScorePopups(dt);
    this.updateCamera(dt);

    if (p.pos.y > s.deathY) this.killPlayer();

    p.pos.x = Math.max(0, Math.min(s.levelWidth - p.width, p.pos.x));
  }

  private checkWallContact(player: Player): number {
    const testDist = 2;
    for (const p of this.state.platforms) {
      if (p.crumbled) continue;
      if (this.aabbOverlap(player.pos.x - testDist, player.pos.y + 2, testDist, player.height - 4, p.x, p.y, p.width, p.height)) {
        return -1;
      }
      if (this.aabbOverlap(player.pos.x + player.width, player.pos.y + 2, testDist, player.height - 4, p.x, p.y, p.width, p.height)) {
        return 1;
      }
    }
    return 0;
  }

  private updatePlatforms(dt: number) {
    for (const p of this.state.platforms) {
      if (p.type === 'moving_h') {
        p.x += p.moveSpeed * p.moveDir;
        if (p.x <= p.moveMin || p.x + p.width >= p.moveMax + p.width) p.moveDir *= -1;
      } else if (p.type === 'moving_v') {
        p.y += p.moveSpeed * p.moveDir;
        if (p.y <= p.moveMin || p.y >= p.moveMax) p.moveDir *= -1;
      } else if (p.type === 'crumbling' && p.crumbling) {
        p.crumbleTimer += dt;
        if (p.crumbleTimer > 0.6) p.crumbled = true;
      }
      if (p.springTimer > 0) p.springTimer -= dt;
    }
  }

  private resolveHorizontalCollisions(player: Player) {
    for (const p of this.state.platforms) {
      if (p.crumbled) continue;
      if (this.aabbOverlap(player.pos.x, player.pos.y, player.width, player.height, p.x, p.y, p.width, p.height)) {
        const playerCenterX = player.pos.x + player.width / 2;
        const platCenterX = p.x + p.width / 2;
        if (playerCenterX < platCenterX) {
          player.pos.x = p.x - player.width;
          if (player.vel.x > 0) player.vel.x = 0;
        } else {
          player.pos.x = p.x + p.width;
          if (player.vel.x < 0) player.vel.x = 0;
        }
      }
    }
  }

  private resolveVerticalCollisions(player: Player) {
    for (const p of this.state.platforms) {
      if (p.crumbled) continue;
      if (!this.aabbOverlap(player.pos.x, player.pos.y, player.width, player.height, p.x, p.y, p.width, p.height)) continue;

      const playerBottom = player.pos.y + player.height;

      if (player.vel.y >= 0 && playerBottom - player.vel.y <= p.y + 4) {
        player.pos.y = p.y - player.height;
        player.vel.y = 0;
        player.grounded = true;

        if (p.type === 'spring') {
          player.vel.y = JUMP_VELOCITY * 1.5;
          player.grounded = false;
          player.jumping = true;
          p.springTimer = 0.3;
          player.squash = 1.4;
          this.audio.playSpring();
        }

        if (p.type === 'crumbling' && !p.crumbling) {
          p.crumbling = true;
          p.crumbleTimer = 0;
          this.audio.playCrumble();
        }

        if (p.type === 'moving_h') {
          player.pos.x += p.moveSpeed * p.moveDir;
        }
      } else if (player.vel.y < 0 && player.pos.y - player.vel.y >= p.y + p.height - 4) {
        player.pos.y = p.y + p.height;
        player.vel.y = 0;
      }
    }
  }

  private updateEnemies(dt: number) {
    const playerPos = this.state.player.pos;
    for (const e of this.state.enemies) {
      if (e.deathTimer > 0) {
        e.deathTimer += dt;
        if (e.deathTimer > 0.4) e.active = false;
        continue;
      }
      if (!e.active) continue;

      e.animTimer += dt;

      if (e.type === 'chaser') {
        const dx = (playerPos.x + PLAYER_WIDTH / 2) - (e.pos.x + e.width / 2);
        const dy = (playerPos.y + PLAYER_HEIGHT / 2) - (e.pos.y + e.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < ENEMY_CHASER_DETECT_RANGE && !this.state.player.dead) {
          const nx = dx / (dist || 1);
          e.vel.x += nx * ENEMY_CHASER_SPEED * 0.15;
          e.vel.x = Math.max(-ENEMY_CHASER_SPEED, Math.min(ENEMY_CHASER_SPEED, e.vel.x));
          e.facing = dx > 0 ? 1 : -1;
        } else {
          e.vel.x *= 0.9;
          const speed = ENEMY_CHASER_SPEED * 0.5;
          if (Math.abs(e.vel.x) < 0.3) {
            e.vel.x = e.facing * speed;
          }
          if (e.pos.x <= e.patrolMin) e.facing = 1;
          if (e.pos.x + e.width >= e.patrolMax) e.facing = -1;
        }
        e.pos.x += e.vel.x;
        e.pos.x = Math.max(e.patrolMin, Math.min(e.patrolMax - e.width, e.pos.x));
      } else if (e.type === 'bat') {
        e.sineTimer += dt * 3;
        e.vel.x = e.facing * ENEMY_BAT_SPEED;
        e.pos.x += e.vel.x;
        e.pos.y = e.baseY + Math.sin(e.sineTimer) * 25;
        if (e.pos.x <= e.patrolMin) { e.facing = 1; }
        if (e.pos.x + e.width >= e.patrolMax) { e.facing = -1; }
      } else {
        const speed = e.type === 'spiky' ? ENEMY_SPIKY_SPEED : ENEMY_SLIME_SPEED;
        e.vel.x = e.facing * speed;
        e.pos.x += e.vel.x;
        e.sineTimer += dt;
        if (e.pos.x <= e.patrolMin) { e.facing = 1; }
        if (e.pos.x + e.width >= e.patrolMax) { e.facing = -1; }
      }
    }
  }

  private checkEnemyCollisions() {
    const p = this.state.player;
    if (p.dead || p.invulnerableTimer > 0) return;

    for (const e of this.state.enemies) {
      if (!e.active || e.deathTimer > 0) continue;
      if (!this.aabbOverlap(p.pos.x, p.pos.y, p.width, p.height, e.pos.x, e.pos.y, e.width, e.height)) continue;

      const playerBottom = p.pos.y + p.height;
      const enemyMidY = e.pos.y + e.height * 0.4;

      if (p.vel.y > 0 && playerBottom < enemyMidY + 8 && e.type !== 'spiky') {
        e.deathTimer = 0.01;
        p.stompBounce = true;
        this.state.comboCount++;
        this.state.comboTimer = COMBO_WINDOW;
        const comboBonus = Math.floor(STOMP_SCORE * (1 + (this.state.comboCount - 1) * COMBO_MULTIPLIER));
        this.state.score += comboBonus;
        this.state.enemiesStomped++;
        const label = this.state.comboCount > 1 ? `${comboBonus} x${this.state.comboCount}` : `+${comboBonus}`;
        this.addScorePopup(e.pos.x + e.width / 2, e.pos.y, label, this.state.comboCount > 1 ? '#FFD700' : '#FFF');
        this.spawnStompParticles(e.pos.x + e.width / 2, e.pos.y + e.height / 2);
        this.audio.playStompCombo(this.state.comboCount);
      } else {
        this.hurtPlayer();
      }
    }
  }

  private checkCollectibles() {
    const p = this.state.player;
    if (p.dead) return;

    for (const c of this.state.collectibles) {
      if (c.collected) continue;
      const dx = (p.pos.x + p.width / 2) - c.pos.x;
      const dy = (p.pos.y + p.height / 2) - c.pos.y;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        c.collected = true;
        if (c.type === 'berry') {
          this.state.score += BERRY_SCORE;
          this.state.berries++;
          this.addScorePopup(c.pos.x, c.pos.y, `+${BERRY_SCORE}`, '#FF4466');
          this.audio.playBerryCollect();
        } else if (c.type === 'gem') {
          this.state.score += GEM_SCORE;
          this.state.gemsCollected++;
          this.addScorePopup(c.pos.x, c.pos.y, `+${GEM_SCORE}`, '#44DDFF');
          this.audio.playGemCollect();
        } else if (c.type === 'heart') {
          if (p.lives < 5) p.lives++;
          this.addScorePopup(c.pos.x, c.pos.y, '+1 HP', '#44FF44');
          this.audio.playHeartCollect();
        } else if (c.type === 'powerup') {
          p.hasDoubleJump = true;
          p.doubleJumpUsed = false;
          this.state.score += POWERUP_SCORE;
          this.state.powerupsCollected++;
          this.addScorePopup(c.pos.x, c.pos.y, 'DOUBLE JUMP!', '#FFD700');
          this.audio.playPowerupCollect();
        }
        this.spawnCollectParticles(c.pos.x, c.pos.y, c.type);
      }
    }
  }

  private checkSpikes() {
    const p = this.state.player;
    if (p.dead || p.invulnerableTimer > 0) return;
    for (const s of this.state.spikes) {
      if (this.aabbOverlap(p.pos.x, p.pos.y, p.width, p.height, s.x, s.y, s.width, s.height)) {
        this.hurtPlayer();
        break;
      }
    }
  }

  private checkHazardZones() {
    const p = this.state.player;
    if (p.dead || p.invulnerableTimer > 0) return;
    for (const hz of this.state.hazardZones) {
      const playerCenterY = p.pos.y + p.height * 0.6;
      if (this.aabbOverlap(p.pos.x, playerCenterY, p.width, p.height * 0.4, hz.x, hz.y, hz.width, hz.height)) {
        if (hz.type === 'lava') {
          this.killPlayer();
        } else {
          this.hurtPlayer();
          p.vel.y = -8;
        }
        break;
      }
    }
  }

  private checkCheckpoints() {
    const p = this.state.player;
    for (const cp of this.state.checkpoints) {
      if (cp.activated) continue;
      if (Math.abs(p.pos.x - cp.x) < T * 1.5 && Math.abs(p.pos.y - cp.y) < T * 2) {
        cp.activated = true;
        this.state.lastCheckpoint = { x: cp.x, y: cp.y };
        this.spawnCollectParticles(cp.x + T / 2, cp.y - T, 'gem');
        this.audio.playCheckpoint();
      }
    }
  }

  private checkGoal() {
    const p = this.state.player;
    const g = this.state.goal;
    if (this.aabbOverlap(p.pos.x, p.pos.y, p.width, p.height, g.x, g.y, g.width, g.height)) {
      this.state.score += LEVEL_CLEAR_BONUS;
      const timeRemaining = Math.max(0, this.state.timeLimit - this.state.time);
      const timeBonus = Math.floor(timeRemaining * TIME_BONUS_PER_SECOND);
      this.state.score += timeBonus;
      this.state.phase = 'level_complete';
      this.state.levelCompleteTimer = 0;
    }
  }

  private hurtPlayer() {
    const p = this.state.player;
    p.lives--;
    if (p.lives <= 0) {
      this.killPlayer();
      this.state.phase = 'game_over';
    } else {
      p.invulnerableTimer = 2;
      p.vel.y = -8;
      p.vel.x = -p.facing * 4;
      this.state.deaths++;
      this.audio.playHurt();
    }
  }

  private killPlayer() {
    const p = this.state.player;
    p.dead = true;
    p.respawnTimer = 1.5;
    p.vel.x = 0;
    p.vel.y = 0;
    this.state.deaths++;
    this.spawnDeathParticles(p.pos.x + p.width / 2, p.pos.y + p.height / 2);
    this.audio.playDeath();
    if (p.lives <= 0) this.state.phase = 'game_over';
  }

  private respawnPlayer() {
    const p = this.state.player;
    p.dead = false;
    p.pos = { ...this.state.lastCheckpoint };
    p.vel = { x: 0, y: 0 };
    p.invulnerableTimer = 2;
    p.squash = 1;
    p.wallSliding = false;
    p.doubleJumpUsed = false;
  }

  private updateCamera(_dt: number) {
    const s = this.state;
    const p = s.player;
    const targetX = p.pos.x + p.width / 2 - CANVAS_WIDTH / 3 + p.facing * CAMERA_LOOKAHEAD;
    const targetY = p.pos.y + p.height / 2 - CANVAS_HEIGHT / 2;
    s.camera.x += (targetX - s.camera.x) * CAMERA_LERP_X;
    s.camera.y += (targetY - s.camera.y) * CAMERA_LERP_Y;
    s.camera.x = Math.max(0, Math.min(s.levelWidth - CANVAS_WIDTH, s.camera.x));
    s.camera.y = Math.max(0, Math.min(s.levelHeight - CANVAS_HEIGHT, s.camera.y));
  }

  private updateParticles(dt: number) {
    const particles = this.state.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.pos.x += p.vel.x;
      p.pos.y += p.vel.y;
      p.vel.y += 0.1;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    if (particles.length > 200) this.state.particles = particles.slice(-150);
  }

  private updateScorePopups(dt: number) {
    const popups = this.state.scorePopups;
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].y -= 40 * dt;
      popups[i].life -= dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
  }

  private addScorePopup(x: number, y: number, text: string, color: string) {
    this.state.scorePopups.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  private spawnDust(x: number, y: number, count: number) {
    for (let i = 0; i < count; i++) {
      this.state.particles.push({
        pos: { x, y: y - 2 },
        vel: { x: (Math.random() - 0.5) * 3, y: -Math.random() * 2 },
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 2,
        color: '#C4A882',
      });
    }
  }

  private spawnDoubleJumpParticles(x: number, y: number) {
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      this.state.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * 3, y: Math.sin(angle) * 1.5 + 1 },
        life: 0.4,
        maxLife: 0.4,
        size: 3,
        color: '#88DDFF',
      });
    }
  }

  private spawnStompParticles(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      this.state.particles.push({
        pos: { x, y },
        vel: { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 - 2 },
        life: 0.5,
        maxLife: 0.5,
        size: 3,
        color: '#FFDD44',
      });
    }
  }

  private spawnCollectParticles(x: number, y: number, type: string) {
    const color = type === 'berry' ? '#FF4466' : type === 'gem' ? '#44DDFF' : type === 'powerup' ? '#FFD700' : '#44FF44';
    for (let i = 0; i < 6; i++) {
      this.state.particles.push({
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 5, y: -Math.random() * 5 },
        life: 0.5,
        maxLife: 0.5,
        size: 2 + Math.random() * 2,
        color,
      });
    }
  }

  private spawnDeathParticles(x: number, y: number) {
    for (let i = 0; i < 15; i++) {
      this.state.particles.push({
        pos: { x, y },
        vel: { x: (Math.random() - 0.5) * 8, y: -Math.random() * 8 },
        life: 0.8,
        maxLife: 0.8,
        size: 3 + Math.random() * 3,
        color: '#E87A22',
      });
    }
  }

  private aabbOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private render() {
    const ctx = this.ctx;
    const s = this.state;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    renderBackground(ctx, s.background, s.camera.x, s.camera.y, s.time);

    ctx.save();
    ctx.translate(-Math.round(s.camera.x), -Math.round(s.camera.y));

    for (const hz of s.hazardZones) renderHazardZone(ctx, hz, s.time);
    for (const p of s.platforms) renderPlatform(ctx, p, s.background);
    for (const sp of s.spikes) renderSpike(ctx, sp);
    for (const cp of s.checkpoints) renderCheckpoint(ctx, cp, s.time);
    renderGoal(ctx, s.goal, s.time);
    for (const c of s.collectibles) renderCollectible(ctx, c, s.time);
    for (const e of s.enemies) renderEnemy(ctx, e, s.time);
    renderFox(ctx, s.player, s.time);
    for (const p of s.particles) renderParticle(ctx, p);
    for (const sp of s.scorePopups) renderScorePopup(ctx, sp);

    ctx.restore();

    renderHUD(ctx, s);

    if (s.phase === 'title') this.renderTitle(ctx);
    else if (s.phase === 'paused') this.renderPaused(ctx);
    else if (s.phase === 'level_complete') this.renderLevelComplete(ctx);
    else if (s.phase === 'game_over') this.renderGameOver(ctx);
    else if (s.phase === 'victory') this.renderVictory(ctx);
  }

  private renderTitle(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const t = this.state.time;
    const bounce = Math.sin(t * 2) * 4;

    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50 + bounce);
    ctx.textAlign = 'center';

    ctx.shadowColor = '#E87A22';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#E87A22';
    ctx.font = 'bold 52px monospace';
    ctx.fillText("LUNA'S RUN", 0, 0);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('A Fox Adventure', 0, 30);

    const foxX = Math.sin(t * 1.5) * 30;
    ctx.fillStyle = '#E87A22';
    ctx.beginPath();
    ctx.ellipse(foxX, 60, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F5DEB3';
    ctx.beginPath();
    ctx.ellipse(foxX, 63, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E87A22';
    ctx.beginPath();
    ctx.moveTo(foxX - 8, 52);
    ctx.lineTo(foxX - 5, 45);
    ctx.lineTo(foxX - 2, 52);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(foxX + 2, 52);
    ctx.lineTo(foxX + 5, 45);
    ctx.lineTo(foxX + 8, 52);
    ctx.fill();

    const blink = Math.sin(t * 6) > 0;
    ctx.fillStyle = blink ? '#FFD700' : '#DAA520';
    ctx.font = '16px monospace';
    ctx.fillText('Press SPACE to Start', 0, 110);

    ctx.fillStyle = '#AAA';
    ctx.font = '11px monospace';
    ctx.fillText('Arrow Keys / WASD to Move', 0, 140);
    ctx.fillText('SPACE to Jump | Wall Jump off walls', 0, 156);
    ctx.fillText('ESC to Pause', 0, 172);

    ctx.restore();
    ctx.textAlign = 'left';
  }

  private renderPaused(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.font = '14px monospace';
    ctx.fillText('Press ESC to Resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);
    ctx.textAlign = 'left';
  }

  private renderLevelComplete(ctx: CanvasRenderingContext2D) {
    const alpha = Math.min(1, this.state.levelCompleteTimer * 2);
    ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = alpha;

    const timeRemaining = Math.max(0, this.state.timeLimit - this.state.time);
    const timeBonus = Math.floor(timeRemaining * TIME_BONUS_PER_SECOND);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LEVEL COMPLETE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);

    ctx.fillStyle = '#FFF';
    ctx.font = '14px monospace';
    ctx.fillText(`Clear Bonus: +${LEVEL_CLEAR_BONUS}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 15);
    ctx.fillStyle = timeBonus > 0 ? '#44FF44' : '#888';
    ctx.fillText(`Time Bonus: +${timeBonus} (${Math.floor(timeRemaining)}s left)`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 5);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`Total: ${this.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30);

    if (this.state.levelCompleteTimer > 2) {
      const blink = Math.sin(this.state.levelCompleteTimer * 5) > 0;
      ctx.fillStyle = blink ? '#FFF' : '#AAA';
      ctx.font = '14px monospace';
      ctx.fillText('Press SPACE to Continue', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    }
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  private renderGameOver(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.shadowColor = '#FF4444';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 42px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = '16px monospace';
    ctx.fillText(`Score: ${this.state.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
    ctx.fillStyle = '#AAA';
    ctx.font = '13px monospace';
    ctx.fillText(`Berries: ${this.state.berries} | Enemies: ${this.state.enemiesStomped} | Deaths: ${this.state.deaths}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);

    const blink = Math.sin(this.state.time * 5) > 0;
    ctx.fillStyle = blink ? '#FFF' : '#AAA';
    ctx.font = '14px monospace';
    ctx.fillText('Press SPACE to Try Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 55);
    ctx.textAlign = 'left';
  }

  private renderVictory(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const t = this.state.time;

    for (let i = 0; i < 20; i++) {
      const px = (i * 97 + t * 30) % CANVAS_WIDTH;
      const py = (i * 67 + Math.sin(t + i) * 50) % CANVAS_HEIGHT;
      ctx.fillStyle = `rgba(255, 215, 0, ${0.2 + Math.sin(t * 2 + i) * 0.15})`;
      ctx.beginPath();
      ctx.arc(px, py, 2 + Math.sin(t + i * 0.5) * 1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('VICTORY!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 90);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('Luna completed her adventure!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    const stats = [
      { label: 'Final Score', value: `${this.state.score}`, color: '#FFD700' },
      { label: 'Berries', value: `${this.state.berries}`, color: '#FF4466' },
      { label: 'Gems', value: `${this.state.gemsCollected}`, color: '#44DDFF' },
      { label: 'Enemies Stomped', value: `${this.state.enemiesStomped}`, color: '#FFDD44' },
      { label: 'Deaths', value: `${this.state.deaths}`, color: '#FF8888' },
    ];

    let yPos = CANVAS_HEIGHT / 2 - 30;
    for (const stat of stats) {
      ctx.fillStyle = '#AAA';
      ctx.font = '13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(stat.label + ':', CANVAS_WIDTH / 2 - 10, yPos);
      ctx.fillStyle = stat.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(stat.value, CANVAS_WIDTH / 2 + 10, yPos);
      yPos += 22;
    }

    const blink = Math.sin(t * 5) > 0;
    ctx.fillStyle = blink ? '#FFF' : '#AAA';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press SPACE to Play Again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 100);
    ctx.textAlign = 'left';
  }
}
