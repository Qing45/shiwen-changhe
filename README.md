# 诗文长河

唐诗三百首，化作一条月光下的墨色长河。横向滚动的时间轴上，每位诗人是一颗星点；点开诗人，他的诗作依年份排布成另一条河；再点开诗，进入注释与背景俱全的阅读页。

## 两种使用方式

### 1. 直接看应用（无需安装）

打开 [`standalone.html`](./standalone.html) —— 双击文件即可在浏览器中运行，或访问 GitHub Pages 部署后的 URL：

```
https://<user>.github.io/<repo>/standalone.html
```

这是一个自包含的单文件版本：React、ReactDOM、Babel 通过 CDN 加载，诗人和诗作数据内联在 HTML 里。无需 npm、无需构建。

> 提示：首次打开会从 CDN 拉取约 200 KB 的库文件，需要联网。

### 2. 改源码（开发模式）

Vite + React + TypeScript 工程，组件按 `src/` 目录拆分：

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 运行 vitest 测试套件
npm run build        # tsc 类型检查 + vite 打包到 dist/
```

主要目录：

```
src/
  components/     RiverBackground, RiverLine, TimeAxis, TopNav, SearchBox
  pages/          RiverPage, PoetPage, PoemPage
  data/           poets.json (76 位), poems.json (320 首)
  utils/          layout.ts (按年份定位), search.ts (即时搜索)
scripts/
  scraper/        gushiwen.cn 抓取脚本 (npm run scrape)
  build-standalone.cjs   把 src/ 整合成 standalone.html
  check-babel.cjs        校验 standalone.html 能否被 Babel 编译
```

## 改完源码后同步 standalone.html

```bash
npm run build:standalone   # 重新生成 standalone.html
npm run verify:standalone  # 校验 Babel 编译通过、无 import 语句
```

`standalone.html` 是构建产物但被提交到 git—— 这样 GitHub Pages 可以直接服务它，访客不必运行 npm。

## 数据来源

诗作、注释、创作背景来自 [古诗文网](https://www.gushiwen.cn/)。抓取脚本带 1 req/s 限速与本地缓存（`scripts/scraper/.cache`，git 忽略）。

## 已知限制（MVP 范围）

- 76 位诗人中，61 位生卒年取默认值 700–750，会聚在主河中部。后续如需更均匀的分布，可逐位补全真实生卒年。
