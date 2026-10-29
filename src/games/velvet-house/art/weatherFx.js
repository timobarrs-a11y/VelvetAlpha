/**
 * Rain and snow on the yard, built for speed:
 *  - Fixed pools of drops, splashes and flakes, reused every frame. Nothing is created per frame except the projected
 *    points, and the pools are sized by the quality tier.
 *  - The splash ring and the snowflake are each drawn once to a small offscreen canvas, then stamped with drawImage.
 *  - All the rain streaks go into one path with one stroke, so the GPU sees one draw call for the whole rain.
 *  - Drops fall in the yard's own space and land on the ground: each landing makes a splash, and rain builds puddles
 *    on the tile it hit, which dry slowly. Snow that lands adds to the lawn's snow.
 *  - Drawing is split in two: the ground layer (puddles and splashes) goes under the furniture, and the air layer
 *    (falling drops and flakes) goes over it.
 */

const TAU = Math.PI * 2;
const SPLASH_LIFE = 0.36;
const PUDDLE_DRY = 0.02;
const PUDDLE_ADD = 0.016;
const SNOW_ADD = 0.07;

/** Convex hull of screen points (monotone chain), so the lot's outline can be a clip region. */
export function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let k = p.length - 1; k >= 0; k--) { const q = p[k]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function sprite(w, h, paint) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  paint(cv.getContext('2d'), w, h);
  return cv;
}

// A splash: two uneven rings that do not sit centred on each other, and three droplets flicked up. Drawn once, then
// scaled and faded while it plays.
const SPLASH = sprite(40, 24, (c, w, h) => {
  c.strokeStyle = 'rgba(240,248,255,.9)'; c.lineWidth = 1.2;
  c.beginPath(); c.ellipse(w / 2 - 1, h / 2 + 1, 14, 5.2, 0.08, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(225,240,255,.55)'; c.lineWidth = 0.8;
  c.beginPath(); c.ellipse(w / 2 + 2, h / 2, 8.5, 3, -0.12, 0, TAU); c.stroke();
  c.fillStyle = 'rgba(245,250,255,.95)';
  for (const [dx, dy, r] of [[-11, -7, 1.1], [10, -9, 1.3], [1, -12, 0.9]]) { c.beginPath(); c.arc(w / 2 + dx, h / 2 + dy, r, 0, TAU); c.fill(); }
});

// A soft white dot, drawn once.
const FLAKE = sprite(8, 8, (c, w, h) => {
  const g = c.createRadialGradient(4, 4, 0, 4, 4, 4);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});

/** A fixed pool: parallel typed arrays, reused. `n` is how many are alive; dead ones are swapped out. */
function pool(max) {
  return { n: 0, max, kd: new Uint8Array(max), x: new Float32Array(max), y: new Float32Array(max), z: new Float32Array(max), v: new Float32Array(max), p: new Float32Array(max), ax: new Float32Array(max), ay: new Float32Array(max) };
}

function kill(P, k) {
  const last = --P.n;
  P.x[k] = P.x[last]; P.y[k] = P.y[last]; P.z[k] = P.z[last]; P.v[k] = P.v[last]; P.p[k] = P.p[last]; P.ax[k] = P.ax[last]; P.ay[k] = P.ay[last]; P.kd[k] = P.kd[last];
}

function tileAt(tiles, x, y) {
  const i = Math.min(9, Math.max(0, Math.floor(x))), j = Math.min(7, Math.max(0, Math.floor(y)));
  return tiles[i * 8 + j];
}

export function createWeatherFx() {
  const rain = pool(900);
  const snow = pool(600);
  const splash = pool(260);
  let time = 0;

  function spawn(P, cap, makeV) {
    const want = Math.min(P.max, cap);
    const room = Math.min(want - P.n, Math.ceil(want * 0.04)); // fill in about a second, a little each frame
    for (let k = 0; k < room; k++) {
      const i = P.n++;
      P.x[i] = Math.random() * 10; P.y[i] = Math.random() * 8; P.z[i] = 3.2 + Math.random() * 0.6;
      P.v[i] = makeV(); P.p[i] = Math.random() * TAU;
      // Each drop's own sideways speed, so rain comes down slanted and not all in one direction.
      P.ax[i] = 0.7 + Math.random() * 0.9; P.ay[i] = 0.15 + Math.random() * 0.45;
    }
  }

  return {
    /**
     * Moves the weather on by `dt` seconds. `s` says what is falling; `caps` is how many drops the quality tier allows.
     */
    step(dt, s, tiles, caps) {
      time += dt;
      if (s.raining && !s.snow) spawn(rain, caps.rain, () => -(8.5 + Math.random() * 2));
      if (s.raining && s.snow) spawn(snow, caps.snow, () => -(1.1 + Math.random() * 0.6));

      for (let k = rain.n - 1; k >= 0; k--) {
        rain.z[k] += rain.v[k] * dt; rain.x[k] += rain.ax[k] * dt; rain.y[k] += rain.ay[k] * dt;
        if (rain.z[k] <= 0) {
          if (splash.n < splash.max) { const q = splash.n++; splash.x[q] = rain.x[k]; splash.y[q] = rain.y[k]; splash.p[q] = 0; splash.kd[q] = 0; }
          const tt = tileAt(tiles, rain.x[k], rain.y[k]);
          if (tt) tt.puddle = Math.min(1, (tt.puddle || 0) + PUDDLE_ADD);
          kill(rain, k);
        }
      }

      for (let k = snow.n - 1; k >= 0; k--) {
        const sway = Math.sin(time * 1.3 + snow.p[k]) * 0.5;
        snow.z[k] += snow.v[k] * dt; snow.x[k] += (0.2 + sway) * dt;
        if (snow.z[k] <= 0) {
          const tt = tileAt(tiles, snow.x[k], snow.y[k]);
          if (tt) tt.snow = Math.min(1, (tt.snow || 0) + SNOW_ADD);
          // A soft puff where the flake lands, so snow reads as landing and not as vanishing.
          if (splash.n < splash.max) { const q = splash.n++; splash.x[q] = snow.x[k]; splash.y[q] = snow.y[k]; splash.p[q] = 0; splash.kd[q] = 1; }
          kill(snow, k);
        }
      }

      for (let k = splash.n - 1; k >= 0; k--) {
        splash.p[k] += dt;
        if (splash.p[k] >= SPLASH_LIFE) kill(splash, k);
      }

      // Puddles dry slowly once the rain stops.
      if (!s.raining) for (const tt of tiles) if (tt.puddle) tt.puddle = Math.max(0, tt.puddle - PUDDLE_DRY * dt);
    },

    /** The ground layer: puddles and splashes, drawn under the furniture. */
    drawGround(c, iso, tiles) {
      for (const tt of tiles) {
        const p = tt.puddle || 0;
        if (p < 0.04) continue;
        const [sx, sy] = iso(tt.i + 0.5, tt.j + 0.5, 0.01);
        c.fillStyle = `rgba(70,100,130,${0.42 * p})`;
        c.beginPath(); c.ellipse(sx, sy, 14 * p + 4, 7 * p + 2, 0, 0, TAU); c.fill();
        c.fillStyle = `rgba(230,240,255,${0.28 * p})`;
        c.beginPath(); c.ellipse(sx - 2, sy - 1, 5 * p + 1, 2 * p + 0.6, 0, 0, TAU); c.fill();
      }
      for (let k = 0; k < splash.n; k++) {
        const [sx, sy] = iso(splash.x[k], splash.y[k], 0.01);
        // It opens out as it fades: small at the hit, wider and paler by the end.
        const t = splash.p[k] / SPLASH_LIFE, sc = 0.45 + 0.75 * t;
        if (splash.kd[k]) { c.globalAlpha = (1 - t) * 0.6; c.drawImage(FLAKE, sx - 6 * sc, sy - 3 * sc, 12 * sc, 6 * sc); }
        else { c.globalAlpha = (1 - t) * 0.9; c.drawImage(SPLASH, sx - 20 * sc, sy - 12 * sc, 40 * sc, 24 * sc); }
      }
      c.globalAlpha = 1;
    },

    /**
     * The weather over the neighbourhood behind the yard: drops that hold no state, each worked out from the clock alone, so it costs one
     * stroke. They fall with the same slant and speed as the yard's own, and ring the ground where they land. `o` = { n, snow, W, H, TW, TH, ZH }.
     */
    drawField(c, t, o) {
      const { n, snow, W, H, TW, TH, ZH } = o, fract = (v) => v - Math.floor(v), hs = (i, k) => fract(Math.sin(i * 12.9898 + k * 78.233) * 43758.5453);
      if (n < 1) return;
      c.save();
      if (snow) {
        c.fillStyle = 'rgba(246,248,250,.85)';
        for (let i = 0; i < n; i++) {
          const fall = 3.4 / (1.1 + hs(i, 3) * 0.6), cyc = (t + hs(i, 4) * fall) % fall, z = 3.4 * (1 - cyc / fall), lx = hs(i, 1) * (W + 40) - 20, ly = hs(i, 2) * H;
          const sx = lx + Math.sin(t * 1.3 + hs(i, 5) * 6.28) * 6, sy = ly - z * ZH;
          c.fillRect(sx, sy, 2, 2);
        }
        c.restore(); return;
      }
      c.strokeStyle = 'rgba(205,220,240,.5)'; c.lineWidth = 1; c.beginPath();
      const rip = [];
      for (let i = 0; i < n; i++) {
        const vz = 8.5 + hs(i, 3) * 2, fall = 3.4 / vz, rest = 0.35, per = fall + rest, cyc = (t + hs(i, 4) * per) % per;
        const ax = 0.7 + hs(i, 6) * 0.9, ay = 0.15 + hs(i, 7) * 0.45, lx = hs(i, 1) * (W + 40) - 20, ly = hs(i, 2) * H;
        if (cyc < fall) {
          const z = 3.4 * (1 - cyc / fall), k = (zz) => [lx - (ax - ay) * TW * zz / vz, ly - (ax + ay) * TH * zz / vz - zz * ZH], [tx, ty] = k(z + 0.45), [bx, by] = k(z);
          c.moveTo(tx, ty); c.lineTo(bx, by);
        } else rip.push(lx, ly, (cyc - fall) / rest);
      }
      c.stroke();
      c.strokeStyle = 'rgba(230,240,255,.3)'; c.beginPath();
      for (let k = 0; k < rip.length; k += 3) { const a = rip[k + 2], r = 1.5 + a * 5; c.moveTo(rip[k] + r, rip[k + 1]); c.ellipse(rip[k], rip[k + 1], r, r / 2, 0, 0, TAU); }
      c.stroke();
      c.restore();
    },

    /** The air layer: falling drops in one stroke, and snowflakes stamped. Drawn over the house. */
    drawAir(c, iso, clip) {
      // Rain and snow stay inside the lot: the clip is the lot's outline, so nothing falls in the sky past the walls.
      if (clip) { c.save(); c.beginPath(); clip.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); }
      if (rain.n) {
        c.save();
        c.strokeStyle = 'rgba(205,220,240,.5)'; c.lineWidth = 1;
        c.beginPath();
        for (let k = 0; k < rain.n; k++) {
          // The streak runs back along the drop's own velocity, so a slanted drop draws a slanted streak.
          const [tx, ty] = iso(rain.x[k] - rain.ax[k] * 0.05, rain.y[k] - rain.ay[k] * 0.05, rain.z[k] + 0.45);
          const [bx, by] = iso(rain.x[k], rain.y[k], rain.z[k]);
          c.moveTo(tx, ty); c.lineTo(bx, by);
        }
        c.stroke();
        c.restore();
      }
      for (let k = 0; k < snow.n; k++) {
        const [sx, sy] = iso(snow.x[k], snow.y[k], snow.z[k]);
        c.drawImage(FLAKE, sx - 4, sy - 4, 8, 8);
      }
      if (clip) c.restore();
    },
  };
}
