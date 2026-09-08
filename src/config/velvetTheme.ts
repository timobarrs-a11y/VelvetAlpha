/**
 * Legacy theme object used by the entry/onboarding pages (Login, Sign Up, Invite,
 * Goal Discovery). The values now resolve from the design-system tokens in
 * `src/design/design-system.css`, so these pages follow the active A/B variant
 * and the locked dark-purple palette instead of the old cobalt-blue scheme.
 *
 * Prefer the `.ds-*` classes / `<PageShell>` for new screens.
 */
export const VELVET_THEME = {
  bg: 'var(--ds-bg-page)',
  radial: 'var(--ds-bg-glow)',

  colors: {
    cobaltTop:    '#16132b',
    cobaltMid:    '#0f0e1a',
    navyBottom:   '#0a0914',
    glassCard:    'var(--ds-surface-3)',
    glassBorder:  'var(--ds-border-strong)',
    glassPanel:   'var(--ds-pill-bg)',
    panelBorder:  'var(--ds-pill-border)',
    navBg:        'var(--ds-header-bg)',
    navBorder:    'var(--ds-header-border)',
  },

  logo: {
    gradient:     'var(--ds-title-gradient)',
    glowFilter:   'drop-shadow(0 4px 16px rgba(192,132,252,0.55))',
    heartGlow:    'drop-shadow(0 0 18px rgba(244,114,182,0.80))',
    heartSmGlow:  'drop-shadow(0 0 10px rgba(244,114,182,0.75))',
    heartXsGlow:  'drop-shadow(0 0 6px rgba(244,114,182,0.70))',
  },

  text: {
    body:         'text-ink-secondary',
    muted:        'text-ink-muted',
    subtle:       'text-ink-subtle',
    heading:      'text-white',
  },

  button: {
    primary:      'linear-gradient(135deg, #f43f6b 0%, #e11d48 100%)',
    primaryGlow:  '0 4px 24px rgba(244,63,107,0.40)',
    ghost:        'var(--ds-pill-bg)',
    ghostBorder:  'var(--ds-pill-border)',
    nav:          'var(--ds-pill-bg)',
    navBorder:    'var(--ds-pill-border)',
  },
} as const;
