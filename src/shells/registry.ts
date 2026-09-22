import type { AgentId, ShellManifest } from './types';
import { atlasShell } from './atlas.shell';
import { defaultShell } from './default.shell';

const registry: Record<AgentId, ShellManifest> = {
  atlas: atlasShell,
  navi: defaultShell,
  companion: defaultShell,
  default: defaultShell,
};

export function resolveShell(agentId: AgentId): ShellManifest {
  return registry[agentId] ?? defaultShell;
}

export { atlasShell, defaultShell };
