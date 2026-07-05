# 飞花令 · AI 对战与视觉打磨 设计文档

> **状态**：待用户审阅
> **日期**：2026-07-05
> **基于**：[`2026-07-04-feihualing-design.md`](./2026-07-04-feihualing-design.md)（已实现的单人闯关作为基石）
> **范围**：在飞花令模块中加 AI 对战模式 + 2 项视觉修复

---

## 1. 范围

**本 spec 包含**
1. AI 对战模式（完整实现）：大厅「对战」tab + AI 对战局 + 战绩持久化
2. 必需视觉打磨（2 项）：
   - PaperScroll 入场 / 出场卷轴展开动画
   - KeywordSeal current 状态旋转/脉冲冲突修复

**本 spec 不包含**（作为未来 polish）
- 金粉飘落动画（答对反馈）
- 朱印盖落动画（通关）
- 移动端响应式适配
- 题库外干扰句机制
- 答题语音输入

**复用现有资产**
- 已实现的单人闯关模块（spec §2-3）
- 50 字关键字清单（3 处调整：梅→落、茶→飞、菊→寒）
- 共用 `getVersesFor` `pickStageQuestion` `buildKeywordIndex` 引擎
- 双源同步（src ↔ build-standalone.cjs）

---

## 2. 信息架构

### 2.1 新增路由
```
/play/ai/:kw            ← AI 对战局
```

### 2.2 大厅 Tab 加「对战」

**「闯关」tab**（已实现）：50 关印章地图 — 不变

**「对战」tab**（新增）：

```
┌──────────────────────────────────┐
│        关键字选择                │
│  ────────────────────            │
│  自由字 (任何时候可玩):           │
│  [春] [月] [花] [风] [雪]         │
│                                  │
│  已通关键字 (通关解锁):           │
│  [你1][你2][你3]...              │
│                                  │
│        AI 难度选择                │
│  ┌──────┬──────┬──────┐         │
│  │ 青灯 │ 墨客 │ 诗圣 │         │
│  │ 书生 │ 文士 │ 李白 │         │
│  │30%/3s│10%/1.5│ 0/0.8│         │
│  └──────┴──────┴──────┘         │
│                                  │
│           [开 战]                 │
└──────────────────────────────────┘
```

- 自由字：金色描边，5 字常量（春/月/花/风/雪）任何时候可玩
- 已通关键字：朱红印章形式，从 `shiwen-feihua-progress.cleared` 读
- 默认选中第一个可用项 + 青灯
- 「开战」按钮：未选则禁用，选中后启用 → 路由 `/play/ai/:kw?difficulty=xxx`

### 2.3 PlayHall 由 tab 改为双 tab

当前 PlayHall 实现只有一个 tab（闯关地图）。改为：

```tsx
type Tab = 'stage' | 'combat';
const [tab, setTab] = useState<Tab>('stage');
```

- 顶部加 tab 切换条：「闯关 · 飞花」（左）「对战 · AI」（右）
- 保持星空主题 + `colors.textPrimary` 文字色
- 当前 tab 下方 1-2px 金线
- **tab 状态**：通过 URL query `?tab=combat` 持久化（结算页「换关键字」/`返回大厅` 跳 `/play?tab=combat`）；默认 `?tab=stage`，保留直接访问 `/play` 的旧行为

---

## 3. AI 对战循环

### 3.1 入场布局

双栏对坐，卷轴纸张主题（沿用 PaperScroll）：

```
┌──────────────── 卷轴纸面 ────────────────┐
│                                          │
│       关键字大字 居中「春」               │
│       当前回合：你 / AI                  │
│  ┌─────────────────┬─────────────────┐   │
│  │  你的诗囊        │  AI 对手          │
│  │  ────────       │  ────────         │
│  │  □ 春眠不觉…     │   · · ·          │
│  │  □ 红豆生春…     │  □ 春风又绿…       │
│  │                 │   墨客（10%/1.5s）│   │
│  └─────────────────┴─────────────────┘   │
│                                          │
│    4 选 1 题板 + 30 秒倒计时              │
│  ┌─────────┬─────────┐                   │
│  │ A 春江… │ B 春风… │                   │
│  ├─────────┼─────────┤                   │
│  │ C 春城… │ D 春眠… │                   │
│  └─────────┴─────────┘                   │
│                                          │
└──────────────────────────────────────────┘
```

### 3.2 回合循环

**首回合**：`Math.random() < 0.5` 决定玩家先 / AI 先。

**玩家回合**
- 题板显示该关键字题库里**未用过的句**池中随机 4 个（不足 4 显示实际数；只有 1 个也允许）
- 30 秒倒计时
- 任选一句 → 答对，句子入「你的诗囊」，进入 AI 回合
- 超时 → 玩家判负

**AI 回合**
- 进入 AI 回合时剪影下出现三点跳动（CSS keyframe 依序淡入淡出）
- 思考延迟 = 该难度设定
- 思考结束：按难度概率决定答出 / 漏答
  - 答出：从该关键字题库里排除「已用集」(玩家+AI)，随机抽 1 句入「AI 诗囊」，进入玩家回合
  - 漏答：AI 判负（玩家胜）
- 三点跳动期间玩家无法操作（锁定）

**判负汇总**
| 触发 | 结果 |
|------|------|
| 玩家超时 30s | 玩家负 |
| 题库未用句空 (玩家入局前) | 玩家自动负 |
| 题库未用句空 (AI 回合计时) | AI 负 |
| AI 按难度漏答 | AI 负 |

### 3.3 题板"只有 1 个"处理

- 显示 1/2/3 个选项，其他位置空
- 玩家仅能从这 N 个里选，超时进入玩家负
- 这是退路：未用池快见底时的"最后机会"，答对后进入 AI 回合，AI 可能答出 / 漏答 / 题库空（AI 负）

### 3.4 结算页

- 胜负大标题：你 / AI 胜
- 用时显示「MM:SS」
- 双栏已答诗句列表（「你的诗囊」/「AI 诗囊」），每行可点击跳转 PoemPage
- 「未答出的诗句」列表：题库里剩余未用句（题库 - 已用集），同样可点击跳转
- 「再来一局」按钮（同关键字同难度直接开局，跳 `/play/ai/:kw?difficulty=xxx`）
- 「换关键字」按钮（跳 `/play?tab=combat`）
- 「返回大厅」按钮（跳 `/play?tab=combat`，与「换关键字」行为相同 — 玩家已结算，回大厅默认就在对战 tab）

---

## 4. 共享组件

### 4.1 新增组件

**`<AiSilhouette difficulty>`** — 渲染 3 个 SVG 水墨剪影之一
- 青灯（书生提灯背影）：人形剪影 + 手提灯笼
- 墨客（文士持卷侧影）：坐姿剪影 + 手展书卷
- 诗圣（李白举杯轮廓）：站立剪影 + 头微仰
- 纯 SVG path 实现，`<g fill="..." opacity="0.9">`，单色（黑色或深灰）
- 宽 80px × 高 120px

**`<ChoiceBoard verses onSelect>`** — 4 选 1 输入板
- 显示 verses（每句含 `line` + 出处）
- 30 秒倒计时显示在右上角
- 每个选项 A/B/C/D 按钮，hover 高亮，点击调用 `onSelect(index)`
- verses 数量为 1/2/3/4 都支持（少于 4 显示实际数）

**`<CombatResultModal result onClose>`** — 结算页
- 入场动画：fade + slight scale-up 0.4s
- 内部含胜负大标题 + 用时 + 已答列表 + 未答列表 + 按钮组
- 列出每句诗：行号+句+出处（`点击跳转 PoemPage`）

### 4.2 新增 hooks / 工具

**`buildChoiceBoard(used: Set<string>, keyword: string, count = 4): Verse[]`**
- 从 `getVersesFor(keyword)` 排除已用
- 随机抽 `min(count, available)` 个
- 若 available < 1：返回空（玩家入局时即负）

**`aiPickAnswer(pool: Verse[], used: Set<string>, difficulty): { picked: boolean; verse?: Verse }`**
- 诗圣：除非题库空，必答
- 墨客：90% 概率答，10% 漏
- 青灯：70% 概率答，30% 漏
- 答出：从 pool 排除 used，随机抽 1

**`rollFirstTurn(): 'player' | 'ai'`**
- 50/50 随机

---

## 5. 数据持久化

### 5.1 战绩记录（独立 localStorage 键）
```typescript
// localStorage.shiwen-feihua-record
interface CombatRecord {
  qingdeng: { win: number; lose: number };
  mohe:    { win: number; lose: number };
  shisheng:{ win: number; lose: number };
}

const INITIAL_RECORD: CombatRecord = {
  qingdeng: { win: 0, lose: 0 },
  mohe:    { win: 0, lose: 0 },
  shisheng:{ win: 0, lose: 0 },
};
```

### 5.2 函数

```typescript
// src/play/record.ts
function loadRecord(): CombatRecord;
function saveRecord(r: CombatRecord): void;
function recordWin(difficulty: Difficulty): CombatRecord;
function recordLoss(difficulty: Difficulty): CombatRecord;
```

降级策略同 progress.ts（localStorage 失败 → 内存）。

---

## 6. 视觉打磨（2 项）

### 6.1 PaperScroll 卷轴展开动画

**当前**：PaperScroll 直接渲染整张卷轴，无入场动画

**目标**：
- 入场（首次渲染）：`scaleY(0.92)` + `translateY(12px)` + `opacity 0` → `scaleY(1)` + `translateY(0)` + `opacity 1`，0.6s ease-out
- 出场（结算页弹出时）：fade out 0.3s ease-in
- 同时星星 / 闪烁可以同步淡入增加层次感（可选）

**实现**：CSS keyframes + animation 属性，按需通过 prop 控制
```typescript
interface PaperScrollProps {
  children: ReactNode;
  enter?: boolean;  // default true
}
```

CSS:
```css
@keyframes scroll-enter {
  from { transform: scaleY(0.92) translateY(12px); opacity: 0; }
  to   { transform: scaleY(1) translateY(0); opacity: 1; }
}
```

### 6.2 KeywordSeal 旋转/脉冲冲突修复

**当前问题**：
- current 状态同时设 `transform: rotate(-3deg)` 和 `animation: focal-pulse`
- `focal-pulse` 动画作用于 `transform: scale()`，覆盖了 rotate
- 旋转效果在动画播放时不可见

**目标**：
- 外层 div 承载 `rotate`
- 内层 button 承载 `pulse` 动画
- 旋转常驻，脉冲作用于内层缩放，**两者都可见**

```tsx
<div style={{ transform: state === 'current' ? 'rotate(-3deg)' : 'rotate(0)' }}>
  <button style={{ animation: state === 'current' ? 'focal-pulse 2s ease-in-out infinite' : 'none' }}>
    {state === 'locked' ? '？' : keyword}
  </button>
</div>
```

---

## 7. 错误处理与边界

| 场景 | 处理 |
|------|------|
| 玩家选已通关字玩 AI 对战 | 自由字仍可玩；已通字从 `cleared` 列表取 |
| 已通关字 0 个 + 想玩 | 默认从 5 字礼包选，不报错 |
| 题库空（关键词语句数 = 0） | 当前不存在（≥5 验证过），未来扫描变化时入局即双方负 |
| 题库未用 < 4 | 显示实际数（1/2/3 都行），玩家必须选 |
| 玩家答过后立即题库空 | 转到 AI 回合，AI 题库也空 → AI 负 |
| 双源同步 | P6 阶段同步所有 src/ 到 build-standalone.cjs |

---

## 8. 测试策略

### 8.1 单元测试（Vitest）
- `buildChoiceBoard`：从 8 句题库抽 4 个未用过的；全用过返回 []；不满 4 显示实际数
- `aiPickAnswer` 三档漏答率（mock Math.random 跑 1000 次）
- `rollFirstTurn`：50/50 分布（mock Math.random 跑 1000 次）
- `loadRecord / saveRecord / recordWin / recordLoss`：localStorage round-trip + 失败降级

### 8.2 集成测试（手动）
- 大厅双 tab 切换
- 选关键字 + 难度 → 开战
- AI 对战完整循环：玩家答 → AI 答 → 一方负 → 结算
- 三档难度的体感（青灯明显漏、诗圣必答）
- 战绩正确更新（刷新页面后还在）
- 卷轴入场动画顺滑
- KeywordSeal current 状态旋转可见

### 8.3 双源同步后端到端验证
- `node scripts/build-standalone.cjs` 构建成功
- 打开 standalone.html → 飞花令 → 对战 tab → 开战 → 完整循环

---

## 9. 文件结构

**新增 src 文件**
```
src/
├─ play/
│   ├─ ai.ts                ← aiPickAnswer / buildChoiceBoard / rollFirstTurn 纯函数
│   ├─ record.ts            ← localStorage 战绩读写 + win/loss incrementers
│   └─ types.ts (扩展)       ← CombatRecord 类型 + INITIAL_RECORD
├─ components/
│   ├─ AiSilhouette.tsx     ← 3 个 SVG 剪影
│   ├─ ChoiceBoard.tsx      ← 4 选 1 输入板
│   └─ CombatResultModal.tsx ← 结算页（胜负大标题 + 双栏 + 未答列表 + 按钮组）
└─ pages/
    └─ AiPlay.tsx           ← AI 对战局
```

**修改 src 文件**
```
src/pages/PlayHall.tsx          ← 加 tab 切换 + 对战 tab 内容
src/components/KeywordSeal.tsx   ← 旋转/脉冲分层
src/components/PaperScroll.tsx   ← 入场动画 + enter prop
```

**新增测试**
```
src/play/ai.test.ts
src/play/record.test.ts
```

**双源同步**
```
scripts/build-standalone.cjs    ← 翻译所有新增 + 修改 src/
```

---

## 10. 实施分阶段

1. **P1 引擎**：`types.ts` 扩展 + `ai.ts` 3 函数 + 单元测试
2. **P2 战绩持久化**：`record.ts` + 单元测试
3. **P3 大厅 tab**：PlayHall 双 tab + 关键字 + AI 难度选择
4. **P4 AiPlay 局**：双栏布局 + ChoiceBoard + AiSilhouette + 回合循环 + 结算页
5. **P5 视觉打磨**：PaperScroll 动画 + KeywordSeal 旋转修复
6. **P6 双源同步**：build-standalone.cjs 同步所有修改

每个 P 一个 commit。

---

## 11. 与现有规格的关系

| 现有 spec 章节 | 本 spec 对应 |
|--------------|-------------|
| §2.1 路由 | 扩展加 `/play/ai/:kw` |
| §2.3 大厅布局 | 新增「对战」tab 内容 |
| §4 AI 对战循环 | 全部沿用 + 加"AI 思考视觉 / 题板隐藏已用句"两处决策 |
| §5 共享引擎 | 新增 ai.ts（aiPickAnswer / buildChoiceBoard / rollFirstTurn） |
| §5.4 共用 UI 组件 | 新增 AiSilhouette / ChoiceBoard / CombatResultModal |
| §6 视觉风格 | 加 2 项小打磨（PaperScroll 动画、KeywordSeal 修复） |
| §8 数据持久化 | 新增 key `shiwen-feihua-record` |

---

## 12. 开放问题（写实施计划时细化）

- AiSilhouette 的 SVG path 具体设计（需画三张水墨剪影）
- "已答诗句列表"在结算页的滚动行为（诗句多了需滚动容器）
- 入场动画的 `prefers-reduced-motion` 兜底（如果浏览器开启减少动画偏好，跳过动画）
