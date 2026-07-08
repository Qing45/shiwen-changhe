import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

export default defineConfig({
  // Vite 入口在 dev/，根目录的 index.html 是 GitHub Pages 跳转页
  root: 'dev',
  // 项目级 public/（图标、manifest 配套资源等）一并拷到 dist/
  publicDir: path.resolve(projectRoot, 'public'),
  // GitHub Pages 部署在 https://<user>.github.io/<repo>/，所有静态资源 base 用此路径
  base: '/shiwen-changhe/',
  resolve: {
    alias: {
      '/src': path.resolve(projectRoot, 'src'),
    },
  },
  server: {
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: path.resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      // autoUpdate：新 SW 装好后下次访问自动激活；UpdateToast 检测到后提示用户刷新
      registerType: 'autoUpdate',
      injectRegister: false, // 走 manual register（在 UpdateToast 里），方便显示提示
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '诗文长河',
        short_name: '诗文长河',
        description: '中国古典诗词可视化与飞花令游戏',
        lang: 'zh-CN',
        theme_color: '#1a2855',
        background_color: '#050818',
        display: 'standalone',
        orientation: 'any',
        scope: '/shiwen-changhe/',
        start_url: '/shiwen-changhe/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 大型预生成资源（不缓存，避免 stale 内容一直滞留）
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 老 SW 切走时清空缓存：每次新版都从网络拉最新
        cleanupOutdatedCaches: true,
        // 字体走 CacheFirst 一般可以，但本项目字体来自 Google Fonts CDN，先走 StaleWhileRevalidate
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // 开发时也启用 SW，方便本地试
        enabled: true,
        type: 'module',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(projectRoot, 'tests/vitest-setup.ts'),
    root: projectRoot,
  },
});
