import Phaser from 'phaser';
import { CAR, PLAYER, PED, COLORS } from './config';

// Generates every sprite the game needs as a runtime texture, so the project
// ships zero binary game assets. Call once from a scene's create().

function carTexture(scene: Phaser.Scene, key: string, body: number) {
  const w = CAR.width;
  const h = CAR.height;
  const g = scene.add.graphics();

  // Drawn pointing right (+x) so Phaser rotation 0 == direction of travel.
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(2, 3, w, h, 6); // shadow
  g.fillStyle(body, 1);
  g.fillRoundedRect(0, 0, w, h, 6);
  // windshield toward the front (right side)
  g.fillStyle(0x0c0f16, 0.85);
  g.fillRoundedRect(w * 0.52, 4, w * 0.3, h - 8, 3);
  // headlights
  g.fillStyle(0xfff3b0, 1);
  g.fillRect(w - 4, 4, 3, 5);
  g.fillRect(w - 4, h - 9, 3, 5);

  g.generateTexture(key, w + 4, h + 4);
  g.destroy();
}

export function generateTextures(scene: Phaser.Scene) {
  carTexture(scene, 'ow-car-player', COLORS.playerCar);
  carTexture(scene, 'ow-car-cop', COLORS.copCar);

  // 1x1 white tile: scaled + tinted for buildings.
  const white = scene.add.graphics();
  white.fillStyle(0xffffff, 1);
  white.fillRect(0, 0, 8, 8);
  white.generateTexture('ow-white', 8, 8);
  white.destroy();

  // Pedestrian — a small rounded body with a head.
  const ped = scene.add.graphics();
  ped.fillStyle(COLORS.ped, 1);
  ped.fillCircle(6, 6, 6);
  ped.fillStyle(0x2a2a33, 1);
  ped.fillCircle(6, 4, 2.4);
  ped.generateTexture('ow-ped', 12, 12);
  ped.destroy();

  // On-foot player.
  const s = PLAYER.size;
  const foot = scene.add.graphics();
  foot.fillStyle(0x000000, 0.25);
  foot.fillCircle(s / 2 + 1, s / 2 + 2, s / 2);
  foot.fillStyle(COLORS.foot, 1);
  foot.fillCircle(s / 2, s / 2, s / 2);
  foot.fillStyle(0x2a2a33, 1);
  foot.fillCircle(s / 2, s / 2 - 2, 2.6);
  foot.generateTexture('ow-foot', s + 2, s + 3);
  foot.destroy();

  // Blood splat marker left when a pedestrian is hit.
  const splat = scene.add.graphics();
  splat.fillStyle(0x8a1f2b, 0.7);
  splat.fillCircle(8, 8, 7);
  splat.fillCircle(3, 11, 3);
  splat.fillCircle(13, 5, 2.5);
  splat.generateTexture('ow-splat', 16, 16);
  splat.destroy();

  void PED;
}
