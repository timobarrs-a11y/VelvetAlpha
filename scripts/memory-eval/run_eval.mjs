#!/usr/bin/env node
// Retrieval eval for the memory engine.
//
// Runs each case in an eval set through the real pipeline:
//   1. SQL stage: fetch_memories_for_turn(user, companion, relationship_type, query)
//      — the live Postgres function (full-text + vector; vector only if you
//      pass embeddings, see --embed).
//   2. Selection stage: selectMemories() from
//      supabase/functions/_shared/memoryEngine.ts, with the same defaults
//      chat-turn uses, imported directly (Node >= 22.6 strips the types).
// Then scores the selected rows against each case's expectations.
//
// Ways to get the SQL stage results:
//   --supabase            use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (PostgREST rpc)
//   --db-url <url>        run the emitted SQL through psql
//   --candidates <file>   use a saved SQL result
//   --mirror              no database: a validated JavaScript re-implementation of the
//                         SQL stage (lexical only), using lib/pg_english.mjs for the
//                         stems; what to use for the synthetic fixture
//   --emit-sql            print the SQL that produces the candidates file and exit
//   --emit-load-sql       print INSERTs that load the fixture into a scratch database
//                         built by memory_engine.test.sql, then exit (synthetic fixtures)
//
// Examples:
//   node --experimental-strip-types scripts/memory-eval/run_eval.mjs --candidates scripts/memory-eval/results/candidates_2026-10-26.json
//   node --experimental-strip-types scripts/memory-eval/run_eval.mjs --synthetic --mirror
//   node --experimental-strip-types scripts/memory-eval/run_eval.mjs --synthetic --emit-load-sql --shift-days 45 | psql scratch
//
// Flags: --eval <file> --fixture <file> --synthetic (both synthetic files) --engine <memoryEngine.ts>
//        --out <dir> --embed --as-of <iso> (pin "now") --shift-days <n> (only cases with that shift; loader ages rows by n)
//
// Fixture rows may carry absolute timestamps (created_at, updated_at, valid_until) or
// relative ones (created_days_ago, updated_days_ago, valid_until_days) resolved against
// --as-of / now, plus each case's shift_days.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const args = process.argv.slice(2);
const flag = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] ?? true) : dflt; };
const has = name => args.includes(name);

const synthetic = has('--synthetic');
const evalPath = resolve(flag('--eval', synthetic ? resolve(here, 'synthetic', 'eval_retrieval_synthetic.json') : resolve(here, 'eval_set.json')));
const fixturePath = resolve(flag('--fixture', synthetic ? resolve(here, 'synthetic', 'fixture_synthetic.json') : resolve(here, 'fixtures', 'memory_items_2026-10-26.json')));
const enginePath = resolve(flag('--engine', resolve(repo, 'supabase', 'functions', '_shared', 'memoryEngine.ts')));
const outDir = resolve(flag('--out', resolve(here, 'results')));
const NOW = flag('--as-of') ? new Date(flag('--as-of')) : new Date();
const shiftFilter = flag('--shift-days') != null ? Number(flag('--shift-days')) : null;

const evalSet = JSON.parse(readFileSync(evalPath, 'utf8'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const actors = fixture.actors;
const relOf = fixture.relationship_type;
const aliasOf = new Map(Object.entries(actors).map(([k, v]) => [v, k]));

// Resolve a row's timestamps for a given shift (days added to every age).
const DAY = 86400000;
function resolveRow(r, shift = 0) {
  const base = { ...fixture.defaults, ...r, user_id: actors[r.user], companion_id: r.companion ? actors[r.companion] : null, scope: r.scope ?? fixture.defaults.scope };
  if (r.created_days_ago != null) base.created_at = new Date(NOW - (r.created_days_ago + shift) * DAY).toISOString();
  if (r.updated_days_ago != null) base.updated_at = new Date(NOW - (r.updated_days_ago + shift) * DAY).toISOString();
  if (r.valid_until_days != null) base.valid_until = new Date(NOW.getTime() + (r.valid_until_days - shift) * DAY).toISOString();
  return base;
}
const rowsById = new Map(fixture.rows.map(r => [r.id, resolveRow(r)]));

let cases = evalSet.cases;
if (shiftFilter != null) cases = cases.filter(c => (c.shift_days ?? 0) === shiftFilter);

// chat-turn: short replies borrow the previous user message (fetchScopedMemories).
function queryTextFor(c) {
  const q = c.query.trim();
  return q.split(/\s+/).length < 6 && c.previous_user_message ? `${c.previous_user_message}\n${q}` : q;
}

function sqlLiteral(s) { return `'${String(s).replace(/'/g, "''")}'`; }

function emitSql() {
  const values = cases.map(c =>
    `(${sqlLiteral(c.id)}, ${sqlLiteral(actors[c.user])}::uuid, ${sqlLiteral(actors[c.companion])}::uuid, ${sqlLiteral(relOf[c.companion])}, ${sqlLiteral(queryTextFor(c))})`
  ).join(',\n  ');
  return `-- Generated by scripts/memory-eval/run_eval.mjs --emit-sql. Read-only.
SELECT jsonb_object_agg(c.case_id, c.rows) AS candidates
FROM (
  SELECT v.case_id,
    (SELECT jsonb_agg(jsonb_build_object('id', left(r.id::text, 8), 'k', r.kind, 'rel', round(r.relevance::numeric, 3), 's', round(r.score::numeric, 3)) ORDER BY r.score DESC)
     FROM fetch_memories_for_turn(v.user_id, v.companion_id, v.rel, 1200, v.q, NULL, NULL, 40) r) AS rows
  FROM (VALUES
  ${values}
  ) AS v(case_id, user_id, companion_id, rel, q)
) c;`;
}

// Loader for a scratch database (schema from scripts/memory-eval/memory_engine.test.sql's
// preamble + migrations). Ages are relative to now() plus --shift-days.
function emitLoadSql() {
  const shift = shiftFilter ?? 0;
  const users = [...new Set(fixture.rows.map(r => actors[r.user]))];
  const comps = [...new Set(fixture.rows.filter(r => r.companion).map(r => actors[r.companion]))];
  const ts = (abs, days, sign = -1) => abs ? sqlLiteral(abs) + '::timestamptz' : days == null ? 'NULL' : `now() ${sign < 0 ? '-' : '+'} interval '${Math.abs(days)} days'`;
  const lines = [
    '-- Generated by scripts/memory-eval/run_eval.mjs --emit-load-sql. For a SCRATCH database only.',
    `INSERT INTO auth.users (id) VALUES ${users.map(u => `(${sqlLiteral(u)})`).join(', ')} ON CONFLICT DO NOTHING;`,
    `INSERT INTO companions (id) VALUES ${comps.map(c => `(${sqlLiteral(c)})`).join(', ')} ON CONFLICT DO NOTHING;`,
    'ALTER TABLE memory_items DISABLE TRIGGER USER;',
  ];
  for (const r of fixture.rows) {
    const created = r.created_at ? ts(r.created_at) : ts(null, (r.created_days_ago ?? 0) + shift);
    const updated = r.updated_at ? ts(r.updated_at) : ts(null, (r.updated_days_ago ?? r.created_days_ago ?? 0) + shift);
    const valid = r.valid_until ? ts(r.valid_until) : r.valid_until_days != null ? ts(null, r.valid_until_days - shift, +1) : 'NULL';
    lines.push(`INSERT INTO memory_items (id, user_id, companion_id, scope, kind, content, status, superseded_by, confidence, importance, source, confirm_count, created_at, updated_at, valid_until) VALUES (` +
      [sqlLiteral(r.id), sqlLiteral(actors[r.user]), r.companion ? sqlLiteral(actors[r.companion]) : 'NULL', sqlLiteral(r.scope ?? fixture.defaults.scope), sqlLiteral(r.kind), sqlLiteral(r.content), sqlLiteral(r.status ?? 'active'),
        r.superseded_by ? sqlLiteral(r.superseded_by) : 'NULL', r.confidence ?? fixture.defaults.confidence, r.importance ?? fixture.defaults.importance, sqlLiteral(r.source ?? fixture.defaults.source), r.confirm_count ?? fixture.defaults.confirm_count,
        created, updated, valid].join(', ') + ') ON CONFLICT (id) DO NOTHING;');
  }
  lines.push('ALTER TABLE memory_items ENABLE TRIGGER USER;');
  return lines.join('\n');
}

if (has('--emit-sql')) { process.stdout.write(emitSql() + '\n'); process.exit(0); }
if (has('--emit-load-sql')) { process.stdout.write(emitLoadSql() + '\n'); process.exit(0); }

const engine = await import(pathToFileURL(enginePath).href);
const { selectMemories, DEFAULT_FACT_SELECTION, DEFAULT_THREAD_SELECTION, isNearDuplicate, formatMemoryLine, estimateTokens, embedTexts, toPgVector, EMBEDDING_MODEL } = engine;

// ── SQL stage ────────────────────────────────────────────────────────────────
async function candidatesFor(cases) {
  if (has('--mirror')) return mirror(cases);
  if (has('--candidates')) {
    const raw = JSON.parse(readFileSync(resolve(flag('--candidates')), 'utf8'));
    const byCase = Array.isArray(raw) ? raw[0].candidates : (raw.candidates ?? raw);
    return hydrate(byCase);
  }
  if (has('--db-url')) {
    const out = execFileSync('psql', [flag('--db-url'), '-At', '-c', emitSql()], { encoding: 'utf8' });
    return hydrate(JSON.parse(out.trim()));
  }
  if (has('--supabase')) {
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('--supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    const result = {};
    for (const c of cases) {
      const q = queryTextFor(c);
      let embedding = null;
      if (has('--embed')) embedding = (await embedTexts([q], process.env.OPENAI_API_KEY, 5000))?.[0] ?? null;
      const res = await fetch(`${url}/rest/v1/rpc/fetch_memories_for_turn`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_user_id: actors[c.user], p_companion_id: actors[c.companion], p_relationship_type: relOf[c.companion],
          p_budget_tokens: 1200, p_query_text: q, p_query_embedding: toPgVector(embedding), p_embedding_model: embedding ? EMBEDDING_MODEL : null, p_max_candidates: 40,
        }),
      });
      if (!res.ok) throw new Error(`${c.id}: rpc ${res.status} ${await res.text()}`);
      result[c.id] = (await res.json()).map(r => ({ ...r, relevance: Number(r.relevance), score: Number(r.score) }));
    }
    return result;
  }
  throw new Error('Pass --mirror, --supabase, --db-url <url> or --candidates <file> (or --emit-sql / --emit-load-sql).');
}

// Compact SQL output (8-char id, rel, s) -> full rows from the fixture.
function hydrate(byCase) {
  const prefix = new Map([...rowsById.values()].map(r => [r.id.slice(0, 8), r]));
  const out = {};
  for (const [caseId, rows] of Object.entries(byCase)) {
    out[caseId] = (rows ?? []).map(r => {
      const full = r.id.length === 8 ? prefix.get(r.id) : rowsById.get(r.id);
      if (!full) throw new Error(`${caseId}: row ${r.id} not in fixture; refresh the fixture`);
      return { ...full, kind: r.k ?? full.kind, relevance: Number(r.rel ?? r.relevance), score: Number(r.s ?? r.score) };
    });
  }
  return out;
}

// JavaScript re-implementation of fetch_memories_for_turn's lexical path (v3 SQL),
// validated against the saved SQL output on the 2026-10-26 fixture: 667 candidate
// rows, 0 mismatches at 3 decimals. Stems come from lib/pg_english.mjs (validated
// against to_tsvector; see lib/pg_english.test.mjs).
async function mirror(cases) {
  const { lexemes } = await import('./lib/pg_english.mjs');
  const termCache = new Map();
  const termsOf = text => { if (!termCache.has(text)) termCache.set(text, [...lexemes(text)].filter(t => t !== 'user')); return termCache.get(text); };
  const out = {};
  for (const c of cases) {
    const shift = c.shift_days ?? 0;
    const uid = actors[c.user], cid = actors[c.companion], privateOk = ['romantic', 'friend'].includes(relOf[c.companion]);
    const q = termsOf(queryTextFor(c));
    const eligible = fixture.rows.map(r => resolveRow(r, shift)).filter(r => r.user_id === uid && r.status === 'active'
      && ['fact', 'preference', 'person', 'boundary', 'inside_joke', 'thread'].includes(r.kind)
      && (r.valid_until == null || new Date(r.valid_until) > NOW)
      && (r.kind === 'thread' || r.confidence >= 0.6)
      && ((r.companion_id === null && r.scope === 'global') || (r.companion_id === cid && r.scope === 'companion') || (r.companion_id === cid && r.scope === 'private' && privateOk)))
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 500);
    const scored = eligible.map(r => {
      const mt = termsOf(r.content);
      const hit = mt.filter(t => q.includes(t)).length;
      const lex = q.length ? hit / Math.max(mt.length, 1) * Math.min(1, hit / 2) : 0;
      const rel = Math.min(1, lex);
      const last = Math.max(new Date(r.updated_at), r.last_confirmed_at ? new Date(r.last_confirmed_at) : 0);
      const rec = Math.pow(0.5, (NOW - last) / DAY / 30);
      const score = 0.55 * rel + 0.20 * Math.min(Math.max(r.importance, 1), 10) / 10 + 0.15 * rec + 0.10 * Math.min(r.confidence, 1) + (['user_stated', 'user_edited'].includes(r.source) ? 0.05 : 0);
      return { ...r, relevance: rel, score };
    }).sort((a, b) => b.score - a.score);
    let f = 0, t = 0;
    out[c.id] = scored.filter(r => (r.kind === 'thread' ? ++t <= 10 : ++f <= 40));
  }
  return out;
}

// ── Selection stage (chat-turn fetchScopedMemories) ──────────────────────────
function select(rows) {
  const candidates = rows.filter(r => r.kind !== 'moment');
  const facts = selectMemories(candidates.filter(r => r.kind !== 'thread'), DEFAULT_FACT_SELECTION);
  const threads = selectMemories(candidates.filter(r => r.kind === 'thread'), DEFAULT_THREAD_SELECTION);
  return { facts, threads, all: [...facts, ...threads] };
}

function duplicatePairs(items) {
  let n = 0; const pairs = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (isNearDuplicate(items[i].content, items[j].content, 'loose')) { n++; pairs.push([items[i].id.slice(0, 8), items[j].id.slice(0, 8)]); }
  }
  return { n, pairs };
}

const ZT_OF = { denied: 'inject_denied_fact', expired: 'inject_expired_fact' };

function score(c, sel) {
  const e = c.expect; const fails = []; const zt = [];
  const ids = sel.all.map(r => r.id);
  const rank = id => ids.indexOf(id);
  const minRel = DEFAULT_FACT_SELECTION.minRelevance;
  const relevant = sel.all.filter(r => r.relevance >= minRel);
  if (e.include) for (const id of e.include) if (!ids.includes(id)) fails.push(`missing ${id.slice(0, 8)}`);
  if (e.include_any && !e.include_any.some(id => ids.includes(id))) fails.push(`none of ${e.include_any.map(i => i.slice(0, 8)).join('/')} selected`);
  if (e.exclude) for (const id of e.exclude) if (ids.includes(id)) {
    const row = rowsById.get(id);
    fails.push(`selected excluded ${id.slice(0, 8)} "${row?.content.slice(0, 50)}"`);
    if (row?._truth && ZT_OF[row._truth]) zt.push(`${ZT_OF[row._truth]}:${id.slice(0, 8)}`);
  }
  // A row whose valid_until has passed is a zero-tolerance violation whether or not the case lists it.
  for (const r of sel.all) if (r.valid_until && new Date(r.valid_until) <= NOW && !zt.some(z => z.endsWith(r.id.slice(0, 8)))) { fails.push(`expired row selected ${r.id.slice(0, 8)}`); zt.push(`${ZT_OF.expired}:${r.id.slice(0, 8)}`); }
  if (e.exclude_users) for (const r of sel.all) if (e.exclude_users.includes(aliasOf.get(r.user_id))) fails.push(`row from another user ${r.id.slice(0, 8)}`);
  if (e.no_relevant && relevant.length) fails.push(`${relevant.length} rows scored relevant (>=${minRel}): ${relevant.map(r => `${r.id.slice(0, 8)}@${r.relevance.toFixed(2)}`).join(', ')}`);
  if (e.max_relevant != null && relevant.length > e.max_relevant) fails.push(`${relevant.length} relevant rows > ${e.max_relevant}`);
  const dups = duplicatePairs(sel.facts);
  if (e.max_dupes != null && dups.n > e.max_dupes) fails.push(`${dups.n} near-duplicate fact pairs > ${e.max_dupes}`);
  if (e.rank_before) for (const [a, b] of e.rank_before) {
    if (rank(b) >= 0 && (rank(a) < 0 || rank(a) > rank(b))) fails.push(`${a.slice(0, 8)} should rank above ${b.slice(0, 8)}`);
  }
  return { pass: fails.length === 0, fails, zt, dups, relevantCount: relevant.length };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const byCase = await candidatesFor(cases);
const results = [];
for (const c of cases) {
  const rows = byCase[c.id] ?? [];
  const sel = select(rows);
  const s = score(c, sel);
  const factLines = sel.facts.map(f => formatMemoryLine(f, NOW));
  const tokens = [...factLines, ...sel.threads.map(t => formatMemoryLine(t, NOW))].reduce((a, l) => a + estimateTokens(l), 0);
  results.push({
    id: c.id, category: c.category, query: queryTextFor(c), shift_days: c.shift_days ?? 0, pass: s.pass, fails: s.fails, zero_tolerance_violations: s.zt,
    candidates: rows.length, selected_facts: sel.facts.length, selected_threads: sel.threads.length,
    relevant_selected: s.relevantCount, dup_pairs: s.dups.n, tokens,
    selected: sel.all.map(r => ({ id: r.id.slice(0, 8), kind: r.kind, rel: +r.relevance.toFixed(3), score: +r.score.toFixed(3), content: r.content })),
  });
}

const passed = results.filter(r => r.pass).length;
const ztAll = results.flatMap(r => r.zero_tolerance_violations.map(z => `${r.id} ${z}`));
const ztByCat = {}; for (const z of ztAll) { const k = z.split(' ')[1].split(':')[0]; ztByCat[k] = (ztByCat[k] ?? 0) + 1; }
const byCat = {};
for (const r of results) { const k = r.category.split(/ [\/:]/)[0]; (byCat[k] ??= { pass: 0, n: 0 }); byCat[k].n++; if (r.pass) byCat[k].pass++; }

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const tag = synthetic ? 'synthetic_' : '';
const mode = has('--mirror') ? 'mirror' : has('--candidates') ? 'candidates' : has('--db-url') ? 'db' : 'supabase';
writeFileSync(resolve(outDir, `results_${tag}${stamp}.json`), JSON.stringify({ engine: enginePath, evalPath, fixturePath, mode, as_of: NOW.toISOString(), passed, total: results.length, zero_tolerance_violations: ztAll, results }, null, 2));

let md = `# Memory retrieval eval — ${NOW.toISOString()}\n\nEngine: \`${enginePath.replace(repo + '/', '')}\` · SQL stage: ${mode} · eval: \`${evalPath.replace(repo + '/', '')}\`  \nPassed **${passed} / ${results.length}** · zero-tolerance violations: **${ztAll.length}** ${Object.keys(ztByCat).length ? JSON.stringify(ztByCat) : ''}\n\n| case | category | shift | pass | facts | threads | relevant | dup pairs | tokens | failures |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of results) md += `| ${r.id} | ${r.category} | ${r.shift_days} | ${r.pass ? '✅' : '❌'} | ${r.selected_facts} | ${r.selected_threads} | ${r.relevant_selected} | ${r.dup_pairs} | ${r.tokens} | ${r.fails.join('<br>')}${r.zero_tolerance_violations.length ? '<br>**ZT:** ' + r.zero_tolerance_violations.join(', ') : ''} |\n`;
md += `\n## By category\n\n| category | passed |\n|---|---|\n` + Object.entries(byCat).map(([k, v]) => `| ${k} | ${v.pass}/${v.n} |`).join('\n') + '\n';
md += `\n## What each turn injected\n\n`;
for (const r of results) {
  md += `### ${r.id} — "${r.query.replace(/\n/g, ' ⏎ ')}"${r.shift_days ? ` (asked ${r.shift_days} days later)` : ''}\n\n`;
  for (const s of r.selected) md += `- ${s.kind === 'thread' ? '🧵' : '•'} \`${s.id}\` rel=${s.rel} score=${s.score} — ${s.content}\n`;
  md += '\n';
}
writeFileSync(resolve(outDir, `results_${tag}${stamp}.md`), md);

console.log(`Passed ${passed}/${results.length} · zero-tolerance violations ${ztAll.length}${Object.keys(ztByCat).length ? ' ' + JSON.stringify(ztByCat) : ''}`);
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} [${r.category}]${r.shift_days ? ` +${r.shift_days}d` : ''} facts=${r.selected_facts} threads=${r.selected_threads} relevant=${r.relevant_selected} dups=${r.dup_pairs} tokens=${r.tokens}${r.fails.length ? '\n     ' + r.fails.join('\n     ') : ''}`);
console.log(`\nWrote ${resolve(outDir, `results_${tag}${stamp}.md`)}`);
