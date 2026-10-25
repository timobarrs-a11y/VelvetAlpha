import { memo, useId, useMemo } from 'react';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { renderHair } from '../renderers/hairRenderer';
import {
  outfitGradient, renderOutfitBody, renderOutfitFront, shade,
  renderHeadwear, headwearHairCut, renderFaceAccessory,
} from '../renderers/outfitRenderer';
import { outfitItem } from '../data/avatarItems';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import { faceOutlinePath } from '../renderers/faceGeometry';
import {
  renderEyes, renderEyelashes, renderEyeliner, renderEyeShadow, renderEyebrows, renderNose,
  renderEars, earLobes, renderMouth, mouthGeometry, MouthMood,
} from '../renderers/faceFeatures';
import { renderFacialHair } from '../renderers/facialHairRenderer';


interface AvatarV2Props {
  // Any stored avatar: current, older versions, or a v1 config.
  config: Partial<AvatarConfigV2>;
  className?: string;
  // The mouth's expression. Neutral unless something (like a reaction) says otherwise.
  mood?: MouthMood;
}

function AvatarV2Inner({ config: raw, className = '', mood = 'neutral' }: AvatarV2Props) {
  // Whatever comes in (a database row, an old draft, a v1 config) is brought
  // up to date first, so every caller draws the same avatar.
  const config = migrateAvatarConfig(raw);
  const {
    gender, skinTone, eyeColor, hairColor, hairStyle, hairTexture,
    lipShape, lipColor, eyebrowShape, eyeShape, noseShape, faceShape,
    bodyType, facialHair, eyelashes, freckles, blush, glasses, earrings,
    nosePiercing, lipPiercing, necklace, necklaceColor, tattoo, eyeliner,
    eyeShadow, makeupIntensity, skinDetail,
    outfit = 'tee', headwear = 'none', faceAccessory = 'none',
  } = config;
  const outfitColor = config.outfitColor ?? outfitItem(outfit).color;
  const outfitAccent = config.outfitAccent ?? outfitItem(outfit).accent;

  // Ids for <defs> that differ per avatar must be unique per instance, or
  // several avatars on one page all borrow the first one's clip and colours.
  const uid = useId().replace(/:/g, '');
  const faceClipId = `${uid}-face`;
  const outfitGradientId = `${uid}-outfit`;
  const hairClipId = `${uid}-hair`;


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

  const faceGeometry = { faceShape, fRx, fRy, chinW, faceTop, faceBottom, faceCenterY };

  const renderFaceShape = () => (
    <path d={faceOutlinePath(faceGeometry)} fill={`url(#${faceGradientId})`} />
  );

  const renderFaceShading = () => {
    const shadeColor = skinTone + '30';
    return (
      <g opacity="0.25" clipPath={`url(#${faceClipId})`}>
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
      <g clipPath={`url(#${faceClipId})`} opacity="0.12">
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

  const renderFacialHairLayer = () => {
    return renderFacialHair({
      facialHair, hairColor, geometry: faceGeometry,
      mouth: mouthGeometry(lipShape, mood),
      idPrefix: uid,
    });
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
    const metal = '#C0C0C0';
    return earLobes(faceGeometry).map(({ x, y, side }) => {
      switch (earrings) {
        case 'studs':
          return (
            <g key={side}>
              <circle cx={x} cy={y} r="1.6" fill={metal} />
              <circle cx={x - 0.5} cy={y - 0.5} r="0.6" fill="#fff" opacity="0.7" />
            </g>
          );
        case 'hoops':
          return <ellipse key={side} cx={x + side * 0.4} cy={y + 3.6} rx="2.8" ry="3.9" fill="none" stroke={metal} strokeWidth="1.1" />;
        case 'dangles':
          return (
            <g key={side}>
              <circle cx={x} cy={y} r="1.1" fill={metal} />
              <path d={`M${x} ${y + 1} L${x} ${y + 9}`} stroke={metal} strokeWidth="0.8" />
              <circle cx={x} cy={y + 10.6} r="2" fill={metal} />
            </g>
          );
        case 'gauges':
          return (
            <g key={side}>
              <circle cx={x} cy={y} r="2.6" fill="#1a1a1a" />
              <circle cx={x} cy={y} r="1.6" fill={metal} />
            </g>
          );
        default: return null;
      }
    });
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

  const faceGradientId = `${uid}-skin`;
  const { shoulderRx, torsoScaleX } = bodyParams;
  const neckY = faceParams.jawY ?? 78;

  const outfitParams = {
    outfit, main: outfitColor, accent: outfitAccent, skin: skinTone,
    neckY, shoulderRx, gradientId: outfitGradientId,
  };
  const headwearParams = { headwear, fRx, faceTop };
  const hairCut = headwearHairCut(headwearParams);

  const svgDefs = useMemo(() => (
    <defs>
      <radialGradient id={faceGradientId} cx="42%" cy="36%" r="72%">
        <stop offset="0%" stopColor={shade(skinTone, 0.07)} />
        <stop offset="58%" stopColor={skinTone} />
        <stop offset="100%" stopColor={shade(skinTone, -0.12)} />
      </radialGradient>
      {outfitGradient(outfitParams)}
      <clipPath id={faceClipId}>
        <path d={faceOutlinePath(faceGeometry)} />
      </clipPath>
      {hairCut !== null && (
        <clipPath id={hairClipId}>
          <rect x="-100" y={hairCut} width="300" height="300" />
        </clipPath>
      )}
    </defs>
  // outfitParams is rebuilt each render; its gradient only depends on these.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [skinTone, faceShape, fRx, fRy, faceGradientId, faceCenterY, faceClipId, hairClipId, hairCut, outfit, outfitColor, outfitGradientId]);

  const neckTopY = neckY - 4;
  const neckWidth = 11;

  const hair = renderHair({
    hairStyle, hairTexture, hairColor, skinTone,
    geometry: faceGeometry, idPrefix: uid,
  });
  const hatClip = hairCut !== null ? `url(#${hairClipId})` : undefined;

  return (
    <svg viewBox="0 0 100 130" className={className}>
      {svgDefs}

      <g clipPath={hatClip}>{hair.back}</g>

      <g transform={`translate(50,0) scale(${torsoScaleX},1) translate(-50,0)`}>
        {renderOutfitBody(outfitParams)}
      </g>

      <rect x={50 - neckWidth} y={neckTopY} width={neckWidth * 2} height={neckY - neckTopY + 14}
        fill={`url(#${faceGradientId})`} rx="2" />

      <g transform={`translate(50,0) scale(${torsoScaleX},1) translate(-50,0)`}>
        {renderOutfitFront(outfitParams)}
      </g>

      {renderNecklace()}
      {renderTattoo()}

      {renderEars({ geometry: faceGeometry, skinTone })}
      {renderFaceShape()}
      {renderNeckShadow()}
      {renderFaceShading()}
      {renderSkinDetail()}

      {renderEyeShadow(eyeShadow, eyeShape, makeupIntensity)}
      {renderBlush()}
      {renderEyes({ eyeShape, eyeColor, skinTone, idPrefix: uid })}
      {renderEyeliner(eyeliner, eyeShape)}
      {eyelashes === 'dramatic' && renderEyelashes(eyeShape)}
      {renderEyebrows(eyebrowShape, eyeShape, hairColor, gender)}
      {renderNose(noseShape, skinTone)}
      {renderNosePiercing()}
      {renderFreckles()}

      {renderMouth({ lipShape, lipColor, skinTone, mood, idPrefix: uid })}

      {renderLipPiercing()}
      {renderFacialHairLayer()}
      {renderEarrings()}
      <g clipPath={hatClip}>{hair.front}</g>
      {renderGlasses()}
      {renderFaceAccessory(faceAccessory)}
      {renderHeadwear(headwearParams)}
    </svg>
  );
}

export const AvatarV2 = memo(AvatarV2Inner, (prev, next) =>
  prev.className === next.className &&
  prev.mood === next.mood &&
  JSON.stringify(prev.config) === JSON.stringify(next.config)
);
