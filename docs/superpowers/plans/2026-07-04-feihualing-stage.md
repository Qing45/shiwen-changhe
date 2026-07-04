# 飞花令 · 单人闯关 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「诗文长河」SPA 中加入飞花令单人闯关玩法：50 个关键字按难度递进解锁，玩家通过九宫格拼字答出含关键字的诗句，3 滴血 + 每题 120 秒，答完 5 句通关。

**Architecture:** 纯前端实现。新增 `src/play/` 模块封装关键字索引、判定、进度持久化；新增 3 个页面（PlayHall / StagePlay）与 3 个组件（KeywordSeal / NineGrid / 通用卷轴外框）；扩展现有 App 路由与 TopNav。所有数据从已有的 320 首唐诗题库扫描生成，无后端调用。

**Tech Stack:** React 18 + TypeScript + react-router-dom v6 + Vitest。视觉沿用墨夜星空 + 卷轴纸张主题（与 PoemPage 一致）。

## Global Constraints

- **语言**：所有 UI 文案、注释使用中文；字符标点用全角（，。「」）。
- **字体**：楷书字体栈 `fontFamilies.chinese`，不引入新字体。
- **配色**：仅用 spec 中定义的常量（`PAPER_BG` `rgba(245,235,210,0.85)`、`PAPER_TEXT` `#000000`、`PAPER_TEXT_DIM` `#8b7355`、`colors.bgGradient`）；不引入新色值。
- **关键字清单**：50 字（spec §7），按入门 10 / 进阶 20 / 高阶 20 三档。
- **localStorage 键**：`shiwen-feihua-progress`（snake case 不可改名）。
- **路由**：`/play` `/play/stage/:kw` 两条新路由；保留现有 4 条。
- **测试**：纯函数 100% 覆盖，组件用 Vitest + Testing Library（已配置）。
- **双源同步**：每个 Task 在 src 完成后，**最后一个 Task 一次性**把所有飞花令代码同步到 `scripts/build-standalone.cjs`（避免每个任务被同步工作淹没）。
- **TDD**：每个纯函数任务先写失败测试 → 实现 → 通过 → commit。
- **提交粒度**：每个 Task 一个 commit，提交信息用 `feat(feihua): ...` 或 `test(feihua): ...` 前缀。

---

## 文件结构

**新增 src 文件**
```
src/
├─ play/
│   ├─ types.ts           ← Verse, Difficulty, PlayState, StageProgress, FeihuaProgress 类型
│   ├─ keywords.ts        ← 50 字关键字清单 + 难度分组
│   ├─ engine.ts          ← buildKeywordIndex, validateVerse, pickVersesForStage 纯函数
│   └─ progress.ts        ← localStorage 读写 + 断点续传
├─ components/
│   ├─ KeywordSeal.tsx    ← 印章式关键字节点（朱红 / 灰白 / 金边三态）
│   ├─ PaperScroll.tsx    ← 复用 PoemPage 的卷轴外框（左木轴 + 双金线 + 右木轴）
│   └─ NineGrid.tsx       ← 九宫格字块输入
└─ pages/
    ├─ PlayHall.tsx       ← 大厅：50 关印章地图 + 进度条
    └─ StagePlay.tsx      ← 单人闯关局：入场 → 出题 → 答题 → 判定 → 结算
```

**修改 src 文件**
```
src/App.tsx               ← Routes 加 /play /play/stage/:kw
src/components/TopNav.tsx ← RiverToggle 加「飞花令」第三档
```

**新增测试**
```
src/play/keywords.test.ts
src/play/engine.test.ts
src/play/progress.test.ts
```

**双源同步（最后任务）**
```
scripts/build-standalone.cjs ← 把上述所有新代码翻译成 JS 模板字面量内联
```

---

## Task 1: 定义类型与关键字清单

**Files:**
- Create: `src/play/types.ts`
- Create: `src/play/keywords.ts`
- Test: `src/play/keywords.test.ts`

**Interfaces:**
- Produces:
  - `Verse` — `{ poemId: string; line: string; poemTitle: string; poetName: string }`
  - `Difficulty` — `'qingdeng' | 'mohe' | 'shisheng'`（Plan 2 用，本 Plan 仅声明）
  - `StageProgress` — `{ correct: string[]; blood: number }` 单关进度
  - `FeihuaProgress` — `{ unlockedIndex: number; cleared: string[]; current: { keyword: string; correct: string[]; blood: number } | null }`
  - `KEYWORDS` — `string[]`（50 字，按 spec §7 难度顺序）
  - `KEYWORD_GROUPS` — `{ entry: string[]; mid: string[]; advanced: string[] }`

- [ ] **Step 1: Write the failing test**

Create `src/play/keywords.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { KEYWORDS, KEYWORD_GROUPS } from './keywords';

describe('KEYWORDS', () => {
  it('has exactly 50 characters', () => {
    expect(KEYWORDS).toHaveLength(50);
  });

  it('each character is a single CJK char', () => {
    for (const k of KEYWORDS) {
      expect(k.length).toBe(1);
      expect(/[一-鿿]/.test(k)).toBe(true);
    }
  });

  it('starts with 春 月 花 风 山 水 云 天 人 心 (entry tier)', () => {
    expect(KEYWORDS.slice(0, 10)).toEqual(['春','月','花','风','山','水','云','天','人','心']);
  });

  it('has no duplicates', () => {
    expect(new Set(KEYWORDS).size).toBe(50);
  });
});

describe('KEYWORD_GROUPS', () => {
  it('splits into 10 / 20 / 20', () => {
    expect(KEYWORD_GROUPS.entry).toHaveLength(10);
    expect(KEYWORD_GROUPS.mid).toHaveLength(20);
    expect(KEYWORD_GROUPS.advanced).toHaveLength(20);
  });

  it('groups union equals KEYWORDS in order', () => {
    expect([...KEYWORD_GROUPS.entry, ...KEYWORD_GROUPS.mid, ...KEYWORD_GROUPS.advanced])
      .toEqual(KEYWORDS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/play/keywords.test.ts`
Expected: FAIL with "Cannot find module './keywords'"

- [ ] **Step 3: Create types.ts**

Create `src/play/types.ts`:

```typescript
// 飞花令核心数据类型。

export interface Verse {
  poemId: string;
  line: string;
  poemTitle: string;
  poetName: string;
}

// AI 对战难度（Plan 2 用，本 Plan 仅声明）
export type Difficulty = 'qingdeng' | 'mohe' | 'shisheng';

// 单关进度：已答对的句子 + 剩余血量
export interface StageProgress {
  keyword: string;
  correct: string[];   // 已答对的诗句原文（line 字段）
  blood: number;       // 剩余血量（0-3）
}

// 整个飞花令进度
export interface FeihuaProgress {
  unlockedIndex: number;                  // 当前解锁到第几关（0-49）
  cleared: string[];                      // 已通关关键字清单
  current: StageProgress | null;          // 当前进行中的局（断点续传）
}

export const INITIAL_PROGRESS: FeihuaProgress = {
  unlockedIndex: 0,
  cleared: [],
  current: null,
};

export const STAGE_GOAL = 5;       // 每关需答出的不重复诗句数
export const STAGE_BLOOD = 3;      // 每局初始血量
export const STAGE_TIMEBOX = 120;  // 每题限时（秒）
```

- [ ] **Step 4: Create keywords.ts**

Create `src/play/keywords.ts`:

```typescript
// 飞花令关键字清单。50 字按难度三档分组，难度递进。
// 来源：spec §7。最终清单在 Task 2 的 buildKeywordIndex 扫描后验证每字 ≥ 5 句。

export const KEYWORD_GROUPS = {
  entry: ['春','月','花','风','山','水','云','天','人','心'],
  mid: ['夜','秋','年','日','雪','酒','梦','愁','思','江',
        '河','雨','柳','草','木','梅','竹','松','茶','楼'],
  advanced: ['菊','桃','燕','鸟','马','衣','书','剑','琴','笛',
             '钟','灯','影','台','城','海','舟','桥','鹤','霜'],
} as const;

export const KEYWORDS: readonly string[] = [
  ...KEYWORD_GROUPS.entry,
  ...KEYWORD_GROUPS.mid,
  ...KEYWORD_GROUPS.advanced,
];

// 对战 tab 默认可选的「自由 5 字礼包」，无需通关解锁（Plan 2 用）
export const FREE_KEYWORDS: readonly string[] = ['春','月','花','风','雪'];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/play/keywords.test.ts`
Expected: PASS (4 tests passing)

- [ ] **Step 6: Commit**

```bash
git add src/play/types.ts src/play/keywords.ts src/play/keywords.test.ts
git commit -m "feat(feihua): add types and 50-char keyword list"
```

---

## Task 2: 关键字索引构建

**Files:**
- Create: `src/play/engine.ts`
- Test: `src/play/engine.test.ts`

**Interfaces:**
- Consumes:
  - `getPoems()` from `src/data/load.ts` — 返回 320 首诗
  - `getPoet(poetId)` from `src/data/load.ts`
  - `extractVariants(content)` from `src/utils/poemText.ts` — 剥离异文注
  - `splitIntoLines(content, mode)` from `src/utils/poemText.ts` — 切句
  - `KEYWORDS` from `./keywords`
  - `Verse` from `./types`
- Produces:
  - `buildKeywordIndex(): Map<string, Verse[]>` — 启动时构建一次
  - `getKeywordIndex(): Map<string, Verse[]>` — 模块级懒加载缓存
  - `getVersesFor(keyword: string): Verse[]` — 取某字所有句

- [ ] **Step 1: Write the failing test**

Create `src/play/engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { buildKeywordIndex, getVersesFor, getKeywordIndex } from './engine';
import { KEYWORDS } from './keywords';

describe('buildKeywordIndex', () => {
  let index: Map<string, Verse[]>;

  beforeEach(() => {
    index = buildKeywordIndex();
  });

  it('returns a Map keyed by every KEYWORDS character', () => {
    for (const k of KEYWORDS) {
      expect(index.has(k)).toBe(true);
    }
  });

  it('each verse contains its keyword', () => {
    for (const [kw, verses] of index.entries()) {
      for (const v of verses) {
        expect(v.line).toContain(kw);
      }
    }
  });

  it('春 has at least 5 verses (entry-tier must be playable)', () => {
    expect(getVersesFor('春').length).toBeGreaterThanOrEqual(5);
  });

  it('月 has at least 5 verses', () => {
    expect(getVersesFor('月').length).toBeGreaterThanOrEqual(5);
  });

  it('every verse has non-empty poemId, poemTitle, poetName', () => {
    for (const verses of index.values()) {
      for (const v of verses) {
        expect(v.poemId.length).toBeGreaterThan(0);
        expect(v.poemTitle.length).toBeGreaterThan(0);
        expect(v.poetName.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getKeywordIndex (lazy cache)', () => {
  it('returns the same Map on second call', () => {
    const a = getKeywordIndex();
    const b = getKeywordIndex();
    expect(a).toBe(b);
  });
});
```

(Note: the test file imports `Verse` for type-only usage; add `import type { Verse } from './types';` at the top.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/play/engine.test.ts`
Expected: FAIL with "Cannot find module './engine'"

- [ ] **Step 3: Implement engine.ts (buildKeywordIndex + getVersesFor)**

Create `src/play/engine.ts`:

```typescript
import { getPoems, getPoet } from '../data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import { KEYWORDS } from './keywords';
import type { Verse } from './types';

// 一次性扫描 320 首诗，构建关键字 -> 含该字的诗句列表。
// 切句规则：先剥异文 → 选 mode（短/长） → splitIntoLines → 每句独立判断。
export function buildKeywordIndex(): Map<string, Verse[]> {
  const index = new Map<string, Verse[]>();
  for (const k of KEYWORDS) index.set(k, []);

  for (const poem of getPoems()) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (const line of lines) {
      // 去标点后判定含字（保留原句作为题目）
      const stripped = line.replace(/[，。？！；：、,\.\?!;]/g, '');
      for (const k of KEYWORDS) {
        if (stripped.includes(k)) {
          index.get(k)!.push({
            poemId: poem.id,
            line: line.trim(),
            poemTitle: poem.title,
            poetName: poet.name,
          });
        }
      }
    }
  }

  return index;
}

// 模块级缓存（首次调用懒加载）
let _cache: Map<string, Verse[]> | null = null;

export function getKeywordIndex(): Map<string, Verse[]> {
  if (_cache === null) _cache = buildKeywordIndex();
  return _cache;
}

export function getVersesFor(keyword: string): Verse[] {
  return getKeywordIndex().get(keyword) ?? [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/play/engine.test.ts`
Expected: PASS (5 tests)

If `春` or `月` has fewer than 5 verses, replace the offending keyword in `keywords.ts` with another high-frequency char from the actual scan. Iterate until entry-tier all have ≥ 5 verses.

- [ ] **Step 5: Commit**

```bash
git add src/play/engine.ts src/play/engine.test.ts
git commit -m "feat(feihua): build keyword index by scanning 320 poems"
```

---

## Task 3: 出题与判定函数

**Files:**
- Modify: `src/play/engine.ts`
- Test: `src/play/engine.test.ts` (append)

**Interfaces:**
- Produces:
  - `pickStageQuestion(keyword, used): { verse: Verse; blanks: number[] } | null` — 抽 1 句未答过的，决定挖哪些字位
  - `buildNineGrid(answer: string, blanks: number[]): { chars: string[]; blankCount: number }` — 12 字块（答案 + 干扰）
  - `validateStageInput(filled: string, answer: string): boolean` — 玩家拼出的字串是否等于答案

- [ ] **Step 1: Write the failing tests (append to engine.test.ts)**

```typescript
import { pickStageQuestion, buildNineGrid, validateStageInput } from './engine';

describe('pickStageQuestion', () => {
  it('returns a verse not in `used`', () => {
    const verses = getVersesFor('春');
    const used = new Set([verses[0].line]);
    const q = pickStageQuestion('春', used);
    expect(q).not.toBeNull();
    expect(used.has(q!.verse.line)).toBe(false);
  });

  it('returns null when all verses are used', () => {
    const verses = getVersesFor('春');
    const used = new Set(verses.map(v => v.line));
    expect(pickStageQuestion('春', used)).toBeNull();
  });

  it('blanks array contains a position where keyword appears', () => {
    const q = pickStageQuestion('春', new Set());
    if (!q) return;
    const charAtBlank = q.verse.line[q.blanks[0]];
    expect(charAtBlank).toBe('春');
  });

  it('blanks length is 2 or 3', () => {
    const q = pickStageQuestion('春', new Set());
    if (!q) return;
    expect(q.blanks.length).toBeGreaterThanOrEqual(2);
    expect(q.blanks.length).toBeLessThanOrEqual(3);
  });
});

describe('buildNineGrid', () => {
  it('returns 12 character blocks', () => {
    const g = buildNineGrid('春眠不觉晓', [0, 2]);
    expect(g.chars).toHaveLength(12);
  });

  it('contains all answer characters', () => {
    const answer = '春眠不觉晓';
    const g = buildNineGrid(answer, [0, 2]);
    // blanks = [0, 2] → answer[0]='春', answer[2]='不' in grid
    expect(g.chars).toContain('春');
    expect(g.chars).toContain('不');
    expect(g.blankCount).toBe(2);
  });

  it('distractor chars are not equal to any answer char', () => {
    const answer = '春眠不觉晓';
    const g = buildNineGrid(answer, [0, 2]);
    // 12 chars - 5 from answer (or just 2 from blanks if we only put blanks in)
    // Per implementation: put only blank chars in grid (2) + 10 distractors
    // Distractors must not duplicate any char in answer
    const distractors = g.chars.slice(g.blankCount);
    for (const d of distractors) {
      expect(answer).not.toContain(d);
    }
  });
});

describe('validateStageInput', () => {
  it('matches when filled equals answer at all positions', () => {
    expect(validateStageInput('春不', '春眠不觉晓', [0, 2])).toBe(true);
  });

  it('rejects wrong character', () => {
    expect(validateStageInput('春眠', '春眠不觉晓', [0, 2])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/play/engine.test.ts`
Expected: FAIL with "pickStageQuestion is not a function"

- [ ] **Step 3: Implement the three functions (append to engine.ts)**

```typescript
// ============ 单人闯关出题 / 判定 ============

const DISTRACTOR_POOL = '一二三四五六七八九十百千万里外古今南北东西上下左右中青山河颜色红绿黄白青紫玉石金铁风雨霜露天地秋冬夏时光影梦魂';

// 抽一句未答过的，挖 2-3 字（必含关键字位置）
export function pickStageQuestion(
  keyword: string,
  used: Set<string>,
): { verse: Verse; blanks: number[] } | null {
  const pool = getVersesFor(keyword).filter(v => !used.has(v.line));
  if (pool.length === 0) return null;
  const verse = pool[Math.floor(Math.random() * pool.length)];

  // 找出关键字在原句中的所有位置
  const kwPositions: number[] = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (verse.line[i] === keyword) kwPositions.push(i);
  }
  // 关键字至少挖一处（取第一处）
  const blanks = new Set<number>([kwPositions[0]]);

  // 加 1-2 个干扰挖空位（不能是关键字位置，不能是标点）
  const allCands: number[] = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (kwPositions.includes(i)) continue;
    if (/[，。？！；：、,\.\?!;]/.test(verse.line[i])) continue;
    allCands.push(i);
  }
  // 洗牌
  for (let i = allCands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCands[i], allCands[j]] = [allCands[j], allCands[i]];
  }
  const extra = Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < extra && i < allCands.length; i++) {
    blanks.add(allCands[i]);
  }

  return { verse, blanks: Array.from(blanks).sort((a, b) => a - b) };
}

// 构建九宫格：把 blanks 位置的字 + 干扰字打乱成 12 字块
export function buildNineGrid(
  answer: string,
  blanks: number[],
): { chars: string[]; blankCount: number } {
  const answerChars = blanks.map(i => answer[i]);
  const distractors: string[] = [];
  let i = 0;
  while (distractors.length < 12 - blanks.length && i < DISTRACTOR_POOL.length * 10) {
    const c = DISTRACTOR_POOL[Math.floor(Math.random() * DISTRACTOR_POOL.length)];
    if (!answer.includes(c) && !distractors.includes(c)) {
      distractors.push(c);
    }
    i++;
  }

  const all = [...answerChars, ...distractors];
  // 洗牌
  for (let j = all.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [all[j], all[k]] = [all[k], all[j]];
  }
  return { chars: all, blankCount: blanks.length };
}

// 玩家拼出的字串按 blanks 顺序回填后是否等于原句
export function validateStageInput(
  filled: string,
  answer: string,
  blanks: number[],
): boolean {
  if (filled.length !== blanks.length) return false;
  const arr = Array.from(answer);
  for (let i = 0; i < blanks.length; i++) {
    if (arr[blanks[i]] !== filled[i]) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/play/engine.test.ts`
Expected: PASS (all engine tests)

- [ ] **Step 5: Commit**

```bash
git add src/play/engine.ts src/play/engine.test.ts
git commit -m "feat(feihua): add stage question picker, nine-grid builder, validator"
```

---

## Task 4: 进度持久化（localStorage）

**Files:**
- Create: `src/play/progress.ts`
- Test: `src/play/progress.test.ts`

**Interfaces:**
- Produces:
  - `loadProgress(): FeihuaProgress` — 读 localStorage，失败返回 `INITIAL_PROGRESS`
  - `saveProgress(p: FeihuaProgress): void` — 写 localStorage，失败静默
  - `markCleared(keyword: string): FeihuaProgress` — 标记通关，更新 cleared 与 unlockedIndex
  - `beginStage(keyword: string): FeihuaProgress` — 开始新一局（写 current 字段）
  - `commitStageCorrect(keyword: string, line: string): FeihuaProgress` — 答对一句，更新 current.correct
  - `commitStageBlood(keyword: string, blood: number): FeihuaProgress` — 更新血量
  - `clearCurrent(): FeihuaProgress` — 清空 current（通关或失败后）

- [ ] **Step 1: Write the failing test**

Create `src/play/progress.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress, saveProgress, markCleared,
  beginStage, commitStageCorrect, commitStageBlood, clearCurrent,
} from './progress';
import { INITIAL_PROGRESS } from './types';

describe('progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadProgress returns INITIAL_PROGRESS when empty', () => {
    expect(loadProgress()).toEqual(INITIAL_PROGRESS);
  });

  it('saveProgress round-trips', () => {
    const p = { ...INITIAL_PROGRESS, unlockedIndex: 3, cleared: ['春','月','花'] };
    saveProgress(p);
    expect(loadProgress()).toEqual(p);
  });

  it('markCleared adds keyword and bumps unlockedIndex', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0 });
    const p = markCleared('春');
    expect(p.cleared).toContain('春');
    expect(p.unlockedIndex).toBe(1);
  });

  it('beginStage sets current with full blood and empty correct', () => {
    const p = beginStage('春');
    expect(p.current).toEqual({ keyword: '春', correct: [], blood: 3 });
  });

  it('commitStageCorrect appends line', () => {
    beginStage('春');
    const p = commitStageCorrect('春', '春眠不觉晓');
    expect(p.current!.correct).toEqual(['春眠不觉晓']);
  });

  it('commitStageBlood updates blood only', () => {
    beginStage('春');
    const p = commitStageBlood('春', 2);
    expect(p.current!.blood).toBe(2);
  });

  it('clearCurrent nulls current', () => {
    beginStage('春');
    const p = clearCurrent();
    expect(p.current).toBeNull();
  });

  it('survives localStorage being unavailable', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadProgress()).toEqual(INITIAL_PROGRESS);
    window.localStorage.getItem = orig;
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/play/progress.test.ts`
Expected: FAIL with "Cannot find module './progress'"

- [ ] **Step 3: Implement progress.ts**

Create `src/play/progress.ts`:

```typescript
import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import { KEYWORDS } from './keywords';

const STORAGE_KEY = 'shiwen-feihua-progress';

export function loadProgress(): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared) ? parsed.cleared.filter((s: unknown) => typeof s === 'string') : [],
      current: parsed.current && typeof parsed.current === 'object'
        ? {
            keyword: String(parsed.current.keyword ?? ''),
            correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
            blood: typeof parsed.current.blood === 'number' ? parsed.current.blood : STAGE_BLOOD,
          }
        : null,
    };
  } catch {
    return { ...INITIAL_PROGRESS };
  }
}

export function saveProgress(p: FeihuaProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // localStorage unavailable or full — silently fail
  }
}

export function markCleared(keyword: string): FeihuaProgress {
  const p = loadProgress();
  if (p.cleared.includes(keyword)) return p;
  p.cleared.push(keyword);
  // unlockedIndex = max(已解锁序号, 该字在 KEYWORDS 中的位置 + 1)
  const idx = KEYWORDS.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null;  // 通关清空 current
  saveProgress(p);
  return p;
}

export function beginStage(keyword: string): FeihuaProgress {
  const p = loadProgress();
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p);
  return p;
}

export function commitStageCorrect(keyword: string, line: string): FeihuaProgress {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p);
  return p;
}

export function commitStageBlood(keyword: string, blood: number): FeihuaProgress {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p);
  return p;
}

export function clearCurrent(): FeihuaProgress {
  const p = loadProgress();
  p.current = null;
  saveProgress(p);
  return p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/play/progress.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/play/progress.ts src/play/progress.test.ts
git commit -m "feat(feihua): add localStorage progress persistence with resume"
```

---

## Task 5: 路由与 TopNav 第三 tab

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/TopNav.tsx`

**Interfaces:**
- Consumes:
  - `RiverPage`, `PoemsRiverPage`, `PoetPage`, `PoemPage` (existing)
  - `PlayHall`, `StagePlay` (created in Task 6 + Task 7; this task creates stubs)
- Produces:
  - Routes `/play` and `/play/stage/:kw` registered
  - `RiverToggle` shows three buttons: 诗人 / 诗文 / 飞花令

- [ ] **Step 1: Create temporary stub pages**

Create `src/pages/PlayHall.tsx`:

```typescript
export function PlayHall() {
  return <div style={{ padding: 40, color: '#e8f0ff' }}>飞花令大厅（待实现）</div>;
}
```

Create `src/pages/StagePlay.tsx`:

```typescript
import { useParams } from 'react-router-dom';

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();
  return <div style={{ padding: 40, color: '#e8f0ff' }}>飞花令 · 关键字「{kw}」（待实现）</div>;
}
```

- [ ] **Step 2: Update App.tsx routes**

Replace `src/App.tsx` contents:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiverPage } from './pages/RiverPage';
import { PoemsRiverPage } from './pages/PoemsRiverPage';
import { PoetPage } from './pages/PoetPage';
import { PoemPage } from './pages/PoemPage';
import { PlayHall } from './pages/PlayHall';
import { StagePlay } from './pages/StagePlay';

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
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Update TopNav RiverToggle (add third tab)**

In `src/components/TopNav.tsx`, find `RiverToggle` function. Currently it has:

```typescript
{btn('/', '诗人', getPoets().length)}
{btn('/poems', '诗文', getPoems().length)}
```

Add a third button (no count suffix for 飞花令):

```typescript
{btn('/', '诗人', getPoets().length)}
{btn('/poems', '诗文', getPoems().length)}
{btn('/play', '飞花令', 0)}
```

The `btn` function shows count when `on` is true; for 飞花令 pass `0` and tweak the count rendering: when count is 0, render just `飞花令` even when active. Update the `btn` helper:

```typescript
const btn = (to: string, label: string, count: number) => {
  const on = loc.pathname === to;
  const showCount = count > 0;
  const text = on && showCount ? `${label}·${count}` : label;
  // ... rest unchanged
};
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS (all 50 + 16 new tests = 66 tests; smoke test should still pass since RiverToggle just got an extra button)

- [ ] **Step 5: Manual check**

Run: `npm run dev` → open browser → verify top nav shows three tabs and clicking 飞花令 shows the stub.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/TopNav.tsx src/pages/PlayHall.tsx src/pages/StagePlay.tsx
git commit -m "feat(feihua): add /play routes and TopNav third tab"
```

---

## Task 6: PlayHall 大厅（关卡地图）

**Files:**
- Create: `src/components/KeywordSeal.tsx`
- Modify: `src/pages/PlayHall.tsx` (replace stub)

**Interfaces:**
- Consumes:
  - `KEYWORDS` from `src/play/keywords`
  - `loadProgress` from `src/play/progress`
  - `fontFamilies`, `colors` from `src/theme`
  - `<TopNav variant="main" />` (existing)
- Produces:
  - `<KeywordSeal keyword state onClick>` — 印章节点，三态：cleared / current / locked
  - `<PlayHall />` — 大厅页

- [ ] **Step 1: Implement KeywordSeal**

Create `src/components/KeywordSeal.tsx`:

```typescript
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
    <button
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      style={{
        width: 64, height: 64,
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
        transform: state === 'current' ? 'rotate(-3deg)' : 'none',
        transition: 'transform 0.15s',
      })}
    >
      {state === 'locked' ? '？' : keyword}
    </button>
  );
}
```

- [ ] **Step 2: Implement PlayHall**

Replace `src/pages/PlayHall.tsx`:

```typescript
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { KeywordSeal } from '../components/KeywordSeal';
import { KEYWORDS, KEYWORD_GROUPS } from '../play/keywords';
import { loadProgress } from '../play/progress';
import { colors, fontFamilies } from '../theme';

export function PlayHall() {
  const progress = loadProgress();
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
          {/* 标题 + 进度 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 32, letterSpacing: 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>飞 花 令</div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 16, letterSpacing: 4,
            }}>已通 {totalCleared} / 50 关</div>
          </div>

          {/* 三档分组 */}
          {(['entry','mid','advanced'] as const).map((group) => (
            <div key={group} style={{ marginBottom: 36 }}>
              <div style={{
                color: colors.textTertiary, fontFamily: fontFamilies.chinese,
                fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
              }}>{group === 'entry' ? '入 门' : group === 'mid' ? '进 阶' : '高 阶'}</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 64px)',
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
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS (smoke test should still pass; this task adds no new tests since UI components are manually verified)

- [ ] **Step 4: Manual check**

Run: `npm run dev` → click 飞花令 tab → verify 50 个印章网格分三档（10 / 20 / 20），第一关「春」金边脉冲可点，其余 locked 显「？」。

- [ ] **Step 5: Commit**

```bash
git add src/components/KeywordSeal.tsx src/pages/PlayHall.tsx
git commit -m "feat(feihua): build PlayHall with 50-seal level map"
```

---

## Task 7: StagePlay 入场 + 出题（静态展示）

**Files:**
- Modify: `src/pages/StagePlay.tsx` (replace stub)
- Create: `src/components/PaperScroll.tsx`

**Interfaces:**
- Consumes:
  - `<TopNav variant="poet">` (existing pattern — adapt)
  - `getVersesFor`, `pickStageQuestion` from `src/play/engine`
  - `loadProgress`, `beginStage` from `src/play/progress`
  - `STAGE_GOAL`, `STAGE_BLOOD` from `src/play/types`
  - `fontFamilies`, `colors` from `src/theme`
- Produces:
  - `<PaperScroll>` — 卷轴外框（复用 PoemPage 的木轴 + 双金线）
  - `<StagePlay />` — 单人闯关页（本任务只到静态展示）

- [ ] **Step 1: Implement PaperScroll**

Create `src/components/PaperScroll.tsx`:

```typescript
import type { ReactNode } from 'react';

const PAPER_BG = 'rgba(245, 235, 210, 0.85)';

interface Props {
  children: ReactNode;
}

// 卷轴外框：左右木轴 + 双金线 + 暖米黄底。
// 复用 PoemPage 的视觉语言。
export function PaperScroll({ children }: Props) {
  return (
    <div style={{
      maxWidth: 1100, margin: '0 auto',
      display: 'flex', borderRadius: 8, overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
    }}>
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
      }} />
      <div style={{ position: 'relative', flex: 1, background: PAPER_BG, padding: '32px 40px' }}>
        <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />
        {children}
      </div>
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
```

- [ ] **Step 2: Implement StagePlay (static version)**

Replace `src/pages/StagePlay.tsx`:

```typescript
import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { colors, fontFamilies } from '../theme';
import { getVersesFor, pickStageQuestion } from '../play/engine';
import { beginStage, loadProgress } from '../play/progress';
import { STAGE_GOAL, STAGE_BLOOD, type Verse } from '../play/types';

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();
  const navigate = useNavigate();

  // 进入页面时初始化局（如果 current 已是本关键字则续传，否则开新局）
  const [stage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress();
    if (progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw);
  });

  // 已答对句集合（用于 pickStageQuestion 排除）
  const used = useMemo(() => new Set(stage?.correct ?? []), [stage]);

  // 当前题目
  const [question, setQuestion] = useState<{ verse: Verse; blanks: number[] } | null>(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used);
  });

  if (!kw || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  // 显示用挖空后的句子
  const displayLine = question
    ? Array.from(question.verse.line).map((ch, i) =>
        question.blanks.includes(i) ? '□' : ch
      ).join('')
    : '';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← 返回大厅</Link>
        </div>
        <PaperScroll>
          {/* 头部：进度 + 血量 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ color: '#000', fontFamily: fontFamilies.chinese, fontSize: 16 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
            </div>
            <div style={{ color: '#000', fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
          </div>

          {/* 关键字大字 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: '#000',
              fontSize: 120, fontWeight: 700, lineHeight: 1,
              marginBottom: 8,
            }}>{kw}</div>
            <div style={{
              color: '#8b7355', fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>飞 花 · 关 键 字</div>
          </div>

          {/* 题目（挖空展示） */}
          <div style={{
            textAlign: 'center', padding: '24px 0',
            fontFamily: fontFamilies.chinese, color: '#000',
            fontSize: 32, letterSpacing: 6, lineHeight: 2,
          }}>
            {displayLine || '（题库已空）'}
          </div>
          {question && (
            <div style={{ textAlign: 'center', color: '#8b7355', fontFamily: fontFamilies.chinese', fontSize: 14 }}>
              出自《{question.verse.poemTitle}》· {question.verse.poetName}
            </div>
          )}

          {/* 输入区（占位，Task 8 实现） */}
          <div style={{ marginTop: 40, textAlign: 'center', color: '#8b7355', fontSize: 14 }}>
            （九宫格输入待实现）
          </div>
        </PaperScroll>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Manual check**

Run: `npm run dev` → 飞花令 → 春 → 进入关卡，看到关键字「春」大字、血量 ❤❤❤、进度 0/5、挖空展示的诗句。

- [ ] **Step 5: Commit**

```bash
git add src/components/PaperScroll.tsx src/pages/StagePlay.tsx
git commit -m "feat(feihua): StagePlay static layout with keyword, blood, blanks display"
```

---

## Task 8: 九宫格输入（NineGrid 组件 + StagePlay 接入）

**Files:**
- Create: `src/components/NineGrid.tsx`
- Modify: `src/pages/StagePlay.tsx`

**Interfaces:**
- Consumes:
  - `buildNineGrid` from `src/play/engine`
- Produces:
  - `<NineGrid chars blankCount onFill onClear>` — 12 字块 + 玩家填字回调

- [ ] **Step 1: Implement NineGrid**

Create `src/components/NineGrid.tsx`:

```typescript
import { fontFamilies } from '../theme';

interface Props {
  chars: string[];           // 12 字块
  blankCount: number;        // 需要填几个字
  filled: string[];          // 已填字符（按点击顺序）
  onChar: (c: string, idx: number) => void;   // 点击某字块
  onUndo: () => void;
}

export function NineGrid({ chars, blankCount, filled, onChar, onUndo }: Props) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* 填字区 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
      }}>
        {Array.from({ length: blankCount }).map((_, i) => (
          <div key={i} style={{
            width: 48, height: 48,
            border: '2px solid #8b7355', borderRadius: 4,
            background: filled[i] ? '#f5ebd2' : 'transparent',
            color: '#000', fontFamily: fontFamilies.chinese,
            fontSize: 28, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{filled[i] ?? ''}</div>
        ))}
        <button
          onClick={onUndo}
          disabled={filled.length === 0}
          style={{
            marginLeft: 12, padding: '0 16px',
            background: 'transparent', color: '#8b7355',
            border: '1px solid #8b7355', borderRadius: 3,
            fontFamily: fontFamilies.chinese, fontSize: 14,
            cursor: filled.length === 0 ? 'default' : 'pointer',
            opacity: filled.length === 0 ? 0.4 : 1,
          }}>退字</button>
      </div>

      {/* 12 字块 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {chars.map((c, idx) => {
          const used = filled.length < blankCount ? false : false;  // 字块不消耗，可重复点（用退字撤销）
          return (
            <button
              key={idx}
              onClick={() => onChar(c, idx)}
              disabled={filled.length >= blankCount}
              style={{
                height: 56,
                background: 'transparent',
                border: '1px solid #8b7355', borderRadius: 3,
                color: '#000', fontFamily: fontFamilies.chinese,
                fontSize: 26, fontWeight: 700,
                cursor: filled.length >= blankCount ? 'default' : 'pointer',
                opacity: filled.length >= blankCount ? 0.5 : 1,
                transition: 'background 0.15s',
              }}>{c}</button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire NineGrid into StagePlay**

In `src/pages/StagePlay.tsx`, replace the placeholder `{/* 输入区（占位，Task 8 实现） */}` block:

```typescript
// 在 useState 区域新增：
const [nineGrid, setNineGrid] = useState(() =>
  question ? buildNineGrid(question.verse.line, question.blanks) : null
);
const [filled, setFilled] = useState<string[]>([]);

// 当 question 改变时重置 nineGrid 与 filled
useEffect(() => {
  if (question) {
    setNineGrid(buildNineGrid(question.verse.line, question.blanks));
    setFilled([]);
  }
}, [question]);

const handleChar = (c: string) => {
  if (filled.length >= (question?.blanks.length ?? 0)) return;
  const next = [...filled, c];
  setFilled(next);
  // 答完所有空位时不立即判定（Task 9 处理）
};
const handleUndo = () => setFilled(filled.slice(0, -1));
```

Replace the input placeholder JSX:

```tsx
{nineGrid && (
  <NineGrid
    chars={nineGrid.chars}
    blankCount={nineGrid.blankCount}
    filled={filled}
    onChar={handleChar}
    onUndo={handleUndo}
  />
)}
```

Add `buildNineGrid` to the engine import:

```typescript
import { getVersesFor, pickStageQuestion, buildNineGrid } from '../play/engine';
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Manual check**

Run: `npm run dev` → 进春关 → 看到题目、挖空、12 字块、退字按钮。点击字块能填入，退字能撤销。

- [ ] **Step 5: Commit**

```bash
git add src/components/NineGrid.tsx src/pages/StagePlay.tsx
git commit -m "feat(feihua): add NineGrid input component wired into StagePlay"
```

---

## Task 9: 判定 + 血量 + 倒计时 + 通关

**Files:**
- Modify: `src/pages/StagePlay.tsx`

**Interfaces:**
- Consumes:
  - `validateStageInput`, `pickStageQuestion` from `engine`
  - `commitStageCorrect`, `commitStageBlood`, `markCleared`, `clearCurrent` from `progress`
  - `STAGE_GOAL`, `STAGE_BLOOD`, `STAGE_TIMEBOX` from `types`

- [ ] **Step 1: Add countdown + judgment logic**

In `src/pages/StagePlay.tsx`:

1. Add countdown state:
```typescript
const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);

useEffect(() => {
  if (secondsLeft <= 0) {
    // 超时：扣血
    handleWrong();
    return;
  }
  const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
  return () => clearTimeout(t);
}, [secondsLeft]);
```

2. Add judgment when filled complete:
```typescript
useEffect(() => {
  if (!question || filled.length !== question.blanks.length) return;
  const ok = validateStageInput(filled.join(''), question.verse.line, question.blanks);
  if (ok) handleCorrect();
  else handleWrong();
}, [filled, question]);
```

3. Implement handlers:
```typescript
const handleCorrect = () => {
  if (!kw || !question) return;
  const newCorrect = [...stage.correct, question.verse.line];
  commitStageCorrect(kw, question.verse.line);

  if (newCorrect.length >= STAGE_GOAL) {
    // 通关
    markCleared(kw);
    setResult({ kind: 'cleared', correct: newCorrect });
    return;
  }
  // 下一题（1 秒庆祝动画，简化为 setTimeout）
  setTimeout(() => {
    const nextUsed = new Set(newCorrect);
    setQuestion(pickStageQuestion(kw, nextUsed));
    setSecondsLeft(STAGE_TIMEBOX);
  }, 800);
};

const handleWrong = () => {
  if (!kw || !question) return;
  const newBlood = stage.blood - 1;
  commitStageBlood(kw, newBlood);
  if (newBlood <= 0) {
    setResult({ kind: 'failed', correct: stage.correct });
    return;
  }
  // 错误反馈，1.5s 后清空 filled 重答（不换题）
  setTimeout(() => {
    setFilled([]);
    setSecondsLeft(STAGE_TIMEBOX);
  }, 1500);
};
```

4. Add result state:
```typescript
const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct: string[] } | null>(null);
```

5. Refresh `stage` from progress on each commit so blood/correct stay in sync:
```typescript
// 替换 const [stage] = ... 为：
const [stage, setStage] = useState(() => {
  if (!kw) return null;
  const progress = loadProgress();
  if (progress.current && progress.current.keyword === kw) return progress.current;
  return beginStage(kw);
});

// 在 handleCorrect / handleWrong 内部 commit 后刷新：
//   setStage(loadProgress().current);
```

Wrap the two commit handlers (after `commitStageCorrect` / `commitStageBlood`):
```typescript
setStage(loadProgress().current);
```

6. Render countdown next to blood:
```typescript
<div style={{ color: '#000', fontFamily: fontFamilies.chinese, fontSize: 16 }}>
  ⏱ {secondsLeft}s
</div>
```

- [ ] **Step 2: Add result page (clear/fail modal)**

Append inside the PaperScroll, before closing tag:

```typescript
{result && (
  <div style={{
    position: 'absolute', inset: 0,
    background: 'rgba(245,235,210,0.95)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', padding: 40,
  }}>
    <div style={{
      fontFamily: fontFamilies.chinese, color: '#000',
      fontSize: 48, letterSpacing: 12, marginBottom: 24,
    }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
    <div style={{
      color: '#8b7355', fontFamily: fontFamilies.chinese,
      fontSize: 16, marginBottom: 32,
    }}>{result.kind === 'cleared' ? `已答出 ${result.correct.length} 句含「${kw}」的诗` : '血尽于此，下次再来'}</div>
    <div style={{ display: 'flex', gap: 16 }}>
      <button onClick={() => navigate('/play')} style={btnStyle}>返回大厅</button>
      {result.kind === 'cleared' && (
        <button onClick={() => navigate(`/play/stage/${KEYWORDS[KEYWORDS.indexOf(kw) + 1]}`)} style={btnStyle}>下一关</button>
      )}
    </div>
  </div>
)}
```

Add at the bottom of file (before final closing brace):
```typescript
const btnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'transparent',
  color: '#000',
  border: '1px solid #000',
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};
```

Add KEYWORDS to imports: `import { KEYWORDS } from '../play/keywords';`

- [ ] **Step 3: Run tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Manual check**

Run: `npm run dev` → 春关 → 答对 5 句 → 通关页 → 返回大厅（春关 cleared，月关 unlocked）。
重启 → 故意答错 3 次 → 失败页 → 返回大厅（春关未 cleared）。

- [ ] **Step 5: Commit**

```bash
git add src/pages/StagePlay.tsx
git commit -m "feat(feihua): complete stage loop with judgment, blood, countdown, results"
```

---

## Task 10: 断点续传

**Files:**
- Modify: `src/pages/StagePlay.tsx`

**Interfaces:**
- Consumes:
  - `loadProgress` / `clearCurrent` from `progress`

- [ ] **Step 1: Implement resume detection + manual exit clear**

In `src/pages/StagePlay.tsx`:

The `useState` initializer already resumes from `progress.current` (Task 7 step 2). What's missing:
- On unmount without clearing (user closes tab), `current` is preserved (already handled by commit functions).
- On Esc → return to hall WITHOUT clearing, so resume works next time.
- On "返回大厅" button in result page → `clearCurrent()` only if cleared or failed (otherwise keep).

Update the Esc handler and the back-link to NOT auto-clear (preserve for resume):

```typescript
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/play');
      // 不调用 clearCurrent —— 保留进度供下次续传
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [navigate]);
```

Update result page buttons:
- 失败页 → `clearCurrent()` then `navigate('/play')` (no resume from failed state — start fresh)
- 通关页 → `markCleared` already cleared `current`

```typescript
// 失败页「返回大厅」
<button onClick={() => { clearCurrent(); navigate('/play'); }} style={btnStyle}>返回大厅</button>
```

Add `clearCurrent` to imports: `import { ..., clearCurrent } from '../play/progress';`

- [ ] **Step 2: Manual check**

Run: `npm run dev` → 春关 → 答对 2 句 → 按 Esc → 大厅 → 重新点春 → 应该看到 `2 / 5` 进度（续传）。
失败页 → 返回大厅 → 重新点春 → 应该看到 `0 / 5`（清空）。

- [ ] **Step 3: Commit**

```bash
git add src/pages/StagePlay.tsx
git commit -m "feat(feihua): preserve progress on Esc exit, clear on failure"
```

---

## Task 11: 双源同步到 build-standalone.cjs

**Files:**
- Modify: `scripts/build-standalone.cjs`

**Note:** This task is mechanical translation of all the new TS/TSX files produced by Tasks 1-10 into JS template-literal blocks inlined in `build-standalone.cjs`. Source of truth for each block is the corresponding `src/...` file — read it, apply the rules below, paste as a `const xxxCode = \`...\`;` block.

**Translation rules (apply uniformly to every file):**
1. **Drop all TypeScript**: `interface`, `type Foo = ...`, `: T` annotations, `as T`, `<T>`, `?` on optional fields, `readonly`.
2. **Drop all imports**: `import { foo } from './bar'` lines deleted. Everything is in appSource scope.
3. **Drop `export`**: `export function foo()` → `function foo()`. `export const X` → `const X`.
4. **Drop React import**: `import { useState } from 'react'` — already destructured at top of appSource.
5. **Drop react-router-dom import**: use the existing mini-router's `Link` `useNavigate` `useParams` (already defined in `miniRouterCode`).
6. **Keep JSX verbatim**: Babel standalone (already in bootstrap) handles JSX.
7. **Keep `const` `let` `var` choices as written** in TS source.
8. **Numeric / string literals identical** — no reformatting.
9. **For `as const`**: drop the `as const`.
10. **For generic `Array<T>` / `Map<K,V>`**: drop generics, keep `new Map()` `new Array()` or `[]`.

**Files to translate (in this order — dependency-respecting):**

| Order | src file | new const name | depends on |
|------|----------|----------------|------------|
| 1 | `src/play/types.ts` | `feihuaTypesCode` | (none) |
| 2 | `src/play/keywords.ts` | `feihuaKeywordsCode` | (none) |
| 3 | `src/play/engine.ts` | `feihuaEngineCode` | types, keywords, getPoems, getPoet, extractVariants, getPoemMode, splitIntoLines |
| 4 | `src/play/progress.ts` | `feihuaProgressCode` | types, keywords |
| 5 | `src/components/KeywordSeal.tsx` | `keywordSealCode` | fontFamilies |
| 6 | `src/components/PaperScroll.tsx` | `paperScrollCode` | (none) |
| 7 | `src/components/NineGrid.tsx` | `nineGridCode` | fontFamilies |
| 8 | `src/pages/PlayHall.tsx` | `playHallCode` | TopNav, KeywordSeal, keywords, progress, theme |
| 9 | `src/pages/StagePlay.tsx` | `stagePlayCode` | TopNav, PaperScroll, NineGrid, engine, progress, types, keywords, theme |

- [ ] **Step 1: Translate play/types.ts**

Apply rules 1, 3, 9. The TS file has interface declarations (drop entirely) and `const` exports (keep as `var`). Result:

```javascript
const feihuaTypesCode = `
var STAGE_GOAL = 5;
var STAGE_BLOOD = 3;
var STAGE_TIMEBOX = 120;
var INITIAL_PROGRESS = { unlockedIndex: 0, cleared: [], current: null };
`;
```

(Interface bodies are dropped — they're compile-time only.)

- [ ] **Step 2: Translate play/keywords.ts**

Apply rules 1, 2, 3, 9. The `as const` on `KEYWORD_GROUPS` drops. The readonly modifiers on the const declarations drop.

```javascript
const feihuaKeywordsCode = `
var KEYWORD_GROUPS = {
  entry: ['春','月','花','风','山','水','云','天','人','心'],
  mid: ['夜','秋','年','日','雪','酒','梦','愁','思','江',
        '河','雨','柳','草','木','梅','竹','松','茶','楼'],
  advanced: ['菊','桃','燕','鸟','马','衣','书','剑','琴','笛',
             '钟','灯','影','台','城','海','舟','桥','鹤','霜'],
};
var KEYWORDS = [].concat(KEYWORD_GROUPS.entry, KEYWORD_GROUPS.mid, KEYWORD_GROUPS.advanced);
var FREE_KEYWORDS = ['春','月','花','风','雪'];
`;
```

- [ ] **Step 3: Translate play/engine.ts**

Read `src/play/engine.ts` (post-Task 3). Apply rules 1, 2, 3, 10. Note:
- `Map<string, Verse[]>` → `Map` (drop generics)
- `Verse` type import dropped
- `getPoems`, `getPoet`, `extractVariants`, `getPoemMode`, `splitIntoLines` are already global in appSource (no import needed)
- All TypeScript arrow function type annotations dropped
- `for...of` over arrays — works in JS; over `Map.entries()` use `.forEach` or convert to iterator pattern

Write the result as `const feihuaEngineCode = \`...full function bodies...\`;`. Each function body is copied verbatim from the TS source with type annotations stripped. The functions to translate are:
- `buildKeywordIndex()`
- `getKeywordIndex()`
- `getVersesFor(keyword)`
- `pickStageQuestion(keyword, used)`
- `buildNineGrid(answer, blanks)`
- `validateStageInput(filled, answer, blanks)`

Plus the module-level `const DISTRACTOR_POOL = '...'` becomes `var DISTRACTOR_POOL = '...';` and the `let _cache` becomes `var _cache`.

- [ ] **Step 4: Translate play/progress.ts**

Read `src/play/progress.ts`. Apply rules 1, 2, 3, 4 (no React here). Each function body is plain JS already — just strip types and the `FeihuaProgress` parameter type annotations. Functions to translate:
- `loadProgress()`
- `saveProgress(p)`
- `markCleared(keyword)`
- `beginStage(keyword)`
- `commitStageCorrect(keyword, line)`
- `commitStageBlood(keyword, blood)`
- `clearCurrent()`

Result: `const feihuaProgressCode = \`...\`;`

- [ ] **Step 5: Translate components/KeywordSeal.tsx**

Read `src/components/KeywordSeal.tsx`. Apply rules 1, 2, 3, 5, 6. Specifically:
- Drop `type SealState` declaration
- Drop `interface Props`
- Change `export function KeywordSeal({ keyword, state, onClick }: Props)` to `function KeywordSeal(props)` and add `var keyword = props.keyword; var state = props.state; var onClick = props.onClick;` as first three lines of body
- Change `const SEAL_COLORS: Record<SealState, ...>` to `var SEAL_COLORS = {...}` (drop type cast)
- JSX inside `return (...)` preserved verbatim
- Wrap the whole result in `const keywordSealCode = \`<translated code>\`;`

- [ ] **Step 6: Translate components/PaperScroll.tsx**

Read `src/components/PaperScroll.tsx`. Apply rules 1, 2, 3, 6. Specifically:
- Drop `import type { ReactNode } from 'react'`
- Drop `interface Props`
- Change `export function PaperScroll({ children }: Props)` to `function PaperScroll(props)` with `var children = props.children;` first
- Change `const PAPER_BG` to `var PAPER_BG`
- JSX preserved
- Wrap as `const paperScrollCode = \`<translated code>\`;`

- [ ] **Step 7: Translate components/NineGrid.tsx**

Read `src/components/NineGrid.tsx`. Apply rules 1, 2, 3, 5, 6. Specifically:
- Drop `interface Props`
- Change `export function NineGrid({ chars, blankCount, filled, onChar, onUndo }: Props)` to `function NineGrid(props)` with `var chars = props.chars; var blankCount = props.blankCount; ...` for each prop
- JSX preserved
- Wrap as `const nineGridCode = \`<translated code>\`;`

- [ ] **Step 8: Translate pages/PlayHall.tsx**

Read `src/pages/PlayHall.tsx`. Apply rules 1, 2, 3, 5, 6. Specifically:
- Drop all imports (Link is global from mini-router; TopNav, KeywordSeal, KEYWORDS, KEYWORD_GROUPS, loadProgress, colors, fontFamilies all global)
- Change `export function PlayHall()` to `function PlayHall()`
- All function body preserved verbatim (it's plain JSX)
- Wrap as `const playHallCode = \`<translated code>\`;`

- [ ] **Step 9: Translate pages/StagePlay.tsx**

Read `src/pages/StagePlay.tsx` (post-Task 10). Apply rules 1, 2, 3, 5, 6. Specifically:
- Drop all imports including `import type { Verse }`
- Drop `type Verse` annotations within useState calls
- Change `export function StagePlay()` to `function StagePlay()`
- All function body preserved verbatim
- Wrap as `const stagePlayCode = \`<translated code>\`;`

- [ ] **Step 10: Register new code in appSource**

Find the `const appSource = ...` block in `scripts/build-standalone.cjs` (around line 1926). It currently looks like:

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
${appCode}
`;
```

Insert the new code variables in dependency order, before `appCode`:

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
${keywordSealCode}
${paperScrollCode}
${nineGridCode}
${playHallCode}
${stagePlayCode}
${appCode}
`;
```

Also add the new `const feihuaTypesCode = \`...\`;` etc. declarations **earlier in the file** (before `const appSource = ...`), grouped with the other code-block declarations like `const topNavCode = \`...\`;`.

- [ ] **Step 11: Update App.tsx block (add 2 routes)**

In the `appCode` block (around line 1905), the App function currently is:

```javascript
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poems" element={<PoemsRiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
      </Routes>
    </HashRouter>
  );
}
```

Add the two play routes:

```javascript
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poems" element={<PoemsRiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
        <Route path="/play" element={<PlayHall />} />
        <Route path="/play/stage/:kw" element={<StagePlay />} />
      </Routes>
    </HashRouter>
  );
}
```

- [ ] **Step 12: Update TopNav block (RiverToggle)**

In the `topNavCode` block (around line 1006-1126), find the `RiverToggle` function. It currently has:

```javascript
{btn('/', '诗人', getPoets().length)}
{btn('/poems', '诗文', getPoems().length)}
```

And the `btn` helper:

```javascript
var btn = function(to, label, count) {
  var on = loc.pathname === to;
  var text = on ? label + '·' + count : label;
  // ...
};
```

Add the third button (count 0 means "no count suffix"):

```javascript
{btn('/', '诗人', getPoets().length)}
{btn('/poems', '诗文', getPoems().length)}
{btn('/play', '飞花令', 0)}
```

Update the `btn` helper to suppress count when it's 0:

```javascript
var btn = function(to, label, count) {
  var on = loc.pathname === to;
  var showCount = count > 0;
  var text = on && showCount ? label + '·' + count : label;
  // ... rest unchanged ...
};
```

- [ ] **Step 13: Build and verify**

Run: `node scripts/build-standalone.cjs`
Expected: `Wrote D:\claude\诗文长河\standalone.html (NNNNNN bytes)` — no errors.

If Babel parse errors appear, re-check JSX syntax in translated blocks (often caused by `style={{...}}` with type-cast leftovers).

Open `standalone.html` in browser → click 飞花令 tab → verify 50-seal grid renders → click 春 → verify stage page works → answer 5 correctly → verify cleared + unlock.

- [ ] **Step 14: Run all checks**

Run: `npx vitest run`
Expected: PASS (all tests, no regressions)

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add scripts/build-standalone.cjs
git commit -m "feat(feihua): sync stage mode to standalone build"
```

---

## 完成验收清单

After Task 11, manually verify:

- [ ] `npx tsc --noEmit` 无错
- [ ] `npx vitest run` 全通过（含新增 16+ 测试）
- [ ] `node scripts/build-standalone.cjs` 构建成功
- [ ] `npm run dev` 浏览器手动验收：
  - [ ] TopNav 第三 tab「飞花令」可点
  - [ ] 大厅 50 关印章网格分三档（10/20/20）
  - [ ] 春关默认 current（金边脉冲），其余 locked 显「？」
  - [ ] 点春关 → 进入关卡 → 看到关键字大字、血量、进度、挖空题
  - [ ] 九宫格 12 字块、填字、退字可工作
  - [ ] 答对：进度 +1，自动出下一题
  - [ ] 答错：扣 1 滴血，1.5s 后清空重答
  - [ ] 超时（120s）：扣 1 滴血
  - [ ] 答完 5 句：通关页 → 解锁下一关
  - [ ] 血量归零：失败页
  - [ ] 中途 Esc 返回大厅，重新进入 → 续传之前的 `2/5` 进度
  - [ ] 打开 `standalone.html` → 同样能跑（验证双源同步）
