import type { AgentLook } from '../state/agents';

/** Visitors a script can bring in. They are drawn like anyone else; only the look and the name are theirs. */
export interface NpcDef { id: string; name: string; look: AgentLook }

export const NPCS: NpcDef[] = [
  {
    // Dez Dupree: mayor, mover, delivery man. A plaid shirt, jeans, a warm brown that goes with everything.
    id: 'dez', name: 'Dez',
    look: { skin: '#C58B63', hair: '#4A2F1B', top: '#B5523B', topStyle: 'flannel', bottom: '#3D5B8A', bottomStyle: 'jeans', longHair: false },
  },
];

export const NPC_IDS = NPCS.map((n) => n.id);
export const npcDef = (id: string): NpcDef | undefined => NPCS.find((n) => n.id === id);
