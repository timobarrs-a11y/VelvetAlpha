#!/usr/bin/env bash
# Deploys the Supabase edge functions that changed. Used by .github/workflows/deploy-functions.yml.
#
#   scripts/deploy-functions.sh <project-ref> [function ...]
#
# With function names, deploys exactly those. Without, works out what changed between
# $BEFORE and $AFTER (the push's two commits): a function whose own folder changed, and every
# function that imports a changed file in supabase/functions/_shared.
set -euo pipefail

ref="${1:?project ref}"
shift || true
funcs="$*"

if [ -z "$funcs" ]; then
  before="${BEFORE:-}"
  after="${AFTER:-HEAD}"
  if [ -z "$before" ] || [ "$before" = "0000000000000000000000000000000000000000" ]; then
    echo "No earlier commit to compare with; nothing to deploy. Run the workflow by hand to deploy a function."
    exit 0
  fi
  changed="$(git diff --name-only "$before" "$after" -- supabase/functions || true)"
  own="$(printf '%s\n' "$changed" | grep -v '^supabase/functions/_shared/' | grep '^supabase/functions/' | cut -d/ -f3 | sort -u || true)"
  shared="$(printf '%s\n' "$changed" | grep '^supabase/functions/_shared/' | xargs -r -n1 basename || true)"
  importers=""
  for file in $shared; do
    importers="$importers $(grep -l "_shared/$file" supabase/functions/*/*.ts 2>/dev/null | cut -d/ -f3 || true)"
  done
  funcs="$(printf '%s\n%s\n' "$own" "$importers" | tr ' ' '\n' | grep -v '^$' | sort -u | tr '\n' ' ')"
fi

if [ -z "${funcs// /}" ]; then
  echo "No edge functions changed."
  exit 0
fi

for fn in $funcs; do
  if [ ! -d "supabase/functions/$fn" ]; then
    echo "Skipping $fn: no such folder (deleted?)."
    continue
  fi
  echo "Deploying $fn ..."
  supabase functions deploy "$fn" --project-ref "$ref"
done
