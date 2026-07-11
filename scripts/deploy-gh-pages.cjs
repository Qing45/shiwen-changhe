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

// 4) SPA 路由 fallback：写一个 404.html 让浏览器从 root（200）重新加载并还原路径。
// GitHub Pages 对未知路径返回 HTTP 404 + 404.html body，但浏览器对 404 响应可能
// 不渲染 body。这里让 404.html 用 JS 把原路径存到 sessionStorage 后跳转到 root，
// index.html 的 main.tsx 在挂载 React 前从 sessionStorage 还原 URL，
// BrowserRouter 就能读到正确路由。整条链路全部走 200。
const fourOhFourHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>诗文长河</title>
<script>
  sessionStorage.setItem('gh-redirect', location.pathname + location.search + location.hash);
  location.replace('/shiwen-changhe/');
</script>
</head>
<body></body>
</html>
`;
fs.writeFileSync(path.join(root, '404.html'), fourOhFourHtml);
console.log('wrote 404.html (SPA redirect)');

console.log('\nDeployed Vite build to repo root. Commit and push to publish to GitHub Pages.');
