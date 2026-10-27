// Turns a merged pull request into a changelog entry for members. Pure functions, no network,
// so they are easy to test. publish.mjs does the posting.

export const CATEGORIES = ['feature', 'improvement', 'fix', 'design', 'game', 'infra'];

/**
 * The member-facing text of a PR: everything under a "What's new" heading (also "What's new for
 * members" or "Changelog"), up to the next heading. Null when it is missing or still the template.
 */
export function extractWhatsNew(body) {
  if (!body) return null;
  const text = String(body).replace(/<!--[\s\S]*?-->/g, '');
  const match = text.match(/^#{2,3}\s*(?:what['’]s new(?: for members)?|changelog)\s*$/im);
  if (!match) return null;
  const rest = text.slice(match.index + match[0].length);
  const next = rest.search(/^#{1,3}\s+\S/m);
  const section = (next === -1 ? rest : rest.slice(0, next)).trim();
  if (!section || /^(n\/a|none|skip|internal|-)$/i.test(section)) return null;
  return section;
}

/** "feat(town): add mail (#12)" becomes "Add mail". */
export function cleanTitle(title) {
  let t = String(title || '').trim();
  t = t.replace(/^(feat|feature|fix|chore|docs|refactor|perf|style|test|design|game|infra)(\([^)]*\))?!?:\s*/i, '');
  t = t.replace(/\s*\(#\d+\)\s*$/, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/** A label wins; otherwise the conventional prefix; otherwise the PR is a feature. */
export function pickCategory(title, labels = []) {
  const names = labels.map(l => String(typeof l === 'string' ? l : l.name).toLowerCase());
  for (const c of CATEGORIES) if (names.includes(c) || names.includes(`changelog:${c}`)) return c;
  const prefix = String(title || '').toLowerCase().match(/^([a-z]+)(\([^)]*\))?!?:/);
  const map = { feat: 'feature', feature: 'feature', fix: 'fix', perf: 'improvement', refactor: 'improvement', design: 'design', style: 'design', game: 'game', chore: 'infra', infra: 'infra' };
  if (prefix && map[prefix[1]]) return map[prefix[1]];
  return 'feature';
}

/**
 * The entry for a merged PR, or null when it should not be published: no "What's new" section
 * (an internal change) and no `changelog` label.
 */
export function buildEntry(pr) {
  if (!pr || !pr.merged_at && !pr.merged) return null;
  const labels = (pr.labels || []).map(l => String(typeof l === 'string' ? l : l.name).toLowerCase());
  if (labels.includes('no-changelog')) return null;
  const section = extractWhatsNew(pr.body);
  if (!section && !labels.includes('changelog')) return null;
  const title = cleanTitle(pr.title);
  const body = section || title;
  if (!title) return null;
  return {
    title: title.slice(0, 120),
    body: body.slice(0, 4000),
    category: pickCategory(pr.title, pr.labels),
    tags: [],
    sourceRef: `pr-${pr.number}`,
    publishedAt: pr.merged_at || new Date().toISOString(),
  };
}
