// JavaScript mirror of PostgreSQL's `to_tsvector('english', text)` lexeme set:
// the default parser's word split, the english.stop list, and the Snowball
// English (Porter2) stemmer. Used by run_eval.mjs --mirror so the retrieval eval
// can run without a database. Validated against real to_tsvector output
// (see scripts/memory-eval/lib/pg_english.test.mjs). If Postgres and this file
// ever disagree, Postgres is right; pass --terms from a real database instead.

// share/tsearch_data/english.stop (PostgreSQL 17)
const STOP = new Set(`i me my myself we our ours ourselves you your yours yourself yourselves he him his himself she her hers herself it its itself they them their theirs themselves what which who whom this that these those am is are was were be been being have has had having do does did doing a an the and but if or because as until while of at by for with about against between into through during before after above below to from up down in out on off over under again further then once here there when where why how all any both each few more most other some such no nor not only own same so than too very s t can will just don should now`.split(/\s+/));

const VOWELS = /[aeiouy]/;
function markY(w) {
  // y is a consonant when it starts the word or follows a vowel
  const a = w.split('');
  if (a[0] === 'y') a[0] = 'Y';
  for (let i = 1; i < a.length; i++) if (a[i] === 'y' && 'aeiouy'.includes(a[i - 1].toLowerCase()) && a[i - 1] !== 'Y') a[i] = 'Y';
  return a.join('');
}
function regions(w) {
  // R1: after the first non-vowel following a vowel; R2: same again within R1.
  const r = s => { for (let i = 1; i < s.length; i++) if (!VOWELS.test(s[i]) && VOWELS.test(s[i - 1])) return i + 1; return s.length; };
  let r1 = r(w);
  if (/^(gener|commun|arsen)/.test(w)) r1 = w.match(/^(gener|commun|arsen)/)[1].length;
  const r2 = r1 + r(w.slice(r1));
  return { r1, r2 };
}
// s ends with a short syllable: vowel + non-vowel(not w/x/Y) preceded by a non-vowel, or a vowel + non-vowel at the start of the word.
const endsShort = s => { const n = s.length; return (n >= 3 && VOWELS.test(s[n - 2]) && !VOWELS.test(s[n - 1]) && !'wxY'.includes(s[n - 1]) && !VOWELS.test(s[n - 3])) || (n === 2 && VOWELS.test(s[0]) && !VOWELS.test(s[1])); };
const isShort = w => regions(w).r1 >= w.length && endsShort(w);
const EXC1 = { skis: 'ski', skies: 'sky', dying: 'die', lying: 'lie', tying: 'tie', idly: 'idl', gently: 'gentl', ugly: 'ugli', early: 'earli', only: 'onli', singly: 'singl', sky: 'sky', news: 'news', howe: 'howe', atlas: 'atlas', cosmos: 'cosmos', bias: 'bias', andes: 'andes' };
const EXC2 = new Set(['inning', 'outing', 'canning', 'herring', 'earring', 'proceed', 'exceed', 'succeed']);
const DOUBLE = /(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/;
const LI_END = /[cdeghkmnrt]$/;

export function stem(word) {
  let w = word.toLowerCase();
  if (w.length <= 2) return w;
  if (EXC1[w] !== undefined) return EXC1[w];
  if (w[0] === "'") w = w.slice(1);
  w = markY(w);
  const R = () => regions(w);
  // step 0
  w = w.replace(/('s'|'s|')$/, '');
  // step 1a
  if (/sses$/.test(w)) w = w.slice(0, -2);
  else if (/(ied|ies)$/.test(w)) w = w.length > 4 ? w.slice(0, -2) : w.slice(0, -1);
  else if (/(us|ss)$/.test(w)) { /* keep */ }
  else if (/s$/.test(w) && /[aeiouy]/.test(w.slice(0, -2))) w = w.slice(0, -1);
  if (EXC2.has(w)) return w.toLowerCase();
  // step 1b
  { const m = w.match(/(eedly|eed)$/); let done = false;
    if (m) { if (w.length - m[1].length >= R().r1) w = w.slice(0, -m[1].length) + 'ee'; done = true; }
    if (!done) { const m2 = w.match(/(ingly|edly|ing|ed)$/);
      if (m2 && VOWELS.test(w.slice(0, -m2[1].length))) {
        w = w.slice(0, -m2[1].length);
        if (/(at|bl|iz)$/.test(w)) w += 'e';
        else if (DOUBLE.test(w)) w = w.slice(0, -1);
        else if (isShort(w)) w += 'e';
      } } }
  // step 1c
  if (/[yY]$/.test(w) && w.length > 2 && !VOWELS.test(w[w.length - 2])) w = w.slice(0, -1) + 'i';
  // step 2
  { const { r1 } = R(); const inR1 = suf => w.length - suf.length >= r1;
    const tries = [['ization', 'ize'], ['ational', 'ate'], ['fulness', 'ful'], ['ousness', 'ous'], ['iveness', 'ive'], ['tional', 'tion'], ['biliti', 'ble'], ['lessli', 'less'], ['entli', 'ent'], ['ation', 'ate'], ['alism', 'al'], ['aliti', 'al'], ['ousli', 'ous'], ['iviti', 'ive'], ['fulli', 'ful'], ['enci', 'ence'], ['anci', 'ance'], ['abli', 'able'], ['izer', 'ize'], ['ator', 'ate'], ['alli', 'al'], ['bli', 'ble'], ['ogi', 'og'], ['li', '']];
    for (const [suf, rep] of tries) { if (w.endsWith(suf)) { if (inR1(suf)) { if (suf === 'ogi') { if (w[w.length - 4] === 'l') w = w.slice(0, -1); } else if (suf === 'li') { if (LI_END.test(w.slice(0, -2))) w = w.slice(0, -2); } else w = w.slice(0, -suf.length) + rep; } break; } } }
  // step 3
  { const { r1, r2 } = R(); const inR1 = suf => w.length - suf.length >= r1;
    const tries = [['ational', 'ate'], ['tional', 'tion'], ['alize', 'al'], ['icate', 'ic'], ['iciti', 'ic'], ['ative', ''], ['ical', 'ic'], ['ness', ''], ['ful', '']];
    for (const [suf, rep] of tries) { if (w.endsWith(suf)) { if (inR1(suf)) { if (suf === 'ative') { if (w.length - 5 >= r2) w = w.slice(0, -5); } else w = w.slice(0, -suf.length) + rep; } break; } } }
  // step 4
  { const { r2 } = R(); const inR2 = suf => w.length - suf.length >= r2;
    const tries = ['ement', 'ance', 'ence', 'able', 'ible', 'ment', 'ant', 'ent', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize', 'ion', 'al', 'er', 'ic'];
    for (const suf of tries) { if (w.endsWith(suf)) { if (inR2(suf)) { if (suf === 'ion') { if (/[st]$/.test(w.slice(0, -3))) w = w.slice(0, -3); } else w = w.slice(0, -suf.length); } break; } } }
  // step 5
  { const { r1, r2 } = R();
    if (w.endsWith('e')) { if (w.length - 1 >= r2 || (w.length - 1 >= r1 && !endsShort(w.slice(0, -1)))) w = w.slice(0, -1); }
    else if (w.endsWith('l') && w.length - 1 >= r2 && w[w.length - 2] === 'l') w = w.slice(0, -1); }
  return w.toLowerCase();
}

/** Tokens as the default parser splits them: words (letters/digits, hyphenated
 *  compounds emit both the whole and the parts), apostrophes split ("I'm" -> i, m). */
export function tokenize(text) {
  const out = [];
  for (const raw of String(text).split(/[^\p{L}\p{N}'’\-_/]+/u)) {
    if (!raw) continue;
    const parts = raw.split(/['’]/).filter(Boolean);
    for (const p of parts) {
      if (/^-+$|^\/+$|^_+$/.test(p)) continue;
      const clean = p.replace(/^[-_\/]+|[-_\/]+$/g, '');
      if (!clean) continue;
      if (/[-_]/.test(clean) && /^[\p{L}\p{N}]+([-_][\p{L}\p{N}]+)+$/u.test(clean)) {
        out.push(clean);
      } else if (clean.includes('/')) {
        out.push(clean); // the parser keeps "a/b" as one file-like token
      } else out.push(clean);
    }
  }
  return out;
}

/** Set of stemmed lexemes to_tsvector('english', text) would produce (order not preserved). */
export function lexemes(text) {
  const out = new Set();
  for (const t of tokenize(text)) {
    const low = t.toLowerCase();
    if (/^\d+$/.test(low)) { out.add(low); continue; }
    if (low.includes('/')) { out.add(low); continue; }
    if (/[-_]/.test(low)) { // hyphenated compound: the whole word stemmed as one string (hyphen counts as a consonant), plus the non-stopword parts; a compound containing a number emits only its parts
      const parts = low.split(/[-_]/);
      if (!parts.some(p => /^\d+$/.test(p))) out.add(stem(low));
      for (const p of parts) if (p && !STOP.has(p)) out.add(/^\d+$/.test(p) ? p : stem(p));
      continue; }
    if (STOP.has(low)) continue;
    out.add(stem(low));
  }
  return out;
}
