import { HairTexture, HairStyle } from '../types/avatar-v2';

export interface HairRenderParams {
  hairColor: string;
  hairColorDark: string;
  hairColorLight: string;
  hairColorMid: string;
  hairStyle: HairStyle;
  hairTexture: HairTexture;
  fRx: number;
  fRy: number;
  faceTop: number;
  faceBottom: number;
  faceCenterY: number;
}

export function renderMaleHair(p: HairRenderParams): React.ReactNode {
  const { hairColor, hairColorDark, hairColorLight, hairColorMid, hairStyle, hairTexture, fRx, faceTop, faceCenterY, faceBottom } = p;

  switch (hairStyle) {
    case 'buzz':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 6} rx={fRx + 1} ry="10" fill={hairColor} />
          <ellipse cx="50" cy={faceTop + 2} rx={fRx - 4} ry="8" fill={hairColor} />
          {Array.from({ length: 320 }, (_, i) => {
            const col = i % 40;
            const row = Math.floor(i / 40);
            const angle = (col / 40) * Math.PI;
            const rx = fRx - 2 + row * 0.6;
            const ry = 8 + row * 0.3;
            const x = 50 + Math.cos(angle) * rx + (((i * 7919) % 7) - 3) * 0.2;
            const y = faceTop + 4 + Math.sin(angle) * ry * 0.6 + (((i * 6271) % 5) - 2) * 0.3;
            if (y < faceTop - 2 || y > faceTop + 14) return null;
            return (
              <line key={i}
                x1={x} y1={y} x2={x + (((i * 3571) % 5) - 2) * 0.3} y2={y - 1.2 - (i % 3) * 0.2}
                stroke={i % 5 === 0 ? hairColorLight : hairColorDark}
                strokeWidth={0.6} opacity={0.55 + (i % 4) * 0.08} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx + 1} cy={faceCenterY - 4} rx="5" ry="10" fill={hairColor} opacity="0.85" />
          <ellipse cx={50 + fRx - 1} cy={faceCenterY - 4} rx="5" ry="10" fill={hairColor} opacity="0.85" />
        </g>
      );

    case 'short':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="16" fill={hairColor} />
          <ellipse cx="50" cy={faceTop + 2} rx={fRx - 2} ry="12" fill={hairColorDark} opacity="0.4" />
          {Array.from({ length: 48 }, (_, i) => {
            const t = (i / 48) * Math.PI;
            const bx = 50 + Math.cos(t) * (fRx + 1);
            const by = faceTop + 8 + Math.sin(t) * 12;
            const len = 5 + Math.sin(i * 1.3) * 2;
            const angle = -Math.PI * 0.5 + (i / 48) * Math.PI * 0.6 - 0.3;
            return (
              <path key={i}
                d={`M${bx},${by} Q${bx + Math.cos(angle) * len * 0.5 + Math.sin(i) * 1.5},${by + Math.sin(angle) * len * 0.5} ${bx + Math.cos(angle) * len},${by + Math.sin(angle) * len}`}
                stroke={i % 7 === 0 ? hairColorLight : hairColor}
                strokeWidth={1.4} fill="none" opacity={0.8} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx + 1} cy={faceCenterY - 2} rx="5" ry="12" fill={hairColorDark} opacity="0.75" />
          <ellipse cx={50 + fRx - 1} cy={faceCenterY - 2} rx="5" ry="12" fill={hairColorDark} opacity="0.75" />
        </g>
      );

    case 'wavy': {
      const waveAmp = hairTexture === 'coily' ? 5.5 : hairTexture === 'wavy' ? 3.5 : 2;
      const wavePaths = Array.from({ length: 14 }, (_, i) => {
        const x0 = 22 + i * 4;
        const phase = (i % 3) * 1.1;
        const amp = waveAmp + (i % 2) * 1.5;
        const segments = [];
        for (let s = 0; s < 3; s++) {
          const y0 = faceTop + 4 + s * 12;
          const y1 = y0 + 6;
          const y2 = y0 + 12;
          const cx1 = x0 + Math.sin(phase + s) * amp;
          const cx2 = x0 - Math.sin(phase + s + 1) * amp;
          segments.push(`Q${cx1},${y1} ${x0},${y2} Q${cx2},${y2 + 6} ${x0},${y2 + 12}`);
        }
        return (
          <path key={i}
            d={`M${x0},${faceTop + 4} ${segments.join(' ')}`}
            stroke={i % 5 === 0 ? hairColorLight : hairColor}
            strokeWidth={2.5 + (i % 3) * 0.5} fill="none" opacity={0.85} strokeLinecap="round" />
        );
      });
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {wavePaths}
          <ellipse cx={50 - fRx + 1} cy={faceCenterY} rx="6" ry="14" fill={hairColorDark} opacity="0.7" />
          <ellipse cx={50 + fRx - 1} cy={faceCenterY} rx="6" ry="14" fill={hairColorDark} opacity="0.7" />
        </g>
      );
    }

    case 'sleek':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          <path d={`M${50 - fRx + 2},${faceTop + 8} Q${50 - fRx - 2},${faceTop + 20} ${50 - fRx},${faceTop + 35} L${50 - fRx + 4},${faceTop + 35} Q${50 - fRx + 2},${faceTop + 20} ${50 - fRx + 5},${faceTop + 8} Z`} fill={hairColor} />
          <path d={`M${50 + fRx - 2},${faceTop + 8} Q${50 + fRx + 2},${faceTop + 20} ${50 + fRx},${faceTop + 35} L${50 + fRx - 4},${faceTop + 35} Q${50 + fRx - 2},${faceTop + 20} ${50 + fRx - 5},${faceTop + 8} Z`} fill={hairColor} />
          {Array.from({ length: 18 }, (_, i) => {
            const x = 22 + i * 3.4;
            return (
              <path key={i}
                d={`M${x},${faceTop + 4} L${x - 1},${faceTop + 22}`}
                stroke={i % 4 === 0 ? hairColorLight : hairColorMid}
                strokeWidth={1.8} opacity={0.35} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx + 1} cy={faceCenterY - 4} rx="5.5" ry="13" fill={hairColor} opacity="0.9" />
          <ellipse cx={50 + fRx - 1} cy={faceCenterY - 4} rx="5.5" ry="13" fill={hairColor} opacity="0.9" />
        </g>
      );

    case 'afro':
      return (
        <g>
          <ellipse cx="50" cy={faceCenterY - 18} rx={fRx + 14} ry={fRy - 2} fill={hairColor} opacity="0.9" />
          {Array.from({ length: 260 }, (_, i) => {
            const angle = (i / 260) * Math.PI * 2;
            const layer = Math.floor(i / 52);
            const r = 10 + layer * 4.5;
            const x = 50 + Math.cos(angle) * r * 1.4 + (((i * 4373) % 7) - 3) * 0.9;
            const y = faceCenterY - 18 + Math.sin(angle) * r + (((i * 6113) % 5) - 2) * 0.8;
            const dist = Math.sqrt(Math.pow((x - 50) / 1.4, 2) + Math.pow(y - (faceCenterY - 18), 2));
            if (dist > fRy + 2) return null;
            return (
              <circle key={i} cx={x} cy={y} r={1.5 + (i % 3) * 0.4}
                fill={i % 9 === 0 ? hairColorLight : hairColor}
                opacity={0.6 + (i % 4) * 0.08} />
            );
          })}
        </g>
      );

    case 'locs':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {Array.from({ length: 9 }, (_, i) => {
            const x = 22 + i * 6.5;
            const curveMod = (i - 4) * 3;
            const len = 70;
            return (
              <g key={i}>
                <path d={`M${x},${faceTop + 10} Q${x + curveMod * 0.5},${faceTop + 10 + len * 0.4} ${x + curveMod * 0.7},${faceTop + 10 + len * 0.7} Q${x + curveMod},${faceTop + 10 + len} ${x + curveMod * 0.8},${faceTop + 10 + len * 1.3}`}
                  stroke={hairColor} strokeWidth={6.5} fill="none" strokeLinecap="round" opacity="0.95" />
                {Array.from({ length: 9 }, (_, j) => {
                  const t = j / 9;
                  const sx = x + curveMod * t * 0.7;
                  const sy = faceTop + 10 + len * t;
                  return (
                    <ellipse key={j} cx={sx} cy={sy} rx="2.8" ry="1.2"
                      fill={hairColorDark} opacity="0.5"
                      transform={`rotate(${(curveMod > 0 ? 1 : -1) * 15 * t}, ${sx}, ${sy})`} />
                  );
                })}
              </g>
            );
          })}
        </g>
      );

    case 'fade':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 10} rx={fRx - 4} ry="16" fill={hairColor} />
          {Array.from({ length: 8 }, (_, i) => {
            const opacity = 0.15 + (i / 8) * 0.75;
            const ry = 4 + i * 1.8;
            const rx2 = fRx - 4 - i * 0.5;
            return (
              <ellipse key={i} cx="50" cy={faceBottom - 2 - i * 3}
                rx={rx2} ry={ry}
                fill={hairColor} opacity={opacity} />
            );
          })}
          {Array.from({ length: 36 }, (_, i) => {
            const t = (i / 36) * Math.PI;
            const bx = 50 + Math.cos(t) * (fRx - 5);
            const by = faceTop + 10 + Math.sin(t) * 10;
            const len = 4 + Math.sin(i * 1.7) * 1.5;
            return (
              <path key={`top-${i}`}
                d={`M${bx},${by} Q${bx + Math.sin(i) * 1.2},${by - len * 0.5} ${bx + Math.sin(i + 1) * 0.8},${by - len}`}
                stroke={i % 6 === 0 ? hairColorLight : hairColor}
                strokeWidth={1.3} fill="none" opacity={0.85} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx + 3} cy={faceCenterY + 2} rx="4" ry="10" fill={hairColor} opacity="0.45" />
          <ellipse cx={50 + fRx - 3} cy={faceCenterY + 2} rx="4" ry="10" fill={hairColor} opacity="0.45" />
        </g>
      );

    default: return null;
  }
}

export function renderFemaleHair(p: HairRenderParams): React.ReactNode {
  const { hairColor, hairColorDark, hairColorLight, hairColorMid, hairStyle, hairTexture, fRx, faceTop, faceCenterY, faceBottom } = p;

  const textureAmp = hairTexture === 'coily' ? 6 : hairTexture === 'wavy' ? 4 : 1.5;

  switch (hairStyle) {
    case 'sleek':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {Array.from({ length: 22 }, (_, i) => {
            const x = 18 + i * 3;
            const side = x < 50 ? -1 : 1;
            const fallY = faceBottom + 20 + Math.abs(x - 50) * 0.4;
            const wobble = hairTexture === 'coily' ? Math.sin(i * 0.8) * 4 : hairTexture === 'wavy' ? Math.sin(i * 0.5) * 2 : 0;
            return (
              <path key={i}
                d={`M${x},${faceTop + 8} C${x + side * 0.5 + wobble},${faceCenterY} ${x + side * 1.5 + wobble},${faceBottom} ${x + side * 2 + wobble * 0.5},${fallY}`}
                stroke={i % 5 === 0 ? hairColorLight : hairColor}
                strokeWidth={2.8} fill="none" opacity={0.88} strokeLinecap="round" />
            );
          })}
          {Array.from({ length: 8 }, (_, i) => {
            const x = 20 + i * 3.5;
            return (
              <path key={`shine-${i}`}
                d={`M${x},${faceTop + 6} L${x - 0.5},${faceTop + 22}`}
                stroke={hairColorLight} strokeWidth={1} opacity={0.2} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx - 2} cy={faceCenterY + 4} rx="7.5" ry="20" fill={hairColor} opacity="0.92" />
          <ellipse cx={50 + fRx + 2} cy={faceCenterY + 4} rx="7.5" ry="20" fill={hairColor} opacity="0.92" />
        </g>
      );

    case 'wavy': {
      const amp = textureAmp + (hairTexture === 'coily' ? 2 : 0);
      const strandPaths = Array.from({ length: 16 }, (_, i) => {
        const x0 = 16 + i * 4.5;
        const side = x0 < 50 ? -1 : 1;
        const phase = i * 0.8;
        const yStart = faceTop + 6;
        const segments: string[] = [];
        for (let s = 0; s < 5; s++) {
          const y = yStart + s * 16;
          const yn = y + 8;
          const yn2 = y + 16;
          const cx1 = x0 + Math.sin(phase + s * 1.4) * amp * side;
          const cx2 = x0 - Math.sin(phase + s * 1.4 + 0.7) * amp * side;
          segments.push(`Q${cx1},${yn} ${x0},${yn2}`);
          if (s < 4) segments.push(`Q${cx2},${yn2 + 8} ${x0},${yn2 + 16}`);
        }
        return (
          <path key={i}
            d={`M${x0},${yStart} ${segments.join(' ')}`}
            stroke={i % 4 === 0 ? hairColorLight : hairColor}
            strokeWidth={3 + (i % 3) * 0.5} fill="none" opacity={0.87} strokeLinecap="round" />
        );
      });
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {strandPaths}
          <ellipse cx={50 - fRx - 2} cy={faceCenterY + 8} rx="8" ry="22" fill={hairColorDark} opacity="0.65" />
          <ellipse cx={50 + fRx + 2} cy={faceCenterY + 8} rx="8" ry="22" fill={hairColorDark} opacity="0.65" />
        </g>
      );
    }

    case 'curly':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 2} ry="16" fill={hairColor} />
          <path d={`M${50 - fRx - 2},${faceTop + 12} Q${50 - fRx - 6},${faceCenterY} ${50 - fRx - 2},${faceBottom + 16} L${50 - fRx + 4},${faceBottom + 18} Q${50 - fRx + 2},${faceCenterY + 2} ${50 - fRx + 6},${faceTop + 14} Z`} fill={hairColor} opacity="0.88" />
          <path d={`M${50 + fRx + 2},${faceTop + 12} Q${50 + fRx + 6},${faceCenterY} ${50 + fRx + 2},${faceBottom + 16} L${50 + fRx - 4},${faceBottom + 18} Q${50 + fRx - 2},${faceCenterY + 2} ${50 + fRx - 6},${faceTop + 14} Z`} fill={hairColor} opacity="0.88" />
          {Array.from({ length: 90 }, (_, i) => {
            const col = i % 10;
            const row = Math.floor(i / 10);
            const x = 20 + col * 6.5 + (((i * 3137) % 7) - 3) * 0.8;
            const y = faceTop + 6 + row * 8 + (((i * 5987) % 5) - 2) * 0.7;
            const r = 2.2 + (i % 4) * 0.5;
            if (x < 16 || x > 84 || y > faceBottom + 18 || y < faceTop) return null;
            return (
              <circle key={i} cx={x} cy={y} r={r}
                fill="none" stroke={i % 6 === 0 ? hairColorLight : hairColorDark}
                strokeWidth={1.1} opacity={0.65} />
            );
          })}
        </g>
      );

    case 'braids':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {Array.from({ length: 10 }, (_, i) => {
            const x = 18 + i * 6.5;
            const curveMod = (i - 4.5) * 3;
            const yEnd = faceBottom + 60;
            return (
              <g key={i}>
                <path d={`M${x},${faceTop + 10} Q${x + curveMod * 0.5},${faceCenterY + 20} ${x + curveMod * 0.8},${faceBottom + 30} Q${x + curveMod * 1.1},${yEnd - 5} ${x + curveMod * 0.7},${yEnd}`}
                  stroke={hairColor} strokeWidth={7} fill="none" strokeLinecap="round" opacity="0.95" />
                {Array.from({ length: 12 }, (_, j) => {
                  const t = j / 12;
                  const bx = x + curveMod * t * 0.8;
                  const by = faceTop + 10 + (faceBottom + 30 - faceTop - 10) * t;
                  const offset = j % 2 === 0 ? -3.2 : 3.2;
                  return (
                    <g key={j}>
                      <path d={`M${bx + offset},${by} Q${bx},${by + 2.5} ${bx - offset},${by + 5}`}
                        stroke={hairColorDark} strokeWidth={2.2} fill="none" opacity={0.85} strokeLinecap="round" />
                      <path d={`M${bx + offset * 0.6},${by + 1} L${bx - offset * 0.6},${by + 4}`}
                        stroke={hairColorLight} strokeWidth={0.8} opacity={0.6} strokeLinecap="round" />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      );

    case 'ponytail':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 10} rx={fRx + 1} ry="16" fill={hairColor} />
          <path d={`M${50 - fRx + 2},${faceTop + 12} Q${50 - fRx - 2},${faceCenterY + 4} ${50 - fRx},${faceBottom + 4} L${50 - fRx + 5},${faceBottom + 6} Q${50 - fRx + 3},${faceCenterY + 6} ${50 - fRx + 6},${faceTop + 14} Z`} fill={hairColorDark} opacity="0.7" />
          <ellipse cx="80" cy={faceCenterY} rx="5" ry="7" fill="#111" opacity="0.55" />
          <path d={`M80,${faceCenterY - 6} Q${fRx + 50},${faceCenterY + 20} ${fRx + 56},${faceCenterY + 52} Q${fRx + 58},${faceCenterY + 72} ${fRx + 46},${faceCenterY + 88}`}
            stroke={hairColor} strokeWidth={18} fill="none" strokeLinecap="round" opacity="0.9" />
          {Array.from({ length: 40 }, (_, i) => {
            const t = i / 40;
            const px = (fRx + 50) + t * 8;
            const py = faceCenterY + 18 + t * 68;
            const wave = Math.sin(t * Math.PI * 3 + i * 0.5) * (hairTexture === 'coily' ? 6 : hairTexture === 'wavy' ? 4 : 2);
            return (
              <path key={i}
                d={`M${px + wave},${py} Q${px + wave + 2},${py + 5} ${px + wave},${py + 10}`}
                stroke={i % 6 === 0 ? hairColorLight : hairColor}
                strokeWidth={1.6} fill="none" opacity={0.75} strokeLinecap="round" />
            );
          })}
        </g>
      );

    case 'afro':
      return (
        <g>
          <ellipse cx="50" cy={faceCenterY - 18} rx={fRx + 16} ry={fRy + 2} fill={hairColor} opacity="0.88" />
          {Array.from({ length: 300 }, (_, i) => {
            const angle = (i / 300) * Math.PI * 2;
            const layer = Math.floor(i / 60);
            const r = 12 + layer * 5;
            const x = 50 + Math.cos(angle) * r * 1.45 + (((i * 4373) % 7) - 3) * 1.0;
            const y = faceCenterY - 18 + Math.sin(angle) * r + (((i * 6113) % 5) - 2) * 0.9;
            const dist = Math.sqrt(Math.pow((x - 50) / 1.45, 2) + Math.pow(y - (faceCenterY - 18), 2));
            if (dist > fRy + 4) return null;
            return (
              <circle key={i} cx={x} cy={y} r={1.6 + (i % 3) * 0.4}
                fill={i % 9 === 0 ? hairColorLight : hairColor}
                opacity={0.6 + (i % 4) * 0.08} />
            );
          })}
        </g>
      );

    case 'locs':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 8} rx={fRx + 1} ry="14" fill={hairColor} />
          {Array.from({ length: 11 }, (_, i) => {
            const x = 16 + i * 6.5;
            const curveMod = (i - 5) * 3.5;
            const len = 90;
            return (
              <g key={i}>
                <path d={`M${x},${faceTop + 10} Q${x + curveMod * 0.5},${faceTop + 10 + len * 0.4} ${x + curveMod * 0.7},${faceTop + 10 + len * 0.7} Q${x + curveMod},${faceTop + 10 + len} ${x + curveMod * 0.8},${faceTop + 10 + len * 1.3}`}
                  stroke={hairColor} strokeWidth={7.5} fill="none" strokeLinecap="round" opacity="0.95" />
                {Array.from({ length: 11 }, (_, j) => {
                  const t = j / 11;
                  const sx = x + curveMod * t * 0.7;
                  const sy = faceTop + 10 + len * t;
                  return (
                    <ellipse key={j} cx={sx} cy={sy} rx="3.2" ry="1.4"
                      fill={hairColorDark} opacity="0.45"
                      transform={`rotate(${(curveMod > 0 ? 1 : -1) * 18 * t}, ${sx}, ${sy})`} />
                  );
                })}
              </g>
            );
          })}
        </g>
      );

    case 'bun':
      return (
        <g>
          <ellipse cx="50" cy={faceTop + 10} rx={fRx + 1} ry="16" fill={hairColor} />
          <path d={`M${50 - fRx + 2},${faceTop + 12} Q${50 - fRx},${faceCenterY} ${50 - fRx + 1},${faceBottom + 2} L${50 - fRx + 6},${faceBottom + 4} Q${50 - fRx + 4},${faceCenterY + 2} ${50 - fRx + 7},${faceTop + 14} Z`} fill={hairColorDark} opacity="0.65" />
          <ellipse cx="50" cy={faceTop - 14} rx="17" ry="15" fill={hairColor} opacity="0.92" />
          <ellipse cx="50" cy={faceTop - 14} rx="12" ry="10" fill={hairColorDark} opacity="0.35" />
          {Array.from({ length: 100 }, (_, i) => {
            const angle = (i / 100) * Math.PI * 6;
            const layer = Math.floor(i / 20);
            const r = 3 + layer * 2.2;
            const bx = 50 + Math.cos(angle) * r;
            const by = faceTop - 14 + Math.sin(angle) * r * 0.85;
            if (r > 14) return null;
            return (
              <path key={i}
                d={`M50,${faceTop - 14} L${bx},${by}`}
                stroke={i % 8 === 0 ? hairColorLight : hairColorMid}
                strokeWidth={0.8} opacity={0.5} strokeLinecap="round" />
            );
          })}
          <ellipse cx={50 - fRx - 1} cy={faceCenterY - 2} rx="5.5" ry="15" fill={hairColorDark} opacity="0.65" />
          <ellipse cx={50 + fRx + 1} cy={faceCenterY - 2} rx="5.5" ry="15" fill={hairColorDark} opacity="0.65" />
        </g>
      );

    default: return null;
  }
}
