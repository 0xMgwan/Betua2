import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gold.guap.android',
  appName: 'GUAP',
  webDir: 'public',
  server: {
    url: 'https://guap.gold/markets',
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  ios: {
    contentInset: 'always'
  }
};

export default config;
