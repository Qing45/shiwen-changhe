# 小学飞花令按年级累加题库 设计文档

> 状态：待实现。实现请用 superpowers:writing-plans 生成分步计划。

## 一句话目标

诗库=小学时，飞花令大厅顶部提供「年级·学期」选择器；选某端点（如 3 年级上册），三个玩法的题库 = 从 1 年级上册累加到该端点的全部小学诗文，关数随池子自适应，每个端点独立记录通关进度。

## 背景

- 小学库现有 108 首（`corpus === 'primary'` 94 首 + `corpus === 'both'` 14 首），飞花令目前把整个小学库当一个池，固定单字 30 关 / 整句 30 关 / 整篇 30 关。
- 数据里**没有**年级/册次字段，需新增。
- 三个引擎（`engine.ts` 单字、`couplets.ts` 整句、`titles.ts` 整篇）都以 `PoemCorpus` 为入口，内部 `getPoems(corpus)`，并各有按 corpus 分桶的懒加载缓存。
- 三个进度模块（`progress.ts` / `sentenceProgress.ts` / `titleProgress.ts`）结构一致：`storageKey(corpus)` = tang 无后缀、其它 `:${corpus}`。

## 已确认的产品决策

| 决策点 | 选定 |
|---|---|
| 年级标签来源 | 我按**统编版（部编版）2019 版必背古诗词目录**逐首映射；无定论者取最常见归属，映射表单独成文件便于核对 |
| 作用范围 | 单字 / 整句 / 整篇**三个玩法全部**按年级累加 |
| 选择器位置 | 飞花令大厅顶部（仅诗库=小学时出现），不影响长河主视图 |
| 题库不足 | **关数随池子伸缩**：低年级关少、高年级关多 |
| 进度归属 | **每个年级端点独立进度**（切端点互不干扰） |
| 默认端点 | **6 年级下册 = 全部 108 首**（与现有行为一致，老用户不突兀） |
| 记忆 | localStorage **记住上次选的端点** |
| 选择器样式 | **横排印章式 chips**（与现有 KeywordSeal 风格统一） |
| 单字关键字策略 | **沿用现有 30 字表**（`PRIMARY_KEYWORDS`），按累加池过滤，保留难度分档 |

## 年级粒度定义

- band 整数编码：`1上=1, 1下=2, 2上=3, 2下=4, 3上=5, 3下=6, 4上=7, 4下=8, 5上=9, 5下=10, 6上=11, 6下=12`。
- 「累加到 band N」= 取所有 `gradeBand <= N` 的小学诗。
- 选择器只列**数据中真有诗**的端点（某端点 0 首则不显示 chip，但累加逻辑仍用连续 band 值）。

## 架构分层

### 1. 数据层

**`src/data/poems.json`** — 给每首 `corpus` 为 `primary` 或 `both` 的诗新增 `gradeBand: number`（1–12）。`corpus === 'tang'` 的诗不加此字段。

**`src/types.ts`** — `Poem` 接口加可选字段：
```ts
gradeBand?: number; // 1..12（1上=1 … 6下=12）；仅小学诗有，tang 诗为 undefined
```

**`src/data/grades.ts`（新建）**：
```ts
import type { Poem } from '../types';
import { getPoems } from './load';

// band 端点定义：value 用于累加比较，label 用于 chip 显示。
// 只有数据里真有诗的端点会在 UI 出现（由 getAvailableBands 过滤）。
export interface GradeBand { value: number; label: string; }

export const GRADE_BANDS: readonly GradeBand[] = [
  { value: 1,  label: '一上' }, { value: 2,  label: '一下' },
  { value: 3,  label: '二上' }, { value: 4,  label: '二下' },
  { value: 5,  label: '三上' }, { value: 6,  label: '三下' },
  { value: 7,  label: '四上' }, { value: 8,  label: '四下' },
  { value: 9,  label: '五上' }, { value: 10, label: '五下' },
  { value: 11, label: '六上' }, { value: 12, label: '六下' },
];

export const MAX_BAND = 12;

// 累加：所有 gradeBand <= band 的小学诗（primary + both）。
export function getPrimaryPoemsUpTo(band: number): Poem[] {
  return getPoems('primary').filter(
    (p) => typeof p.gradeBand === 'number' && p.gradeBand <= band,
  );
}

// UI 只显示真有诗的端点。
export function getAvailableBands(): GradeBand[] {
  const present = new Set(
    getPoems('primary')
      .map((p) => p.gradeBand)
      .filter((b): b is number => typeof b === 'number'),
  );
  // 端点可累加：只要 <= 某端点有诗，该端点就可选（累加非空）。
  return GRADE_BANDS.filter((b) => [...present].some((v) => v <= b.value));
}
```
（注：`getPoems('primary')` 现有实现返回 `corpus !== 'tang'`，即 primary + both，正好是小学库全集。）

### 2. 状态层

**`src/state/primaryGrade.ts`（新建）** — 年级端点的读写与记忆：
```ts
const KEY = 'shiwen-feihua-grade';

export function loadGrade(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const n = raw == null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? n : MAX_BAND; // 默认 6 下 = 全部
  } catch { return MAX_BAND; }
}

export function saveGrade(band: number): void {
  try { window.localStorage.setItem(KEY, String(band)); } catch { /* ignore */ }
}
```
UI 用普通 React state 持有当前 band，初值 `loadGrade()`，变更时 `saveGrade()`。不引入全局 Context（只有飞花令这一处消费）。

### 3. 引擎层

三个引擎新增可选 `band` 参数，缓存键从 `corpus` 扩展为 `corpus:band`（tang 无 band 时用纯 `corpus`）。band 过滤只对小学池生效。

**共用过滤入口**：引擎内部取诗池的地方，从 `getPoems(corpus)` 改为：
```ts
const poems = (corpus !== 'tang' && band != null)
  ? getPrimaryPoemsUpTo(band)
  : (corpus === 'both' ? getPoems() : getPoems(corpus));
```

**`engine.ts`（单字）**：
- `buildKeywordIndex` / `buildKeywordIndexFullScan` / `getKeywordIndex` / `getKeywordIndexFullScan` / `getVersesFor` / `pickStageQuestion` 加可选 `band`。
- 缓存 `Map<string, ...>`，键由 `corpus` 改为 `` `${corpus}:${band ?? 'all'}` ``。

**`couplets.ts`（整句）**：
- `buildAllCouplets` / `getAllCouplets` / `getShortPool` / `getLongPool` / `getPoolForTier` / `pickLevelQuestion` 加可选 `band`，缓存键同上。

**`titles.ts`（整篇）**：
- `buildPool` / `pickTitleQuestion` 加可选 `band`。

### 4. 自适应关数

单字/整句/整篇每模式的**可玩关数由累加池决定**（低年级 < 现值）：

- **单字**：现有 `PRIMARY_KEYWORDS`（30 字，三档 entry/mid/advanced）经累加池过滤——只保留在池中 `getVersesFor(kw, 'primary', band).length >= 5` 的字。每档实际关数 = 该档保留字数。字表顺序与难度分档不变，保证既有 `cleared[]` 语义稳定。
- **整句**：每档关数 = `min(现封顶, 池能凑出的不重复上句数)`。现封顶 entry 10 / mid 20。
- **整篇**：关数 = `min(现封顶 30/50, floor(池诗数 / 每关消耗))`，池至少要能出 4 选项。
- 某模式在当前 band 下 0 关：该 tab 内显示「本年级暂无关卡，请选更高年级」占位，不渲染关卡网格。

计算关数的纯函数放在各引擎旁（如 `couplets.ts` 导出 `countAvailableLevels(tier, corpus, band)`），供大厅渲染与 play 页共用，避免重复逻辑。

### 5. UI + 进度层

**`src/pages/PlayHall.tsx`**：
- 诗库=小学（`corpus === 'primary'`）时，在三个 tab 上方渲染 `<GradeSelector>`：横排 chips，用 `getAvailableBands()` 生成，当前端点高亮，点击 `setBand + saveGrade`。
- 三个 ModeBody 接收 `band`，用自适应关数函数决定印章网格长度；0 关时显示占位。

**`src/components/GradeSelector.tsx`（新建）** — 横排印章 chips，复用现有印章视觉；移动端可横向滚动。

**进度隔离** — 三个进度模块的 `storageKey` 在小学库场景追加 band 后缀：
```ts
function storageKey(corpus: Corpus, band?: number): string {
  if (corpus === 'tang') return STORAGE_KEY;                 // 不变
  const base = `${STORAGE_KEY}:${corpus}`;
  // 默认端点(=MAX_BAND, 全部)沿用旧无后缀 key，保住老用户小学库进度；
  // 其它端点用 :g{band} 隔离。band 省略时也走 base（等价全部）。
  if (band == null || band === MAX_BAND) return base;
  return `${base}:g${band}`;
}
```
所有 `loadX/saveX/markX/...` 函数透传可选 `band`。关键兼容点：**band=MAX_BAND（默认「六下=全部」）复用旧的无后缀 `:primary` key**，因此老用户既有小学库进度在默认端点下原样保留；只有主动切到非全部端点才启用独立 `:g{band}` key。tang 路径字节级不变，零回归。

**Play 页**（`StagePlay.tsx` / `SentencePlay.tsx` / `TitlePlay.tsx`）：进入时读同一 `loadGrade()` band，用它构建题库并读写对应 band 的进度。

### 6. Standalone 镜像

`scripts/build-standalone.cjs` 内联同样改动：`gradeBand` 数据随 `poems.json` 自动带入；镜像 `grades.ts` 逻辑、三引擎 band 参数、三进度模块 band 后缀、`GradeSelector` 与 PlayHall 集成、play 页构建。改完 `npm run build:standalone && npm run verify:standalone`。

## 数据流

```
用户点 chip「三上」(band=5)
  → setBand(5) + saveGrade(5)
  → PlayHall 三个 ModeBody 用 band=5 算自适应关数 → 渲染印章网格
  → 进 /play/stage/春 → StagePlay 读 loadGrade()=5
    → getVersesFor('春','primary',5) 只取 gradeBand<=5 的诗句
    → 通关 markCleared('春','primary',5) 写 key '...:primary:g5'
  → 切回「四上」(band=7) → 独立进度 key '...:primary:g7'，互不干扰
```

## 错误与边界处理

- **band 无诗**：`getAvailableBands` 已过滤，UI 不出现空端点。
- **某模式 0 关**：tab 内占位文案，不崩。
- **localStorage 损坏/越界 band**：`loadGrade` 兜底为 `MAX_BAND`。
- **tang / 全库路径**：band 为 undefined，所有逻辑退回现状，零回归。
- **映射争议诗**：以统编版 2019 为准，映射表独立成文件（`grades.ts` 或伴随 json 注释），便于人工核对修正。

## 测试策略

1. **年级映射与累加**（`grades.test.ts`）：`getPrimaryPoemsUpTo(band)` 单调递增；band=12 = 全部 108 首；`getAvailableBands` 只含有诗端点。
2. **引擎 band 过滤**：`getVersesFor(kw,'primary',band)` ⊆ `getVersesFor(kw,'primary',12)`；band 越大句数越多（单调）。
3. **自适应关数**：`countAvailableLevels` 在低 band 返回更少，band=12 等于现值。
4. **进度隔离**：不同 band 的 `markCleared` 写不同 key，互不读到对方 `cleared[]`；tang 路径 key 与旧版一致（回归锁）。
5. **状态记忆**：`saveGrade → loadGrade` 往返；损坏值兜底。
6. **全量回归**：现有 178 测试保持通过。

## 文件清单

- 改 `src/types.ts` — `Poem.gradeBand?`
- 改 `src/data/poems.json` — 108 首加 `gradeBand`
- 新 `src/data/grades.ts` + `grades.test.ts`
- 新 `src/state/primaryGrade.ts`
- 改 `src/play/engine.ts` / `couplets.ts` / `titles.ts` — band 参数 + 缓存键 + `countAvailableLevels`
- 改 `src/play/progress.ts` / `sentenceProgress.ts` / `titleProgress.ts` — band 后缀
- 新 `src/components/GradeSelector.tsx`
- 改 `src/pages/PlayHall.tsx` — 选择器 + 自适应关数 + 占位
- 改 `src/pages/StagePlay.tsx` / `SentencePlay.tsx` / `TitlePlay.tsx` — 读 band 建题库+进度
- 改 `scripts/build-standalone.cjs` — 全部镜像
- 各引擎/进度对应测试

## 非目标（YAGNI）

- 不做年级下的「本册单独玩」（只累加，符合你的例子）。
- 不做 tang / 全库的年级过滤（年级是小学教材概念）。
- 不做长河主视图的年级过滤。
- 不迁移既有进度 key：默认端点「六下=全部」复用旧无后缀 `:primary` key（老用户小学库进度原样保留），仅非全部端点启用新 `:g{band}` key。
