/** Replaces environment.ts in the `demo` build configuration (GitHub Pages). */
export const environment = {
  production: true,
  /** Browser demo published on GitHub Pages: no camera, no OCR, data kept in this browser. */
  webDemo: true,
  appVersion: '1.0.0',
  databaseName: 'scanreceipt',
  databaseVersion: 1,
  /** Shown in Settings; required by both stores. Forks should point to their own policy. */
  privacyPolicyUrl: 'https://github.com/LouziAmine/ScanReceipt/blob/master/PRIVACY.md',
} as const;
