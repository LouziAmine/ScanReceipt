import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.scanreceipt.mobile',
  appName: 'ScanReceipt',
  webDir: 'www',
  backgroundColor: '#0B2B3A',
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'never',
    scheme: 'ScanReceipt',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
      backgroundColor: '#0B2B3A',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      iosIsEncryption: false,
      androidIsEncryption: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_receipt',
      iconColor: '#0F766E',
    },
  },
};

export default config;
