// Little previews for the shop's Paint, Wallpaper and Floors tabs, as CSS
// backgrounds built from the same recipes the house is drawn with.

export interface LookInfo {
  pat?: string; kind?: string; base?: string; ink?: string; ink2?: string;
  a?: string; b?: string; line?: string; url?: string; stops?: Array<[number, string]>;
}

const stripes = (ink: string, dir: string, size = 12) => `repeating-linear-gradient(${dir}, ${ink} 0 ${size / 3}px, transparent ${size / 3}px ${size}px)`;

/** A CSS `background` for a wallpaper recipe. */
export function paperCss(info: LookInfo | null, thumb?: string): string {
  if (!info) return '#d8d2c8';
  if (info.pat === 'image') {
    if (thumb) return `${info.base ?? '#888'} url("${thumb}") center / cover`;
    const g = (info.stops ?? []).map(([at, c]) => `${c} ${Math.round(at * 100)}%`).join(', ');
    return g ? `linear-gradient(180deg, ${g})` : info.base ?? '#888';
  }
  const base = info.base ?? '#E9DCCB', ink = info.ink ?? 'rgba(0,0,0,.18)';
  switch (info.pat) {
    case 'stripes': case 'pin': return `${stripes(ink, '90deg', info.pat === 'pin' ? 6 : 12)}, ${base}`;
    case 'dots': case 'stars': case 'blossom': case 'palms': return `radial-gradient(circle, ${ink} 0 2px, transparent 2.5px) 0 0 / 10px 10px, ${base}`;
    case 'gingham': return `${stripes(ink, '90deg', 14)}, ${stripes(ink, '0deg', 14)}, ${base}`;
    case 'plaid': return `${stripes(info.ink2 ?? ink, '90deg', 18)}, ${stripes(ink, '0deg', 18)}, ${base}`;
    case 'chevron': case 'arches': case 'scallop': case 'damask': case 'hexes': case 'tuft':
      return `${stripes(ink, '45deg', 12)}, ${stripes(ink, '-45deg', 12)}, ${base}`;
    case 'starburst': return `radial-gradient(circle, ${ink} 0 1.5px, transparent 2px) 0 0 / 14px 14px, repeating-conic-gradient(from 0deg at 7px 7px, ${ink} 0 6deg, transparent 6deg 45deg) 0 0 / 14px 14px, ${base}`;
    case 'shiplap': case 'subway': case 'brick': case 'block': return `${stripes(ink, '0deg', 9)}, ${base}`;
    default: return base;
  }
}

/** A CSS `background` for a floor recipe. */
export function floorCss(info: LookInfo | null): string {
  if (!info) return '#c9a27a';
  const a = info.a ?? '#C9A27A', b = info.b ?? a, line = info.line ?? 'rgba(0,0,0,.2)';
  if (info.kind === 'plank') return `${stripes(line, '0deg', 9)}, linear-gradient(90deg, ${a}, ${b})`;
  if (info.kind === 'check') return `conic-gradient(${a} 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0) 0 0 / 16px 16px`;
  return `linear-gradient(135deg, ${a}, ${b})`;
}
