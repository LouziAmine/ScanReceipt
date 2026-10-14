#!/usr/bin/env node
// Writes the English "What's new" text of both stores from CHANGELOG.md.
//   npm run store:notes
// Takes the section of the version in package.json ("## [1.1.0]"), or "## [Unreleased]", and keeps
// the first sentence of each entry. Writes:
//   fastlane/metadata/android/en-US/changelogs/<versionCode>.txt   (Google Play, 500 characters max)
//   fastlane/metadata/ios/en-US/release_notes.txt                   (App Store, 4000 characters max)
// Other languages use their committed text (changelogs/default.txt, release_notes.txt).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

const version = JSON.parse(read('package.json')).version;
const versionCode = /versionCode (\d+)/.exec(read('android/app/build.gradle'))?.[1];
if (!versionCode) throw new Error('versionCode not found in android/app/build.gradle');

/** The lines of one "## [...]" section of the changelog, or null. */
function section(changelog, title) {
  const lines = changelog.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${title}]`));
  if (start === -1) return null;
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** "- **Settings > Language** switches…" (wrapped over several lines) -> first plain sentence. */
function entries(lines) {
  const items = [];
  for (const line of lines) {
    if (line.startsWith('- ')) items.push(line.slice(2));
    else if (/^\s+\S/.test(line) && items.length > 0) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items.map((item) => {
    const plain = item
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*`]/g, '')
      .trim();
    return /^.+?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain;
  });
}

function fit(items, max) {
  let text = '';
  for (const item of items) {
    const next = `${text}${text ? '\n' : ''}• ${item}`;
    if (next.length > max) break;
    text = next;
  }
  return text || 'Bug fixes and improvements.';
}

const changelog = read('CHANGELOG.md');
const lines = section(changelog, version) ?? section(changelog, 'Unreleased') ?? [];
const items = entries(lines);

function write(path, text) {
  const file = join(ROOT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${text}\n`);
  console.log(`${path} (${text.length} characters)`);
}

write(`fastlane/metadata/android/en-US/changelogs/${versionCode}.txt`, fit(items, 500));
write('fastlane/metadata/ios/en-US/release_notes.txt', fit(items, 4000));
