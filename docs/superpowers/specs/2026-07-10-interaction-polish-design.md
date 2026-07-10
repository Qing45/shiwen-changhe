# 交互打磨（P1 正确性 + P2 体验感）设计

**日期**：2026-07-10
**范围**：全局 glue（TopNav / CorpusSwitcher / 路由切换）+ 诗库浏览（RiverPage / PoemsRiverPage / PoemPage / PoetPage）
**目标**：修复切到 primary/all 语料时的硬编码错位（写死的"唐"字面量、写死的 618-907 年份范围），并加入路由切换/切库/节点点击的轻量动效反馈。
**不在范围**：SearchBox 键盘导航、hover 信息补全、PoetPage 空态完善（归入 P3，本次不做）；TimeAxis 朝代色带、路由动画库引入（架构级，独立议题）。

---

## 背景

primary 语料库（51 首宋/清/明/现代/南北朝诗）已并入后，多处 UI 仍写死"唐"和 618-907 年份。结果：

- 苏轼的诗页显示 `苏轼 · 唐`
- 鼠标悬停 River 上的苏轼节点，hover tooltip 显示 `唐`
- `PoemsRiverPage` 把龚自珍（1841）/毛泽东（1976）按 907 上限归一化，全部压到画布最右端
- `TopNav` 的 DynastyLabel 不论变体恒显示"唐"

同时路由切换、切库、节点点击缺乏过渡反馈，体感"硬"。

---

## 架构

### 数据层（新增）

**`src/data/dynasties.ts`** — 小常量表，不入 JSON：

```ts
export const DYNASTIES = {
  tang:   { name: '唐',     startYear: 618,  endYear: 907 },
  song:   { name: '宋',     startYear: 960,  endYear: 1279 },
  ming:   { name: '明',     startYear: 1368, endYear: 1644 },
  qing:   { name: '清',     startYear: 1644, endYear: 1912 },
  modern: { name: '近现代', startYear: 1912, endYear: 1976 },
  other:  { name: '南北朝', startYear: 386,  endYear: 589 },
} as const;

export type DynastyId = keyof typeof DYNASTIES;

export const getDynastyName = (id: string): string => DYNASTIES[id]?.name ?? '唐';
export const getDynasty = (id: string): Readonly<{ name: string; startYear: number; endYear: number }> | undefined =>
  DYNASTIES[id];
```

兜底逻辑：未知 dynastyId 显示"唐"，与项目主语料（唐诗三百首）一致，避免运行时报错。

**`src/utils/yearRange.ts`** — 按语料计算 layout range 和 ticks：

```ts
export interface YearRange {
  minYear: number;
  maxYear: number;
  ticks: { year: number; label?: string; pos: number }[];
  leftLabel: string;
  rightLabel: string;
}

export function computeCorpusYearRange(
  poets: ReadonlyArray<Poet>,
  corpus: Corpus,
): YearRange
```

**算法**：

1. **派生可见诗人**：必须从 poem 反推 poet，不能用 `getPoets(corpus)`——后者不会把 `corpus='both'` 标签的唐诗（如《静夜思》李白）算入 primary 视图。具体步骤：
   ```ts
   const poemCorpus = corpus === 'all' ? 'both' : corpus;
   const visiblePoems = getPoems(poemCorpus);  // 复用 load.ts 现有过滤
   const poetIds = new Set(visiblePoems.map(p => p.poetId));
   const visiblePoets = getPoets().filter(p => poetIds.has(p.id));
   ```
2. 取 `min(visiblePoets.birthYear)` 和 `max(visiblePoets.deathYear)`，按 3% 跨度外扩 padding（向下/向上取整到 10 的倍数）。
3. ticks 间距自适应：
   - 跨度 ≤300 年：每 30 年一格
   - 跨度 ≤700 年：每 50 年一格
   - 否则：每 100 年一格
4. `leftLabel` = `${minYear} · ${getDynastyName(最早出生诗人 dynastyId)}`；`rightLabel` = `${maxYear}`。

**预期结果**：
- `corpus === 'tang'`：minYear ≈ 618，maxYear ≈ 907（与现状一致）
- `corpus === 'primary'`：minYear ≈ 380（北朝民歌），maxYear ≈ 1976（毛泽东）
- `corpus === 'all'`：minYear ≈ 380，maxYear ≈ 1976

### 双源 mirror 约束

每个新增/修改的 `src/*.ts(x)` 文件都必须以字符串字面量形式同步到 `scripts/build-standalone.cjs`。这是项目既有约束（standalone HTML 构建依赖此 mirror）。所有任务验收时检查 mirror 一致性。

---

## P1：正确性修复（5 处写死 → 派生）

| # | 位置 | 现状 | 改法 |
|---|---|---|---|
| 1 | `TopNav.tsx:145-156` DynastyLabel | 不论变体恒显示 "唐" | 接收 `dynastyId?: string` 参数；`main` 变体不渲染该组件（main 显示多朝代，单一朝代名误导）；`poet` / `poem` 变体传 `props.poet.dynastyId`，渲染 `getDynastyName(dynastyId)` |
| 2 | `PoemPage.tsx:230` | `{poet.name} · 唐` | `{poet.name} · {getDynastyName(poet.dynastyId)}` |
| 3 | `RiverPage.tsx:135` hover | `<span>唐</span>` | `<span>{getDynastyName(poet.dynastyId)}</span>` |
| 4 | `PoemsRiverPage.tsx:13-20, 30, 157` | `POEMS_RIVER_TICKS` 硬编码 618-907；`layoutAllPoems({minYear:618,maxYear:907})`；`TimeAxis left="618 · 唐" right="907"` | 删常量；调用 `computeCorpusYearRange(getPoets(), corpus)` 取 range；layout / TimeAxis 全部用返回值 |
| 5 | `RiverPage.tsx:13-20, 24, 152` | 同上 | 同上 |

**TopNav 变体调用约束**：
- `main` 变体（用于 RiverPage、PoemsRiverPage）：不再渲染 DynastyLabel。视觉上 CorpusSwitcher 的 `marginLeft:'auto'` 会自然靠右。若验收发现视觉太空，可加一个空占位 `<div style={{marginLeft:'auto'}}>`，不增加复杂度。
- `poet` / `poem` 变体：TopNav 内部从 `props.poet.dynastyId` 取值传给 DynastyLabel。

**TimeAxis 兼容性**：
- 现有 `TimeAxis` props 是 `{ left, right, ticks }`，签名不变。
- primary/all 语料下 ticks 数量从 10 涨到 ~16（百年一格在 1596 年跨度上是 16 格），密度可接受。
- 若验收时仍挤，加一个 `labelEveryNth` 抽稀参数（每隔 N 个 tick 才标年份），不重写架构。本次先不做。

---

## P2：体验感（路由切换 + 切库 fade + 节点 press）

### 2.1 路由切换：滚动复位 + 内容渐入

**问题**：PoemPage 切上/下一首时（键盘 ← →），新诗用了旧诗的滚动位置；PoetPage 切诗人时同样。

**改法**：
- `PoemPage`：现有 `useEffect([poem.id])` 内加 `containerRef.current?.scrollTo(0, 0)`，容器是 scrollable paper div。
- `PoetPage`：新增 `useEffect([poet.id])` 调 `window.scrollTo(0, 0)`。
- 渐入：PoemPage 的标题/正文外层 div 加 `key={poem.id}` + CSS `animation: fade-in 0.3s ease-out`。
- `fade-in` keyframe 当前不存在（已有 `node-float` / `feihuaFadeUp` 等动画，无通用 fade-in）。在 `index.html` 的 `<style>` 块和 `scripts/build-standalone.cjs` 的 CSS 段同步新增：
  ```css
  @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
  ```

**不做**：路由级 `<CSSTransition>`、左右滑动方向感（与键盘方向打架）。

### 2.2 切库 fade

**问题**：CorpusSwitcher 切库时画布瞬时换内容。

**改法**：
- 在 `RiverPage` 和 `PoemsRiverPage` 的内层画布 `<div>`（当前 `width: '600%'` 那个）加 `key={corpus}`，切库时 remount。
- 配合 CSS `animation: fade-in 0.25s ease-out`，纯 CSS 实现，不遮罩、不延迟 navigate。

**不做**：loading 状态（数据同步读 JSON，无异步）；PoemPage/PoetPage 切库 fade（这两页切库走 redirect，单独路径）。

### 2.3 节点 press 反馈

**问题**：River 节点 hover 有动画（`node-float`），但点击瞬间无反馈。

**改法**：
- RiverPage + PoemsRiverPage 的节点外层 `<div>` 加 `:active` 样式：`transform: scale(0.92)`，`transition: transform 0.1s`。
- 用 CSS `:active` 伪类（零 JS 开销，天然处理 touch）。
- 不影响内层 `node-float` 动画（外层 transform 与内层 animation 是不同属性，互不冲突）。

**不做**：涟漪/声效/震动。

---

## 测试策略

### 新增单元测试

- `src/data/dynasties.test.ts`：
  - `getDynastyName('song') === '宋'`
  - `getDynastyName('qing') === '清'`
  - `getDynastyName('modern') === '近现代'`
  - `getDynastyName('unknown') === '唐'`（兜底）
- `src/utils/yearRange.test.ts`：
  - tang 语料：minYear 在 [600, 625]、maxYear 在 [895, 920] 容差区间（外扩 padding 不应跑出 25 年）
  - primary 语料：minYear ≤ 400（覆盖北朝民歌 386），maxYear ≥ 1960（覆盖毛泽东 1976），ticks 间距 = 100
  - all 语料：取全局 min/max，与 primary 接近
  - leftLabel 形如 `${year} · ${dynastyName}`

### 新增交互测试

- `PoemPage.scroll-reset.test.tsx`（RTL）：
  - 渲染 PoemPage，模拟 paper container 滚动到 y=200
  - 切换 poem.id（用 MemoryRouter + 不同 id）
  - 断言 `container.scrollTop === 0`

### 人工验收清单

- dev server 启动后依次确认：
  - [ ] 苏轼（song）诗页标题显示 `苏轼 · 宋`
  - [ ] 毛泽东（modern）诗页标题显示 `毛泽东 · 近现代`
  - [ ] River hover 苏轼节点显示 `宋`
  - [ ] PoemsRiverPage 切到 primary 语料，龚自珍/毛泽东节点不再堆在右端
  - [ ] TopNav 在 main 变体下不再显示 "唐" 占位
  - [ ] PoetPage dynasty label 显示正确朝代
  - [ ] PoemPage ←/→ 切诗后内容从顶部开始显示，且有 0.3s 渐入
  - [ ] 切库（CorpusSwitcher）画布有 0.25s 淡入
  - [ ] River 节点鼠标按下时缩到 0.92

### 不测试

- CSS 动画本身的视觉效果（jsdom 不渲染样式，靠人工验收）
- CorpusSwitcher 的 redirect 逻辑（已有测试覆盖）

---

## 任务拆分（8 个任务，顺序执行）

| # | 任务 | 文件 | 测试 |
|---|---|---|---|
| T1 | 新建 dynasties 数据 + mirror | `src/data/dynasties.ts`, `scripts/build-standalone.cjs` | `src/data/dynasties.test.ts` |
| T2 | 新建 yearRange 工具 + mirror | `src/utils/yearRange.ts`, `scripts/build-standalone.cjs` | `src/utils/yearRange.test.ts` |
| T3 | TopNav DynastyLabel 派生 + main 变体移除 | `src/components/TopNav.tsx`, `scripts/build-standalone.cjs` | TopNav 现有渲染测试更新 |
| T4 | PoemPage dynasty label 派生 | `src/pages/PoemPage.tsx`, `scripts/build-standalone.cjs` | — |
| T5 | RiverPage dynasty + range + ticks 派生 | `src/pages/RiverPage.tsx`, `scripts/build-standalone.cjs` | — |
| T6 | PoemsRiverPage range + ticks 派生 | `src/pages/PoemsRiverPage.tsx`, `scripts/build-standalone.cjs` | — |
| T7 | 路由切换滚动复位 + 渐入 | `src/pages/PoemPage.tsx`, `src/pages/PoetPage.tsx`, `scripts/build-standalone.cjs`, CSS | `PoemPage.scroll-reset.test.tsx` |
| T8 | 切库 fade + 节点 :active 反馈 | `src/pages/RiverPage.tsx`, `src/pages/PoemsRiverPage.tsx`, `scripts/build-standalone.cjs`, CSS | — |

**依赖**：T3-T6 依赖 T1-T2 完成；T8 部分依赖 T5-T6（同一文件后续修改）。

---

## 风险与缓解

1. **mirror 一致性**：每个 src 改动都要同步 build-standalone.cjs。SDD reviewer 把"mirror 一致性"作为每任务验收项。
2. **TimeAxis tick 密度**：primary/all 下 ticks 数量翻倍。yearRange 算法优先稀疏（100 年优先于 30 年），预期 ≤16 个。若仍挤，加 `labelEveryNth` 抽稀（独立小改，不重写）。
3. **DynastyLabel 在 main 变体被删后视觉**：CorpusSwitcher 自带 `marginLeft:'auto'` 靠右，预期不塌。验收若空，加占位 div。
4. **毛泽东 1976 这个数字**：作为 modern 朝代 endYear。这是事实性年份（与 907/1279/1644/1912 一致口径），不加政治注释。
5. **scroll-reset 测试在 jsdom 的局限**：`scrollTo` 在 jsdom 只更新 `scrollTop` 不渲染。测试只断言 `scrollTop === 0`，不验证视觉。

---

## 不在范围内（YAGNI 明确）

- framer-motion / react-transition-group 路由动画库
- TimeAxis 朝代色带重写
- SearchBox 键盘导航（P3）
- hover 信息补全（P3）
- PoetPage 空态完善（P3）
- layout.ts 核心算法改动（只改 range 数据来源）
