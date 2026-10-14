#!/usr/bin/env node
// Checks that every language has a translation for every English text of the app.
//
// The English texts are the keys (src/app/presentation/i18n/i18n.ts). They are found in:
//   templates      'Review receipt' | t        ('A' : 'B') | t       x | plural: 'one' : 'other'
//   code           t('…')   tp(n, 'one', 'other')   marker('…')
//   domain / app   new DomainError('…')   new AppError('…')   hint: '…'   messageOf(e, '…')
//                  default category names
// For plurals, the key is the "other" form.
//
// Usage: node scripts/i18n-check.mjs           fails when a translation is missing
//        node scripts/i18n-check.mjs --keys    prints every key, one JSON string per line
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APP = join(ROOT, 'src/app');
const TRANSLATIONS = join(APP, 'presentation/i18n/translations');
const LANGUAGES = ['fr', 'ar', 'zh', 'es', 'de', 'pt'];

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === TRANSLATIONS ? [] : files(path);
    return /\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

const STRING = String.raw`(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")`;
const unescape = (s) => s.replace(/\\(['"\\])/g, '$1');
const value = (m, i) => unescape(m[i] ?? m[i + 1] ?? '');

/** The quoted strings of `text` that are results: alone, or a branch of `? :` (not `=== 'day'`). */
function literals(text) {
  return [...text.matchAll(new RegExp(String.raw`(^\(\s*|[?:]\s*)${STRING}`, 'g'))].map((m) =>
    value(m, 2),
  );
}

/** Strings right before `| t`: a literal, or every literal of a parenthesized expression. */
function pipeKeys(source) {
  const keys = [];
  for (const match of source.matchAll(/\|\s*t\b/g)) {
    let end = match.index - 1;
    while (end >= 0 && /\s/.test(source[end])) end--;
    const last = source[end];
    if (last === "'" || last === '"') {
      // Walk back to the opening quote, skipping escaped ones.
      let start = end - 1;
      while (start >= 0 && !(source[start] === last && source[start - 1] !== '\\')) start--;
      keys.push(unescape(source.slice(start + 1, end)));
    } else if (last === ')') {
      let depth = 0;
      let start = end;
      for (; start >= 0; start--) {
        if (source[start] === ')') depth++;
        if (source[start] === '(' && --depth === 0) break;
      }
      keys.push(...literals(source.slice(start, end + 1)));
    }
  }
  return keys;
}

const PATTERNS = [
  [new RegExp(String.raw`\bt\(\s*${STRING}`, 'g'), [1]],
  [new RegExp(String.raw`\bmarker\(\s*${STRING}`, 'g'), [1]],
  [new RegExp(String.raw`\btp\(\s*[^,]+,\s*${STRING}\s*,\s*${STRING}`, 'g'), [3]],
  [new RegExp(String.raw`\|\s*plural\s*:\s*${STRING}\s*:\s*${STRING}`, 'g'), [3]],
  [new RegExp(String.raw`new (?:DomainError|AppError)\(\s*${STRING}`, 'g'), [1]],
  [new RegExp(String.raw`\bhint:\s*${STRING}`, 'g'), [1]],
  [new RegExp(String.raw`messageOf\(\s*\w+,\s*${STRING}`, 'g'), [1]],
  [new RegExp(String.raw`\bfallback = ${STRING}`, 'g'), [1]],
];

const used = new Map();
for (const path of files(APP)) {
  const source = readFileSync(path, 'utf8');
  const found = [...pipeKeys(source)];
  for (const [pattern, groups] of PATTERNS) {
    for (const m of source.matchAll(pattern)) found.push(...groups.map((g) => value(m, g)));
  }
  if (path.endsWith('domain/categories/category.ts')) {
    for (const m of source.matchAll(new RegExp(String.raw`\{ id: [^}]*name: ${STRING}`, 'g'))) {
      found.push(value(m, 1));
    }
  }
  for (const key of found) {
    if (key.trim() && !used.has(key)) used.set(key, relative(ROOT, path));
  }
}

if (process.argv.includes('--keys')) {
  for (const key of [...used.keys()].sort()) console.log(JSON.stringify(key));
  process.exit(0);
}

/** Top-level keys of `export const xx: Translations = { … }` (two-space indent, as Prettier writes it). */
function translationKeys(language) {
  const source = readFileSync(join(TRANSLATIONS, `${language}.ts`), 'utf8');
  const keyed = new RegExp(String.raw`^  (?:${STRING}|([A-Za-z_$][\w$]*)):`, 'gm');
  return new Set([...source.matchAll(keyed)].map((m) => (m[3] ?? unescape(m[1] ?? m[2] ?? ''))));
}

let failed = false;
for (const language of LANGUAGES) {
  const keys = translationKeys(language);
  const missing = [...used.keys()].filter((key) => !keys.has(key));
  const unused = [...keys].filter((key) => !used.has(key));
  if (missing.length > 0) {
    failed = true;
    console.error(`\n${language}: ${missing.length} missing`);
    for (const key of missing) console.error(`  ${JSON.stringify(key)}  (${used.get(key)})`);
  }
  if (unused.length > 0) {
    console.warn(`\n${language}: ${unused.length} not used anymore`);
    for (const key of unused) console.warn(`  ${JSON.stringify(key)}`);
  }
}
console.log(`\n${used.size} texts, ${LANGUAGES.length} languages.`);
process.exit(failed ? 1 : 0);
