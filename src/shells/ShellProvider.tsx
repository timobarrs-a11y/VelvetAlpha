import { createContext, useContext, useMemo, type ReactNode, type CSSProperties } from 'react';
import type { AgentId, ShellManifest, ShellTokenSet } from './types';
import { resolveShell } from './registry';

const SHELLS_ENABLED = import.meta.env.VITE_SHELLS_ENABLED === 'true';

interface ShellContextValue {
  manifest: ShellManifest;
  tokens: ShellTokenSet;
  isDark: boolean;
  enabled: boolean;
}

const ShellContext = createContext<ShellContextValue | null>(null);

function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function tokensToCssVars(tokens: ShellTokenSet): Record<string, string> {
  return {
    '--shell-bg': tokens.bg,
    '--shell-surface': tokens.surface,
    '--shell-surface-hover': tokens.surfaceHover,
    '--shell-border': tokens.border,
    '--shell-border-strong': tokens.borderStrong,
    '--shell-accent': tokens.accent,
    '--shell-accent-soft': tokens.accentSoft,
    '--shell-accent-text': tokens.accentText,
    '--shell-text-primary': tokens.textPrimary,
    '--shell-text-secondary': tokens.textSecondary,
    '--shell-text-muted': tokens.textMuted,
    '--shell-user-bubble': tokens.userBubble,
    '--shell-user-bubble-text': tokens.userBubbleText,
    '--shell-agent-bubble': tokens.agentBubble,
    '--shell-agent-bubble-text': tokens.agentBubbleText,
  };
}

interface ShellProviderProps {
  agentId: AgentId;
  forceDark?: boolean;
  children: ReactNode;
}

export function ShellProvider({ agentId, forceDark, children }: ShellProviderProps) {
  const manifest = useMemo(() => resolveShell(agentId), [agentId]);
  const isDark = forceDark ?? prefersDarkMode();
  const tokens = manifest.tokens[isDark ? 'dark' : 'light'];

  const cssVars = useMemo(() => tokensToCssVars(tokens), [tokens]);

  const value = useMemo(() => ({ manifest, tokens, isDark, enabled: SHELLS_ENABLED }), [manifest, tokens, isDark]);

  if (!SHELLS_ENABLED) {
    return <>{children}</>;
  }

  const style: CSSProperties = {
    ...cssVars,
    '--shell-display-font': manifest.displayFont,
    '--shell-radius': manifest.radius,
    '--shell-shadow': manifest.shadow,
  } as CSSProperties;

  return (
    <ShellContext.Provider value={value}>
      <div style={style}>
        {children}
      </div>
    </ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}

export function isShellsEnabled(): boolean {
  return SHELLS_ENABLED;
}
