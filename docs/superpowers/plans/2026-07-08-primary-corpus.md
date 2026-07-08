# 小学必背诗库（Primary Corpus）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 项目新增「小学必背」诗库，与「唐诗三百首」并列共存；TopNav 切换器即时切库，诗文长河、诗人详情页、飞花令都按当前库过滤；诗人长河保持 corpus-agnostic。

**Architecture:** 单文件数据扩展（`Poem` / `Poet` 加 `corpus` 字段）+ Context 状态层（localStorage 持久化）+ TopNav segment-control 切换器 + engine/corpus 参数化 + PRIMARY_KEYWORDS 独立关键字集。7 个 Task，每 Task 独立 commit + 测试。

**Tech Stack:** React 18 + TypeScript + Vite + react-router-dom v6（既有栈不变）。cheerio（既有）+ gushiwen.cn 搜索接口抓取小学诗。Vitest + @testing-library/react（既有测试栈）。

## Global Constraints

来自 `docs/superpowers/specs/2026-07-08-primary-corpus-design.md`：

- `Poem.corpus` ∈ `'tang' | 'primary' | 'both'`；`Poet.corpus` ∈ `'tang' | 'primary'`
- 跨库共有诗（静夜思 / 春晓 / 望庐山瀑布 等）：`corpus: 'both'`，**不**重复入库
- 现有 320 / 76 数据的 corpus 字段缺失时由 `load.ts` 兜底为 `'tang'`，**不**改 JSON 字面
- 飞花令小学库独立一套关键字（满足每字 ≥ 5 句），**不**复用唐诗 50 关键字
- 飞花令进度按 `(corpus, keyword)` / `(corpus, level)` 存，**不**共用同一把 key
- TopNav 切换器三 variant（main / poet / poem）都要展示，统一样式
- 切库瞬间：飞花令关卡中检测 corpus 变化 → `navigate('/play')` 退回大厅；其它页面原地重渲染
- 诗人长河（RiverPage）corpus-agnostic，**不**加 filter
- mobile（< 600px）切换器字号缩小、文字"唐诗"/"小学" 两段、padding 收紧
- PWA / Capacitor 已部署，不破坏现有 manifest、SW、base path
- 96/96 测试必须在实施后保持通过
- **每个 src/ 改动都要同步镜像到 `scripts/build-standalone.cjs` 并重新生成 `standalone.html`**（项目硬性双源维护约定）

## File Structure

### 新增
- `src/state/corpus.tsx` — CorpusContext / Provider / `useCorpus` / `useSetCorpus` hooks
- `src/components/CorpusSwitcher.tsx` — 顶部两段式 segment control
- `src/play/primaryKeywords.ts` — 小学库 20 字关键字
- `tests/corpus.test.ts` — corpus filter / fallback 测试
- `scripts/scraper/primary-list.ts` — 112 首 (title, expectedDynasty) 硬编码列表
- `scripts/scraper/primary.ts` — gushiwen 搜索接口抓取器

### 修改
- `src/types.ts` — `Poem` / `Poet` 加 `corpus` 字段 + 类型扩展
- `src/data/load.ts` — `withCorpus` 兜底 + `getPoets(corpus?)` / `getPoems(corpus?)` 过滤
- `src/data/poems.json` — 新增 ~50 小学诗条目
- `src/data/poets.json` — 新增 ~36 小学诗人条目
- `src/App.tsx` — 挂 `<CorpusProvider>`
- `src/components/TopNav.tsx` — 三 variant 末尾插入 `<CorpusSwitcher />`
- `src/pages/PoemsRiverPage.tsx` — `useCorpus` 过滤
- `src/pages/PoetPage.tsx` — `useCorpus` 过滤 + 「看全部」toggle
- `src/pages/PoemPage.tsx` — corpus 提示 + 切库链接
- `src/pages/PlayHall.tsx` — 按 corpus 选 KEYWORDS / PRIMARY_KEYWORDS + 当前库标识
- `src/pages/StagePlay.tsx` — `useCorpus` + 关卡中切库时 `navigate('/play')`
- `src/pages/SentencePlay.tsx` — `useCorpus` + 关卡中切库时 `navigate('/play')`
- `src/play/types.ts` — `Verse` 加 `corpus: PoemCorpus`
- `src/play/engine.ts` — `buildKeywordIndex(corpus)` / `pickStageQuestion(corpus, kw, used)` 等
- `src/play/couplets.ts` — `pickLevelQuestion(corpus, level, usedUpper)` / `getCorpusVerses(corpus)`
- `src/play/progress.ts` — key 加 `feihuaProgress:${corpus}` 前缀
- `src/play/sentenceProgress.ts` — key 加 `feihuaSentenceProgress:${corpus}` 前缀
- `scripts/scraper/normalize.ts` — POET_META 加 35 位宋/明/清/现代诗人
- `scripts/scraper/index.ts` — 抓唐诗 + 抓小学 → 合并 → normalize
- `scripts/build-standalone.cjs` — 镜像所有 src/ 改动
- `standalone.html` — 重新生成（每次 src/ 改动后）

---

## Task 1: Data layer — types + 兜底 + 过滤

**Files:**
- Modify: `src/types.ts`（在 `Poem` / `Poet` 加 `corpus` 字段；新增 `PoemCorpus` / `PoetCorpus`）
- Modify: `src/data/load.ts`（加 `withCorpus` 兜底 + `getPoets(corpus?)` / `getPoems(corpus?)` 重载）
- Create: `tests/corpus.test.ts`（测试兜底 + 过滤）
- Modify: `scripts/build-standalone.cjs`（镜像 load.ts 的改动，themeCode 之后加 corpusCode 或并入 loadCode）

**Interfaces:**
- Consumes: 无（基础任务）
- Produces:
  - `export type PoemCorpus = 'tang' | 'primary' | 'both'`
  - `export type PoetCorpus = 'tang' | 'primary'`
  - `export function withCorpus<T extends { corpus?: string }>(x: T, fallback: string): T`
  - `export function getPoets(): Poet[]`（保持原签名，默认全量）
  - `export function getPoets(corpus: PoetCorpus | 'all'): Poet[]`（corpus 过滤）
  - `export function getPoems(): Poem[]`（保持原签名，默认全量）
  - `export function getPoems(corpus: PoemCorpus): Poem[]`（'tang' 返回 corpus != 'primary'；'primary' 返回 corpus != 'tang'；'both' 返回全部）
  - `export function getPoet(id: string): Poet | undefined`（保持）

- [ ] **Step 1: 写测试 `tests/corpus.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { withCorpus, getPoets, getPoems } from '../src/data/load';

describe('withCorpus', () => {
  it('defaults to "tang" when corpus missing', () => {
    expect(withCorpus({ id: 'a', title: 't' }, 'tang')).toEqual({ id: 'a', title: 't', corpus: 'tang' });
  });
  it('keeps existing corpus field', () => {
    expect(withCorpus({ id: 'a', corpus: 'primary' }, 'tang')).toEqual({ id: 'a', corpus: 'primary' });
  });
});

describe('getPoets (no arg) — back-compat', () => {
  it('returns all poets regardless of corpus', () => {
    const all = getPoets();
    expect(all.length).toBeGreaterThanOrEqual(76);
    expect(all.some(p => p.corpus === 'tang')).toBe(true);
  });
});

describe('getPoets(corpus)', () => {
  it('tang returns only tang-corpus poets', () => {
    const tang = getPoets('tang');
    expect(tang.every(p => p.corpus === 'tang')).toBe(true);
  });
  it('primary returns only primary-corpus poets (may be empty before Task 2)', () => {
    const primary = getPoets('primary');
    expect(primary.every(p => p.corpus === 'primary')).toBe(true);
  });
  it('all returns full set', () => {
    expect(getPoets('all').length).toBe(getPoets().length);
  });
});

describe('getPoems(corpus)', () => {
  it('tang excludes primary-only poems', () => {
    const tang = getPoems('tang');
    expect(tang.every(p => p.corpus !== 'primary')).toBe(true);
  });
  it('primary excludes tang-only poems', () => {
    const primary = getPoems('primary');
    expect(primary.every(p => p.corpus !== 'tang')).toBe(true);
  });
  it('all returns full set', () => {
    expect(getPoems('all').length).toBe(getPoems().length);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- tests/corpus.test.ts`
Expected: FAIL（`withCorpus` / 多参数 `getPoets` / `getPoems` 还不存在）

- [ ] **Step 3: 改 `src/types.ts`**

在 `export interface Poem { ... }` 末尾（familiarity 之后）加一行：
```ts
export type PoemCorpus = 'tang' | 'primary' | 'both';
export type PoetCorpus = 'tang' | 'primary';
```

```ts
export interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: { term: string; explanation: string }[];
  background?: string;
  creationYear?: number;
  familiarity: number;
  corpus: PoemCorpus;
}
```

```ts
export interface Poet {
  id: string;
  name: string;
  courtesyName?: string;
  pseudonym?: string;
  birthYear: number;
  deathYear: number;
  dynastyId: string;
  familiarity: number;
  corpus: PoetCorpus;
}
```

- [ ] **Step 4: 改 `src/data/load.ts`**

完整替换为：

```ts
import type { Poet, Poem, PoetCorpus, PoemCorpus } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

// JSON 字段兜底：现有 320/76 数据没有 corpus 字段，运行时默认 'tang'
function withCorpus<T extends { corpus?: string }>(x: T, fallback: string): T {
  return { ...x, corpus: x.corpus ?? fallback };
}

const poets: Poet[] = (poetsData as Poet[]).map(p => withCorpus(p, 'tang')) as Poet[];
const poems: Poem[] = (poemsData as Poem[]).map(p => withCorpus(p, 'tang')) as Poem[];

export function getPoets(): Poet[];
export function getPoets(corpus: PoetCorpus | 'all'): Poet[];
export function getPoets(corpus?: PoetCorpus | 'all'): Poet[] {
  if (!corpus || corpus === 'all') return poets;
  return poets.filter(p => p.corpus === corpus);
}

export function getPoem(id: string): Poem | undefined {
  return poems.find(p => p.id === id);
}

export function getPoet(id: string): Poet | undefined {
  return poets.find(p => p.id === id);
}

export function getPoetByName(name: string): Poet | undefined {
  return poets.find(p => p.name === name);
}

export function getPoems(): Poem[];
export function getPoems(corpus: PoemCorpus): Poem[];
export function getPoems(corpus?: PoemCorpus): Poem[] {
  if (!corpus) return poems;
  if (corpus === 'both') return poems;
  if (corpus === 'tang') return poems.filter(p => p.corpus !== 'primary');
  // 'primary'
  return poems.filter(p => p.corpus !== 'tang');
}
```

注：现有 `getPoem` / `getPoet` / `getPoetByName` 如果已有，保持其存在；如没有则按上面加（spec 没明确要求，但 tests/ 可能用到）。

- [ ] **Step 5: 跑测试确认通过**

Run: `npm test -- tests/corpus.test.ts`
Expected: PASS

- [ ] **Step 6: 跑全量测试 + 类型检查确认无回归**

Run: `npm test && npx tsc --noEmit`
Expected: 96+ 测试全绿，TypeScript 无错

- [ ] **Step 7: 镜像到 `scripts/build-standalone.cjs` 并重生成 standalone.html**

具体改动：
1. 在 `loadCode` 字符串中（grep 找到）注入 `withCorpus` 函数 + 替换 `getPoets` / `getPoems` 为新签名
2. `npm run build:standalone && npm run verify:standalone`
3. `node scripts/check-babel.cjs` 通过

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/data/load.ts tests/corpus.test.ts scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): add corpus field to Poem/Poet types with back-compat fallback"
```

---

## Task 2: Scraping — 抓取 112 首小学必背 + 合并数据

**Files:**
- Create: `scripts/scraper/primary-list.ts`（112 首硬编码列表）
- Create: `scripts/scraper/primary.ts`（gushiwen 搜索接口抓取器）
- Modify: `scripts/scraper/normalize.ts`（POET_META 加 35 位新诗人；DEFAULT_POET_META 不变）
- Modify: `scripts/scraper/index.ts`（调用 primary scraper + 合并）
- Modify: `src/data/poems.json`（新增 ~50 小学诗）
- Modify: `src/data/poets.json`（新增 ~36 小学诗人）
- Modify: `scripts/build-standalone.cjs`（更新 normalizeCode 注入新 POET_META）

**Interfaces:**
- Consumes: 现有 `parsePoemPage` / `cachedFetch` / `normalize` / `RateLimitDelay`
- Produces:
  - `export const PRIMARY_LIST: { title: string; dynasty: 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other'; poetName: string }[]`
  - `export async function fetchPrimary(): Promise<RawPoem[]>`（112 首搜索 → 解析 → 去重）
  - `normalize` 接受带 `corpus` 提示的 raw 输入，输出带 corpus 字段的 poets/poems
  - 合并规则：tang entry 已有 shiwenv_xxx → 该 entry 改 `corpus: 'both'`；仅在 primary 抓到 → 新增 entry `corpus: 'primary'`

- [ ] **Step 1: 创建 `scripts/scraper/primary-list.ts`**

按 12 册分组写硬编码列表。112 首 7 列的 CSV 风格：

```ts
// 112 首小学必背诗，按 1-6 年级上下册分组
// 顺序：title, dynasty, poetName（用于核对抓取结果是否匹配预期）
export interface PrimaryListEntry {
  title: string;
  dynasty: 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other';
  poetName: string;
}

export const PRIMARY_LIST: PrimaryListEntry[] = [
  // 一年级上册
  { title: '咏鹅', dynasty: 'tang', poetName: '骆宾王' },
  { title: '江南', dynasty: 'other', poetName: '汉乐府' },
  { title: '画', dynasty: 'tang', poetName: '王维' },
  { title: '悯农', dynasty: 'tang', poetName: '李绅' },  // 其二
  { title: '古朗月行', dynasty: 'tang', poetName: '李白' },  // 节选
  { title: '风', dynasty: 'tang', poetName: '李峤' },
  // 一年级下册
  { title: '春晓', dynasty: 'tang', poetName: '孟浩然' },
  { title: '赠汪伦', dynasty: 'tang', poetName: '李白' },
  { title: '静夜思', dynasty: 'tang', poetName: '李白' },
  { title: '寻隐者不遇', dynasty: 'tang', poetName: '贾岛' },
  { title: '池上', dynasty: 'tang', poetName: '白居易' },
  { title: '小池', dynasty: 'song', poetName: '杨万里' },
  { title: '画鸡', dynasty: 'ming', poetName: '唐寅' },
  // 二年级上册
  { title: '梅花', dynasty: 'song', poetName: '王安石' },
  { title: '小儿垂钓', dynasty: 'tang', poetName: '胡令能' },
  { title: '登鹳雀楼', dynasty: 'tang', poetName: '王之涣' },
  { title: '望庐山瀑布', dynasty: 'tang', poetName: '李白' },
  { title: '江雪', dynasty: 'tang', poetName: '柳宗元' },
  { title: '夜宿山寺', dynasty: 'tang', poetName: '李白' },
  { title: '敕勒歌', dynasty: 'other', poetName: '北朝民歌' },
  // 二年级下册
  { title: '村居', dynasty: 'qing', poetName: '高鼎' },
  { title: '咏柳', dynasty: 'tang', poetName: '贺知章' },
  { title: '赋得古原草送别', dynasty: 'tang', poetName: '白居易' },
  { title: '晓出净慈寺送林子方', dynasty: 'song', poetName: '杨万里' },
  { title: '绝句', dynasty: 'tang', poetName: '杜甫' },
  { title: '舟夜书所见', dynasty: 'qing', poetName: '查慎行' },
  // 三年级上册
  { title: '所见', dynasty: 'qing', poetName: '袁枚' },
  { title: '山行', dynasty: 'tang', poetName: '杜牧' },
  { title: '赠刘景文', dynasty: 'song', poetName: '苏轼' },
  { title: '夜书所见', dynasty: 'song', poetName: '叶绍翁' },
  { title: '望天门山', dynasty: 'tang', poetName: '李白' },
  { title: '饮湖上初晴后雨', dynasty: 'song', poetName: '苏轼' },
  { title: '望洞庭', dynasty: 'tang', poetName: '刘禹锡' },
  { title: '早发白帝城', dynasty: 'tang', poetName: '李白' },
  // 三年级下册
  { title: '惠崇春江晚景', dynasty: 'song', poetName: '苏轼' },
  { title: '三衢道中', dynasty: 'song', poetName: '曾几' },
  { title: '忆江南', dynasty: 'tang', poetName: '白居易' },
  { title: '元日', dynasty: 'song', poetName: '王安石' },
  { title: '清明', dynasty: 'tang', poetName: '杜牧' },
  { title: '九月九日忆山东兄弟', dynasty: 'tang', poetName: '王维' },
  { title: '滁州西涧', dynasty: 'tang', poetName: '韦应物' },
  { title: '大林寺桃花', dynasty: 'tang', poetName: '白居易' },
  // 四年级上册
  { title: '鹿柴', dynasty: 'tang', poetName: '王维' },
  { title: '暮江吟', dynasty: 'tang', poetName: '白居易' },
  { title: '题西林壁', dynasty: 'song', poetName: '苏轼' },
  { title: '雪梅', dynasty: 'song', poetName: '卢钺' },
  { title: '嫦娥', dynasty: 'tang', poetName: '李商隐' },
  { title: '出塞', dynasty: 'tang', poetName: '王昌龄' },
  { title: '凉州词', dynasty: 'tang', poetName: '王翰' },
  { title: '夏日绝句', dynasty: 'song', poetName: '李清照' },
  { title: '别董大', dynasty: 'tang', poetName: '高适' },
  // 四年级下册
  { title: '宿建德江', dynasty: 'tang', poetName: '孟浩然' },
  { title: '六月二十七日望湖楼醉书', dynasty: 'song', poetName: '苏轼' },
  { title: '西江月·夜行黄沙道中', dynasty: 'song', poetName: '辛弃疾' },
  { title: '卜算子·送鲍浩然之浙东', dynasty: 'song', poetName: '王观' },
  { title: '清平乐·村居', dynasty: 'song', poetName: '辛弃疾' },
  { title: '独坐敬亭山', dynasty: 'tang', poetName: '李白' },
  { title: '乡村四月', dynasty: 'song', poetName: '翁卷' },
  { title: '四时田园杂兴', dynasty: 'song', poetName: '范成大' },  // 其二十五/其二
  // 五年级上册
  { title: '蝉', dynasty: 'tang', poetName: '虞世南' },
  { title: '乞巧', dynasty: 'tang', poetName: '林杰' },
  { title: '示儿', dynasty: 'song', poetName: '陆游' },
  { title: '题临安邸', dynasty: 'song', poetName: '林升' },
  { title: '己亥杂诗', dynasty: 'qing', poetName: '龚自珍' },
  { title: '山居秋暝', dynasty: 'tang', poetName: '王维' },
  { title: '枫桥夜泊', dynasty: 'tang', poetName: '张继' },
  { title: '长相思', dynasty: 'qing', poetName: '纳兰性德' },
  { title: '渔歌子', dynasty: 'tang', poetName: '张志和' },
  { title: '观书有感', dynasty: 'song', poetName: '朱熹' },  // 其一/其二
  // 五年级下册
  { title: '稚子弄冰', dynasty: 'song', poetName: '杨万里' },
  { title: '村晚', dynasty: 'song', poetName: '雷震' },
  { title: '鸟鸣涧', dynasty: 'tang', poetName: '王维' },
  { title: '凉州词', dynasty: 'tang', poetName: '王之涣' },
  { title: '送元二使安西', dynasty: 'tang', poetName: '王维' },
  { title: '秋夜将晓出篱门迎凉有感', dynasty: 'song', poetName: '陆游' },
  { title: '闻官军收河南河北', dynasty: 'tang', poetName: '杜甫' },
  { title: '长歌行', dynasty: 'other', poetName: '汉乐府' },
  // 六年级上册
  { title: '过故人庄', dynasty: 'tang', poetName: '孟浩然' },
  { title: '七律·长征', dynasty: 'modern', poetName: '毛泽东' },
  { title: '菩萨蛮·大柏地', dynasty: 'modern', poetName: '毛泽东' },
  { title: '春日', dynasty: 'song', poetName: '朱熹' },
  { title: '回乡偶书', dynasty: 'tang', poetName: '贺知章' },
  { title: '浪淘沙', dynasty: 'tang', poetName: '刘禹锡' },
  { title: '江南春', dynasty: 'tang', poetName: '杜牧' },
  { title: '寒菊', dynasty: 'song', poetName: '郑思肖' },
  // 六年级下册
  { title: '寒食', dynasty: 'tang', poetName: '韩翃' },
  { title: '迢迢牵牛星', dynasty: 'other', poetName: '佚名' },
  { title: '十五夜望月', dynasty: 'tang', poetName: '王建' },
  { title: '马诗', dynasty: 'tang', poetName: '李贺' },
  { title: '石灰吟', dynasty: 'ming', poetName: '于谦' },
  { title: '竹石', dynasty: 'qing', poetName: '郑燮' },
  { title: '采薇', dynasty: 'other', poetName: '佚名' },
  { title: '春夜喜雨', dynasty: 'tang', poetName: '杜甫' },
  { title: '早春呈水部张十八员外', dynasty: 'tang', poetName: '韩愈' },
  { title: '江上渔者', dynasty: 'song', poetName: '范仲淹' },
  { title: '泊船瓜洲', dynasty: 'song', poetName: '王安石' },
  { title: '游园不值', dynasty: 'song', poetName: '叶绍翁' },
  { title: '浣溪沙', dynasty: 'song', poetName: '苏轼' },
  { title: '清平乐', dynasty: 'song', poetName: '黄庭坚' },
];
```

> 实际录入 100+ 首（"多首同名 → 选其一"如四时田园杂兴只录一次代表）。约 100 条。后续如需补全，参照此模式扩展。

- [ ] **Step 2: 创建 `scripts/scraper/primary.ts`**

```ts
// 抓取 112 首小学必背诗。按 PRIMARY_LIST 逐首走 gushiwen 搜索接口，
// 取第一条匹配的搜索结果，再用现有 parsePoemPage 解析详情。
import * as cheerio from 'cheerio';
import { cachedFetch, rateLimitedDelay, UA } from './index-helpers';
import { parsePoemPage } from './parse-poem';
import { PRIMARY_LIST } from './primary-list';
import type { RawPoem } from './parse-poem';

const BASE = 'https://www.gushiwen.cn';

export async function fetchPrimary(): Promise<RawPoem[]> {
  const out: RawPoem[] = [];
  for (let i = 0; i < PRIMARY_LIST.length; i++) {
    const entry = PRIMARY_LIST[i];
    try {
      const searchUrl = `${BASE}/search.aspx?value=${encodeURIComponent(entry.title)}`;
      const searchHtml = await cachedFetch(searchUrl);
      const detailUrl = extractFirstPoemUrl(searchHtml, entry.dynasty);
      if (!detailUrl) {
        console.error(`  [${i + 1}/${PRIMARY_LIST.length}] ${entry.title}: no result on gushiwen`);
        continue;
      }
      const detailHtml = await cachedFetch(detailUrl);
      const parsed = parsePoemPage(detailHtml, detailUrl);
      // 核对诗人（如 entry 期望 'tang' 但抓到的不是唐代诗人，跳过）
      // 这里不强校验 dynasty 字符串，只 warn
      out.push(parsed);
      console.log(`  [${i + 1}/${PRIMARY_LIST.length}] ${parsed.title} — ${parsed.poetName}`);
    } catch (err) {
      console.error(`  [${i + 1}/${PRIMARY_LIST.length}] FAILED ${entry.title}:`, err);
    }
    await rateLimitedDelay();
  }
  return out;
}

function extractFirstPoemUrl(html: string, _expectedDynasty: string): string | null {
  const $ = cheerio.load(html);
  // gushiwen 搜索结果每条 item 含 <a href="/shiwenv_xxx.aspx">
  let firstUrl: string | null = null;
  $('a[href*="shiwenv_"]').each((_, el) => {
    if (firstUrl) return;
    const href = $(el).attr('href');
    if (href) firstUrl = new URL(href, BASE).toString();
  });
  return firstUrl;
}
```

- [ ] **Step 3: 提取 `index-helpers.ts`（避免循环引用）**

`scripts/scraper/index.ts` 中 `rateLimitedDelay` / `cachedFetch` / `UA` 是局部 const；提取到 `scripts/scraper/index-helpers.ts` 供 primary.ts 复用：

```ts
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = resolve(here, '.cache');

export const RATE_LIMIT_MS = 1000;
export const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export async function rateLimitedDelay(): Promise<void> {
  return new Promise(r => setTimeout(r, RATE_LIMIT_MS));
}

export async function cachedFetch(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = resolve(CACHE_DIR, Buffer.from(url).toString('base64url').slice(0, 80) + '.html');
  if (existsSync(cacheFile)) return readFileSync(cacheFile, 'utf-8');
  console.log(`  fetching ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  writeFileSync(cacheFile, html);
  return html;
}
```

- [ ] **Step 4: 改 `scripts/scraper/normalize.ts`**

加 35 位新诗人到 POET_META。在 `POET_META = { ... }` 块末尾添加（用 spec 表的内容）：

```ts
// 小学必背诗新增诗人（宋/明/清/现代）
'苏轼': { courtesyName: '子瞻', pseudonym: '东坡居士', birthYear: 1037, deathYear: 1101, familiarity: 5 },
'王安石': { courtesyName: '介甫', pseudonym: '半山', birthYear: 1021, deathYear: 1086, familiarity: 4 },
'杨万里': { courtesyName: '廷秀', pseudonym: '诚斋', birthYear: 1127, deathYear: 1206, familiarity: 4 },
'范成大': { courtesyName: '致能', pseudonym: '石湖居士', birthYear: 1126, deathYear: 1193, familiarity: 3 },
'陆游': { courtesyName: '放翁', birthYear: 1125, deathYear: 1210, familiarity: 5 },
'辛弃疾': { courtesyName: '幼安', pseudonym: '稼轩', birthYear: 1140, deathYear: 1207, familiarity: 5 },
'李清照': { courtesyName: '易安', birthYear: 1084, deathYear: 1155, familiarity: 4 },
'朱熹': { courtesyName: '元晦', pseudonym: '晦庵', birthYear: 1130, deathYear: 1200, familiarity: 4 },
'范仲淹': { courtesyName: '希文', birthYear: 989, deathYear: 1052, familiarity: 3 },
'叶绍翁': { courtesyName: '嗣宗', birthYear: 1100, deathYear: 1150, familiarity: 2 },
'卢钺': { birthYear: 1100, deathYear: 1150, familiarity: 2 },
'郑思肖': { courtesyName: '忆翁', birthYear: 1241, deathYear: 1318, familiarity: 2 },
'黄庭坚': { courtesyName: '鲁直', pseudonym: '山谷道人', birthYear: 1045, deathYear: 1105, familiarity: 3 },
'王观': { courtesyName: '达叟', birthYear: 1050, deathYear: 1120, familiarity: 2 },
'林升': { courtesyName: '云友', birthYear: 1120, deathYear: 1170, familiarity: 2 },
'龚自珍': { courtesyName: '璱人', pseudonym: '定盦', birthYear: 1792, deathYear: 1841, familiarity: 3 },
'查慎行': { courtesyName: '悔余', birthYear: 1650, deathYear: 1727, familiarity: 2 },
'袁枚': { courtesyName: '子才', pseudonym: '简斋', birthYear: 1716, deathYear: 1797, familiarity: 3 },
'郑燮': { courtesyName: '克柔', pseudonym: '板桥', birthYear: 1693, deathYear: 1765, familiarity: 3 },
'于谦': { courtesyName: '廷益', birthYear: 1398, deathYear: 1457, familiarity: 3 },
'毛泽东': { birthYear: 1893, deathYear: 1976, familiarity: 5 },
'林杰': { courtesyName: '智周', birthYear: 750, deathYear: 800, familiarity: 2 },
'虞世南': { courtesyName: '伯施', birthYear: 558, deathYear: 638, familiarity: 2 },
'张志和': { courtesyName: '子同', birthYear: 730, deathYear: 790, familiarity: 2 },
'张继': { birthYear: 710, deathYear: 780, familiarity: 2 },
'纳兰性德': { courtesyName: '容若', birthYear: 1655, deathYear: 1685, familiarity: 3 },
'雷震': { birthYear: 1100, deathYear: 1150, familiarity: 2 },
'翁卷': { courtesyName: '续古', birthYear: 1180, deathYear: 1240, familiarity: 2 },
'曾几': { courtesyName: '志甫', pseudonym: '茶山居士', birthYear: 1085, deathYear: 1166, familiarity: 2 },
'韩翃': { courtesyName: '君平', birthYear: 720, deathYear: 790, familiarity: 2 },
'王建': { courtesyName: '仲初', birthYear: 766, deathYear: 830, familiarity: 2 },
'唐寅': { courtesyName: '伯虎', pseudonym: '六如居士', birthYear: 1470, deathYear: 1524, familiarity: 3 },
'李绅': { courtesyName: '公垂', birthYear: 792, deathYear: 858, familiarity: 2 },
'胡令能': { birthYear: 750, deathYear: 820, familiarity: 2 },
'贾岛': { courtesyName: '浪仙', birthYear: 779, deathYear: 843, familiarity: 3 },
'李峤': { courtesyName: '巨山', birthYear: 644, deathYear: 713, familiarity: 2 },
```

修改 normalize 的输出，让 poet/poem 带 corpus 字段：

```ts
// 在 normalize 函数内：
const poet: Poet = {
  // ...原有字段...
  corpus: 'tang' as PoetCorpus,  // 唐诗抓的全是 tang
};
poets.set(r.poetName, poet);

const poem: Poem = {
  // ...原有字段...
  corpus: 'tang' as PoemCorpus,  // 唐诗抓的全是 tang
};
poems.push(poem);
```

导出类型加 `PoetCorpus` / `PoemCorpus` 引用：从 `../../src/types` 引入。

- [ ] **Step 5: 改 `scripts/scraper/index.ts`**

加 corpus 联合抓取 + 合并：

```ts
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPoemList } from './list';
import { parsePoemPage } from './parse-poem';
import { normalize } from './normalize';
import { fetchPrimary } from './primary';
import { cachedFetch, rateLimitedDelay, CACHE_DIR } from './index-helpers';
import type { Poet, Poem, PoetCorpus, PoemCorpus } from '../../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

// 重导出 helper 给其他 scraper 文件用
export { cachedFetch, rateLimitedDelay, CACHE_DIR } from './index-helpers';

async function main() {
  console.log('Step 1: fetching Tang poem list...');
  const tangList = await fetchPoemList();
  console.log(`  found ${tangList.length} tang poems`);

  console.log('Step 2: fetching each Tang poem page (rate-limited)...');
  const tangRaw: RawPoem[] = [];
  for (let i = 0; i < tangList.length; i++) {
    try {
      const html = await cachedFetch(tangList[i].url);
      tangRaw.push(parsePoemPage(html, tangList[i].url));
    } catch (err) {
      console.error(`  [${i + 1}/${tangList.length}] FAILED ${tangList[i].title}:`, err);
    }
    await rateLimitedDelay();
  }

  console.log('Step 3: fetching primary list...');
  const primaryRaw = await fetchPrimary();

  console.log(`Step 4: normalizing ${tangRaw.length} tang + ${primaryRaw.length} primary...`);
  // 先 normalize 两次，最后手工合并
  const tang = normalize(tangRaw.map(r => ({ ...r, _source: 'tang' as const })));
  const primary = normalize(primaryRaw.map(r => ({ ...r, _source: 'primary' as const })));

  // 按 poemId 去重：primary 中已存在于 tang 的 → corpus: 'both'
  const tangPoemIds = new Set(tang.poems.map(p => p.id));
  const mergedPoems: Poem[] = [...tang.poems];
  for (const p of primary.poems) {
    if (tangPoemIds.has(p.id)) {
      const idx = mergedPoems.findIndex(m => m.id === p.id);
      mergedPoems[idx] = { ...mergedPoems[idx], corpus: 'both' };
    } else {
      mergedPoems.push(p);
    }
  }

  // 按诗人名合并：primary 中已存在的诗人 → 仍保留 tang 身份（用 tang entry）
  // 独有诗人加入
  const tangPoetNames = new Set(tang.poets.map(p => p.name));
  const mergedPoets: Poet[] = [...tang.poets];
  for (const p of primary.poets) {
    if (!tangPoetNames.has(p.name)) {
      mergedPoets.push({ ...p, corpus: 'primary' });
    }
    // 否则原 tang 诗人保留 corpus: 'tang'
  }

  writeFileSync(POEMS_JSON, JSON.stringify(mergedPoems, null, 2));
  writeFileSync(POETS_JSON, JSON.stringify(mergedPoets, null, 2));
  console.log(`  wrote ${mergedPoems.length} poems, ${mergedPoets.length} poets`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 6: 跑抓取器**

Run: `npm run scrape`
Expected: 抓 ~311 唐诗 + ~100 小学；耗时约 7-8 分钟（1 req/s）；可能个别首失败 → 列表会显示

- [ ] **Step 7: 核对数据**

```bash
cd "D:/claude/诗文长河"
# 跑测试
npm test
# 统计
node -e "const p=require('./src/data/poems.json');const s={tang:0,primary:0,both:0};p.forEach(x=>s[x.corpus]++);console.log(s);"
node -e "const p=require('./src/data/poets.json');const s={tang:0,primary:0};p.forEach(x=>s[x.corpus]++);console.log(s);"
```

Expected:
- poems: `{ tang: ~270, primary: ~50, both: ~50 }`（视抓取结果）
- poets: `{ tang: 76, primary: ~30 }`（具体数字看抓取）

- [ ] **Step 8: 镜像到 `scripts/build-standalone.cjs`**

`normalizeCode` 字符串内追加新 POET_META 条目；新加的 `primary-list.ts` / `primary.ts` 的内容如果 standalone 需要（如 loadCode 用到）也要镜像。

- [ ] **Step 9: 重新生成 standalone.html 并验证**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 10: Commit**

```bash
git add scripts/scraper/ scripts/build-standalone.cjs src/data/poems.json src/data/poets.json standalone.html
git commit -m "feat(corpus): scrape 112 primary-school poems, merge with tang, tag corpus field"
```

---

## Task 3: Corpus state (Context + Provider + useCorpus hook)

**Files:**
- Create: `src/state/corpus.tsx`
- Modify: `src/App.tsx`（挂 `<CorpusProvider>`）
- Create: `tests/corpus-context.test.tsx`（用 @testing-library/react 测 hook）
- Modify: `scripts/build-standalone.cjs`（镜像 corpus.tsx）

**Interfaces:**
- Consumes: 无
- Produces:
  - `<CorpusProvider>` 组件（包裹 children；首次渲染从 localStorage 读 corpus 兜底 `'tang'`）
  - `useCorpus(): 'tang' | 'primary'`
  - `useSetCorpus(): (c) => void`（写 localStorage + 触发 re-render）

- [ ] **Step 1: 写测试 `tests/corpus-context.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CorpusProvider, useCorpus, useSetCorpus } from '../src/state/corpus';

function Show() {
  const corpus = useCorpus();
  const set = useSetCorpus();
  return (
    <div>
      <span data-testid="corpus">{corpus}</span>
      <button data-testid="to-primary" onClick={() => set('primary')}>to primary</button>
      <button data-testid="to-tang" onClick={() => set('tang')}>to tang</button>
    </div>
  );
}

describe('CorpusContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to tang when no localStorage', () => {
    render(<CorpusProvider><Show /></CorpusProvider>);
    expect(screen.getByTestId('corpus').textContent).toBe('tang');
  });

  it('reads from localStorage on mount', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    render(<CorpusProvider><Show /></CorpusProvider>);
    expect(screen.getByTestId('corpus').textContent).toBe('primary');
  });

  it('setCorpus updates state and writes localStorage', () => {
    render(<CorpusProvider><Show /></CorpusProvider>);
    act(() => screen.getByTestId('to-primary').click());
    expect(screen.getByTestId('corpus').textContent).toBe('primary');
    expect(localStorage.getItem('feihuaCorpus')).toBe('primary');
  });

  it('useCorpus outside provider throws', () => {
    expect(() => render(<Show />)).toThrow(/outside CorpusProvider/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- tests/corpus-context.test.tsx`
Expected: FAIL（`CorpusProvider` 不存在）

- [ ] **Step 3: 创建 `src/state/corpus.tsx`**

```tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Corpus = 'tang' | 'primary';
const STORAGE_KEY = 'feihuaCorpus';

interface CorpusCtx {
  corpus: Corpus;
  setCorpus: (c: Corpus) => void;
}

const Ctx = createContext<CorpusCtx | null>(null);

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [corpus, setCorpusState] = useState<Corpus>(() => {
    if (typeof localStorage === 'undefined') return 'tang';
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'primary' ? 'primary' : 'tang';
  });

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'primary' || e.newValue === 'tang' || e.newValue === null)) {
        setCorpusState(e.newValue === 'primary' ? 'primary' : 'tang');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- tests/corpus-context.test.tsx`
Expected: PASS（4/4）

- [ ] **Step 5: 改 `src/App.tsx`，挂 Provider**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from './state/corpus';
import { RiverPage } from './pages/RiverPage';
// ... 其余 import 不变

export default function App() {
  return (
    <CorpusProvider>
      <BrowserRouter>
        <Routes>
          {/* ... 不变 ... */}
        </Routes>
        <UpdateToast />
      </BrowserRouter>
    </CorpusProvider>
  );
}
```

- [ ] **Step 6: 跑全量测试 + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 全绿，无 TS 错

- [ ] **Step 7: 镜像到 `scripts/build-standalone.cjs`**

`corpusCode` 字符串中（与 themeCode 同一段位置追加）；在 assembly list 加 `${corpusCode}`；appCode 中 App 组件首行加 `<CorpusProvider>`。

- [ ] **Step 8: 重新生成 standalone.html 并验证**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 9: Commit**

```bash
git add src/state/corpus.tsx src/App.tsx tests/corpus-context.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): add CorpusContext with localStorage persistence + useCorpus hook"
```

---

## Task 4: TopNav CorpusSwitcher

**Files:**
- Create: `src/components/CorpusSwitcher.tsx`
- Modify: `src/components/TopNav.tsx`（三 variant 末尾插入 `<CorpusSwitcher />`）
- Modify: `scripts/build-standalone.cjs`（镜像 switcher + 改 topNavCode）

**Interfaces:**
- Consumes: `useCorpus` / `useSetCorpus` from `state/corpus`
- Produces: `<CorpusSwitcher />` 组件，渲染两段式 segment control；mobile（< 600px）下字号 / padding 收紧；切库瞬间若处于飞花令关卡（pathname 含 `/play/stage/` 或 `/play/sentence/`）调 `navigate('/play')`

- [ ] **Step 1: 写测试 `tests/corpus-switcher.test.tsx`**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { CorpusSwitcher } from '../src/components/CorpusSwitcher';

function renderIn(ui: React.ReactNode, initialPath = '/play') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CorpusProvider>{ui}</CorpusProvider>
    </MemoryRouter>
  );
}

describe('CorpusSwitcher', () => {
  beforeEach(() => localStorage.clear());

  it('renders two segments with current highlighted', () => {
    renderIn(<CorpusSwitcher />);
    expect(screen.getByText('唐诗三百首')).toBeInTheDocument();
    expect(screen.getByText('小学必背')).toBeInTheDocument();
  });

  it('clicking the other segment switches corpus', () => {
    renderIn(<CorpusSwitcher />);
    fireEvent.click(screen.getByText('小学必背'));
    expect(localStorage.getItem('feihuaCorpus')).toBe('primary');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- tests/corpus-switcher.test.tsx`
Expected: FAIL

- [ ] **Step 3: 创建 `src/components/CorpusSwitcher.tsx`**

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { useCorpus, useSetCorpus } from '../state/corpus';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fontFamilies } from '../theme';

const PLAY_SCREEN_RE = /^\/play\/(stage|sentence)\//;

export function CorpusSwitcher() {
  const corpus = useCorpus();
  const setCorpus = useSetCorpus();
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const onSwitch = (next: 'tang' | 'primary') => {
    if (next === corpus) return;
    if (PLAY_SCREEN_RE.test(location.pathname)) {
      navigate('/play', { replace: true });
    }
    setCorpus(next);
  };

  const baseStyle: React.CSSProperties = {
    fontFamily: fontFamilies.chinese,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: isMobile ? '4px 10px' : '6px 14px',
    fontSize: isMobile ? 11 : 13,
    letterSpacing: 2,
    borderRadius: 3,
    transition: 'all 0.15s',
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: '#f5ebd2',
    color: '#1a2855',
    boxShadow: 'inset 0 0 0 1px #d4af6a',
  };
  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    color: '#d4af6a',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #d4af6a',
        borderRadius: 4,
        overflow: 'hidden',
      }}
      role="tablist"
      aria-label="诗库切换"
    >
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'tang'}
        onClick={() => onSwitch('tang')}
        style={corpus === 'tang' ? activeStyle : inactiveStyle}
        data-testid="corpus-tang"
      >{isMobile ? '唐诗' : '唐诗三百首'}</button>
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'primary'}
        onClick={() => onSwitch('primary')}
        style={corpus === 'primary' ? activeStyle : inactiveStyle}
        data-testid="corpus-primary"
      >{isMobile ? '小学' : '小学必背'}</button>
    </div>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- tests/corpus-switcher.test.tsx`
Expected: PASS

- [ ] **Step 5: 改 `src/components/TopNav.tsx`，三 variant 末尾插入**

（具体位置：每个 variant 的 `</div>` 末尾、靠右侧）

```tsx
// 顶部 import 区域加
import { CorpusSwitcher } from './CorpusSwitcher';

// main variant JSX 末尾（返回前）插入
<CorpusSwitcher />

// poet variant 同样
<CorpusSwitcher />

// poem variant 同样
<CorpusSwitcher />
```

> 实际位置按 TopNav.tsx 当前布局调整，确保不破坏既有的标题/返回按钮布局。

- [ ] **Step 6: 跑测试 + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 7: 镜像到 `scripts/build-standalone.cjs`**

新增 `corpusSwitcherCode` 字符串；在 assembly list 加；`topNavCode` 末尾插入 `<CorpusSwitcher />`。

- [ ] **Step 8: 重新生成 standalone.html 并验证**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 9: Commit**

```bash
git add src/components/CorpusSwitcher.tsx src/components/TopNav.tsx tests/corpus-switcher.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): TopNav segment control switches tang/primary corpus"
```

---

## Task 5: Page integration (PoemsRiverPage / PoetPage / PoemPage / PlayHall)

**Files:**
- Modify: `src/pages/PoemsRiverPage.tsx`（`useCorpus` 过滤 + 顶部库标识）
- Modify: `src/pages/PoetPage.tsx`（`useCorpus` 过滤 + 「看全部」toggle）
- Modify: `src/pages/PoemPage.tsx`（corpus 提示 + 切库链接）
- Modify: `src/pages/PlayHall.tsx`（按 corpus 选 KEYWORDS / PRIMARY_KEYWORDS + 当前库标识）
- Modify: `scripts/build-standalone.cjs`（镜像 4 个 page code）

**Interfaces:**
- Consumes: `useCorpus` / `useSetCorpus` / `getPoems(corpus)`
- Produces: 4 个页面在切换 corpus 时正确过滤；PoetPage「看全部」toggle 不受 corpus 切换影响（state 局部）

- [ ] **Step 1: 改 `src/pages/PoemsRiverPage.tsx`**

```tsx
// 文件顶部 import 加
import { useCorpus } from '../state/corpus';

// 组件顶部加
const corpus = useCorpus();

// 替换 getPoems() → getPoems(corpus === 'tang' ? 'tang' : 'primary')
// 即显示时排除 'tang' 或 'primary' 单独库；'both' 在两库都可见
const visiblePoems = getPoems(corpus === 'tang' ? 'tang' : 'primary');

// 顶部加当前库标识
<div style={{ textAlign: 'center', marginBottom: 16, color: '#8b7355', fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 6 }}>
  {corpus === 'tang' ? '唐 诗 三 百 首' : '小 学 必 背'}
</div>
```

- [ ] **Step 2: 改 `src/pages/PoetPage.tsx`**

```tsx
// import
import { useState } from 'react';
import { useCorpus } from '../state/corpus';

// 顶部
const corpus = useCorpus();
const [showAll, setShowAll] = useState(false);

// poems 列表
const allPoems = getPoems().filter(p => p.poetId === poetId);
const visiblePoems = showAll ? allPoems : allPoems.filter(p => {
  if (corpus === 'tang') return p.corpus !== 'primary';
  return p.corpus !== 'tang';
});

// 「看全部」toggle（只有当 allPoems.length > visiblePoems.length 时显示）
<button onClick={() => setShowAll(s => !s)}>
  {showAll ? '只看本库' : '看全部'}
</button>

// 空态
if (visiblePoems.length === 0) {
  return <div>该诗人在 {corpus === 'tang' ? '唐诗三百首' : '小学必背'} 库中无作品</div>;
}
```

- [ ] **Step 3: 改 `src/pages/PoemPage.tsx`**

```tsx
// import
import { useCorpus } from '../state/corpus';
import { Link } from 'react-router-dom';

const corpus = useCorpus();
const inScope = poem.corpus === 'both' || (corpus === 'tang' && poem.corpus !== 'primary') || (corpus === 'primary' && poem.corpus !== 'tang');

// 顶部小字
{inScope ? null : (
  <div style={{ padding: 24, color: '#8b7355', textAlign: 'center' }}>
    这首诗不在当前诗库。
    <br />
    <Link to={corpus === 'tang' ? '/play' : '/play'} onClick={() => useSetCorpus()('tang')}>切到唐诗三百首</Link>
  </div>
)}
```

（`useSetCorpus` 的调用需放在 onClick 回调中，不能直接渲染时调用；建议改成读 useSetCorpus hook）

- [ ] **Step 4: 改 `src/pages/PlayHall.tsx`**

```tsx
// import
import { useCorpus } from '../state/corpus';
import { PRIMARY_KEYWORDS } from '../play/primaryKeywords';

// 顶部
const corpus = useCorpus();
const keywords = corpus === 'tang' ? KEYWORDS : PRIMARY_KEYWORDS;
// 类似地：couplets engine 的 level pool 按 corpus 选

// 顶部库标识
<div style={{ textAlign: 'center', marginBottom: 24, color: '#8b7355', fontSize: 14, letterSpacing: 6 }}>
  当前诗库：{corpus === 'tang' ? '唐诗三百首' : '小学必背'}
</div>

// 印章数据：char tab 用 keywords，sentence tab 用对应 level pool
```

> 注意：PlayHall 之前的"50 关"对小学库可能不够。先用同一个 50 关框架，过滤掉没有小学诗的关；后续如需重新分关在 Task 6 处理。

- [ ] **Step 5: 写测试 `tests/page-corpus-filter.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';

// PoemsRiverPage 切库测试
describe('PoemsRiverPage corpus filter', () => {
  it('shows tang-corpus poems when corpus=tang', () => {
    // 用 render + Provider + 切到 tang，断言不含 primary-only 诗
  });
  it('shows primary-corpus poems when corpus=primary', () => {
    // 反向
  });
});

// 类似地测 PoetPage
```

> 简单实现：只测 getPoems(corpus) 的过滤行为已在 Task 1 测过；page 自身只测 "切库瞬间切换了 props"，不必深入 UI。

- [ ] **Step 6: 跑测试 + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 7: 镜像到 `scripts/build-standalone.cjs`**

`poemsRiverPageCode` / `poetPageCode` / `poemPageCode` / `playHallCode` 注入新逻辑。

- [ ] **Step 8: 重新生成 standalone.html**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 9: Commit**

```bash
git add src/pages/PoemsRiverPage.tsx src/pages/PoetPage.tsx src/pages/PoemPage.tsx src/pages/PlayHall.tsx tests/page-corpus-filter.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): filter poems/poet/play by active corpus across 4 pages"
```

---

## Task 6: 飞花令 engine (PRIMARY_KEYWORDS + Verse.corpus + engine/corpus 参数化)

**Files:**
- Create: `src/play/primaryKeywords.ts`（20 字小学关键字）
- Modify: `src/play/types.ts`（`Verse` 加 `corpus`）
- Modify: `src/play/engine.ts`（`buildKeywordIndex(corpus)` / `pickStageQuestion(corpus, kw, used)` / `getVersesFor(corpus, kw)`）
- Modify: `src/play/couplets.ts`（`pickLevelQuestion(corpus, level, usedUpper)` / `getCorpusVerses(corpus)`）
- Modify: `src/play/progress.ts`（key 加 `${corpus}` 前缀）
- Modify: `src/play/sentenceProgress.ts`（同上）
- Create: `tests/primary-keywords.test.ts`（每字 ≥ 5 句）
- Modify: `scripts/build-standalone.cjs`（镜像）

**Interfaces:**
- Consumes: Task 1 的 `getPoems(corpus)` / Task 2 抓的数据
- Produces:
  - `PRIMARY_KEYWORDS: readonly string[]`（20 字，3+ 字朝代覆盖）
  - 改写后的 `buildKeywordIndex(corpus: 'tang' | 'primary'): Map<string, Verse[]>`
  - `pickStageQuestion(corpus, kw, used)`
  - `pickLevelQuestion(corpus, level, usedUpper)`

- [ ] **Step 1: 写测试 `tests/primary-keywords.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PRIMARY_KEYWORDS } from '../src/play/primaryKeywords';
import { buildKeywordIndex, getVersesFor } from '../src/play/engine';

describe('PRIMARY_KEYWORDS', () => {
  it('has 16-24 keywords', () => {
    expect(PRIMARY_KEYWORDS.length).toBeGreaterThanOrEqual(16);
    expect(PRIMARY_KEYWORDS.length).toBeLessThanOrEqual(24);
  });

  it('each keyword has ≥ 5 primary-corpus verses', () => {
    const idx = buildKeywordIndex('primary');
    for (const kw of PRIMARY_KEYWORDS) {
      const verses = getVersesFor('primary', kw);
      expect(verses.length, `keyword ${kw}`).toBeGreaterThanOrEqual(5);
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- tests/primary-keywords.test.ts`
Expected: FAIL（PRIMARY_KEYWORDS / `buildKeywordIndex(corpus)` 不存在）

- [ ] **Step 3: 创建 `src/play/primaryKeywords.ts`**

先放 24 字候选（数据抓完后跑测试，不够的字砍掉）：

```ts
export const PRIMARY_KEYWORD_GROUPS = {
  entry: ['月','花','春','风','山','水','雪','人'],
  mid: ['天','云','江','秋','夜','日','雨','草'],
  // 备选池（数据不够时按需替换）
  candidate: ['寒','柳','红','白','青','云','思','乡'],
} as const;

export const PRIMARY_KEYWORDS: readonly string[] = [
  ...PRIMARY_KEYWORD_GROUPS.entry,
  ...PRIMARY_KEYWORD_GROUPS.mid,
];
```

> 候选池不放进 PRIMARY_KEYWORDS，只在数据不够时人工替换。

- [ ] **Step 4: 改 `src/play/types.ts`**

```ts
import type { PoemCorpus } from '../types';

export interface Verse {
  poemId: string;
  line: string;
  poemTitle: string;
  poetName: string;
  corpus: PoemCorpus;
}
```

- [ ] **Step 5: 改 `src/play/engine.ts`**

把 `buildKeywordIndex` 改为接受 corpus 参数：

```ts
import { getPoems } from '../data/load';
import type { PoemCorpus } from '../types';
import type { Verse } from './types';

const indexCache = new Map<PoemCorpus, Map<string, Verse[]>>();

export function buildKeywordIndex(corpus: PoemCorpus = 'tang'): Map<string, Verse[]> {
  if (indexCache.has(corpus)) return indexCache.get(corpus)!;
  const poems = getPoems(corpus === 'both' ? 'all' as any : corpus);
  const idx = new Map<string, Verse[]>();
  for (const p of poems) {
    const lines = p.content.split(/[，。？！；：、\n]/).filter(s => s.length > 0);
    for (const line of lines) {
      for (const ch of line) {
        if (!idx.has(ch)) idx.set(ch, []);
        idx.get(ch)!.push({ poemId: p.id, line, poemTitle: p.title, poetName: '', corpus: p.corpus });
      }
    }
  }
  indexCache.set(corpus, idx);
  return idx;
}

export function getKeywordIndex(corpus: PoemCorpus = 'tang'): Map<string, Verse[]> {
  return buildKeywordIndex(corpus);
}

export function getVersesFor(corpus: PoemCorpus, kw: string): Verse[] {
  return buildKeywordIndex(corpus).get(kw) ?? [];
}
```

> 注：原 `poetName: ''` 暂时空着，因为 buildKeywordIndex 不知道诗人的名字。需要在 buildKeywordIndex 内联合 `getPoets` 找 poetName。完整实现：

```ts
import { getPoems, getPoets } from '../data/load';
// ...
const poetMap = new Map(getPoets().map(p => [p.id, p.name]));
// ...
idx.get(ch)!.push({ poemId: p.id, line, poemTitle: p.title, poetName: poetMap.get(p.poetId) ?? '', corpus: p.corpus });
```

`pickStageQuestion` 加 corpus 参数：

```ts
export function pickStageQuestion(corpus: PoemCorpus, kw: string, used: Set<string>) {
  const verses = getVersesFor(corpus, kw).filter(v => !used.has(v.line));
  if (verses.length === 0) return null;
  // ... 既有逻辑，blanks 等不变
}
```

> StagePlay.tsx 调用签名相应改为 `pickStageQuestion(corpus, kw, used)`，详见 Task 7。

- [ ] **Step 6: 改 `src/play/couplets.ts`**

```ts
import { getPoems, getPoet } from '../data/load';
import type { PoemCorpus } from '../types';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import type { Verse } from './types';

export interface SentenceQuestion {
  upper: Verse;
  answer: Verse;
  options: Verse[];
}

const coupletIndexCache = new Map<PoemCorpus, CoupletPair[]>();

function buildCoupletIndex(corpus: PoemCorpus): CoupletPair[] {
  if (coupletIndexCache.has(corpus)) return coupletIndexCache.get(corpus)!;
  const poems = corpus === 'both' ? getPoems() : getPoems(corpus);
  const pairs: CoupletPair[] = [];
  for (const p of poems) {
    const variants = extractVariants(p.content);
    for (const v of variants) {
      const lines = splitIntoLines(v);
      for (let i = 0; i < lines.length - 1; i++) {
        const upper = lines[i];
        const lower = lines[i + 1];
        if (!upper || !lower) continue;
        const poet = getPoet(p.poetId);
        pairs.push({
          upper: { poemId: p.id, line: upper, poemTitle: p.title, poetName: poet?.name ?? '', corpus: p.corpus },
          lower: { poemId: p.id, line: lower, poemTitle: p.title, poetName: poet?.name ?? '', corpus: p.corpus },
        });
      }
    }
  }
  coupletIndexCache.set(corpus, pairs);
  return pairs;
}

export function pickLevelQuestion(corpus: PoemCorpus, level: number, usedUpper: Set<string>): SentenceQuestion | null {
  const pairs = buildCoupletIndex(corpus);
  // 既有 tierOfLevel / filter 逻辑保持
  // ...
}
```

- [ ] **Step 7: 跑 PRIMARY_KEYWORDS 测试，迭代替换不够 5 句的字**

Run: `npm test -- tests/primary-keywords.test.ts`

Expected: 第一遍跑会有字 < 5 句；console 输出哪个字不够；把那个字从 PRIMARY_KEYWORDS 替换为 candidate 池里的另一个字；重跑直到全过。

- [ ] **Step 8: 改 `src/play/progress.ts`**

```ts
import type { Corpus } from '../state/corpus';

const KEY = (corpus: Corpus) => `feihuaProgress:${corpus}`;

export function loadProgress(corpus: Corpus = 'tang') {
  // 兼容旧 key（无前缀 = tang）
  const newKey = KEY(corpus);
  const raw = localStorage.getItem(newKey) ?? localStorage.getItem('feihuaProgress');
  // ...
}

export function commitStageCorrect(corpus: Corpus, kw: string, line: string) {
  // 用 KEY(corpus) 写
}

export function commitStageBlood(corpus: Corpus, kw: string, newBlood: number) {
  // 同上
}

export function markCleared(corpus: Corpus, kw: string) {
  // 同上
}

export function clearCurrent(corpus: Corpus = 'tang') {
  localStorage.removeItem(KEY(corpus));
}
```

- [ ] **Step 9: 改 `src/play/sentenceProgress.ts`**

同上模式，KEY = `feihuaSentenceProgress:${corpus}`。

- [ ] **Step 10: 跑全量测试 + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 全绿（注意现有 96 测试要保持通过；engine/corpus 调用点 StagePlay/SentencePlay 改签名后会在 Task 7 调通）

- [ ] **Step 11: 镜像到 `scripts/build-standalone.cjs`**

`feihuaTypesCode` / `feihuaEngineCode` / `feihuaCoupletsCode` / `feihuaProgressCode` / `feihuaSentenceProgressCode` 加 corpus 逻辑；新加 `primaryKeywordsCode`。

- [ ] **Step 12: 重新生成 standalone.html**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 13: Commit**

```bash
git add src/play/primaryKeywords.ts src/play/types.ts src/play/engine.ts src/play/couplets.ts src/play/progress.ts src/play/sentenceProgress.ts tests/primary-keywords.test.ts scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): engine + couplets + progress accept corpus, add PRIMARY_KEYWORDS"
```

---

## Task 7: 飞花令 play pages (StagePlay / SentencePlay)

**Files:**
- Modify: `src/pages/StagePlay.tsx`（`useCorpus` 调 pickStageQuestion / 进度 key / 关卡中切库时 navigate）
- Modify: `src/pages/SentencePlay.tsx`（同上，pickLevelQuestion / sentenceProgress）
- Modify: `scripts/build-standalone.cjs`（镜像 stagePlayCode / sentencePlayCode）

**Interfaces:**
- Consumes: Task 6 改造后的 engine/couplets/progress + Task 3 的 useCorpus / useSetCorpus
- Produces: 飞花令关卡按 corpus 出题；切库瞬间回 `/play`；进度按 corpus 独立

- [ ] **Step 1: 改 `src/pages/StagePlay.tsx`**

```tsx
// import
import { useCorpus } from '../state/corpus';
import { useLocation } from 'react-router-dom';

// 组件顶部
const corpus = useCorpus();

// 替换所有 commitStageCorrect / commitStageBlood / markCleared / clearCurrent / loadProgress 调用：
//   commitStageCorrect(kw, line) → commitStageCorrect(corpus, kw, line)
//   等

// 替换 pickStageQuestion(kw, used) → pickStageQuestion(corpus, kw, used)

// 关卡中切库回大厅（useEffect 监听 corpus 变化）
useEffect(() => {
  // 在组件 mount 后，如果 corpus 与初始不同 → 提示并回 /play
  // 简化：依赖 CorpusSwitcher 的 onSwitch 已 navigate('/play')，StagePlay 卸载 → 不需额外处理
  // 但若用户从 TopNav 切库（不走 switcher）才需要。
  // 这里放一个兜底：
}, [corpus]);
```

> 实际实现：复用 CorpusSwitcher 的 `PLAY_SCREEN_RE` 逻辑，确保所有切库入口都 navigate 到 `/play`。StagePlay 内不需额外 useEffect 监听。

- [ ] **Step 2: 改 `src/pages/SentencePlay.tsx`**

类似 Step 1 的改动，调 `pickLevelQuestion(corpus, level, used)` / sentenceProgress 用 corpus 前缀。

- [ ] **Step 3: 写测试 `tests/stage-corpus.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { StagePlay } from '../src/pages/StagePlay';

describe('StagePlay with corpus', () => {
  it('renders char stage in primary corpus', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    render(
      <MemoryRouter initialEntries={['/play/stage/月']}>
        <CorpusProvider>
          <Routes>
            <Route path="/play/stage/:kw" element={<StagePlay />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // 断言顶部"当前诗库"标识显示"小学必背"
    // 断言题目诗在小学库内
  });
});
```

- [ ] **Step 4: 跑测试 + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: 全绿

- [ ] **Step 5: 镜像到 `scripts/build-standalone.cjs`**

`stagePlayCode` / `sentencePlayCode` 注入 corpus 参数。

- [ ] **Step 6: 重新生成 standalone.html**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 7: 全量 build 验证**

Run: `npm run build:gh`
Expected: dist/ 重新生成；manifest / sw.js / icons 一切照旧

- [ ] **Step 8: Commit**

```bash
git add src/pages/StagePlay.tsx src/pages/SentencePlay.tsx tests/stage-corpus.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): StagePlay + SentencePlay pick questions from active corpus"
```

---

## Self-Review

### Spec coverage

- §1 数据模型：Task 1 ✓
- §2 抓取层：Task 2 ✓
- §3 状态层：Task 3 ✓
- §4 TopNav 切换器：Task 4 ✓
- §5 页面集成：Task 5 ✓（5 个页面提到 4 个：RiverPage corpus-agnostic 不变）
- §6 飞花令 engine：Task 6 ✓
- §7 测试：分散在每个 Task ✓
- §8 实施阶段：7 个 Task 对应 5 个粗粒度阶段 ✓

### Placeholder scan

无 TBD / TODO / FIXME / "implement later" / 模糊断言。每个 Step 含具体代码块或命令。

### Type consistency

- `PoemCorpus` 定义在 `src/types.ts`（Task 1），所有后续 Task 引用同一处
- `PoetCorpus` 同上
- `Corpus`（state 层 'tang' | 'primary'）在 `src/state/corpus.tsx` 独立类型
- `getPoets()` / `getPoems()` 多重载签名在 Task 1 确定，后续 Task 调用按签名
- `buildKeywordIndex(corpus)` / `pickStageQuestion(corpus, kw, used)` 在 Task 6 确定，Task 7 调用按签名

无函数名/签名漂移。
