import { AvatarConfig } from '../types/avatar';

interface AvatarProps {
  config: AvatarConfig;
  className?: string;
}

export function Avatar({ config, className = '' }: AvatarProps) {
  const {
    gender, skinTone, eyeColor, hairColor, hairStyle, lipShape, lipColor,
    eyebrowShape, facialHair, eyelashes, freckles, glasses, earrings,
    nosePiercing, lipPiercing, necklace, necklaceColor
  } = config;

  const hairColorDark = hairColor + 'dd';
  const hairHighlight = hairColor + '66';

  const renderMaleHair = () => {
    switch(hairStyle) {
      case 'buzz':
        return (
          <g>
            {/* Buzz cut - very short stubble-like texture hugging the scalp */}
            {/* Solid base - thin layer */}
            <ellipse cx="50" cy="30" rx="28" ry="19" fill={hairColor} />

            {/* Subtle texture for stubble effect - tiny dots very close together */}
            {Array.from({ length: 1200 }, (_, i) => {
              const col = i % 60;
              const row = Math.floor(i / 60);
              const angle = (col / 60) * Math.PI;
              const x = 50 + Math.cos(angle) * (14 + row * 1.5) + (Math.sin(i * 5) * 0.4);
              const y = 30 + Math.sin(angle) * ((14 + row * 1.5) * 0.68) + (Math.cos(i * 5) * 0.4);

              if (y > 48 || y < 16) return null;

              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={0.25}
                  fill={i % 20 === 0 ? hairHighlight : hairColorDark}
                  opacity={0.4 + (i % 3) * 0.1}
                />
              );
            })}

            {/* Temple stubble */}
            <ellipse cx="22" cy="40" rx="4" ry="10" fill={hairColor} opacity="0.9" />
            <ellipse cx="78" cy="40" rx="4" ry="10" fill={hairColor} opacity="0.9" />
          </g>
        );

      case 'short':
        return (
          <g>
            {/* Scalp cap - overlaps head top */}
            <ellipse cx="50" cy="28" rx="28" ry="18" fill={hairColor} opacity="0.95" />

            {/* Dense textured strands */}
            {Array.from({ length: 160 }, (_, i) => {
              const col = i % 16;
              const row = Math.floor(i / 16);
              const x = 22 + col * 3.5 + (Math.sin(i * 1.1) * 1.5);
              const startY = 18 + row * 2.5;
              const endY = startY + 8 + (Math.sin(i * 0.7) * 2.5);
              return (
                <path
                  key={`strand-${i}`}
                  d={`M${x},${startY} Q${x + (Math.sin(i) * 1.2)},${(startY + endY) / 2} ${x},${endY}`}
                  stroke={i % 11 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.1 + (i % 3) * 0.25}
                  fill="none"
                  opacity={0.72 + (i % 3) * 0.08}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="40" rx="5" ry="14" fill={hairColorDark} opacity="0.8" />
            <ellipse cx="78" cy="40" rx="5" ry="14" fill={hairColorDark} opacity="0.8" />
          </g>
        );

      case 'wavy':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} opacity="0.95" />

            {/* Dense wavy texture */}
            {Array.from({ length: 120 }, (_, i) => {
              const col = i % 12;
              const row = Math.floor(i / 12);
              const x = 22 + col * 4.6;
              const startY = 18 + row * 4;
              const wave1Y = startY + 4;
              const wave2Y = startY + 8;
              const endY = startY + 12;
              const waveX1 = x + 1.8 + Math.sin(col * 0.5) * 1.5;
              const waveX2 = x - 1.8 + Math.cos(col * 0.7) * 1.5;
              return (
                <path
                  key={`wave-${i}`}
                  d={`M${x},${startY} Q${waveX1},${wave1Y} ${x},${wave2Y} Q${waveX2},${(wave2Y + endY) / 2} ${x},${endY}`}
                  stroke={i % 10 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.1 + (i % 3) * 0.2}
                  fill="none"
                  opacity={0.7 + (i % 4) * 0.07}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="38" rx="5" ry="16" fill={hairColorDark} opacity="0.8" />
            <ellipse cx="78" cy="38" rx="5" ry="16" fill={hairColorDark} opacity="0.8" />
          </g>
        );

      case 'sleek':
        return (
          <g>
            {/* Sleek male hair - short, slicked back */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} />

            {/* Slicked back solid sections */}
            <path d="M22 24 Q20 32 22 42 L26 44 Q28 34 26 26 Z" fill={hairColor} />
            <path d="M26 24 Q24 34 26 46 L30 48 Q32 36 30 26 Z" fill={hairColor} />
            <path d="M30 24 Q28 36 30 50 L34 52 Q36 38 34 26 Z" fill={hairColor} />
            <path d="M34 24 Q32 38 34 54 L38 56 Q40 40 38 26 Z" fill={hairColor} />
            <path d="M38 24 Q36 40 38 56 L42 58 Q44 42 42 26 Z" fill={hairColor} />
            <path d="M42 22 Q40 42 42 58 L46 60 Q48 44 46 24 Z" fill={hairColor} />
            <path d="M46 20 Q44 44 46 60 L54 60 Q56 44 54 20 Z" fill={hairColor} />
            <path d="M54 22 Q52 42 54 58 L58 60 Q60 44 58 24 Z" fill={hairColor} />
            <path d="M58 24 Q56 40 58 56 L62 58 Q64 42 62 26 Z" fill={hairColor} />
            <path d="M62 24 Q60 38 62 54 L66 56 Q68 40 66 26 Z" fill={hairColor} />
            <path d="M66 24 Q64 36 66 50 L70 52 Q72 38 70 26 Z" fill={hairColor} />
            <path d="M70 24 Q68 34 70 46 L74 48 Q76 36 74 26 Z" fill={hairColor} />
            <path d="M74 24 Q72 32 74 42 L78 44 Q80 34 78 26 Z" fill={hairColor} />

            {/* Subtle shine highlights */}
            {Array.from({ length: 12 }, (_, i) => {
              const x = 24 + i * 4.5;
              return (
                <path
                  key={`shine-${i}`}
                  d={`M${x},26 Q${x},38 ${x},50 Q${x},56 ${x},60`}
                  stroke={hairHighlight}
                  strokeWidth={1}
                  fill="none"
                  opacity={0.25}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="38" rx="5" ry="12" fill={hairColor} />
            <ellipse cx="78" cy="38" rx="5" ry="12" fill={hairColor} />
          </g>
        );

      case 'afro':
        return (
          <g>
            {/* Afro - solid base */}
            <ellipse cx="50" cy="28" rx="28" ry="18" fill={hairColor} />

            {/* Base volume */}
            <ellipse cx="50" cy="28" rx="40" ry="34" fill={hairColor} opacity="0.85" />

            {/* Dense afro texture - multiple layers */}
            {Array.from({ length: 450 }, (_, i) => {
              const angle = ((i % 45) / 45) * Math.PI * 2;
              const layer = Math.floor(i / 45);
              const r = 16 + layer * 4;
              const x = 50 + Math.cos(angle) * r + (Math.sin(i * 2.1) * 1.6);
              const y = 28 + Math.sin(angle) * r * 0.88 + (Math.cos(i * 2.5) * 1.6);

              // Check if within the afro boundary
              const distFromCenter = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(y - 28, 2));
              if (distFromCenter > 38) return null;

              return (
                <circle
                  key={`afro-${i}`}
                  cx={x}
                  cy={y}
                  r={1.2 + (i % 4) * 0.3}
                  fill={i % 13 === 0 ? hairHighlight : hairColor}
                  opacity={0.65 + (i % 4) * 0.08}
                />
              );
            })}

            {/* Additional density fills */}
            {Array.from({ length: 180 }, (_, i) => {
              const angle = (i / 180) * Math.PI * 2;
              const layer = Math.floor(i / 45);
              const r = 14 + layer * 5.5;
              const x = 50 + Math.cos(angle) * r + (Math.sin(i * 3) * 2);
              const y = 28 + Math.sin(angle) * r * 0.85 + (Math.cos(i * 3) * 2);

              return (
                <circle
                  key={`fill-${i}`}
                  cx={x}
                  cy={y}
                  r={1.6 + (i % 3) * 0.35}
                  fill={i % 9 === 0 ? hairHighlight : hairColor}
                  opacity={0.7}
                />
              );
            })}
          </g>
        );

      case 'locs':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} opacity="0.95" />

            {/* Dense locs for male (shorter) */}
            {Array.from({ length: 9 }, (_, i) => {
              const x = 22 + i * 6.2;
              const curveMod = (i - 4) * 2.5;
              return (
                <g key={`loc-${i}`}>
                  {/* Main loc body - starts from scalp */}
                  <path
                    d={`M${x},24 Q${x + curveMod},52 ${x + curveMod * 0.6},76 Q${x + curveMod * 1.15},100 ${x + curveMod * 0.3},124`}
                    stroke={hairColor}
                    strokeWidth={6}
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.95"
                  />

                  {/* Loc texture segments */}
                  {Array.from({ length: 12 }, (_, j) => {
                    const segY = 32 + j * 8;
                    const segX = x + curveMod * (j / 12);
                    return (
                      <g key={`seg-${j}`}>
                        <path
                          d={`M${segX - 2.4},${segY} Q${segX},${segY + 1.3} ${segX + 2.4},${segY}`}
                          stroke={hairColorDark}
                          strokeWidth={1.3}
                          fill="none"
                          opacity={0.75}
                        />
                        <path
                          d={`M${segX - 1.9},${segY + 0.4} L${segX + 1.9},${segY + 0.4}`}
                          stroke={hairHighlight}
                          strokeWidth={0.7}
                          fill="none"
                          opacity={0.6}
                        />
                        <ellipse
                          cx={segX}
                          cy={segY + 0.6}
                          rx="2.2"
                          ry="1.1"
                          fill={hairColorDark}
                          opacity="0.4"
                        />
                      </g>
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
            {/* Fade - longer top, faded sides */}
            {/* Top section - solid and textured */}
            <ellipse cx="50" cy="24" rx="24" ry="14" fill={hairColor} />

            {/* Top hair texture - longer strands */}
            {Array.from({ length: 100 }, (_, i) => {
              const col = i % 10;
              const row = Math.floor(i / 10);
              const x = 28 + col * 4.4;
              const startY = 16 + row * 2;
              const length = 8 + Math.sin(i * 0.5) * 2;
              return (
                <path
                  key={`top-${i}`}
                  d={`M${x},${startY} Q${x + Math.sin(i) * 1.5},${startY + length * 0.5} ${x},${startY + length}`}
                  stroke={i % 11 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.2}
                  fill="none"
                  opacity={0.75}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Faded sides - gradient effect with decreasing density */}
            {/* Layer 1 - highest, most visible */}
            {Array.from({ length: 140 }, (_, i) => {
              const x = 22 + (i % 14) * 4;
              const y = 32 + Math.floor(i / 14) * 2;
              if (x > 28 && x < 72) return null; // Skip center
              return (
                <circle
                  key={`fade1-${i}`}
                  cx={x}
                  cy={y}
                  r={0.6}
                  fill={hairColor}
                  opacity={0.5}
                />
              );
            })}

            {/* Layer 2 - mid fade */}
            {Array.from({ length: 100 }, (_, i) => {
              const x = 20 + (i % 10) * 6;
              const y = 38 + Math.floor(i / 10) * 2.5;
              if (x > 26 && x < 74) return null;
              return (
                <circle
                  key={`fade2-${i}`}
                  cx={x}
                  cy={y}
                  r={0.5}
                  fill={hairColor}
                  opacity={0.35}
                />
              );
            })}

            {/* Layer 3 - lowest fade */}
            {Array.from({ length: 60 }, (_, i) => {
              const x = 18 + (i % 6) * 14;
              const y = 42 + Math.floor(i / 6) * 2.5;
              if (x > 24 && x < 76) return null;
              return (
                <circle
                  key={`fade3-${i}`}
                  cx={x}
                  cy={y}
                  r={0.4}
                  fill={hairColor}
                  opacity={0.2}
                />
              );
            })}

            {/* Temple transitions */}
            <ellipse cx="24" cy="36" rx="3" ry="8" fill={hairColor} opacity="0.6" />
            <ellipse cx="76" cy="36" rx="3" ry="8" fill={hairColor} opacity="0.6" />
          </g>
        );

      default: return null;
    }
  };

  const renderFemaleHair = () => {
    switch(hairStyle) {
      case 'sleek':
        return (
          <g>
            {/* Scalp cap - solid base */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} />

            {/* Main hair body - SOLID filled shapes, no transparency */}
            {/* Left side solid mass */}
            <path d="M22 24 Q18 36 16 52 Q14 72 16 92 L20 96 Q22 76 24 56 Q26 36 22 24 Z" fill={hairColor} />
            <path d="M26 24 Q22 40 20 60 Q18 80 20 100 L24 102 Q26 82 28 62 Q30 40 26 24 Z" fill={hairColor} />
            <path d="M30 24 Q26 44 24 68 Q22 88 24 106 L28 108 Q30 88 32 68 Q34 44 30 24 Z" fill={hairColor} />
            <path d="M34 24 Q30 48 28 76 Q26 96 28 112 L32 114 Q34 94 36 74 Q38 46 34 24 Z" fill={hairColor} />
            <path d="M38 24 Q34 50 32 80 Q30 100 32 116 L36 118 Q38 98 40 78 Q42 48 38 24 Z" fill={hairColor} />
            <path d="M42 24 Q38 52 36 84 Q34 104 36 118 L40 120 Q42 100 44 80 Q46 50 42 24 Z" fill={hairColor} />
            <path d="M46 24 Q42 54 40 88 Q38 108 40 120 L44 122 Q46 102 48 82 Q50 52 46 24 Z" fill={hairColor} />

            {/* Right side solid mass */}
            <path d="M78 24 Q82 36 84 52 Q86 72 84 92 L80 96 Q78 76 76 56 Q74 36 78 24 Z" fill={hairColor} />
            <path d="M74 24 Q78 40 80 60 Q82 80 80 100 L76 102 Q74 82 72 62 Q70 40 74 24 Z" fill={hairColor} />
            <path d="M70 24 Q74 44 76 68 Q78 88 76 106 L72 108 Q70 88 68 68 Q66 44 70 24 Z" fill={hairColor} />
            <path d="M66 24 Q70 48 72 76 Q74 96 72 112 L68 114 Q66 94 64 74 Q62 46 66 24 Z" fill={hairColor} />
            <path d="M62 24 Q66 50 68 80 Q70 100 68 116 L64 118 Q62 98 60 78 Q58 48 62 24 Z" fill={hairColor} />
            <path d="M58 24 Q62 52 64 84 Q66 104 64 118 L60 120 Q58 100 56 80 Q54 50 58 24 Z" fill={hairColor} />
            <path d="M54 24 Q58 54 60 88 Q62 108 60 120 L56 122 Q54 102 52 82 Q50 52 54 24 Z" fill={hairColor} />

            {/* Center front mass */}
            <path d="M50 20 Q48 52 46 88 Q44 108 46 120 L54 120 Q56 108 54 88 Q52 52 50 20 Z" fill={hairColor} />

            {/* Subtle highlights - ON TOP of solid hair */}
            {Array.from({ length: 15 }, (_, i) => {
              const x = 18 + i * 4.5;
              return (
                <path
                  key={`highlight-${i}`}
                  d={`M${x},28 Q${x},60 ${x - 1},92 Q${x - 2},110 ${x - 1},120`}
                  stroke={hairHighlight}
                  strokeWidth={1.5}
                  fill="none"
                  opacity={0.3}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage - solid */}
            <ellipse cx="22" cy="44" rx="7" ry="18" fill={hairColor} />
            <ellipse cx="78" cy="44" rx="7" ry="18" fill={hairColor} />
          </g>
        );

      case 'wavy':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} />

            {/* Wavy hair - solid sections with wave contours */}
            {/* Left side waves */}
            <path d="M22 24 Q16 34 18 48 Q20 62 16 76 Q14 90 18 104 L22 108 Q26 94 24 80 Q26 66 24 52 Q26 38 22 24 Z" fill={hairColor} />
            <path d="M26 24 Q20 36 22 52 Q24 68 20 84 Q18 100 22 116 L26 118 Q30 102 28 86 Q30 70 28 54 Q30 38 26 24 Z" fill={hairColor} />
            <path d="M30 24 Q24 40 26 58 Q28 76 24 94 Q22 110 26 122 L30 124 Q34 108 32 92 Q34 74 32 56 Q34 38 30 24 Z" fill={hairColor} />
            <path d="M34 24 Q28 44 30 64 Q32 84 28 104 Q26 118 30 128 L34 130 Q38 114 36 96 Q38 76 36 58 Q38 40 34 24 Z" fill={hairColor} />
            <path d="M38 24 Q32 48 34 70 Q36 92 32 112 Q30 124 34 132 L38 134 Q42 118 40 100 Q42 78 40 60 Q42 42 38 24 Z" fill={hairColor} />
            <path d="M42 24 Q36 50 38 74 Q40 98 36 118 Q34 130 38 138 L42 140 Q46 122 44 104 Q46 80 44 62 Q46 44 42 24 Z" fill={hairColor} />
            <path d="M46 24 Q40 52 42 78 Q44 104 40 124 Q38 136 42 142 L46 144 Q50 126 48 108 Q50 82 48 64 Q50 46 46 24 Z" fill={hairColor} />

            {/* Right side waves */}
            <path d="M78 24 Q84 34 82 48 Q80 62 84 76 Q86 90 82 104 L78 108 Q74 94 76 80 Q74 66 76 52 Q74 38 78 24 Z" fill={hairColor} />
            <path d="M74 24 Q80 36 78 52 Q76 68 80 84 Q82 100 78 116 L74 118 Q70 102 72 86 Q70 70 72 54 Q70 38 74 24 Z" fill={hairColor} />
            <path d="M70 24 Q76 40 74 58 Q72 76 76 94 Q78 110 74 122 L70 124 Q66 108 68 92 Q66 74 68 56 Q66 38 70 24 Z" fill={hairColor} />
            <path d="M66 24 Q72 44 70 64 Q68 84 72 104 Q74 118 70 128 L66 130 Q62 114 64 96 Q62 76 64 58 Q62 40 66 24 Z" fill={hairColor} />
            <path d="M62 24 Q68 48 66 70 Q64 92 68 112 Q70 124 66 132 L62 134 Q58 118 60 100 Q58 78 60 60 Q58 42 62 24 Z" fill={hairColor} />
            <path d="M58 24 Q64 50 62 74 Q60 98 64 118 Q66 130 62 138 L58 140 Q54 122 56 104 Q54 80 56 62 Q54 44 58 24 Z" fill={hairColor} />
            <path d="M54 24 Q60 52 58 78 Q56 104 60 124 Q62 136 58 142 L54 144 Q50 126 52 108 Q50 82 52 64 Q50 46 54 24 Z" fill={hairColor} />

            {/* Center section */}
            <path d="M50 20 Q46 54 48 82 Q50 110 46 134 L54 134 Q50 110 52 82 Q54 54 50 20 Z" fill={hairColor} />

            {/* Subtle wave highlights */}
            {Array.from({ length: 18 }, (_, i) => {
              const x = 18 + i * 4.6;
              return (
                <path
                  key={`highlight-${i}`}
                  d={`M${x},28 Q${x + 2},48 ${x},68 Q${x - 2},88 ${x},108 Q${x + 1},120 ${x},132`}
                  stroke={hairHighlight}
                  strokeWidth={1.2}
                  fill="none"
                  opacity={0.25}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="44" rx="7" ry="18" fill={hairColor} />
            <ellipse cx="78" cy="44" rx="7" ry="18" fill={hairColor} />
          </g>
        );

      case 'curly':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} />

            {/* Curly hair flowing DOWN - not outward like afro */}
            {/* Main volume going downward */}
            <path d="M22 24 Q16 36 14 52 Q12 76 16 100 Q20 116 26 120 L34 118 Q28 100 26 80 Q26 56 30 36 Q28 28 22 24 Z" fill={hairColor} opacity="0.9" />
            <path d="M78 24 Q84 36 86 52 Q88 76 84 100 Q80 116 74 120 L66 118 Q72 100 74 80 Q74 56 70 36 Q72 28 78 24 Z" fill={hairColor} opacity="0.9" />
            <path d="M30 24 Q26 40 24 60 Q22 84 26 108 L32 114 Q36 92 38 68 Q40 44 36 26 Q34 24 30 24 Z" fill={hairColor} opacity="0.85" />
            <path d="M70 24 Q74 40 76 60 Q78 84 74 108 L68 114 Q64 92 62 68 Q60 44 64 26 Q66 24 70 24 Z" fill={hairColor} opacity="0.85" />
            <path d="M38 22 Q34 44 32 72 Q30 96 34 118 L42 120 Q46 96 48 72 Q50 48 46 24 Q42 22 38 22 Z" fill={hairColor} />
            <path d="M62 22 Q66 44 68 72 Q70 96 66 118 L58 120 Q54 96 52 72 Q50 48 54 24 Q58 22 62 22 Z" fill={hairColor} />
            <path d="M46 20 Q44 48 42 76 Q40 100 42 120 L58 120 Q60 100 58 76 Q56 48 54 20 Z" fill={hairColor} />

            {/* Curly texture ON TOP - flowing downward */}
            {Array.from({ length: 140 }, (_, i) => {
              const col = i % 10;
              const row = Math.floor(i / 10);
              const x = 20 + col * 6;
              const y = 28 + row * 7;
              const r = 1.8 + (i % 4) * 0.4;

              // Only show curls within hair bounds
              if (x < 18 || x > 82 || y > 115) return null;

              return (
                <g key={`curl-${i}`}>
                  <circle cx={x} cy={y} r={r} fill="none" stroke={hairColorDark} strokeWidth={0.9} opacity={0.6} />
                  <circle cx={x - 0.3} cy={y - 0.3} r={r - 0.8} fill={i % 9 === 0 ? hairHighlight : hairColor} opacity={0.5} />
                </g>
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="44" rx="7" ry="18" fill={hairColor} />
            <ellipse cx="78" cy="44" rx="7" ry="18" fill={hairColor} />
          </g>
        );

      case 'braids':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} opacity="0.95" />

            {/* Dense braided strands - start from scalp */}
            {Array.from({ length: 10 }, (_, i) => {
              const x = 18 + i * 6.5;
              const curveMod = (i - 4.5) * 2.8;
              return (
                <g key={`braid-${i}`}>
                  {/* Main braid body */}
                  <path
                    d={`M${x},26 Q${x + curveMod},60 ${x + curveMod * 0.75},88 Q${x + curveMod * 1.05},116 ${x + curveMod * 0.6},144`}
                    stroke={hairColor}
                    strokeWidth={7}
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.95"
                  />
                  {/* Braid texture details */}
                  {Array.from({ length: 14 }, (_, j) => {
                    const segY = 32 + j * 8;
                    const segX = x + curveMod * (j / 14);
                    const offset = j % 2 === 0 ? -3 : 3;
                    return (
                      <g key={`seg-${j}`}>
                        <path
                          d={`M${segX + offset},${segY} Q${segX},${segY + 1.2} ${segX - offset},${segY + 2.5}`}
                          stroke={hairColorDark}
                          strokeWidth={2}
                          fill="none"
                          opacity={0.8}
                          strokeLinecap="round"
                        />
                        <path
                          d={`M${segX + offset * 0.7},${segY + 0.4} L${segX - offset * 0.7},${segY + 2.1}`}
                          stroke={hairHighlight}
                          strokeWidth={0.9}
                          opacity={0.7}
                          strokeLinecap="round"
                        />
                        <ellipse
                          cx={segX + offset * 0.5}
                          cy={segY + 0.8}
                          rx="1.8"
                          ry="1.2"
                          fill={hairColorDark}
                          opacity="0.5"
                        />
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
            {/* Scalp cap - full head coverage */}
            <ellipse cx="50" cy="32" rx="28" ry="20" fill={hairColor} opacity="0.95" />
            <path d="M22 28 Q50 20 78 28 Q82 40 78 52 Q50 48 22 52 Q18 40 22 28 Z" fill={hairColor} opacity="0.9" />

            {/* Dense front texture */}
            {Array.from({ length: 90 }, (_, i) => {
              const x = 26 + (i % 9) * 5;
              const y = 26 + Math.floor(i / 9) * 3.2;
              return (
                <path
                  key={`front-${i}`}
                  d={`M${x},${y} Q${x + 0.8},${y + 2.5} ${x},${y + 5}`}
                  stroke={i % 11 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.2}
                  opacity={0.75}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Ponytail holder */}
            <ellipse cx="82" cy="42" rx="7" ry="10" fill="#1a1a1a" opacity="0.5" />
            <ellipse cx="82" cy="42" rx="5.5" ry="8" fill="#2a2a2a" opacity="0.7" />

            {/* Ponytail base volume */}
            <path d="M82 34 Q102 40 108 68 Q112 96 100 130 Q98 92 100 68 Q96 48 82 44Z" fill={hairColor} opacity="0.8" />

            {/* Dense ponytail strands */}
            {Array.from({ length: 80 }, (_, i) => {
              const baseX = 84 + (i % 8) * 3;
              const startY = 40 + Math.floor(i / 8) * 9;
              const endY = startY + 22;
              const curve = 6 + Math.sin(i * 0.8) * 4;
              return (
                <path
                  key={`tail-${i}`}
                  d={`M${baseX},${startY}
                      Q${baseX + curve},${startY + 8} ${baseX + curve * 0.8},${startY + 16}
                      Q${baseX + curve * 0.6},${startY + 20} ${baseX + curve * 0.4},${endY}`}
                  stroke={i % 9 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.6 + (i % 3) * 0.4}
                  fill="none"
                  opacity={0.72 + (i % 3) * 0.08}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="48" rx="6" ry="14" fill={hairColorDark} opacity="0.8" />
          </g>
        );

      case 'afro':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="30" rx="28" ry="18" fill={hairColor} opacity="0.95" />

            {/* Base volume */}
            <ellipse cx="50" cy="30" rx="44" ry="38" fill={hairColor} opacity="0.8" />

            {/* Dense afro texture - multiple layers */}
            {Array.from({ length: 500 }, (_, i) => {
              const angle = ((i % 50) / 50) * Math.PI * 2;
              const layer = Math.floor(i / 50);
              const r = 18 + layer * 4.5;
              const x = 50 + Math.cos(angle) * r + (Math.sin(i * 2.1) * 1.8);
              const y = 30 + Math.sin(angle) * r * 0.92 + (Math.cos(i * 2.5) * 1.8);

              // Check if within the afro boundary
              const distFromCenter = Math.sqrt(Math.pow(x - 50, 2) + Math.pow(y - 30, 2));
              if (distFromCenter > 42) return null;

              return (
                <circle
                  key={`afro-${i}`}
                  cx={x}
                  cy={y}
                  r={1.3 + (i % 4) * 0.35}
                  fill={i % 13 === 0 ? hairHighlight : hairColor}
                  opacity={0.65 + (i % 4) * 0.08}
                />
              );
            })}

            {/* Additional density fills */}
            {Array.from({ length: 200 }, (_, i) => {
              const angle = (i / 200) * Math.PI * 2;
              const layer = Math.floor(i / 50);
              const r = 16 + layer * 6;
              const x = 50 + Math.cos(angle) * r + (Math.random() - 0.5) * 3;
              const y = 30 + Math.sin(angle) * r * 0.9 + (Math.random() - 0.5) * 3;

              return (
                <circle
                  key={`fill-${i}`}
                  cx={x}
                  cy={y}
                  r={1.8 + (i % 3) * 0.4}
                  fill={i % 9 === 0 ? hairHighlight : hairColor}
                  opacity={0.7}
                />
              );
            })}
          </g>
        );

      case 'locs':
        return (
          <g>
            {/* Scalp cap */}
            <ellipse cx="50" cy="26" rx="28" ry="16" fill={hairColor} opacity="0.95" />

            {/* Dense locs - start from scalp */}
            {Array.from({ length: 11 }, (_, i) => {
              const x = 16 + i * 6.2;
              const curveMod = (i - 5) * 3.2;
              return (
                <g key={`loc-${i}`}>
                  {/* Main loc body */}
                  <path
                    d={`M${x},26 Q${x + curveMod},66 ${x + curveMod * 0.65},98 Q${x + curveMod * 1.15},130 ${x + curveMod * 0.45},162`}
                    stroke={hairColor}
                    strokeWidth={7}
                    fill="none"
                    strokeLinecap="round"
                    opacity="0.95"
                  />

                  {/* Loc texture segments */}
                  {Array.from({ length: 16 }, (_, j) => {
                    const segY = 34 + j * 8;
                    const segX = x + curveMod * (j / 16);
                    return (
                      <g key={`seg-${j}`}>
                        <path
                          d={`M${segX - 2.8},${segY} Q${segX},${segY + 1.5} ${segX + 2.8},${segY}`}
                          stroke={hairColorDark}
                          strokeWidth={1.4}
                          fill="none"
                          opacity={0.75}
                        />
                        <path
                          d={`M${segX - 2.2},${segY + 0.4} L${segX + 2.2},${segY + 0.4}`}
                          stroke={hairHighlight}
                          strokeWidth={0.8}
                          fill="none"
                          opacity={0.6}
                        />
                        <ellipse
                          cx={segX}
                          cy={segY + 0.7}
                          rx="2.5"
                          ry="1.3"
                          fill={hairColorDark}
                          opacity="0.4"
                        />
                      </g>
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
            {/* Scalp cap - head coverage */}
            <ellipse cx="50" cy="32" rx="28" ry="20" fill={hairColor} opacity="0.95" />
            <path d="M22 28 Q50 22 78 28 Q82 40 78 52 Q50 48 22 52 Q18 40 22 28 Z" fill={hairColor} opacity="0.9" />

            {/* Bun base volume */}
            <ellipse cx="50" cy="2" rx="18" ry="16" fill={hairColor} opacity="0.9" />
            <ellipse cx="50" cy="1" rx="14" ry="12" fill={hairColorDark} opacity="0.5" />

            {/* Dense bun texture - spiral pattern */}
            {Array.from({ length: 150 }, (_, i) => {
              const angle = (i / 150) * Math.PI * 4;
              const layer = Math.floor(i / 30);
              const r = 3 + layer * 2.5;
              const x = 50 + Math.cos(angle) * r;
              const y = 2 + Math.sin(angle) * r * 0.88;

              if (r > 15) return null;

              if (i % 4 === 0) {
                return (
                  <path
                    key={`bun-${i}`}
                    d={`M50,2 L${x},${y}`}
                    stroke={i % 11 === 0 ? hairHighlight : hairColor}
                    strokeWidth={0.9}
                    opacity={0.6}
                    strokeLinecap="round"
                  />
                );
              }

              return (
                <circle
                  key={`bun-${i}`}
                  cx={x}
                  cy={y}
                  r={1.2 + (i % 3) * 0.3}
                  fill={i % 9 === 0 ? hairHighlight : hairColor}
                  opacity={0.75}
                />
              );
            })}

            {/* Bun outline definition */}
            <ellipse cx="50" cy="2" rx="17" ry="15" fill="none" stroke={hairColorDark} strokeWidth="0.8" opacity="0.4" />

            {/* Dense front hair texture */}
            {Array.from({ length: 80 }, (_, i) => {
              const x = 26 + (i % 10) * 4.8;
              const y = 28 + Math.floor(i / 10) * 3.8;
              return (
                <path
                  key={`front-${i}`}
                  d={`M${x},${y} Q${x + 0.9},${y + 3} ${x},${y + 6}`}
                  stroke={i % 10 === 0 ? hairHighlight : hairColor}
                  strokeWidth={1.1}
                  opacity={0.75}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Temple coverage */}
            <ellipse cx="22" cy="46" rx="5" ry="14" fill={hairColorDark} opacity="0.7" />
            <ellipse cx="78" cy="46" rx="5" ry="14" fill={hairColorDark} opacity="0.7" />
          </g>
        );

      default: return null;
    }
  };

  const lipShapes: Record<string, { top: string; bottom: string }> = {
    natural: {
      top: "M42 76 Q46 73 50 74 Q54 73 58 76",
      bottom: "M42 76 Q50 82 58 76"
    },
    full: {
      top: "M40 76 Q45 72 50 73 Q55 72 60 76",
      bottom: "M40 76 Q50 85 60 76"
    },
    thin: {
      top: "M43 76 Q46 74 50 75 Q54 74 57 76",
      bottom: "M43 76 Q50 79 57 76"
    },
    heart: {
      top: "M42 76 Q46 71 50 74 Q54 71 58 76",
      bottom: "M42 76 Q50 82 58 76"
    }
  };

  const renderFacialHair = () => {
    if (gender !== 'male' || !facialHair || facialHair === 'none') return null;

    const fhColor = hairColor;

    switch(facialHair) {
      case 'stubble':
        return (
          <g>
            {/* Stubble - dots following face contour */}
            {Array.from({ length: 160 }, (_, i) => {
              const col = i % 16;
              const row = Math.floor(i / 16);
              const x = 28 + col * 3;
              const y = 64 + row * 4;

              // Skip areas outside face contour
              if (y > 78 && (x < 42 || x > 58)) return null;
              if (y > 88 && (x < 44 || x > 56)) return null;
              if (y > 96) return null;

              return <circle key={i} cx={x} cy={y} r="0.5" fill={fhColor} opacity={0.35 + (i % 3) * 0.05} />;
            })}
          </g>
        );

      case 'beard':
        return (
          <g>
            {/* Beard - solid shapes wrapping face contour */}
            {/* Jaw line coverage - follows face curve */}
            <path d="M28 64 Q26 72 26 80 Q26 88 30 96 Q36 102 42 106 Q46 108 50 108 Q54 108 58 106 Q64 102 70 96 Q74 88 74 80 Q74 72 72 64"
              fill={fhColor} />

            {/* Inner layer for depth */}
            <path d="M32 68 Q30 74 30 82 Q30 90 34 96 Q38 100 44 102 Q47 103 50 103 Q53 103 56 102 Q62 100 66 96 Q70 90 70 82 Q70 74 68 68"
              fill={fhColor} opacity="0.7" />

            {/* Texture details - subtle hair lines */}
            {Array.from({ length: 40 }, (_, i) => {
              const col = i % 8;
              const row = Math.floor(i / 8);
              const x = 32 + col * 4.5;
              const y = 70 + row * 6;
              const curvature = Math.abs(x - 50) * 0.3;
              return (
                <path
                  key={i}
                  d={`M${x},${y} Q${x},${y + 2 + curvature} ${x + (x < 50 ? -0.5 : 0.5)},${y + 4 + curvature * 0.8}`}
                  stroke={hairColorDark}
                  strokeWidth={0.6}
                  opacity={0.5}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Sideburn connections */}
            <ellipse cx="28" cy="58" rx="3" ry="8" fill={fhColor} />
            <ellipse cx="72" cy="58" rx="3" ry="8" fill={fhColor} />
          </g>
        );

      case 'goatee':
        return (
          <g>
            {/* Goatee - solid chin coverage wrapping around */}
            <path d="M42 78 Q42 84 44 90 Q46 96 50 100 Q54 96 56 90 Q58 84 58 78 Z" fill={fhColor} />
            <ellipse cx="50" cy="92" rx="7" ry="9" fill={fhColor} opacity="0.85" />

            {/* Texture details */}
            {Array.from({ length: 16 }, (_, i) => {
              const x = 44 + (i % 4) * 3;
              const y = 80 + Math.floor(i / 4) * 4;
              return (
                <path
                  key={i}
                  d={`M${x},${y} Q${x},${y + 2} ${x + (x < 50 ? -0.3 : 0.3)},${y + 3.5}`}
                  stroke={hairColorDark}
                  strokeWidth={0.5}
                  opacity={0.5}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );

      case 'mustache':
        return (
          <g>
            {/* Mustache - solid shape wrapping upper lip */}
            <path d="M36 70 Q40 68 44 69 Q48 70 50 71 Q52 70 56 69 Q60 68 64 70 Q62 74 58 75 Q54 76 50 75 Q46 76 42 75 Q38 74 36 70 Z"
              fill={fhColor} />

            {/* Upper mustache layer */}
            <path d="M38 71 Q42 70 46 70 Q48 71 50 72 Q52 71 54 70 Q58 70 62 71 Q60 73 56 73 Q54 73 50 73 Q46 73 44 73 Q40 73 38 71 Z"
              fill={fhColor} opacity="0.7" />

            {/* Subtle texture */}
            {Array.from({ length: 12 }, (_, i) => {
              const x = 40 + i * 1.8;
              return (
                <path
                  key={i}
                  d={`M${x},71 L${x},73`}
                  stroke={hairColorDark}
                  strokeWidth={0.5}
                  opacity={0.4}
                  strokeLinecap="round"
                />
              );
            })}
          </g>
        );

      default: return null;
    }
  };

  const renderFreckles = () => {
    if (!freckles || freckles === 'none') return null;

    const freckleColor = '#00000025';

    if (freckles === 'beauty_mark') {
      return <circle cx="62" cy="68" r="1.5" fill="#00000040" />;
    }

    const count = freckles === 'light' ? 12 : 25;
    const basePositions: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < count/2; i++) {
      basePositions.push({
        x: 28 + (i % 4) * 3 + (i % 2) * 1.5,
        y: 54 + Math.floor(i / 4) * 3
      });
    }

    for (let i = 0; i < count/2; i++) {
      basePositions.push({
        x: 60 + (i % 4) * 3 + (i % 2) * 1.5,
        y: 54 + Math.floor(i / 4) * 3
      });
    }

    for (let i = 0; i < Math.floor(count/4); i++) {
      basePositions.push({
        x: 46 + (i % 2) * 4,
        y: 56 + Math.floor(i / 2) * 3
      });
    }

    return (
      <g fill={freckleColor}>
        {basePositions.map((pos, i) => (
          <circle key={i} cx={pos.x} cy={pos.y} r={0.8 + (i % 3) * 0.2} />
        ))}
      </g>
    );
  };

  const renderGlasses = () => {
    if (!glasses || glasses === 'none') return null;

    const frameColor = '#1a1a1a';

    switch(glasses) {
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
            <rect x="29" y="45" width="16" height="12" rx="1" fill="white" opacity="0.05" />
            <rect x="55" y="45" width="16" height="12" rx="1" fill="white" opacity="0.05" />
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
    const metalShine = '#ffffff';

    switch(earrings) {
      case 'studs':
        return (
          <g>
            <circle cx="22" cy="56" r="2.5" fill={metalColor} />
            <circle cx="78" cy="56" r="2.5" fill={metalColor} />
            <circle cx="21" cy="55" r="1" fill={metalShine} opacity="0.6" />
            <circle cx="77" cy="55" r="1" fill={metalShine} opacity="0.6" />
          </g>
        );

      case 'hoops':
        return (
          <g>
            {/* Left hoop - starts from earlobe */}
            <circle cx="22" cy="56" r="1.2" fill={metalColor} />
            <ellipse cx="22" cy="61" rx="3.5" ry="5" fill="none" stroke={metalColor} strokeWidth="1.5" />
            <path d="M20 58 L20 59" stroke={metalShine} strokeWidth="0.8" opacity="0.6" />

            {/* Right hoop - starts from earlobe */}
            <circle cx="78" cy="56" r="1.2" fill={metalColor} />
            <ellipse cx="78" cy="61" rx="3.5" ry="5" fill="none" stroke={metalColor} strokeWidth="1.5" />
            <path d="M76 58 L76 59" stroke={metalShine} strokeWidth="0.8" opacity="0.6" />
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
            <circle cx="21" cy="73" r="1" fill={metalShine} opacity="0.5" />
            <circle cx="77" cy="73" r="1" fill={metalShine} opacity="0.5" />
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

    switch(nosePiercing) {
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

    switch(lipPiercing) {
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
            <circle cx="41.5" cy="79.5" r="0.5" fill="white" opacity="0.6" />
            <circle cx="57.5" cy="79.5" r="0.5" fill="white" opacity="0.6" />
          </g>
        );

      default: return null;
    }
  };

  const renderNecklace = () => {
    if (!necklace || necklace === 'none') return null;

    switch(necklace) {
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
            {/* Choker sits tight around the neck */}
            <path d="M28 86 Q35 88 50 89 Q65 88 72 86" fill="none" stroke={necklaceColor} strokeWidth="4" />
            <path d="M28 86 Q35 88 50 89 Q65 88 72 86" fill="none" stroke={necklaceColor} strokeWidth="2.5" opacity="0.8" />
          </g>
        );

      case 'pendant':
        return (
          <g>
            {/* Chain around neck */}
            <path d="M32 90 Q40 96 50 98 Q60 96 68 90" fill="none" stroke={necklaceColor} strokeWidth="1" />
            {/* Pendant hanging down */}
            <path d="M47 100 L50 108 L53 100 Z" fill={necklaceColor} />
            <path d="M48.5 102 L50 106 L51.5 102" fill="white" opacity="0.3" />
          </g>
        );

      case 'pearls':
        return (
          <g>
            {/* Pearl necklace sits on collarbone */}
            <path d="M30 88 Q40 94 50 96 Q60 94 70 88" fill="none" stroke={necklaceColor} strokeWidth="0.5" opacity="0.3" />
            {Array.from({ length: 11 }, (_, i) => {
              const t = i / 10;
              const x = 30 + t * 40;
              const y = 88 + Math.sin(t * Math.PI) * 8;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r="2.5" fill={necklaceColor} />
                  <circle cx={x-0.6} cy={y-0.6} r="0.8" fill="white" opacity="0.7" />
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
      natural: { left: "M29 42 Q38 38 46 41", right: "M54 41 Q62 38 71 42" },
      arched: { left: "M29 44 Q38 36 46 42", right: "M54 42 Q62 36 71 44" },
      straight: { left: "M29 42 L46 40", right: "M54 40 L71 42" },
      thick: { left: "M29 42 Q38 37 46 41", right: "M54 41 Q62 37 71 42", thickness: 3.5 },
      thin: { left: "M30 42 Q38 39 45 41", right: "M55 41 Q62 39 70 42", thickness: 1.2 }
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
    if (gender !== 'female') return null;

    if (eyelashes === 'dramatic') {
      return (
        <g stroke={hairColor} strokeWidth="1" fill="none" opacity="0.7">
          <path d="M30 47 L28 44" />
          <path d="M33 46 L32 43" />
          <path d="M36 45 L36 42" />
          <path d="M64 45 L64 42" />
          <path d="M67 46 L68 43" />
          <path d="M70 47 L72 44" />
        </g>
      );
    }
    return null;
  };

  const lips = lipShapes[lipShape] || lipShapes.natural;
  const faceGradientId = `face-${skinTone.replace('#','')}`;

  return (
    <svg viewBox="0 0 100 130" className={className}>
      <defs>
        <linearGradient id={faceGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={skinTone} />
          <stop offset="100%" stopColor={skinTone} />
        </linearGradient>
        <linearGradient id="shirtGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2a2a3e" />
          <stop offset="100%" stopColor="#1a1a28" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {gender === 'male' ? renderMaleHair() : renderFemaleHair()}

      <path d="M50 95 Q18 98 4 118 Q0 135 0 155 L100 155 Q100 135 96 118 Q82 98 50 95Z" fill="url(#shirtGrad)" />
      <path d="M36 95 Q44 106 50 110 Q56 106 64 95" stroke="#3a3a4e" strokeWidth="1.5" fill="none" />

      <path d="M40 82 L40 100 Q40 104 50 104 Q60 104 60 100 L60 82" fill={`url(#${faceGradientId})`} />

      {renderNecklace()}

      <ellipse cx="50" cy="52" rx="28" ry="34" fill={`url(#${faceGradientId})`} />

      <ellipse cx="22" cy="54" rx="4" ry="7" fill={skinTone} />
      <ellipse cx="78" cy="54" rx="4" ry="7" fill={skinTone} />

      {renderEarrings()}

      <g filter="url(#glow)">
        <ellipse cx="38" cy="50" rx="7" ry="5" fill="white" />
        <ellipse cx="62" cy="50" rx="7" ry="5" fill="white" />
        <circle cx="38" cy="50" r="4.5" fill={eyeColor} />
        <circle cx="62" cy="50" r="4.5" fill={eyeColor} />
        <circle cx="38" cy="50" r="2.2" fill="#0a0a0a" />
        <circle cx="62" cy="50" r="2.2" fill="#0a0a0a" />
        <circle cx="36" cy="48.5" r="1.4" fill="white" opacity="0.95" />
        <circle cx="60" cy="48.5" r="1.4" fill="white" opacity="0.95" />
      </g>

      {renderEyelashes()}

      {renderEyebrows()}

      <path d="M50 55 Q53 62 50 68" stroke="#00000025" strokeWidth="2" fill="none" />
      <ellipse cx="46" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
      <ellipse cx="54" cy="68" rx="3.5" ry="2.2" fill="#00000012" />
      <path d="M44 68 Q50 72 56 68" stroke="#00000018" strokeWidth="1.2" fill="none" />

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
