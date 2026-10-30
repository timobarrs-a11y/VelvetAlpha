#!/usr/bin/env node
// Checks pg_english.mjs against real to_tsvector('english', ...) output captured
// from PostgreSQL 17 (pg_english.expected.json). Exit code 1 on any mismatch.
//
//   node scripts/memory-eval/lib/pg_english.test.mjs
//
// To refresh the ground truth, run on any Postgres with the english config:
//   SELECT jsonb_object_agg(w, tsvector_to_array(to_tsvector('english', w))) FROM unnest(ARRAY['word', ...]) w;
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lexemes } from './pg_english.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(readFileSync(resolve(here, 'pg_english.expected.json'), 'utf8')).words;
let ok = 0; const bad = [];
for (const [word, want] of Object.entries(expected)) {
  const got = [...lexemes(word)].sort();
  const w = [...want].sort();
  if (JSON.stringify(got) === JSON.stringify(w)) ok++; else bad.push(`${word}: want [${w}] got [${got}]`);
}
console.log(`pg_english: ${ok} ok, ${bad.length} mismatches`);
for (const b of bad) console.log('  ' + b);
process.exit(bad.length ? 1 : 0);
