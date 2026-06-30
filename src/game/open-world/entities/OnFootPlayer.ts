import Phaser from 'phaser';
import { PLAYER } from '../config';

// The player when out of a vehicle. Eight-directional walking.
export class OnFootPlayer extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'ow-foot');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(PLAYER.size / 2);
    this.setDepth(6);
  }

  move(dx: number, dy: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.lengthSq() > 0) {
      v.normalize().scale(PLAYER.speed);
      this.setRotation(v.angle() + Math.PI / 2);
    }
    body.setVelocity(v.x, v.y);
  }
}
