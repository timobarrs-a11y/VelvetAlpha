export const VELVET_THEME = {
  bg: 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)',
  radial: [
    'radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%)',
    'radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)',
  ].join(', '),

  colors: {
    cobaltTop:    '#1e2a7a',
    cobaltMid:    '#141a55',
    navyBottom:   '#0d0f3c',
    glassCard:    'rgba(13,15,55,0.82)',
    glassBorder:  'rgba(100,120,255,0.28)',
    glassPanel:   'rgba(255,255,255,0.07)',
    panelBorder:  'rgba(255,255,255,0.12)',
    navBg:        'rgba(10,12,48,0.92)',
    navBorder:    'rgba(100,120,255,0.22)',
  },

  logo: {
    gradient:     'linear-gradient(135deg, #f472b6 0%, #c084fc 45%, #818cf8 100%)',
    glowFilter:   'drop-shadow(0 4px 16px rgba(192,132,252,0.55))',
    heartGlow:    'drop-shadow(0 0 18px rgba(244,114,182,0.80))',
    heartSmGlow:  'drop-shadow(0 0 10px rgba(244,114,182,0.75))',
    heartXsGlow:  'drop-shadow(0 0 6px rgba(244,114,182,0.70))',
  },

  text: {
    body:         'text-blue-200/75',
    muted:        'text-blue-200/60',
    subtle:       'text-blue-300/60',
    heading:      'text-white',
  },

  button: {
    primary:      'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)',
    primaryGlow:  '0 4px 24px rgba(66,99,235,0.40)',
    ghost:        'rgba(255,255,255,0.10)',
    ghostBorder:  'rgba(255,255,255,0.25)',
    nav:          'rgba(255,255,255,0.08)',
    navBorder:    'rgba(255,255,255,0.15)',
  },
} as const;
