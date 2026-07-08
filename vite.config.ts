import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname;

export default defineConfig({
  // Vite 入口在 dev/，根目录的 index.html 是 GitHub Pages 跳转页
  root: 'dev',
  publicDir: false,
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
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(projectRoot, 'tests/vitest-setup.ts'),
    root: projectRoot,
  },
});
