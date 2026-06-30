import Phaser from 'phaser';
import { WORLD, COLORS, COP, PED, WANTED, CAR } from './config';
import { generateTextures } from './textures';
import { Vehicle } from './entities/Vehicle';
import { OnFootPlayer } from './entities/OnFootPlayer';
import { Pedestrian } from './entities/Pedestrian';

type Keys = Record<string, Phaser.Input.Keyboard.Key>;

// Shared state pushed to the React HUD via the scene registry / events.
export interface HudState {
  mode: 'car' | 'foot';
  mph: number;
  wanted: number;
  cash: number;
  busted: boolean;
}

export class CityScene extends Phaser.Scene {
  private keys!: Keys;
  private playerCar!: Vehicle;
  private onFoot!: OnFootPlayer;
  private buildings!: Phaser.Physics.Arcade.StaticGroup;
  private peds!: Phaser.Physics.Arcade.Group;
  private cops: Vehicle[] = [];
  private mode: 'car' | 'foot' = 'car';
  private wanted = 0;
  private cash = 0;
  private lastCrimeAt = 0;
  private bustAccum = 0;
  private busted = false;
  private interactDown = false;

  constructor() {
    super('CityScene');
  }

  create() {
    generateTextures(this);

    this.physics.world.setBounds(0, 0, WORLD.size, WORLD.size);
    this.cameras.main.setBounds(0, 0, WORLD.size, WORLD.size);
    this.cameras.main.setBackgroundColor(COLORS.grass);

    this.drawGround();
    this.buildings = this.physics.add.staticGroup();
    this.buildCity();

    // Player starts in a car on the first avenue.
    const start = WORLD.road;
    this.playerCar = new Vehicle(this, start + 20, start + 20, 'ow-car-player');
    this.playerCar.setCollideWorldBounds(true);

    this.onFoot = new OnFootPlayer(this, start, start);
    this.onFoot.setCollideWorldBounds(true);
    this.onFoot.setActive(false).setVisible(false);
    (this.onFoot.body as Phaser.Physics.Arcade.Body).enable = false;

    this.spawnPedestrians();

    // Collisions
    this.physics.add.collider(this.playerCar, this.buildings, () => this.playerCar.onCrash());
    this.physics.add.collider(this.onFoot, this.buildings);
    this.physics.add.collider(this.peds, this.buildings);
    this.physics.add.overlap(this.playerCar, this.peds, (_c, p) =>
      this.handlePedHit(p as Pedestrian)
    );

    this.cameras.main.startFollow(this.playerCar, true, 0.1, 0.1);
    this.cameras.main.setZoom(0.95);

    this.keys = this.input.keyboard!.addKeys(
      'W,A,S,D,UP,DOWN,LEFT,RIGHT,F,SPACE'
    ) as Keys;

    this.pushHud();
  }

  // ---- world building -------------------------------------------------

  private drawGround() {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.grass, 1);
    g.fillRect(0, 0, WORLD.size, WORLD.size);

    // Road grid: a strip centred on every block line.
    g.fillStyle(COLORS.road, 1);
    for (let k = 0; k <= WORLD.blocks; k++) {
      const p = k * WORLD.block;
      g.fillRect(p - WORLD.road / 2, 0, WORLD.road, WORLD.size); // vertical
      g.fillRect(0, p - WORLD.road / 2, WORLD.size, WORLD.road); // horizontal
    }

    // Dashed centre lines.
    g.fillStyle(COLORS.roadLine, 0.9);
    const dash = 18;
    const gap = 22;
    for (let k = 0; k <= WORLD.blocks; k++) {
      const p = k * WORLD.block;
      for (let d = 0; d < WORLD.size; d += dash + gap) {
        g.fillRect(p - 1.5, d, 3, dash);
        g.fillRect(d, p - 1.5, dash, 3);
      }
    }
  }

  private buildCity() {
    const inset = WORLD.road / 2 + 14; // keep clear of the road
    for (let i = 0; i < WORLD.blocks; i++) {
      for (let j = 0; j < WORLD.blocks; j++) {
        // leave the occasional empty lot / plaza
        if (Phaser.Math.Between(0, 8) === 0) continue;

        const x0 = i * WORLD.block + inset;
        const y0 = j * WORLD.block + inset;
        const x1 = (i + 1) * WORLD.block - inset;
        const y1 = (j + 1) * WORLD.block - inset;
        const w = x1 - x0;
        const h = y1 - y0;
        if (w < 40 || h < 40) continue;

        const color = Phaser.Utils.Array.GetRandom(COLORS.buildings);
        const b = this.buildings.create(
          x0 + w / 2,
          y0 + h / 2,
          'ow-white'
        ) as Phaser.Physics.Arcade.Sprite;
        b.setDisplaySize(w, h).setTint(color).setDepth(1);
        b.refreshBody();

        // a lit rooftop edge for a touch of depth
        const edge = this.add.graphics().setDepth(1);
        edge.lineStyle(2, 0x000000, 0.35);
        edge.strokeRect(x0, y0, w, h);
        edge.lineStyle(2, 0xffffff, 0.05);
        edge.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6);
      }
    }
  }

  private spawnPedestrians() {
    this.peds = this.physics.add.group();
    let placed = 0;
    let guard = 0;
    while (placed < PED.count && guard < PED.count * 20) {
      guard++;
      const x = Phaser.Math.Between(40, WORLD.size - 40);
      const y = Phaser.Math.Between(40, WORLD.size - 40);
      // prefer spots near roads (close to a grid line)
      const nearRoad =
        x % WORLD.block < WORLD.road * 1.4 || y % WORLD.block < WORLD.road * 1.4;
      if (!nearRoad) continue;
      const ped = new Pedestrian(this, x, y);
      ped.setCollideWorldBounds(true);
      (ped.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;
      this.peds.add(ped);
      placed++;
    }
  }

  // ---- gameplay events ------------------------------------------------

  private handlePedHit(ped: Pedestrian) {
    if (!ped.active) return;
    if (Math.abs(this.playerCar.speed) < PED.dangerSpeed) return;

    ped.disableBody(true, true);
    this.add.image(ped.x, ped.y, 'ow-splat').setDepth(0).setAlpha(0.85);
    this.cash += 5;
    this.raiseWanted(WANTED.perHit);
    this.cameras.main.shake(120, 0.004);
  }

  private raiseWanted(by: number) {
    this.wanted = Phaser.Math.Clamp(this.wanted + by, 0, WANTED.max);
    this.lastCrimeAt = this.time.now;
    this.ensureCops();
    this.pushHud();
  }

  private ensureCops() {
    const target = Math.min(this.wanted, 4);
    while (this.cops.length < target) this.spawnCop();
  }

  private spawnCop() {
    // spawn just off-screen from the player
    const cam = this.cameras.main;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const r = 520;
    const focus = this.activeEntity();
    const x = Phaser.Math.Clamp(focus.x + Math.cos(angle) * r, 30, WORLD.size - 30);
    const y = Phaser.Math.Clamp(focus.y + Math.sin(angle) * r, 30, WORLD.size - 30);
    const cop = new Vehicle(this, x, y, 'ow-car-cop', {
      maxSpeed: COP.maxSpeed,
      accel: COP.accel,
      turnRate: COP.turnRate,
    });
    cop.setCollideWorldBounds(true);
    this.physics.add.collider(cop, this.buildings, () => cop.onCrash());
    this.cops.push(cop);
    void cam;
  }

  private activeEntity(): Phaser.Physics.Arcade.Sprite {
    return this.mode === 'car' ? this.playerCar : this.onFoot;
  }

  private toggleVehicle() {
    if (this.mode === 'car') {
      // exit: drop the player beside the car
      this.mode = 'foot';
      this.playerCar.speed = 0;
      (this.playerCar.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      const off = new Phaser.Math.Vector2(0, 1)
        .rotate(this.playerCar.rotation)
        .scale(34);
      this.onFoot.setPosition(this.playerCar.x + off.x, this.playerCar.y + off.y);
      this.onFoot.setActive(true).setVisible(true);
      (this.onFoot.body as Phaser.Physics.Arcade.Body).enable = true;
      this.cameras.main.startFollow(this.onFoot, true, 0.1, 0.1);
    } else {
      // enter: only if close enough to the car
      const d = Phaser.Math.Distance.Between(
        this.onFoot.x,
        this.onFoot.y,
        this.playerCar.x,
        this.playerCar.y
      );
      if (d > 70) return;
      this.mode = 'car';
      this.onFoot.setActive(false).setVisible(false);
      (this.onFoot.body as Phaser.Physics.Arcade.Body).enable = false;
      this.cameras.main.startFollow(this.playerCar, true, 0.1, 0.1);
    }
    this.pushHud();
  }

  // ---- main loop ------------------------------------------------------

  update(time: number, dtMs: number) {
    const k = this.keys;
    const interact = k.F.isDown;
    if (interact && !this.interactDown) this.toggleVehicle();
    this.interactDown = interact;

    if (this.mode === 'car') {
      const throttle =
        (k.W.isDown || k.UP.isDown ? 1 : 0) - (k.S.isDown || k.DOWN.isDown ? 1 : 0);
      const steer =
        (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      this.playerCar.drive(throttle, steer, dtMs);
    } else {
      const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      this.onFoot.move(dx, dy);
    }

    // pedestrians wander, and flee a fast nearby car
    (this.peds.getChildren() as Pedestrian[]).forEach((p) => {
      if (!p.active) return;
      p.wander(time);
    });

    this.updateCops(dtMs);
    this.updateWantedCooldown(time);

    // HUD only needs ~10fps of updates
    if (time % 100 < dtMs) this.pushHud();
  }

  private updateCops(dtMs: number) {
    const focus = this.activeEntity();
    let nearestBust = Infinity;

    for (const cop of this.cops) {
      // seek the player
      const desired = Phaser.Math.Angle.Between(cop.x, cop.y, focus.x, focus.y);
      let diff = Phaser.Math.Angle.Wrap(desired - cop.rotation);
      const steer = Phaser.Math.Clamp(diff * 2.5, -1, 1);
      const dist = Phaser.Math.Distance.Between(cop.x, cop.y, focus.x, focus.y);
      const throttle = dist > 90 ? 1 : -0.4;
      cop.drive(throttle, steer, dtMs);
      nearestBust = Math.min(nearestBust, dist);
    }

    if (this.wanted > 0 && nearestBust < COP.bustRange) {
      const playerSlow = this.mode === 'foot' || Math.abs(this.playerCar.speed) < 60;
      if (playerSlow) {
        this.bustAccum += dtMs;
        if (this.bustAccum >= COP.bustTime) this.bust();
      } else {
        this.bustAccum = Math.max(0, this.bustAccum - dtMs);
      }
    } else {
      this.bustAccum = Math.max(0, this.bustAccum - dtMs * 0.5);
    }
  }

  private updateWantedCooldown(time: number) {
    if (this.wanted > 0 && time - this.lastCrimeAt > WANTED.coolMs) {
      this.wanted -= 1;
      this.lastCrimeAt = time;
      if (this.wanted < this.cops.length) {
        const cop = this.cops.pop();
        cop?.destroy();
      }
      this.pushHud();
    }
  }

  private bust() {
    this.busted = true;
    this.cash = Math.max(0, this.cash - 50);
    this.wanted = 0;
    this.bustAccum = 0;
    this.cops.forEach((c) => c.destroy());
    this.cops = [];
    this.cameras.main.flash(400, 40, 60, 120);
    this.pushHud();
    this.time.delayedCall(900, () => {
      this.busted = false;
      this.pushHud();
    });
  }

  private pushHud() {
    const state: HudState = {
      mode: this.mode,
      mph: this.mode === 'car' ? this.playerCar.mph : 0,
      wanted: this.wanted,
      cash: this.cash,
      busted: this.busted,
    };
    this.game.events.emit('ow-hud', state);
  }

  // expose for the minimap
  getMinimapData() {
    const focus = this.activeEntity();
    return {
      player: { x: focus.x, y: focus.y, rot: focus.rotation },
      cops: this.cops.map((c) => ({ x: c.x, y: c.y })),
      world: WORLD.size,
    };
  }
}

void CAR;
