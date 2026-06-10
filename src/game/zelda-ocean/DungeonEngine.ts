import type { IslandDef, RoomDef, EnemyDef, ChestDef, DungeonEngineCallbacks, DungeonRunResult } from './rpgTypes';

const TILE = 32;
const PLAYER_SPEED = 190;
const PLAYER_SIZE = 10;
const SWORD_RANGE = 48;
const SWORD_DAMAGE = 1;
const SWORD_COOLDOWN = 0.45;
const ROOM_W = 320;
const ROOM_H = 240;

interface LiveEnemy {
  def: EnemyDef;
  roomId: string;
  x: number;
  y: number;
  hp: number;
  stunTimer: number;
  aggroed: boolean;
  patrolAngle: number;
  flashTimer: number;
  dead: boolean;
}

interface LiveChest {
  def: ChestDef;
  roomId: string;
  x: number;
  y: number;
  opened: boolean;
}

interface Player {
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  swordCooldown: number;
  isSwordSwing: boolean;
  swordTimer: number;
  walkFrame: number;
  walkTimer: number;
  invincibleTimer: number;
}

type DoorSide = 'north' | 'south' | 'east' | 'west';

export class DungeonEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private island: IslandDef;
  private callbacks: DungeonEngineCallbacks;

  private currentRoomId: string;
  private rooms: Map<string, RoomDef> = new Map();
  private enemies: LiveEnemy[] = [];
  private chests: LiveChest[] = [];

  private player: Player;
  private playerHealth: number;
  private playerMaxHealth: number;

  private keys: Set<string> = new Set();
  private elapsed = 0;
  private startTime = 0;
  private animFrameId = 0;
  private lastTime = 0;

  private openedChests: Set<string>;
  private result: DungeonRunResult;
  private transitioning = false;
  private transitionTimer = 0;
  private transitionDir: DoorSide | null = null;
  private bossDefeated = false;

  private readonly W: number;
  private readonly H: number;
  private ox: number;
  private oy: number;

  constructor(
    canvas: HTMLCanvasElement,
    island: IslandDef,
    currentHealth: number,
    maxHealth: number,
    openedChests: string[],
    hasSword: boolean,
    callbacks: DungeonEngineCallbacks,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.island = island;
    this.callbacks = callbacks;
    this.playerHealth = currentHealth;
    this.playerMaxHealth = maxHealth;
    this.openedChests = new Set(openedChests);

    this.W = canvas.width = canvas.clientWidth;
    this.H = canvas.height = canvas.clientHeight;
    this.ox = (this.W - ROOM_W) / 2;
    this.oy = (this.H - ROOM_H) / 2;

    this.result = { completed: false, enemiesDefeated: 0, chestsOpened: 0, damageTaken: 0, timeSeconds: 0, rupeesFound: 0 };
    this.startTime = performance.now();

    island.dungeonRooms.forEach(r => this.rooms.set(r.id, r));

    this.currentRoomId = island.dungeonRooms[0]?.id ?? '';

    island.dungeonRooms.forEach(room => {
      room.enemies.forEach(e => {
        this.enemies.push({
          def: e, roomId: room.id,
          x: this.ox + (e.x / ROOM_W) * ROOM_W,
          y: this.oy + (e.y / (-ROOM_H)) * ROOM_H + this.oy + ROOM_H,
          hp: e.health, stunTimer: 0, aggroed: false, patrolAngle: Math.random() * Math.PI * 2,
          flashTimer: 0, dead: false,
        });
      });
      room.chests.forEach(c => {
        const rx = this.ox + (c.x / ROOM_W) * ROOM_W;
        const ry = this.oy + Math.abs(c.y / ROOM_H) * ROOM_H * 0.9 + this.oy * 0.1;
        this.chests.push({
          def: c, roomId: room.id,
          x: rx, y: ry,
          opened: this.openedChests.has(c.id),
        });
      });
    });

    this.player = {
      x: this.W / 2, y: this.H * 0.7,
      facing: 'up',
      swordCooldown: 0, isSwordSwing: false, swordTimer: 0,
      walkFrame: 0, walkTimer: 0, invincibleTimer: 0,
    };

    this.setupInput();
    this.start();
  }

  private setupInput() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if ((e.code === 'Space' || e.code === 'KeyJ') && this.player.swordCooldown <= 0) {
        this.swordSwing();
      }
      if (e.code === 'Escape') {
        this.exitDungeon(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    (this as unknown as { _cleanup: () => void })._cleanup = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  private swordSwing() {
    this.player.isSwordSwing = true;
    this.player.swordTimer = 0.25;
    this.player.swordCooldown = SWORD_COOLDOWN;

    const p = this.player;
    let sx = p.x;
    let sy = p.y;
    switch (p.facing) {
      case 'up': sy -= SWORD_RANGE; break;
      case 'down': sy += SWORD_RANGE; break;
      case 'left': sx -= SWORD_RANGE; break;
      case 'right': sx += SWORD_RANGE; break;
    }

    this.enemies.forEach(enemy => {
      if (enemy.dead || enemy.roomId !== this.currentRoomId) return;
      const dx = enemy.x - sx;
      const dy = enemy.y - sy;
      if (Math.sqrt(dx * dx + dy * dy) < 36) {
        enemy.hp -= SWORD_DAMAGE;
        enemy.stunTimer = 0.3;
        enemy.flashTimer = 0.3;
        if (enemy.hp <= 0) {
          enemy.dead = true;
          this.result.enemiesDefeated++;
          this.result.rupeesFound += enemy.def.rupeesDrop;
          this.callbacks.onEnemyKilled(enemy.def.rupeesDrop);
          if (enemy.def.type === 'boss') {
            this.bossDefeated = true;
            setTimeout(() => this.exitDungeon(true), 1800);
          }
        }
      }
    });
  }

  private start() {
    this.lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.05);
      this.lastTime = now;
      this.elapsed += dt;
      this.update(dt);
      this.draw();
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private update(dt: number) {
    if (this.transitioning) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.transitioning = false;
      }
      return;
    }

    const p = this.player;

    if (p.swordCooldown > 0) p.swordCooldown -= dt;
    if (p.swordTimer > 0) { p.swordTimer -= dt; if (p.swordTimer <= 0) p.isSwordSwing = false; }
    if (p.invincibleTimer > 0) p.invincibleTimer -= dt;

    let dx = 0, dy = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) { dx -= 1; p.facing = 'left'; }
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) { dx += 1; p.facing = 'right'; }
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) { dy -= 1; p.facing = 'up'; }
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) { dy += 1; p.facing = 'down'; }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len; dy /= len;
      p.walkTimer += dt;
      if (p.walkTimer > 0.12) { p.walkTimer = 0; p.walkFrame = (p.walkFrame + 1) % 4; }
    }

    const nx = Math.max(this.ox + 12, Math.min(this.ox + ROOM_W - 12, p.x + dx * PLAYER_SPEED * dt));
    const ny = Math.max(this.oy + 12, Math.min(this.oy + ROOM_H - 12, p.y + dy * PLAYER_SPEED * dt));
    p.x = nx;
    p.y = ny;

    this.updateEnemies(dt, p);
    this.checkChests(p);
    this.checkDoors(p);
  }

  private updateEnemies(dt: number, p: Player) {
    this.enemies.forEach(enemy => {
      if (enemy.dead || enemy.roomId !== this.currentRoomId) return;
      if (enemy.flashTimer > 0) enemy.flashTimer -= dt;
      if (enemy.stunTimer > 0) { enemy.stunTimer -= dt; return; }

      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) enemy.aggroed = true;

      if (enemy.aggroed) {
        enemy.x += (dx / dist) * enemy.def.speed * dt;
        enemy.y += (dy / dist) * enemy.def.speed * dt;
      } else {
        enemy.x += Math.cos(enemy.patrolAngle) * 30 * dt;
        enemy.y += Math.sin(enemy.patrolAngle) * 30 * dt;
        enemy.patrolAngle += dt * 0.5;
        enemy.x = Math.max(this.ox + 20, Math.min(this.ox + ROOM_W - 20, enemy.x));
        enemy.y = Math.max(this.oy + 20, Math.min(this.oy + ROOM_H - 20, enemy.y));
      }

      if (dist < PLAYER_SIZE + 12 && p.invincibleTimer <= 0) {
        this.playerHealth -= enemy.def.damage;
        this.result.damageTaken += enemy.def.damage;
        p.invincibleTimer = 0.8;
        this.callbacks.onHealthChange(Math.max(0, this.playerHealth), this.playerMaxHealth);
        if (this.playerHealth <= 0) {
          setTimeout(() => this.exitDungeon(false), 600);
        }
      }
    });
  }

  private checkChests(p: Player) {
    this.chests.forEach(chest => {
      if (chest.opened || chest.roomId !== this.currentRoomId) return;
      const dx = p.x - chest.x;
      const dy = p.y - chest.y;
      if (Math.sqrt(dx * dx + dy * dy) < 28) {
        chest.opened = true;
        this.openedChests.add(chest.def.id);
        this.result.chestsOpened++;
        if (chest.def.contents.startsWith('rupees_')) {
          const val = parseInt(chest.def.contents.split('_')[1]);
          this.result.rupeesFound += val;
        }
        if (chest.def.contents === 'heart_piece') {
          this.playerHealth = Math.min(this.playerMaxHealth + 2, this.playerHealth + 2);
          this.playerMaxHealth += 2;
          this.callbacks.onHealthChange(this.playerHealth, this.playerMaxHealth);
        }
        this.callbacks.onChestOpen(chest.def);
      }
    });
  }

  private checkDoors(p: Player) {
    const room = this.rooms.get(this.currentRoomId);
    if (!room || this.transitioning) return;

    const enemiesAlive = this.enemies.some(e => !e.dead && e.roomId === this.currentRoomId && e.def.type !== 'boss');

    for (const door of room.doors) {
      let triggered = false;
      const margin = 16;

      if (door.side === 'north' && p.y < this.oy + margin) triggered = true;
      if (door.side === 'south' && p.y > this.oy + ROOM_H - margin) triggered = true;
      if (door.side === 'west' && p.x < this.ox + margin) triggered = true;
      if (door.side === 'east' && p.x > this.ox + ROOM_W - margin) triggered = true;

      if (triggered) {
        if (door.locked && enemiesAlive) return;
        this.transitioning = true;
        this.transitionTimer = 0.4;
        this.transitionDir = door.side;
        this.currentRoomId = door.toRoom;

        switch (door.side) {
          case 'north': p.y = this.oy + ROOM_H - 24; break;
          case 'south': p.y = this.oy + 24; break;
          case 'east': p.x = this.ox + 24; break;
          case 'west': p.x = this.ox + ROOM_W - 24; break;
        }
        return;
      }
    }
  }

  private exitDungeon(completed: boolean) {
    this.result.completed = completed;
    this.result.timeSeconds = Math.floor((performance.now() - this.startTime) / 1000);
    if (completed && this.bossDefeated) {
      const bossChest = this.chests.find(c => c.roomId === this.island.dungeonRooms[this.island.dungeonRooms.length - 1]?.id);
      if (bossChest) this.result.itemFound = bossChest.def.contents;
    }
    this.callbacks.onComplete(this.result);
  }

  private draw() {
    const { ctx, W, H } = this;
    const room = this.rooms.get(this.currentRoomId);
    const dunColor = this.island.dungeonColor;

    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    if (this.transitioning) {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, (0.4 - this.transitionTimer) / 0.4 * 2) + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }

    this.drawRoom(dunColor);
    if (room?.isBossRoom) this.drawBossWarning();
    this.drawChestsInRoom();
    this.drawEnemiesInRoom();
    this.drawPlayer();
    this.drawSwordEffect();
    this.drawDungeonUI(room);
  }

  private drawRoom(dunColor: string) {
    const { ctx } = this;
    const { ox, oy } = this;

    ctx.fillStyle = dunColor + '55';
    ctx.fillRect(ox, oy, ROOM_W, ROOM_H);

    ctx.strokeStyle = dunColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(ox, oy, ROOM_W, ROOM_H);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let gx = ox; gx <= ox + ROOM_W; gx += TILE) {
      ctx.beginPath(); ctx.moveTo(gx, oy); ctx.lineTo(gx, oy + ROOM_H); ctx.stroke();
    }
    for (let gy = oy; gy <= oy + ROOM_H; gy += TILE) {
      ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + ROOM_W, gy); ctx.stroke();
    }

    const room = this.rooms.get(this.currentRoomId);
    const enemiesAlive = this.enemies.some(e => !e.dead && e.roomId === this.currentRoomId);

    room?.doors.forEach(door => {
      ctx.fillStyle = (door.locked && enemiesAlive) ? '#cc3333' : '#225522';
      let dx = 0, dy = 0, dw = 0, dh = 0;
      if (door.side === 'north') { dx = ox + ROOM_W / 2 - 16; dy = oy - 4; dw = 32; dh = 10; }
      if (door.side === 'south') { dx = ox + ROOM_W / 2 - 16; dy = oy + ROOM_H - 6; dw = 32; dh = 10; }
      if (door.side === 'west') { dx = ox - 4; dy = oy + ROOM_H / 2 - 16; dw = 10; dh = 32; }
      if (door.side === 'east') { dx = ox + ROOM_W - 6; dy = oy + ROOM_H / 2 - 16; dw = 10; dh = 32; }
      ctx.fillRect(dx, dy, dw, dh);
    });
  }

  private drawBossWarning() {
    const { ctx, W, oy } = this;
    ctx.fillStyle = 'rgba(180,0,0,0.18)';
    ctx.fillRect(0, 0, W, this.H);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`BOSS: ${this.island.bossName}`, W / 2, oy - 12);
  }

  private drawChestsInRoom() {
    const { ctx } = this;
    this.chests.filter(c => c.roomId === this.currentRoomId).forEach(chest => {
      ctx.fillStyle = chest.opened ? '#5a4a2a' : '#c8a048';
      ctx.fillRect(chest.x - 10, chest.y - 8, 20, 16);
      ctx.fillStyle = chest.opened ? '#3a2a1a' : '#8a6020';
      ctx.fillRect(chest.x - 10, chest.y - 8, 20, 7);
      ctx.strokeStyle = chest.opened ? '#4a3a1a' : '#f0c060';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(chest.x - 10, chest.y - 8, 20, 16);
    });
  }

  private drawEnemiesInRoom() {
    const { ctx, elapsed } = this;
    this.enemies.filter(e => !e.dead && e.roomId === this.currentRoomId).forEach(enemy => {
      const flash = enemy.flashTimer > 0 && Math.floor(enemy.flashTimer * 20) % 2 === 0;
      const col = flash ? '#ffffff'
        : enemy.def.type === 'boss' ? '#cc2222'
        : enemy.def.type === 'moblin' ? '#6a3a8a'
        : enemy.def.type === 'lizalfos' ? '#2a7a3a'
        : enemy.def.type === 'keese' ? '#4a3a6a'
        : '#8a4a2a';

      const sz = enemy.def.type === 'boss' ? 20
        : enemy.def.type === 'keese' ? 8 : 12;

      ctx.fillStyle = col;
      ctx.beginPath();
      if (enemy.def.type === 'keese') {
        ctx.ellipse(enemy.x, enemy.y + Math.sin(elapsed * 8 + enemy.def.x) * 3, sz, sz * 0.6, 0, 0, Math.PI * 2);
      } else if (enemy.def.type === 'boss') {
        ctx.roundRect(enemy.x - sz, enemy.y - sz, sz * 2, sz * 2, 4);
      } else {
        ctx.arc(enemy.x, enemy.y, sz, 0, Math.PI * 2);
      }
      ctx.fill();

      const hpPct = enemy.hp / enemy.def.health;
      const bw = sz * 2;
      ctx.fillStyle = '#333';
      ctx.fillRect(enemy.x - sz, enemy.y - sz - 7, bw, 4);
      ctx.fillStyle = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa22' : '#cc2222';
      ctx.fillRect(enemy.x - sz, enemy.y - sz - 7, bw * hpPct, 4);
    });
  }

  private drawPlayer() {
    const { ctx } = this;
    const p = this.player;
    const flash = p.invincibleTimer > 0 && Math.floor(p.invincibleTimer * 20) % 2 === 0;
    if (flash) return;

    ctx.fillStyle = '#50c050';
    ctx.beginPath();
    ctx.roundRect(p.x - 9, p.y - 6, 18, 18, 3);
    ctx.fill();

    ctx.fillStyle = '#f0d0a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 11, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 15, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawSwordEffect() {
    if (!this.player.isSwordSwing) return;
    const { ctx } = this;
    const p = this.player;
    let sx = p.x, sy = p.y;
    switch (p.facing) {
      case 'up': sy -= 30; break;
      case 'down': sy += 30; break;
      case 'left': sx -= 30; break;
      case 'right': sx += 30; break;
    }
    ctx.strokeStyle = 'rgba(255,255,150,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawDungeonUI(room: RoomDef | undefined) {
    const { ctx, W, H } = this;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(8, 8, 140, 38);
    ctx.strokeStyle = this.island.dungeonColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, 140, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(this.island.name, 16, 24);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '9px monospace';
    ctx.fillText(room?.isBossRoom ? 'BOSS CHAMBER' : `Chamber: ${this.currentRoomId.replace('room_', '').replace('_', ' ')}`, 16, 38);

    const heartSize = 14;
    const maxHearts = Math.ceil(this.playerMaxHealth / 2);
    for (let i = 0; i < maxHearts; i++) {
      const filled = this.playerHealth >= (i + 1) * 2 ? 2 : this.playerHealth >= i * 2 + 1 ? 1 : 0;
      const hx = W - 16 - (maxHearts - i) * (heartSize + 3);
      const hy = 14;
      ctx.fillStyle = filled === 2 ? '#f87171' : filled === 1 ? '#f8a070' : 'rgba(100,60,60,0.5)';
      ctx.beginPath();
      ctx.arc(hx, hy, heartSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[SPACE/J] Sword   [WASD] Move   [ESC] Flee', W / 2, H - 10);

    if (this.bossDefeated) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(W / 2 - 120, H / 2 - 30, 240, 60);
      ctx.fillStyle = '#f0d060';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.island.bossName} DEFEATED!`, W / 2, H / 2 - 6);
      ctx.fillStyle = '#80ff80';
      ctx.font = '11px monospace';
      ctx.fillText(`${this.island.rewardLabel} obtained!`, W / 2, H / 2 + 14);
    }
  }

  getOpenedChests(): string[] { return Array.from(this.openedChests); }

  destroy() {
    cancelAnimationFrame(this.animFrameId);
    const self = this as unknown as { _cleanup?: () => void };
    self._cleanup?.();
  }
}
