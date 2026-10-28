#!/usr/bin/env bash
# Fails when a commit looks like a stale snapshot of the repo saved under a small message: the sort of commit
# that "Updated index.css" was, which rewrote 104 files, deleted 32 of them (tests, CI, CLAUDE.md among them) and
# undid a day's work. Tests and CI can't catch that on their own, because the same commit deletes them.
#
#   scripts/stale-snapshot-guard.sh <base> <head>     checks every non-merge commit in base..head
#
# A commit that really is a big clean-up says so with [bulk-ok] in its message. Deleting a protected file never passes.
set -euo pipefail

base="${1:?base ref}"; head="${2:?head ref}"
MAX_FILES=30        # touching this many files...
MAX_DELETED=5       # ...and deleting this many of them is a bulk change, not an edit
ONE_FILE_FILES=3    # a message like "Updated x.css" must stay within this many files
PROTECTED=(.github/workflows/checks.yml .github/workflows/stale-snapshot-guard.yml scripts/stale-snapshot-guard.sh CLAUDE.md)

# An all-zero base (first push of a branch) has nothing to compare with.
if [[ "$base" =~ ^0+$ ]]; then echo "no base to compare with; nothing to check"; exit 0; fi

# Read the list first: a failure inside the loop's own $(...) would be swallowed and the guard would pass unchecked.
if ! commits=$(git rev-list --no-merges --reverse "$base..$head"); then
  echo "::error::Could not list the commits in $base..$head, so nothing was checked."
  exit 2
fi

bad=0
for c in $commits; do
  subject=$(git log -1 --format=%s "$c")
  message=$(git log -1 --format=%B "$c")
  files=$(git show --name-only --format= "$c" | grep -c . || true)
  deleted=$(git show --diff-filter=D --name-only --format= "$c" | grep -c . || true)

  for p in "${PROTECTED[@]}"; do
    if git show --diff-filter=D --name-only --format= "$c" | grep -qxF "$p"; then
      echo "::error::$(git rev-parse --short "$c") \"$subject\" deletes $p, which has to stay."
      bad=1
    fi
  done

  [[ "$message" == *"[bulk-ok]"* ]] && continue

  if (( files >= MAX_FILES && deleted >= MAX_DELETED )); then
    echo "::error::$(git rev-parse --short "$c") \"$subject\" changes $files files and deletes $deleted. That looks like a stale snapshot, not an edit. If it is a real clean-up, add [bulk-ok] to the message."
    bad=1
  elif [[ "$subject" =~ ^Update(d)?\ [^[:space:]]+$ ]] && (( files > ONE_FILE_FILES )); then
    echo "::error::$(git rev-parse --short "$c") \"$subject\" names one file but changes $files. A tool probably saved a stale copy of the whole repo."
    bad=1
  fi
done

(( bad )) && exit 1
echo "no stale-snapshot commits in $base..$head"
