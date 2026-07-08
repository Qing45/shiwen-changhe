import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shiwen.changhe',
  appName: '诗文长河',
  webDir: 'dist-capacitor',
  // WebView 调试：开发期可改 false 用 chrome://inspect
  // 打包发布时关掉，避免 DevTools 暴露在 release
  android: {
    allowMixedContent: false,
  },
  // Capacitor 8 起 server.androidScheme 默认 'https'，加载 https://localhost
  // 这让 service worker 也能用 https 协议，更接近 PWA 行为
  server: {
    androidScheme: 'https',
  },
};

export default config;
