# 飞花令 · AI 对战与视觉打磨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在飞花令模块加 AI 对战模式（含大厅对战 tab + 战斗局 + 战绩持久化），并修 2 项视觉细节（PaperScroll 卷轴展开动画 + KeywordSeal 旋转/脉冲分层冲突）。

**Architecture:** 纯前端扩展。新增 `src/play/ai.ts`（AI 选句 / 题板构建 / 先后手）+ `record.ts`（战绩持久化），新增 `<AiSilhouette>` `<ChoiceBoard>` `<CombatResultModal>` 三个 UI 组件，新增 `pages/AiPlay.tsx` 战斗局。PlayHall 改为双 tab（闯关 / 对战），tab 状态用 URL `?tab=combat` 持久化。视觉打磨改 PaperScroll / KeywordSeal。所有新增 + 修改最后同步到 `scripts/build-standalone.cjs`。

**Tech Stack:** React 18 + TypeScript + react-router-dom v6 + Vitest。视觉沿用墨夜星空 + 卷轴纸张主题（与 StagePlay / PoemPage 一致）。CSS keyframes：`focal-pulse` 已有；新增 `scroll-enter` / `dot-bounce` / `result-fade-scale` 三条。

## Global Constraints

- **语言**：所有 UI 文案、注释使用中文；字符标点用全角（，。「」）。
- **字体**：楷书字体栈 `fontFamilies.chinese`，不引入新字体。
- **配色**：仅用现有常量（`colors.*`、`PAPER_BG`、`fontFamilies`）；不引入新色值。
- **关键字清单**：沿用 `keywords.ts`（50 字，已替换梅→落、茶→飞、菊→寒）。
- **共用引擎**：复用 `getVersesFor`、`getKeywordIndex`、`KEYWORDS`、`KEYWORD_GROUPS`、`FREE_KEYWORDS`、`Difficulty`。
- **localStorage 键**：`shiwen-feihua-record`（新增，snake_case 与 `shiwen-feihua-progress` 风格一致）。
- **路由**：新增 `/play/ai/:kw`，PlayHall 加 `?tab=stage|combat` 查询参数。
- **测试**：纯函数 100% 覆盖，组件 Vitest 快照或手动。
- **双源同步**：每个 src Task 完成后**最后一个 Task 一次性**把所有 P1-P5 代码翻译进 `scripts/build-standalone.cjs`（避免逐任务同步被淹没）。
- **TDD**：每个纯函数任务先写失败测试 → 实现 → 通过 → commit。
- **提交粒度**：每个 Task 一个 commit，提交信息用 `feat(feihua): ...` 或 `polish(feihua):` 前缀。
- **TypeScript 严格**：所有新代码必须通过 `npx tsc --noEmit`。

---

## 文件结构

**新增 src 文件**
```
src/
├─ play/
│   ├─ ai.ts                     ← aiPickAnswer / buildChoiceBoard / rollFirstTurn
│   └─ record.ts                 ← localStorage 战绩读写 + win/loss incrementers
├─ components/
│   ├─ AiSilhouette.tsx          ← 3 个 SVG 水墨剪影（青灯 / 墨客 / 诗圣）
│   ├─ ChoiceBoard.tsx           ← 4 选 1 输入板（含 30s 倒计时）
│   └─ CombatResultModal.tsx     ← 结算页（胜负 + 双栏 + 未答列表）
└─ pages/
    └─ AiPlay.tsx                ← AI 对战局（双栏 + 回合循环 + 结算）
```

**修改 src 文件**
```
src/play/types.ts                ← 扩展加 CombatRecord / INITIAL_RECORD / DIFFICULTY_META
src/components/PaperScroll.tsx   ← 加 enter prop + 入场动画
src/components/KeywordSeal.tsx   ← 旋转 / 脉冲分层（外 div + 内 button）
src/pages/PlayHall.tsx           ← 加 tab 切换 + 对战 tab 内容 + URL ?tab 持久化
src/App.tsx                      ← Routes 加 /play/ai/:kw
src/styles.css                   ← 加 @keyframes scroll-enter / dot-bounce / result-fade-scale
```

**新增测试**
```
src/play/ai.test.ts
src/play/record.test.ts
```

**双源同步（最后任务）**
```
scripts/build-standalone.cjs    ← 翻译所有新增 + 修改 src/
```

---

## Task 1: 扩展 types.ts 加 CombatRecord 类型与难度元数据

**Files:**
- Modify: `src/play/types.ts:1-35`
- Test: (无；纯类型 + 常量)

**Interfaces:**
- Produces:
  - `CombatRecord` — `{ qingdeng: {win, lose}, mohe: {win, lose}, shisheng: {win, lose} }`
  - `INITIAL_RECORD: CombatRecord`
  - `DIFFICULTY_META: Record<Difficulty, { label: string; missRate: number; thinkMs: number }>` — `label` 用于大厅显示，`missRate` 用于 aiPickAnswer 默认参数验证，`thinkMs` 用于 AI 回合的 setTimeout 延迟（毫秒）
- 不变：`Verse` / `Difficulty` / `StageProgress` / `FeihuaProgress` / `STAGE_*` 常量

- [ ] **Step 1: 编辑 src/play/types.ts**

在文件末尾（`export const STAGE_TIMEBOX = 120;` 之后）追加：

```typescript
// ============ AI 对战（Plan 2）============
// 三档难度漏答概率 + 思考时间（毫秒），与 spec §3.2 / §2.2 一致。
export const DIFFICULTY_META: Record<Difficulty, { label: string; missRate: number; thinkMs: number }> = {
  qingdeng: { label: '青灯', missRate: 0.30, thinkMs: 3000 },
  mohe:     { label: '墨客', missRate: 0.10, thinkMs: 1500 },
  shisheng: { label: '诗圣', missRate: 0.00, thinkMs: 800  },
};

// AI 对战战绩（按难度分胜负数）。localStorage 键：shiwen-feihua-record。
export interface CombatRecord {
  qingdeng: { win: number; lose: number };
  mohe:     { win: number; lose: number };
  shisheng: { win: number; lose: number };
}

export const INITIAL_RECORD: CombatRecord = {
  qingdeng: { win: 0, lose: 0 },
  mohe:     { win: 0, lose: 0 },
  shisheng: { win: 0, lose: 0 },
};
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/play/types.ts
git commit -m "feat(feihua): add CombatRecord type and DIFFICULTY_META"
```

---

## Task 2: AI 对战引擎（ai.ts）

**Files:**
- Create: `src/play/ai.ts`
- Test: `src/play/ai.test.ts`

**Interfaces:**
- Consumes:
  - `getVersesFor(keyword)` from `../play/engine`
  - `DIFFICULTY_META` / `Difficulty` / `Verse` from `./types`
- Produces:
  - `buildChoiceBoard(used: Set<string>, keyword: string, count?: number): Verse[]`
    - 默认 `count = 4`
    - 从 `getVersesFor(keyword)` 排除 `used`，随机抽 `min(count, available)`
    - `available < 1` → 返回 `[]`
  - `aiPickAnswer(keyword: string, used: Set<string>, difficulty: Difficulty): { picked: boolean; verse?: Verse }`
    - 内部从 `getVersesFor(keyword)` 排除 `used` 构造 pool
    - 诗圣：`pool` 空则 `{ picked: false }`；否则 `{ picked: true, verse: 随机抽 1 }`
    - 墨客 / 青灯：`Math.random() < missRate` → `{ picked: false }`；否则同诗圣
  - `rollFirstTurn(): 'player' | 'ai'` — `Math.random() < 0.5`

- [ ] **Step 1: 写失败测试**

Create `src/play/ai.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildChoiceBoard, aiPickAnswer, rollFirstTurn } from './ai';
import { getVersesFor } from './engine';

describe('buildChoiceBoard', () => {
  it('returns 4 verses when pool has ≥ 4 unused', () => {
    const kw = '春';
    const used = new Set<string>();
    const board = buildChoiceBoard(used, kw, 4);
    expect(board).toHaveLength(4);
  });

  it('all returned verses are unused', () => {
    const kw = '春';
    const used = new Set<string>();
    const board = buildChoiceBoard(used, kw, 4);
    for (const v of board) expect(used.has(v.line)).toBe(false);
  });

  it('respects used set by excluding those lines', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    expect(pool.length).toBeGreaterThan(4);
    const used = new Set([pool[0].line, pool[1].line]);
    const board = buildChoiceBoard(used, kw, 4);
    for (const v of board) expect(used.has(v.line)).toBe(false);
    expect(board).toHaveLength(4);
  });

  it('returns fewer than 4 when pool is mostly used', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    const allExceptTwo = pool.slice(2).map((v) => v.line);
    const used = new Set(allExceptTwo);
    const board = buildChoiceBoard(used, kw, 4);
    expect(board.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when everything is used', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    const used = new Set(pool.map((v) => v.line));
    expect(buildChoiceBoard(used, kw, 4)).toEqual([]);
  });

  it('returns empty array for an empty/non-existent keyword', () => {
    expect(buildChoiceBoard(new Set(), '?', 4)).toEqual([]);
  });
});

describe('aiPickAnswer', () => {
  it('shisheng always picks when pool has verses', () => {
    const kw = '春';
    const used = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = aiPickAnswer(kw, used, 'shisheng');
      expect(r.picked).toBe(true);
      expect(r.verse).toBeDefined();
      expect(used.has(r.verse!.line)).toBe(false);
    }
  });

  it('shisheng picks false when pool is empty', () => {
    const pool = getVersesFor('春');
    const used = new Set(pool.map((v) => v.line));
    expect(aiPickAnswer('春', used, 'shisheng').picked).toBe(false);
  });

  it('qingdeng misses roughly 30% of the time (statistical)', () => {
    let misses = 0;
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (!aiPickAnswer('春', used, 'qingdeng').picked) misses++;
    }
    // ~30% miss rate; allow ±5% tolerance
    expect(misses / N).toBeGreaterThan(0.25);
    expect(misses / N).toBeLessThan(0.35);
  });

  it('mohe misses roughly 10% of the time', () => {
    let misses = 0;
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (!aiPickAnswer('春', used, 'mohe').picked) misses++;
    }
    expect(misses / N).toBeGreaterThan(0.05);
    expect(misses / N).toBeLessThan(0.15);
  });

  it('shisheng never misses (sample 1000)', () => {
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      expect(aiPickAnswer('春', used, 'shisheng').picked).toBe(true);
    }
  });
});

describe('rollFirstTurn', () => {
  it('returns player or ai only', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollFirstTurn();
      expect(r === 'player' || r === 'ai').toBe(true);
    }
  });

  it('splits roughly 50/50 over 1000 calls', () => {
    let players = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (rollFirstTurn() === 'player') players++;
    }
    expect(players / N).toBeGreaterThan(0.45);
    expect(players / N).toBeLessThan(0.55);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/play/ai.test.ts`
Expected: FAIL with "Cannot find module './ai'".

- [ ] **Step 3: 实现 ai.ts**

Create `src/play/ai.ts`:

```typescript
// AI 对战纯函数：构建题板 + AI 选句 + 抛硬币先后手。
// 与 pickStageQuestion 不同：本模块不做挖空，做"题板四选一"。

import { getVersesFor } from './engine';
import { DIFFICULTY_META, type Difficulty, type Verse } from './types';

// 从题库排除已用句，随机抽 min(count, available) 个返回。
// available < 1 返回 []（玩家入局即负 — 由 caller 决策胜负）。
export function buildChoiceBoard(
  used: Set<string>,
  keyword: string,
  count: number = 4,
): Verse[] {
  const pool = getVersesFor(keyword).filter((v) => !used.has(v.line));
  const n = Math.min(count, pool.length);
  if (n <= 0) return [];
  // Fisher-Yates 洗前 n 个
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// AI 按难度概率决定答出 / 漏答。答出时从题库排除 used 随机抽 1 句。
// 漏答时 caller 判 AI 负（玩家胜）。
export function aiPickAnswer(
  keyword: string,
  used: Set<string>,
  difficulty: Difficulty,
): { picked: boolean; verse?: Verse } {
  const pool = getVersesFor(keyword).filter((v) => !used.has(v.line));
  if (pool.length === 0) return { picked: false };

  const missRate = DIFFICULTY_META[difficulty].missRate;
  if (Math.random() < missRate) return { picked: false };

  const verse = pool[Math.floor(Math.random() * pool.length)];
  return { picked: true, verse };
}

// 50/50 决定玩家先 / AI 先。
export function rollFirstTurn(): 'player' | 'ai' {
  return Math.random() < 0.5 ? 'player' : 'ai';
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/play/ai.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/play/ai.ts src/play/ai.test.ts
git commit -m "feat(feihua): add AI combat engine (aiPickAnswer / buildChoiceBoard / rollFirstTurn)"
```

---

## Task 3: 战绩持久化（record.ts）

**Files:**
- Create: `src/play/record.ts`
- Test: `src/play/record.test.ts`

**Interfaces:**
- Consumes: `INITIAL_RECORD` / `CombatRecord` / `Difficulty` from `./types`
- Produces:
  - `loadRecord(): CombatRecord` — 读 localStorage(`shiwen-feihua-record`)，失败返回 `{ ...INITIAL_RECORD }`
  - `saveRecord(r: CombatRecord): void` — 写 localStorage，失败静默
  - `recordWin(difficulty: Difficulty): CombatRecord` — 该难度 win+1，save，返回新对象
  - `recordLoss(difficulty: Difficulty): CombatRecord` — 该难度 lose+1，save，返回新对象

- [ ] **Step 1: 写失败测试**

Create `src/play/record.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { loadRecord, saveRecord, recordWin, recordLoss } from './record';
import { INITIAL_RECORD } from './types';

describe('combat record persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadRecord returns INITIAL_RECORD when empty', () => {
    expect(loadRecord()).toEqual(INITIAL_RECORD);
  });

  it('saveRecord round-trips', () => {
    const r = {
      qingdeng: { win: 3, lose: 2 },
      mohe:     { win: 1, lose: 4 },
      shisheng: { win: 0, lose: 0 },
    };
    saveRecord(r);
    expect(loadRecord()).toEqual(r);
  });

  it('recordWin bumps only that difficulty win and persists', () => {
    const r1 = recordWin('mohe');
    expect(r1.mohe.win).toBe(1);
    expect(r1.qingdeng.win).toBe(0);
    expect(r1.shisheng.win).toBe(0);

    const r2 = recordWin('mohe');
    expect(r2.mohe.win).toBe(2);
    expect(loadRecord().mohe.win).toBe(2);
  });

  it('recordLoss bumps only that difficulty lose and persists', () => {
    const r = recordLoss('qingdeng');
    expect(r.qingdeng.lose).toBe(1);
    expect(loadRecord().qingdeng.lose).toBe(1);
  });

  it('survives localStorage being unavailable on read', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadRecord()).toEqual(INITIAL_RECORD);
    window.localStorage.getItem = orig;
  });

  it('survives localStorage being unavailable on write', () => {
    const orig = window.localStorage.setItem;
    window.localStorage.setItem = () => { throw new Error('quota'); };
    expect(() => recordWin('qingdeng')).not.toThrow();
    window.localStorage.setItem = orig;
  });

  it('parses malformed JSON gracefully', () => {
    window.localStorage.setItem('shiwen-feihua-record', 'not-json');
    expect(loadRecord()).toEqual(INITIAL_RECORD);
  });

  it('parses partial object with missing difficulty keys', () => {
    window.localStorage.setItem(
      'shiwen-feihua-record',
      JSON.stringify({ qingdeng: { win: 5, lose: 3 } }),
    );
    const r = loadRecord();
    expect(r.qingdeng.win).toBe(5);
    expect(r.mohe).toEqual({ win: 0, lose: 0 });
    expect(r.shisheng).toEqual({ win: 0, lose: 0 });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/play/record.test.ts`
Expected: FAIL with "Cannot find module './record'".

- [ ] **Step 3: 实现 record.ts**

Create `src/play/record.ts`:

```typescript
// AI 对战战绩持久化（localStorage）。
// 与 progress.ts 风格一致：失败静默降级到 INITIAL_RECORD。

import { INITIAL_RECORD, type CombatRecord, type Difficulty } from './types';

const STORAGE_KEY = 'shiwen-feihua-record';

function emptyBucket(): { win: number; lose: number } {
  return { win: 0, lose: 0 };
}

function normalizeRecord(parsed: unknown): CombatRecord {
  const base: Record<string, { win: number; lose: number }> = {
    qingdeng: emptyBucket(),
    mohe: emptyBucket(),
    shisheng: emptyBucket(),
  };
  if (parsed && typeof parsed === 'object') {
    for (const key of ['qingdeng', 'mohe', 'shisheng'] as const) {
      const slot = (parsed as Record<string, unknown>)[key];
      if (slot && typeof slot === 'object') {
        const win =
          typeof (slot as Record<string, unknown>).win === 'number'
            ? (slot as Record<string, number>).win
            : 0;
        const lose =
          typeof (slot as Record<string, unknown>).lose === 'number'
            ? (slot as Record<string, number>).lose
            : 0;
        base[key] = { win, lose };
      }
    }
  }
  return base as CombatRecord;
}

export function loadRecord(): CombatRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_RECORD, ...{ qingdeng: emptyBucket(), mohe: emptyBucket(), shisheng: emptyBucket() } };
    const parsed = JSON.parse(raw);
    return normalizeRecord(parsed);
  } catch {
    return normalizeRecord(null);
  }
}

export function saveRecord(r: CombatRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // 静默失败
  }
}

function bump(difficulty: Difficulty, field: 'win' | 'lose'): CombatRecord {
  const r = loadRecord();
  const slot = r[difficulty];
  const next: CombatRecord = {
    ...r,
    [difficulty]: { win: slot.win, lose: slot.lose, [field]: slot[field] + 1 },
  };
  saveRecord(next);
  return next;
}

export function recordWin(difficulty: Difficulty): CombatRecord {
  return bump(difficulty, 'win');
}

export function recordLoss(difficulty: Difficulty): CombatRecord {
  return bump(difficulty, 'lose');
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/play/record.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 6: Commit**

```bash
git add src/play/record.ts src/play/record.test.ts
git commit -m "feat(feihua): add localStorage combat record persistence"
```

---

## Task 4: AiSilhouette + ChoiceBoard + CombatResultModal（三个无状态组件）

**Files:**
- Create: `src/components/AiSilhouette.tsx`
- Create: `src/components/ChoiceBoard.tsx`
- Create: `src/components/CombatResultModal.tsx`

**Interfaces:**
- Consumes:
  - `Difficulty` from `../play/types`
  - `Verse` from `../play/types`
  - `fontFamilies` from `../theme`
- Produces:
  - `<AiSilhouette difficulty={d} />` — 80×120 SVG，三档 path 不同
  - `<ChoiceBoard verses={[…]} secondsLeft={n} onSelect={fn} />` — 2×2 grid 4 个按钮；少于 4 时按实际数显示且对玩家无视觉欺骗
  - `<CombatResultModal result={r} onPlayAgain onPickKeyword> `（结算大标题 + 用时 + 双栏列表 + 按钮组）

- [ ] **Step 1: 实现 AiSilhouette**

Create `src/components/AiSilhouette.tsx`:

```typescript
// AI 三个难度对应的水墨剪影（80×120 SVG）。
// 三个 path 用极简几何勾出人形剪影，单色填充 + 半透明。
// 开放问题（spec §12）：具体曲线在 plan 阶段定稿后微调，这里先放可用版本。

import type { Difficulty } from '../play/types';

interface Props {
  difficulty: Difficulty;
}

const W = 80;
const H = 120;

export function AiSilhouette({ difficulty }: Props) {
  if (difficulty === 'qingdeng') {
    // 青灯：书生提灯背影（头 + 肩 + 提灯手臂）
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <g fill="#1a1a2e" opacity="0.85">
          {/* 头 */}
          <circle cx={W / 2} cy={18} r={10} />
          {/* 肩身 */}
          <path d={`M ${W / 2 - 18} ${H - 8} L ${W / 2 - 18} ${36} Q ${W / 2} ${28} ${W / 2 + 18} ${36} L ${W / 2 + 18} ${H - 8} Z`} />
          {/* 左手提灯（圆 + 杆） */}
          <line x1={W / 2 - 16} y1={50} x2={W / 2 - 26} y2={70} stroke="#1a1a2e" strokeWidth={2} opacity="0.85" />
          <circle cx={W / 2 - 28} cy={74} r={6} opacity="0.85" />
          <circle cx={W / 2 - 28} cy={74} r={3} fill="#d4af6a" />
        </g>
      </svg>
    );
  }
  if (difficulty === 'mohe') {
    // 墨客：文士持卷侧坐（头 + 侧身 + 手展书卷）
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <g fill="#1a1a2e" opacity="0.85">
          <circle cx={42} cy={20} r={10} />
          <path d={`M 26 ${H - 8} L 26 ${36} Q 42 ${28} 58 ${36} L 58 ${H - 8} Z`} />
          {/* 手展书卷（前方矩形） */}
          <rect x={48} y={56} width={26} height={16} rx={1} />
        </g>
      </svg>
    );
  }
  // 诗圣：李白举杯（头微仰 + 站立身 + 举杯手）
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <g fill="#1a1a2e" opacity="0.85">
        <circle cx={W / 2} cy={18} r={10} />
        <path d={`M ${W / 2 - 16} ${H - 8} L ${W / 2 - 16} ${36} Q ${W / 2} ${28} ${W / 2 + 16} ${36} L ${W / 2 + 16} ${H - 8} Z`} />
        {/* 举杯右臂 */}
        <line x1={W / 2 + 14} y1={42} x2={W / 2 + 22} y2={28} stroke="#1a1a2e" strokeWidth={2} opacity="0.85" />
        <circle cx={W / 2 + 23} cy={26} r={4} fill="#d4af6a" />
      </g>
    </svg>
  );
}
```

- [ ] **Step 2: 实现 ChoiceBoard**

Create `src/components/ChoiceBoard.tsx`:

```typescript
// 4 选 1 输入板（含右上角倒计时）。
// 支持 1/2/3/4 个选项（少于 4 时按实际数显示）。

import { fontFamilies } from '../theme';
import type { Verse } from '../play/types';

interface Props {
  verses: Verse[];              // 1-4 句
  secondsLeft: number;          // 显示在右上角
  onSelect: (verse: Verse) => void;
  disabled?: boolean;           // AI 回合时锁定
}

const LABELS = ['A', 'B', 'C', 'D'];

export function ChoiceBoard({ verses, secondsLeft, onSelect, disabled = false }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      {/* 右上角倒计时 */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          right: 0,
          color: secondsLeft <= 10 ? '#a8302a' : '#000',
          fontFamily: fontFamilies.chinese,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        ⏱ {secondsLeft}s
      </div>

      {/* 2x2 grid（不足 4 行后留空）*/}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 16,
        }}
      >
        {LABELS.map((label, i) => {
          const v = verses[i];
          if (!v) {
            return (
              <div
                key={label}
                style={{
                  padding: 16,
                  border: '1px dashed rgba(139,115,85,0.3)',
                  borderRadius: 4,
                  minHeight: 64,
                }}
              />
            );
          }
          return (
            <button
              key={label}
              onClick={() => onSelect(v)}
              disabled={disabled}
              style={{
                padding: 16,
                background: disabled ? 'rgba(0,0,0,0.04)' : 'transparent',
                border: '1px solid #8b7355',
                borderRadius: 4,
                color: '#000',
                fontFamily: fontFamilies.chinese,
                fontSize: 16,
                textAlign: 'left',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ marginRight: 8, fontWeight: 700 }}>{label}.</span>
              {v.line}
              <div style={{ fontSize: 12, color: '#8b7355', marginTop: 4 }}>
                《{v.poemTitle}》· {v.poetName}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 实现 CombatResultModal**

Create `src/components/CombatResultModal.tsx`:

```typescript
// AI 对战结算页：胜负大标题 + 用时 + 已答双栏 + 未答列表 + 按钮组。
// 入场动画：fade + scale-up（CSS keyframe result-fade-scale，由 styles.css 提供）。

import { Link } from 'react-router-dom';
import { fontFamilies } from '../theme';
import type { Verse } from '../play/types';

export interface CombatResult {
  winner: 'player' | 'ai';
  elapsedSec: number;
  playerPicks: Verse[];
  aiPicks: Verse[];
  unused: Verse[];
  keyword: string;
  onPlayAgain: () => void;
  onPickKeyword: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function poemLink(v: Verse, label: string) {
  return (
    <Link
      key={`${v.poemId}-${v.line}`}
      to={`/poem/${v.poemId}`}
      style={{
        display: 'block',
        padding: '4px 0',
        color: '#000',
        textDecoration: 'none',
        fontFamily: fontFamilies.chinese,
        fontSize: 14,
      }}
    >
      <span style={{ color: '#8b7355', marginRight: 8 }}>{label}</span>
      {v.line}
      <span style={{ color: '#8b7355', fontSize: 12, marginLeft: 8 }}>
        《{v.poemTitle}》· {v.poetName}
      </span>
    </Link>
  );
}

const btnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: '#000',
  border: '1px solid #000',
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

export function CombatResultModal({ result }: { result: CombatResult }) {
  return (
    <div
      style={{
        animation: 'result-fade-scale 0.4s ease-out',
        padding: 24,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: fontFamilies.chinese,
          fontSize: 48,
          letterSpacing: 12,
          marginBottom: 8,
          color: '#000',
        }}
      >
        {result.winner === 'player' ? '你 胜' : 'AI 胜'}
      </div>
      <div
        style={{
          textAlign: 'center',
          color: '#8b7355',
          fontFamily: fontFamilies.chinese,
          fontSize: 14,
          marginBottom: 24,
        }}
      >
        用时 {formatTime(result.elapsedSec)} · 关键字「{result.keyword}」
      </div>

      {/* 双栏已答 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <div
            style={{
              fontFamily: fontFamilies.chinese,
              fontSize: 16,
              color: '#000',
              borderBottom: '1px solid #8b7355',
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            你的诗囊（{result.playerPicks.length}）
          </div>
          {result.playerPicks.length === 0
            ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（未答出）</div>
            : result.playerPicks.map((v, i) => poemLink(v, `${i + 1}.`))}
        </div>
        <div>
          <div
            style={{
              fontFamily: fontFamilies.chinese,
              fontSize: 16,
              color: '#000',
              borderBottom: '1px solid #8b7355',
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            AI 诗囊（{result.aiPicks.length}）
          </div>
          {result.aiPicks.length === 0
            ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（未答出）</div>
            : result.aiPicks.map((v, i) => poemLink(v, `${i + 1}.`))}
        </div>
      </div>

      {/* 未答列表 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: fontFamilies.chinese,
            fontSize: 16,
            color: '#000',
            borderBottom: '1px solid #8b7355',
            paddingBottom: 6,
            marginBottom: 8,
          }}
        >
          未答出的诗句（{result.unused.length}）
        </div>
        {result.unused.length === 0
          ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（题库已尽）</div>
          : result.unused.map((v, i) => poemLink(v, `${i + 1}.`))}
      </div>

      {/* 按钮组 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button onClick={result.onPlayAgain} style={btnStyle}>再来一局</button>
        <button onClick={result.onPickKeyword} style={btnStyle}>换关键字</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 5: 全测试**

Run: `npx vitest run`
Expected: PASS (engine/keywords/progress/ai/record 测试全过，smoke 不变)。

- [ ] **Step 6: Commit**

```bash
git add src/components/AiSilhouette.tsx src/components/ChoiceBoard.tsx src/components/CombatResultModal.tsx
git commit -m "feat(feihua): add AI silhouette, choice board, and combat result modal"
```

---

## Task 5: AiPlay 战斗局页面

**Files:**
- Create: `src/pages/AiPlay.tsx`

**Interfaces:**
- Consumes:
  - `useParams` / `useNavigate` / `useSearchParams` / `Link` (react-router-dom)
  - `getVersesFor` from `../play/engine`
  - `buildChoiceBoard` / `aiPickAnswer` / `rollFirstTurn` from `../play/ai`
  - `loadRecord` / `recordWin` / `recordLoss` from `../play/record`
  - `<TopNav variant="main">` / `<PaperScroll>` / `<AiSilhouette>` / `<ChoiceBoard>` / `<CombatResultModal>`
  - `colors` / `fontFamilies` / `Difficulty` / `Verse`
- Produces:
  - `<AiPlay />` — 完整 AI 对战局。读取 `:kw` + `?difficulty=`，跑回合循环，结算时落战绩

**主要状态**
- `round: 'player' | 'ai'` — 当前回合（rollFirstTurn 决定初始）
- `board: Verse[]` — 当前题板
- `secondsLeft: number` — 玩家回合倒计时
- `playerPicks: Verse[]`, `aiPicks: Verse[]` — 双栏
- `used: Set<string>` — 已用句（含玩家 + AI），由 buildChoiceBoard / aiPickAnswer 自动排除
- `result: CombatResult | null` — 出结果时填充

**回合流程**
1. 入局：rollFirstTurn → 设 round；playerPicks/aiPicks/used 全空；如果 round === 'player' → buildChoiceBoard；如果 === 'ai' → 进入 AI 回合
2. 玩家回合：30 秒倒计时（setInterval，0 触发玩家负）；点题板 → 加入 playerPicks + used → round = 'ai'
3. AI 回合：剪影下三点跳动 CSS；setTimeout(thinkMs) 后调 aiPickAnswer；若 picked → 加入 aiPicks + used → round = 'player'；否则结算（AI 漏答，player 胜）
4. 任一回合结束 → 检查题库未用：buildChoiceBoard(used, kw).length === 0 时当前回合方判负
5. 结算：CombatResult；调 recordWin / recordLoss；展示 CombatResultModal；按钮组绑回调（再来一局 → navigate 当前 URL replace；换关键字 → navigate `/play?tab=combat`）

- [ ] **Step 1: 实现 AiPlay.tsx**

Create `src/pages/AiPlay.tsx`:

```typescript
// 飞花令 · AI 对战局。
// 双栏对坐：左「你的诗囊」/ 右「AI 诗囊 + 剪影 + 难度」；底部 4 选 1 题板。
// 30 秒倒计时，玩家超时判负；AI 按难度概率漏答，漏了判 AI 负。

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { AiSilhouette } from '../components/AiSilhouette';
import { ChoiceBoard } from '../components/ChoiceBoard';
import { CombatResultModal, type CombatResult } from '../components/CombatResultModal';
import { colors, fontFamilies } from '../theme';
import { getVersesFor } from '../play/engine';
import { buildChoiceBoard, aiPickAnswer, rollFirstTurn } from '../play/ai';
import { recordWin, recordLoss } from '../play/record';
import { DIFFICULTY_META, type Difficulty, type Verse } from '../play/types';

const TURN_SECONDS = 30;

function isDifficulty(s: string | null): s is Difficulty {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

export function AiPlay() {
  const { kw } = useParams<{ kw: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const diffParam = searchParams.get('difficulty');
  const difficulty: Difficulty = isDifficulty(diffParam) ? diffParam : 'qingdeng';

  // 入局时确定首回合方（仅首次；ref 保存，避免 useEffect 重新触发）
  const initialTurnRef = useRef<'player' | 'ai' | null>(null);
  if (initialTurnRef.current === null) initialTurnRef.current = rollFirstTurn();

  const firstRound = initialTurnRef.current;

  const [round, setRound] = useState<'player' | 'ai'>(firstRound);
  const [playerPicks, setPlayerPicks] = useState<Verse[]>([]);
  const [aiPicks, setAiPicks] = useState<Verse[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [board, setBoard] = useState<Verse[]>(() => buildChoiceBoard(new Set(), kw ?? '', 4));
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [result, setResult] = useState<CombatResult | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // 玩家回合倒计时
  useEffect(() => {
    if (result || round !== 'player') return;
    if (secondsLeft <= 0) {
      finish('ai');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, round, result]);

  // AI 回合：thinkMs 后决策
  useEffect(() => {
    if (result || round !== 'ai' || !kw) return;
    const meta = DIFFICULTY_META[difficulty];
    const t = setTimeout(() => {
      const pick = aiPickAnswer(kw, used, difficulty);
      if (!pick.picked) {
        // AI 漏答，玩家胜
        finish('player');
        return;
      }
      setAiPicks((prev) => [...prev, pick.verse!]);
      const nextUsed = new Set(used);
      nextUsed.add(pick.verse!.line);
      setUsed(nextUsed);
      // 移交玩家回合
      const nextBoard = buildChoiceBoard(nextUsed, kw, 4);
      if (nextBoard.length === 0) {
        finish('player');
        return;
      }
      setBoard(nextBoard);
      setSecondsLeft(TURN_SECONDS);
      setRound('player');
    }, meta.thinkMs);
    return () => clearTimeout(t);
    // 注意：依赖故意不全 — used/result 变化不应重启定时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // 玩家首次入局 + 每次回合开始（切回 player）时重建题板
  useEffect(() => {
    if (round !== 'player' || result || !kw) return;
    if (board.length === 0) {
      const b = buildChoiceBoard(used, kw, 4);
      if (b.length === 0) {
        finish('ai');
        return;
      }
      setBoard(b);
      setSecondsLeft(TURN_SECONDS);
    }
  }, [round, result, kw]);

  function finish(winner: 'player' | 'ai') {
    if (result) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (winner === 'player') recordWin(difficulty);
    else recordLoss(difficulty);

    const allUnused = getVersesFor(kw ?? '').filter((v) => !used.has(v.line));
    setResult({
      winner,
      elapsedSec: elapsed,
      playerPicks,
      aiPicks,
      unused: allUnused,
      keyword: kw ?? '',
      onPlayAgain: () => navigate(`/play/ai/${kw}?difficulty=${difficulty}`, { replace: true }),
      onPickKeyword: () => navigate('/play?tab=combat'),
    });
  }

  const onSelect = (v: Verse) => {
    if (result || round !== 'player') return;
    setPlayerPicks((prev) => [...prev, v]);
    const nextUsed = new Set(used);
    nextUsed.add(v.line);
    setUsed(nextUsed);
    // AI 回合前置检查：题库空就判 AI 负
    const aiBoard = buildChoiceBoard(nextUsed, kw ?? '', 1);
    if (aiBoard.length === 0) {
      finish('player');
      return;
    }
    setRound('ai');
  };

  if (!kw) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  const meta = DIFFICULTY_META[difficulty];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/play?tab=combat')}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textTertiary,
              fontSize: 14,
              fontFamily: fontFamilies.chinese,
              cursor: 'pointer',
            }}
          >
            ← 返回大厅
          </button>
          <div style={{ color: colors.textTertiary, fontSize: 14, fontFamily: fontFamilies.chinese }}>
            {round === 'player' ? '你的回合' : 'AI 思考中…'}
          </div>
        </div>

        <PaperScroll>
          {/* 关键字 + 回合 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: '#000',
              fontSize: 80, fontWeight: 700, lineHeight: 1, marginBottom: 8,
            }}>
              {kw}
            </div>
          </div>

          {/* 双栏 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* 左：你的诗囊 */}
            <div>
              <div style={{
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
              }}>
                你的诗囊（{playerPicks.length}）
              </div>
              {playerPicks.length === 0
                ? <div style={{ color: '#8b7355', fontSize: 13 }}>（尚未出招）</div>
                : playerPicks.map((v, i) => (
                    <div key={`${v.poemId}-${i}`} style={{ color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese }}>
                      {i + 1}. {v.line}
                    </div>
                  ))}
            </div>

            {/* 右：AI */}
            <div>
              <div style={{
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <AiSilhouette difficulty={difficulty} />
                <div>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: 12, color: '#8b7355' }}>
                    {Math.round(meta.missRate * 100)}% 漏答 · {(meta.thinkMs / 1000).toFixed(1)}s
                  </div>
                  {round === 'ai' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#000',
                            display: 'inline-block',
                            animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: fontFamilies.chinese, color: '#000', fontSize: 14, paddingTop: 8 }}>
                AI 诗囊（{aiPicks.length}）
              </div>
              {aiPicks.length === 0
                ? <div style={{ color: '#8b7355', fontSize: 13 }}>（AI 尚未出招）</div>
                : aiPicks.map((v, i) => (
                    <div key={`${v.poemId}-${i}`} style={{ color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese }}>
                      {i + 1}. {v.line}
                    </div>
                  ))}
            </div>
          </div>

          {/* 题板 / 锁屏 / 结算 */}
          {result ? (
            <CombatResultModal result={result} />
          ) : round === 'player' ? (
            <ChoiceBoard
              verses={board}
              secondsLeft={secondsLeft}
              onSelect={onSelect}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#8b7355', fontFamily: fontFamilies.chinese, padding: 32, fontSize: 14 }}>
              （AI 回合锁定中）
            </div>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 全测试**

Run: `npx vitest run`
Expected: PASS。

- [ ] **Step 4: 手动验收**

Run: `npm run dev` → 浏览器访问 `/play/ai/春?difficulty=qingdeng`。依次确认：
- 双栏对坐布局，左侧「你的诗囊」/ 右侧 AI 剪影 + 难度元数据
- 30 秒倒计时显示在题板右上角
- 玩家选一句 → 该句入诗囊 → 切到 AI 回合 → 剪影下三点跳动 → thinkMs 后 AI 答出 / 漏答
- 结算页弹出入场动画，按钮组正确路由

- [ ] **Step 5: Commit**

```bash
git add src/pages/AiPlay.tsx
git commit -m "feat(feihua): add AI combat play page with round loop and result modal"
```

---

## Task 6: PlayHall 双 tab + URL 持久化

**Files:**
- Modify: `src/pages/PlayHall.tsx`（替换整个文件）

**Interfaces:**
- Consumes:
  - `useSearchParams` (react-router-dom) — 读 `?tab=stage|combat`
  - `loadProgress` from `../play/progress`
  - `loadRecord` from `../play/record`（用于显示战绩小计，可选）
  - `KEYWORDS` / `KEYWORD_GROUPS` / `FREE_KEYWORDS` from `../play/keywords`
  - `DIFFICULTY_META` / `Difficulty` from `../play/types`
  - `<TopNav>` / `<KeywordSeal>` / `colors` / `fontFamilies`
  - `useNavigate` — 跳 `/play/ai/:kw?difficulty=xxx`
- Produces:
  - `<PlayHall />` — 双 tab：
    - 「闯关 · 飞花」：与现状相同
    - 「对战 · AI」：关键字选择（自由 5 + 已通）+ 难度选择 + 开战按钮
  - 顶部 tab 切换条 + 1-2px 金线（当前 tab 下方）
  - 默认 tab：`?tab=combat` → 对战；否则 → 闯关

- [ ] **Step 1: 替换 PlayHall.tsx**

Replace the entire file:

```typescript
// 飞花令大厅：双 tab（闯关 / 对战）。tab 状态用 URL ?tab=combat 持久化。

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { KeywordSeal } from '../components/KeywordSeal';
import { KEYWORDS, KEYWORD_GROUPS, FREE_KEYWORDS } from '../play/keywords';
import { loadProgress } from '../play/progress';
import { loadRecord } from '../play/record';
import { DIFFICULTY_META, type Difficulty } from '../play/types';
import { colors, fontFamilies } from '../theme';

const GROUP_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

const DIFFICULTY_ORDER: Difficulty[] = ['qingdeng', 'mohe', 'shisheng'];

function isDifficulty(s: string): s is Difficulty {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

export function PlayHall() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: 'stage' | 'combat' = rawTab === 'combat' ? 'combat' : 'stage';

  const setTab = (next: 'stage' | 'combat') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'stage') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const navigate = useNavigate();
  const progress = loadProgress();
  const record = loadRecord();
  const totalCleared = progress.cleared.length;

  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '32px 28px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 32, letterSpacing: 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>
              飞 花 令
            </div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 16, letterSpacing: 4,
            }}>
              已通 {totalCleared} / 50 关
            </div>
          </div>

          {/* Tab 切换条 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: 32,
          }}>
            <TabButton label="闯关 · 飞花" active={tab === 'stage'} onClick={() => setTab('stage')} />
            <TabButton label="对战 · AI"   active={tab === 'combat'} onClick={() => setTab('combat')} />
          </div>

          {tab === 'stage' ? <StageTab /> : <CombatTab progress={progress} record={record} navigate={navigate} stateOf={stateOf} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '12px 8px',
        marginBottom: -1,                       // 抵掉父容器 border，让金线贴在底边
        fontFamily: fontFamilies.chinese,
        fontSize: 18,
        letterSpacing: 4,
        color: active ? colors.textPrimary : colors.textTertiary,
        borderBottom: active ? '2px solid #d4af6a' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ============ 闯关 Tab（已有逻辑）============
function StageTab() {
  const progress = loadProgress();
  const totalCleared = progress.cleared.length;
  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };
  return (
    <>
      {/* 闯关 Tab 顶部小标题（已通总数已在父级显示，此处仅起视觉分隔）*/}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          color: colors.textTertiary, fontFamily: fontFamilies.chinese,
          fontSize: 13, letterSpacing: 4,
        }}>
          已通 {totalCleared} / 50 关 · 按三档递进解锁
        </div>
      </div>
      {(['entry', 'mid', 'advanced'] as const).map((group) => (
        <div key={group} style={{ marginBottom: 36 }}>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
          }}>
            {GROUP_LABEL[group]}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(10, 64px)',
            gap: 12, justifyContent: 'center',
          }}>
            {KEYWORD_GROUPS[group].map((kw) => {
              const globalIdx = KEYWORDS.indexOf(kw);
              const state = stateOf(kw, globalIdx);
              return (
                <Link key={kw} to={state === 'locked' ? '#' : `/play/stage/${kw}`}
                  style={{ textDecoration: 'none' }}>
                  <KeywordSeal keyword={kw} state={state} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

// ============ 对战 Tab（新增）============
function CombatTab({
  progress,
  record,
  navigate,
  stateOf,
}: {
  progress: ReturnType<typeof loadProgress>;
  record: ReturnType<typeof loadRecord>;
  navigate: ReturnType<typeof useNavigate>;
  stateOf: (kw: string, idx: number) => 'cleared' | 'current' | 'locked';
}) {
  const allKeywords = useMemo(() => {
    const set = new Set<string>(FREE_KEYWORDS);
    for (const k of progress.cleared) set.add(k);
    return Array.from(set);
  }, [progress.cleared]);

  const defaultKw = allKeywords[0] ?? FREE_KEYWORDS[0];
  const [selectedKw, setSelectedKw] = useState<string>(defaultKw);
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('qingdeng');

  const canStart = isDifficulty(selectedDiff) && allKeywords.includes(selectedKw);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 关键字选择 */}
      <SectionTitle>关键字选择</SectionTitle>
      <SubLabel>自由字（任何时候可玩）</SubLabel>
      <KeywordRow keywords={[...FREE_KEYWORDS]} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />

      <SubLabel>已通关关键字（通关解锁）</SubLabel>
      {progress.cleared.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 13, padding: '12px 0' }}>
          尚无通关关键字
        </div>
      ) : (
        <KeywordRow keywords={progress.cleared} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />
      )}

      {/* 难度选择 */}
      <SectionTitle>AI 难度</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {DIFFICULTY_ORDER.map((d) => {
          const meta = DIFFICULTY_META[d];
          const active = selectedDiff === d;
          const stat = record[d];
          return (
            <button
              key={d}
              onClick={() => setSelectedDiff(d)}
              style={{
                padding: 16,
                background: active ? 'rgba(212,175,106,0.15)' : 'rgba(216,224,240,0.04)',
                border: `1px solid ${active ? '#d4af6a' : 'rgba(216,224,240,0.15)'}`,
                borderRadius: 4,
                color: active ? colors.textPrimary : colors.textSecondary,
                fontFamily: fontFamilies.chinese,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, letterSpacing: 4, marginBottom: 6 }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>
                漏答 {Math.round(meta.missRate * 100)}% · {(meta.thinkMs / 1000).toFixed(1)}s
              </div>
              <div style={{ fontSize: 11, color: colors.textDim, marginTop: 6 }}>
                战绩 {stat.win}胜 / {stat.lose}负
              </div>
            </button>
          );
        })}
      </div>

      {/* 开战按钮 */}
      <div style={{ textAlign: 'center' }}>
        <button
          disabled={!canStart}
          onClick={() => navigate(`/play/ai/${selectedKw}?difficulty=${selectedDiff}`)}
          style={{
            padding: '12px 48px',
            background: canStart ? 'transparent' : 'rgba(0,0,0,0.2)',
            color: canStart ? colors.textPrimary : colors.textDim,
            border: `1px solid ${canStart ? '#d4af6a' : 'rgba(216,224,240,0.1)'}`,
            borderRadius: 4,
            fontFamily: fontFamilies.chinese,
            fontSize: 18,
            letterSpacing: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          开 战
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', color: colors.textTertiary,
      fontFamily: fontFamilies.chinese, fontSize: 14,
      letterSpacing: 6, marginTop: 32, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: colors.textDim, fontFamily: fontFamilies.chinese,
      fontSize: 12, letterSpacing: 3, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function KeywordRow({
  keywords, selected, onSelect, clearedSet,
}: {
  keywords: string[];
  selected: string;
  onSelect: (kw: string) => void;
  clearedSet: Set<string> | string[];
}) {
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    }}>
      {keywords.map((kw) => {
        const active = selected === kw;
        const isCleared = cleared.has(kw);
        return (
          <button
            key={kw}
            onClick={() => onSelect(kw)}
            style={{
              width: 48, height: 48,
              background: active ? 'rgba(212,175,106,0.2)' : isCleared ? '#a8302a' : 'transparent',
              border: `1px solid ${active ? '#d4af6a' : isCleared ? '#7a1f15' : '#d4af6a'}`,
              borderRadius: 4,
              color: active ? colors.textPrimary : isCleared ? '#f5ebd2' : colors.textSecondary,
              fontFamily: fontFamilies.chinese,
              fontSize: 22, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {kw}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 全测试**

Run: `npx vitest run`
Expected: PASS。

- [ ] **Step 4: 手动验收**

Run: `npm run dev` → 飞花令 → 大厅。
- 顶部两 tab 切换正常，金线跟随当前 tab
- `?tab=combat` 直接定位到对战 tab（浏览器手输 URL 验证）
- 对战 tab：自由 5 字可玩；通关关键字读 `cleared` 列表
- 默认首字 + 青灯；点击开战 → 跳 `/play/ai/:kw?difficulty=xxx`
- 战绩小计读 record（如果 localStorage 清空应全部 0）

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlayHall.tsx
git commit -m "feat(feihua): add dual-tab PlayHall (stage + combat) with URL persistence"
```

---

## Task 7: App.tsx 加 /play/ai/:kw 路由

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 加 import 与路由**

Edit `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiverPage } from './pages/RiverPage';
import { PoemsRiverPage } from './pages/PoemsRiverPage';
import { PoetPage } from './pages/PoetPage';
import { PoemPage } from './pages/PoemPage';
import { PlayHall } from './pages/PlayHall';
import { StagePlay } from './pages/StagePlay';
import { AiPlay } from './pages/AiPlay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poems" element={<PoemsRiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
        <Route path="/play" element={<PlayHall />} />
        <Route path="/play/stage/:kw" element={<StagePlay />} />
        <Route path="/play/ai/:kw" element={<AiPlay />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: 全测试**

Run: `npx vitest run`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(feihua): add /play/ai/:kw route"
```

---

## Task 8: PaperScroll 入场动画

**Files:**
- Modify: `src/components/PaperScroll.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces:
  - `<PaperScroll enter={boolean}>` — enter=true（默认）首次渲染带卷轴展开动画；enter=false 直接静态渲染（结算页用 — 由 CSS 类的 result-fade-scale 替代）
  - `enter` 默认 `true`

- [ ] **Step 1: 加 keyframes 到 styles.css**

Append to `src/styles.css`（任意位置 — 同其他 @keyframes 一起）：

```css
@keyframes scroll-enter {
  from { transform: scaleY(0.92) translateY(12px); opacity: 0; }
  to   { transform: scaleY(1) translateY(0); opacity: 1; }
}

@keyframes dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40%           { transform: translateY(-6px); opacity: 1; }
}

@keyframes result-fade-scale {
  from { transform: scale(0.95); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
```

- [ ] **Step 2: PaperScroll 加 enter prop**

Replace `src/components/PaperScroll.tsx`:

```typescript
import type { ReactNode } from 'react';

const PAPER_BG = 'rgba(245, 235, 210, 0.85)';

interface Props {
  children: ReactNode;
  enter?: boolean;       // 默认 true：首次渲染卷轴展开动画
}

// 卷轴外框：左右木轴 + 双金线 + 暖米黄底。
// enter=true 时首次渲染带 scaleY + translateY + opacity 入场动画。
export function PaperScroll({ children, enter = true }: Props) {
  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
      animation: enter ? 'scroll-enter 0.6s ease-out' : undefined,
      transformOrigin: 'top center',
    }}>
      {/* 左木轴 */}
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
      }} />
      {/* 纸面（含双金线） */}
      <div style={{
        position: 'relative',
        flex: 1,
        background: PAPER_BG,
        padding: '32px 40px',
      }}>
        <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />
        {children}
      </div>
      {/* 右木轴 */}
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
```

- [ ] **Step 3: 类型检查 + 测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 全过。

- [ ] **Step 4: 手动验收**

Run: `npm run dev` → 闯关 / 对战任一页面刷新 → 看到卷轴从顶部 0.92 缩放 + 12px 下移 + 透明度 0 → 自然展开（0.6s）。

- [ ] **Step 5: Commit**

```bash
git add src/components/PaperScroll.tsx src/styles.css
git commit -m "polish(feihua): add PaperScroll unroll entrance animation"
```

---

## Task 9: KeywordSeal 旋转/脉冲分层

**Files:**
- Modify: `src/components/KeywordSeal.tsx`

**Interfaces:**
- 内部重构：把 `rotate` 与 `pulse` 拆到不同 DOM 节点，避开 transform 互相覆盖
- 不变 Props：`{ keyword, state, onClick? }`

- [ ] **Step 1: 重构 KeywordSeal**

Replace `src/components/KeywordSeal.tsx`:

```typescript
// 飞花令关卡印章。三态：cleared / current / locked。
// 修复：把 rotate 放到外层 div、pulse 放到内层 button，避免 transform 互相覆盖。
import { fontFamilies } from '../theme';

type SealState = 'cleared' | 'current' | 'locked';

interface Props {
  keyword: string;
  state: SealState;
  onClick?: () => void;
}

const SEAL_COLORS: Record<SealState, { bg: string; border: string; text: string; shadow: string }> = {
  cleared: { bg: '#a8302a', border: '#7a1f15', text: '#f5ebd2', shadow: '0 2px 8px rgba(168,48,42,0.4)' },
  current: { bg: '#a8302a', border: '#d4af6a', text: '#f5ebd2', shadow: '0 0 16px rgba(212,175,106,0.7)' },
  locked:  { bg: 'rgba(216,224,240,0.08)', border: 'rgba(216,224,240,0.2)', text: 'rgba(216,224,240,0.3)', shadow: 'none' },
};

export function KeywordSeal({ keyword, state, onClick }: Props) {
  const c = SEAL_COLORS[state];
  const interactive = state !== 'locked';
  return (
    // 外层：承载 rotate（常驻），不影响内层缩放
    <div style={{
      transform: state === 'current' ? 'rotate(-3deg)' : 'rotate(0)',
      transition: 'transform 0.15s',
    }}>
      {/* 内层：承载 pulse 动画，仅作用于 button 的 transform: scale */}
      <button
        onClick={interactive ? onClick : undefined}
        disabled={!interactive}
        style={{
          width: 64,
          height: 64,
          background: c.bg,
          border: `2px solid ${c.border}`,
          borderRadius: 4,
          color: c.text,
          fontFamily: fontFamilies.chinese,
          fontSize: 32,
          fontWeight: 700,
          cursor: interactive ? 'pointer' : 'default',
          boxShadow: c.shadow,
          animation: state === 'current' ? 'focal-pulse 2s ease-in-out infinite' : undefined,
        }}
      >
        {state === 'locked' ? '？' : keyword}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查 + 测试**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 全过。

- [ ] **Step 3: 手动验收**

Run: `npm run dev` → 飞花令 → 大厅 → 关春当前关印章既缓慢脉冲（金边缩放）又轻微 -3° 倾斜，两者叠加可见。

- [ ] **Step 4: Commit**

```bash
git add src/components/KeywordSeal.tsx
git commit -m "polish(feihua): split KeywordSeal rotate and pulse to avoid transform conflict"
```

---

## Task 10: 双源同步到 build-standalone.cjs

**Files:**
- Modify: `scripts/build-standalone.cjs`

**Translation rules**（沿用 Plan 1 Task 11 的规则，本次新增若干行）：

1. Drop TypeScript 类型注解、`as const`、`as`、`interface`、`type`
2. Drop 所有 `import` 行（使用 appSource 作用域已声明的全局）
3. `export function` → `function`；`export const` → `var`/`const`
4. `interface Props { foo: T }` → 函数体首行 `var foo = props.foo;`
5. 交换解构 `[a, b] = [b, a]` → 临时变量（避免模板字面量转义麻烦）
6. `??` → `||`；spread `[...a, b]` → `[].concat(a, [b])`
7. `as Record<string, ...>` 等强转 → 直接使用值
8. **新增**：CombatResultModal 的 `import { Link } from 'react-router-dom'` 删除 — `Link` 在 appSource 已全局
9. **新增**：CombatResultModal `import { fontFamilies } from '../theme'` 删除 — `fontFamilies` 在 appSource 已全局
10. **新增**：`new URLSearchParams()` / `useSearchParams()` 调用在 standalone 的 mini-router 全局中需检查是否已暴露 — 若 `useSearchParams` / `searchParams` 未提供，先在 `miniRouterCode` 里加这两条

**已发现依赖**（mini-router 必须暴露）：
- `Link` 已暴露
- `useNavigate` / `useParams` / `useLocation` 已暴露
- `useSearchParams` — 检查 miniRouterCode 当前是否实现：

  ```bash
  grep -n 'useSearchParams\|searchParams\|URLSearchParams' scripts/build-standalone.cjs | head -10
  ```

  若未暴露，按下面步骤补：

- [ ] **Step 1: 检查并补 useSearchParams 到 mini-router**

先运行：

```bash
cd "D:/claude/诗文长河" && grep -n "useSearchParams\|function useSearchParams\|var useSearchParams" scripts/build-standalone.cjs
```

若**无任何匹配**，在 `miniRouterCode` 块内（已有 `useNavigate` 函数附近）追加：

```javascript
// 给 mini-router 扩展 search params 访问，供 PlayHall tab 持久化
var useSearchParams = function() {
  var parseCurrent = function() {
    var hash = window.location.hash || '#/';
    var queryStr = '';
    var qIdx = hash.indexOf('?');
    if (qIdx >= 0) queryStr = hash.slice(qIdx + 1);
    var sp = new URLSearchParams(queryStr);
    var get = function(k) { return sp.get(k); };
    var has = function(k) { return sp.has(k); };
    var entries = function() { return sp.entries(); };
    var setParam = function(next) {
      var base = hash.split('?')[0];
      var qs = next.toString();
      var newHash = qs ? base + '?' + qs : base;
      window.location.hash = newHash;
    };
    return { get: get, has: has, entries: entries, toString: function() { return sp.toString(); }, setParam: setParam };
  };
  var sp = parseCurrent();
  var setSearchParams = function(next, options) {
    var replace = options && options.replace;
    var url = (next instanceof URLSearchParams) ? next : new URLSearchParams(next);
    var base = (window.location.hash || '#/').split('?')[0];
    var qs = url.toString();
    var newHash = qs ? base + '?' + qs : base;
    if (replace) window.location.replace(window.location.pathname + window.location.search + newHash);
    else window.location.hash = newHash;
  };
  return [sp, setSearchParams];
};
```

注：上面这段是模板字面量里的内容（已存在于 appSource），直接粘贴到 `miniRouterCode` 字符串内。

- [ ] **Step 2: 翻译 ai.ts → feihuaAiCode**

Append after `feihuaEngineCode` block (around line 2048):

```javascript
const feihuaAiCode = `
// ===== play/ai.ts =====
${aiPickAnswer / buildChoiceBoard / rollFirstTurn 函数体直接翻译，把 DIFFICULTY_META 与 Difficulty 类型剥掉（运行时 DIFFICULTY_META 与 difficulty 字符串都用字符串字面量）}
`;
```

具体 JS 翻译：

```javascript
var buildChoiceBoard = function(used, keyword, count) {
  if (count === undefined) count = 4;
  var pool = getVersesFor(keyword).filter(function(v) { return !used.has(v.line); });
  var n = Math.min(count, pool.length);
  if (n <= 0) return [];
  var arr = pool.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, n);
};

var aiPickAnswer = function(keyword, used, difficulty) {
  var pool = getVersesFor(keyword).filter(function(v) { return !used.has(v.line); });
  if (pool.length === 0) return { picked: false };
  var missRate = DIFFICULTY_META[difficulty].missRate;
  if (Math.random() < missRate) return { picked: false };
  var verse = pool[Math.floor(Math.random() * pool.length)];
  return { picked: true, verse: verse };
};

var rollFirstTurn = function() {
  return Math.random() < 0.5 ? 'player' : 'ai';
};
```

- [ ] **Step 3: 翻译 record.ts → feihuaRecordCode**

Append after `feihuaAiCode`:

```javascript
const feihuaRecordCode = `
// ===== play/record.ts =====
var STORAGE_KEY_RECORD = 'shiwen-feihua-record';

var emptyBucket = function() { return { win: 0, lose: 0 }; };

var normalizeRecord = function(parsed) {
  var base = { qingdeng: emptyBucket(), mohe: emptyBucket(), shisheng: emptyBucket() };
  if (parsed && typeof parsed === 'object') {
    ['qingdeng','mohe','shisheng'].forEach(function(key){
      var slot = parsed[key];
      if (slot && typeof slot === 'object') {
        var w = typeof slot.win === 'number' ? slot.win : 0;
        var l = typeof slot.lose === 'number' ? slot.lose : 0;
        base[key] = { win: w, lose: l };
      }
    });
  }
  return base;
};

var loadRecord = function() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY_RECORD);
    if (!raw) return normalizeRecord(null);
    var parsed = JSON.parse(raw);
    return normalizeRecord(parsed);
  } catch(e) {
    return normalizeRecord(null);
  }
};

var saveRecord = function(r) {
  try {
    window.localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(r));
  } catch(e) {}
};

var bumpRecord = function(difficulty, field) {
  var r = loadRecord();
  var slot = r[difficulty];
  var next = {
    qingdeng: { win: r.qingdeng.win, lose: r.qingdeng.lose },
    mohe:     { win: r.mohe.win,     lose: r.mohe.lose },
    shisheng: { win: r.shisheng.win, lose: r.shisheng.lose },
  };
  next[difficulty] = { win: slot.win, lose: slot.lose };
  next[difficulty][field] = slot[field] + 1;
  saveRecord(next);
  return next;
};

var recordWin = function(difficulty) { return bumpRecord(difficulty, 'win'); };
var recordLoss = function(difficulty) { return bumpRecord(difficulty, 'lose'); };
`;
```

- [ ] **Step 4: 翻译 AiSilhouette → aiSilhouetteCode**

Append after `feihuaRecordCode`:

```javascript
const aiSilhouetteCode = `
// ===== components/AiSilhouette.tsx =====
function AiSilhouette(props) {
  var difficulty = props.difficulty;
  var W = 80, H = 120;
  if (difficulty === 'qingdeng') {
    return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
      React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
        React.createElement('circle', { cx: W/2, cy: 18, r: 10 }),
        React.createElement('path', { d: 'M ' + (W/2 - 18) + ' ' + (H - 8) + ' L ' + (W/2 - 18) + ' 36 Q ' + W/2 + ' 28 ' + (W/2 + 18) + ' 36 L ' + (W/2 + 18) + ' ' + (H - 8) + ' Z' }),
        React.createElement('line', { x1: W/2 - 16, y1: 50, x2: W/2 - 26, y2: 70, stroke: '#1a1a2e', strokeWidth: 2, opacity: 0.85 }),
        React.createElement('circle', { cx: W/2 - 28, cy: 74, r: 6, opacity: 0.85 }),
        React.createElement('circle', { cx: W/2 - 28, cy: 74, r: 3, fill: '#d4af6a' })
      )
    );
  }
  if (difficulty === 'mohe') {
    return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
      React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
        React.createElement('circle', { cx: 42, cy: 20, r: 10 }),
        React.createElement('path', { d: 'M 26 ' + (H - 8) + ' L 26 36 Q 42 28 58 36 L 58 ' + (H - 8) + ' Z' }),
        React.createElement('rect', { x: 48, y: 56, width: 26, height: 16, rx: 1 })
      )
    );
  }
  return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
    React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
      React.createElement('circle', { cx: W/2, cy: 18, r: 10 }),
      React.createElement('path', { d: 'M ' + (W/2 - 16) + ' ' + (H - 8) + ' L ' + (W/2 - 16) + ' 36 Q ' + W/2 + ' 28 ' + (W/2 + 16) + ' 36 L ' + (W/2 + 16) + ' ' + (H - 8) + ' Z' }),
      React.createElement('line', { x1: W/2 + 14, y1: 42, x2: W/2 + 22, y2: 28, stroke: '#1a1a2e', strokeWidth: 2, opacity: 0.85 }),
      React.createElement('circle', { cx: W/2 + 23, cy: 26, r: 4, fill: '#d4af6a' })
    )
  );
}
`;
```

- [ ] **Step 5: 翻译 ChoiceBoard → choiceBoardCode**

Append after `aiSilhouetteCode`:

```javascript
const choiceBoardCode = `
// ===== components/ChoiceBoard.tsx =====
var LABELS_CHOICE = ['A','B','C','D'];

function ChoiceBoard(props) {
  var verses = props.verses;
  var secondsLeft = props.secondsLeft;
  var onSelect = props.onSelect;
  var disabled = props.disabled === true;
  return React.createElement('div', { style: { position: 'relative' } },
    React.createElement('div', {
      style: {
        position: 'absolute', top: -8, right: 0,
        color: secondsLeft <= 10 ? '#a8302a' : '#000',
        fontFamily: fontFamilies.chinese, fontSize: 18, fontWeight: 700,
      },
    }, '⏱ ' + secondsLeft + 's'),
    React.createElement('div', {
      style: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16,
      },
    },
      LABELS_CHOICE.map(function(label, i) {
        var v = verses[i];
        if (!v) {
          return React.createElement('div', {
            key: label,
            style: {
              padding: 16,
              border: '1px dashed rgba(139,115,85,0.3)',
              borderRadius: 4, minHeight: 64,
            },
          });
        }
        return React.createElement('button', {
          key: label,
          onClick: function() { onSelect(v); },
          disabled: disabled,
          style: {
            padding: 16,
            background: disabled ? 'rgba(0,0,0,0.04)' : 'transparent',
            border: '1px solid #8b7355', borderRadius: 4, color: '#000',
            fontFamily: fontFamilies.chinese, fontSize: 16, textAlign: 'left',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'background 0.15s',
          },
        },
          React.createElement('span', { style: { marginRight: 8, fontWeight: 700 } }, label + '.'),
          v.line,
          React.createElement('div', { style: { fontSize: 12, color: '#8b7355', marginTop: 4 } },
            '《' + v.poemTitle + '》· ' + v.poetName
          )
        );
      })
    )
  );
}
`;
```

- [ ] **Step 6: 翻译 CombatResultModal → combatResultModalCode**

Append after `choiceBoardCode`:

```javascript
const combatResultModalCode = `
// ===== components/CombatResultModal.tsx =====
function formatTimeCombat(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
}

function poemLinkCombat(v, label) {
  return React.createElement(Link, {
    key: v.poemId + '-' + v.line,
    to: '/poem/' + v.poemId,
    style: {
      display: 'block', padding: '4px 0', color: '#000',
      textDecoration: 'none', fontFamily: fontFamilies.chinese, fontSize: 14,
    },
  },
    React.createElement('span', { style: { color: '#8b7355', marginRight: 8 } }, label),
    v.line,
    React.createElement('span', { style: { color: '#8b7355', fontSize: 12, marginLeft: 8 } },
      '《' + v.poemTitle + '》· ' + v.poetName
    )
  );
}

var btnStyleCombat = {
  padding: '8px 20px',
  background: 'transparent', color: '#000',
  border: '1px solid #000', borderRadius: 3,
  fontFamily: fontFamilies.chinese, fontSize: 14, cursor: 'pointer',
};

function CombatResultModal(props) {
  var r = props.result;
  return React.createElement('div', {
    style: { animation: 'result-fade-scale 0.4s ease-out', padding: 24 },
  },
    React.createElement('div', {
      style: {
        textAlign: 'center', fontFamily: fontFamilies.chinese,
        fontSize: 48, letterSpacing: 12, marginBottom: 8, color: '#000',
      },
    }, r.winner === 'player' ? '你 胜' : 'AI 胜'),
    React.createElement('div', {
      style: {
        textAlign: 'center', color: '#8b7355',
        fontFamily: fontFamilies.chinese, fontSize: 14, marginBottom: 24,
      },
    }, '用时 ' + formatTimeCombat(r.elapsedSec) + ' · 关键字「' + r.keyword + '」'),

    React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 },
    },
      React.createElement('div', null,
        React.createElement('div', {
          style: {
            fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
            borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
          },
        }, '你的诗囊（' + r.playerPicks.length + '）'),
        r.playerPicks.length === 0
          ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（未答出）')
          : r.playerPicks.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
      ),
      React.createElement('div', null,
        React.createElement('div', {
          style: {
            fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
            borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
          },
        }, 'AI 诗囊（' + r.aiPicks.length + '）'),
        r.aiPicks.length === 0
          ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（未答出）')
          : r.aiPicks.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
      )
    ),

    React.createElement('div', { style: { marginBottom: 24 } },
      React.createElement('div', {
        style: {
          fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
          borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
        },
      }, '未答出的诗句（' + r.unused.length + '）'),
      r.unused.length === 0
        ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（题库已尽）')
        : r.unused.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
    ),

    React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 16 } },
      React.createElement('button', { onClick: r.onPlayAgain, style: btnStyleCombat }, '再来一局'),
      React.createElement('button', { onClick: r.onPickKeyword, style: btnStyleCombat }, '换关键字')
    )
  );
}
`;
```

- [ ] **Step 7: 翻译 AiPlay → aiPlayCode**

Append after `combatResultModalCode`:

```javascript
const aiPlayCode = `
// ===== pages/AiPlay.tsx =====
var TURN_SECONDS = 30;

function isDifficulty(s) {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

function AiPlay() {
  var params = useParams();
  var search = useSearchParams();
  var sp = search[0];
  var setSp = search[1];
  var navigate = useNavigate();
  var kw = params.kw;
  var diffParam = sp.get('difficulty');
  var difficulty = isDifficulty(diffParam) ? diffParam : 'qingdeng';

  var initialTurnRef = useRef(null);
  if (initialTurnRef.current === null) initialTurnRef.current = rollFirstTurn();
  var firstRound = initialTurnRef.current;

  var roundState = useState(firstRound);
  var round = roundState[0]; var setRound = roundState[1];
  var playerPicksState = useState([]);
  var playerPicks = playerPicksState[0]; var setPlayerPicks = playerPicksState[1];
  var aiPicksState = useState([]);
  var aiPicks = aiPicksState[0]; var setAiPicks = aiPicksState[1];
  var usedState = useState(new Set());
  var used = usedState[0]; var setUsed = usedState[1];
  var boardState = useState(buildChoiceBoard(new Set(), kw || '', 4));
  var board = boardState[0]; var setBoard = boardState[1];
  var secState = useState(TURN_SECONDS);
  var secondsLeft = secState[0]; var setSecondsLeft = secState[1];
  var resultState = useState(null);
  var result = resultState[0]; var setResult = resultState[1];
  var startTimeRef = useRef(Date.now());

  function finish(winner) {
    if (result) return;
    var elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (winner === 'player') recordWin(difficulty);
    else recordLoss(difficulty);
    var allUnused = getVersesFor(kw || '').filter(function(v) { return !used.has(v.line); });
    setResult({
      winner: winner,
      elapsedSec: elapsed,
      playerPicks: playerPicks,
      aiPicks: aiPicks,
      unused: allUnused,
      keyword: kw || '',
      onPlayAgain: function() { navigate('/play/ai/' + kw + '?difficulty=' + difficulty, { replace: true }); },
      onPickKeyword: function() { navigate('/play?tab=combat'); },
    });
  }

  // 玩家回合倒计时
  useEffect(function() {
    if (result || round !== 'player') return;
    if (secondsLeft <= 0) { finish('ai'); return; }
    var t = setTimeout(function() { setSecondsLeft(function(s) { return s - 1; }); }, 1000);
    return function() { clearTimeout(t); };
  }, [secondsLeft, round, result]);

  // AI 回合
  useEffect(function() {
    if (result || round !== 'ai' || !kw) return;
    var meta = DIFFICULTY_META[difficulty];
    var t = setTimeout(function() {
      var pick = aiPickAnswer(kw, used, difficulty);
      if (!pick.picked) { finish('player'); return; }
      setAiPicks(function(prev) { return prev.concat([pick.verse]); });
      var nextUsed = new Set(used);
      nextUsed.add(pick.verse.line);
      setUsed(nextUsed);
      var nextBoard = buildChoiceBoard(nextUsed, kw, 4);
      if (nextBoard.length === 0) { finish('player'); return; }
      setBoard(nextBoard);
      setSecondsLeft(TURN_SECONDS);
      setRound('player');
    }, meta.thinkMs);
    return function() { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // 玩家回合进入时建题板
  useEffect(function() {
    if (round !== 'player' || result || !kw) return;
    if (board.length === 0) {
      var b = buildChoiceBoard(used, kw, 4);
      if (b.length === 0) { finish('ai'); return; }
      setBoard(b);
      setSecondsLeft(TURN_SECONDS);
    }
  }, [round, result, kw]);

  function onSelect(v) {
    if (result || round !== 'player') return;
    setPlayerPicks(function(prev) { return prev.concat([v]); });
    var nextUsed = new Set(used);
    nextUsed.add(v.line);
    setUsed(nextUsed);
    var aiBoard = buildChoiceBoard(nextUsed, kw || '', 1);
    if (aiBoard.length === 0) { finish('player'); return; }
    setRound('ai');
  }

  if (!kw) {
    return React.createElement('div', { style: { padding: 40, color: colors.textPrimary } }, '关键字缺失');
  }
  var meta = DIFFICULTY_META[difficulty];

  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(TopNav, { variant: 'main' }),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' } },
      React.createElement('div', { style: { marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('button', {
          onClick: function() { navigate('/play?tab=combat'); },
          style: {
            background: 'transparent', border: 'none', color: colors.textTertiary,
            fontSize: 14, fontFamily: fontFamilies.chinese, cursor: 'pointer',
          },
        }, '← 返回大厅'),
        React.createElement('div', {
          style: { color: colors.textTertiary, fontSize: 14, fontFamily: fontFamilies.chinese },
        }, round === 'player' ? '你的回合' : 'AI 思考中…')
      ),

      React.createElement(PaperScroll, null,
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 24 } },
          React.createElement('div', {
            style: {
              fontFamily: fontFamilies.chinese, color: '#000',
              fontSize: 80, fontWeight: 700, lineHeight: 1, marginBottom: 8,
            },
          }, kw)
        ),

        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 } },
          // 左
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
              },
            }, '你的诗囊（' + playerPicks.length + '）'),
            playerPicks.length === 0
              ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13 } }, '（尚未出招）')
              : playerPicks.map(function(v, i) {
                  return React.createElement('div', {
                    key: v.poemId + '-' + i,
                    style: { color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese },
                  }, (i + 1) + '. ' + v.line);
                })
          ),
          // 右
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 12,
              },
            },
              React.createElement(AiSilhouette, { difficulty: difficulty }),
              React.createElement('div', null,
                React.createElement('div', null, meta.label),
                React.createElement('div', {
                  style: { fontSize: 12, color: '#8b7355' },
                }, Math.round(meta.missRate * 100) + '% 漏答 · ' + (meta.thinkMs / 1000).toFixed(1) + 's'),
                round === 'ai' ? React.createElement('div', { style: { display: 'flex', gap: 4, marginTop: 4 } },
                  [0, 1, 2].map(function(i) {
                    return React.createElement('span', {
                      key: i,
                      style: {
                        width: 6, height: 6, borderRadius: '50%', background: '#000',
                        display: 'inline-block',
                        animation: 'dot-bounce 1.2s ease-in-out ' + (i * 0.2) + 's infinite',
                      },
                    });
                  })
                ) : null
              )
            ),
            React.createElement('div', {
              style: { fontFamily: fontFamilies.chinese, color: '#000', fontSize: 14, paddingTop: 8 },
            }, 'AI 诗囊（' + aiPicks.length + '）'),
            aiPicks.length === 0
              ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13 } }, '（AI 尚未出招）')
              : aiPicks.map(function(v, i) {
                  return React.createElement('div', {
                    key: v.poemId + '-' + i,
                    style: { color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese },
                  }, (i + 1) + '. ' + v.line);
                })
          )
        ),

        result
          ? React.createElement(CombatResultModal, { result: result })
          : (round === 'player'
              ? React.createElement(ChoiceBoard, {
                  verses: board,
                  secondsLeft: secondsLeft,
                  onSelect: onSelect,
                })
              : React.createElement('div', {
                  style: { textAlign: 'center', color: '#8b7355', fontFamily: fontFamilies.chinese, padding: 32, fontSize: 14 },
                }, '（AI 回合锁定中）'))
      )
    )
  );
}
`;
```

- [ ] **Step 8: 翻译修改后的 PlayHall / PaperScroll / KeywordSeal / types 扩展**

按 Plan 1 Task 11 的翻译规则，翻译：

**types.ts 扩展**（追加到 `feihuaTypesCode`）：

```javascript
// ===== (appended to feihuaTypesCode) =====
var DIFFICULTY_META = {
  qingdeng: { label: '青灯', missRate: 0.30, thinkMs: 3000 },
  mohe:     { label: '墨客', missRate: 0.10, thinkMs: 1500 },
  shisheng: { label: '诗圣', missRate: 0.00, thinkMs: 800  },
};
var INITIAL_RECORD = {
  qingdeng: { win: 0, lose: 0 },
  mohe:     { win: 0, lose: 0 },
  shisheng: { win: 0, lose: 0 },
};
```

**PaperScroll 翻译**（替换 `paperScrollCode`）— 加 `enter` prop 默认 `true`，外层 div 加 `animation`：

```javascript
// (新版 paperScrollCode 内嵌；翻译规则同 Plan 1 Task 11 Step 6)
// — 关键差异 —
// function PaperScroll(props) {
//   var enter = props.enter === undefined ? true : props.enter;
//   // ... 同原版
//   return React.createElement('div', {
//     style: {
//       ...
//       animation: enter ? 'scroll-enter 0.6s ease-out' : undefined,
//       transformOrigin: 'top center',
//     },
//   }, ...);
// }
```

**KeywordSeal 翻译**（替换 `keywordSealCode`）— 把 button 套入外层 div：

```javascript
// function KeywordSeal(props) {
//   var keyword = props.keyword; var state = props.state; var onClick = props.onClick;
//   var c = SEAL_COLORS[state];
//   var interactive = state !== 'locked';
//   return React.createElement('div', {
//     style: {
//       transform: state === 'current' ? 'rotate(-3deg)' : 'rotate(0)',
//       transition: 'transform 0.15s',
//     },
//   },
//     React.createElement('button', {
//       onClick: interactive ? onClick : undefined,
//       disabled: !interactive,
//       style: { /* ... 去除 transform + animation 仍按原值 ... */ },
//     }, state === 'locked' ? '？' : keyword)
//   );
// }
```

**PlayHall 翻译**（替换 `playHallCode`）— 翻译 src/pages/PlayHall.tsx 的整个新版本（双 tab + URL 持久化），沿用 Plan 1 Step 8 的规则。`useSearchParams` / `setSearchParams` 来自 miniRouterCode 补的全局。

> **执行细节**：这个翻译最大块（约 200 行）。建议执行时直接 Read `src/pages/PlayHall.tsx` 当前文件后按规则（无 React 导入 / 函数式改 `React.createElement` / `??` → `||` / `URLSearchParams` 用 Step 1 暴露的全局 / props 解构首行声明）逐行改写。完整代码在 src/pages/PlayHall.tsx，所有受控 UI 行为都不变。

- [ ] **Step 9: 把新 code 块插入 appSource**

Find the `const appSource = ...` block (around line 2701). Update the interpolation list — add the new code variables in dependency order (before `playHallCode`):

```javascript
const appSource = `
const { useState, useMemo, useRef, useEffect, useCallback } = React;

${miniRouterCode}
${themeCode}
${loadCode}
${searchCode}
${layoutCode}
${poemTextCode}
${riverBgCode}
${useVisitedCode}
${viewportHookCode}
${timeAxisCode}
${searchBoxCode}
${topNavCode}
${riverPageCode}
${poemsRiverPageCode}
${poetPageCode}
${poemPageCode}
${feihuaTypesCode}
${feihuaKeywordsCode}
${feihuaEngineCode}
${feihuaProgressCode}
${feihuaAiCode}
${feihuaRecordCode}
${keywordSealCode}
${paperScrollCode}
${aiSilhouetteCode}
${choiceBoardCode}
${combatResultModalCode}
${aiPlayCode}
${playHallCode}
${stagePlayCode}
${appCode}
`;
```

- [ ] **Step 10: App.tsx 路由块 (在 appCode 内)**

在 `appCode` 的 `function App() { ... }` 块中加入新路由：

```javascript
function App() {
  return React.createElement(HashRouter, null,
    React.createElement(Routes, null,
      React.createElement(Route, { path: '/', element: React.createElement(RiverPage) }),
      React.createElement(Route, { path: '/poems', element: React.createElement(PoemsRiverPage) }),
      React.createElement(Route, { path: '/poet/:poetId', element: React.createElement(PoetPage) }),
      React.createElement(Route, { path: '/poem/:poemId', element: React.createElement(PoemPage) }),
      React.createElement(Route, { path: '/play', element: React.createElement(PlayHall) }),
      React.createElement(Route, { path: '/play/stage/:kw', element: React.createElement(StagePlay) }),
      React.createElement(Route, { path: '/play/ai/:kw', element: React.createElement(AiPlay) })
    )
  );
}
```

- [ ] **Step 11: 构建并验证**

Run: `node scripts/build-standalone.cjs`
Expected: `Wrote D:\claude\诗文长河\standalone.html (NNNNNN bytes)` 无错。

如果 Babel 解析失败，先定位失败行（错误信息会标行号），常见原因：模板字面量里漏写分号、`??` 没换成 `||`、函数闭包 `}` `)` 不匹配。

打开 `standalone.html`：
- 飞花令 → 大厅双 tab 可见
- 对战 tab → 选关键字 + 难度 → 开战 → 进入战斗局
- 30 秒倒计时 + AI 三点跳动 + 结算页 + 战绩刷新

- [ ] **Step 12: 全量回归**

Run: `npx vitest run && npx tsc --noEmit`
Expected: 全过。

- [ ] **Step 13: Commit**

```bash
git add scripts/build-standalone.cjs
git commit -m "feat(feihua): sync AI combat and polish to standalone build"
```

---

## 完成验收清单

After Task 10, manually verify:

- [ ] `npx tsc --noEmit` 无错
- [ ] `npx vitest run` 全过（含 15+8 = 23 新测试）
- [ ] `node scripts/build-standalone.cjs` 构建成功
- [ ] `npm run dev` 手动跑通：
  - [ ] 飞花令 → 大厅双 tab 切换正常，金线跟随
  - [ ] URL `?tab=combat` 直达对战 tab
  - [ ] 对战 tab：自由 5 字 + 已通关键字可点，选中状态清晰
  - [ ] 难度卡显示 `青灯/墨客/诗圣` + 漏答率 + 战绩小计
  - [ ] 开战跳 `/play/ai/:kw?difficulty=xxx`
  - [ ] 战斗局双栏对坐，30 秒倒计时显示
  - [ ] AI 回合三点跳动 → thinkMs 后答出 / 漏答
  - [ ] 结算页：胜负大标题 + 用时 + 双栏 + 未答列表 + 按钮组
  - [ ] 「未答出」诗行可点击跳 PoemPage
  - [ ] 「再来一局」同字同难度直接开局
  - [ ] 「换关键字」/「返回大厅」回 `/play?tab=combat`
  - [ ] 战绩 localStorage 跨刷新保留
  - [ ] 三档难度体感：青灯明显漏、诗圣必答
  - [ ] PaperScroll 入场动画顺滑（0.6s scaleY + translateY + opacity）
  - [ ] 关键字印章 current 状态既脉冲又轻微 -3° 倾斜，两者都可见
- [ ] 打开 `standalone.html` → 同样能跑（双源同步验证）
