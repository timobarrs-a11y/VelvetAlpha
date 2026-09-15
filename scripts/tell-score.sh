#!/usr/bin/env bash
# Counts the "generic AI-built site" fingerprints described in
# src/docs/generic-tells-and-counters.md so progress is measurable.
# Usage: bash scripts/tell-score.sh        (run from repo root)
set -u
cd "$(dirname "$0")/.."

n()  { printf "%6s  %s\n" "$1" "$2"; }
cnt() { grep -rIoE --include='*.tsx' --include='*.ts' -- "$1" src | wc -l | tr -d ' '; }
cntw() { grep -rIiE --include='*.tsx' --include='*.ts' -- "$1" src | wc -l | tr -d ' '; }

echo "── Provenance ──────────────────────────────────────────────"
n "$(grep -c '"name": "vite-react-typescript-starter"' package.json)" 'package.json still named after the starter template'
n "$([ -d .bolt ] && echo 1 || echo 0)" '.bolt/ directory present'
n "$(grep -c 'bolt.new/static/og_default' index.html)" 'og:image points at the bolt.new default'
n "$(ls public/ab-testing-designs/*.zip 2>/dev/null | wc -l | tr -d ' ')" 'zip archives shipped in public/'
n "$(grep -c 'href: .#.' src/components/Footer.tsx)" 'footer social links pointing at "#"'
n "$([ -d public/screenshots ] && echo 0 || echo 1)" 'manifest screenshots referenced but missing'
n "$(git log --format='%s' | grep -cE '^(Updated|Added|Create|Fix missing) [A-Za-z]+\.(tsx?|css|toml)$')" 'auto-generated commit subjects ("Updated X.tsx")'

echo "── Visual dialect ──────────────────────────────────────────"
n "$(grep -rl --include='*.tsx' 'Sparkles' src | wc -l | tr -d ' ')" 'files importing the Sparkles icon'
n "$(cnt 'hover:scale-1[0-9]+')" 'hover:scale-* utilities'
n "$(cnt 'whileHover=\{\{ *scale')" 'framer whileHover scale'
n "$(cnt 'transition-all')" 'transition-all'
n "$(cnt 'backdrop-blur')" 'backdrop-blur'
n "$(cnt 'bg-gradient-to-[a-z]+ from-(rose|pink|purple|violet|fuchsia|indigo|amber|orange)-[0-9]+')" 'raw-palette gradients'
n "$(grep -rIoE --include='*.tsx' 'initial=\{\{ *opacity: *0, *y: *-?[0-9]+' src | grep -oE 'y: *-?[0-9]+' | sort -u | wc -l | tr -d ' ')" 'distinct entrance y-offsets (want 1)'
n "$(grep -rIoE --include='*.tsx' '#[0-9a-fA-F]{6}\b' src | sed 's/.*://' | tr 'A-F' 'a-f' | sort -u | wc -l | tr -d ' ')" 'distinct hex colours in TSX (want ≈ token count)'
n "$(cnt 'onMouseEnter=\{[^}]*style\.')" 'inline-style hover mutations'
n "$(grep -oE 'family=[A-Za-z+0-9]+' index.html | wc -l | tr -d ' ')" 'Google Font families loaded on every page'

echo "── Copy ────────────────────────────────────────────────────"
n "$(cntw 'Something went wrong')" '"Something went wrong"'
n "$(cntw '\bLoading\.\.\.')" '"Loading..."'
n "$(cntw '\bDiscover\b')" '"Discover"'
n "$(cntw '\bjourney\b')" '"journey"'
n "$(cntw '\bpersonali[sz]ed\b')" '"personalized"'
n "$(cntw '\b(seamless|unleash|elevate|empower|effortless|supercharge)')" 'marketing verbs'
n "$(cnt '✨')" '✨'
n "$(grep -rIoE --include='*.tsx' '>[^<]*—[^<]*<|"[^"]*—[^"]*"' src | wc -l | tr -d ' ')" 'em-dashes in UI strings'
n "$(cnt "(\|\||\?\?) *'Companion'")" '"Companion" used as a fallback name'

echo "── Coherence ───────────────────────────────────────────────"
n "$(cnt 'toLocale(Date|Time)?String\(')" 'ad-hoc date/time formatting call sites'
n "$(cnt 'bg-white\b')" 'bg-white in a dark product'
n "$(cnt ': any\b|as any\b')" 'TypeScript any'
n "$(cnt 'console\.log')" 'console.log'
n "$(wc -l < src/App.tsx | tr -d ' ')" 'lines in App.tsx'
n "$(grep -c useState src/App.tsx)" 'useState calls in App.tsx'

echo "── Accessibility ───────────────────────────────────────────"
n "$(cnt '<button')" '<button> elements'
n "$(cnt 'aria-label')" 'aria-label attributes'
n "$(grep -rl --include='*.tsx' --include='*.ts' 'usePrefersReducedMotion\|prefers-reduced-motion' src | wc -l | tr -d ' ')" 'files honouring reduced motion'
