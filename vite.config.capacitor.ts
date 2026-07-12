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
    // Capacitor 包装 WebView，资源从 APK 读 —— PWA 的 SW 离线缓存是冗余的，
    // 且 WebView 里 register SW 可能干扰首屏路由解析。直接禁用。
    VitePWA({ disable: true }),
  ],
});
