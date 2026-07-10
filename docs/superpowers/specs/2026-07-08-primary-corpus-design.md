# 小学必背诗库（Primary Corpus）Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 项目新增「小学必背」诗库，与现有「唐诗三百首」并列共存。TopNav 切换器即时切库，诗文长河、诗人详情页、飞花令都按当前库过滤；诗人长河本身保持 corpus-agnostic（仍展示全部诗人）。

**Architecture:**
- 数据层：单文件方案 —— `poems.json` / `poets.json` 加 `corpus` 字段；现有 320 / 76 数据加 `'tang'` 标签；新抓的 108 小学诗 + 35 位新诗人入库
- 状态层：React Context `src/state/corpus.tsx` 维护当前 corpus，写 localStorage `feihuaCorpus`，默认 `'tang'`
- 引擎层：飞花令 / 整句 engine 收 `corpus` 参数，从 corpus-filtered Verse 池里抽题；小学库独立维护 `PRIMARY_KEYWORDS`
- 抓取层：扩展 `scripts/scraper/`，用 gushiwen.cn 搜索接口按诗名定位单首

**Tech Stack:** React 18 + TypeScript + Vite + react-router-dom v6（既有栈不变）。新增 `cheerio` 已安装；用 gushiwen 现有 rate limit 1 req/s。

## Global Constraints

- `Poem.corpus` ∈ `'tang' | 'primary' | 'both'`；`Poet.corpus` ∈ `'tang' | 'primary'`
- 跨库共有的诗（如 静夜思 / 春晓 / 望庐山瀑布）：`corpus: 'both'`，**不**重复入库
- 现有 320 / 76 数据的 corpus 字段缺失时由 `load.ts` 兜底为 `'tang'`，**不**改 JSON 字面
- **2026-07-10 更新**：实际抓取后 poems 总 403 (primary 94 + both 14 + tang 295)，poets 总 114 (primary 57 + tang 57)。小学库诗文 108 全部到位；见 `scripts/scraper/primary-list.ts` (108 条按年级排序) + `scripts/cross-validate.mts` (108/108 matched)。
- 飞花令小学库独立一套 20 字关键字（满足每字 ≥ 5 句），**不**复用唐诗 50 关键字
- 飞花令进度按 `(corpus, keyword)` / `(corpus, level)` 存，**不**共用同一把 key
- TopNav 切换器三 variant（main / poet / poem）都要展示，统一样式
- 切库瞬间：飞花令关卡中检测 corpus 变化 → `navigate('/play')` 退回大厅；其它页面原地重渲染
- 诗人长河（RiverPage）corpus-agnostic，**不**加 filter
- mobile（< 600px）切换器字号缩小、文字"唐诗"/"小学" 两段、padding 收紧
- PWA / Capacitor 已部署，不破坏现有 manifest、SW、base path
- 96/96 测试必须在实施后保持通过

## 1. Data model

### Types

```ts
// src/types.ts
export type PoemCorpus = 'tang' | 'primary' | 'both';
export type PoetCorpus = 'tang' | 'primary';

export interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: { term: string; explanation: string }[];
  background?: string;
  creationYear?: number;
  familiarity: number;
  corpus: PoemCorpus;  // 新增
}

export interface Poet {
  id: string;
  name: string;
  courtesyName?: string;
  pseudonym?: string;
  birthYear: number;
  deathYear: number;
  dynastyId: string;     // 现有，扩展为 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other'
  familiarity: number;
  corpus: PoetCorpus;    // 新增
}
```

### 字段赋默认值

`src/data/load.ts` 加载 JSON 时对每条数据兜底：
```ts
function withCorpus<T extends { corpus?: string }>(x: T, fallback: string): T {
  return { ...x, corpus: x.corpus ?? fallback };
}
poems = (poemsData as Poem[]).map(p => withCorpus(p, 'tang'));
poets = (poetsData as Poet[]).map(p => withCorpus(p, 'tang'));
```

### 新增诗人（小学独有不与唐诗重叠）

`scripts/scraper/normalize.ts` 扩展 `POET_META`：

| 诗人 | 朝代 | 生卒 | 字/号 | familiarity |
|------|------|------|------|------|
| 苏轼 | 宋 | 1037–1101 | 子瞻 / 东坡居士 | 5 |
| 王安石 | 宋 | 1021–1086 | 介甫 / 半山 | 4 |
| 杨万里 | 宋 | 1127–1206 | 廷秀 / 诚斋 | 4 |
| 范成大 | 宋 | 1126–1193 | 致能 / 石湖居士 | 3 |
| 陆游 | 宋 | 1125–1210 | 放翁 | 5 |
| 辛弃疾 | 宋 | 1140–1207 | 幼安 / 稼轩 | 5 |
| 李清照 | 宋 | 1084–1155 | 易安 | 4 |
| 朱熹 | 宋 | 1130–1200 | 元晦 / 晦庵 | 4 |
| 范仲淹 | 宋 | 989–1052 | 希文 | 3 |
| 叶绍翁 | 宋 | 不详 | 嗣宗 | 2 |
| 卢钺 | 宋 | 不详 | — | 2 |
| 郑思肖 | 宋 | 1241–1318 | 忆翁 | 2 |
| 黄庭坚 | 宋 | 1045–1105 | 鲁直 / 山谷道人 | 3 |
| 王观 | 宋 | 不详 | 达叟 | 2 |
| 林升 | 宋 | 不详 | 云友 | 2 |
| 龚自珍 | 清 | 1792–1841 | 璱人 / 定盦 | 3 |
| 查慎行 | 清 | 1650–1727 | 悔余 | 2 |
| 袁枚 | 清 | 1716–1797 | 子才 / 简斋 | 3 |
| 郑燮 | 清 | 1693–1765 | 克柔 / 板桥 | 3 |
| 于谦 | 明 | 1398–1457 | 廷益 | 3 |
| 毛泽东 | 现代 | 1893–1976 | — | 5 |
| 林杰 | 唐 | 不详 | 智周 | 2 |
| 虞世南 | 唐 | 558–638 | 伯施 | 2 |
| 张志和 | 唐 | 不详 | 子同 | 2 |
| 张继 | 唐 | 不详 | — | 2 |
| 纳兰性德 | 清 | 1655–1685 | 容若 | 3 |
| 雷震 | 宋 | 不详 | — | 2 |
| 翁卷 | 宋 | 不详 | 续古 | 2 |
| 曾几 | 宋 | 1085–1166 | 志甫 / 茶山居士 | 2 |
| 韩翃 | 唐 | 不详 | 君平 | 2 |
| 王建 | 唐 | 766–830 | 仲初 | 2 |
| 唐寅 | 明 | 1470–1524 | 伯虎 / 六如居士 | 3 |
| 李绅 | 唐 | 792–858 | 公垂 | 2 |
| 胡令能 | 唐 | 不详 | — | 2 |
| 贾岛 | 唐 | 779–843 | 浪仙 | 3 |
| 李峤 | 唐 | 644–713 | 巨山 | 2 |

约 35 位新增。`dynastyId` 字段同步扩展为上述六个值。

### 跨库共有诗入库策略

- 同一 shiwenv_xxx ID 在两库都命中 → 现有 Tang entry 保留，`corpus` 改为 `'both'`
- 仅在小学库命中 → 新 entry，`corpus: 'primary'`
- 仅在唐诗库命中 → 保留 `'tang'`

## 2. Scraping extension

### URL 策略

gushiwen.cn 没"小学必背"索引页。改用搜索接口：

```
https://www.gushiwen.cn/search.aspx?value={title}
```

每首搜索结果页面会列出多首同名诗，取第一条最匹配的（按朝代过滤：唐/宋/明/清/现代）。

### 新增脚本 `scripts/scraper/primary.ts`

```ts
// 抓取 108 首小学必背诗，按 search.aspx 逐首定位，调用现有 parsePoemPage。
// 输入：硬编码的 108 首 (title, expectedPoetName) 列表
// 输出：与现有 normalize 兼容的 RawPoem[]
```

### 修改 `scripts/scraper/index.ts`

`main()` 改为：
1. 抓唐诗（保留）
2. 抓小学（新增）
3. **合并** raw：去重 by shiwenv_xxx ID；同 ID 取内容更全的（带 background 的优先）
4. normalize 时按诗人决定 poet.corpus，按诗-诗人关系决定 poem.corpus

### POET_META 合并

`normalize.ts` 现有 POET_META 补全上述 35 位新诗人；DEFAULT_POET_META 保持现状。

### 失败处理

- 单首抓取失败：log error 跳过；最终输出未抓到的列表，提交前由人手核对
- 抓取总耗时：108 首 × 1s + 余量 ≈ 3 分钟

## 3. State management

### `src/state/corpus.tsx`（新文件）

```ts
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Corpus = 'tang' | 'primary';
const STORAGE_KEY = 'feihuaCorpus';

interface CorpusCtx {
  corpus: Corpus;
  setCorpus: (c: Corpus) => void;
}

const Ctx = createContext<CorpusCtx | null>(null);

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [corpus, setCorpusState] = useState<Corpus>(() => {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return v === 'primary' ? 'primary' : 'tang';
  });
  const setCorpus = (c: Corpus) => {
    setCorpusState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };
  return <Ctx.Provider value={{ corpus, setCorpus }}>{children}</Ctx.Provider>;
}

export function useCorpus(): Corpus {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCorpus outside CorpusProvider');
  return v.corpus;
}
export function useSetCorpus(): (c: Corpus) => void {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSetCorpus outside CorpusProvider');
  return v.setCorpus;
}
```

### `src/App.tsx` 挂 Provider

```tsx
<CorpusProvider>
  <BrowserRouter>...</BrowserRouter>
</CorpusProvider>
```

## 4. TopNav switcher

### 新增 `src/components/CorpusSwitcher.tsx`

```tsx
// 两段式 segment control，绑 useCorpus / useSetCorpus
// mobile / desktop 共用，padding / font 走 useBreakpoint
```

视觉规范（来自第 2 节）：
- 容器：圆角矩形，border `1px solid #d4af6a`，背景透明
- 选中段：背景 `#f5ebd2`，文字 `#1a2855`，box-shadow 内嵌
- 未选中段：透明，文字 `#d4af6a`，hover 透明度 0.7
- desktop 字号 13，letter-spacing 2
- mobile（< 600px）字号 11，padding 4/8，标签只显示"唐诗"/"小学"
- 切库不需要 confirm，但 onChange 时若处于飞花令关卡页面（路径含 `/play/stage/` 或 `/play/sentence/`）调 `navigate('/play')` 后再 setCorpus

### TopNav 三个 variant 集成

`src/components/TopNav.tsx` 的 main / poet / poem 三个 variant JSX 末尾都插入 `<CorpusSwitcher />`，通过 props 或 context 判断当前路径是否在飞花令关卡。

## 5. Page-level integration

### RiverPage（`/`）—— corpus-agnostic

- 不变。getPoets() 仍返回全量 100+ 诗人
- 节点大小 / 颜色逻辑保持

### PoemsRiverPage（`/poems`）—— 按 corpus 过滤

- 顶部新增 corpus 标识条："唐诗三百首" / "小学必背"
- 节点用 `poems.filter(p => corpus === 'tang' ? p.corpus !== 'primary' : p.corpus !== 'tang')`
- 切库时 React state 变化直接 re-filter，无需 navigate

### PoetPage（`/poet/:poetId`）—— 默认按 corpus 过滤 + "看全部" toggle

- `useCorpus()` 取当前
- 顶部 toggle：默认"看本库" / 切到"看全部"
- 当诗人只有 `'tang'` 诗作 + corpus 是 `'primary'` → 显示"该诗人在小学必背无作品"空态
- toggle 自身状态用 `useState`，不持久化（每次进页默认按 corpus）

### PoemPage（`/poem/:poemId`）—— 不变

- 单首诗页只显示一首诗，corpus 字段只影响侧栏"出自诗库"小字
- 当 poem.corpus 含当前 corpus（`primary` 切到 `'primary'` 看 `'both'` 也算）→ 正常显示
- 否则显示"这首诗不在当前诗库"提示 + 切库链接

### PlayHall（`/play`）—— 三种 tab（保留 char / sentence + 提示当前库）

- 顶部加"当前诗库：唐诗三百首"或"小学必背"标识
- char tab：按 corpus 选 `KEYWORDS` 或 `PRIMARY_KEYWORDS`
- sentence tab：按 corpus 选 level 池（唐诗 50 关全开 / 小学 30 关）
- 切库时印章进度按 corpus 重新计算

### StagePlay / SentencePlay

- 用 `useCorpus()` 拿当前库
- pickStageQuestion / pickLevelQuestion 加 corpus 参数
- 关卡中 corpus 变化时 → `navigate('/play')` 退出（用 useEffect 监听 corpus）
- 进度 key 改为 `feihuaProgress:${corpus}` / `feihuaSentenceProgress:${corpus}`

## 6. 飞花令 engine

### `src/play/types.ts`

```ts
export interface Verse {
  poemId: string;
  line: string;
  poemTitle: string;
  poetName: string;
  corpus: PoemCorpus;  // 新增（抽题用，按 corpus 过滤）
}
```

### `src/play/engine.ts`

- 新增 `buildKeywordIndex(corpus: Corpus): Map<string, Verse[]>`
- `getKeywordIndex(corpus)` 缓存两份
- `pickStageQuestion(corpus, kw, used)` 接受 corpus
- `buildNineGrid` / `validateStageInput` 不变

### `src/play/couplets.ts`

- `pickLevelQuestion(corpus, level, usedUpper)` 接受 corpus
- `getCorpusVerses(corpus)` 返回 corpus-filtered Verse[]，按诗切行

### `src/play/primaryKeywords.ts`（新文件）

20 字小学关键字，手挑覆盖小学高频意象：

```ts
export const PRIMARY_KEYWORD_GROUPS = {
  entry: ['月','花','春','风','山','水','雪','人'],
  mid: ['天','云','江','秋','夜','日','雨','草'],
} as const;
export const PRIMARY_KEYWORDS: readonly string[] = [...PRIMARY_KEYWORD_GROUPS.entry, ...PRIMARY_KEYWORD_GROUPS.mid];
```

> 实施时跑一次扫描：每字 ≥ 5 句；不达标的字剔除或替换。

### Progress

`src/play/progress.ts` / `sentenceProgress.ts`：

```ts
const KEY = (corpus: Corpus) => `feihuaProgress:${corpus}`;
const SENTENCE_KEY = (corpus: Corpus) => `feihuaSentenceProgress:${corpus}`;
```

- 旧 key（无 corpus 前缀）作为 `'tang'` 兜底读取一次，迁移后写新 key
- `clearCurrent(corpus)` 也按 corpus 走

## 7. 测试

### 新增 `tests/corpus.test.ts`

- `withCorpus` 字段兜底
- `getPoets()` 默认全量 / `getPoets('primary')` 只返回 primary
- `getPoems('tang')` 不含 primary
- `getPoems('primary')` 不含纯 tang

### 现有测试

- 96 个测试**不应**依赖 poems/poets 总数；若有，改为 ≥ 断言
- 跑 `npm test` 全绿

## 8. 实施阶段（粗粒度）

实施时分 5 个独立可测的 Task：

1. **数据**：抓取 + normalize + corpus 字段赋值 + 兜底 + tests
2. **状态**：CorpusContext + Provider + useCorpus hook
3. **TopNav 切换器**：CorpusSwitcher 组件 + TopNav 三 variant 集成
4. **页面集成**：RiverPage / PoemsRiverPage / PoetPage / PoemPage / PlayHall
5. **飞花令集成**：engine / couplets / progress 加 corpus 参数 + Stage/Sentence play 改造

每个 Task 独立 commit + 跑测试。

## 9. 风险与回退

- 抓取失败：108 首中若 > 10 首失败，回退到手工填诗名/作者 + 仅关键诗作
- mobile 切换器拥挤：若 < 380px 视口，连 TopNav 标题一起隐藏，只露图标
- corpus 切换瞬间 state 竞态：所有依赖 `useCorpus` 的页面用 ref 锁，渲染时一次性重算

---
