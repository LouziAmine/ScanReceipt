export const environment = {
  production: true,
  /** True only in the browser demo published on GitHub Pages (`ng build --configuration demo`). */
  webDemo: false,
  appVersion: '1.0.0',
  databaseName: 'scanreceipt',
  databaseVersion: 1,
  /** Shown in Settings; required by both stores. Forks should point to their own policy. */
  privacyPolicyUrl: 'https://github.com/LouziAmine/ScanReceipt/blob/master/PRIVACY.md',
} as const;
