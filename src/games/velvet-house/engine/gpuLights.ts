export interface ScreenLight {
  sx: number;
  sy: number;
  px: number;
  py: number;
  r: number;
  s: number;
  col?: string;
}

export interface LightFrame {
  width: number;
  height: number;
  scale: number;
  dark: [number, number, number];
  alpha: number;
  glow: number;
  t: number;
  lights: ScreenLight[];
}

export interface GpuLights {
  /** Renders the darkness mask (mode 'dark') or additive glow (mode 'glow'); null if the GPU is unavailable. */
  render(frame: LightFrame, mode: 'dark' | 'glow'): HTMLCanvasElement | null;
}

export const MAX_LIGHTS = 32;
const DEFAULT_COL = '255,190,120';
const RES_SCALE = 0.5;

export function parseLightColor(col: string | undefined): [number, number, number] {
  const parts = (col || DEFAULT_COL).split(',').map((v) => Number(v.trim()));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return [1, 190 / 255, 120 / 255];
  return parts.map((v) => Math.max(0, Math.min(255, v)) / 255) as [number, number, number];
}

export function isFireColor(col: string | undefined): boolean {
  if (!col) return false;
  const [r, g, b] = parseLightColor(col);
  return r > 0.95 && g < 0.65 && b < 0.35;
}

export function packLights(lights: ScreenLight[]): { a: Float32Array; b: Float32Array; c: Float32Array; count: number } {
  const count = Math.min(lights.length, MAX_LIGHTS);
  const a = new Float32Array(MAX_LIGHTS * 4);
  const b = new Float32Array(MAX_LIGHTS * 4);
  const c = new Float32Array(MAX_LIGHTS * 3);
  for (let i = 0; i < count; i++) {
    const l = lights[i];
    a.set([l.sx, l.sy, Math.max(1, l.r), Math.max(0, Math.min(1, l.s))], i * 4);
    b.set([l.px, l.py, isFireColor(l.col) ? 1 : 0, i * 1.7], i * 4);
    c.set(parseLightColor(l.col), i * 3);
  }
  return { a, b, c, count };
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
#define MAXL ${MAX_LIGHTS}
uniform vec2 uView;
uniform vec2 uPx;
uniform int uMode;
uniform int uCount;
uniform vec3 uDark;
uniform float uAlpha;
uniform float uGlow;
uniform float uTime;
uniform vec4 uA[MAXL];
uniform vec4 uB[MAXL];
uniform vec3 uC[MAXL];
out vec4 outColor;

float fall(float d) { float x = clamp(1.0 - d, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, uPx.y - gl_FragCoord.y) / uPx * uView;
  float keep = 1.0;
  vec3 tint = vec3(0.0);
  vec3 glow = vec3(0.0);
  for (int i = 0; i < MAXL; i++) {
    if (i >= uCount) break;
    vec4 a = uA[i];
    vec4 b = uB[i];
    float s = a.w;
    if (b.z > 0.5) s *= 1.0 + 0.07 * sin(uTime * 9.0 + b.w) + 0.04 * sin(uTime * 13.7 + b.w * 2.0);
    float src = fall(length(p - a.xy) / (a.z * 0.5));
    vec2 q = (p - b.xy) * vec2(1.0, 1.0 / 0.52);
    float pool = fall(length(q) / a.z);
    float f = clamp(s * max(0.92 * src, 0.85 * pool), 0.0, 1.0);
    keep *= 1.0 - f;
    tint += uC[i] * f;
    float g = fall(length(p - a.xy) / (a.z * 0.55));
    glow += uC[i] * (0.3 * s * g * g);
  }
  if (uMode == 0) {
    float lit = 1.0 - keep;
    float alpha = uAlpha * keep;
    vec3 warm = mix(uDark, uDark * 0.55 + tint * 0.18, clamp(lit * 1.2, 0.0, 1.0));
    outColor = vec4(warm * alpha, alpha);
  } else {
    vec3 c = glow * uGlow;
    outColor = vec4(c, max(c.r, max(c.g, c.b)));
  }
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
  return sh;
}

export function createGpuLights(): GpuLights | null {
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
  const loc = gl.getAttribLocation(prog, 'aPos');
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (n: string) => gl!.getUniformLocation(prog, n);
  const U = {
    view: u('uView'), px: u('uPx'), mode: u('uMode'), count: u('uCount'), dark: u('uDark'),
    alpha: u('uAlpha'), glow: u('uGlow'), time: u('uTime'), a: u('uA'), b: u('uB'), c: u('uC'),
  };

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });

  return {
    render(frame, mode) {
      if (lost || !gl || gl.isContextLost()) return null;
      const pw = Math.max(1, Math.round(frame.width * frame.scale * RES_SCALE));
      const ph = Math.max(1, Math.round(frame.height * frame.scale * RES_SCALE));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      const packed = packLights(frame.lights);
      gl.viewport(0, 0, pw, ph);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindVertexArray(vao);
      gl.uniform2f(U.view, frame.width, frame.height);
      gl.uniform2f(U.px, pw, ph);
      gl.uniform1i(U.mode, mode === 'dark' ? 0 : 1);
      gl.uniform1i(U.count, packed.count);
      gl.uniform3f(U.dark, frame.dark[0] / 255, frame.dark[1] / 255, frame.dark[2] / 255);
      gl.uniform1f(U.alpha, frame.alpha);
      gl.uniform1f(U.glow, frame.glow);
      gl.uniform1f(U.time, frame.t);
      gl.uniform4fv(U.a, packed.a);
      gl.uniform4fv(U.b, packed.b);
      gl.uniform3fv(U.c, packed.c);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return canvas;
    },
  };
}
