/**
 * What people wear at the office. Anyone from the household on the office floor is in a suit (their wardrobe is not touched: it is only what is drawn);
 * the boss has a suit of his own, so he is never mistaken for anyone else: charcoal, double-breasted, with gold buttons and a gold tie.
 */
import type { AgentLook } from './agents';

/** The level of the office (see state/scenes.ts). */
export const OFFICE_LEVEL = 5;

/** The suit a household member wears at work: a navy blazer with a burgundy tie over dark trousers. */
export function workLook(look: AgentLook): AgentLook {
  return { ...look, top: '#2E3B57', topStyle: 'blazer', accent: '#8A2D3B', topGarment: undefined, bottom: '#2B2D35', bottomStyle: 'trousers', bottomAccent: undefined, bottomGarment: undefined };
}

/** The boss's look: grey at the temples, a charcoal double-breasted suit (`bosssuit` in the art) with a gold tie. */
export const BOSS_LOOK: AgentLook = {
  skin: '#E1BE9C', hair: '#9AA0A8', top: '#23262E', topStyle: 'bosssuit', accent: '#C9A24A', bottom: '#1B1D23', bottomStyle: 'trousers', longHair: false,
};
