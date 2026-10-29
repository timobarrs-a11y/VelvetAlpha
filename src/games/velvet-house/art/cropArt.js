/**
 * The garden crops, drawn in the game's own art with canvas shapes: a tulip, an apple and a pumpkin. Each is drawn from
 * its base on the ground (0, 0), upwards, `s` times its normal size. The garden bed draws them at the top of its stems,
 * and the shop uses the same drawing for the seed packet's picture.
 */

function tulip(c) {
  c.strokeStyle = '#3F8F47'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.stroke();
  c.fillStyle = '#4F9A4C'; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(-5, -9, -6.5, -12.5); c.quadraticCurveTo(-2, -11, 0, -6); c.fill();
  c.fillStyle = '#B8325E';
  c.beginPath(); c.moveTo(-5.5, -12); c.quadraticCurveTo(-6.5, -20, -2.5, -24); c.lineTo(0, -21); c.lineTo(2.5, -24);
  c.quadraticCurveTo(6.5, -20, 5.5, -12); c.quadraticCurveTo(0, -9.5, -5.5, -12); c.fill();
  c.fillStyle = '#E9457A';
  c.beginPath(); c.moveTo(-3.5, -12); c.quadraticCurveTo(-4.5, -19, 0, -23.5); c.quadraticCurveTo(4.5, -19, 3.5, -12);
  c.quadraticCurveTo(0, -9.5, -3.5, -12); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-1.6, -17, 0.7, 2.2, 0.2, 0, Math.PI * 2); c.fill();
}

function apple(c) {
  c.strokeStyle = '#5A3A1E'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -10.5); c.quadraticCurveTo(0.6, -12.5, 0.2, -14); c.stroke();
  c.fillStyle = '#4F9A4C'; c.beginPath(); c.moveTo(1, -12); c.quadraticCurveTo(4.5, -17, 8.5, -13.5); c.quadraticCurveTo(5, -10.5, 1, -12); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(4.8, -12.6, 1.2, 0.5, -0.3, 0, Math.PI * 2); c.fill();
  // The body is two rounded lobes with a dip at the top, so it reads as an apple and not a ball.
  const body = () => { c.beginPath(); c.moveTo(0, -8.5); c.bezierCurveTo(2.2, -10, 6.4, -9.8, 6.4, -5.6); c.bezierCurveTo(6.4, -1.2, 2.6, 0.4, 0, -1.2);
    c.bezierCurveTo(-2.6, 0.4, -6.4, -1.2, -6.4, -5.6); c.bezierCurveTo(-6.4, -9.8, -2.2, -10, 0, -8.5); c.closePath(); };
  const g = c.createRadialGradient(-2, -6.5, 0.6, -0.5, -5, 7.5);
  g.addColorStop(0, '#FF9A88'); g.addColorStop(0.45, '#E63B3B'); g.addColorStop(1, '#7E0F1C');
  c.fillStyle = g; body(); c.fill();
  c.strokeStyle = 'rgba(90,10,20,.35)'; c.lineWidth = 0.7; body(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-2.8, -6.2, 1.2, 2.2, 0.35, 0, Math.PI * 2); c.fill();
}

function pumpkin(c) {
  c.strokeStyle = '#5A3A1E'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, -8.5); c.quadraticCurveTo(0.5, -10.5, 1.5, -11.5); c.stroke();
  c.fillStyle = '#4F9A4C'; c.beginPath(); c.ellipse(3.6, -11.5, 3.2, 1.4, -0.3, 0, Math.PI * 2); c.fill();
  const g = c.createRadialGradient(-2, -6.5, 0.8, 0, -4.5, 8);
  g.addColorStop(0, '#FFB870'); g.addColorStop(0.5, '#F08A24'); g.addColorStop(1, '#9E4A0E');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, -4.5, 7.5, 5.5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(160,80,20,.5)'; c.lineWidth = 0.8;
  c.beginPath(); c.ellipse(-3, -4.5, 2.4, 5.2, 0, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.ellipse(3, -4.5, 2.4, 5.2, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-3.5, -7.5, 1.2, 1.6, 0.4, 0, Math.PI * 2); c.fill();
}

/** Draws one crop at (x, y), its base on the ground, `s` times its normal size. */
export function drawCrop(ctx, x, y, s, crop, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  if (crop === 'flower') tulip(ctx);
  else if (crop === 'fruit') apple(ctx);
  else if (crop === 'vegetable') pumpkin(ctx);
  ctx.restore();
}

const icons = new Map();

/** A picture of a crop for the shop: the same drawing, rendered once to an image and kept. */
export function cropIconUrl(crop) {
  if (icons.has(crop)) return icons.get(crop);
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 96;
  const c = cv.getContext('2d');
  if (!c) return '';
  drawCrop(c, 48, 90, 3.5, crop);
  const url = cv.toDataURL();
  icons.set(crop, url);
  return url;
}
