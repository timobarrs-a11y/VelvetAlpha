import Phaser from 'phaser';
import { PED } from '../config';

// Wandering city pedestrian. Picks a random heading and changes it on a timer.
export class Pedestrian extends Phaser.Physics.Arcade.Sprite {
  private nextTurn = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'ow-ped');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(6);
    this.setDepth(4);
  }

  wander(time: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (time > this.nextTurn) {
      this.nextTurn = time + Phaser.Math.Between(800, 2600);
      if (Phaser.Math.Between(0, 4) === 0) {
        body.setVelocity(0, 0); // pause
      } else {
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        body.setVelocity(Math.cos(a) * PED.speed, Math.sin(a) * PED.speed);
      }
    }
    // bounce off invisible world bounds handled by physics; flee if a fast car
    // is near is handled in the scene.
  }
}
