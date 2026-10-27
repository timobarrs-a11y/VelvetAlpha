// Runs in GitHub Actions when a pull request is merged: posts its "What's new" to the app's
// changelog. See scripts/changelog/README.md for the one-time setup.
import { readFileSync } from 'node:fs';
import { buildEntry } from './lib.mjs';

const { SUPABASE_URL, SUPABASE_ANON_KEY, CHANGELOG_INGEST_SECRET, GITHUB_EVENT_PATH } = process.env;

const event = JSON.parse(readFileSync(GITHUB_EVENT_PATH, 'utf8'));
const entry = buildEntry(event.pull_request);

if (!entry) {
  console.log("No \"What's new\" section on this pull request (or it is marked no-changelog), so nothing to publish.");
  process.exit(0);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CHANGELOG_INGEST_SECRET) {
  console.warn('Changelog publishing is not set up yet (needs SUPABASE_URL, SUPABASE_ANON_KEY and CHANGELOG_INGEST_SECRET). Skipping. See scripts/changelog/README.md.');
  process.exit(0);
}

const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/ingest_changelog_entry`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  body: JSON.stringify({
    p_secret: CHANGELOG_INGEST_SECRET,
    p_title: entry.title,
    p_body: entry.body,
    p_category: entry.category,
    p_tags: entry.tags,
    p_source_ref: entry.sourceRef,
    p_published_at: entry.publishedAt,
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(`Publishing failed (${response.status}): ${text}`);
  process.exit(1);
}
console.log(`Published "${entry.title}" (${entry.category}) to the changelog: ${text}`);
