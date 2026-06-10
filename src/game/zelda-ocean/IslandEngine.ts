import type { IslandDef, IslandEngineCallbacks, NpcDef, ChestDef } from './rpgTypes';

const TILE = 32;
const PLAYER_SPEED = 160;
const PLAYER_SIZE = 14;
const NPC_SIZE = 14;
const CHEST_SIZE = 16;
const INTERACT_RADIUS = 36;

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 'up' | 'down' | 'left' | 'right';
  walkFrame: number;
  walkTimer: number;
}

interface ActiveNpc {
  def: NpcDef;
  x: number;
  y: number;
  bobOffset: number;
}

interface ActiveChest {
  def: ChestDef;
  x: number;
  y: number;
  opened: boolean;
}

const ISLAND_COLORS: Record<string, { ground: string; accent: string; path: string }> = {
  windfall:  { ground: '#b8d48a', accent: '#7a9a5a', path: '#c2a868' },
  forsaken:  { ground: '#4a3f5a', accent: '#2a2040', path: '#5a4a6a' },
  dragon_roost: { ground: '#c08060', accent: '#904030', path: '#d09070' },
  forbidden_woods: { ground: '#2a5a3a', accent: '#1a3a28', path: '#3a6a48' },
};

export class IslandEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private island: IslandDef;
  private callbacks: IslandEngineCallbacks;

  private player: Player;
  private npcs: ActiveNpc[] = [];
  private chests: ActiveChest[] = [];

  private keys: Set<string> = new Set();
  private elapsed = 0;
  private animFrameId = 0;
  private lastTime = 0;

  private openedChests: Set<string>;
  private metNpcs: Set<string>;
  private hasDungeonEntrance: boolean;
  private dungeonEntranceX: number;
  private dungeonEntranceY: number;
  private cameraX = 0;
  private cameraY = 0;

  private readonly W: number;
  private readonly H: number;

  constructor(
    canvas: HTMLCanvasElement,
    island: IslandDef,
    openedChests: string[],
    metNpcs: string[],
    callbacks: IslandEngineCallbacks,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.island = island;
    this.callbacks = callbacks;
    this.openedChests = new Set(openedChests);
    this.metNpcs = new Set(metNpcs);

    this.W = canvas.width = canvas.clientWidth;
    this.H = canvas.height = canvas.clientHeight;

    this.player = {
      x: this.W / 2, y: this.H * 0.65,
      vx: 0, vy: 0,
      facing: 'down',
      walkFrame: 0, walkTimer: 0,
    };

    this.hasDungeonEntrance = island.dungeonRooms.length > 0;
    this.dungeonEntranceX = this.W / 2;
    this.dungeonEntranceY = 80;

    island.npcs.forEach((npc, i) => {
      this.npcs.push({
        def: npc,
        x: (npc.x / 400) * this.W,
        y: (npc.y / 300) * this.H,
        bobOffset: i * 0.8,
      });
    });

    island.chests.forEach(chest => {
      this.chests.push({
        def: chest,
        x: (chest.x / 400) * this.W,
        y: (chest.y / 300) * this.H,
        opened: this.openedChests.has(chest.id),
      });
    });

    this.setupInput();
    this.start();
  }

  private setupInput() {
    const onKeyDown = (e: KeyboardEvent) => {
      this.keys.add(e.code);
      if (e.code === 'KeyE' || e.code === 'Space') {
        this.tryInteract();
      }
      if (e.code === 'Escape') {
        this.callbacks.onExitIsland();
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

  private tryInteract() {
    const px = this.player.x;
    const py = this.player.y;

    for (const npc of this.npcs) {
      const dx = px - npc.x;
      const dy = py - npc.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS) {
        this.metNpcs.add(npc.def.id);
        this.callbacks.onNpcTalk(npc.def);
        return;
      }
    }

    for (const chest of this.chests) {
      if (chest.opened) continue;
      const dx = px - chest.x;
      const dy = py - chest.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS) {
        chest.opened = true;
        this.openedChests.add(chest.def.id);
        this.callbacks.onChestOpen(chest.def);
        return;
      }
    }

    if (this.hasDungeonEntrance) {
      const dx = px - this.dungeonEntranceX;
      const dy = py - this.dungeonEntranceY;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS + 10) {
        this.callbacks.onEnterDungeon();
        return;
      }
    }
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
    const p = this.player;
    let dx = 0;
    let dy = 0;

    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) { dx -= 1; p.facing = 'left'; }
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) { dx += 1; p.facing = 'right'; }
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) { dy -= 1; p.facing = 'up'; }
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) { dy += 1; p.facing = 'down'; }

    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      p.walkTimer += dt;
      if (p.walkTimer > 0.15) { p.walkTimer = 0; p.walkFrame = (p.walkFrame + 1) % 4; }
    } else {
      p.walkTimer = 0;
    }

    p.vx = dx * PLAYER_SPEED;
    p.vy = dy * PLAYER_SPEED;

    p.x = Math.max(PLAYER_SIZE, Math.min(this.W - PLAYER_SIZE, p.x + p.vx * dt));
    p.y = Math.max(PLAYER_SIZE, Math.min(this.H - PLAYER_SIZE, p.y + p.vy * dt));
  }

  private draw() {
    const { ctx, W, H } = this;
    const colors = ISLAND_COLORS[this.island.id] ?? ISLAND_COLORS.windfall;

    ctx.fillStyle = colors.ground;
    ctx.fillRect(0, 0, W, H);

    this.drawGround(colors);
    this.drawDungeonEntrance();
    this.drawChests();
    this.drawNpcs();
    this.drawPlayer();
    this.drawInteractHints();
    this.drawUI();
  }

  private drawGround(colors: { ground: string; accent: string; path: string }) {
    const { ctx, W, H } = this;

    ctx.fillStyle = colors.accent;
    for (let i = 0; i < 12; i++) {
      const bx = (Math.sin(i * 3.7) * 0.5 + 0.5) * W;
      const by = (Math.cos(i * 2.9) * 0.5 + 0.5) * H;
      const r = 20 + (i % 4) * 15;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = colors.path;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.72, 60, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, H * 0.72);
    ctx.lineTo(W / 2, this.dungeonEntranceY + 30);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawDungeonEntrance() {
    if (!this.hasDungeonEntrance) return;
    const { ctx } = this;
    const ex = this.dungeonEntranceX;
    const ey = this.dungeonEntranceY;

    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(ex - 28, ey - 20, 56, 48, 4);
    ctx.fill();

    ctx.fillStyle = '#2a2a4e';
    ctx.fillRect(ex - 12, ey + 4, 24, 24);

    ctx.strokeStyle = '#8888cc';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ex - 28, ey - 20, 56, 48);

    ctx.fillStyle = '#ccccff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEMPLE', ex, ey - 28);
  }

  private drawChests() {
    const { ctx } = this;
    for (const chest of this.chests) {
      const { x, y, opened } = chest;

      ctx.fillStyle = opened ? '#5a4a2a' : '#c8a048';
      ctx.fillRect(x - CHEST_SIZE / 2, y - CHEST_SIZE / 2, CHEST_SIZE, CHEST_SIZE);

      ctx.fillStyle = opened ? '#3a2a1a' : '#8a6020';
      ctx.fillRect(x - CHEST_SIZE / 2, y - CHEST_SIZE / 2, CHEST_SIZE, CHEST_SIZE * 0.4);

      ctx.strokeStyle = opened ? '#4a3a1a' : '#f0c060';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - CHEST_SIZE / 2, y - CHEST_SIZE / 2, CHEST_SIZE, CHEST_SIZE);

      if (!opened) {
        ctx.fillStyle = '#f0c060';
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawNpcs() {
    const { ctx, elapsed } = this;
    for (const npc of this.npcs) {
      const bob = Math.sin(elapsed * 2 + npc.bobOffset) * 2;
      const x = npc.x;
      const y = npc.y + bob;

      const bodyColor = npc.def.role === 'merchant' ? '#e8a040'
        : npc.def.role === 'sage' ? '#8080e0'
        : npc.def.role === 'quest_giver' ? '#40c080'
        : '#cc6060';

      ctx.fillStyle = '#f5c8a0';
      ctx.beginPath();
      ctx.arc(x, y - NPC_SIZE, NPC_SIZE * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(x - NPC_SIZE * 0.55, y - NPC_SIZE * 0.5, NPC_SIZE * 1.1, NPC_SIZE, 3);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,100,0.8)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - NPC_SIZE * 1.9 + bob);

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '9px monospace';
      ctx.fillText(npc.def.name, x, y + NPC_SIZE + 10);
    }
  }

  private drawPlayer() {
    const { ctx } = this;
    const p = this.player;
    const bob = Math.sin(this.elapsed * 8) * (Math.abs(p.vx) + Math.abs(p.vy) > 0 ? 1.5 : 0);

    const px = p.x;
    const py = p.y + bob;

    ctx.fillStyle = '#50c050';
    ctx.beginPath();
    ctx.roundRect(px - 8, py - 6, 16, 16, 3);
    ctx.fill();

    ctx.fillStyle = '#f0d0a0';
    ctx.beginPath();
    ctx.arc(px, py - 10, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a6a2a';
    ctx.beginPath();
    if (p.facing === 'up') {
      ctx.arc(px, py - 16, 6, Math.PI, Math.PI * 2);
    } else {
      ctx.ellipse(px, py - 13, 8, 5, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.fillStyle = '#888888';
    if (p.facing === 'right') {
      ctx.fillRect(px + 8, py - 4, 8, 3);
    } else if (p.facing === 'left') {
      ctx.fillRect(px - 16, py - 4, 8, 3);
    }
  }

  private drawInteractHints() {
    const { ctx } = this;
    const px = this.player.x;
    const py = this.player.y;

    const showHint = (x: number, y: number, label: string) => {
      ctx.fillStyle = 'rgba(255,255,150,0.9)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] ${label}`, x, y - 24);
    };

    for (const npc of this.npcs) {
      const dx = px - npc.x;
      const dy = py - npc.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS) {
        showHint(npc.x, npc.y, 'Talk');
      }
    }

    for (const chest of this.chests) {
      if (chest.opened) continue;
      const dx = px - chest.x;
      const dy = py - chest.y;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS) {
        showHint(chest.x, chest.y, 'Open');
      }
    }

    if (this.hasDungeonEntrance) {
      const dx = px - this.dungeonEntranceX;
      const dy = py - this.dungeonEntranceY;
      if (Math.sqrt(dx * dx + dy * dy) < INTERACT_RADIUS + 10) {
        showHint(this.dungeonEntranceX, this.dungeonEntranceY, 'Enter Temple');
      }
    }
  }

  private drawUI() {
    const { ctx, W } = this;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 90, 8, 180, 28, 6);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.island.name, W / 2, 27);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '9px monospace';
    ctx.fillText('[ESC] Leave Island   [E] Interact   [WASD] Move', W / 2, this.H - 10);
  }

  getMetNpcs(): string[] { return Array.from(this.metNpcs); }
  getOpenedChests(): string[] { return Array.from(this.openedChests); }

  destroy() {
    cancelAnimationFrame(this.animFrameId);
    const self = this as unknown as { _cleanup?: () => void };
    self._cleanup?.();
  }
}
