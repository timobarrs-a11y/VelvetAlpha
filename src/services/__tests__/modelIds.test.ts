import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MODEL_CONFIG, modelForTier } from '../../../supabase/functions/_shared/modelConfig';

const ROOT = process.cwd();
const ALLOWED = new Set(['supabase/functions/_shared/modelConfig.ts']);
// A model id: claude-haiku-..., claude-sonnet-..., claude-opus-..., claude-fable-..., claude-3-5-...
const MODEL_ID = /['"`]claude-(haiku|sonnet|opus|fable|\d)[a-z0-9.-]*['"`]/;

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === '__tests__' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) yield p;
  }
}

describe('model ids', () => {
  it('are written in one place only', () => {
    const offenders: string[] = [];
    for (const dir of ['src', 'supabase/functions']) {
      for (const file of sources(join(ROOT, dir))) {
        const rel = relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        readFileSync(file, 'utf-8').split('\n').forEach((line, i) => {
          if (MODEL_ID.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(offenders, `Use MODEL_CONFIG from supabase/functions/_shared/modelConfig.ts:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('a tier gives a model', () => {
    expect(modelForTier('small')).toBe(MODEL_CONFIG.HAIKU);
    expect(modelForTier('standard')).toBe(MODEL_CONFIG.SONNET);
  });
});
