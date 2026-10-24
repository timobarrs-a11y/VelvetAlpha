import * as THREE from 'three';
import { BOWL } from './crowd';
import { ribbonTexture } from './textures';

// The building around the court: a sky-dome gradient instead of a black
// void, the suite level with lit windows, back walls, the roof with its
// trusses and lights, banners in the rafters, light beams through the haze
// and dust drifting in them. Game coords (x across, y out, z up) via `toThree`.

type V = [number, number, number];

export interface Arena { ribbons: THREE.Texture[]; update(t: number, dt: number): void }

const rng = (seed: number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Suite windows: a band of glass boxes, warm light, the odd silhouette. */
function suiteTexture(): THREE.CanvasTexture {
  const r = rng(17);
  return canvasTex(1024, 128, g => {
    g.fillStyle = '#0b0a12'; g.fillRect(0, 0, 1024, 128);
    for (let x = 6; x < 1024; x += 64) {
      const lit = r() < 0.82, warm = r();
      const grad = g.createLinearGradient(0, 20, 0, 108);
      grad.addColorStop(0, lit ? (warm < 0.5 ? '#ffd9a0' : '#ffeedd') : '#26222f');
      grad.addColorStop(1, lit ? (warm < 0.5 ? '#c27a3a' : '#a08a7a') : '#15121c');
      g.fillStyle = grad; g.fillRect(x, 22, 52, 84);
      if (lit) for (let k = 0; k < 3; k++) if (r() < 0.6) { g.fillStyle = 'rgba(20,10,20,.75)'; const px = x + 6 + r() * 38; g.beginPath(); g.arc(px, 70, 6, 0, 7); g.fill(); g.fillRect(px - 8, 76, 16, 30); }
    }
    g.fillStyle = '#F5C451'; g.fillRect(0, 0, 1024, 6); g.fillRect(0, 122, 1024, 6);
  });
}

/** The back walls: dark acoustic panels with vertical light strips. */
function wallTexture(): THREE.CanvasTexture {
  return canvasTex(512, 256, g => {
    g.fillStyle = '#0d0b16'; g.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 32) { g.fillStyle = x % 64 ? '#121020' : '#100d1b'; g.fillRect(x, 0, 30, 256); }
    for (let x = 60; x < 512; x += 128) {
      const grad = g.createLinearGradient(x, 0, x + 6, 0);
      grad.addColorStop(0, 'rgba(244,114,182,0)'); grad.addColorStop(0.5, 'rgba(244,114,182,.9)'); grad.addColorStop(1, 'rgba(244,114,182,0)');
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

  // ---- Sky dome and haze: the far reaches fade into a purple haze, not black.
  scene.background = new THREE.Color(0x0a0612);
  scene.fog = new THREE.Fog(0x150d24, 24, 78);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x05040a) }, mid: { value: new THREE.Color(0x1d1130) }, low: { value: new THREE.Color(0x2a1638) } },
      vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP; void main() { float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.5, h)) : mix(mid, low, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }',
    }),
  );
  dome.renderOrder = -1;
  group.add(dome);

  const suiteMat = (() => { const t = suiteTexture(); t.wrapS = THREE.RepeatWrapping; return t; })();
  const wallTex = (() => { const t = wallTexture(); t.wrapS = THREE.RepeatWrapping; return t; })();
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x0c0a14, roughness: 0.8 });

  BOWL.sections.forEach((sec, i) => {
    const extra = 8, from = sec.from - extra, to = sec.to + extra, len = to - from, mid = (from + to) / 2;
    const place = (m: THREE.Mesh, depth: number, z: number) => {
      const c: V = sec.along === 'x' ? [mid, front(sec, depth), z] : [front(sec, depth), mid, z];
      m.position.copy(toThree(c));
      // Face the court.
      m.rotation.y = sec.along === 'x' ? (sec.dir < 0 ? 0 : Math.PI) : (sec.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      group.add(m);
    };
    // Suite level: a band of lit boxes between the tiers, an LED ribbon above.
    const bandH = BOWL.upperZ - BOWL.lowerTop;
    const t = suiteMat.clone(); t.repeat.set(len / 16, 1); t.needsUpdate = true;
    place(new THREE.Mesh(new THREE.PlaneGeometry(len, bandH * 0.78), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, color: 0x000000 })), lowerBack + 0.05, BOWL.lowerTop + bandH * 0.42);
    const rib = ribbonTexture(['VELVET', 'MONEY BALL', 'HIT THE GREEN'][i], ['#F5C451', '#F472B6', '#7CF7D4'][i]);
    rib.repeat.set(len / 12, 1); ribbons.push(rib);
    place(new THREE.Mesh(new THREE.PlaneGeometry(len, 0.45), new THREE.MeshStandardMaterial({ map: rib, emissive: 0xffffff, emissiveMap: rib, emissiveIntensity: 1.2, color: 0x000000 })), lowerBack + BOWL.gap - 0.02, BOWL.upperZ - 0.3);
    // A fascia under the suites so the lower bowl's back edge isn't open.
    place(new THREE.Mesh(new THREE.PlaneGeometry(len, 0.6), fasciaMat), lowerBack + 0.04, BOWL.lowerTop + 0.1);
    // Back wall behind the upper deck, up to the roof.
    const wt = wallTex.clone(); wt.repeat.set(len / 10, 1); wt.needsUpdate = true;
    const wallH = BOWL.roofZ - upperTop + 2;
    place(new THREE.Mesh(new THREE.PlaneGeometry(len + 10, wallH), new THREE.MeshStandardMaterial({ map: wt, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.35, color: 0x222222 })), upperBack + 0.3, upperTop - 1 + wallH / 2);
  });

  // ---- Roof: a dark lid, a truss grid and rows of small lights.
  const roofSize = 90;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(roofSize, roofSize), new THREE.MeshStandardMaterial({ color: 0x08070d, roughness: 1 }));
  roof.rotation.x = Math.PI / 2; roof.position.copy(toThree([0, 6, BOWL.roofZ])); group.add(roof);
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x24222e, metalness: 0.6, roughness: 0.5 });
  const beams: THREE.Matrix4[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let x = -30; x <= 30; x += 5) { m4.compose(toThree([x, 6, BOWL.roofZ - 1.2]), q.identity(), sc.set(0.3, 0.3, 60)); beams.push(m4.clone()); }
  for (let y = -24; y <= 36; y += 5) { m4.compose(toThree([0, y, BOWL.roofZ - 1.6]), q.identity(), sc.set(60, 0.3, 0.3)); beams.push(m4.clone()); }
  const truss = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trussMat, beams.length);
  beams.forEach((b, i) => truss.setMatrixAt(i, b));
  group.add(truss);
  const lights: number[] = [];
  for (let x = -27.5; x <= 27.5; x += 5) for (let y = -21.5; y <= 33.5; y += 5) { const p = toThree([x, y, BOWL.roofZ - 1.8]); lights.push(p.x, p.y, p.z); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
  group.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffe3b8, size: 0.5, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));

  // ---- Banners in the rafters over the baseline end.
  const banners: Array<[string[], string, string]> = [
    [['2026', 'CHAMPIONS'], '#5C163A', '#F5C451'], [['30', 'SPLASH'], '#1F2937', '#F472B6'], [['40', 'PERFECT', 'RUN'], '#5C163A', '#F5C451'],
    [['3PT', 'RECORD'], '#1F2937', '#7CF7D4'], [['2025', 'CHAMPIONS'], '#5C163A', '#F5C451'], [['27', 'STARRY'], '#1F2937', '#A5B4FC'],
  ];
  banners.forEach(([lines, col, trim], i) => {
    const tx = bannerTexture(lines, col, trim);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), new THREE.MeshStandardMaterial({ map: tx, transparent: true, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    m.position.copy(toThree([-12.5 + i * 5, -15, BOWL.roofZ - 4.6]));
    group.add(m);
  });

  // ---- Light beams from the arena spots, and dust drifting through them.
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { color: { value: new THREE.Color(0xfff1dd) }, strength: { value: opts.hi ? 0.075 : 0.06 } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV; void main() { float edge = pow(abs(dot(vN, vV)), 1.6); float fade = smoothstep(0.0, 0.85, vY); gl_FragColor = vec4(color * strength * edge * fade, 1.0); }',
  });
  opts.spots.forEach(([x, y, z]) => {
    const top = toThree([x, y, z]), bottom = toThree([x * 0.4, y * 0.7 + 1, 0]);
    const h = top.distanceTo(bottom);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 3.2, h, 24, 1, true), beamMat);
    cone.position.copy(top).add(bottom).multiplyScalar(0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bottom).normalize());
    cone.renderOrder = 2;
    group.add(cone);
  });
  const N = opts.hi ? 600 : 300, dust = new Float32Array(N * 3), r = rng(5);
  for (let i = 0; i < N; i++) { const p = toThree([(r() - 0.5) * 22, -4 + r() * 18, 0.5 + r() * 11]); dust.set([p.x, p.y, p.z], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff4e0, size: 0.035, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
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
