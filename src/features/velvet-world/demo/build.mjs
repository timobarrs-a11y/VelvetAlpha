// Inlines the street art kit into the demo page so it can be opened as one self-contained HTML file.
// Usage: node src/features/velvet-world/demo/build.mjs <output.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const kit = readFileSync(join(here, '../art/streetArt.js'), 'utf8').replace(/^export /gm, '');
const page = readFileSync(join(here, 'street-test.html'), 'utf8').replace('/*__STREET_ART__*/', () => kit);
const out = process.argv[2] || join(here, 'street-test.built.html');
writeFileSync(out, page);
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
