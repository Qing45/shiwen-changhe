// 把 vite build 的 dist/ 内容拷到仓库根，替换根 index.html。
// 保留 standalone.html / docs/ / src/ / scripts/ 等其它源文件。
// 跑法：`node scripts/deploy-gh-pages.cjs`（或 `npm run build:gh`）。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, 'dist');

// 1) dist/ 必须存在
if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

// 2) 复制 dist/* 到根（不递归 subdirs），覆盖 index.html / manifest / sw.js / icons
const topLevel = fs.readdirSync(dist);
for (const name of topLevel) {
  const src = path.join(dist, name);
  const dst = path.join(root, name);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) continue; // assets/ 单独处理
  fs.copyFileSync(src, dst);
  console.log(`copied ${name}`);
}

// 3) 复制 dist/assets/* 到根 assets/
const assetsSrc = path.join(dist, 'assets');
const assetsDst = path.join(root, 'assets');
if (fs.existsSync(assetsDst)) {
  // 清掉老 assets 内容
  for (const name of fs.readdirSync(assetsDst)) {
    fs.rmSync(path.join(assetsDst, name), { recursive: true, force: true });
  }
} else {
  fs.mkdirSync(assetsDst);
}
for (const name of fs.readdirSync(assetsSrc)) {
  fs.copyFileSync(path.join(assetsSrc, name), path.join(assetsDst, name));
  console.log(`copied assets/${name}`);
}

// 4) SPA 路由 fallback：把 index.html 复制成 404.html。
// GitHub Pages 不像 Vercel/Netlify 会自动 fallback，未知路径（如 /play/title/1）
// 默认返回 404。把 index.html 放到 404.html，GitHub Pages 会把它当成 fallback 页
// 返回 200 + index.html 内容，React Router 接过来接管路由。
fs.copyFileSync(path.join(root, 'index.html'), path.join(root, '404.html'));
console.log('copied 404.html');

console.log('\nDeployed Vite build to repo root. Commit and push to publish to GitHub Pages.');
