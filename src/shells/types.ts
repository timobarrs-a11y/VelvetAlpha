export type AgentId = 'atlas' | 'navi' | 'companion' | 'default';

export interface ShellTokenSet {
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  userBubble: string;
  userBubbleText: string;
  agentBubble: string;
  agentBubbleText: string;
}

export interface ShellTokens {
  light: ShellTokenSet;
  dark: ShellTokenSet;
}

export interface ShellMotion {
  ease: [number, number, number, number];
  durationFast: number;
  durationBase: number;
  durationSlow: number;
}

export interface ShellCopy {
  agentName: string;
  typingLabel: string;
  typingLabelLong: string;
  inputPlaceholder: string;
  emptyStateTitle: string;
  emptyStateSubtitle: string;
}

export type HeaderVariant = 'crest' | 'avatar' | 'minimal';
export type MessageStyleVariant = 'bubble' | 'bubble-with-brief';
export type InputVariant = 'adorned' | 'plain';

export interface ShellManifest {
  id: string;
  agentId: AgentId;
  displayFont: string;
  radius: string;
  shadow: string;
  tokens: ShellTokens;
  motion: ShellMotion;
  copy: ShellCopy;
  layout: {
    header: HeaderVariant;
    messageStyle: MessageStyleVariant;
    input: InputVariant;
  };
  crestSvg?: string;
}
