import * as THREE from 'three';
import { BOWL } from './crowd';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ribbonTexture } from './textures';

// The building around the court: a sky-dome gradient instead of a black
// void, the suite level (kept dark behind the rim), back walls, the roof with
// its girders and grouped lighting rigs, banners in the rafters, light beams
// through the haze and dust drifting in them. Game coords (x across, y out, z up) via `toThree`.

type V = [number, number, number];

export interface Arena { ribbons: THREE.Texture[]; update(t: number, dt: number): void }

const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Suite windows for one section, `len` metres long: suites grouped into bays
 *  between dark pillars, warm light, the odd silhouette. `dark(u)` (0..1, at
 *  0..1 along the texture) dims and empties the suites that sit behind the rim
 *  from some rack, so the shooter's backdrop stays calm. */
function suiteTexture(len: number, seed: number, dark: (u: number) => number): THREE.CanvasTexture {
  const r = rng(seed), W = 2048, pxm = W / len;
  const suite = 1.5, pillar = 0.9, perBay = 4;
  const shade = (hex: string, k: number) => {
    const n = parseInt(hex.slice(1), 16), c = (v: number) => Math.round(v * k);
    return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
  };
  return canvasTex(W, 128, g => {
    g.fillStyle = '#0a090d'; g.fillRect(0, 0, W, 128);
    for (let m = pillar / 2; m < len; m += perBay * suite + pillar) {
      const bayEnd = Math.min(len, m + perBay * suite);
      // A thin, dim gold rail over each bay (an accent, not a light line).
      g.fillStyle = shade('#B8923A', 0.55 - 0.3 * dark((m + bayEnd) / 2 / len));
      g.fillRect(m * pxm, 8, (bayEnd - m) * pxm, 3);
      for (let k = 0; k < perBay && m + (k + 1) * suite <= len + 0.01; k++) {
        const x0 = (m + k * suite) * pxm + 3, w = suite * pxm - 6;
        const d = dark((m + (k + 0.5) * suite) / len);
        const lit = r() < 0.72 - 0.55 * d, b = (1 - 0.6 * d) * (0.7 + 0.3 * r());
        const grad = g.createLinearGradient(0, 20, 0, 108);
        grad.addColorStop(0, lit ? shade(r() < 0.8 ? '#E0A868' : '#B9A48E', b) : '#17131c');
        grad.addColorStop(1, lit ? shade('#6B3A1C', b) : '#0e0b12');
        g.fillStyle = grad; g.fillRect(x0, 22, w, 84);
        if (lit) for (let q = 0; q < 2; q++) if (r() < 0.6) { g.fillStyle = 'rgba(12,8,12,.8)'; const px = x0 + 6 + r() * (w - 12); g.beginPath(); g.arc(px, 70, 6, 0, 7); g.fill(); g.fillRect(px - 8, 76, 16, 30); }
      }
    }
  });
}

/** The back walls: dark acoustic panels with vertical light strips. */
function wallTexture(): THREE.CanvasTexture {
  return canvasTex(512, 256, g => {
    g.fillStyle = '#0d0b16'; g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 32) { g.fillStyle = x % 64 ? '#121020' : '#100d1b'; g.fillRect(x, 0, 30, 256); }
    for (let x = 60; x < 512; x += 128) {
      const grad = g.createLinearGradient(x, 0, x + 6, 0);
      grad.addColorStop(0, 'rgba(244,114,182,0)'); grad.addColorStop(0.5, 'rgba(244,114,182,.5)'); grad.addColorStop(1, 'rgba(244,114,182,0)');
      g.fillStyle = grad; g.fillRect(x - 6, 0, 18, 256);
    }
  });
}

function bannerTexture(lines: string[], col: string, trim: string): THREE.CanvasTexture {
  return canvasTex(256, 512, g => {
    g.fillStyle = col; g.fillRect(0, 0, 256, 512);
    g.fillStyle = trim; g.fillRect(0, 0, 256, 14); g.fillRect(0, 440, 256, 14);
    g.beginPath(); g.moveTo(0, 470); g.lineTo(128, 512); g.lineTo(256, 470); g.lineTo(256, 512); g.lineTo(0, 512); g.fillStyle = '#000'; g.globalCompositeOperation = 'destination-out'; g.fill(); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.font = `900 ${i === 0 ? 92 : 42}px Inter, Helvetica, Arial, sans-serif`; g.fillText(l, 128, 160 + i * 110); });
  });
}

export function buildArena(scene: THREE.Scene, toThree: (v: V) => THREE.Vector3, opts: { hi: boolean; spots: V[] }): Arena {
  const group = new THREE.Group();
  scene.add(group);
  const ribbons: THREE.Texture[] = [];
  const front = (sec: (typeof BOWL.sections)[number], depth: number) => sec.fixed + sec.dir * depth;
  const lowerBack = BOWL.lowerRows * BOWL.rowDepth;
  const upperBack = lowerBack + BOWL.gap + BOWL.upperRows * BOWL.rowDepth;
  const upperTop = BOWL.upperZ + BOWL.upperRows * 0.5;

  // ---- Sky dome and haze: the far reaches fade into a dark, near-neutral haze
  // (a hint of wine), so the bright court is what the eye finds first.
  scene.background = new THREE.Color(0x060508);
  scene.fog = new THREE.Fog(0x0b090d, 26, 85);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x030305) }, mid: { value: new THREE.Color(0x0c0a10) }, low: { value: new THREE.Color(0x140b12) } },
      vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.5, h)) : mix(mid, low, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  dome.renderOrder = -1;
  group.add(dome);

  const wallTex = (() => { const t = wallTexture(); t.wrapS = THREE.RepeatWrapping; return t; })();
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.8 });
  // How much of a section sits behind the rim from some rack (0..1), by
  // position along it: all of the baseline end, and the sidelines' near end.
  const backdrop = (sec: (typeof BOWL.sections)[number], a: number) =>
    sec.along === 'x' ? 1 - 0.4 * THREE.MathUtils.smoothstep(Math.abs(a), 16, 24) : 1 - THREE.MathUtils.smoothstep(a, 2, 10);

  BOWL.sections.forEach((sec, i) => {
    const extra = 8, from = sec.from - extra, to = sec.to + extra, len = to - from, mid = (from + to) / 2;
    // Which way the plane's +x (texture u) runs along the section once it faces the court.
    const sign = sec.along === 'x' ? (sec.dir < 0 ? 1 : -1) : (sec.dir > 0 ? 1 : -1);
    const alongAt = (u: number) => mid + (u - 0.5) * len * sign;
    const place = (m: THREE.Mesh, depth: number, z: number) => {
      const c: V = sec.along === 'x' ? [mid, front(sec, depth), z] : [front(sec, depth), mid, z];
      m.position.copy(toThree(c));
      // Face the court.
      m.rotation.y = sec.along === 'x' ? (sec.dir < 0 ? 0 : Math.PI) : (sec.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      group.add(m);
    };
    // Suite level: a band of suites between the tiers, LED panels above.
    const bandH = BOWL.upperZ - BOWL.lowerTop;
    const t = suiteTexture(len, 17 + i, u => backdrop(sec, alongAt(u)));
    place(new THREE.Mesh(new THREE.PlaneGeometry(len, bandH * 0.78), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.3, color: 0x000000 })), lowerBack + 0.05, BOWL.lowerTop + bandH * 0.42);
    // The LED ribbon is broken into panels, and left dark behind the rim.
    const rib = ribbonTexture(['VELVET', 'MONEY BALL', 'HIT THE GREEN'][i], ['#F5C451', '#F472B6', '#7CF7D4'][i]);
    const panel = 6, gap = 3;
    rib.repeat.set(panel / 12, 1); ribbons.push(rib);
    const panels: THREE.BufferGeometry[] = [];
    for (let a = from + panel / 2; a + panel / 2 <= to; a += panel + gap) {
      if (backdrop(sec, a) > 0.5) continue;
      panels.push(new THREE.PlaneGeometry(panel, 0.45).translate((a - mid) * sign, 0, 0));
    }
    if (panels.length) place(new THREE.Mesh(mergeGeometries(panels), new THREE.MeshStandardMaterial({ map: rib, emissive: 0xffffff, emissiveMap: rib, emissiveIntensity: 0.55, color: 0x000000 })), lowerBack + BOWL.gap - 0.02, BOWL.upperZ - 0.3);
    // A fascia under the suites so the lower bowl's back edge isn't open.
    place(new THREE.Mesh(new THREE.PlaneGeometry(len, 0.6), fasciaMat), lowerBack + 0.04, BOWL.lowerTop + 0.1);
    // Back wall behind the upper deck, up to the roof.
    const wt = wallTex.clone(); wt.repeat.set(len / 10, 1); wt.needsUpdate = true;
    const wallH = BOWL.roofZ - upperTop + 2;
    place(new THREE.Mesh(new THREE.PlaneGeometry(len + 10, wallH), new THREE.MeshStandardMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.12, color: 0x161616 })), upperBack + 0.3, upperTop - 1 + wallH / 2);
  });

  // ---- Roof: a dark lid, a few heavy girders, and the lighting rigs.
  const roofSize = 90;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(roofSize, roofSize), new THREE.MeshStandardMaterial({ color: 0x08070d, roughness: 1 }));
  roof.rotation.x = Math.PI / 2; roof.position.copy(toThree([0, 6, BOWL.roofZ])); group.add(roof);
  // Every steel member (girders, rig chords and rungs, hangers) is one instanced box.
  const steel: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const bar = (a: V, b: V, w: number) => {
    const pa = toThree(a), pb = toThree(b), d = pb.clone().sub(pa);
    q.setFromUnitVectors(up, d.clone().normalize());
    steel.push(m4.compose(pa.add(pb).multiplyScalar(0.5), q, sc.set(w, d.length(), w)).clone());
  };
  // A box truss from a to b (along x or y), `deep` square, with rungs every metre.
  const truss = (a: V, b: V, deep: number, w: number) => {
    const alongX = a[1] === b[1], h = deep / 2;
    const off = (u: number, v: number): V => (alongX ? [0, u, v] : [u, 0, v]);
    const add = (p: V, o: V): V => [p[0] + o[0], p[1] + o[1], p[2] + o[2]];
    const corners = [off(-h, -h), off(h, -h), off(-h, h), off(h, h)];
    corners.forEach(o => bar(add(a, o), add(b, o), w));
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let k = 0; k <= Math.floor(len); k++) {
      const t = k / Math.floor(len), p: V = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2]];
      bar(add(p, corners[0]), add(p, corners[2]), w * 0.6); bar(add(p, corners[1]), add(p, corners[3]), w * 0.6);
    }
  };
  // Three girders spanning the building, high and dark: structure, not a grid.
  [-8, 6, 20].forEach(y => truss([-34, y, BOWL.roofZ - 1], [34, y, BOWL.roofZ - 1], 1.4, 0.12));
  // Lighting rigs: grouped clusters over the court, one per row of arena spots,
  // hung from the roof. The spots themselves (and so the court lighting) are unchanged.
  const fixtures: Array<{ at: V; aim: V }> = [];
  const rows = new Map<string, V[]>();
  opts.spots.forEach(p => { const k = `${p[1]}:${p[2]}`; rows.set(k, [...(rows.get(k) ?? []), p]); });
  rows.forEach(ps => {
    const [, y, z] = ps[0], xs = ps.map(p => p[0]);
    const x0 = Math.min(...xs) - 2.2, x1 = Math.max(...xs) + 2.2, rz = z + 0.55;
    truss([x0, y, rz], [x1, y, rz], 0.55, 0.05);
    [x0 + 0.4, x1 - 0.4].forEach(x => bar([x, y, rz + 0.3], [x, y, BOWL.roofZ - 1.7], 0.025));
    // A cluster of fixtures around each spot, all aimed where that spot aims.
    ps.forEach(([x]) => [-0.75, 0, 0.75].forEach(dx => fixtures.push({ at: [x + dx, y, z], aim: [x * 0.4 + dx, y * 0.7 + 1, 0] })));
  });
  const steelMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1a1920, metalness: 0.6, roughness: 0.55 }), steel.length);
  steel.forEach((mm, i) => steelMesh.setMatrixAt(i, mm));
  group.add(steelMesh);
  // Fixtures: a dark can with a glowing lens facing its target.
  const can = new THREE.CylinderGeometry(0.2, 0.26, 0.42, 12).translate(0, 0.21, 0);
  const lens = new THREE.CircleGeometry(0.19, 16).rotateX(Math.PI / 2).translate(0, -0.01, 0);
  const cans = new THREE.InstancedMesh(can, new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.5, roughness: 0.5 }), fixtures.length);
  const lenses = new THREE.InstancedMesh(lens, new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xfff1dd, emissiveIntensity: 1.8, side: THREE.DoubleSide }), fixtures.length);
  fixtures.forEach(({ at, aim }, i) => {
    const p = toThree(at), d = p.clone().sub(toThree(aim)).normalize();
    m4.compose(p, q.setFromUnitVectors(up, d), sc.set(1, 1, 1));
    cans.setMatrixAt(i, m4); lenses.setMatrixAt(i, m4);
  });
  group.add(cans, lenses);

  // ---- Banners in the rafters over the baseline end.
  const banners: Array<[string[], string, string]> = [
    [['2026', 'CHAMPIONS'], '#5C163A', '#F5C451'], [['30', 'SPLASH'], '#1F2937', '#F472B6'], [['40', 'PERFECT', 'RUN'], '#5C163A', '#F5C451'],
    [['3PT', 'RECORD'], '#1F2937', '#7CF7D4'], [['2025', 'CHAMPIONS'], '#5C163A', '#F5C451'], [['27', 'STARRY'], '#1F2937', '#A5B4FC'],
  ];
  banners.forEach(([lines, col, trim], i) => {
    const tx = bannerTexture(lines, col, trim);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), new THREE.MeshStandardMaterial({ map: tx, transparent: true, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.15, side: THREE.DoubleSide }));
    m.position.copy(toThree([-12.5 + i * 5, -15, BOWL.roofZ - 4.6]));
    group.add(m);
  });

  // ---- Light beams from the arena spots, and dust drifting through them.
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(0xfff1dd) }, strength: { value: opts.hi ? 0.035 : 0.03 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV; void main() { float edge = pow(abs(dot(vN, vV)), 1.6); float fade = smoothstep(0.0, 0.85, vY); gl_FragColor = vec4(color * strength * edge * fade, 1.0); }',
  });
  opts.spots.forEach(([x, y, z]) => {
    const top = toThree([x, y, z]), bottom = toThree([x * 0.4, y * 0.7 + 1, 0]);
    const h = top.distanceTo(bottom);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 2.6, h, 24, 1, true), beamMat);
    cone.position.copy(top).add(bottom).multiplyScalar(0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
    cone.renderOrder = 2;
    group.add(cone);
  });
  const N = opts.hi ? 600 : 300, dust = new Float32Array(N * 3), r = rng(5);
  for (let i = 0; i < N; i++) { const p = toThree([(r() - 0.5) * 22, -4 + r() * 18, 0.5 + r() * 11]); dust.set([p.x, p.y, p.z], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff4e0, size: 0.035, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  motes.frustumCulled = false;
  group.add(motes);

  return {
    ribbons,
    update(t: number) {
      // The dust drifts slowly; cheap enough to move the whole cloud.
      motes.position.set(Math.sin(t * 0.07) * 0.6, Math.sin(t * 0.11) * 0.3, Math.cos(t * 0.05) * 0.6);
      motes.rotation.y = t * 0.01;
    },
  };
}
