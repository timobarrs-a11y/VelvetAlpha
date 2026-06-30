import Phaser from 'phaser';
import { CAR } from '../config';

// A simple arcade-physics car. Used for both the player's ride and cop cars.
// Movement model: a scalar speed along the sprite's facing, with steering
// that scales with speed (you can't turn a parked car).
export class Vehicle extends Phaser.Physics.Arcade.Sprite {
  speed = 0;
  private maxSpeed: number;
  private accel: number;
  private turnRate: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    opts?: { maxSpeed?: number; accel?: number; turnRate?: number }
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.maxSpeed = opts?.maxSpeed ?? CAR.maxSpeed;
    this.accel = opts?.accel ?? CAR.accel;
    this.turnRate = opts?.turnRate ?? CAR.turnRate;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(CAR.width, CAR.height);
    body.setBounce(0.1, 0.1);
    body.setDamping(false);
    this.setDepth(5);
  }

  // throttle: -1..1 (reverse..forward), steer: -1..1 (left..right)
  drive(throttle: number, steer: number, dtMs: number) {
    const dt = dtMs / 1000;

    if (throttle > 0) {
      this.speed += this.accel * throttle * dt;
    } else if (throttle < 0) {
      // braking / reverse is stronger
      this.speed += CAR.brake * throttle * dt;
    } else {
      // coast — bleed off speed
      this.speed -= this.speed * CAR.friction * dt;
    }

    this.speed = Phaser.Math.Clamp(this.speed, -CAR.reverseSpeed, this.maxSpeed);
    if (Math.abs(this.speed) < 2 && throttle === 0) this.speed = 0;

    // steering scales with how fast we're going; reverse flips the wheel
    const speedFrac = this.speed / this.maxSpeed;
    if (Math.abs(this.speed) > 4) {
      this.rotation += steer * this.turnRate * speedFrac * dt;
    }

    this.scene.physics.velocityFromRotation(
      this.rotation,
      this.speed,
      (this.body as Phaser.Physics.Arcade.Body).velocity
    );
  }

  // Kill momentum when we slam into something.
  onCrash() {
    this.speed *= 0.25;
  }

  get mph() {
    return Math.round((Math.abs(this.speed) / CAR.maxSpeed) * 140);
  }
}
