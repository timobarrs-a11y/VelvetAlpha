import type { ShellManifest } from './types';

const ATLAS_CREST = `
<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="48" height="48" rx="12" fill="#0a0e1f"/>
  <rect x="0.5" y="0.5" width="47" height="47" rx="11.5" stroke="#c9a961" stroke-opacity="0.35"/>
  <path d="M24 10L31 30L24 25L17 30L24 10Z" fill="#c9a961"/>
  <path d="M24 28L28 38L24 34.5L20 38L24 28Z" fill="#c9a961" fill-opacity="0.6"/>
  <circle cx="24" cy="24" r="22" stroke="#c9a961" stroke-opacity="0.12" stroke-dasharray="2 4"/>
</svg>
`;

export const atlasShell: ShellManifest = {
  id: 'atlas',
  agentId: 'atlas',
  displayFont: "'Playfair Display', Georgia, serif",
  radius: '0.75rem',
  shadow: '0 2px 12px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.15)',
  tokens: {
    dark: {
      bg: '#0a0e1f',
      surface: 'rgba(20, 28, 56, 0.65)',
      surfaceHover: 'rgba(28, 38, 72, 0.75)',
      border: 'rgba(201, 169, 97, 0.15)',
      borderStrong: 'rgba(201, 169, 97, 0.35)',
      accent: '#c9a961',
      accentSoft: 'rgba(201, 169, 97, 0.12)',
      accentText: '#d4b875',
      textPrimary: '#e8e4d9',
      textSecondary: 'rgba(232, 228, 217, 0.65)',
      textMuted: 'rgba(232, 228, 217, 0.38)',
      userBubble: 'linear-gradient(135deg, #1a2848 0%, #243660 100%)',
      userBubbleText: '#e8e4d9',
      agentBubble: 'rgba(16, 24, 48, 0.75)',
      agentBubbleText: '#e8e4d9',
    },
    light: {
      bg: '#faf6ee',
      surface: 'rgba(255, 252, 245, 0.85)',
      surfaceHover: 'rgba(250, 245, 233, 0.95)',
      border: 'rgba(10, 14, 31, 0.12)',
      borderStrong: 'rgba(10, 14, 31, 0.25)',
      accent: '#9a7b3f',
      accentSoft: 'rgba(154, 123, 63, 0.10)',
      accentText: '#7a6234',
      textPrimary: '#1a2030',
      textSecondary: 'rgba(26, 32, 48, 0.65)',
      textMuted: 'rgba(26, 32, 48, 0.40)',
      userBubble: 'linear-gradient(135deg, #e8dfc8 0%, #d9cca8 100%)',
      userBubbleText: '#1a2030',
      agentBubble: 'rgba(255, 252, 245, 0.90)',
      agentBubbleText: '#1a2030',
    },
  },
  motion: {
    ease: [0.16, 1, 0.3, 1],
    durationFast: 250,
    durationBase: 350,
    durationSlow: 500,
  },
  copy: {
    agentName: 'Atlas',
    typingLabel: 'Atlas is preparing\u2026',
    typingLabelLong: 'Atlas is still preparing\u2026',
    inputPlaceholder: 'Tell Atlas what you need\u2026',
    emptyStateTitle: 'Your steward awaits',
    emptyStateSubtitle: 'Share what you\u2019re working toward, and Atlas will arrange the rest.',
  },
  layout: {
    header: 'crest',
    messageStyle: 'bubble-with-brief',
    input: 'adorned',
  },
  crestSvg: ATLAS_CREST,
};
