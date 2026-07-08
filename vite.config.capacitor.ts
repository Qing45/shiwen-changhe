// Capacitor Android build: relative base path so the bundled assets work
// when loaded via file:// or https://localhost in the WebView.
// Use: `vite build --config vite.config.capacitor.ts`
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

export default defineConfig({
  root: 'dev',
  publicDir: path.resolve(projectRoot, 'public'),
  base: './',
  resolve: {
    alias: {
      '/src': path.resolve(projectRoot, 'src'),
    },
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist-capacitor'),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    // Capacitor 包装 WebView，原生层是 PWA host 缺失的场景；
    // 保留 SW 能力便于后续接 capawesome live-updates
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      strategies: 'generateSW',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '诗文长河',
        short_name: '诗文长河',
        description: '中国古典诗词可视化与飞花令游戏',
        lang: 'zh-CN',
        theme_color: '#1a2855',
        background_color: '#050818',
        display: 'standalone',
        orientation: 'any',
        scope: './',
        start_url: './',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
