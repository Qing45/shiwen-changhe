# 总库切换选项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third corpus switcher option「总库」that shows all 341 poems across 唐诗三百首 + 小学必背 as a unified view.

**Architecture:** Extend state-layer `Corpus` type with `'all'`; map `'all' → 'both'` at data-layer boundaries (PoemCorpus already has 'both'); reuse existing 50-char KEYWORDS for 飞花令 in all-mode; progress persisted under suffixed key `:all`.

**Tech Stack:** React + TypeScript + Vite + Vitest + @testing-library/react.

## Global Constraints

- **Type discipline:** `Corpus = 'tang' | 'primary' | 'all'` (state layer); `PoemCorpus = 'tang' | 'primary' | 'both'` (data layer, UNCHANGED).
- **Boundary mapping:** At every `getPoems(corpus)` / `getPoets(corpus)` / `buildKeywordIndex(corpus)` call site where `corpus` is the state-layer `Corpus`, map `'all' → 'both'` inline as `corpus === 'all' ? 'both' : corpus`. Do NOT introduce a helper function.
- **Default corpus:** `'tang'` (unchanged — existing users see no behavior change).
- **Back-compat:** Trailing optional `corpus: Corpus = 'tang'` preserved on all engine/couplets/progress functions.
- **Storage keys:** `shiwen-feihua-progress:all` / `shiwen-feihua-sentence-progress:all` (suffixed form, naturally produced by existing `storageKey(corpus)` logic).
- **No scope creep:** Don't fix PoemsRiverPage timeline 618–907 hardcode; don't introduce new keyword lists; don't merge storage across corpora.
- **Standalone mirror:** Every src/ change mirrored to `scripts/build-standalone.cjs` template strings. `npm run build:standalone && npm run verify:standalone` after each task.
- **Test discipline:** Vitest + @testing-library/react. MemoryRouter + CorpusProvider wrapping pattern. Real poem ids from `src/data/poems.json`, not placeholders.
- **No comments** beyond minimal `// corpus='all' → 数据层 'both'` lines where the mapping is non-obvious.

---

### Task 1: State + CorpusProvider accept 'all'

**Files:**
- Modify: `src/state/corpus.tsx`
- Create: `tests/corpus-all.test.tsx` (initial subset — Task 4 expands)
- Modify: `scripts/build-standalone.cjs`

**Interfaces:**
- Consumes: existing `CorpusProvider` / `useCorpus` / `useSetCorpus`
- Produces: `Corpus = 'tang' | 'primary' | 'all'`; localStorage accepts `'all'`

- [ ] **Step 1: Write the failing test**

Create `tests/corpus-all.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { CorpusProvider, useCorpus, useSetCorpus } from '../src/state/corpus';

beforeEach(() => {
  localStorage.clear();
});

describe('Corpus type includes "all"', () => {
  it('reads "all" from localStorage on mount', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    const { result } = renderHook(() => useCorpus(), {
      wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider>,
    });
    expect(result.current).toBe('all');
  });

  it('useSetCorpus("all") writes "all" to localStorage', () => {
    const { result } = renderHook(
      () => {
        const corpus = useCorpus();
        const setCorpus = useSetCorpus();
        return { corpus, setCorpus };
      },
      { wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider> }
    );
    result.current.setCorpus('all');
    expect(localStorage.getItem('feihuaCorpus')).toBe('all');
  });

  it('defaults to "tang" when localStorage empty', () => {
    const { result } = renderHook(() => useCorpus(), {
      wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider>,
    });
    expect(result.current).toBe('tang');
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `npm test -- tests/corpus-all.test.tsx`
Expected: FAIL on test 1 (current `useState` initializer only accepts `'primary' | 'tang'`).

- [ ] **Step 3: Modify `src/state/corpus.tsx`**

Replace line 3:
```tsx
// BEFORE
export type Corpus = 'tang' | 'primary';

// AFTER
export type Corpus = 'tang' | 'primary' | 'all';
```

Replace the `useState` initializer (line 14-18):
```tsx
const [corpus, setCorpusState] = useState<Corpus>(() => {
  if (typeof localStorage === 'undefined') return 'tang';
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === 'primary' || v === 'all') return v;
  return 'tang';
});
```

Replace the `storage` event handler (line 22-28):
```tsx
const onStorage = (e: StorageEvent) => {
  if (e.key !== STORAGE_KEY) return;
  if (e.newValue === 'primary' || e.newValue === 'all') {
    setCorpusState(e.newValue);
  } else if (e.newValue === null || e.newValue === 'tang') {
    setCorpusState('tang');
  }
};
```

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- tests/corpus-all.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 5: Run full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: All existing tests pass + 3 new = total +3. tsc will likely show errors at sites that switch exhaustively over `Corpus` (e.g., `corpus === 'tang' ? X : Y` — TypeScript doesn't care since the conditional is still valid). But any `switch(corpus)` with only 2 cases may now be incomplete. **Look at tsc output carefully — do not fix in this task** unless the error is in `src/state/corpus.tsx` itself. Defer cross-file exhaustiveness to Task 3 / Task 4 where those files are touched.

- [ ] **Step 6: Mirror to `scripts/build-standalone.cjs`**

Find `corpusCode` template string. Apply the same changes:
- Type comment if present (standalone is plain JS — no TS types)
- Initializer accepts `'all'`
- Storage event handler accepts `'all'`

- [ ] **Step 7: Regenerate standalone**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: Build succeeds. Babel verify OK.

- [ ] **Step 8: Commit**

```bash
git add src/state/corpus.tsx tests/corpus-all.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): Corpus type accepts 'all' in CorpusProvider + localStorage"
```

---

### Task 2: CorpusSwitcher 3 segments

**Files:**
- Modify: `src/components/CorpusSwitcher.tsx`
- Modify: `tests/corpus-switcher.test.tsx` (existing — add 'all' cases)
- Modify: `scripts/build-standalone.cjs`

**Interfaces:**
- Consumes: Task 1's `Corpus` type with `'all'`
- Produces: 3-segment switcher; mobile labels「唐诗」/「小学」/「总库」

- [ ] **Step 1: Add failing test cases to existing `tests/corpus-switcher.test.tsx`**

Append:
```tsx
it('renders 3rd segment for "all" labeled 总库', () => {
  localStorage.setItem('feihuaCorpus', 'all');
  render(
    <MemoryRouter>
      <CorpusProvider>
        <CorpusSwitcher />
      </CorpusProvider>
    </MemoryRouter>
  );
  expect(screen.getByTestId('corpus-all')).toBeTruthy();
  expect(screen.getByTestId('corpus-all').textContent).toContain('总库');
});

it('clicking 总库 segment switches corpus to "all"', () => {
  render(
    <MemoryRouter>
      <CorpusProvider>
        <CorpusSwitcher />
      </CorpusProvider>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByTestId('corpus-all'));
  expect(localStorage.getItem('feihuaCorpus')).toBe('all');
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `npm test -- tests/corpus-switcher.test.tsx`
Expected: FAIL — `corpus-all` testid doesn't exist.

- [ ] **Step 3: Modify `src/components/CorpusSwitcher.tsx`**

After the existing `<button>` for `primary` (before the closing `</div>`), insert:

```tsx
<button
  type="button"
  role="tab"
  aria-selected={corpus === 'all'}
  onClick={() => onSwitch('all')}
  style={corpus === 'all' ? activeStyle : inactiveStyle}
  data-testid="corpus-all"
>{isMobile ? '总库' : '总  库'}</button>
```

> Note: 桌面版「总  库」用双空格平衡三段视觉宽度（与其他两段「唐诗三百首」5字 / 「小学必背」4字视觉对比）。Mobile 一致单字「总库」。

- [ ] **Step 4: Run test, confirm pass**

Run: `npm test -- tests/corpus-switcher.test.tsx`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Run full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: All pass.

- [ ] **Step 6: Mirror to `scripts/build-standalone.cjs`**

Find `corpusSwitcherCode` template string. Add the same 3rd `<button>` block.

- [ ] **Step 7: Regenerate standalone + verify**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 8: Commit**

```bash
git add src/components/CorpusSwitcher.tsx tests/corpus-switcher.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): CorpusSwitcher 3rd segment 总库"
```

---

### Task 3: 4 pages handle corpus='all'

**Files:**
- Modify: `src/pages/PoemsRiverPage.tsx`
- Modify: `src/pages/PoetPage.tsx`
- Modify: `src/pages/PoemPage.tsx`
- Modify: `src/pages/PlayHall.tsx`
- Modify: `tests/corpus-all.test.tsx` (expand with page assertions)
- Modify: `scripts/build-standalone.cjs`

**Interfaces:**
- Consumes: Task 1's `Corpus` type
- Produces: All 4 pages handle `'all'` correctly; boundary mapping `'all' → 'both'` applied at data calls

- [ ] **Step 1: Expand `tests/corpus-all.test.tsx` with page assertions**

Append:
```tsx
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { fireEvent, screen } from '@testing-library/react';
import { PoemsRiverPage } from '../src/pages/PoemsRiverPage';
import { PoemPage } from '../src/pages/PoemPage';
import { PoetPage } from '../src/pages/PoetPage';
import { PlayHall } from '../src/pages/PlayHall';

describe('PoemsRiverPage in corpus=all', () => {
  it('renders 总 库 title', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    render(
      <MemoryRouter>
        <CorpusProvider>
          <PoemsRiverPage />
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('总  库')).toBeTruthy();
  });
});

describe('PoemPage in corpus=all', () => {
  it('any poem is in scope (no switch prompt)', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    // Pick any poem id from poems.json. jingyesi is corpus='both', exists.
    render(
      <MemoryRouter initialEntries={['/poem/jingyesi']}>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.queryByText(/这首诗不在当前诗库/)).toBeNull();
  });
});

describe('PoetPage in corpus=all', () => {
  it('does not render 看全部 toggle', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    // libai — has tang poems; in 'all' mode, no toggle should appear
    render(
      <MemoryRouter initialEntries={['/poet/libai']}>
        <CorpusProvider>
          <Routes>
            <Route path="/poet/:poetId" element={<PoetPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.queryByText('看全部')).toBeNull();
    expect(screen.queryByText('只看本库')).toBeNull();
  });
});

describe('PlayHall in corpus=all', () => {
  it('shows 总库 label and 50 stages', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    render(
      <MemoryRouter>
        <CorpusProvider>
          <PlayHall />
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(/总库/)).toBeTruthy();
    // 50 关 — sentence mode shows "已通 X / 50 关"
    expect(screen.getByText(/\/ 50 关/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

Run: `npm test -- tests/corpus-all.test.tsx`
Expected: FAIL on all 4 new tests.

- [ ] **Step 3: Modify `src/pages/PoemsRiverPage.tsx`**

Replace the title block (line ~38-40):
```tsx
// BEFORE
{corpus === 'tang' ? '唐 诗 三 百 首' : '小 学 必 背'}

// AFTER
{corpus === 'tang' ? '唐 诗 三 百 首' : corpus === 'primary' ? '小 学 必 背' : '总  库'}
```

Replace the `getPoems(corpus)` call (line 28):
```tsx
// BEFORE
const poems = getPoems(corpus);

// AFTER — corpus='all' maps to data-layer 'both'
const poems = getPoems(corpus === 'all' ? 'both' : corpus);
```

- [ ] **Step 4: Modify `src/pages/PoetPage.tsx`**

Replace filter logic (line 45-49):
```tsx
// BEFORE
const filteredPoems: Poem[] = allPoems.filter((p) => {
  if (corpus === 'tang') return p.corpus !== 'primary';
  return p.corpus !== 'tang';
});
const hasFilteredOut = filteredPoems.length < allPoems.length;
const visiblePoems = showAll ? allPoems : filteredPoems;

// AFTER
const filteredPoems: Poem[] = corpus === 'all'
  ? allPoems
  : allPoems.filter((p) => {
      if (corpus === 'tang') return p.corpus !== 'primary';
      return p.corpus !== 'tang';
    });
const hasFilteredOut = filteredPoems.length < allPoems.length;
const visiblePoems = showAll ? allPoems : filteredPoems;
```

The「看全部」toggle button stays rendered only when `hasFilteredOut` is true. In 'all' mode `filteredPoems === allPoems` so `hasFilteredOut = false` → toggle hidden. No additional JSX change needed.

Update empty-state message (find it via `grep`):
```tsx
// BEFORE
{corpus === 'tang' ? '唐诗三百首' : '小学必背'} 库中无作品

// AFTER
{corpus === 'all' ? '该诗人无作品' : `${corpus === 'tang' ? '唐诗三百首' : '小学必背'} 库中无作品`}
```

- [ ] **Step 5: Modify `src/pages/PoemPage.tsx`**

Replace `inScope` and `switchTarget` logic (line 47-52):
```tsx
// BEFORE
const inScope =
  poem.corpus === 'both' ||
  poem.corpus === corpus;
const switchTarget = corpus === 'tang' ? 'primary' : 'tang';
const switchLabel = switchTarget === 'tang' ? '唐诗三百首' : '小学必背';

// AFTER
const inScope = corpus === 'all' || poem.corpus === 'both' || poem.corpus === corpus;
// switchTarget 仅在 inScope=false 时使用；'all' 下永远 inScope，无需计算
const switchTarget = corpus === 'tang' ? 'primary' : 'tang';
const switchLabel = switchTarget === 'tang' ? '唐诗三百首' : '小学必背';
```

> 注：`switchLabel` 仍然计算（无害），但 `inScope=true` 时 JSX 不渲染切库提示。

- [ ] **Step 6: Modify `src/pages/PlayHall.tsx`**

Update `isPrimary` / `charKeywords` / groups block (line 54-64):
```tsx
// BEFORE
const isPrimary = corpus === 'primary';
const charKeywords = isPrimary ? PRIMARY_KEYWORDS : KEYWORDS;
const charGroups = isPrimary
  ? [{ tier: 'entry' as const, words: PRIMARY_KEYWORD_GROUPS.entry },
     { tier: 'mid' as const, words: PRIMARY_KEYWORD_GROUPS.mid }]
  : [{ tier: 'entry' as const, words: KEYWORD_GROUPS.entry },
     { tier: 'mid' as const, words: KEYWORD_GROUPS.mid },
     { tier: 'advanced' as const, words: KEYWORD_GROUPS.advanced }];
const totalCharStages = charKeywords.length;
const totalSentenceStages = isPrimary ? 30 : 50;

// AFTER
const isPrimary = corpus === 'primary';
// 总库与 tang 同结构（50 字三档），数据来源是全集（poems corpus='both'）
const charKeywords = isPrimary ? PRIMARY_KEYWORDS : KEYWORDS;
const charGroups = isPrimary
  ? [{ tier: 'entry' as const, words: PRIMARY_KEYWORD_GROUPS.entry },
     { tier: 'mid' as const, words: PRIMARY_KEYWORD_GROUPS.mid }]
  : [{ tier: 'entry' as const, words: KEYWORD_GROUPS.entry },
     { tier: 'mid' as const, words: KEYWORD_GROUPS.mid },
     { tier: 'advanced' as const, words: KEYWORD_GROUPS.advanced }];
const totalCharStages = charKeywords.length;
const totalSentenceStages = isPrimary ? 30 : 50;
```

> 注：上面的实际代码改动只是注释更新（行为不变）—因为 `corpus === 'all'` 走 else 分支，与 tang 完全相同。

Update the「当前诗库」label (line 92):
```tsx
// BEFORE
当前诗库：{corpus === 'tang' ? '唐诗三百首' : '小学必背'}

// AFTER
当前诗库：{corpus === 'tang' ? '唐诗三百首' : corpus === 'primary' ? '小学必背' : '总库'}
```

- [ ] **Step 7: Run tests, confirm pass**

Run: `npm test -- tests/corpus-all.test.tsx`
Expected: All pass (3 from Task 1 + 4 new).

- [ ] **Step 8: Run full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: All pass.

- [ ] **Step 9: Mirror to `scripts/build-standalone.cjs`**

Find and update:
- `poemsRiverPageCode` — title ternary + getPoems mapping
- `poetPageCode` — filter logic + empty-state message
- `poemPageCode` — inScope logic
- `playHallCode` — label ternary (no behavior change beyond label)

- [ ] **Step 10: Regenerate standalone + verify**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 11: Commit**

```bash
git add src/pages/PoemsRiverPage.tsx src/pages/PoetPage.tsx src/pages/PoemPage.tsx src/pages/PlayHall.tsx tests/corpus-all.test.tsx scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): 4 pages handle corpus='all' with boundary mapping to 'both'"
```

---

### Task 4: Engine / couplets / progress accept corpus='all'

**Files:**
- Modify: `src/play/engine.ts` (only call-site helpers, not signatures)
- Modify: `src/play/couplets.ts` (same)
- Modify: `src/pages/StagePlay.tsx` (call-site mapping for 'all')
- Modify: `src/pages/SentencePlay.tsx` (same)
- Modify: `src/pages/PlayHall.tsx` (loadProgress/loadSentenceProgress already passed corpus; ensure they handle 'all')
- Create: `tests/progress-all.test.ts`
- Modify: `scripts/build-standalone.cjs`

**Interfaces:**
- Consumes: Task 1's `Corpus` with `'all'`; existing `PoemCorpus = 'tang' | 'primary' | 'both'`
- Produces: All call sites correctly map state `'all'` → data `'both'` before invoking engine/couplets; progress keys correctly suffixed `:all`

- [ ] **Step 1: Write the failing test**

Create `tests/progress-all.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, markCleared, clearCurrent } from '../src/play/progress';
import { loadSentenceProgress } from '../src/play/sentenceProgress';

beforeEach(() => {
  localStorage.clear();
});

describe('progress keys are corpus-suffixed', () => {
  it('all-corpus progress is independent of tang', () => {
    markCleared('月', 'all');
    const tangProgress = loadProgress('tang');
    const allProgress = loadProgress('all');
    expect(allProgress.cleared).toContain('月');
    expect(tangProgress.cleared).not.toContain('月');
  });

  it('all-corpus progress is independent of primary', () => {
    markCleared('月', 'all');
    const primaryProgress = loadProgress('primary');
    expect(primaryProgress.cleared).not.toContain('月');
  });

  it('all key is shiwen-feihua-progress:all', () => {
    markCleared('月', 'all');
    expect(localStorage.getItem('shiwen-feihua-progress:all')).not.toBeNull();
    // 反查原始 key 内容应包含 月
    const raw = localStorage.getItem('shiwen-feihua-progress:all');
    expect(raw).toContain('月');
  });

  it('clearCurrent on all does not touch tang key', () => {
    // 预设 tang 有 current
    const raw = JSON.stringify({ unlockedIndex: 1, cleared: [], current: { keyword: '月', correct: [], blood: 3 } });
    localStorage.setItem('shiwen-feihua-progress', raw);
    clearCurrent('all');
    // tang key 不变
    expect(localStorage.getItem('shiwen-feihua-progress')).toBe(raw);
  });
});
```

- [ ] **Step 2: Run test, confirm fail (or pass — existing storageKey logic already handles this)**

Run: `npm test -- tests/progress-all.test.ts`
Expected: If `storageKey()` already uses `${STORAGE_KEY}:${corpus}` for non-tang, then 'all' naturally produces `shiwen-feihua-progress:all` and the test may PASS immediately. This is acceptable — the test then serves as regression protection.

- [ ] **Step 3: Update call sites in StagePlay.tsx / SentencePlay.tsx**

In `StagePlay.tsx`, the engine calls already pass `corpus` as trailing arg. But the engine signature accepts `PoemCorpus`, not `Corpus`. Since `Corpus` includes `'all'` and engine functions accept `PoemCorpus` (which doesn't include `'all'`), there's a type mismatch.

**Resolution: at call sites in StagePlay.tsx, map `'all' → 'both'` before calling engine functions.**

Find all `pickStageQuestion(..., corpus)` calls in StagePlay.tsx (~3 sites from Task 7) and wrap the corpus arg:
```tsx
// BEFORE
pickStageQuestion(keyword, used, corpus);

// AFTER
const poemCorpus = corpus === 'all' ? 'both' : corpus;
pickStageQuestion(keyword, used, poemCorpus);
```

> Note: declare `const poemCorpus` once near the top of the component, not at each call site. Use it for both engine calls and progress calls.

In SentencePlay.tsx, same pattern:
```tsx
const poemCorpus = corpus === 'all' ? 'both' : corpus;
// pickLevelQuestion(tier, used, poemCorpus);
```

> Progress functions (`loadProgress` etc.) take `Corpus`, not `PoemCorpus`, so they don't need the mapping — pass `corpus` directly. The mapping only applies to engine.ts / couplets.ts calls.

- [ ] **Step 4: Verify PoemCorpus vs Corpus types**

Run: `npx tsc --noEmit`
Expected: Any remaining type errors about `'all'` not being assignable to `PoemCorpus` should be at the call sites. Fix each by applying the `poemCorpus` mapping pattern above.

If errors persist inside engine.ts / couplets.ts themselves (not call sites), inspect: those files accept `PoemCorpus` which is fine — but if they call `getPoems(corpus)` with their `PoemCorpus` parameter, that already works (`PoemCorpus = 'tang' | 'primary' | 'both'` is a valid input to `getPoems`).

- [ ] **Step 5: Mirror to `scripts/build-standalone.cjs`**

In `stagePlayCode` / `sentencePlayCode` template strings, apply the same `poemCorpus` mapping.

- [ ] **Step 6: Run full suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: All pass.

- [ ] **Step 7: Regenerate standalone + verify**

Run: `npm run build:standalone && npm run verify:standalone`

- [ ] **Step 8: Commit**

```bash
git add src/pages/StagePlay.tsx src/pages/SentencePlay.tsx tests/progress-all.test.ts scripts/build-standalone.cjs standalone.html
git commit -m "feat(corpus): engine/couplets/progress accept corpus='all' via boundary mapping"
```

---

### Task 5: Final verification + build:gh

**Files:**
- No new src/ changes; verification + dist regeneration only.

- [ ] **Step 1: Full test suite + tsc**

Run: `npm test && npx tsc --noEmit`
Expected: All pass (122 from prior + ~3 new from Task 1 + 2 new from Task 2 + 4 new from Task 3 + 4 new from Task 4 = ~135 total).

- [ ] **Step 2: Standalone build + verify**

Run: `npm run build:standalone && npm run verify:standalone`
Expected: Build succeeds; Babel verify OK.

- [ ] **Step 3: Full GitHub Pages build**

Run: `npm run build:gh`
Expected: Pass. dist/ regenerated; manifest / sw.js / icons copied as expected.

- [ ] **Step 4: Manual smoke check**

Open `standalone.html` in a browser (or instruct user to). Verify:
- TopNav shows 3 segments
- Clicking 总库 switches label across all 4 pages
- 飞花令 in all mode shows 50 关 / 50 字
- 飞花令 progress in all mode is independent (clear one stage, switch to tang, verify it's not cleared there)

- [ ] **Step 5: Commit build artifacts if any root files changed**

Check `git status`. If `assets/`, `index.html`, `sw.js` changed, decide whether to commit per project convention (corpus project precedent: don't commit dist per task). Default: don't commit unless user explicitly asks.

- [ ] **Step 6: No commit if no src changes; otherwise commit any final polish**

```bash
# Only if there are uncommitted src changes from final polish
git add <files>
git commit -m "chore(corpus-all): final verification"
```

---

## Self-Review

### Spec coverage
- §类型层 (Corpus type): Task 1 ✓
- §State 层 (CorpusProvider): Task 1 ✓
- §Switcher (3 segments): Task 2 ✓
- §Pages (4 pages): Task 3 ✓
- §Engine/Couplets/Progress (boundary mapping + storage key): Task 4 ✓
- §测试 (corpus-all.test.tsx + progress-all.test.ts): Tasks 1+3+4 ✓

### Placeholder scan
无 TBD / TODO. 每个 Step 含具体代码或命令。

### Type consistency
- `Corpus = 'tang' | 'primary' | 'all'` (Task 1)
- `PoemCorpus = 'tang' | 'primary' | 'both'` (UNCHANGED — Tasks 4 just maps 'all' → 'both' at boundary)
- `storageKey(corpus)` accepts `Corpus` (Tasks 1+4)
- `pickStageQuestion(keyword, used, corpus)` accepts `PoemCorpus` (Task 4 boundary mapping handles this)

无函数名/签名漂移。
