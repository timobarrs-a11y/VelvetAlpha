import type { AgentLook } from '../state/agents';
import { BOSS_LOOK } from '../state/workwear';

/** Visitors a script can bring in. They are drawn like anyone else; only the look and the name are theirs. */
export interface NpcDef { id: string; name: string; look: AgentLook }

export const NPCS: NpcDef[] = [
  {
    // Dez Dupree: mayor, mover, delivery man. A plaid shirt, jeans, a warm brown that goes with everything.
    id: 'dez', name: 'Dez',
    look: { skin: '#C58B63', hair: '#4A2F1B', top: '#B5523B', topStyle: 'flannel', bottom: '#3D5B8A', bottomStyle: 'jeans', longHair: false },
  },
];

// Dale: the boss. Lives at his desk in the office (level 5) and hardly ever leaves it (state/boss.ts); nobody sits in the chair in front of it unless he is there.
NPCS.push({ id: 'dale', name: 'Dale', look: BOSS_LOOK });

export const NPC_IDS = NPCS.map((n) => n.id);
export const npcDef = (id: string): NpcDef | undefined => NPCS.find((n) => n.id === id);
