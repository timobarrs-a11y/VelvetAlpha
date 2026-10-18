import { parseLightColor, isFireColor } from './gpuLights';
import { ZMAX } from './gbuffer';

export type Rgb = [number, number, number];

export interface DeferredLight {
  /** View-space position (a, b, z) and reach in world units. */
  a: number; b: number; z: number; range: number;
  s: number;
  col?: string;
  /** Screen position and halo radius of the fixture, for bloom. */
  sx: number; sy: number; glow: number;
  vis: boolean;
}

export interface DeferredWindow { axis: 0 | 1; u0: number; u1: number; z0: number; z1: number }

export interface DeferredFrame {
  view: [number, number];
  origin: [number, number];
  iso: [number, number, number];
  darkA: number;
  night: Rgb;
  glow: number;
  sunDir: [number, number, number];
  sunCol: Rgb;
  sky: Rgb;
  daylight: number;
  rain: number;
  grade: Rgb;
  t: number;
  quality: 'high' | 'medium';
  lights: DeferredLight[];
  windows: DeferredWindow[];
  outdoor?: boolean;
}

export interface DeferredLights {
  /** 'mul' uploads the data canvas and returns a light map to multiply; 'add' returns glow/sheen to add. */
  render(frame: DeferredFrame, data: HTMLCanvasElement, mode: 'mul' | 'add'): HTMLCanvasElement | null;
}

export const MAX_DEFERRED_LIGHTS = 24;
export const MAX_WINDOWS = 6;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix3 = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const SEASON_SUN: Rgb[] = [[0.98, 1, 0.95], [1, 0.97, 0.88], [1, 0.9, 0.8], [0.92, 0.97, 1.08]];

/** Sun (or moon) direction toward the light in world space, and its color scaled by strength. */
export function sunLight(hour: number, season: number, rain: number, daylight: number): { dir: [number, number, number]; col: Rgb } {
  const day = daylight > 0.15;
  const h = day ? hour : (hour + 12) % 24;
  const th = clamp01((h - 6) / 13) * Math.PI;
  const x = -Math.cos(th) * 0.9, y = -0.85, z = Math.sin(th) * 0.95 + 0.12;
  const len = Math.hypot(x, y, z);
  const elev = Math.sin(th);
  let col: Rgb;
  if (day) {
    col = mix3([1, 0.68, 0.42], [1, 0.95, 0.86], Math.pow(elev, 0.6));
    const sc = SEASON_SUN[((season % 4) + 4) % 4];
    col = [col[0] * sc[0], col[1] * sc[1], col[2] * sc[2]];
    const k = 1.15 * daylight * (1 - 0.75 * rain);
    col = col.map(c => c * k) as Rgb;
    if (rain > 0) col = mix3(col, [col[1], col[1], col[1] * 1.05], 0.5 * rain);
  } else {
    col = ([0.38, 0.48, 0.75] as Rgb).map(c => c * 0.5 * (1 - daylight) * (1 - 0.8 * rain)) as Rgb;
  }
  return { dir: [x / len, y / len, z / len], col };
}

const GRADE_KEYS: [number, Rgb][] = [
  [0, [0.88, 0.92, 1]], [5.5, [0.9, 0.92, 1]], [7, [1, 0.93, 0.82]], [9.5, [1, 0.99, 0.96]],
  [15.5, [1, 0.99, 0.96]], [18, [1, 0.88, 0.78]], [20, [0.94, 0.9, 0.98]], [21.5, [0.88, 0.92, 1]], [24, [0.88, 0.92, 1]],
];
const SEASON_GRADE: Rgb[] = [[0.98, 1, 0.97], [1, 0.98, 0.93], [1, 0.95, 0.9], [0.97, 0.99, 1]];

/** Color tint by time of day and season, normalized so the brightest channel is 1 (it is multiplied in). */
export function gradeTint(hour: number, season: number): Rgb {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < GRADE_KEYS.length - 2 && GRADE_KEYS[i + 1][0] <= h) i++;
  const [h0, c0] = GRADE_KEYS[i], [h1, c1] = GRADE_KEYS[i + 1];
  const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
  const s = SEASON_GRADE[((season % 4) + 4) % 4];
  const c = mix3(c0, c1, t * t * (3 - 2 * t)).map((v, k) => v * s[k]) as Rgb;
  const m = Math.max(...c);
  return c.map(v => v / m) as Rgb;
}

/** Strongest lights first so the shadowed subset is the one that matters. */
export function packDeferredLights(lights: DeferredLight[]) {
  const sorted = [...lights].sort((p, q) => q.s * q.range - p.s * p.range).slice(0, MAX_DEFERRED_LIGHTS);
  const pos = new Float32Array(MAX_DEFERRED_LIGHTS * 4);
  const col = new Float32Array(MAX_DEFERRED_LIGHTS * 4);
  const scr = new Float32Array(MAX_DEFERRED_LIGHTS * 4);
  sorted.forEach((l, i) => {
    const s = clamp01(l.s), c = parseLightColor(l.col);
    pos.set([l.a, l.b, l.z, Math.max(0.1, l.range)], i * 4);
    col.set([c[0] * s, c[1] * s, c[2] * s, isFireColor(l.col) ? 1 : 0], i * 4);
    scr.set([l.sx, l.sy, Math.max(1, l.glow), l.vis ? 1 : 0], i * 4);
  });
  return { pos, col, scr, count: sorted.length };
}

export function packWindows(windows: DeferredWindow[]) {
  const n = Math.min(windows.length, MAX_WINDOWS);
  const w = new Float32Array(MAX_WINDOWS * 4), z = new Float32Array(MAX_WINDOWS * 2);
  for (let i = 0; i < n; i++) {
    const it = windows[i];
    w.set([it.axis, Math.min(it.u0, it.u1), Math.max(it.u0, it.u1), 0], i * 4);
    z.set([it.z0, it.z1], i * 2);
  }
  return { w, z, count: n };
}

const QUALITY = {
  high: { shadowed: 6, steps: 8, ao: 8 },
  medium: { shadowed: 3, steps: 5, ao: 4 },
} as const;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
#define MAXL ${MAX_DEFERRED_LIGHTS}
#define MAXW ${MAX_WINDOWS}
uniform sampler2D uData;
uniform vec2 uView, uPx, uOrigin;
uniform vec3 uIso;
uniform int uMode, uCount, uShadowed, uSteps, uAoSteps, uWinCount, uOut;
uniform float uDarkA, uRain, uTime, uDay, uGlow, uZMax;
uniform vec3 uNight, uGrade, uSunDir, uSunCol, uSky;
uniform vec4 uLP[MAXL];
uniform vec4 uLC[MAXL];
uniform vec4 uLS[MAXL];
uniform vec4 uWin[MAXW];
uniform vec2 uWinZ[MAXW];
out vec4 outColor;

const vec3 VIEW = vec3(1.0, 1.0, 0.941);

vec2 toScreen(vec3 q) { return vec2(uOrigin.x + (q.x - q.y) * uIso.x, uOrigin.y + (q.x + q.y) * uIso.y - q.z * uIso.z); }
vec3 fromScreen(vec2 s, float z) { float u = (s.x - uOrigin.x) / uIso.x; float v = (s.y - uOrigin.y + z * uIso.z) / uIso.y; return vec3((u + v) * 0.5, (v - u) * 0.5, z); }
vec4 dataAt(vec2 s) { return texture(uData, s / uView); }
bool onScreen(vec2 s) { return s.x >= 0.0 && s.y >= 0.0 && s.x <= uView.x && s.y <= uView.y; }
vec3 normalOf(float g) { if (g < 0.17) return vec3(0, 0, 1); if (g < 0.5) return vec3(0, 1, 0); if (g < 0.83) return vec3(1, 0, 0); return normalize(VIEW); }
int matOf(float b) { return int(floor(b * 255.0 / 50.0 + 0.5)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fall(float d) { float x = clamp(1.0 - d, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
float flicker(int i) { return uLC[i].w > 0.5 ? 1.0 + 0.07 * sin(uTime * 9.0 + float(i) * 1.7) + 0.04 * sin(uTime * 13.7 + float(i) * 3.4) : 1.0; }

float shadow(vec3 P, vec3 dir, float len, float jit) {
  float vis = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uSteps) break;
    vec3 S = P + dir * (len * (float(i) + jit) / float(uSteps));
    vec2 s = toScreen(S);
    if (!onScreen(s)) continue;
    vec4 d = dataAt(s);
    if (d.a < 0.5) continue;
    float dz = d.r * uZMax - S.z;
    vis *= 1.0 - 0.78 * smoothstep(0.04, 0.22, dz) * (1.0 - smoothstep(0.9, 1.4, dz));
  }
  return vis;
}

float winMask(vec3 P, vec3 L, out float tHit) {
  tHit = 0.0;
  float m = 0.0;
  for (int i = 0; i < MAXW; i++) {
    if (i >= uWinCount) break;
    vec4 w = uWin[i];
    float pc = w.x < 0.5 ? P.x : P.y;
    float lc = w.x < 0.5 ? L.x : L.y;
    if (lc > -1e-3 || pc <= 0.0) continue;
    float t = -pc / lc;
    vec3 H = P + L * t;
    float u = w.x < 0.5 ? H.y : H.x;
    float e = 0.05;
    float k = smoothstep(w.y - e, w.y + e, u) * (1.0 - smoothstep(w.z - e, w.z + e, u))
            * smoothstep(uWinZ[i].x - e, uWinZ[i].x + e, H.z) * (1.0 - smoothstep(uWinZ[i].y - e, uWinZ[i].y + e, H.z));
    if (k > m) { m = k; tHit = t; }
  }
  return m;
}

float ambientOcclusion(vec3 P, vec3 N, int m, vec2 s, float jit) {
  if (m == 4 || m == 3) return 1.0;
  float a = 1.0;
  if (N.z > 0.5) a *= mix(0.6, 1.0, smoothstep(0.0, 0.7, P.x)) * mix(0.6, 1.0, smoothstep(0.0, 0.7, P.y));
  else {
    a *= mix(0.68, 1.0, smoothstep(0.0, 0.45, P.z));
    if (N.x > 0.5) a *= mix(0.72, 1.0, smoothstep(0.0, 0.5, P.y));
    if (N.y > 0.5) a *= mix(0.72, 1.0, smoothstep(0.0, 0.5, P.x));
  }
  float occ = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uAoSteps) break;
    float ang = (float(i) + jit) / float(uAoSteps) * 6.2831853;
    vec2 q = s + vec2(cos(ang), sin(ang)) * (i % 2 == 0 ? 5.0 : 10.0);
    if (!onScreen(q)) continue;
    vec4 d = dataAt(q);
    if (d.a < 0.5) continue;
    vec3 D = fromScreen(q, d.r * uZMax) - P;
    float dist = length(D);
    if (dist < 0.02 || dist > 0.8) continue;
    occ += max(0.0, dot(N, D / dist) - 0.2) * (1.0 - dist / 0.8);
  }
  return a * (1.0 - 0.55 * clamp(occ / float(max(uAoSteps, 1)) * 2.0, 0.0, 1.0));
}

float sunAt(vec3 P, vec3 N, int m, float jit) {
  float tHit = 3.0;
  float wm = uOut == 1 ? 1.0 : winMask(P, uSunDir, tHit);
  if (wm < 0.01) return 0.0;
  float ndl = m == 4 ? 0.6 : max(dot(N, uSunDir), 0.0);
  if (ndl <= 0.0) return 0.0;
  return wm * ndl * shadow(P, uSunDir, max(0.0, tHit - 0.05), jit);
}

void main() {
  vec2 s = vec2(gl_FragCoord.x, uPx.y - gl_FragCoord.y) / uPx * uView;
  vec4 d = dataAt(s);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  bool surf = d.a >= 0.5;
  float z = d.r * uZMax;
  vec3 P = fromScreen(s, z);
  vec3 N = normalOf(d.g);
  int m = matOf(d.b);
  vec3 Pn = P + N * 0.03;

  if (uMode == 0) {
    vec3 base = mix(vec3(1.0), uNight, uDarkA);
    if (!surf) { outColor = vec4(base * uGrade, 1.0); return; }
    if (m == 3) { outColor = vec4(1.0); return; }
    // outdoors the sky only fills shade; direct sun supplies the rest so cast shadows read
    if (uOut == 1) base *= mix(1.0, 0.68, uDay * (1.0 - uRain * 0.6));
    vec3 light = base * ambientOcclusion(P, N, m, s, jit);
    for (int i = 0; i < MAXL; i++) {
      if (i >= uCount) break;
      vec3 Lv = uLP[i].xyz - Pn;
      float dist = length(Lv);
      float rng = uLP[i].w;
      if (dist >= rng) continue;
      vec3 L = Lv / dist;
      float ndl = m == 4 ? 0.55 + 0.45 * dot(N, L) : max(dot(N, L) * 0.85 + 0.15, 0.0);
      float att = 1.0 - dist / rng;
      att *= att;
      float sh = i < uShadowed ? shadow(Pn, L, max(0.0, dist - 0.12), jit) : 1.0;
      light += uLC[i].rgb * flicker(i) * att * ndl * sh * 1.25;
    }
    light += uSunCol * sunAt(Pn, N, m, jit) * (uOut == 1 ? 1.8 : 1.0);
    if (m == 2) light = mix(light, vec3(1.0), uDay * 0.85);
    outColor = vec4(clamp(light, 0.0, 1.0) * uGrade, 1.0);
    return;
  }

  vec3 add = vec3(0.0);
  if (surf && m != 3) {
    float sun = sunAt(Pn, N, m, jit);
    add += uSunCol * sun * 0.22;
    vec3 V = normalize(VIEW);
    if (m == 1) {
      for (int i = 0; i < MAXL; i++) {
        if (i >= uCount) break;
        vec3 Lv = uLP[i].xyz - Pn;
        float dist = length(Lv);
        if (dist >= uLP[i].w) continue;
        float att = 1.0 - dist / uLP[i].w;
        add += uLC[i].rgb * pow(max(dot(N, normalize(Lv / dist + V)), 0.0), 28.0) * att * att * 0.4;
      }
      add += uSunCol * sun * pow(max(dot(N, normalize(uSunDir + V)), 0.0), 18.0) * 0.3;
    }
    if (m == 2) {
      add += uSky * uDay * 0.12;
      float col = floor(s.x / 1.6);
      float sp = hash(vec2(col, 3.0));
      float y = fract(s.y / 26.0 - uTime * (0.5 + sp * 0.9) + sp * 7.0);
      float streak = smoothstep(0.82, 1.0, y) * step(0.5, sp);
      vec2 cell = floor(s / 3.0);
      float drop = step(0.9, hash(cell + floor(uTime * 0.7 + hash(cell) * 3.0)));
      add += vec3(0.75, 0.82, 0.95) * (streak * 0.4 + drop * 0.25) * uRain;
    }
  }
  if (surf && uWinCount > 0 && dot(uSunCol, vec3(1.0)) > 0.02) {
    float tWin;
    float wm = winMask(P, uSunDir, tWin);
    if (wm > 0.0) {
      // the beam runs from the window along the light direction; it fades with distance traveled
      float deep = clamp(1.0 - tWin * 0.16, 0.3, 1.0);
      float sh = shadow(Pn, uSunDir, max(0.0, tWin - 0.05), jit);
      add += uSunCol * wm * deep * sh * 0.12;
      vec2 drift = vec2(sin(uTime * 0.4) * 3.0, uTime * 3.5);
      vec2 cell = floor((s + drift) / 6.0);
      float hm = hash(cell);
      vec2 f = fract((s + drift) / 6.0) - 0.5 - (vec2(hash(cell + 1.3), hash(cell + 2.7)) - 0.5) * 0.6;
      float mote = step(0.9, hm) * smoothstep(0.22, 0.0, length(f)) * (0.55 + 0.45 * sin(uTime * 2.0 + hm * 40.0));
      add += uSunCol * mote * wm * deep * sh * 1.2;
    }
  }
  for (int i = 0; i < MAXL; i++) {
    if (i >= uCount) break;
    if (uLS[i].w < 0.5) continue;
    vec2 ls = uLS[i].xy;
    if (onScreen(ls)) { vec4 ld = dataAt(ls); if (ld.a > 0.5 && ld.r * uZMax > uLP[i].z + 0.3) continue; }
    float g = fall(length(s - ls) / (uLS[i].z * 0.5));
    add += uLC[i].rgb * flicker(i) * 0.3 * g * g * uGlow;
  }
  add = clamp(add, 0.0, 1.0);
  outColor = vec4(add, max(add.r, max(add.g, add.b)));
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
  return sh;
}

export function createDeferredLights(): DeferredLights | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
  } catch { gl = null; }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const names = ['uData', 'uView', 'uPx', 'uOrigin', 'uIso', 'uMode', 'uCount', 'uShadowed', 'uSteps', 'uAoSteps',
    'uWinCount', 'uOut', 'uDarkA', 'uRain', 'uTime', 'uDay', 'uGlow', 'uZMax', 'uNight', 'uGrade', 'uSunDir', 'uSunCol', 'uSky',
    'uLP', 'uLC', 'uLS', 'uWin', 'uWinZ'] as const;
  const U = Object.fromEntries(names.map(n => [n, gl!.getUniformLocation(prog, n)])) as Record<(typeof names)[number], WebGLUniformLocation | null>;

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });

  return {
    render(frame, data, mode) {
      if (lost || !gl || gl.isContextLost() || data.width < 1 || data.height < 1) return null;
      const pw = data.width, ph = data.height;
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (mode === 'mul') {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
      }
      const q = QUALITY[frame.quality];
      const L = packDeferredLights(frame.lights), Wn = packWindows(frame.windows);
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1i(U.uData, 0);
      gl.uniform2f(U.uView, frame.view[0], frame.view[1]);
      gl.uniform2f(U.uPx, pw, ph);
      gl.uniform2f(U.uOrigin, frame.origin[0], frame.origin[1]);
      gl.uniform3fv(U.uIso, frame.iso);
      gl.uniform1i(U.uMode, mode === 'mul' ? 0 : 1);
      gl.uniform1i(U.uCount, L.count);
      gl.uniform1i(U.uShadowed, q.shadowed);
      gl.uniform1i(U.uSteps, q.steps);
      gl.uniform1i(U.uAoSteps, q.ao);
      gl.uniform1i(U.uWinCount, Wn.count);
      gl.uniform1i(U.uOut, frame.outdoor ? 1 : 0);
      gl.uniform1f(U.uDarkA, frame.darkA);
      gl.uniform1f(U.uRain, frame.rain);
      gl.uniform1f(U.uTime, frame.t);
      gl.uniform1f(U.uDay, frame.daylight);
      gl.uniform1f(U.uGlow, frame.glow);
      gl.uniform1f(U.uZMax, ZMAX);
      gl.uniform3fv(U.uNight, frame.night);
      gl.uniform3fv(U.uGrade, frame.grade);
      gl.uniform3fv(U.uSunDir, frame.sunDir);
      gl.uniform3fv(U.uSunCol, frame.sunCol);
      gl.uniform3fv(U.uSky, frame.sky);
      gl.uniform4fv(U.uLP, L.pos);
      gl.uniform4fv(U.uLC, L.col);
      gl.uniform4fv(U.uLS, L.scr);
      gl.uniform4fv(U.uWin, Wn.w);
      gl.uniform2fv(U.uWinZ, Wn.z);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return canvas;
    },
  };
}
