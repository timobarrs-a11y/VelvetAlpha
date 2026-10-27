# Changelog auto-publish

When a pull request is merged into `main`, `.github/workflows/changelog.yml` posts the PR's
**What's new** section to the in-app changelog (`/changelog`), and the existing database trigger
cross-posts it to the community board.

- **What gets published:** PRs with a `## What's new` section (plain words, for members). PRs without
  one, or labelled `no-changelog`, are skipped. A `changelog` label publishes the PR title alone.
- **Category:** a label (`feature`, `improvement`, `fix`, `design`, `game`, `infra`) or the title prefix
  (`fix:`, `feat:`, `design:` ...). The default is `feature`.
- **Re-runs are safe:** each PR is published once (`source_ref = pr-<number>`).

## One-time setup
1. Run `supabase/migrations/20261104100000_changelog_auto_publish.sql` in the Supabase SQL editor.
2. Pick a long random string. In GitHub: Settings > Secrets and variables > Actions, add the secret
   `CHANGELOG_INGEST_SECRET` with it.
3. Store its hash (SQL editor, replace the text in quotes):
   ```sql
   insert into public.server_secrets (key, value)
   values ('changelog_ingest_secret_hash', encode(sha256(convert_to('YOUR-LONG-RANDOM-STRING', 'utf8')), 'hex'))
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
4. In the same GitHub settings, add two **variables**: `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the same public
   values the app uses).

Until this is done the workflow just prints a notice and succeeds, so merges are never blocked.
