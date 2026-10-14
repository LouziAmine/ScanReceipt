#!/usr/bin/env node
// Takes the App Store and Google Play screenshots, in every language of the app, from the web build.
//
//   npx ng build --configuration development   # web build with SQLite (WebAssembly), no demo banner
//   npm run store:screenshots                  # all languages
//   npm run store:screenshots -- fr de         # some of them
// Browser: `npx playwright-core install chromium-headless-shell` once, or CHROMIUM_PATH=/path/to/chrome.
//
// For each language, sample receipts (with receipt photos drawn here) are restored through
// Settings > Backup, as a person would, then each screen is captured at the store sizes:
//   iPhone 6.7"  1290 x 2796   fastlane/screenshots/ios/<locale>/
//   iPad 13"     2048 x 2732   fastlane/screenshots/ios/<locale>/
//   Android      1080 x 2160   fastlane/metadata/android/<locale>/images/phoneScreenshots/
// Also draws the Play icon (512 px) and feature graphic (1024 x 500) for the default language.
// Generated files are not committed (.gitignore): the release workflows make them again.
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import { chromium } from 'playwright-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WWW = join(ROOT, 'www');
const FASTLANE = join(ROOT, 'fastlane');

/** App language -> store locales, sample currency and stores. */
const LANGUAGES = {
  en: {
    ios: 'en-US',
    play: 'en-US',
    currency: 'USD',
    stores: [
      'Whole Foods Market',
      'Blue Bottle Coffee',
      'Uber',
      'CVS Pharmacy',
      'Staples',
      "Trader Joe's",
    ],
  },
  fr: {
    ios: 'fr-FR',
    play: 'fr-FR',
    currency: 'EUR',
    stores: [
      'Carrefour',
      'Café de Flore',
      'SNCF',
      'Pharmacie Lafayette',
      'Bureau Vallée',
      'Monoprix',
    ],
  },
  ar: {
    ios: 'ar-SA',
    play: 'ar',
    currency: 'SAR',
    stores: ['Panda', 'Al Baik', 'Careem', 'Nahdi Pharmacy', 'Jarir Bookstore', 'Danube'],
  },
  zh: {
    ios: 'zh-Hans',
    play: 'zh-CN',
    currency: 'CNY',
    stores: ['Hema Fresh', 'Starbucks', 'DiDi', 'Watsons', 'Deli Office', 'FamilyMart'],
  },
  es: {
    ios: 'es-ES',
    play: 'es-ES',
    currency: 'EUR',
    stores: [
      'Mercadona',
      'Café Comercial',
      'Cabify',
      'Farmacia Central',
      'Folder',
      'Carrefour Express',
    ],
  },
  de: {
    ios: 'de-DE',
    play: 'de-DE',
    currency: 'EUR',
    stores: ['REWE', 'Einstein Kaffee', 'Deutsche Bahn', 'dm-drogerie markt', 'McPaper', 'EDEKA'],
  },
  pt: {
    ios: 'pt-BR',
    play: 'pt-BR',
    currency: 'BRL',
    stores: ['Pão de Açúcar', 'Starbucks', '99 Táxi', 'Drogasil', 'Kalunga', 'Carrefour'],
  },
};

/** Stores above are, in order: groceries, dining, transportation, health, office, groceries. */
const STORE_OF = { groceries: [0, 5], dining: [1], transportation: [2], health: [3], office: [4] };

/** The sample receipts: category, total in cents, days ago, hour. */
const SAMPLES = [
  { category: 'groceries', cents: 8642, daysAgo: 0, hour: 18 },
  { category: 'dining', cents: 1275, daysAgo: 0, hour: 9 },
  { category: 'transportation', cents: 2390, daysAgo: 1, hour: 22 },
  { category: 'health', cents: 3415, daysAgo: 3, hour: 11 },
  { category: 'office', cents: 5899, daysAgo: 6, hour: 15 },
  { category: 'groceries', cents: 4730, daysAgo: 9, hour: 17 },
  { category: 'dining', cents: 2860, daysAgo: 13, hour: 20 },
  { category: 'transportation', cents: 1840, daysAgo: 17, hour: 8 },
  { category: 'groceries', cents: 6215, daysAgo: 21, hour: 12 },
  { category: 'office', cents: 1999, daysAgo: 26, hour: 10 },
];

const CATEGORIES = [
  { id: 'groceries', name: 'Groceries', color: 'green', icon: 'cart', sortOrder: 0 },
  { id: 'dining', name: 'Dining', color: 'orange', icon: 'restaurant', sortOrder: 1 },
  { id: 'transportation', name: 'Transportation', color: 'blue', icon: 'car', sortOrder: 2 },
  { id: 'health', name: 'Health', color: 'pink', icon: 'medkit', sortOrder: 3 },
  { id: 'office', name: 'Office supplies', color: 'indigo', icon: 'briefcase', sortOrder: 4 },
  { id: 'other', name: 'Other', color: 'gray', icon: 'pricetag', sortOrder: 99 },
].map((c) => ({ ...c, isCustom: false }));

const DEVICES = {
  iphone: {
    viewport: { width: 430, height: 932 },
    scale: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    dir: (lang) => join(FASTLANE, 'screenshots/ios', LANGUAGES[lang].ios),
    prefix: 'iphone',
  },
  ipad: {
    viewport: { width: 1024, height: 1366 },
    scale: 2,
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
    dir: (lang) => join(FASTLANE, 'screenshots/ios', LANGUAGES[lang].ios),
    prefix: 'ipad',
  },
  android: {
    viewport: { width: 360, height: 720 },
    scale: 3,
    userAgent:
      'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    dir: (lang) =>
      join(FASTLANE, 'metadata/android', LANGUAGES[lang].play, 'images/phoneScreenshots'),
    prefix: 'android',
  },
};

/** The screens shown in the stores, in order. */
const SCREENS = [
  { name: 'receipts', path: () => '/receipts' },
  { name: 'receipt', path: (ids) => `/receipts/${ids[0]}` },
  { name: 'summary', path: () => '/receipts/summary' },
  { name: 'categories', path: () => '/categories' },
  { name: 'export', path: () => '/export' },
];

// The browser draws the app in a phone frame on wide screens; the iPad app is full screen.
const FULL_SCREEN_CSS = `
  body { background: var(--ion-background-color) !important; }
  ion-app.phone-frame { inset: 0 !important; width: auto !important; max-height: none !important;
    margin: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }`;

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function serve() {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://x').pathname);
    let file = join(WWW, path);
    // Unknown paths are app routes: index.html, as GitHub Pages does with 404.html.
    if (!file.startsWith(WWW) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(WWW, 'index.html');
    }
    response.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** A paper receipt as a JPEG, drawn by the browser. */
async function receiptPhoto(browser, store, cents, currency, date) {
  const page = await browser.newPage({ viewport: { width: 600, height: 900 } });
  const amount = (value) => (value / 100).toFixed(2);
  const tax = Math.round(cents * 0.08);
  const items = [0.42, 0.31, 0.27].map((share, i) => [
    ['Item A', 'Item B', 'Item C'][i],
    amount(Math.round((cents - tax) * share)),
  ]);
  await page.setContent(`
    <body style="margin:0;background:#6b6b6b;display:grid;place-items:center;height:900px">
      <div style="width:440px;background:#fbfaf6;padding:36px 32px;font:20px 'Courier New',monospace;
        color:#222;box-shadow:0 10px 30px rgb(0 0 0/35%);transform:rotate(-1.5deg)">
        <div style="text-align:center;font-weight:700;font-size:26px">${store.toUpperCase()}</div>
        <div style="text-align:center;margin:6px 0 22px">${date.toLocaleDateString('en-US')} ${date.getHours()}:24</div>
        ${items.map(([n, v]) => `<div style="display:flex;justify-content:space-between"><span>${n}</span><span>${v}</span></div>`).join('')}
        <div style="border-top:2px dashed #555;margin:18px 0 10px"></div>
        <div style="display:flex;justify-content:space-between"><span>TAX</span><span>${amount(tax)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:24px">
          <span>TOTAL ${currency}</span><span>${amount(cents)}</span></div>
        <div style="text-align:center;margin-top:26px">THANK YOU</div>
      </div>
    </body>`);
  const bytes = await page.screenshot({ type: 'jpeg', quality: 80 });
  await page.close();
  return new Uint8Array(bytes);
}

/** A ScanReceipt backup (ZIP with data.json and the photos) for one language. */
async function sampleBackup(browser, lang) {
  const { currency, stores } = LANGUAGES[lang];
  const files = {};
  const now = new Date();
  const receipts = [];
  for (const [i, sample] of SAMPLES.entries()) {
    const choices = STORE_OF[sample.category];
    const store = stores[choices[i % choices.length]];
    const date = new Date(now);
    date.setDate(now.getDate() - sample.daysAgo);
    date.setHours(Math.min(sample.hour, now.getHours() || sample.hour), 24, 0, 0);
    const id = `sample-${i + 1}`;
    const imagePath = `images/${id}.jpg`;
    files[imagePath] = await receiptPhoto(browser, store, sample.cents, currency, date);
    const tax = Math.round(sample.cents * 0.08);
    receipts.push({
      id,
      store,
      purchasedAt: date.toISOString(),
      total: { cents: sample.cents, currency },
      tax: { cents: tax, currency },
      original: null,
      categoryId: sample.category,
      note: '',
      imagePath,
      ocrText: store.toUpperCase(),
      doubtfulFields: [],
      createdAt: date.toISOString(),
      updatedAt: date.toISOString(),
    });
  }
  files['data.json'] = strToU8(
    JSON.stringify({
      format: 'scanreceipt-backup',
      version: 1,
      exportedAt: now.toISOString(),
      settings: {
        language: lang,
        currency,
        dateFormat: lang === 'en' ? 'MM/DD/YYYY' : 'DD/MM/YYYY',
        weekStartsOn: lang === 'en' ? 0 : 1,
        defaultCategoryId: 'other',
        imageQuality: 'high',
        theme: 'light',
        warnOnLowConfidence: true,
        backupReminder: false,
      },
      categories: CATEGORIES,
      storeRules: [],
      receipts,
    }),
  );
  return { zip: zipSync(files), ids: receipts.map((r) => r.id) };
}

async function restore(page, base, zip) {
  await page.goto(`${base}/backup`);
  await page.locator('ion-button[fill="outline"]').first().click();
  await page.locator('ion-alert .alert-button-role-confirm').click();
  const chooser = await page.waitForEvent('filechooser');
  await chooser.setFiles({
    name: 'backup.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from(zip),
  });
  await page.locator('ion-toast').waitFor({ state: 'attached', timeout: 30000 });
}

async function capture(browser, base, lang, device, backup) {
  const spec = DEVICES[device];
  const context = await browser.newContext({
    viewport: spec.viewport,
    deviceScaleFactor: spec.scale,
    userAgent: spec.userAgent,
    isMobile: device !== 'ipad',
    hasTouch: true,
    colorScheme: 'light',
    serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    localStorage.setItem('receipts.dailyChartOpen', '1');
  });
  const page = await context.newPage();
  await restore(page, base, backup.zip);
  const dir = spec.dir(lang);
  mkdirSync(dir, { recursive: true });
  for (const [i, screen] of SCREENS.entries()) {
    await page.goto(base + screen.path(backup.ids));
    await page.addStyleTag({ content: FULL_SCREEN_CSS });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(dir, `${spec.prefix}-${i + 1}-${screen.name}.png`) });
  }
  await context.close();
}

/** Google Play icon (512 x 512) and feature graphic (1024 x 500), default language only. */
async function playGraphics(browser) {
  const dir = join(FASTLANE, 'metadata/android/en-US/images');
  mkdirSync(dir, { recursive: true });
  const icon = readFileSync(join(ROOT, 'public/icon.svg')).toString('base64');
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.setContent(`
    <body style="margin:0;width:1024px;height:500px;display:flex;align-items:center;gap:48px;padding:0 72px;
      box-sizing:border-box;background:linear-gradient(135deg,#0B2B3A,#0F766E);color:#fff;font-family:sans-serif">
      <img src="data:image/svg+xml;base64,${icon}" style="width:220px;height:220px;border-radius:48px">
      <div><div style="font-size:72px;font-weight:800">ScanReceipt</div>
      <div style="font-size:34px;opacity:.9;margin-top:12px">Scan, read and total your receipts. Offline.</div></div>
    </body>`);
  await page.screenshot({ path: join(dir, 'featureGraphic.png') });
  await page.setViewportSize({ width: 512, height: 512 });
  await page.setContent(
    `<body style="margin:0"><img src="data:image/svg+xml;base64,${icon}" style="width:512px;height:512px;display:block"></body>`,
  );
  await page.screenshot({ path: join(dir, 'icon.png') });
  await page.close();
}

async function main() {
  if (!existsSync(join(WWW, 'assets/sql-wasm.wasm'))) {
    console.error('Build the web app first: npx ng build --configuration development');
    process.exit(1);
  }
  const wanted = process.argv.slice(2);
  const langs = wanted.length > 0 ? wanted : Object.keys(LANGUAGES);
  const unknown = langs.filter((l) => !(l in LANGUAGES));
  if (unknown.length > 0) {
    console.error(
      `Unknown language(s): ${unknown.join(', ')}. Known: ${Object.keys(LANGUAGES).join(', ')}`,
    );
    process.exit(1);
  }
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    await playGraphics(browser);
    for (const lang of langs) {
      for (const dir of [DEVICES.iphone.dir(lang), DEVICES.android.dir(lang)]) {
        rmSync(dir, { recursive: true, force: true });
      }
      const backup = await sampleBackup(browser, lang);
      for (const device of Object.keys(DEVICES)) {
        await capture(browser, base, lang, device, backup);
      }
      console.log(`${lang}: ${SCREENS.length * Object.keys(DEVICES).length} screenshots`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
