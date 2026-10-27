import { canPassWithoutEvent, hasEvent } from './engine';
import type { Actor, Cond, LineBook, Mode, ScriptDef, Step } from './types';

const PRESETS = ['warm', 'calm', 'bubbly', 'dry'] as const;

function* walk(steps: Step[]): Generator<Step> {
  for (const s of steps) {
    yield s;
    if (s.do === 'if') { yield* walk(s.then); if (s.else) yield* walk(s.else); }
    else if (s.do === 'choice') for (const o of s.options) if (o.steps) yield* walk(o.steps);
  }
}

const eventName = (c: Cond): string => ('event' in c ? c.event : 'all' in c ? c.all.map(eventName).filter(Boolean).join(', ') : 'any' in c ? c.any.map(eventName).filter(Boolean).join(', ') : 'not' in c ? eventName(c.not) : '');

/**
 * Checks the story content before it ever runs; every problem is one readable line. Besides broken references, it
 * holds the rules that keep a scene honest:
 * - a wait on an event also has a flag or world condition, so a reload can pass it when the thing already happened;
 * - a card with a button is followed by a wait: the button is a convenience, the world ends the beat;
 * - in a cutscene or a guided lesson nobody speaks while someone the scene moved is still walking.
 */
export function validateContent(defs: ScriptDef[], book: LineBook, npcs: string[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const d of defs) {
    if (ids.has(d.id)) errors.push(`${d.id}: id used twice`);
    ids.add(d.id);
  }
  for (const d of defs) {
    checkBlock(d, d.steps, d.mode, errors);
    for (const s of walk(d.steps)) {
      if (s.do === 'run' && !ids.has(s.script)) errors.push(`${d.id}: runs "${s.script}", which does not exist`);
      if (s.do === 'spawn' && !npcs.includes(s.npc)) errors.push(`${d.id}: spawns "${s.npc}", who is not a known visitor`);
      if (s.do === 'choice') {
        const n = s.options.filter((o) => o.default).length;
        if (n !== 1) errors.push(`${d.id}: a choice needs exactly one default option (has ${n})`);
      }
      if (s.do === 'wait' && s.until && hasEvent(s.until) && !canPassWithoutEvent(s.until)) {
        errors.push(`${d.id}: a wait on "${eventName(s.until)}" has no flag or world condition beside it, so a reload could never get past it`);
      }
      if (s.do === 'say') {
        const ref = s.line;
        if (typeof ref === 'string') {
          if (!ref.includes('$') && !(ref in book.lines)) errors.push(`${d.id}: line "${ref}" is not in the line book`);
          const entry = book.lines[ref];
          if (entry && typeof entry !== 'string') for (const p of PRESETS) if (!entry[p]) errors.push(`${d.id}: line "${ref}" has no ${p} version`);
        } else if ('pool' in ref) {
          if (!ref.pool.includes('$') && !(book.pools[ref.pool]?.length)) errors.push(`${d.id}: pool "${ref.pool}" is empty or missing`);
        } else if ('bank' in ref) {
          const styles = Object.entries(book.banks?.[ref.bank] ?? {});
          if (!styles.length) errors.push(`${d.id}: there is no ${ref.bank} bank`);
          for (const [style, slots] of styles) if (!slots[ref.slot]) errors.push(`${d.id}: ${ref.bank} bank "${style}" has no "${ref.slot}" line`);
        } else for (const p of PRESETS) if (!ref.byPreset[p]) errors.push(`${d.id}: a line has no ${p} version`);
      }
    }
  }
  return errors;
}

/** Rules that depend on the order of steps in a block: the button rule and the nobody-talks-while-walking rule. */
function checkBlock(d: ScriptDef, steps: Step[], mode: Mode, errors: string[]): Mode {
  const walking = new Set<Actor>();
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    switch (s.do) {
      case 'mode': mode = s.mode; break;
      case 'walk': if (s.wait === false) walking.add(s.who); else walking.delete(s.who); break;
      case 'place': walking.delete(s.who); break;
      case 'despawn': walking.delete(s.npc); break;
      case 'wait':
        if (s.arrive) for (const w of s.arrive) walking.delete(w);
        if (s.until || s.seconds) walking.clear();
        break;
      case 'act': if (s.wait !== false) walking.clear(); break;
      case 'say':
        if (mode !== 'beat' && walking.size) errors.push(`${d.id}: "${s.who}" speaks while ${[...walking].join(' and ')} ${walking.size > 1 ? 'are' : 'is'} still walking (add a wait with arrive, or let the walk wait)`);
        break;
      case 'card': {
        const next = steps[i + 1];
        if (s.button && !(next && next.do === 'wait' && (next.until || next.arrive))) errors.push(`${d.id}: the card "${s.title}" has a button but no wait after it; a button never ends a beat, the world does`);
        break;
      }
      case 'if': {
        const m1 = checkBlock(d, s.then, mode, errors);
        const m2 = s.else ? checkBlock(d, s.else, mode, errors) : mode;
        mode = m1 === m2 ? m1 : mode;
        break;
      }
      case 'choice': for (const o of s.options) if (o.steps) checkBlock(d, o.steps, mode, errors); break;
      default: break;
    }
  }
  return mode;
}
