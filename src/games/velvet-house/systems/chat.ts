import { LEVEL_NAMES } from '../state/house';
import { statusText } from '../state/agents';
import { talk, rememberChat, cannedFor, type PersonaContext } from '../state/companionAI';
import { remember, compactMemory, condenserFrom } from '../state/memory';
import type { Game } from '../kernel/game';

export function createChat(g: Game): Partial<Game> {
  const { world, simName, partnerName, townName, people, flags, style, memStore, companionCfg, log, logEntries, art, drawer, dialogue, coreMem, memories, pastMem } = g;
  // Chat
  function openChat(): void {
    if (!g.s.sample) { log(`${partnerName} is not available right now.`); return; }
    // The Partner page that started the chat would cover the house on a phone, so it closes.
    drawer.close();
    dialogue.open();
    // The hard pass: she has closed the door until the house is put right. Her line, and no way to answer.
    const shut = g.hardPass();
    if (shut) {
      dialogue.showAI(g.scripts.text({ bank: 'humor', slot: `concern.${shut}.3` }));
      g.scriptEmit({ type: 'chat.refused', kind: shut });
      return;
    }
    flags.talked = true;
    if (!(flags.settleSeen as string[])?.includes('talk')) (flags.settleSeen as string[]).push('talk');
    // Show a greeting or the last exchange; after her line, the box comes back so the player can answer.
    if (g.s.chatTurns.length > 0) {
      const last = g.s.chatTurns[g.s.chatTurns.length - 1];
      if (last.role === 'assistant') { dialogue.showAI(last.content); setTimeout(() => { if (!dialogue.el.hidden) dialogue.showInput(true); }, 500 + last.content.length * 20); }
      else dialogue.showInput();
    } else {
      dialogue.showInput();
    }
  }

  function handleCloseChat(): void {
    g.scriptEmit({ type: 'chat.closed' });
    // Save memories from chat
    if (g.s.chatTurns.length > 2 && g.s.sample) {
      rememberChat(g.s.chatTurns, g.s.sample).then(mems => {
        for (const m of mems) remember(m.line, m.important, memStore);
        // Over the caps: the oldest are condensed, not dropped.
        compactMemory(memStore, g.s.sample ? condenserFrom(g.s.sample, partnerName) : undefined).catch(() => {});
      }).catch(() => {});
    }
  }

  async function handleTalk(text: string): Promise<void> {
    // The developer's money phrase and the unlock codes are never messages: not sent, not remembered.
    if (g.tryDevMoney(text) || g.tryUnlock(text)) { dialogue.showInput(); return; }
    if (!g.s.sample) { dialogue.showInput(); return; }
    dialogue.busy(true);
    dialogue.showAI('...', true);
    art.setTalking(true);
    dialogue.setPortraitTalking(true);

    const ctx: PersonaContext = {
      partnerName, simName, townName,
      companion: companionCfg,
      style, bond: g.s.bond,
      day: world.day, minutes: world.minutes,
      money: world.household.money,
      fridgeBasic: world.household.fridge.basic,
      fridgeFresh: world.household.fridge.fresh,
      dishes: world.household.dishes,
      laundryPile: world.household.laundryPile,
      power: world.household.power,
      mayaStatus: statusText(people[1]),
      jordanStatus: statusText(people[0]),
      mayaWhere: LEVEL_NAMES[people[1].level],
      jordanWhere: LEVEL_NAMES[people[0].level],
      recentLog: logEntries.slice(0, 5).reverse(),
      coreMem, memories, pastMem,
      concern: g.concernContext(),
      mood: g.concernMood(),
      pets: g.petsContext(),
    };

    // Out of replies for today: don't ask the network again until tomorrow.
    let streamed = '';
    const result = g.s.chatBudgetDay === world.day
      ? { text: cannedFor('budget', companionCfg.preset), tag: null, turns: g.s.chatTurns }
      : await talk(text, g.s.chatTurns, ctx, g.s.sample, (chunk) => {
      streamed += chunk;
      dialogue.showAI(streamed, true);
    });
    if ('failed' in result && result.failed === 'budget') g.s.chatBudgetDay = world.day;
    g.s.chatTurns = result.turns;
    dialogue.showAI(result.text, true);
    dialogue.busy(false);
    art.setTalking(false);
    dialogue.setPortraitTalking(false);

    // Apply mood tag
    if (result.tag) {
      g.s.bond = Math.max(0, Math.min(100, g.s.bond + result.tag.bond * 1.5));
      art.setMood(g.s.bond / 100);
      if (result.tag.act !== 'none') {
        // Could trigger autonomous acts — for now just log
      }
    }

    // Leave the reply up while the box comes back, so it can be read as the player answers.
    setTimeout(() => dialogue.showInput(true), 600);
  }
  return { openChat, handleCloseChat, handleTalk };
}
