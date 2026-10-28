// Wall lamps: eight fixtures that stand out of the wall, each built from boxes and strokes in the wall's own frame
// so they have a back plate, an arm, a body with a lit side and a shadowed side, and a shadow on the wall behind.
//
// A fixture is drawn by `drawWallLamp(h, style, on)`. `h` is the host's set of drawing tools:
//   W(u, o, z)      a point on the wall as world [x, y, z]: u along the wall, o out from it, z up
//   wb(u,o,z,du,do,dz,col)  a box on the wall (u, o, z) to (u+du, o+do, z+dz), shaded like every other box
//   wp(pts, fill, stroke, lw)   a flat polygon from [u, o, z] points
//   wl(a, b, col, w)    a line between two [u, o, z] points
//   sp(u, o, z)         the point on screen, [x, y]
//   um, z               where the fixture is centred along the wall and how high
//   ctx, ell, circle    the canvas and its two shape helpers; shade() lightens or darkens a colour

export const WALL_LAMP_STYLES = ['classic', 'swing', 'cylinder', 'globe', 'candle', 'lantern', 'deco', 'cage'];

const BRASS = '#B8893A', IRON = '#2B2B30', GLASS_ON = '#FFF0C4', GLASS_OFF = '#E7DCC8';

/** A round soft patch lying on the wall plane (so it is squashed along the wall like everything else on it). */
function wallDisc(h, u, z, r, inner, outer) {
  const { ctx, sp } = h, o = sp(u, 0.004, z), eu = sp(u + 1, 0.004, z), ez = sp(u, 0.004, z + 1);
  ctx.save();
  ctx.transform(eu[0] - o[0], eu[1] - o[1], ez[0] - o[0], ez[1] - o[1], o[0], o[1]);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** A soft round glow on the screen, around a lit shade or bulb. */
function halo(h, o, dz, r, strength = 1) {
  const { ctx, sp, um, z } = h, [x, y] = sp(um, o, z + dz);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,240,200,${0.55 * strength})`); g.addColorStop(0.4, `rgba(255,226,160,${0.22 * strength})`); g.addColorStop(1, 'rgba(255,226,160,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** What a fixture does to the wall behind it: a shadow to the lower side, and a warm wash when it is lit. */
function behind(h, r, on) {
  const { um, z } = h;
  wallDisc(h, um + 0.05, z - 0.09, r * 0.8, 'rgba(30,15,10,.3)', 'rgba(30,15,10,0)');
  if (on) wallDisc(h, um, z, r * 2.4, 'rgba(255,226,160,.36)', 'rgba(255,226,160,0)');
}

const glow = (h, o, dz, r, on) => { if (on) halo(h, o, dz, r); };

const DRAW = {
  // A drum shade on a short arm.
  classic(h, on) {
    const { um, z, wb, wl } = h;
    behind(h, 0.3, on);
    wb(um - 0.07, 0, z - 0.13, 0.14, 0.03, 0.26, '#6B5648');
    wl([um, 0.03, z - 0.02], [um, 0.09, z - 0.02], BRASS, 2.4);
    glow(h, 0.17, 0.02, 20, on);
    wb(um - 0.11, 0.06, z - 0.1, 0.22, 0.2, 0.24, on ? GLASS_ON : '#C9B48A');
    for (let k = -2; k <= 2; k++) wl([um + k * 0.045, 0.262, z - 0.09], [um + k * 0.045, 0.262, z + 0.12], on ? '#E9C877' : '#9C875F', 0.9);
    wb(um - 0.115, 0.055, z + 0.12, 0.23, 0.21, 0.025, BRASS);
    wb(um - 0.115, 0.055, z - 0.115, 0.23, 0.21, 0.02, BRASS);
  },
  // A brass arm that swings out and bends, with a small cone shade at the end.
  swing(h, on) {
    const { um, z, wb, wl, wp, sp, circle } = h;
    behind(h, 0.27, on);
    wb(um - 0.05, 0, z - 0.1, 0.1, 0.03, 0.2, BRASS);
    wl([um, 0.03, z], [um, 0.2, z + 0.05], BRASS, 2.6);
    wl([um, 0.2, z + 0.05], [um, 0.34, z - 0.02], BRASS, 2.6);
    [[0.2, z + 0.05], [0.03, z]].forEach(([o, zz]) => { const [x, y] = sp(um, o, zz); circle(x, y, 1.8, '#E2C06E'); });
    glow(h, 0.34, -0.12, 17, on);
    const lit = on ? '#FFE9A8' : '#D9C9A8', dark = on ? '#F2C96A' : h.shade('#D9C9A8', -0.2);
    wp([[um - 0.05, 0.34, z - 0.02], [um, 0.34, z - 0.02], [um, 0.34, z - 0.22], [um - 0.13, 0.34, z - 0.22]], lit, 'rgba(60,40,30,.45)', 0.8);
    wp([[um, 0.34, z - 0.02], [um + 0.05, 0.34, z - 0.02], [um + 0.13, 0.34, z - 0.22], [um, 0.34, z - 0.22]], dark, 'rgba(60,40,30,.45)', 0.8);
    wl([um - 0.13, 0.34, z - 0.22], [um + 0.13, 0.34, z - 0.22], BRASS, 1.6);
  },
  // A matte tube that lights the wall above and below.
  cylinder(h, on) {
    const { um, z, wb, wp } = h;
    behind(h, 0.36, on);
    if (on) {
      wp([[um - 0.06, 0.004, z + 0.2], [um + 0.06, 0.004, z + 0.2], [um + 0.22, 0.004, z + 0.56], [um - 0.22, 0.004, z + 0.56]], 'rgba(255,226,160,.22)');
      wp([[um - 0.06, 0.004, z - 0.2], [um + 0.06, 0.004, z - 0.2], [um + 0.22, 0.004, z - 0.56], [um - 0.22, 0.004, z - 0.56]], 'rgba(255,226,160,.22)');
    }
    wb(um - 0.065, 0, z - 0.2, 0.13, 0.13, 0.4, '#34323A');
    wb(um - 0.065, 0, z + 0.2, 0.13, 0.13, 0.012, on ? '#FFF2CC' : '#55535B');
    wb(um - 0.065, 0, z - 0.212, 0.13, 0.13, 0.012, on ? '#FFF2CC' : '#55535B');
  },
  // An opal globe on a short stem.
  globe(h, on) {
    const { um, z, wb, sp, circle, ell } = h;
    behind(h, 0.24, on);
    wb(um - 0.06, 0, z - 0.06, 0.12, 0.025, 0.12, '#8E939A');
    wb(um - 0.02, 0.025, z - 0.02, 0.04, 0.08, 0.04, '#8E939A');
    const [x, y] = sp(um, 0.2, z);
    glow(h, 0.2, 0, 19, on);
    circle(x, y, 7, on ? '#FFF1C4' : '#BEB8AC');
    ell(x + 1.2, y + 2, 5.4, 4.2, on ? 'rgba(255,214,140,.5)' : 'rgba(120,110,100,.18)');
    ell(x - 2.4, y - 2.6, 2.4, 1.6, 'rgba(255,255,255,.85)');
    ell(x, y - 6.6, 3.6, 1.2, '#8E939A');
  },
  // Iron scrollwork holding a candle-shaped bulb with a little flame.
  candle(h, on) {
    const { um, z, wb, wl, sp, ell, circle } = h;
    behind(h, 0.3, on);
    wb(um - 0.04, 0, z - 0.14, 0.08, 0.025, 0.28, IRON);
    wl([um, 0.025, z - 0.06], [um + 0.1, 0.09, z - 0.1], IRON, 1.6);
    wl([um, 0.025, z - 0.06], [um - 0.1, 0.09, z - 0.1], IRON, 1.6);
    wl([um + 0.1, 0.09, z - 0.1], [um + 0.04, 0.14, z - 0.1], IRON, 1.6);
    wl([um - 0.1, 0.09, z - 0.1], [um - 0.04, 0.14, z - 0.1], IRON, 1.6);
    wb(um - 0.05, 0.09, z - 0.11, 0.1, 0.1, 0.03, IRON);
    wb(um - 0.025, 0.115, z - 0.08, 0.05, 0.05, 0.2, '#F6EEDC');
    const [fx, fy] = sp(um, 0.14, z + 0.13);
    glow(h, 0.14, 0.14, 16, on);
    if (on) { ell(fx, fy - 2, 2, 3.4, '#FFB84A'); ell(fx, fy - 1.4, 1, 2, '#FFF6C8'); } else circle(fx, fy, 0.9, '#4A3A30');
  },
  // A cage lantern with glass sides and a pitched cap.
  lantern(h, on) {
    const { um, z, wb, wl } = h;
    behind(h, 0.33, on);
    wb(um - 0.05, 0, z - 0.2, 0.1, 0.03, 0.4, IRON);
    wl([um, 0.03, z + 0.12], [um, 0.1, z + 0.12], IRON, 2);
    glow(h, 0.17, -0.02, 22, on);
    wb(um - 0.1, 0.08, z - 0.2, 0.2, 0.18, 0.04, IRON);
    wb(um - 0.09, 0.09, z - 0.16, 0.18, 0.16, 0.28, on ? '#FFE9A8' : '#CFD6D4');
    [[-0.09, 0.09], [0.09, 0.09], [-0.09, 0.25], [0.09, 0.25]].forEach(([du, o]) => wl([um + du, o, z - 0.16], [um + du, o, z + 0.12], IRON, 1.3));
    wb(um - 0.11, 0.07, z + 0.12, 0.22, 0.2, 0.025, IRON);
    wb(um - 0.07, 0.11, z + 0.145, 0.14, 0.12, 0.05, IRON);
  },
  // A gold fan shell: stepped plate, alabaster fan, gold ribs.
  deco(h, on) {
    const { um, z, wb, wl, wp, sp, ctx } = h;
    behind(h, 0.24, on);
    wb(um - 0.13, 0, z - 0.14, 0.26, 0.025, 0.05, BRASS);
    wb(um - 0.09, 0.025, z - 0.1, 0.18, 0.02, 0.04, '#D4AE56');
    glow(h, 0.1, 0.05, 22, on);
    const rim = [];
    for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; rim.push([um - Math.cos(a) * 0.2, 0.08, z - 0.06 + Math.sin(a) * 0.26]); }
    wp([[um, 0.08, z - 0.06], ...rim], on ? '#FFF3D4' : '#E8E1D2', BRASS, 1.1);
    for (let k = 1; k < 8; k++) wl([um, 0.08, z - 0.06], rim[k], 'rgba(184,137,58,.7)', 0.9);
    const [x, y] = sp(um, 0.08, z - 0.06);
    ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#D4AE56'; ctx.fill();
  },
  // A bare bulb in a wire cage on an iron pipe arm.
  cage(h, on) {
    const { um, z, wb, wl, sp, circle, ell, ctx } = h;
    behind(h, 0.27, on);
    wb(um - 0.06, 0, z - 0.06, 0.12, 0.03, 0.12, IRON);
    wb(um - 0.025, 0.03, z - 0.025, 0.05, 0.12, 0.05, '#4A4A52');
    const [x, y] = sp(um, 0.22, z);
    glow(h, 0.22, 0, 22, on);
    circle(x, y, 5.6, on ? '#FFC060' : '#D9CFC0');
    if (on) circle(x, y, 2.6, '#FFF3C8');
    ctx.strokeStyle = IRON; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, 7.4, 8.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, 3.4, 8.6, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 7.4, y); ctx.lineTo(x + 7.4, y); ctx.stroke();
    ell(x, y - 9.4, 3.2, 1.3, IRON);
  },
};

const shadeOf = (h, c) => h.shade(c, -0.18);

/** Draw one fixture in the given style; an unknown style falls back to the classic drum. */
export function drawWallLamp(h, style, on) { (DRAW[style] || DRAW.classic)(h, !!on); }
