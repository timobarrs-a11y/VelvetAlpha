import type { ReactNode } from 'react';
import type { AvatarConfigV2 } from '../types/avatar-v2';

export interface IAvatarRenderer {
  readonly id: string;
  render(config: AvatarConfigV2, className?: string): ReactNode;
}

const registry = new Map<string, IAvatarRenderer>();

export function registerAvatarRenderer(renderer: IAvatarRenderer): void {
  registry.set(renderer.id, renderer);
}

export function getAvatarRenderer(id: string): IAvatarRenderer | undefined {
  return registry.get(id);
}

export function getDefaultRenderer(): IAvatarRenderer {
  const r = registry.get('svg-v2');
  if (!r) throw new Error('No default avatar renderer registered. Import src/renderers/SVGAvatarRenderer.');
  return r;
}
