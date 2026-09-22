import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AgentId, ShellManifest, ShellTokenSet } from './types';
import { resolveShell } from './registry';

interface ShellContextValue {
  manifest: ShellManifest;
  tokens: ShellTokenSet;
  isDark: boolean;
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

  const value = useMemo(() => ({ manifest, tokens, isDark }), [manifest, tokens, isDark]);

  return (
    <ShellContext.Provider value={value}>
      <div
        style={{
          ...cssVars,
          '--shell-display-font': manifest.displayFont,
          '--shell-radius': manifest.radius,
          '--shell-shadow': manifest.shadow,
        } as React.CSSProperties}
      >
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
