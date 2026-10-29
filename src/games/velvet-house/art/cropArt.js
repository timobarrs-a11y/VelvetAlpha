/**
 * The garden crops, drawn in the game's own art with canvas shapes: a tulip, an apple and a pumpkin. Each is drawn from
 * its base on the ground (0, 0), upwards, `s` times its normal size. The garden bed draws them at the top of its stems,
 * and the shop uses the same drawing for the seed packet's picture.
 */

/**
 * A tulip from a stalk: a closed bud when `open` is 0, the cup opening as it grows, and a full bloom at 1. The leaf
 * joins the stalk, so the plant reads as one plant.
 */
function tulip(c, open) {
  const top = -12 - 8 - 6 * open, w = 3 + 3.5 * open;
  c.strokeStyle = '#3F8F47'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.stroke();
  c.fillStyle = '#4F9A4C'; c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(-3, -6, -7, -9.5); c.quadraticCurveTo(-3.5, -7.5, 0, -4); c.fill();
  c.fillStyle = '#B8325E';
  c.beginPath(); c.moveTo(-w, -12); c.quadraticCurveTo(-w - 1.5, top + 5, 0, top - 1); c.quadraticCurveTo(w + 1.5, top + 5, w, -12);
  c.quadraticCurveTo(0, -9.5, -w, -12); c.fill();
  c.fillStyle = '#E9457A';
  c.beginPath(); c.moveTo(-w * 0.6, -12); c.quadraticCurveTo(-w * 0.7, top + 3, 0, top); c.quadraticCurveTo(w * 0.7, top + 3, w * 0.6, -12);
  c.quadraticCurveTo(0, -10, -w * 0.6, -12); c.fill();
  if (open > 0.5) { // the outer petals fall open once the bloom is past halfway
    c.fillStyle = '#D9356A';
    c.beginPath(); c.moveTo(-w * 0.9, -12); c.quadraticCurveTo(-w - 2.5 * open, -17, -w - 1 * open, top + 6); c.quadraticCurveTo(-w, -13, -w * 0.9, -12); c.fill();
    c.beginPath(); c.moveTo(w * 0.9, -12); c.quadraticCurveTo(w + 2.5 * open, -17, w + 1 * open, top + 6); c.quadraticCurveTo(w, -13, w * 0.9, -12); c.fill();
  }
  c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-1.6, -16 + 2 * open, 0.7, 2.2, 0.2, 0, Math.PI * 2); c.fill();
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
export function drawCrop(ctx, x, y, s, crop, angle = 0, stage = 'final') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  if (crop === 'flower') tulip(ctx, { seed: 0, small: 0.25, mid: 0.65, final: 1 }[stage] ?? 1);
  else if (crop === 'fruit') apple(ctx);
  else if (crop === 'vegetable') pumpkin(ctx);
  ctx.restore();
}

/**
 * A ground vine on the soil of one bed spot: leaves lie flat and vines reach out, and at mid and final size a pumpkin
 * sits on the ground near its base. Dead vines stay flat and brown.
 */
export function drawVineSpot(ctx, x, y, crop, stage, dead, t, k) {
  const sway = Math.sin(t * 2.2 + k * 0.9) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  const leaf = dead ? '#8A6A3A' : '#3F7D4E', leafLight = dead ? '#A8864E' : '#5CA05E';
  ctx.strokeStyle = leaf; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(5, -1, 11, 1.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -1.5, -9, 0.5); ctx.stroke();
  ctx.fillStyle = leafLight; ctx.beginPath(); ctx.ellipse(4, -2, 3.2, 1.6, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = leaf; ctx.beginPath(); ctx.ellipse(-4, -1.5, 3, 1.4, 0.3, 0, Math.PI * 2); ctx.fill();
  // The pumpkin is drawn at its own size here: the spot itself is not scaled, so it is set to be a fruit of the bed.
  if (!dead && (stage === 'mid' || stage === 'final')) drawCrop(ctx, 2, 0.5, stage === 'final' ? 1.4 : 0.95, crop, 0);
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
