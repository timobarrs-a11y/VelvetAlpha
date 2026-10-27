import { isEffectStep } from './engine';
import type { LineBook, ScriptDef, Step } from './types';

const PRESETS = ['warm', 'calm', 'bubbly', 'dry'] as const;

function* walk(steps: Step[]): Generator<Step> {
  for (const s of steps) {
    yield s;
    if (s.do === 'if') { yield* walk(s.then); if (s.else) yield* walk(s.else); }
    else if (s.do === 'choice') for (const o of s.options) if (o.steps) yield* walk(o.steps);
  }
}

/** Checks the story content before it ever runs; every problem is one readable line. */
export function validateContent(defs: ScriptDef[], book: LineBook, npcs: string[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const d of defs) {
    if (ids.has(d.id)) errors.push(`${d.id}: id used twice`);
    ids.add(d.id);
  }
  for (const d of defs) {
    if (d.skippable && !d.onSkip) errors.push(`${d.id}: skippable but has no onSkip`);
    for (const s of walk(d.onSkip ?? [])) if (!isEffectStep(s)) errors.push(`${d.id}: onSkip has a step that is not an effect (${s.do})`);
    for (const s of walk(d.steps)) {
      if (s.do === 'run' && !ids.has(s.script)) errors.push(`${d.id}: runs "${s.script}", which does not exist`);
      if (s.do === 'spawn' && !npcs.includes(s.npc)) errors.push(`${d.id}: spawns "${s.npc}", who is not a known visitor`);
      if (s.do === 'choice') {
        const n = s.options.filter((o) => o.default).length;
        if (n !== 1) errors.push(`${d.id}: a choice needs exactly one default option (has ${n})`);
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
