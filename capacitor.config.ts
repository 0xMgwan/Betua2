import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gold.guap.app',
  appName: 'GUAP',
  webDir: 'public',
  server: {
    url: 'https://www.guap.gold',
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
