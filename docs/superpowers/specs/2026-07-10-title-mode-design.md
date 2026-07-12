# 飞花令「整篇识名」模式设计

**日期**：2026-07-10
**范围**：飞花令第三种游戏模式「整篇 · 识名」
**目标**：在现有飞花令（单字 + 整句）之外，新增第三种模式 —— 看诗正文选诗名。多关卡递进解锁，与「整句 · 联句」结构和体感一致。
**不在范围**：作者识名模式、线索递进模式等其他变体（明确不做）。

---

## 背景

飞花令已有两种模式：
- **单字 · 拾字**：关键字九宫格选字填空
- **整句 · 联句**：看上句选下句

第三种「看诗选名」是飞花令的另一种基本玩法 —— 题目展示诗的全文（去掉题目与作者），给 4 个诗名选项，识别作者在哪些诗里写过哪些内容。该模式既可作为飞花令玩法的补充，也适合用作"以诗测名"的小游戏。

---

## 玩法规则

- 题目展示诗的正文（已去异文括号 `()`、`()`，与 PoemPage 渲染一致）
- 作者名在答题过程中**不展示**（避免"看见李白就锁定"）
- 给出 4 个诗名选项：1 正确 + 3 干扰
- 干扰项策略：**优先同作者的其他诗名**，不足 3 个时**从当前诗库候选池随机补足**
- 答对累计 STAGE_GOAL（5 句）即通关；血量 3、30s 倒计时、查看原文功能**移除**（题目本身就是原文）

---

## 关卡结构

| 诗库 | 总关数 | entry | mid | advanced |
|---|---|---|---|---|
| tang / all | 50 | 1-10 | 11-30 | 31-50 |
| primary | 30 | 1-10 | 11-30 | — |

三档切分沿用 `LEVEL_GROUPS`（`PlayHall.tsx:25-29`）和 sentenceProgress 的层级约定。primary 库不显示 advanced 档（与 sentence mode 保持一致）。

---

## 架构

### 1. 出题引擎 `src/play/titles.ts`（新文件）

```ts
export interface TitleQuestion {
  poemId: string;
  content: string;          // 已去异文括号的诗正文
  poemTitle: string;        // 正确答案
  options: Array<{ poemId: string; title: string }>;  // 4 项（含正确答案）
}

export function pickTitleQuestion(
  level: number,
  usedPoemIds: ReadonlySet<string>,
  corpus: 'tang' | 'primary' | 'all',
): TitleQuestion | null;
```

**算法**：

1. 取 `getPoemsCorpus(corpus === 'all' ? 'both' : corpus)` 作为候选池（与 sentence mode 边界一致）
2. 候选池必须**非空**
3. 从候选池 `randomPick` 一首 `poem`，满足 `!usedPoemIds.has(poem.id)` 且该 `poem.poetId` 对应的作者在候选池中至少还有 1 个其他诗（保证同作者干扰项能凑出）
4. 若 100 次尝试仍找不到，**降低要求**为只 `!usedPoemIds.has(poem.id)`（同作者约束失效但仍能出题）
5. 正确答案 = `poem.title`
6. 取作者的其他诗：`getPoemsByPoet(poetId).filter(p => p.id !== poem.id)`，`map(p => p.title)`，随机洗牌取前 3；不足 3 则从候选池随机补足（去重）
7. 4 个选项整体 Fisher-Yates 洗牌

**返回 null 条件**：候选池为空、或候选池中所有 poem 都在 `usedPoemIds` 里。

### 2. 进度模块 `src/play/titleProgress.ts`（新文件）

完全镜像 `src/play/sentenceProgress.ts` 的接口与存储约定：

```ts
export interface TitleStageProgress {
  unlockedIndex: number;
  cleared: string[];   // 已通关关号（字符串数字）
  current: { keyword: string; correct: string[]; blood: number } | null;
}

export function loadTitleProgress(corpus): TitleStageProgress;
export function saveTitleProgress(p, corpus): void;
export function markTitleCleared(keyword, corpus): TitleStageProgress;
export function beginTitleStage(keyword, corpus): TitleStageProgress;
export function commitTitleCorrect(keyword, line, corpus): TitleStageProgress;
export function commitTitleBlood(keyword, blood, corpus): TitleStageProgress;
export function clearTitleCurrent(corpus): TitleStageProgress;
```

**存储 key**：
- tang 沿用 `shiwen-feihua-title-progress`
- 其它 corpus 加 `:${corpus}` 后缀 → `shiwen-feihua-title-progress:primary`

**`markTitleCleared` 索引逻辑**（沿用 sentence 模式，不引入新逻辑）：
- `unlockedIndex = max(已解锁序号, levelNumber)`（关号直接当序号，无需关键字表映射）

### 3. 路由与页面 `src/pages/TitlePlay.tsx`（新文件）

新路由 `/play/title/:level`，与 `SentencePlay` 同结构、同体感。

**复用模式**（与 `SentencePlay.tsx` 对照）：
- 顶部 4 列布局：❤血量 / ⏱倒计时 / N/5 进度 / 退出按钮
- 中部「纸张」面板（复用 `PaperScroll`）
- 第 N 关标题
- 出处：答案揭晓后展示 `《${poemTitle}》· ${poetName}`
- ESC → `/play`；←/→ 切关（同 `SentencePlay`）
- 关卡切换的 `useEffect([levelKey])` 复位逻辑
- 通关/失败 overlay（"通 关" / "失 败"，stamp-drop 动画）

**差异**：
- **不渲染**「查看原文 · 扣 1 血」按钮（题目本身就是原文）
- 不展示作者（除非答案揭晓）
- 题目区替换为诗正文（按 `splitIntoLines` 渲染，居中大字号）
- 选项区：4 个标题按钮 2×2 网格（移动端 1 列），点击即判对错

### 4. 大厅集成 `src/pages/PlayHall.tsx`

- tab 区增加第三项「整篇 · 识名」，在「整句 · 联句」之后
- 新增 `Mode = 'char' | 'sentence' | 'title'`
- 文案：
  - `mode === 'title'`：`整 篇 · 识 名 模 式 · 已通 ${titleProgress.cleared.length} / ${totalTitleStages} 关`
  - 当前诗库下显示：`当前诗库：${corpus === 'tang' ? '唐诗三百首' : corpus === 'primary' ? '小学必背' : '总库'}`
- 新增 `titleProgress = loadTitleProgress(corpus)`
- 新增 `totalTitleStages = isPrimary ? 30 : 50`（沿用 sentence 档位）
- `SentenceModeBody` 已可复用其结构（按关号分档、印章布局），新增 `TitleModeBody` 作为平行组件：复用 `SentenceModeBody` 的渲染逻辑，**仅替换 `linkTo` 路径**（sentence → `/play/sentence/${lv}`，title → `/play/title/${lv}`），进度来源为 `titleProgress`。两个组件独立，避免抽象过早。

### 5. 路由挂载 `src/App.tsx`

新增 `<Route path="/play/title/:level" element={<TitlePlay />} />`，与 `/play/sentence/:level` 并列。

### 6. 双源 mirror 约束

每个新增 / 修改的 `src/*.ts(x)` 文件都必须以字符串字面量形式同步到 `scripts/build-standalone.cjs`（项目既有约束）。新增 / 修改内容：

| 文件 | 内容 |
|---|---|
| `pickTitleQuestion` | 内联于 `feihuaCoupletsCode` 段附近，新增 `feihuaTitlesCode` |
| `loadTitleProgress` 等 7 函数 | 内联新增 `feihuaTitleProgressCode` |
| `TitlePlay.tsx` 整页 | 内联新增 `titlePlayCode` |
| `PlayHall.tsx` tab 与 `TitleModeBody` | 内联 `playHallCode` 改造 |
| `App.tsx` route | 内联 `appCode` 改造 |

`build-standalone.cjs` 的 `appSource` 模板中按依赖顺序插入上述代码段。**新增 globals 顺序**：`feihuaTitlesCode` 在 `feihuaCoupletsCode` 之后（依赖 `getPoemsCorpus`）；`feihuaTitleProgressCode` 在 `feihuaSentenceProgressCode` 之后（沿用 `STAGE_BLOOD`、`STAGE_GOAL` 常量）；`titlePlayCode` 在 `sentencePlayCode` 之后（依赖同套 globals）。

---

## 关键文件变更清单

| # | 文件 | 操作 | 内容概要 |
|---|---|---|---|
| 1 | `src/play/titles.ts` | 新建 | `pickTitleQuestion` 出题引擎 |
| 2 | `src/play/titleProgress.ts` | 新建 | 进度持久化（镜像 sentenceProgress） |
| 3 | `src/pages/TitlePlay.tsx` | 新建 | 答题页面 |
| 4 | `src/pages/PlayHall.tsx` | 修改 | 加 tab、加 `LevelModeBody` 通用组件 |
| 5 | `src/App.tsx` | 修改 | 加 route |
| 6 | `scripts/build-standalone.cjs` | 修改 | mirror 上述所有 src 改动 |
| 7 | `src/play/titles.test.ts` | 新建 | 出题引擎单测 |
| 8 | `src/play/titleProgress.test.ts` | 新建 | 进度持久化单测 |

---

## 测试策略

### 新增单元测试

**`src/play/titles.test.ts`**（与 `couplets.test.ts` 同结构）：

- `_setRng` 注入伪随机数，保证测试稳定
- 候选池非空 → `pickTitleQuestion(1, new Set(), 'tang')` 返回非 null
- 4 选项含正确答案：`q.options.some(o => o.title === q.poemTitle)`
- 同作者优先：当作者有 ≥3 个其他诗时，`q.options.filter(o => o.title !== q.poemTitle)` 中至少 1 个的 `poemId` 与 `q.poemId` 同作者（即来自同作者）
- 用尽关卡后返回 null（穷尽候选池）
- 跨诗库：tang / primary / all 三个 corpus 都至少能出一道题

**`src/play/titleProgress.test.ts`**（与 `sentenceProgress.test.ts` 同结构）：

- `loadTitleProgress('tang')` 默认值：`{ unlockedIndex: 0, cleared: [], current: null }`
- `saveProgress` 后再 `load` 内容一致
- `markTitleCleared('5', 'tang')` 后 `unlockedIndex === 5`、`cleared` 含 `'5'`、`current === null`
- 不同 corpus 互不串扰：tang 进度不会污染 primary key

### 交互测试（RTL，可选）

不强制要求 RTL 渲染测试 — `SentencePlay` 现有测试覆盖相同模式，新增 `TitlePlay` 同理靠人工验收。

### 人工验收清单

- [ ] 大厅切到「唐诗」：tab 区显示「单字 · 拾字 / 整句 · 联句 / 整篇 · 识名」三 tab
- [ ] 「整篇 · 识名」tab 显示 50 关印章（3 档：10/20/20）
- [ ] 大厅切到「小学必背」：tab 显示 30 关（2 档：10/20，无高阶）
- [ ] 进 `/play/title/1`：显示诗正文 + 4 标题按钮
- [ ] 题目区**不显示作者**
- [ ] 答对：「通 关」stamp-drop 动画 + 出处展示
- [ ] 答错 / 超时：扣 1 血；血归零 → 「失 败」overlay
- [ ] 通关后返回大厅：下一关印章从「current」变「cleared」
- [ ] 切诗库 → 进度独立保留（tang 与 primary 不串扰）
- [ ] 退出按钮 / ESC / ←/→ 切关行为正常

---

## 任务拆分（4 任务，顺序执行）

| # | 任务 | 文件 | 测试 |
|---|---|---|---|
| T1 | 出题引擎 `pickTitleQuestion` + mirror | `src/play/titles.ts`, `scripts/build-standalone.cjs` | `src/play/titles.test.ts` |
| T2 | 进度模块 `titleProgress` + mirror | `src/play/titleProgress.ts`, `scripts/build-standalone.cjs` | `src/play/titleProgress.test.ts` |
| T3 | `TitlePlay.tsx` 答题页 + mirror | `src/pages/TitlePlay.tsx`, `scripts/build-standalone.cjs` | — |
| T4 | PlayHall tab 集成 + 路由挂载 + mirror | `src/pages/PlayHall.tsx`, `src/App.tsx`, `scripts/build-standalone.cjs` | 人工验收 |

**依赖**：T1 → T2 → T3 → T4（每步的引擎 / 模块被下游使用）。

---

## 风险与缓解

1. **候选池穷尽**：某些诗作者仅 1 首（如白居易在 primary 中段较少），同作者约束 100 次不中时降级为仅排除已用。极端情况下若整库都看过，仍返回 null — 现状与 sentence mode 一致。
2. **关卡过快穷尽**：tang 库 310 首诗 × 平均每作者 3 首 = ~100 关理论上限。设 50 关足够覆盖，验证用关也合理。
3. **mirror 一致性**：SDD reviewer 把"mirror 一致性"作为每任务验收项。
4. **CSS 动画 keyframe 复用**：`TitlePlay` 的 stamp-drop / fadeUp keyframes 与 `SentencePlay` 已存在，build-standalone.cjs 中应复用，不重复定义。
5. **「查看原文」按钮移除后，blood=1 死局场景消失**：以前是为了防止用自杀看答案，现在答案已在题面上，blood=1 只是普通时间压力。无需额外处理。

---

## 不在范围内（YAGNI 明确）

- 作者识名模式（看名选作者）— 与本模式对称但需求未提
- 线索递进模式（先给一句、答不出再多给一句）— 复杂度高，需求未提
- 难度分级（entry 限制出名诗、advanced 限制冷门诗）— 与 sentence mode 不一致，需求未提
- 题面字数限制（仅展示前两句）— 与 sentence mode 不一致，需求未提
- RTL 渲染测试 — SentencePlay 也未强制要求，沿用现状
- 排行榜 / 分享 / 成就系统 — 全局 feature，独立议题