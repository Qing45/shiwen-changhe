# 飞花令「整篇识名」模式 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在飞花令新增第三种模式「整篇 · 识名」：看诗正文（隐藏作者）选诗名，4 选项多选，多关卡递进解锁。

**Architecture:** 新增 `pickTitleQuestion` 出题引擎（`src/play/titles.ts`）和镜像 `sentenceProgress.ts` 的 `titleProgress` 模块（`src/play/titleProgress.ts`），再以 SentencePlay 为模板构造 `TitlePlay` 页面，最后在 PlayHall 加第三 tab + App.tsx 加新路由。每个 src 改动同步镜像到 `scripts/build-standalone.cjs`。

**Tech Stack:** React 18 + TS + Vite；Vitest 2 + jsdom；localStorage 进度持久化。

## Global Constraints

- **双源 mirror 约束**：每个新增 / 修改的 `src/*.ts(x)` 文件必须以字符串字面量同步到 `scripts/build-standalone.cjs`（项目既有约束）。所有任务验收时检查 mirror 一致性。
- **Corpus 类型边界**：`PoemCorpus = 'tang' | 'primary' | 'both'`（数据层）；`Corpus = 'tang' | 'primary' | 'all'`（state 层）；`'all' → 'both'` 在调用方映射。引擎签名接受 `PoemCorpus`，不接受 `'all'`。
- **进度 key 规则**：tang 沿用 `shiwen-feihua-title-progress`；其它 corpus 用 `:${corpus}` 后缀。**不**做 key 迁移。
- **关卡数**：tang/all 共 50 关（entry 1-10、mid 11-30、advanced 31-50）；primary 共 30 关（无 advanced 档）。
- **复用 `tierOfLevel`**：从 `src/play/couplets.ts` 直接 import，不复制实现。
- **不动 sentence/stage 既有逻辑**：所有改动只在新增文件 + PlayHall/App.tsx；不动 `couplets.ts` / `sentenceProgress.ts` / `engine.ts` / `SentencePlay.tsx`。
- **style 不变**：复用现有 `PaperScroll` 组件、stamp-drop / fadeUp keyframes（已在 standalone 中存在，不重复定义）。
- **测试**：Vitest 2 + RTL 16 + jsdom；新引擎 / 进度测试为 collocated `src/play/*.test.ts`；页面无 RTL 强制要求，靠人工验收。
- **中文注释**：保持现有风格，简洁。

---

### Task 1: 出题引擎 `pickTitleQuestion`

**Files:**
- Create: `src/play/titles.ts`
- Test: `src/play/titles.test.ts`
- Modify: `scripts/build-standalone.cjs`（新增 `feihuaTitlesCode` 并接入 `appSource`）

**Interfaces:**
- Consumes:
  - `getPoems(corpus: PoemCorpus)` from `../data/load`
  - `getPoemsByPoet(poetId: string)` from `../data/load`
  - `getPoet(poetId: string)` from `../data/load`
  - `extractVariants(content: string)` from `../utils/poemText`
- Produces:
  ```ts
  export interface TitleQuestion {
    poemId: string;
    content: string;          // 已去异文括号的诗正文
    poemTitle: string;        // 正确答案
    options: Array<{ id: string; title: string }>;  // 4 项（含正确答案，已洗牌）
  }

  export function pickTitleQuestion(
    level: number,
    usedPoemIds: ReadonlySet<string>,
    corpus: PoemCorpus,
  ): TitleQuestion | null;

  export function _setRng(rng: () => number): void;  // 测试用
  ```

- [ ] **Step 1: 写失败测试**

`src/play/titles.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { pickTitleQuestion, _setRng } from './titles';
import { getPoem } from '../data/load';

describe('pickTitleQuestion', () => {
  beforeEach(() => {
    _setRng(Math.random);
  });

  it('returns a question with 4 options including the correct answer', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'tang');
    expect(q).not.toBeNull();
    if (!q) return;

    expect(q.options.length).toBe(4);
    expect(q.options.map(o => o.title)).toContain(q.poemTitle);

    // 4 个选项的 title 各不相同
    const titles = q.options.map(o => o.title);
    expect(new Set(titles).size).toBe(4);
  });

  it('cleaned content has no parenthesized variant annotations', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'tang');
    if (!q) return;
    // extractVariants 已剥除 (X 一作：Y) 类括号，content 应不含全角圆括号
    expect(q.content).not.toMatch(/[（(]/);
  });

  it('returns null when every poem in corpus is already used', () => {
    // 构造一个覆盖整个候选池的 usedPoemIds
    const allIds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      _setRng(() => 0.5);
      const q = pickTitleQuestion(1, allIds, 'tang');
      if (!q) break;
      allIds.add(q.poemId);
    }
    const q = pickTitleQuestion(1, allIds, 'tang');
    expect(q).toBeNull();
  });

  it('excludes the correct poem from its own distractors', () => {
    _setRng(() => 0.5);
    for (let i = 0; i < 5; i++) {
      const q = pickTitleQuestion(1, new Set(), 'tang');
      if (!q) continue;
      const distractors = q.options.filter(o => o.id !== q.poemId);
      expect(distractors.length).toBe(3);
      for (const d of distractors) {
        expect(d.id).not.toBe(q.poemId);
      }
    }
  });

  it('同作者优先：distractors 中至少 1 个与正确答案同作者', () => {
    _setRng(() => 0.42);
    // 跑多次直到遇到作者有 ≥3 个其他诗的题
    let foundSameAuthor = false;
    for (let i = 0; i < 30; i++) {
      const q = pickTitleQuestion(1, new Set(), 'tang');
      if (!q) continue;
      const correctPoem = getPoem(q.poemId);
      if (!correctPoem) continue;
      const distractors = q.options.filter(o => o.id !== q.poemId);
      const sameAuthor = distractors.filter(d => {
        const dPoem = getPoem(d.id);
        return dPoem?.poetId === correctPoem.poetId;
      });
      if (sameAuthor.length > 0) {
        foundSameAuthor = true;
        break;
      }
    }
    expect(foundSameAuthor).toBe(true);
  });

  it('works for primary corpus', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'primary');
    expect(q).not.toBeNull();
    expect(q!.options.length).toBe(4);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/play/titles.test.ts`
Expected: FAIL — `pickTitleQuestion` 未定义。

- [ ] **Step 3: 实现引擎**

`src/play/titles.ts`：

```ts
// 飞花令 · 整篇识名模式出题引擎。
// 题目：诗正文（去异文括号）；选项：4 个诗名，1 正确 + 3 干扰。
// 干扰项优先选同作者其他诗名，不足 3 个则从候选池随机补足。
// 候选池来自 getPoems(corpus)（'all' → 'both' 在调用方映射）。

import { getPoems, getPoet, getPoemsByPoet } from '../data/load';
import { extractVariants } from '../utils/poemText';
import type { PoemCorpus } from '../types';

export interface TitleQuestion {
  poemId: string;
  content: string;
  poemTitle: string;
  options: Array<{ id: string; title: string }>;
}

let _rng: () => number = Math.random;

export function _setRng(rng: () => number): void {
  _rng = rng;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 候选池：必须有 content（极少数诗可能 content 为空）
function buildPool(corpus: PoemCorpus) {
  return getPoems(corpus).filter(p => p.content && p.content.length > 0);
}

export function pickTitleQuestion(
  level: number,
  usedPoemIds: ReadonlySet<string>,
  corpus: PoemCorpus,
): TitleQuestion | null {
  const pool = buildPool(corpus);
  if (pool.length === 0) return null;

  const candidates = pool.filter(p => !usedPoemIds.has(p.id));
  if (candidates.length === 0) return null;

  // 优先选作者有 ≥1 个其他诗的诗，保证同作者干扰能凑出。
  // 100 次尝试失败则降级为任意候选。
  let chosen = candidates[Math.floor(_rng() * candidates.length)];
  for (let i = 0; i < 100; i++) {
    const cand = candidates[Math.floor(_rng() * candidates.length)];
    const others = pool.filter(p => p.poetId === cand.poetId && p.id !== cand.id);
    if (others.length > 0) { chosen = cand; break; }
  }

  // 干扰项：先同作者其他诗名（去重、去自身），不足 3 则从池子随机补足
  const authorOthers = pool.filter(p => p.poetId === chosen.poetId && p.id !== chosen.id);
  const authorTitles = shuffle(authorOthers.map(p => ({ id: p.id, title: p.title })));

  const distractors: Array<{ id: string; title: string }> = [];
  const seenTitles = new Set<string>([chosen.title]);
  for (const t of authorTitles) {
    if (distractors.length >= 3) break;
    if (!seenTitles.has(t.title)) {
      distractors.push(t);
      seenTitles.add(t.title);
    }
  }
  if (distractors.length < 3) {
    const fallback = shuffle(pool.map(p => ({ id: p.id, title: p.title })));
    for (const t of fallback) {
      if (distractors.length >= 3) break;
      if (t.id === chosen.id) continue;
      if (seenTitles.has(t.title)) continue;
      distractors.push(t);
      seenTitles.add(t.title);
    }
  }
  if (distractors.length < 3) return null;

  const options = shuffle([
    { id: chosen.id, title: chosen.title },
    ...distractors,
  ]);

  const cleanText = extractVariants(chosen.content).cleanText;
  return {
    poemId: chosen.id,
    content: cleanText,
    poemTitle: chosen.title,
    options,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/play/titles.test.ts`
Expected: PASS（6/6）。

- [ ] **Step 5: 镜像到 standalone**

`scripts/build-standalone.cjs`，新增 `feihuaTitlesCode` 模板字面量。

定位：在 `feihuaCoupletsCode` 声明（`const feihuaCoupletsCode = ...` 附近）之后，新增：

```js
// play/titles.ts
const feihuaTitlesCode = \`
// ===== play/titles.ts =====
var _titleRng = Math.random;
function _setTitleRng(rng) { _titleRng = rng; }
function _titleShuffle(arr) {
  var a = [].concat(arr);
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(_titleRng() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
function _titleBuildPool(corpus) {
  return getPoems(corpus).filter(function (p) { return p.content && p.content.length > 0; });
}
function pickTitleQuestion(level, usedPoemIds, corpus) {
  var pool = _titleBuildPool(corpus);
  if (pool.length === 0) return null;
  var candidates = pool.filter(function (p) { return !usedPoemIds.has(p.id); });
  if (candidates.length === 0) return null;

  var chosen = candidates[Math.floor(_titleRng() * candidates.length)];
  for (var i = 0; i < 100; i++) {
    var cand = candidates[Math.floor(_titleRng() * candidates.length)];
    var others = pool.filter(function (p) { return p.poetId === cand.poetId && p.id !== cand.id; });
    if (others.length > 0) { chosen = cand; break; }
  }

  var authorOthers = pool.filter(function (p) { return p.poetId === chosen.poetId && p.id !== chosen.id; });
  var authorTitles = _titleShuffle(authorOthers.map(function (p) { return { id: p.id, title: p.title }; }));

  var distractors = [];
  var seenTitles = new Set([chosen.title]);
  for (var j = 0; j < authorTitles.length && distractors.length < 3; j++) {
    var t = authorTitles[j];
    if (!seenTitles.has(t.title)) {
      distractors.push(t);
      seenTitles.add(t.title);
    }
  }
  if (distractors.length < 3) {
    var fallback = _titleShuffle(pool.map(function (p) { return { id: p.id, title: p.title }; }));
    for (var k = 0; k < fallback.length && distractors.length < 3; k++) {
      var f = fallback[k];
      if (f.id === chosen.id) continue;
      if (seenTitles.has(f.title)) continue;
      distractors.push(f);
      seenTitles.add(f.title);
    }
  }
  if (distractors.length < 3) return null;

  var options = _titleShuffle([{ id: chosen.id, title: chosen.title }].concat(distractors));
  var cleanText = extractVariants(chosen.content).cleanText;
  return {
    poemId: chosen.id,
    content: cleanText,
    poemTitle: chosen.title,
    options: options,
  };
}
\`;
```

然后在 `appSource` 模板中按依赖顺序插入：在 `${poemTextCode}` 之后、`${feihuaTypesCode}` 之前，加入 `${feihuaTitlesCode}`。

- [ ] **Step 6: 重新 build + babel 校验**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: 生成成功，babel 校验通过。

- [ ] **Step 7: Commit**

```bash
git add src/play/titles.ts src/play/titles.test.ts scripts/build-standalone.cjs
git commit -m "feat(feihua): add title-recognition question engine"
```

---

### Task 2: 进度模块 `titleProgress`

**Files:**
- Create: `src/play/titleProgress.ts`
- Test: `src/play/titleProgress.test.ts`
- Modify: `scripts/build-standalone.cjs`（新增 `feihuaTitleProgressCode` 并接入 `appSource`）

**Interfaces:**
- Consumes:
  - `INITIAL_PROGRESS`, `STAGE_BLOOD`, `FeihuaProgress` from `./types`
  - `Corpus` from `../state/corpus`
- Produces: 7 函数（与 sentenceProgress 同形，命名加 `Title`）：
  ```ts
  export function loadTitleProgress(corpus: Corpus): FeihuaProgress;
  export function saveTitleProgress(p: FeihuaProgress, corpus: Corpus): void;
  export function markTitleCleared(keyword: string, corpus: Corpus): FeihuaProgress;
  export function beginTitleStage(keyword: string, corpus: Corpus): FeihuaProgress;
  export function commitTitleCorrect(keyword: string, line: string, corpus: Corpus): FeihuaProgress;
  export function commitTitleBlood(keyword: string, blood: number, corpus: Corpus): FeihuaProgress;
  export function clearTitleCurrent(corpus: Corpus): FeihuaProgress;
  ```

- [ ] **Step 1: 写失败测试**

`src/play/titleProgress.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTitleProgress, saveTitleProgress, markTitleCleared,
  beginTitleStage, commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
} from './titleProgress';
import { INITIAL_PROGRESS } from './types';

describe('title progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadTitleProgress returns INITIAL_PROGRESS when empty', () => {
    expect(loadTitleProgress('tang')).toEqual(INITIAL_PROGRESS);
  });

  it('saveTitleProgress round-trips', () => {
    const p = { ...INITIAL_PROGRESS, unlockedIndex: 5, cleared: ['3', '5'] };
    saveTitleProgress(p, 'tang');
    expect(loadTitleProgress('tang')).toEqual(p);
  });

  it('markTitleCleared appends level and bumps unlockedIndex', () => {
    saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0 }, 'tang');
    const p = markTitleCleared('5', 'tang');
    expect(p.cleared).toContain('5');
    expect(p.unlockedIndex).toBe(5);
    expect(p.current).toBeNull();
  });

  it('beginTitleStage sets current with full blood and empty correct', () => {
    const p = beginTitleStage('3', 'tang');
    expect(p.current).toEqual({ keyword: '3', correct: [], blood: 3 });
  });

  it('commitTitleCorrect appends line', () => {
    beginTitleStage('3', 'tang');
    const p = commitTitleCorrect('3', '床前明月光', 'tang');
    expect(p.current!.correct).toEqual(['床前明月光']);
  });

  it('commitTitleBlood updates blood only', () => {
    beginTitleStage('3', 'tang');
    const p = commitTitleBlood('3', 2, 'tang');
    expect(p.current!.blood).toBe(2);
  });

  it('clearTitleCurrent nulls current', () => {
    beginTitleStage('3', 'tang');
    const p = clearTitleCurrent('tang');
    expect(p.current).toBeNull();
  });

  it('tang 与 primary 进度互不串扰', () => {
    saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 7, cleared: ['5'] }, 'tang');
    expect(loadTitleProgress('primary')).toEqual(INITIAL_PROGRESS);
    expect(loadTitleProgress('tang').unlockedIndex).toBe(7);
  });

  it('survives localStorage being unavailable', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadTitleProgress('tang')).toEqual(INITIAL_PROGRESS);
    window.localStorage.getItem = orig;
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/play/titleProgress.test.ts`
Expected: FAIL — `loadTitleProgress` 未定义。

- [ ] **Step 3: 实现模块**

`src/play/titleProgress.ts`：

```ts
// 整篇识名模式进度持久化（独立 localStorage）。
// 与 sentenceProgress.ts 结构相同，storageKey 不同，三套进度互不影响（char/sentence/title）。
//
// 语料库分桶：
//   - tang 用旧 key（'shiwen-feihua-title-progress'），保留既有用户进度（首版创建，仍写 tang legacy）。
//   - primary / all 用 '${STORAGE_KEY}:${corpus}' 后缀 key。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import type { Corpus } from '../state/corpus';

const STORAGE_KEY = 'shiwen-feihua-title-progress';

function storageKey(corpus: Corpus): string {
  return corpus === 'tang' ? STORAGE_KEY : `${STORAGE_KEY}:${corpus}`;
}

export function loadTitleProgress(corpus: Corpus = 'tang'): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(corpus));
    if (!raw) return { ...INITIAL_PROGRESS, cleared: [] };
    const parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared)
        ? parsed.cleared.filter((s: unknown) => typeof s === 'string')
        : [],
      current:
        parsed.current && typeof parsed.current === 'object'
          ? {
              keyword: String(parsed.current.keyword ?? ''),
              correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
              blood: typeof parsed.current.blood === 'number' ? parsed.current.blood : STAGE_BLOOD,
            }
          : null,
    };
  } catch {
    return { ...INITIAL_PROGRESS, cleared: [] };
  }
}

export function saveTitleProgress(p: FeihuaProgress, corpus: Corpus = 'tang'): void {
  try {
    window.localStorage.setItem(storageKey(corpus), JSON.stringify(p));
  } catch {
    // 静默失败
  }
}

export function markTitleCleared(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadTitleProgress(corpus);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveTitleProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  const levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) {
    p.unlockedIndex = levelNum;
  }
  p.current = null;
  saveTitleProgress(p, corpus);
  return p;
}

export function beginTitleStage(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadTitleProgress(corpus);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveTitleProgress(p, corpus);
  return p;
}

export function commitTitleCorrect(keyword: string, line: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadTitleProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveTitleProgress(p, corpus);
  return p;
}

export function commitTitleBlood(keyword: string, blood: number, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadTitleProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveTitleProgress(p, corpus);
  return p;
}

export function clearTitleCurrent(corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadTitleProgress(corpus);
  p.current = null;
  saveTitleProgress(p, corpus);
  return p;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/play/titleProgress.test.ts`
Expected: PASS（9/9）。

- [ ] **Step 5: 镜像到 standalone**

`scripts/build-standalone.cjs`，新增 `feihuaTitleProgressCode` 模板字面量。定位：在 `feihuaSentenceProgressCode` 声明之后，新增：

```js
// play/titleProgress.ts
const feihuaTitleProgressCode = \`
// ===== play/titleProgress.ts =====
var TITLE_STORAGE_KEY = 'shiwen-feihua-title-progress';
function _titleStorageKey(corpus) {
  corpus = corpus || 'tang';
  return corpus === 'tang' ? TITLE_STORAGE_KEY : TITLE_STORAGE_KEY + ':' + corpus;
}
function loadTitleProgress(corpus) {
  corpus = corpus || 'tang';
  try {
    var raw = window.localStorage.getItem(_titleStorageKey(corpus));
    if (!raw) return { ...INITIAL_PROGRESS, cleared: [] };
    var parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared)
        ? parsed.cleared.filter(function (s) { return typeof s === 'string'; })
        : [],
      current: parsed.current && typeof parsed.current === 'object'
        ? {
            keyword: String(parsed.current.keyword != null ? parsed.current.keyword : ''),
            correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
            blood: typeof parsed.current.blood === 'number' ? parsed.current.blood : STAGE_BLOOD,
          }
        : null,
    };
  } catch (e) {
    return { ...INITIAL_PROGRESS, cleared: [] };
  }
}
function saveTitleProgress(p, corpus) {
  corpus = corpus || 'tang';
  try { window.localStorage.setItem(_titleStorageKey(corpus), JSON.stringify(p)); } catch (e) {}
}
function markTitleCleared(keyword, corpus) {
  corpus = corpus || 'tang';
  var p = loadTitleProgress(corpus);
  if (p.cleared.indexOf(keyword) >= 0) {
    p.current = null;
    saveTitleProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  var n = parseInt(keyword, 10);
  if (!Number.isNaN(n) && n > p.unlockedIndex) p.unlockedIndex = n;
  p.current = null;
  saveTitleProgress(p, corpus);
  return p;
}
function beginTitleStage(keyword, corpus) {
  corpus = corpus || 'tang';
  var p = loadTitleProgress(corpus);
  p.current = { keyword: keyword, correct: [], blood: STAGE_BLOOD };
  saveTitleProgress(p, corpus);
  return p;
}
function commitTitleCorrect(keyword, line, corpus) {
  corpus = corpus || 'tang';
  var p = loadTitleProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (p.current.correct.indexOf(line) < 0) p.current.correct.push(line);
  saveTitleProgress(p, corpus);
  return p;
}
function commitTitleBlood(keyword, blood, corpus) {
  corpus = corpus || 'tang';
  var p = loadTitleProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveTitleProgress(p, corpus);
  return p;
}
function clearTitleCurrent(corpus) {
  corpus = corpus || 'tang';
  var p = loadTitleProgress(corpus);
  p.current = null;
  saveTitleProgress(p, corpus);
  return p;
}
\`;
```

在 `appSource` 模板中：在 `${feihuaSentenceProgressCode}` 之后加入 `${feihuaTitleProgressCode}`。

- [ ] **Step 6: 重新 build + babel 校验**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: 生成成功，babel 校验通过。

- [ ] **Step 7: Commit**

```bash
git add src/play/titleProgress.ts src/play/titleProgress.test.ts scripts/build-standalone.cjs
git commit -m "feat(feihua): add title-mode progress persistence"
```

---

### Task 3: TitlePlay 页面

**Files:**
- Create: `src/pages/TitlePlay.tsx`
- Modify: `scripts/build-standalone.cjs`（新增 `titlePlayCode` 并接入 `appSource`）

**Interfaces:**
- Consumes:
  - `pickTitleQuestion(level, usedPoemIds, poemCorpus)` from `../play/titles`
  - `loadTitleProgress / markTitleCleared / beginTitleStage / commitTitleCorrect / commitTitleBlood / clearTitleCurrent` from `../play/titleProgress`
  - `useBreakpoint` from `../hooks/useBreakpoint`
  - `useCorpus / useSetCorpus` from `../state/corpus`
  - `colors / fontFamilies` from `../theme`
  - `splitIntoLines(content, mode)` from `../utils/poemText` — 用 `mode = 'short'` 即可，title 题面是单首诗词
  - `useParams / useNavigate / useLocation` from react-router-dom
  - `STAGE_BLOOD / STAGE_GOAL / STAGE_TIMEBOX` from `../play/types`
  - `TierName` 与 `tierOfLevel` from `../play/couplets`
  - `TopNav / PaperScroll` 组件
- Produces: `TitlePlay` 组件，被 `App.tsx` 路由 `/play/title/:level` 引用

- [ ] **Step 1: 创建文件**

`src/pages/TitlePlay.tsx`：

```tsx
// 飞花令 · 整篇识名模式。
// 题目展示诗正文（隐藏作者），4 个诗名选项多选。
// 多关卡递进解锁（30 / 50 关），血量 3 + 30s 倒计时。

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { pickTitleQuestion, type TitleQuestion } from '../play/titles';
import {
  loadTitleProgress, markTitleCleared, beginTitleStage,
  commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
} from '../play/titleProgress';
import { tierOfLevel } from '../play/couplets';
import { STAGE_BLOOD, STAGE_GOAL, STAGE_TIMEBOX } from '../play/types';
import { splitIntoLines } from '../utils/poemText';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus } from '../state/corpus';
import { colors, fontFamilies } from '../theme';
import type { Corpus } from '../state/corpus';

const PAPER_TEXT = '#000000';
const PAPER_TEXT_DIM = '#8b7355';
const PAPER_GREEN = '#4a7c4a';
const PAPER_RED = '#a8302a';

const TIER_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

const TITLE_TOTAL_LEVELS = 50;

const btnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: PAPER_TEXT,
  border: '1px solid ' + PAPER_TEXT,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

function toChineseNum(n: number): string {
  const digits = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return digits[n];
  if (n < 20) return '十' + digits[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + digits[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + digits[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + digits[n - 40];
  return String(n);
}

export function TitlePlay() {
  const params = useParams();
  const levelParam = params.level;
  const navigate = useNavigate();
  const level = parseInt(levelParam || '', 10);
  const validLevel = Number.isFinite(level) && level >= 1 && level <= TITLE_TOTAL_LEVELS;
  const tier = validLevel ? tierOfLevel(level) : 'entry';
  const levelKey = String(level);

  const corpus: Corpus = useCorpus();
  const poemCorpus = corpus === 'all' ? 'both' : corpus;

  const [stage, setStage] = useState(() => {
    if (!validLevel) return null;
    const progress = loadTitleProgress(corpus);
    if (progress.current && progress.current.keyword === levelKey) return progress.current;
    return beginTitleStage(levelKey, corpus).current;
  });

  const usedPoemIdsRef = useRef<Set<string>>(
    new Set(stage ? (stage.correct || []) : []),
  );

  const [question, setQuestion] = useState<TitleQuestion | null>(() => {
    if (!validLevel) return null;
    return pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus);
  });

  const [picked, setPicked] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct?: string[] } | null>(null);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  // 关卡切换时复位状态
  useEffect(() => {
    if (!validLevel) return;
    if (stageRef.current && stageRef.current.keyword === levelKey) return;
    const progress = loadTitleProgress(corpus);
    const fresh = progress.current && progress.current.keyword === levelKey
      ? progress.current
      : beginTitleStage(levelKey, corpus).current;
    setStage(fresh);
    usedPoemIdsRef.current = new Set(fresh ? (fresh.correct || []) : []);
    setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
    setPicked(null);
    setGrading(false);
    setSecondsLeft(STAGE_TIMEBOX);
    setResult(null);
  }, [levelKey]);

  // ESC 退出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function handleCorrect() {
    if (!validLevel || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const poemId = questionRef.current.poemId;
    const newCorrect = [...cur.correct, poemId];

    commitTitleCorrect(levelKey, poemId, corpus);
    setStage(loadTitleProgress(corpus).current);
    usedPoemIdsRef.current = new Set(newCorrect);

    if (newCorrect.length >= STAGE_GOAL) {
      markTitleCleared(levelKey, corpus);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  }

  function handleWrong() {
    if (!validLevel || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitTitleBlood(levelKey, newBlood, corpus);
    setStage(loadTitleProgress(corpus).current);

    if (newBlood <= 0) {
      clearTitleCurrent(corpus);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
  }

  // 倒计时
  useEffect(() => {
    if (result || grading) return;
    if (secondsLeft <= 0) { handleWrong(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result, grading]);

  function onPick(idx: number) {
    if (grading || picked !== null || !question) return;
    setPicked(idx);
    setGrading(true);
    const correct = question.options[idx].title === question.poemTitle;
    setTimeout(() => {
      if (correct) handleCorrect();
      else handleWrong();
    }, 500);
  }

  if (!validLevel || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关卡序号无效</div>;
  }

  const isLastLevel = level >= TITLE_TOTAL_LEVELS;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const lines = question ? splitIntoLines(question.content, 'short') : [];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← 返回大厅</Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
            <button
              onClick={() => navigate('/play')}
              style={{
                color: PAPER_TEXT,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 4,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >退 出</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
              fontSize: 24, letterSpacing: 8, marginBottom: 8,
            }}>第 {toChineseNum(level)} 关</div>
            <div style={{
              color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>{TIER_LABEL[tier]} · 整 篇 识 名</div>
          </div>

          {question ? (
            <>
              <div style={{
                padding: '24px 0 16px',
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: isMobile ? 20 : 26, letterSpacing: isMobile ? 3 : 6, lineHeight: 2.2,
                textAlign: 'center',
              }}>
                {lines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12, maxWidth: 560, margin: '0 auto',
              }}>
                {question.options.map((opt, idx) => {
                  const isPicked = picked === idx;
                  const isAnswer = opt.title === question.poemTitle;
                  let bg = '#f5ebd2';
                  let border = '1px solid ' + PAPER_TEXT_DIM;
                  let color = PAPER_TEXT;
                  if (grading && isAnswer) {
                    bg = PAPER_GREEN; border = '2px solid ' + PAPER_GREEN; color = '#f5ebd2';
                  } else if (grading && isPicked && !isAnswer) {
                    bg = PAPER_RED; border = '2px solid ' + PAPER_RED; color = '#f5ebd2';
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => onPick(idx)}
                      disabled={grading}
                      style={{
                        padding: '16px 12px',
                        background: bg,
                        border: border,
                        borderRadius: 4,
                        color: color,
                        fontFamily: fontFamilies.chinese,
                        fontSize: 18, letterSpacing: 3,
                        cursor: grading ? 'default' : 'pointer',
                        opacity: grading && !isPicked && !isAnswer ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >{opt.title}</button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center', padding: 40,
              fontFamily: fontFamilies.chinese, color: PAPER_TEXT_DIM, fontSize: 16,
            }}>题库已空</div>
          )}

          {result && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(245,235,210,0.97)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 40,
              animation: 'feihuaOverlayIn 260ms ease-out both',
            }}>
              <div style={{
                fontFamily: fontFamilies.chinese,
                color: result.kind === 'cleared' ? PAPER_RED : PAPER_TEXT,
                fontSize: 64, letterSpacing: 16, marginBottom: 24,
                textShadow: result.kind === 'cleared'
                  ? '0 0 32px rgba(168,48,42,0.35), 0 4px 12px rgba(0,0,0,0.08)'
                  : 'none',
                animation: result.kind === 'cleared'
                  ? 'feihuaStampDrop 650ms cubic-bezier(.34,1.56,.64,1) both'
                  : 'feihuaFadeUp 500ms ease-out both',
              }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
              {result.kind === 'cleared' && question && (
                <div style={{
                  color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                  fontSize: 16, marginBottom: 32,
                  animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                }}>
                  《{question.poemTitle}》
                </div>
              )}
              <div style={{
                display: 'flex', gap: 16,
                animation: 'feihuaFadeUp 400ms ease-out 420ms both',
              }}>
                <button
                  onClick={() => {
                    if (result.kind === 'failed') clearTitleCurrent(corpus);
                    navigate('/play');
                  }}
                  style={btnStyle}
                >返回大厅</button>
                {result.kind === 'cleared' && !isLastLevel && (
                  <button
                    onClick={() => navigate('/play/title/' + (level + 1))}
                    style={btnStyle}
                  >下一关</button>
                )}
                {result.kind === 'cleared' && isLastLevel && (
                  <div style={{
                    color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                    fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                  }}>全 部 通 关</div>
                )}
              </div>
            </div>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}

// 在文件顶部 import 区块补：Link 同 react-router-dom
// （实际写在 import 段顶部即可）
```

注意：上面的代码块在 `Link` 一处漏 import — 在文件顶部 import 段加：
```tsx
import { Link } from 'react-router-dom';
```

合并到 import 段顶部即可。

- [ ] **Step 2: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错。

- [ ] **Step 3: 镜像到 standalone**

`scripts/build-standalone.cjs`，新增 `titlePlayCode` 模板字面量。定位：在 `sentencePlayCode` 声明之后、`stagePlayCode` 之前，新增：

```js
// pages/TitlePlay.tsx
const titlePlayCode = \`
// ===== pages/TitlePlay.tsx =====
var TITLE_PAPER_TEXT = '#000000';
var TITLE_PAPER_TEXT_DIM = '#8b7355';
var TITLE_PAPER_GREEN = '#4a7c4a';
var TITLE_PAPER_RED = '#a8302a';
var TITLE_TOTAL_LEVELS = 50;
var TITLE_TIER_LABEL = { entry: '入 门', mid: '进 阶', advanced: '高 阶' };

var titleBtnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: TITLE_PAPER_TEXT,
  border: '1px solid ' + TITLE_PAPER_TEXT,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

function titleToChineseNum(n) {
  var digits = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return digits[n];
  if (n < 20) return '十' + digits[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + digits[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + digits[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + digits[n - 40];
  return String(n);
}

function TitlePlay() {
  var params = useParams();
  var levelParam = params.level;
  var navigate = useNavigate();
  var level = parseInt(levelParam || '', 10);
  var validLevel = Number.isFinite(level) && level >= 1 && level <= TITLE_TOTAL_LEVELS;
  var tier = validLevel ? tierOfLevel(level) : 'entry';
  var levelKey = String(level);

  var corpus = useCorpus();
  var poemCorpus = corpus === 'all' ? 'both' : corpus;

  var _stage0 = function () {
    if (!validLevel) return null;
    var progress = loadTitleProgress(corpus);
    if (progress.current && progress.current.keyword === levelKey) return progress.current;
    return beginTitleStage(levelKey, corpus).current;
  };
  var _q0 = function () {
    if (!validLevel) return null;
    var used = new Set(_stage0() ? (_stage0().correct || []) : []);
    return pickTitleQuestion(level, used, poemCorpus);
  };

  var stageState = useState(_stage0);
  var stage = stageState[0]; var setStage = stageState[1];

  var usedPoemIdsRef = useRef(new Set(stage ? (stage.correct || []) : []));

  var questionState = useState(_q0);
  var question = questionState[0]; var setQuestion = questionState[1];

  var pickedState = useState(null);
  var picked = pickedState[0]; var setPicked = pickedState[1];
  var gradingState = useState(false);
  var grading = gradingState[0]; var setGrading = gradingState[1];
  var secondsState = useState(STAGE_TIMEBOX);
  var secondsLeft = secondsState[0]; var setSecondsLeft = secondsState[1];
  var resultState = useState(null);
  var result = resultState[0]; var setResult = resultState[1];

  var stageRef = useRef(stage); stageRef.current = stage;
  var questionRef = useRef(question); questionRef.current = question;

  useEffect(function () {
    if (!validLevel) return;
    if (stageRef.current && stageRef.current.keyword === levelKey) return;
    var progress = loadTitleProgress(corpus);
    var fresh = progress.current && progress.current.keyword === levelKey
      ? progress.current
      : beginTitleStage(levelKey, corpus).current;
    setStage(fresh);
    usedPoemIdsRef.current = new Set(fresh ? (fresh.correct || []) : []);
    setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
    setPicked(null);
    setGrading(false);
    setSecondsLeft(STAGE_TIMEBOX);
    setResult(null);
  }, [levelKey]);

  useEffect(function () {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); navigate('/play'); }
    }
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, [navigate]);

  function handleCorrect() {
    if (!validLevel || !questionRef.current || !stageRef.current) return;
    var cur = stageRef.current;
    var poemId = questionRef.current.poemId;
    var newCorrect = [].concat(cur.correct, [poemId]);

    commitTitleCorrect(levelKey, poemId, corpus);
    setStage(loadTitleProgress(corpus).current);
    usedPoemIdsRef.current = new Set(newCorrect);

    if (newCorrect.length >= STAGE_GOAL) {
      markTitleCleared(levelKey, corpus);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(function () {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  }

  function handleWrong() {
    if (!validLevel || !stageRef.current) return;
    var cur = stageRef.current;
    var newBlood = cur.blood - 1;

    commitTitleBlood(levelKey, newBlood, corpus);
    setStage(loadTitleProgress(corpus).current);

    if (newBlood <= 0) {
      clearTitleCurrent(corpus);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(function () {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
  }

  useEffect(function () {
    if (result || grading) return;
    if (secondsLeft <= 0) { handleWrong(); return; }
    var t = setTimeout(function () { setSecondsLeft(function (s) { return s - 1; }); }, 1000);
    return function () { clearTimeout(t); };
  }, [secondsLeft, result, grading]);

  function onPick(idx) {
    if (grading || picked !== null || !question) return;
    setPicked(idx);
    setGrading(true);
    var correct = question.options[idx].title === question.poemTitle;
    setTimeout(function () {
      if (correct) handleCorrect();
      else handleWrong();
    }, 500);
  }

  if (!validLevel || !stage) {
    return React.createElement('div', { style: { padding: 40, color: colors.textPrimary } }, '关卡序号无效');
  }

  var isLastLevel = level >= TITLE_TOTAL_LEVELS;
  var bp = useBreakpoint();
  var isMobile = bp === 'mobile';
  var lines = question ? splitIntoLines(question.content, 'short') : [];

  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(TopNav, { variant: 'main' }),
    React.createElement('div', {
      style: { flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' },
    },
      React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement(Link, { to: '/play', style: { color: colors.textTertiary, fontSize: 14, textDecoration: 'none' } }, '← 返回大厅')
      ),
      React.createElement(PaperScroll, null,
        React.createElement('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
        },
          React.createElement('div', {
            style: { color: TITLE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 },
          }, '❤'.repeat(stage.blood) + '♡'.repeat(STAGE_BLOOD - stage.blood)),
          React.createElement('div', {
            style: { color: TITLE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 },
          }, '⏱ ' + secondsLeft + 's'),
          React.createElement('div', {
            style: { color: TITLE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 },
          }, stage.correct.length + ' / ' + STAGE_GOAL),
          React.createElement('button', {
            onClick: function () { navigate('/play'); },
            style: {
              color: TITLE_PAPER_TEXT, fontFamily: fontFamilies.chinese,
              fontSize: 14, fontWeight: 700, letterSpacing: 4,
              padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
            },
          }, '退 出')
        ),
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 24 } },
          React.createElement('div', {
            style: {
              fontFamily: fontFamilies.chinese, color: TITLE_PAPER_TEXT,
              fontSize: 24, letterSpacing: 8, marginBottom: 8,
            },
          }, '第 ' + titleToChineseNum(level) + ' 关'),
          React.createElement('div', {
            style: {
              color: TITLE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            },
          }, TITLE_TIER_LABEL[tier] + ' · 整 篇 识 名')
        ),
        question ? React.createElement(React.Fragment, null,
          React.createElement('div', {
            style: {
              padding: '24px 0 16px',
              fontFamily: fontFamilies.chinese, color: TITLE_PAPER_TEXT,
              fontSize: isMobile ? 20 : 26, letterSpacing: isMobile ? 3 : 6, lineHeight: 2.2,
              textAlign: 'center',
            },
          }, lines.map(function (line, i) {
            return React.createElement('div', { key: i }, line);
          })),
          React.createElement('div', {
            style: {
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12, maxWidth: 560, margin: '0 auto',
            },
          }, question.options.map(function (opt, idx) {
            var isPicked = picked === idx;
            var isAnswer = opt.title === question.poemTitle;
            var bg = '#f5ebd2';
            var border = '1px solid ' + TITLE_PAPER_TEXT_DIM;
            var color = TITLE_PAPER_TEXT;
            if (grading && isAnswer) {
              bg = TITLE_PAPER_GREEN; border = '2px solid ' + TITLE_PAPER_GREEN; color = '#f5ebd2';
            } else if (grading && isPicked && !isAnswer) {
              bg = TITLE_PAPER_RED; border = '2px solid ' + TITLE_PAPER_RED; color = '#f5ebd2';
            }
            return React.createElement('button', {
              key: idx,
              onClick: function () { onPick(idx); },
              disabled: grading,
              style: {
                padding: '16px 12px', background: bg, border: border, borderRadius: 4, color: color,
                fontFamily: fontFamilies.chinese, fontSize: 18, letterSpacing: 3,
                cursor: grading ? 'default' : 'pointer',
                opacity: grading && !isPicked && !isAnswer ? 0.5 : 1,
                transition: 'all 0.15s',
              },
            }, opt.title);
          }))
        ) : React.createElement('div', {
          style: {
            textAlign: 'center', padding: 40,
            fontFamily: fontFamilies.chinese, color: TITLE_PAPER_TEXT_DIM, fontSize: 16,
          },
        }, '题库已空'),
        result ? React.createElement('div', {
          style: {
            position: 'absolute', inset: 0,
            background: 'rgba(245,235,210,0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', padding: 40,
            animation: 'feihuaOverlayIn 260ms ease-out both',
          },
        },
          React.createElement('div', {
            style: {
              fontFamily: fontFamilies.chinese,
              color: result.kind === 'cleared' ? TITLE_PAPER_RED : TITLE_PAPER_TEXT,
              fontSize: 64, letterSpacing: 16, marginBottom: 24,
              textShadow: result.kind === 'cleared'
                ? '0 0 32px rgba(168,48,42,0.35), 0 4px 12px rgba(0,0,0,0.08)'
                : 'none',
              animation: result.kind === 'cleared'
                ? 'feihuaStampDrop 650ms cubic-bezier(.34,1.56,.64,1) both'
                : 'feihuaFadeUp 500ms ease-out both',
            },
          }, result.kind === 'cleared' ? '通 关' : '失 败'),
          result.kind === 'cleared' && question ? React.createElement('div', {
            style: {
              color: TITLE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 16, marginBottom: 32,
              animation: 'feihuaFadeUp 400ms ease-out 240ms both',
            },
          }, '《' + question.poemTitle + '》') : null,
          React.createElement('div', {
            style: { display: 'flex', gap: 16, animation: 'feihuaFadeUp 400ms ease-out 420ms both' },
          },
            React.createElement('button', {
              onClick: function () {
                if (result.kind === 'failed') clearTitleCurrent(corpus);
                navigate('/play');
              },
              style: titleBtnStyle,
            }, '返回大厅'),
            result.kind === 'cleared' && !isLastLevel
              ? React.createElement('button', {
                  onClick: function () { navigate('/play/title/' + (level + 1)); },
                  style: titleBtnStyle,
                }, '下一关')
              : null,
            result.kind === 'cleared' && isLastLevel
              ? React.createElement('div', {
                  style: {
                    color: TITLE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                    fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                  },
                }, '全 部 通 关')
              : null
          )
        ) : null
      )
    )
  );
}
\`;
```

在 `appSource` 模板中：在 `${sentencePlayCode}` 之后加入 `${titlePlayCode}`。

- [ ] **Step 4: 重新 build + babel 校验**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: 生成成功，babel 校验通过。

- [ ] **Step 5: Commit**

```bash
git add src/pages/TitlePlay.tsx scripts/build-standalone.cjs
git commit -m "feat(feihua): add TitlePlay page"
```

---

### Task 4: PlayHall tab 集成 + App.tsx 路由 + 镜像

**Files:**
- Modify: `src/pages/PlayHall.tsx`（加第三 tab + 新增 `TitleModeBody`）
- Modify: `src/App.tsx`（加新路由）
- Modify: `scripts/build-standalone.cjs`（镜像 PlayHall + appCode 改动）

**Interfaces:**
- Consumes:
  - `loadTitleProgress` from `../play/titleProgress`
  - `TitlePlay` from `../pages/TitlePlay`（App.tsx 用）
- Produces: PlayHall 多一 tab（`mode === 'title'` 时渲染 `TitleModeBody`）；App 多一路由

- [ ] **Step 1: 改 `src/pages/PlayHall.tsx`**

具体改动如下：

**(a) imports 加 `loadTitleProgress`：**

```ts
import { loadTitleProgress } from '../play/titleProgress';
```

**(b) `PlayHall` 函数体加 title 进度加载（紧跟现有 sentenceProgress 之后）：**

```ts
  const titleProgress = loadTitleProgress(corpus);
```

**(c) `Mode` 类型扩展为 `'char' | 'sentence' | 'title'`，新增 `totalTitleStages` 与 title 文案：**

```ts
type Mode = 'char' | 'sentence' | 'title';
// ...
const totalTitleStages = isPrimary ? 30 : 50;
```

标题文字块新增 title 分支（在现有 sentence 分支后）：
```tsx
{mode === 'title'
  ? `整 篇 · 识 名 模 式 · 已通 ${titleProgress.cleared.length} / ${totalTitleStages} 关`
  : ...}
```

**(d) tab 区加第三按钮：**

```tsx
<ModeTabButton label="整篇 · 识名" active={mode === 'title'} onClick={() => setMode('title')} compact={isMobile} />
```

**(e) 渲染分支加 title case：**

```tsx
{mode === 'char' ? (
  <CharModeBody progress={charProgress} compact={isMobile} groups={charGroups} charKeywords={charKeywords} />
) : mode === 'sentence' ? (
  <SentenceModeBody progress={sentenceProgress} compact={isMobile} isPrimary={isPrimary} />
) : (
  <TitleModeBody progress={titleProgress} compact={isMobile} isPrimary={isPrimary} />
)}
```

**(f) 文件底部新增 `TitleModeBody` 组件（紧跟 `SentenceModeBody` 之后，结构相同，仅 linkTo 改为 `/play/title/`）：**

```tsx
function TitleModeBody({ progress, compact, isPrimary }: {
  progress: ReturnType<typeof loadTitleProgress>;
  compact: boolean;
  isPrimary: boolean;
}) {
  const stateOf = (level: number): 'cleared' | 'current' | 'locked' => {
    const key = String(level);
    if (progress.cleared.includes(key)) return 'cleared';
    if (level - 1 === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  // corpus-aware: primary has no advanced tier
  const levelGroups = isPrimary
    ? LEVEL_GROUPS.filter(g => g.tier !== 'advanced')
    : LEVEL_GROUPS;

  return (
    <>
      {levelGroups.map(({ tier, range }) => {
        const levels: number[] = [];
        for (let i = range[0]; i <= range[1]; i++) levels.push(i);
        return (
          <div key={tier} style={{ marginBottom: compact ? 24 : 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[tier]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact
                ? 'repeat(auto-fill, minmax(52px, 1fr))'
                : 'repeat(10, 64px)',
              gap: compact ? 8 : 12, justifyContent: 'center',
              maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
            }}>
              {levels.map((lv) => {
                const state = stateOf(lv);
                return (
                  <Link key={lv} to={state === 'locked' ? '#' : `/play/title/${lv}`}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={toChineseNum(lv)} state={state} compact={compact} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: 改 `src/App.tsx`**

在 import 段加：
```ts
import { TitlePlay } from './pages/TitlePlay';
```

在 `<Routes>` 内加（紧跟 sentence route 之后）：
```tsx
<Route path="/play/title/:level" element={<TitlePlay />} />
```

- [ ] **Step 3: TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错。

- [ ] **Step 4: 镜像到 standalone**

`scripts/build-standalone.cjs`，改两处：

**`playHallCode` 模板字面量**：在现有 PlayHall 模板内做对应的 JS 改造（加 title tab、`TitleModeBody` 组件）。具体改动：

1. 在 `var charProgress = loadProgress(corpus);` 之后加 `var titleProgress = loadTitleProgress(corpus);`
2. 在 `var totalCharStages = charKeywords.length;` 之后加 `var totalTitleStages = isPrimary ? 30 : 50;`
3. tab 区段加第三按钮：`<button ...onClick="function () { setMode('title'); }" ...>整篇 · 识名</button>`（参考现有 tab 结构）
4. 渲染分支三元改写：`mode === 'char' ? <CharModeBody ... /> : (mode === 'sentence' ? <SentenceModeBody ... /> : <TitleModeBody ... />)`
5. 标题文案三元加 title 分支
6. 文件末尾追加 `TitleModeBody` 组件函数（与 sentence 几乎相同，唯一区别是 `to: '/play/title/' + lv`）

**`appCode` 模板字面量**：在 `<Routes>` 内 `<Route path="/play/sentence/:level" element={<SentencePlay />} />` 后加 `<Route path="/play/title/:level" element={<TitlePlay />} />`。

- [ ] **Step 5: 重新 build + babel 校验**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: 生成成功，babel 校验通过。

- [ ] **Step 6: 全量测试**

Run: `npm test`
Expected: 在现有 163 基础上净增（titles 6 + titleProgress 9 = 15），全部 PASS（178/178）。

- [ ] **Step 7: 人工验收**

`npm run dev` 启动后：
- [ ] `/play` 顶 tab 区显示三个 tab：「单字 · 拾字」「整句 · 联句」「整篇 · 识名」
- [ ] 切到「唐诗三百首」诗库 + 「整篇 · 识名」tab：显示 50 关（3 档 10/20/20）
- [ ] 切到「小学必背」：显示 30 关（2 档 10/20，无高阶）
- [ ] 进 `/play/title/1`：题目展示诗正文（**无作者**）+ 4 个诗名按钮
- [ ] 点正确选项 → 「通 关」stamp-drop 动画 + 显示《正确答案》
- [ ] 点错误选项 → 扣 1 血；血归零 → 「失 败」
- [ ] 通关后回大厅，下一关印章状态从「current」→「cleared」
- [ ] 切诗库进度独立保留（tang / primary 互不串扰）
- [ ] 退出按钮 / ESC 行为正常

- [ ] **Step 8: Commit**

```bash
git add src/pages/PlayHall.tsx src/App.tsx scripts/build-standalone.cjs
git commit -m "feat(feihua): integrate title mode into PlayHall + routing"
```

---

## Self-Review

对照 spec 检查：

| spec 段 | 覆盖任务 |
|---|---|
| 玩法规则（4 选项、隐藏作者、优先同作者） | T1 引擎 + T3 页面 |
| 关卡结构（30/50、tang/all 三档、primary 两档） | T4 大厅 |
| 出题引擎接口 | T1 |
| 进度模块接口 | T2 |
| TitlePlay 复用模式（无查看原文按钮） | T3 |
| 大厅第三 tab + TitleModeBody 平行 | T4 |
| 路由挂载 | T4 |
| 双源 mirror | T1-T4 每步都有 |
| 测试 | T1 (6) + T2 (9) + T3 (人工) + T4 (人工) |
| 风险缓解（同作者不足、关卡穷尽、mirror） | T1 100 次重试 fallback + 返回 null |

**Type consistency check**：
- T1: `pickTitleQuestion(level, usedPoemIds, corpus: PoemCorpus)` 与 T3 引用一致 ✓
- T1: `TitleQuestion.options` 是 `{id, title}[]`，T3 渲染用 `opt.title` 与 `opt.id` 一致 ✓
- T2: 7 函数命名 `loadTitleProgress / saveTitleProgress / markTitleCleared / beginTitleStage / commitTitleCorrect / commitTitleBlood / clearTitleCurrent`，T3 全部 import 使用 ✓
- T4: `TitleModeBody` 接受 `progress: ReturnType<typeof loadTitleProgress>`，与 T2 一致 ✓

无 placeholder 残留。