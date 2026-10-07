#!/usr/bin/env node
// Sets the same app version everywhere and increments the store build number.
//   npm run version:set -- 1.1.0
// Updates package.json, src/environments/environment.ts, Android (versionName / versionCode)
// and iOS (MARKETING_VERSION / CURRENT_PROJECT_VERSION). Both stores require a higher build
// number on every upload, so it always goes up by one.
import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: npm run version:set -- <major.minor.patch>, e.g. 1.1.0');
  process.exit(1);
}

function update(path, transform, ...required) {
  const before = readFileSync(path, 'utf8');
  for (const pattern of required) {
    if (!pattern.test(before)) throw new Error(`${pattern} not found in ${path}`);
  }
  writeFileSync(path, transform(before));
}

const gradlePath = 'android/app/build.gradle';
const gradle = readFileSync(gradlePath, 'utf8');
const build = Number(/versionCode (\d+)/.exec(gradle)?.[1] ?? 0) + 1;

update(
  'package.json',
  (s) => s.replace(/"version": "[^"]+"/, `"version": "${version}"`),
  /"version": /,
);
for (const path of ['src/environments/environment.ts', 'src/environments/environment.demo.ts']) {
  update(path, (s) => s.replace(/appVersion: '[^']+'/, `appVersion: '${version}'`), /appVersion: /);
}
update(gradlePath, (s) =>
  s
    .replace(/versionCode \d+/, `versionCode ${build}`)
    .replace(/versionName "[^"]+"/, `versionName "${version}"`),
);
update(
  'ios/App/App.xcodeproj/project.pbxproj',
  (s) =>
    s
      .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
      .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`),
  /MARKETING_VERSION = /,
  /CURRENT_PROJECT_VERSION = /,
);

console.log(`Version ${version} (build ${build}) set for web, Android and iOS.`);
