import * as THREE from 'three';

// Procedural textures for the arena: everything is painted on canvases at
// load, so the game ships no image files. World units are metres; the court
// texture covers FLOOR (x across, y out from the rim).

export const FLOOR = { x0: -15, x1: 15, y0: -9, y1: 18 };
export const COURT = { halfW: 7.62, baseline: -1.6, halfCourt: 12.73 };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** The floor: maple planks with grain, the apron, painted key, lines, and a centre logo. */
export function floorTexture(maxSize = 2048): { map: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const wM = FLOOR.x1 - FLOOR.x0, hM = FLOOR.y1 - FLOOR.y0;
  const W = maxSize, H = Math.round((maxSize * hM) / wM);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const px = (x: number) => ((x - FLOOR.x0) / wM) * W;
  const py = (y: number) => ((y - FLOOR.y0) / hM) * H;
  const m = W / wM; // pixels per metre
  const r = rng(7);

  // Apron: darker stained wood all round.
  g.fillStyle = '#4A2E1B'; g.fillRect(0, 0, W, H);
  // Planks run toward the basket (along y), 7cm wide, staggered ends.
  const plank = 0.07 * m;
  for (let x = 0; x < W; x += plank) {
    let y = -r() * 2 * m;
    while (y < H) {
      const len = (1.2 + r() * 2.4) * m;
      const inCourt = x >= px(-COURT.halfW) && x <= px(COURT.halfW);
      const base = inCourt ? [214, 160, 104] : [104, 66, 40];
      const v = (r() - 0.5) * 26;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v * 0.8},${base[2] + v * 0.6})`;
      g.fillRect(x, y, plank - 0.6, len - 0.8);
      // Grain: faint streaks along the plank.
      g.strokeStyle = `rgba(90,50,20,${0.06 + r() * 0.08})`; g.lineWidth = 0.6;
      for (let k = 0; k < 3; k++) {
        const gx = x + r() * plank;
        g.beginPath(); g.moveTo(gx, y); g.bezierCurveTo(gx + (r() - 0.5) * 4, y + len * 0.3, gx + (r() - 0.5) * 4, y + len * 0.7, gx + (r() - 0.5) * 3, y + len); g.stroke();
      }
      y += len;
    }
  }
  // A satin sheen down the middle of the court, where the finish catches light.
  const sheen = g.createLinearGradient(px(-COURT.halfW), 0, px(COURT.halfW), 0);
  sheen.addColorStop(0, 'rgba(255,230,190,0)'); sheen.addColorStop(0.5, 'rgba(255,230,190,.08)'); sheen.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = sheen; g.fillRect(px(-COURT.halfW), py(COURT.baseline), px(COURT.halfW) - px(-COURT.halfW), py(COURT.halfCourt) - py(COURT.baseline));

  // The paint: deep plum, a touch translucent so the grain shows through.
  g.fillStyle = 'rgba(92,22,58,.86)';
  g.fillRect(px(-2.44), py(COURT.baseline), px(2.44) - px(-2.44), py(4.19) - py(COURT.baseline));
  // Three-point area tint.
  g.save();
  g.beginPath(); g.moveTo(px(-6.7), py(COURT.baseline)); g.lineTo(px(-6.7), py(Math.sqrt(7.24 ** 2 - 6.7 ** 2)));
  const a0 = Math.asin(6.7 / 7.24);
  for (let a = -a0; a <= a0; a += 0.01) g.lineTo(px(Math.sin(a) * 7.24), py(Math.cos(a) * 7.24));
  g.lineTo(px(6.7), py(COURT.baseline)); g.closePath();
  g.fillStyle = 'rgba(255,200,140,.07)'; g.fill();
  g.restore();

  // Lines: crisp white, 5cm.
  g.strokeStyle = 'rgba(250,248,240,.95)'; g.lineWidth = 0.05 * m; g.lineCap = 'butt';
  const line = (pts: Array<[number, number]>, close = false) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(px(x), py(y)) : g.moveTo(px(x), py(y)))); if (close) g.closePath(); g.stroke(); };
  const arc = (cx: number, cy: number, rad: number, s: number, e: number) => { g.beginPath(); for (let a = s; a <= e + 1e-6; a += 0.01) { const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad; if (a === s) g.moveTo(px(x), py(y)); else g.lineTo(px(x), py(y)); } g.stroke(); };
  line([[-COURT.halfW, COURT.baseline], [COURT.halfW, COURT.baseline], [COURT.halfW, COURT.halfCourt], [-COURT.halfW, COURT.halfCourt]], true);
  line([[-2.44, COURT.baseline], [-2.44, 4.19], [2.44, 4.19], [2.44, COURT.baseline]]);
  arc(0, 4.19, 1.8, 0, Math.PI);
  g.setLineDash([0.3 * m, 0.25 * m]); arc(0, 4.19, 1.8, Math.PI, Math.PI * 2); g.setLineDash([]);
  arc(0, 0, 1.22, 0, Math.PI);
  line([[-6.7, COURT.baseline], [-6.7, Math.cos(a0) * 7.24]]);
  line([[6.7, COURT.baseline], [6.7, Math.cos(a0) * 7.24]]);
  g.beginPath(); for (let a = -a0; a <= a0 + 1e-6; a += 0.005) { const x = Math.sin(a) * 7.24, y = Math.cos(a) * 7.24; if (a === -a0) g.moveTo(px(x), py(y)); else g.lineTo(px(x), py(y)); } g.stroke();
  arc(0, COURT.halfCourt, 1.8, Math.PI, Math.PI * 2);
  // Lane hash marks.
  [[-2.44, -1], [2.44, 1]].forEach(([x, d]) => [0.3, 1.2, 2.1, 3.0].forEach(y => line([[x, y], [x + d * 0.15, y]])));

  // Centre-court logo at half court, and a baseline wordmark.
  g.save();
  g.translate(px(0), py(COURT.halfCourt)); g.scale(1, 1);
  g.fillStyle = 'rgba(92,22,58,.9)'; g.beginPath(); g.arc(0, 0, 1.75 * m, Math.PI, Math.PI * 2); g.fill();
  g.restore();
  g.save();
  g.translate(px(0), py(9.6)); g.rotate(Math.PI);
  g.font = `900 italic ${1.3 * m}px Inter, Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(92,22,58,.55)'; g.fillText('VELVET', 0, 0);
  g.restore();
  g.save();
  g.translate(px(0), py(-3.4)); g.rotate(Math.PI);
  g.font = `800 ${0.55 * m}px Inter, Helvetica, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,214,140,.55)'; g.fillText('3 - P O I N T   S H O O T O U T', 0, 0);
  g.restore();

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // Roughness: paint and lines a little rougher than the lacquered wood.
  const rc = document.createElement('canvas'); rc.width = W / 4; rc.height = H / 4;
  const rg = rc.getContext('2d')!;
  rg.fillStyle = '#4a4a4a'; rg.fillRect(0, 0, rc.width, rc.height);
  for (let i = 0; i < 4000; i++) { const v = 60 + r() * 40; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(r() * rc.width, r() * rc.height, 2, 6); }
  const rough = new THREE.CanvasTexture(rc);
  return { map, rough };
}

/** A basketball: pebbled leather with seams. Money balls in red-white-blue panels, Starry white with stars. */
export function ballTexture(kind: 'regular' | 'money' | 'starry'): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const W = 1024, H = 512;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const r = rng(kind === 'regular' ? 3 : kind === 'money' ? 5 : 9);
  if (kind === 'regular') { g.fillStyle = '#D2601F'; g.fillRect(0, 0, W, H); }
  else if (kind === 'money') {
    const cols = ['#C8102E', '#F5F5F5', '#1D3F8F', '#F5F5F5'];
    for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect((i * W) / 4, 0, W / 4, H); }
  } else {
    g.fillStyle = '#F4F6FF'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3B5BDB';
    for (let i = 0; i < 26; i++) {
      const x = r() * W, y = 60 + r() * (H - 120), s = 10 + r() * 16;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, rad = k % 2 ? s * 0.45 : s; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
      g.fill();
    }
  }
  // Subtle mottling.
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * W, r() * H, 2, 2); }
  // Seams: two meridians, the equator, and the two curved seams.
  g.strokeStyle = kind === 'starry' ? '#1C2A6B' : '#1A0E08'; g.lineWidth = 7; g.lineCap = 'round';
  [0, 0.25, 0.5, 0.75].forEach(f => { g.beginPath(); g.moveTo(f * W, 0); g.lineTo(f * W, H); g.stroke(); });
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  [0.125, 0.625].forEach(c => {
    g.beginPath();
    for (let y = 0; y <= H; y += 4) { const lat = (y / H - 0.5) * Math.PI, x = (c + Math.sin(lat * 2) * 0.09) * W; if (y === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  });
  const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;

  // Bump: the pebble grain, with the seams sunk in.
  const bc = document.createElement('canvas'); bc.width = W / 2; bc.height = H / 2;
  const bg = bc.getContext('2d')!;
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, bc.width, bc.height);
  for (let i = 0; i < 26000; i++) { const v = 110 + r() * 110; bg.fillStyle = `rgb(${v},${v},${v})`; bg.beginPath(); bg.arc(r() * bc.width, r() * bc.height, 0.9 + r() * 0.6, 0, 7); bg.fill(); }
  bg.drawImage(cv, 0, 0, bc.width, bc.height);
  bg.globalCompositeOperation = 'source-over';
  const bump = new THREE.CanvasTexture(bc);
  return { map, bump };
}

/** A scrolling LED ribbon: text repeated along a dark band. */
export function ribbonTexture(text: string, color: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#05060C'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '900 44px Inter, Helvetica, Arial, sans-serif'; g.textBaseline = 'middle';
  let x = 10;
  while (x < cv.width) { g.fillStyle = color; g.fillText(text, x, 34); x += g.measureText(text).width + 60; g.fillStyle = '#FFFFFF'; g.fillText('•', x - 40, 34); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** A jersey: colour, trim and a number, for the shooter seen from the broadcast camera. */
export function jerseyTexture(number: number, colors: [string, string] = ['#5C163A', '#F5C451']): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = colors[0]; g.fillRect(0, 0, 256, 256);
  g.fillStyle = colors[1]; g.fillRect(0, 0, 256, 14); g.fillRect(0, 242, 256, 14);
  g.font = '900 120px Inter, Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = colors[1]; g.strokeText(String(number), 64, 130); g.fillStyle = '#FFFFFF'; g.fillText(String(number), 64, 130);
  g.strokeText(String(number), 192, 130); g.fillText(String(number), 192, 130);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The jumbotron screen: score and clock, redrawn when they change. */
export function makeScoreboard(): { tex: THREE.CanvasTexture; draw: (score: number, time: number, label: string) => void } {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const g = cv.getContext('2d')!;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (score: number, time: number, label: string) => {
    g.fillStyle = '#04050A'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(245,196,81,.12)'; for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 512, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#F5C451'; g.font = '800 30px Inter, Helvetica, Arial, sans-serif'; g.fillText(label.toUpperCase(), 256, 34);
    g.fillStyle = '#FFFFFF'; g.font = '900 120px "IBM Plex Mono", monospace'; g.fillText(String(score), 150, 150);
    g.fillStyle = time <= 10 ? '#FF4D4D' : '#7CF7D4'; g.font = '900 72px "IBM Plex Mono", monospace'; g.fillText(time.toFixed(time < 10 ? 1 : 0), 380, 150);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '700 22px Inter, sans-serif'; g.fillText('PTS', 150, 226); g.fillText('TIME', 380, 226);
    tex.needsUpdate = true;
  };
  draw(0, 70, 'Velvet');
  return { tex, draw };
}
