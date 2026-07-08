# 诗文长河 — 诗文河（Poems River）页面

## Context

首页 `RiverPage` 当前只显示 76 位诗人节点散布在唐朝 618-907 时间线上。用户要求加一个"诗文河"视图：把 320 首诗按创作时间散布在同样的时间线上，作为诗人河的姊妹视图。首页加两个互斥按钮"诗人 | 诗文"在两个视图间切换，默认诗人河。

关键约束：现有 `poems.json` 里 320 首诗一首都没有 `creationYear`（schema 里有此字段但全空）。需要先做数据补全，再建页面。

## Approach

三阶段：先补 `creationYear` 数据，再加布局函数，最后建页面 + 路由 + 导航。

### Phase 1: 数据补全（`creationYear` 字段）

给 `src/data/poems.json` 每首诗加 `creationYear: number | null`。提取按优先级：

1. **首选 — 括号数字年**：正则 `(\d{3,4})\s*年` 抓 `background` 里所有数字年。若多个，挑离 "作于/写于/创作于/作/写" 最近的一个。覆盖绝大多数有 background 的诗（典型格式："元和四年（809）作于洛阳" → 809）。
2. **次选 — 年号映射**：若步骤 1 抓不到数字年，匹配 `background` 里的唐代年号 + "初/中/末/间" 词缀。维护一张唐代 ~50 个年号的起止年表；"初" → 起年+1、"末" → 止年-1、"间/中" → 中位数。例："贞元初" → 786、"天宝末" → 755、"大历年间" → 772。
3. **兜底 — 诗人生命周期均分**：无任何时间线索的诗，按现有 `layoutPoems` 的均分策略：在 poet.birthYear → poet.deathYear 间均匀分布。同一诗人内若多首同时无年，按 background 里 "早年/中年/晚年" 关键词调整先后顺序（早年 → 0-33%、中年 → 33-66%、晚年 → 66-100%）。

预期覆盖率：步骤 1+2 覆盖 ~206/320，剩余 ~114 走兜底。

### Phase 2: 布局函数 `layoutAllPoems`

`src/utils/layout.ts` 新增：

```ts
export function layoutAllPoems(
  poems: Poem[],
  poets: Poet[],
  range: LayoutRange,
): { poem: Poem; x: number; y: number }[]
```

- 复用现有 `assignPositions` / `scatterPositions`（自带防重叠 + 全局碰撞注册）
- 排序键：`poem.creationYear ?? poetOf(poem).birthYear`
- 时间范围：`{ minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 }`（与 `RiverPage` 一致）
- 320 节点比 76 密集 4×，但 `assignPositions` 已自动把 >7 节点的列切到 2D scatter，无需调参

不改动现有 `layoutPoets` / `layoutPoems`（PoetPage 仍用旧的 `layoutPoems`）。

### Phase 3: 页面 + 路由 + 导航

**新增页面** `src/pages/PoemsRiverPage.tsx`：
- 几乎是 `RiverPage.tsx` 的镜像：`getPoets` → `getPoems`+`getPoets`、`layoutPoets` → `layoutAllPoems`、`<Link to={/poet/${id}}>` → `<Link to={/poem/${id}}>`
- 节点大小：`nodeSizes[poem.familiarity]`，focal 判断 `poem.familiarity >= 5`
- 共享 `TopNav` / `RiverBackground` / `TimeAxis` / `useRiverViewport`

**路由变更**（`src/components/App.tsx`）：
- `/` → `RiverPage`（诗人河，默认）
- `/poems` → `PoemsRiverPage`（诗文河，新增）
- `/poet/:id`、`/poem/:id` 不变

**TopNav 改造**：
- 左侧加两个互斥按钮"诗人 | 诗文"
- 用 `useLocation()` 判断当前路由，激活项加高亮（白色字 + 底部 2px 高亮线）
- 点击 → `<Link to="/">` / `<Link to="/poems">`
- 现有 `variant="main"` 和 `variant="poet"` 入口保留；新加一个 `variant` 或在 `main` 内根据路由判断

**节点点击**：诗文河点节点 → `/poem/:id`（现有的 `PoemPage`，无需改）

**TimeAxis**：左 "618 · 唐"、右 "907"，跟诗人河一致。

### Phase 4: Standalone 同步

`scripts/build-standalone.cjs`：
- 加 `poemsRiverPageCode` 模板（镜像 `riverPageCode`）
- `appCode` 模板里 mini-router 加 `/poems` 路由分支
- `topNavCode` 加两按钮

## Files to modify

| 文件 | 改动 |
|------|------|
| `src/data/poems.json` | 320 首诗每首加 `creationYear` 字段 |
| `src/utils/layout.ts` | 新增 `layoutAllPoems` 函数 + 唐代年号映射常量 |
| `src/utils/layout.test.ts` | 加 `layoutAllPoems` 的几个测试（排序、范围、不修改输入） |
| `src/pages/PoemsRiverPage.tsx` | **新建**，镜像 `RiverPage.tsx` |
| `src/components/App.tsx` | 加 `/poems` 路由 |
| `src/components/TopNav.tsx` | 左侧加两按钮 + `useLocation` 高亮逻辑 |
| `src/types.ts` | `Poem` 接口加 `creationYear?: number \| null` |
| `scripts/build-standalone.cjs` | 加 `poemsRiverPageCode`、`appCode` 路由、`topNavCode` 按钮 |
| `standalone.html` | `npm run build:standalone` 重新生成 |

## Existing code to reuse

- `assignPositions` / `scatterPositions` / `computePercent` / `mulberry32` (`src/utils/layout.ts`) — 布局核心算法
- `useRiverViewport` (`src/hooks/useRiverViewport.ts`) — 缩放/拖动 + `dragging` 状态
- `RiverBackground` (`src/components/RiverBackground.tsx`) — 银河背景动画（最近刚加 4 套）
- `TimeAxis` (`src/components/TimeAxis.tsx`) — 底部时间轴
- `TopNav` (`src/components/TopNav.tsx`) — 顶部导航（要扩展）
- `nodeSizes` / `fontSizes` / `fontFamilies` / `colors` (`src/theme.ts`) — 节点尺寸/字体
- `getPoems` / `getPoets` / `getPoet` (`src/data/load.ts`) — 数据访问
- `PoemPage` (`src/pages/PoemPage.tsx`) — 诗文详情页，复用

## Verification

1. `npm test` — 现有 28 测试 + 新增 `layoutAllPoems` 测试全部通过
2. `npx tsc --noEmit` — 无类型错误
3. `npm run dev` 浏览器手动验证：
   - 默认 `/` 显示诗人河（76 节点）
   - 点 TopNav"诗文"按钮 → 跳 `/poems`，显示 320 节点的诗文河
   - 时间轴 618-907 一致；节点不重叠（ Scatter 自动错开）
   - 点诗文节点 → `/poem/:id` 跳到现有 PoemPage
   - 两个河共享背景动画（流星/银河流动/视差/星点漂移）
   - TopNav 当前激活按钮高亮（诗人在 `/`，诗文在 `/poems`）
4. `npm run build:standalone && npm run verify:standalone` — standalone 编译通过、无 import
5. 双击 `standalone.html` — 两个视图都能切换显示

## Known limitations / risks

- **数据补全精度**：320 首里 ~114 首是兜底（诗人生命周期均分），位置不完全准确；用户后续若觉得某首明显错位，可手动改 `creationYear`
- **节点密度**：320 节点 → 杜甫 39、李白 34、王维 28 的列会很密集；现有 scatter 算法能错开但视觉仍拥挤。如需缓解，可在 PoemsRiverPage 里把 `nodeSizes` 普遍调小一档（不在本期范围）
- **年号映射表覆盖**：唐代 ~80 个年号，本期先覆盖最常见的 ~50 个；冷门年号若漏匹配，那首诗会走兜底
- **解析误判**：背景里若提到多个年份（如"该诗背景是 X，但前一年 Y 发生了 Z"），抓"离'作于'最近"的启发式可能误判。可后续逐首抽样校对
