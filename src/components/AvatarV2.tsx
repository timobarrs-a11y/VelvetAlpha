import { memo, useMemo } from 'react';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { renderMaleHair, renderFemaleHair } from '../renderers/hairRenderer';

interface AvatarV2Props {
  config: AvatarConfigV2;
  className?: string;
}

function AvatarV2Inner({ config, className = '' }: AvatarV2Props) {
  const {
    gender, skinTone, eyeColor, hairColor, hairStyle, hairTexture,
    lipShape, lipColor, eyebrowShape, eyeShape, noseShape, faceShape,
    bodyType, facialHair, eyelashes, freckles, blush, glasses, earrings,
    nosePiercing, lipPiercing, necklace, necklaceColor, tattoo, eyeliner,
    eyeShadow, makeupIntensity, skinDetail,
  } = config;

  const hairColorDark = hairColor + 'cc';
  const hairColorLight = hairColor + '55';
  const hairColorMid = hairColor + 'aa';

  const faceParams = {
    oval:    { rx: 28, ry: 34, chinW: 20, jawY: 78 },
    round:   { rx: 30, ry: 30, chinW: 26, jawY: 76 },
    square:  { rx: 28, ry: 32, chinW: 24, jawY: 80 },
    heart:   { rx: 30, ry: 32, chinW: 16, jawY: 78 },
    diamond: { rx: 27, ry: 35, chinW: 15, jawY: 80 },
    oblong:  { rx: 25, ry: 37, chinW: 18, jawY: 82 },
  }[faceShape] ?? { rx: 28, ry: 34, chinW: 20, jawY: 78 };

  const bodyParams = {
    slim:     { shoulderRx: 26, torsoScaleX: 0.82 },
    average:  { shoulderRx: 30, torsoScaleX: 1.0 },
    athletic: { shoulderRx: 34, torsoScaleX: 1.08 },
    curvy:    { shoulderRx: 30, torsoScaleX: 1.14 },
  }[bodyType] ?? { shoulderRx: 30, torsoScaleX: 1.0 };

  const { rx: fRx, ry: fRy, chinW } = faceParams;
  const faceCenterY = 52;
  const faceTop = faceCenterY - fRy;
  const faceBottom = faceCenterY + fRy;

  const renderFaceShape = () => {
    switch (faceShape) {
      case 'square':
        return (
          <g>
            <path d={`M${50 - fRx},${faceTop + 6} L${50 - fRx},${faceBottom - 6} Q${50 - chinW/2},${faceBottom + 4} 50,${faceBottom + 6} Q${50 + chinW/2},${faceBottom + 4} ${50 + fRx},${faceBottom - 6} L${50 + fRx},${faceTop + 6} Q50,${faceTop - 2} ${50 - fRx},${faceTop + 6} Z`}
              fill={`url(#${faceGradientId})`} />
          </g>
        );
      case 'heart':
        return (
          <g>
            <path d={`M${50 - fRx},${faceTop + 4} Q50,${faceTop - 2} ${50 + fRx},${faceTop + 4} L${50 + fRx},${faceBottom - 8} Q${50 + fRx - 4},${faceBottom + 2} 50,${faceBottom + 6} Q${50 - fRx + 4},${faceBottom + 2} ${50 - fRx},${faceBottom - 8} Z`}
              fill={`url(#${faceGradientId})`} />
          </g>
        );
      case 'diamond':
        return (
          <g>
            <path d={`M${50 - fRx + 4},${faceTop + 6} Q50,${faceTop - 2} ${50 + fRx - 4},${faceTop + 6} L${50 + fRx},${faceBottom - 10} Q${50 + chinW/2},${faceBottom + 3} 50,${faceBottom + 6} Q${50 - chinW/2},${faceBottom + 3} ${50 - fRx},${faceBottom - 10} Z`}
              fill={`url(#${faceGradientId})`} />
          </g>
        );
      case 'oblong':
        return (
          <g>
            <path d={`M${50 - fRx},${faceTop + 8} Q50,${faceTop - 1} ${50 + fRx},${faceTop + 8} L${50 + fRx},${faceBottom - 8} Q${50 + chinW/2},${faceBottom + 4} 50,${faceBottom + 7} Q${50 - chinW/2},${faceBottom + 4} ${50 - fRx},${faceBottom - 8} Z`}
              fill={`url(#${faceGradientId})`} />
          </g>
        );
      default:
        return (
          <g>
            <ellipse cx="50" cy={faceCenterY} rx={fRx} ry={fRy} fill={`url(#${faceGradientId})`} />
          </g>
        );
    }
  };

  const renderFaceShading = () => {
    const shadeColor = skinTone + '30';
    return (
      <g opacity="0.25" clipPath="url(#faceClipV2)">
        <ellipse cx={50 - fRx + 6} cy={faceCenterY + 8} rx="5" ry="8" fill={shadeColor} style={{ filter: 'blur(3px)' }} />
        <ellipse cx={50 + fRx - 6} cy={faceCenterY + 8} rx="5" ry="8" fill={shadeColor} style={{ filter: 'blur(3px)' }} />
        <ellipse cx="50" cy={faceCenterY + fRy - 6} rx={fRx - 8} ry="4" fill={shadeColor} style={{ filter: 'blur(2px)' }} />
        <path d={`M50,${faceCenterY - 6} Q52,${faceCenterY + 4} 50,${faceCenterY + 12}`} stroke="#ffffff" strokeWidth="3" fill="none" opacity="0.15" style={{ filter: 'blur(1px)' }} />
      </g>
    );
  };

  const renderNeckShadow = () => {
    return (
      <path d={`M${50 - 9},${faceBottom - 2} Q50,${faceBottom + 2} ${50 + 9},${faceBottom - 2}`}
        stroke={skinTone + '40'} strokeWidth="4" fill="none" opacity="0.5" style={{ filter: 'blur(2px)' }} />
    );
  };

  const renderSkinDetail = () => {
    if (!skinDetail || skinDetail === 'none') return null;
    if (skinDetail === 'smooth') return null;
    return (
      <g clipPath="url(#faceClipV2)" opacity="0.12">
        {Array.from({ length: 20 }, (_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          const r = 6 + (i % 4) * 5;
          const x = 50 + Math.cos(angle) * r + (((i * 7193) % 5) - 2);
          const y = faceCenterY + Math.sin(angle) * r * 0.8 + (((i * 3347) % 3) - 1);
          return <circle key={i} cx={x} cy={y} r="0.4" fill="#000" opacity="0.3" />;
        })}
      </g>
    );
  };

  const renderEyeShadow = () => {
    if (!eyeShadow || eyeShadow === 'none') return null;
    const colors = { smoky: '#3a3a4a', natural: '#c4917c', colorful: '#7c4a8a' };
    const c = colors[eyeShadow] ?? '#3a3a4a';
    const opacity = makeupIntensity === 'glam' ? 0.5 : makeupIntensity === 'subtle' ? 0.25 : 0.35;
    return (
      <g opacity={opacity}>
        <ellipse cx="38" cy="46" rx="7" ry="3" fill={c} style={{ filter: 'blur(2px)' }} />
        <ellipse cx="62" cy="46" rx="7" ry="3" fill={c} style={{ filter: 'blur(2px)' }} />
      </g>
    );
  };

  const renderBlush = () => {
    if (!blush || blush === 'none') return null;
    const intensity = makeupIntensity === 'glam' ? 1.3 : makeupIntensity === 'subtle' ? 0.7 : 1.0;
    const opacity = (blush === 'soft' ? 0.16 : 0.32) * intensity;
    const cheekY = faceCenterY + 8;
    const cheekInset = fRx - 10;
    return (
      <g>
        <ellipse cx={50 - cheekInset} cy={cheekY} rx="7" ry="4"
          fill="#e87a7a" opacity={opacity}
          style={{ filter: 'blur(2px)' }} />
        <ellipse cx={50 + cheekInset} cy={cheekY} rx="7" ry="4"
          fill="#e87a7a" opacity={opacity}
          style={{ filter: 'blur(2px)' }} />
      </g>
    );
  };

  const renderTattoo = () => {
    if (!tattoo || tattoo === 'none') return null;
    const inkColor = '#2a2a3a';
    switch (tattoo) {
      case 'neck':
        return (
          <g opacity="0.7">
            <path d="M44 84 Q50 80 56 84" stroke={inkColor} strokeWidth="1.2" fill="none" />
            <path d="M46 86 Q50 83 54 86" stroke={inkColor} strokeWidth="0.9" fill="none" />
            <circle cx="50" cy="88" r="1.2" fill={inkColor} opacity="0.8" />
          </g>
        );
      case 'forearm':
        return (
          <g opacity="0.6">
            <path d="M8 100 Q12 96 16 100 Q12 104 8 100 Z" fill={inkColor} />
            <path d="M10 94 L14 106" stroke={inkColor} strokeWidth="0.8" fill="none" />
            <path d="M6 97 L18 103" stroke={inkColor} strokeWidth="0.8" fill="none" />
          </g>
        );
      case 'collarbone':
        return (
          <g opacity="0.65">
            <path d="M30 92 Q40 89 50 91 Q60 89 70 92" stroke={inkColor} strokeWidth="1" fill="none" />
            <circle cx="35" cy="91" r="0.9" fill={inkColor} />
            <circle cx="50" cy="90" r="0.9" fill={inkColor} />
            <circle cx="65" cy="91" r="0.9" fill={inkColor} />
          </g>
        );
      default: return null;
    }
  };

  const lipShapes: Record<string, { top: string; bottom: string }> = {
    natural: { top: 'M42 76 Q46 73 50 74 Q54 73 58 76', bottom: 'M42 76 Q50 82 58 76' },
    full:    { top: 'M40 76 Q45 72 50 73 Q55 72 60 76', bottom: 'M40 76 Q50 85 60 76' },
    thin:    { top: 'M43 76 Q46 74 50 75 Q54 74 57 76', bottom: 'M43 76 Q50 79 57 76' },
    heart:   { top: 'M42 76 Q46 71 50 74 Q54 71 58 76', bottom: 'M42 76 Q50 82 58 76' },
  };

  const renderFacialHair = () => {
    if (gender !== 'male' || !facialHair || facialHair === 'none') return null;
    const fhColor = hairColor;
    const fhDark = hairColor + 'bb';
    switch (facialHair) {
      case 'stubble':
        return (
          <g>
            {Array.from({ length: 90 }, (_, i) => {
              const positions = [
                { x: 28 + (i % 12) * 3.5, y: 62 + Math.floor(i / 12) * 3.5 },
              ];
              const pos = positions[0];
              if (pos.x > 72) return null;
              if (pos.y > 90 && (pos.x < 40 || pos.x > 60)) return null;
              if (pos.y > 98) return null;
              const angle = -0.3 + (((i * 1237) % 7) - 3) * 0.15;
              return (
                <line key={i}
                  x1={pos.x} y1={pos.y}
                  x2={pos.x + Math.sin(angle) * 1.2} y2={pos.y - 1.5 - (i % 3) * 0.3}
                  stroke={fhColor} strokeWidth={0.8}
                  opacity={0.3 + (((i * 3571) % 7) / 7) * 0.25}
                  strokeLinecap="round" />
              );
            })}
          </g>
        );

      case 'beard':
        return (
          <g>
            <path
              d={`M${50 - fRx + 4},64 Q${50 - fRx},70 ${50 - fRx + 1},78 Q${50 - fRx + 2},88 ${50 - fRx + 8},95 Q${50 - fRx + 16},102 50,104 Q${50 + fRx - 16},102 ${50 + fRx - 8},95 Q${50 + fRx - 2},88 ${50 + fRx - 1},78 Q${50 + fRx},70 ${50 + fRx - 4},64`}
              fill={fhColor} opacity="0.88" />
            {Array.from({ length: 60 }, (_, i) => {
              const t = (i / 60) * Math.PI;
              const bx = 50 + Math.cos(t + Math.PI) * (fRx - 8) * 0.9;
              const by = 64 + Math.sin(t) * 0;
              const endX = bx + (Math.random() > 0.5 ? 1 : -1) * (1 + (i % 3) * 0.5);
              const endY = by + 3 + (i % 4) * 0.5;
              return (
                <path key={i}
                  d={`M${bx},${by} Q${(bx + endX) / 2 + Math.sin(i) * 0.8},${(by + endY) / 2} ${endX},${endY}`}
                  stroke={i % 8 === 0 ? hairColorLight : fhDark}
                  strokeWidth={1} fill="none" opacity={0.6} strokeLinecap="round" />
              );
            })}
            <ellipse cx={50 - fRx + 3} cy="66" rx="3" ry="9" fill={fhColor} opacity="0.8" />
            <ellipse cx={50 + fRx - 3} cy="66" rx="3" ry="9" fill={fhColor} opacity="0.8" />
          </g>
        );

      case 'goatee':
        return (
          <g>
            <path
              d="M44 78 Q42 84 43 91 Q45 98 50 102 Q55 98 57 91 Q58 84 56 78 Q52 77 50 77 Q48 77 44 78 Z"
              fill={fhColor} opacity="0.85" />
            {Array.from({ length: 18 }, (_, i) => {
              const x = 44 + (i % 6) * 2;
              const y = 80 + Math.floor(i / 6) * 5;
              return (
                <line key={i}
                  x1={x} y1={y} x2={x + Math.sin(i * 0.9) * 0.8} y2={y + 2.5}
                  stroke={fhDark} strokeWidth={0.8} opacity={0.5} strokeLinecap="round" />
              );
            })}
          </g>
        );

      case 'mustache':
        return (
          <g>
            <path
              d={`M37,70 Q40,66 44,68 Q47,70 50,70 Q53,70 56,68 Q60,66 63,70 Q61,73 57,74 Q54,75 50,74 Q46,75 43,74 Q39,73 37,70 Z`}
              fill={fhColor} opacity="0.85" />
            {Array.from({ length: 14 }, (_, i) => {
              const x = 38 + i * 1.9;
              return (
                <path key={i}
                  d={`M${x},70 Q${x + Math.sin(i) * 1},72 ${x},74`}
                  stroke={fhDark} strokeWidth={0.7} fill="none" opacity={0.5} strokeLinecap="round" />
              );
            })}
          </g>
        );

      default: return null;
    }
  };

  const renderFreckles = () => {
    if (!freckles || freckles === 'none') return null;
    if (freckles === 'beauty_mark') {
      return (
        <circle cx="61" cy="67" r="1.4" fill="#5a3a2a" opacity="0.55" />
      );
    }
    const count = freckles === 'light' ? 14 : 28;
    const seed = 9371;
    const positions: Array<{ x: number; y: number; r: number }> = [];
    for (let i = 0; i < count; i++) {
      const s = (i * seed * (i + 3)) % 10000;
      const side = i % 2 === 0 ? -1 : 1;
      const xBase = 50 + side * (8 + (s % 14));
      const yBase = 55 + (s % 10) - 4;
      if (Math.abs(xBase - 50) > 16) continue;
      if (yBase < 50 || yBase > 70) continue;
      positions.push({ x: xBase, y: yBase, r: 0.6 + (s % 3) * 0.3 });
    }
    return (
      <g>
        {positions.map((pos, i) => (
          <circle key={i} cx={pos.x} cy={pos.y} r={pos.r}
            fill="#7a4a2e" opacity={0.18 + (i % 4) * 0.04} />
        ))}
      </g>
    );
  };

  const renderGlasses = () => {
    if (!glasses || glasses === 'none') return null;
    const frameColor = '#1a1a1a';
    switch (glasses) {
      case 'round':
        return (
          <g fill="none" stroke={frameColor} strokeWidth="1.5">
            <circle cx="38" cy="50" r="10" />
            <circle cx="62" cy="50" r="10" />
            <path d="M48 50 L52 50" />
            <path d="M28 48 L22 46" />
            <path d="M72 48 L78 46" />
            <ellipse cx="38" cy="50" rx="9" ry="9" fill="white" opacity="0.05" />
            <ellipse cx="62" cy="50" rx="9" ry="9" fill="white" opacity="0.05" />
          </g>
        );
      case 'square':
        return (
          <g fill="none" stroke={frameColor} strokeWidth="1.5">
            <rect x="28" y="44" width="18" height="14" rx="2" />
            <rect x="54" y="44" width="18" height="14" rx="2" />
            <path d="M46 50 L54 50" />
            <path d="M28 46 L22 44" />
            <path d="M72 46 L78 44" />
          </g>
        );
      case 'cat-eye':
        return (
          <g fill="none" stroke={frameColor} strokeWidth="1.5">
            <path d="M28 54 Q28 44 38 44 Q48 44 48 50 Q48 56 38 56 Q28 56 28 54 L28 44" />
            <path d="M72 54 Q72 44 62 44 Q52 44 52 50 Q52 56 62 56 Q72 56 72 54 L72 44" />
            <path d="M48 50 L52 50" />
            <path d="M28 46 L22 42" />
            <path d="M72 46 L78 42" />
          </g>
        );
      case 'aviator':
        return (
          <g fill="none" stroke={frameColor} strokeWidth="1.2">
            <path d="M26 48 Q26 42 34 42 L42 42 Q48 42 48 48 L48 54 Q48 60 40 60 L32 60 Q26 60 26 54 Z" />
            <path d="M74 48 Q74 42 66 42 L58 42 Q52 42 52 48 L52 54 Q52 60 60 60 L68 60 Q74 60 74 54 Z" />
            <path d="M48 48 L52 48" />
            <path d="M26 46 L22 44" />
            <path d="M74 46 L78 44" />
            <path d="M27 48 Q27 43 34 43 L42 43 Q47 43 47 48 L47 54 Q47 59 40 59 L32 59 Q27 59 27 54 Z" fill="#4a3f35" opacity="0.2" />
            <path d="M73 48 Q73 43 66 43 L58 43 Q53 43 53 48 L53 54 Q53 59 60 59 L68 59 Q73 59 73 54 Z" fill="#4a3f35" opacity="0.2" />
          </g>
        );
      default: return null;
    }
  };

  const renderEarrings = () => {
    if (!earrings || earrings === 'none') return null;
    const metalColor = '#C0C0C0';
    const shine = '#ffffff';
    switch (earrings) {
      case 'studs':
        return (
          <g>
            <circle cx="22" cy="56" r="2.5" fill={metalColor} />
            <circle cx="78" cy="56" r="2.5" fill={metalColor} />
            <circle cx="21" cy="55" r="1" fill={shine} opacity="0.6" />
            <circle cx="77" cy="55" r="1" fill={shine} opacity="0.6" />
          </g>
        );
      case 'hoops':
        return (
          <g>
            <circle cx="22" cy="56" r="1.2" fill={metalColor} />
            <ellipse cx="22" cy="61" rx="3.5" ry="5" fill="none" stroke={metalColor} strokeWidth="1.5" />
            <circle cx="78" cy="56" r="1.2" fill={metalColor} />
            <ellipse cx="78" cy="61" rx="3.5" ry="5" fill="none" stroke={metalColor} strokeWidth="1.5" />
          </g>
        );
      case 'dangles':
        return (
          <g>
            <circle cx="22" cy="56" r="1.5" fill={metalColor} />
            <circle cx="78" cy="56" r="1.5" fill={metalColor} />
            <path d="M22 58 L22 72" stroke={metalColor} strokeWidth="1" />
            <path d="M78 58 L78 72" stroke={metalColor} strokeWidth="1" />
            <circle cx="22" cy="74" r="3" fill={metalColor} />
            <circle cx="78" cy="74" r="3" fill={metalColor} />
          </g>
        );
      case 'gauges':
        return (
          <g>
            <circle cx="22" cy="56" r="4" fill="#1a1a1a" />
            <circle cx="78" cy="56" r="4" fill="#1a1a1a" />
            <circle cx="22" cy="56" r="2.5" fill={metalColor} />
            <circle cx="78" cy="56" r="2.5" fill={metalColor} />
          </g>
        );
      default: return null;
    }
  };

  const renderNosePiercing = () => {
    if (!nosePiercing || nosePiercing === 'none') return null;
    const metalColor = '#C0C0C0';
    switch (nosePiercing) {
      case 'nostril_stud':
        return (
          <g>
            <circle cx="45" cy="66" r="1.5" fill={metalColor} />
            <circle cx="44.5" cy="65.5" r="0.5" fill="white" opacity="0.7" />
          </g>
        );
      case 'nose_ring':
        return (
          <g>
            <path d="M44 66 Q40 68 42 72 Q44 74 46 72" fill="none" stroke={metalColor} strokeWidth="1.2" />
            <circle cx="44" cy="72" r="1" fill={metalColor} />
          </g>
        );
      default: return null;
    }
  };

  const renderLipPiercing = () => {
    if (!lipPiercing || lipPiercing === 'none') return null;
    const metalColor = '#C0C0C0';
    switch (lipPiercing) {
      case 'labret':
        return (
          <g>
            <circle cx="50" cy="84" r="2" fill={metalColor} />
            <circle cx="49" cy="83" r="0.7" fill="white" opacity="0.6" />
          </g>
        );
      case 'lip_ring':
        return (
          <g>
            <path d="M44 78 Q42 82 44 84 Q46 86 48 84" fill="none" stroke={metalColor} strokeWidth="1.5" />
            <circle cx="46" cy="85" r="1" fill={metalColor} />
          </g>
        );
      case 'snake_bites':
        return (
          <g>
            <circle cx="42" cy="80" r="1.5" fill={metalColor} />
            <circle cx="58" cy="80" r="1.5" fill={metalColor} />
          </g>
        );
      default: return null;
    }
  };

  const renderNecklace = () => {
    if (!necklace || necklace === 'none') return null;
    switch (necklace) {
      case 'chain':
        return (
          <g>
            <path d="M32 92 Q40 100 50 103 Q60 100 68 92" fill="none" stroke={necklaceColor} strokeWidth="1.5" />
            {Array.from({ length: 8 }, (_, i) => {
              const x = 35 + i * 4;
              const y = 95 + Math.sin(i * 0.8) * 3;
              return <ellipse key={i} cx={x} cy={y} rx="1.5" ry="1" fill="none" stroke={necklaceColor} strokeWidth="0.5" />;
            })}
          </g>
        );
      case 'choker':
        return (
          <g>
            <path d="M28 86 Q35 88 50 89 Q65 88 72 86" fill="none" stroke={necklaceColor} strokeWidth="4" />
            <path d="M28 86 Q35 88 50 89 Q65 88 72 86" fill="none" stroke={necklaceColor} strokeWidth="2.5" opacity="0.8" />
          </g>
        );
      case 'pendant':
        return (
          <g>
            <path d="M32 90 Q40 96 50 98 Q60 96 68 90" fill="none" stroke={necklaceColor} strokeWidth="1" />
            <path d="M47 100 L50 108 L53 100 Z" fill={necklaceColor} />
          </g>
        );
      case 'pearls':
        return (
          <g>
            <path d="M30 88 Q40 94 50 96 Q60 94 70 88" fill="none" stroke={necklaceColor} strokeWidth="0.5" opacity="0.3" />
            {Array.from({ length: 11 }, (_, i) => {
              const t = i / 10;
              const x = 30 + t * 40;
              const y = 88 + Math.sin(t * Math.PI) * 8;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="2.5" fill={necklaceColor} />
                  <circle cx={x - 0.6} cy={y - 0.6} r="0.8" fill="white" opacity="0.7" />
                </g>
              );
            })}
          </g>
        );
      default: return null;
    }
  };

  const renderEyebrows = () => {
    const thickness = gender === 'male' ? 2.5 : 1.8;
    const shapes: Record<string, { left: string; right: string; thickness?: number }> = {
      natural:  { left: 'M29 42 Q38 38 46 41', right: 'M54 41 Q62 38 71 42' },
      arched:   { left: 'M29 44 Q38 36 46 42', right: 'M54 42 Q62 36 71 44' },
      straight: { left: 'M29 42 L46 40',        right: 'M54 40 L71 42' },
      thick:    { left: 'M29 42 Q38 37 46 41',  right: 'M54 41 Q62 37 71 42', thickness: 3.5 },
      thin:     { left: 'M30 42 Q38 39 45 41',  right: 'M55 41 Q62 39 70 42', thickness: 1.2 },
    };
    const shape = shapes[eyebrowShape] || shapes.natural;
    const strokeWidth = shape.thickness || thickness;
    return (
      <g stroke={hairColor} strokeWidth={strokeWidth} fill="none" opacity="0.75" strokeLinecap="round">
        <path d={shape.left} />
        <path d={shape.right} />
      </g>
    );
  };

  const renderEyelashes = () => {
    if (gender !== 'female' || eyelashes !== 'dramatic') return null;
    return (
      <g stroke="#1a1a1a" strokeWidth="1.1" fill="none" opacity="0.8">
        <path d="M31 48 L28 44" />
        <path d="M34 47 L32 43" />
        <path d="M37 46 L37 42" />
        <path d="M40 46 L41 42" />
        <path d="M63 46 L64 42" />
        <path d="M66 46 L68 43" />
        <path d="M69 47 L72 44" />
      </g>
    );
  };

  const renderEyeliner = () => {
    if (!eyeliner || eyeliner === 'none') return null;
    const eyeShapeConfigs = {
      almond: { rx: 7, ry: 5 },
      round:  { rx: 6, ry: 6 },
      hooded: { rx: 7, ry: 4.5 },
      wide:   { rx: 8, ry: 5.5 },
      monolid: { rx: 7, ry: 4 },
      deepset: { rx: 7, ry: 4.5 },
      upturned: { rx: 7, ry: 5 },
    }[eyeShape] ?? { rx: 7, ry: 5 };
    const { rx } = eyeShapeConfigs;
    const cy = 50;
    const lx = 38;
    const rx2 = 62;

    switch (eyeliner) {
      case 'thin':
        return (
          <g stroke="#1a1010" strokeWidth="1" fill="none" opacity="0.85" strokeLinecap="round">
            <path d={`M${lx - rx},${cy} Q${lx},${cy - 5.5} ${lx + rx},${cy}`} />
            <path d={`M${rx2 - rx},${cy} Q${rx2},${cy - 5.5} ${rx2 + rx},${cy}`} />
          </g>
        );
      case 'winged':
        return (
          <g stroke="#0d0808" strokeWidth="1.2" fill="none" opacity="0.9" strokeLinecap="round">
            <path d={`M${lx - rx},${cy} Q${lx},${cy - 6} ${lx + rx},${cy}`} />
            <path d={`M${lx + rx},${cy} Q${lx + rx + 3},${cy - 3} ${lx + rx + 5},${cy - 5}`} />
            <path d={`M${rx2 - rx},${cy} Q${rx2},${cy - 6} ${rx2 + rx},${cy}`} />
            <path d={`M${rx2 + rx},${cy} Q${rx2 + rx + 3},${cy - 3} ${rx2 + rx + 5},${cy - 5}`} />
          </g>
        );
      case 'bold':
        return (
          <g opacity="0.92">
            <path d={`M${lx - rx},${cy} Q${lx},${cy - 7} ${lx + rx},${cy}`}
              stroke="#0d0808" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d={`M${lx - rx + 1},${cy + 0.8} Q${lx},${cy - 6} ${lx + rx - 1},${cy + 0.8}`}
              stroke="#0d0808" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d={`M${lx + rx},${cy} Q${lx + rx + 4},${cy - 4} ${lx + rx + 6},${cy - 7}`}
              stroke="#0d0808" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d={`M${rx2 - rx},${cy} Q${rx2},${cy - 7} ${rx2 + rx},${cy}`}
              stroke="#0d0808" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d={`M${rx2 - rx + 1},${cy + 0.8} Q${rx2},${cy - 6} ${rx2 + rx - 1},${cy + 0.8}`}
              stroke="#0d0808" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            <path d={`M${rx2 + rx},${cy} Q${rx2 + rx + 4},${cy - 4} ${rx2 + rx + 6},${cy - 7}`}
              stroke="#0d0808" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
        );
      default: return null;
    }
  };

  const renderEyes = () => {
    const eyeShapeConfigs = {
      almond:   { rx: 7, ry: 5, irisR: 4.5, hoodOpacity: 0 },
      round:    { rx: 6, ry: 6, irisR: 4.8, hoodOpacity: 0 },
      hooded:   { rx: 7, ry: 4.5, irisR: 4.0, hoodOpacity: 0.6 },
      wide:     { rx: 8, ry: 5.5, irisR: 4.8, hoodOpacity: 0 },
      monolid:  { rx: 7, ry: 3.5, irisR: 3.5, hoodOpacity: 0.85 },
      deepset:  { rx: 7, ry: 4, irisR: 4.0, hoodOpacity: 0.45 },
      upturned: { rx: 7, ry: 5, irisR: 4.5, hoodOpacity: 0 },
    }[eyeShape] ?? { rx: 7, ry: 5, irisR: 4.5, hoodOpacity: 0 };

    const { rx, ry, irisR, hoodOpacity } = eyeShapeConfigs;
    const upturnedLift = eyeShape === 'upturned' ? 2 : 0;

    return (
      <g filter="url(#glow)">
        <ellipse cx="38" cy={50 - upturnedLift} rx={rx} ry={ry} fill="white" />
        <ellipse cx="62" cy={50 - upturnedLift} rx={rx} ry={ry} fill="white" />
        <circle cx="38" cy={50 - upturnedLift} r={irisR} fill={eyeColor} />
        <circle cx="62" cy={50 - upturnedLift} r={irisR} fill={eyeColor} />
        <circle cx="38" cy={50 - upturnedLift} r={irisR * 0.55} fill="#0a0a0a" />
        <circle cx="62" cy={50 - upturnedLift} r={irisR * 0.55} fill="#0a0a0a" />
        <circle cx="36.5" cy={48.5 - upturnedLift} r="1.3" fill="white" opacity="0.9" />
        <circle cx="60.5" cy={48.5 - upturnedLift} r="1.3" fill="white" opacity="0.9" />
        {upturnedLift > 0 && (
          <>
            <path d={`M${38 - rx},${50 - upturnedLift + 1} L${38 + rx},${50 - upturnedLift - 1}`} stroke={skinTone} strokeWidth="1" opacity="0.6" />
            <path d={`M${62 - rx},${50 - upturnedLift + 1} L${62 + rx},${50 - upturnedLift - 1}`} stroke={skinTone} strokeWidth="1" opacity="0.6" />
          </>
        )}
        {hoodOpacity > 0 && (
          <>
            <path d={`M${38 - rx},${50 - upturnedLift} Q38,${50 - upturnedLift - ry - 1} ${38 + rx},${50 - upturnedLift}`}
              fill={skinTone} opacity={hoodOpacity} />
            <path d={`M${62 - rx},${50 - upturnedLift} Q62,${50 - upturnedLift - ry - 1} ${62 + rx},${50 - upturnedLift}`}
              fill={skinTone} opacity={hoodOpacity} />
            <path d={`M${38 - rx + 1},${50 - upturnedLift} Q38,${50 - upturnedLift - ry + 2} ${38 + rx - 1},${50 - upturnedLift}`}
              fill={skinTone} opacity={hoodOpacity * 0.5} />
            <path d={`M${62 - rx + 1},${50 - upturnedLift} Q62,${50 - upturnedLift - ry + 2} ${62 + rx - 1},${50 - upturnedLift}`}
              fill={skinTone} opacity={hoodOpacity * 0.5} />
          </>
        )}
      </g>
    );
  };

  const renderNose = () => {
    const opacityBase = '15';
    switch (noseShape) {
      case 'button':
        return (
          <g>
            <path d="M50 55 Q52 60 50 65" stroke={`#000000${opacityBase}`} strokeWidth="1.5" fill="none" />
            <ellipse cx="47" cy="66" rx="3" ry="1.8" fill={`#000000${opacityBase === '15' ? '12' : '15'}`} />
            <ellipse cx="53" cy="66" rx="3" ry="1.8" fill="#00000012" />
            <path d="M45 66 Q50 69 55 66" stroke="#00000015" strokeWidth="1" fill="none" />
          </g>
        );
      case 'straight':
        return (
          <g>
            <path d="M50 55 Q53 62 50 68" stroke="#00000025" strokeWidth="2" fill="none" />
            <ellipse cx="46" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
            <ellipse cx="54" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
            <path d="M44 68 Q50 72 56 68" stroke="#00000018" strokeWidth="1.2" fill="none" />
          </g>
        );
      case 'broad':
        return (
          <g>
            <path d="M50 55 Q54 62 50 68" stroke="#00000022" strokeWidth="2.2" fill="none" />
            <ellipse cx="44" cy="68" rx="5" ry="2.5" fill="#00000015" />
            <ellipse cx="56" cy="68" rx="5" ry="2.5" fill="#00000015" />
            <path d="M42 68 Q50 73 58 68" stroke="#00000018" strokeWidth="1.4" fill="none" />
          </g>
        );
      case 'upturned':
        return (
          <g>
            <path d="M50 58 Q52 63 50 66" stroke="#00000018" strokeWidth="1.5" fill="none" />
            <ellipse cx="46" cy="65" rx="3.2" ry="1.8" fill="#00000010" />
            <ellipse cx="54" cy="65" rx="3.2" ry="1.8" fill="#00000010" />
            <path d="M44 65 Q50 67 56 65" stroke="#00000015" strokeWidth="1" fill="none" />
          </g>
        );
      case 'aquiline':
        return (
          <g>
            <path d="M50 54 Q53 58 52 62 Q51 66 50 68" stroke="#00000025" strokeWidth="2" fill="none" />
            <ellipse cx="46" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
            <ellipse cx="54" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
            <path d="M44 68 Q50 72 56 68" stroke="#00000018" strokeWidth="1.2" fill="none" />
          </g>
        );
      case 'hawk':
        return (
          <g>
            <path d="M50 54 Q54 59 53 64 Q52 67 50 69" stroke="#00000028" strokeWidth="2.5" fill="none" />
            <ellipse cx="45" cy="69" rx="3.8" ry="2.4" fill="#00000014" />
            <ellipse cx="55" cy="69" rx="3.8" ry="2.4" fill="#00000014" />
            <path d="M43 69 Q50 73 57 69" stroke="#00000018" strokeWidth="1.3" fill="none" />
          </g>
        );
      case 'flat':
        return (
          <g>
            <path d="M50 58 Q51 61 50 63" stroke="#00000018" strokeWidth="1.5" fill="none" />
            <ellipse cx="44" cy="64" rx="5.5" ry="3" fill="#00000015" />
            <ellipse cx="56" cy="64" rx="5.5" ry="3" fill="#00000015" />
            <path d="M41 64 Q50 68 59 64" stroke="#00000015" strokeWidth="1.2" fill="none" />
          </g>
        );
      default: return null;
    }
  };

  const lips = lipShapes[lipShape] || lipShapes.natural;
  const faceGradientId = `facev2-${skinTone.replace('#', '')}`;
  const { shoulderRx, torsoScaleX } = bodyParams;
  const neckY = faceParams.jawY ?? 78;

  const svgDefs = useMemo(() => (
    <defs>
      <linearGradient id={faceGradientId} x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0%" stopColor={skinTone} stopOpacity="1" />
        <stop offset="100%" stopColor={skinTone} stopOpacity="1" />
      </linearGradient>
      <linearGradient id="shirtGradV2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="0.4" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <clipPath id="faceClipV2">
        <ellipse cx="50" cy={faceCenterY} rx={fRx + 3} ry={fRy + 3} />
      </clipPath>
    </defs>
  ), [skinTone, fRx, fRy, faceGradientId, faceCenterY]);

  const neckTopY = neckY - 4;
  const neckWidth = 11;

  const hairParams = {
    hairColor, hairColorDark, hairColorLight, hairColorMid,
    hairStyle, hairTexture,
    fRx, fRy, faceTop, faceBottom, faceCenterY,
  };

  return (
    <svg viewBox="0 0 100 130" className={className}>
      {svgDefs}

      {gender === 'male' ? renderMaleHair(hairParams) : renderFemaleHair(hairParams)}

      <g transform={`translate(50,0) scale(${torsoScaleX},1) translate(-50,0)`}>
        <path d={`M50 ${neckY + 12} Q${50 - shoulderRx} ${neckY + 16} ${50 - shoulderRx - 10} ${neckY + 36} Q${50 - shoulderRx - 14} ${neckY + 53} ${50 - shoulderRx - 14} ${neckY + 73} L${50 + shoulderRx + 14} ${neckY + 73} Q${50 + shoulderRx + 14} ${neckY + 53} ${50 + shoulderRx + 10} ${neckY + 36} Q${50 + shoulderRx} ${neckY + 16} 50 ${neckY + 12} Z`}
          fill="url(#shirtGradV2)" />
        <path d={`M${50 - 14} ${neckY + 12} Q${50 - 6} ${neckY + 24} 50 ${neckY + 28} Q${50 + 6} ${neckY + 24} ${50 + 14} ${neckY + 12}`}
          stroke="#2d3748" strokeWidth="1.5" fill="none" />
      </g>

      <rect x={50 - neckWidth} y={neckTopY} width={neckWidth * 2} height={neckY - neckTopY + 14}
        fill={`url(#${faceGradientId})`} rx="2" />

      {renderNecklace()}
      {renderTattoo()}

      {renderFaceShape()}
      {renderNeckShadow()}
      {renderFaceShading()}
      {renderSkinDetail()}

      <ellipse cx={50 - fRx + 3} cy={faceCenterY + 2} rx="4" ry="7" fill={skinTone} />
      <ellipse cx={50 + fRx - 3} cy={faceCenterY + 2} rx="4" ry="7" fill={skinTone} />

      {renderEarrings()}
      {renderEyeShadow()}
      {renderBlush()}
      {renderEyes()}
      {renderEyeliner()}
      {renderEyelashes()}
      {renderEyebrows()}
      {renderNose()}
      {renderNosePiercing()}
      {renderFreckles()}

      <path d={lips.bottom} fill={lipColor} opacity="0.9" />
      <path d={lips.top} fill={lipColor} opacity="0.8" />
      <path d="M46 75 Q50 73.5 54 75" stroke="white" strokeWidth="0.7" fill="none" opacity="0.2" />

      {renderLipPiercing()}
      {renderFacialHair()}
      {renderGlasses()}
    </svg>
  );
}

export const AvatarV2 = memo(AvatarV2Inner, (prev, next) =>
  prev.className === next.className &&
  JSON.stringify(prev.config) === JSON.stringify(next.config)
);
