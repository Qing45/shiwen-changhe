# 交互打磨（P1 正确性 + P2 体验感）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 primary/all 语料下的硬编码"唐"和时间轴 618-907 错位；加入路由切换/切库/节点点击的轻量动效反馈。

**Architecture:** 新增两个纯数据/工具模块（dynasties 表 + yearRange 计算）；在 5 处页面用派生值替换写死字面量；新增 1 个全局 fade-in 动画；用 CSS `:active` 伪类做节点按压反馈，不引入动画库。

**Tech Stack:** React 18 + react-router-dom 6 + TypeScript 5 + Vite 5 + vitest 2 + @testing-library/react 16 + jsdom。

## Global Constraints

- 命名规则：组件 PascalCase，工具函数 camelCase，文件 `.ts`/`.tsx`。
- 测试命令：`npm test`（= `vitest run`）。单个文件：`npx vitest run <path>`。
- **Mirror 约束**：本项目采用双源结构——每个 `src/*.ts(x)` 都必须在 `scripts/build-standalone.cjs` 里以字符串模板字面量形式同步内联。新增/修改 src 文件的每个任务，都必须同步 build-standalone.cjs。CSS 由 build-standalone.cjs 通过 `fs.readFileSync('src/styles.css')` 自动读取，不需要单独 mirror。
- 测试数据用真实 hash ID：`苏轼` poetId `82cf8f7c`、`赠刘景文` poemId `c987db20a4d7`（primary 语料 + song 朝代）。`静夜思` `c35a60c1a8e2`（both）继续可用。
- 项目根 `D:/claude/诗文长河/`。开发服务器 `npm run dev`（vite, 端口 5173）。
- TypeScript 严格模式（`tsc` 必须 clean 才能合并）。
- 提交格式 `git commit -m "<task-id>: <description>"`。
- 不要碰 `.superpowers/`（gitignored）。
- 任何对 `src/pages/PoemPage.tsx`、`RiverPage.tsx`、`PoemsRiverPage.tsx` 的修改都要保证 `tests/poem-page-corpus.test.tsx` 继续通过。

## File Structure

| 文件 | 职责 |
|---|---|
| `src/data/dynasties.ts` (新) | 朝代常量表 + `getDynastyName` / `getDynasty` 工具 |
| `src/utils/yearRange.ts` (新) | `computeCorpusYearRange(poets, corpus)` — 算 layout range + ticks + labels |
| `src/styles.css` (改) | 加 `fade-in` keyframe |
| `src/components/TopNav.tsx` (改) | `DynastyLabel` 接收 dynastyId；main 变体不渲染 |
| `src/pages/PoemPage.tsx` (改) | dynasty label 派生 + scroll reset + fade-in |
| `src/pages/PoetPage.tsx` (改) | scroll reset |
| `src/pages/RiverPage.tsx` (改) | dynasty hover + 派生 range + ticks + canvas key + 节点 :active |
| `src/pages/PoemsRiverPage.tsx` (改) | 派生 range + ticks + canvas key + 节点 :active |
| `scripts/build-standalone.cjs` (改) | 新增 dynasties/yearRange 字符串模板；同步 5 处 page 改动 |
| `tests/dynasties.test.ts` (新) | getDynastyName / getDynasty 单元测试 |
| `tests/yearRange.test.ts` (新) | computeCorpusYearRange 单元测试 |
| `tests/poem-page-scroll-reset.test.tsx` (新) | PoemPage scroll reset 交互测试 |

---

### Task 1: dynasties 数据表 + mirror

**Files:**
- Create: `src/data/dynasties.ts`
- Create: `tests/dynasties.test.ts`
- Modify: `scripts/build-standalone.cjs` (新增 `dynastiesCode` 模板字面量并注入)

**Interfaces:**
- Consumes: 无
- Produces: 
  - `DYNASTIES: { tang: {name, startYear, endYear}, song: ..., ming: ..., qing: ..., modern: ..., other: ... }`
  - `DynastyId: 'tang' | 'song' | 'ming' | 'qing' | 'modern' | 'other'`
  - `getDynastyName(id: string): string`
  - `getDynasty(id: string): { name: string; startYear: number; endYear: number } | undefined`

- [ ] **Step 1: Write the failing test**

Create `tests/dynasties.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DYNASTIES, getDynastyName, getDynasty } from '../src/data/dynasties';

describe('DYNASTIES', () => {
  it('contains the six expected dynasty ids', () => {
    expect(Object.keys(DYNASTIES).sort()).toEqual(['modern', 'other', 'qing', 'song', 'ming', 'tang']);
  });

  it('has contiguous year ranges with no overlap', () => {
    const sorted = (['other', 'tang', 'song', 'ming', 'qing', 'modern'] as const).map((k) => DYNASTIES[k]);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].endYear).toBeLessThanOrEqual(sorted[i + 1].startYear);
    }
  });
});

describe('getDynastyName', () => {
  it('returns the Chinese name for known ids', () => {
    expect(getDynastyName('tang')).toBe('唐');
    expect(getDynastyName('song')).toBe('宋');
    expect(getDynastyName('ming')).toBe('明');
    expect(getDynastyName('qing')).toBe('清');
    expect(getDynastyName('modern')).toBe('近现代');
    expect(getDynastyName('other')).toBe('南北朝');
  });

  it('falls back to 唐 for unknown ids', () => {
    expect(getDynastyName('unknown-id')).toBe('唐');
    expect(getDynastyName('')).toBe('唐');
  });
});

describe('getDynasty', () => {
  it('returns the full record for known ids', () => {
    expect(getDynasty('song')).toEqual({ name: '宋', startYear: 960, endYear: 1279 });
  });

  it('returns undefined for unknown ids', () => {
    expect(getDynasty('foo')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dynasties.test.ts`
Expected: FAIL — `Cannot find module '../src/data/dynasties'`

- [ ] **Step 3: Write the implementation**

Create `src/data/dynasties.ts`:

```ts
// 朝代常量表。所有 dynastyId 取值必须在此表中，否则 getDynastyName 兜底 '唐'。
// 数据范围：先秦南北朝 → 民国初。1976 是毛泽东逝世纪念的近现代截止年。

export const DYNASTIES = {
  other:  { name: '南北朝', startYear: 386,  endYear: 589 },
  tang:   { name: '唐',     startYear: 618,  endYear: 907 },
  song:   { name: '宋',     startYear: 960,  endYear: 1279 },
  ming:   { name: '明',     startYear: 1368, endYear: 1644 },
  qing:   { name: '清',     startYear: 1644, endYear: 1912 },
  modern: { name: '近现代', startYear: 1912, endYear: 1976 },
} as const;

export type DynastyId = keyof typeof DYNASTIES;

export const getDynastyName = (id: string): string => DYNASTIES[id as DynastyId]?.name ?? '唐';

export const getDynasty = (id: string): Readonly<{ name: string; startYear: number; endYear: number }> | undefined =>
  DYNASTIES[id as DynastyId];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dynasties.test.ts`
Expected: PASS — 3 describe blocks, all green.

- [ ] **Step 5: Mirror to build-standalone.cjs**

Open `scripts/build-standalone.cjs`. After the `// ===== data/load.ts =====` block (around line 117, before `// ===== utils/layout.ts =====` at line 199), insert a new template literal:

Find a stable anchor. The line `// ===== utils/layout.ts =====` exists at line 199. Insert a `// ===== data/dynasties.ts =====` block before it.

Insert (after the data/load.ts block closes):

```js
// data/dynasties.ts
const dynastiesCode = `
// ===== data/dynasties.ts =====
const DYNASTIES = {
  other:  { name: '南北朝', startYear: 386,  endYear: 589 },
  tang:   { name: '唐',     startYear: 618,  endYear: 907 },
  song:   { name: '宋',     startYear: 960,  endYear: 1279 },
  ming:   { name: '明',     startYear: 1368, endYear: 1644 },
  qing:   { name: '清',     startYear: 1644, endYear: 1912 },
  modern: { name: '近现代', startYear: 1912, endYear: 1976 },
};
function getDynastyName(id) { return (DYNASTIES[id] && DYNASTIES[id].name) || '唐'; }
function getDynasty(id) { return DYNASTIES[id]; }
`;
```

Note: the standalone version uses plain `function` declarations (no `export`), matching the existing convention (e.g., `getPoems` in data/load.ts is also a plain function in standalone).

Then find the injection point near line 4147 where `${feihuaKeywordsCode}` and `${feihuaPrimaryKeywordsCode}` are concatenated into the final HTML. Add `${dynastiesCode}` on a new line right after them:

```js
${dynastiesCode}
${feihuaKeywordsCode}
${feihuaPrimaryKeywordsCode}
```

- [ ] **Step 6: Verify standalone builds cleanly**

Run: `npm run build:standalone`
Expected: Build completes; standalone.html is regenerated.

- [ ] **Step 7: Commit**

```bash
git add src/data/dynasties.ts tests/dynasties.test.ts scripts/build-standalone.cjs
git commit -m "T1: add dynasties data table + getDynastyName/getDynasty helpers"
```

---

### Task 2: yearRange 工具 + mirror

**Files:**
- Create: `src/utils/yearRange.ts`
- Create: `tests/yearRange.test.ts`
- Modify: `scripts/build-standalone.cjs` (新增 `yearRangeCode` 模板并注入)

**Interfaces:**
- Consumes: `Poet` from `../types`, `Corpus` from `../state/corpus`
- Produces:
  - `YearRange { minYear: number; maxYear: number; ticks: { year: number; label?: string; pos: number }[]; leftLabel: string; rightLabel: string }`
  - `computeCorpusYearRange(poets: ReadonlyArray<Poet>, corpus: Corpus): YearRange`

- [ ] **Step 1: Write the failing test**

Create `tests/yearRange.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeCorpusYearRange } from '../src/utils/yearRange';
import type { Poet } from '../src/types';

const mkPoet = (id: string, birthYear: number, deathYear: number, dynastyId: string = 'tang'): Poet => ({
  id, name: id, birthYear, deathYear, dynastyId, familiarity: 1, corpus: 'tang' as const,
});

describe('computeCorpusYearRange', () => {
  it('returns tang-style range for tang poets', () => {
    const poets = [mkPoet('a', 618, 700), mkPoet('b', 800, 850)];
    const r = computeCorpusYearRange(poets, 'tang');
    expect(r.minYear).toBeGreaterThanOrEqual(600);
    expect(r.minYear).toBeLessThanOrEqual(625);
    expect(r.maxYear).toBeGreaterThanOrEqual(895);
    expect(r.maxYear).toBeLessThanOrEqual(920);
    // Tick spacing 30 years for spans <=300
    expect(r.ticks.length).toBeGreaterThanOrEqual(5);
    expect(r.leftLabel).toMatch(/^\d+ · .+$/);
    expect(r.rightLabel).toMatch(/^\d+$/);
  });

  it('returns wide range covering primary poets incl. 毛泽东 1976', () => {
    const poets = [
      mkPoet('a', 386, 500, 'other'),
      mkPoet('b', 1037, 1101, 'song'),
      mkPoet('c', 1893, 1976, 'modern'),
    ];
    const r = computeCorpusYearRange(poets, 'primary');
    expect(r.minYear).toBeLessThanOrEqual(400); // covers 北朝民歌 386
    expect(r.maxYear).toBeGreaterThanOrEqual(1960); // covers 毛泽东 1976
    // Tick spacing 100 years for spans >700
    const years = r.ticks.map((t) => t.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i] - years[i - 1]).toBe(100);
    }
  });

  it('leftLabel uses earliest dynasty name', () => {
    const poets = [
      mkPoet('a', 386, 500, 'other'),
      mkPoet('b', 700, 800, 'tang'),
    ];
    const r = computeCorpusYearRange(poets, 'primary');
    expect(r.leftLabel).toMatch(/· 南北朝$/);
  });

  it('pos values are 0-100', () => {
    const poets = [mkPoet('a', 618, 700), mkPoet('b', 1893, 1976, 'modern')];
    const r = computeCorpusYearRange(poets, 'all');
    for (const t of r.ticks) {
      expect(t.pos).toBeGreaterThanOrEqual(0);
      expect(t.pos).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/yearRange.test.ts`
Expected: FAIL — `Cannot find module '../src/utils/yearRange'`

- [ ] **Step 3: Write the implementation**

Create `src/utils/yearRange.ts`:

```ts
import type { Poet } from '../types';
import type { Corpus } from '../state/corpus';
import { getDynastyName } from '../data/dynasties';

export interface YearRange {
  minYear: number;
  maxYear: number;
  ticks: { year: number; label?: string; pos: number }[];
  leftLabel: string;
  rightLabel: string;
}

function pad(value: number, percent: number, direction: -1 | 1): number {
  const delta = Math.ceil((value * percent) / 10) * 10;
  return value + delta * direction;
}

function tickInterval(span: number): number {
  if (span <= 300) return 30;
  if (span <= 700) return 50;
  return 100;
}

export function computeCorpusYearRange(
  poets: ReadonlyArray<Poet>,
  _corpus: Corpus,
): YearRange {
  if (poets.length === 0) {
    return { minYear: 618, maxYear: 907, ticks: [], leftLabel: '618 · 唐', rightLabel: '907' };
  }
  const minBirth = Math.min(...poets.map((p) => p.birthYear));
  const maxDeath = Math.max(...poets.map((p) => p.deathYear));
  const rawSpan = maxDeath - minBirth;
  const minYear = pad(minBirth, 0.03, -1);
  const maxYear = pad(maxDeath, 0.03, 1);
  const span = maxYear - minYear;
  const interval = tickInterval(span);

  const ticks: { year: number; label?: string; pos: number }[] = [];
  // Snap first tick up to next multiple of interval at or above minYear
  const start = Math.ceil(minYear / interval) * interval;
  for (let y = start; y <= maxYear; y += interval) {
    ticks.push({
      year: y,
      label: String(y),
      pos: ((y - minYear) / span) * 100,
    });
  }

  // Earliest poet's dynasty for left label
  const earliest = poets.reduce((acc, p) => (p.birthYear < acc.birthYear ? p : acc));
  const leftLabel = `${minYear} · ${getDynastyName(earliest.dynastyId)}`;
  const rightLabel = String(maxYear);

  return { minYear, maxYear, ticks, leftLabel, rightLabel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/yearRange.test.ts`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Mirror to build-standalone.cjs**

After the `dynastiesCode` literal (from Task 1), insert:

```js
// utils/yearRange.ts
const yearRangeCode = `
// ===== utils/yearRange.ts =====
function _pad(value, percent, direction) {
  const delta = Math.ceil((value * percent) / 10) * 10;
  return value + delta * direction;
}
function _tickInterval(span) {
  if (span <= 300) return 30;
  if (span <= 700) return 50;
  return 100;
}
function computeCorpusYearRange(poets, _corpus) {
  if (poets.length === 0) {
    return { minYear: 618, maxYear: 907, ticks: [], leftLabel: '618 · 唐', rightLabel: '907' };
  }
  const minBirth = Math.min.apply(null, poets.map(function (p) { return p.birthYear; }));
  const maxDeath = Math.max.apply(null, poets.map(function (p) { return p.deathYear; }));
  const minYear = _pad(minBirth, 0.03, -1);
  const maxYear = _pad(maxDeath, 0.03, 1);
  const span = maxYear - minYear;
  const interval = _tickInterval(span);
  const ticks = [];
  const start = Math.ceil(minYear / interval) * interval;
  for (let y = start; y <= maxYear; y += interval) {
    ticks.push({ year: y, label: String(y), pos: ((y - minYear) / span) * 100 });
  }
  let earliest = poets[0];
  for (let i = 1; i < poets.length; i++) {
    if (poets[i].birthYear < earliest.birthYear) earliest = poets[i];
  }
  const leftLabel = minYear + ' · ' + getDynastyName(earliest.dynastyId);
  const rightLabel = String(maxYear);
  return { minYear: minYear, maxYear: maxYear, ticks: ticks, leftLabel: leftLabel, rightLabel: rightLabel };
}
`;
```

Note: standalone uses `var` semantics via implicit globals; arrow functions in template literals may be problematic in older Babel transforms — use plain `function` declarations throughout.

Then update the injection block to include it:

```js
${dynastiesCode}
${yearRangeCode}
${feihuaKeywordsCode}
${feihuaPrimaryKeywordsCode}
```

- [ ] **Step 6: Verify standalone builds cleanly**

Run: `npm run build:standalone`
Expected: Build completes.

- [ ] **Step 7: Commit**

```bash
git add src/utils/yearRange.ts tests/yearRange.test.ts scripts/build-standalone.cjs
git commit -m "T2: add computeCorpusYearRange for adaptive layout range + ticks"
```

---

### Task 3: TopNav DynastyLabel 派生

**Files:**
- Modify: `src/components/TopNav.tsx` — `DynastyLabel` 函数签名加 `dynastyId?: string` 参数；main 变体不传
- Modify: `scripts/build-standalone.cjs` — 同步 TopNav 内联块
- Modify: `tests/app.smoke.test.tsx` (如果存在对 TopNav '唐' 字面量的断言)

**Interfaces:**
- Consumes: `getDynastyName` from `../data/dynasties`
- Produces: 内部组件 `DynastyLabel({ dynastyId?: string })`

- [ ] **Step 1: Read current state and locate exact lines**

Read `src/components/TopNav.tsx` to find:
- Line 145-156: `DynastyLabel` function (hardcoded `>唐<` at line 154)
- Line 41-55: main variant block (includes `<DynastyLabel />` at line 52)
- Line 57-78: poet variant block (includes `<DynastyLabel />` at line 75)
- Line 80-102: poem variant block (no DynastyLabel currently — uses different layout)

Also search build-standalone.cjs for the TopNav section (starts around line 1273 with `// ===== components/TopNav.tsx =====`) and find the equivalent DynastyLabel function and the variant blocks.

- [ ] **Step 2: Modify TopNav.tsx — DynastyLabel signature**

In `src/components/TopNav.tsx`, replace `function DynastyLabel()` (around line 145):

```tsx
function DynastyLabel({ dynastyId }: { dynastyId?: string }) {
  if (!dynastyId) return null;
  return (
    <div style={{
      marginLeft: 'auto',
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.meta, letterSpacing: 3,
      padding: '6px 14px',
      border: '1px solid rgba(216,224,240,0.2)',
      borderRadius: 3,
    }}>{getDynastyName(dynastyId)}</div>
  );
}
```

Add the import at the top of the file (after existing imports, around line 7):

```tsx
import { getDynastyName } from '../data/dynasties';
```

- [ ] **Step 3: Update main variant — remove DynastyLabel**

In the main variant block (around line 41-55), delete the `<DynastyLabel />` line (line 52). The block becomes:

```tsx
{variant === 'main' && (
  <>
    {!isMobile && (
      <div style={{ /* 诗文长河 title */ }}>诗文长河</div>
    )}
    <RiverToggle compact={isMobile} />
    <SearchBox />
    <CorpusSwitcher />
  </>
)}
```

The CorpusSwitcher already has `marginLeft: 'auto'` internally — no need to add a placeholder spacer.

- [ ] **Step 4: Update poet variant — pass dynastyId**

In the poet variant block (around line 75), change:

```tsx
<DynastyLabel />
```

to:

```tsx
<DynastyLabel dynastyId={props.poet.dynastyId} />
```

- [ ] **Step 5: Add DynastyLabel to poem variant**

In the poem variant block (around line 80-102), the current structure has `<CorpusSwitcher />` at line 100 inside `<div style={{ marginLeft: 'auto' }}>`. Insert `<DynastyLabel dynastyId={props.poet.dynastyId} />` BEFORE the CorpusSwitcher's marginLeft:auto wrapper:

```tsx
<DynastyLabel dynastyId={props.poet.dynastyId} />
<div style={{ marginLeft: 'auto' }}><CorpusSwitcher /></div>
```

Note: DynastyLabel itself has `marginLeft: 'auto'`, which will push it to the right and crowd out the existing `<div marginLeft:auto>` wrapper for CorpusSwitcher. Acceptable behavior — both are right-aligned. If visual overlap is observed in dev, remove the wrapper's marginLeft and rely on the auto on DynastyLabel.

- [ ] **Step 6: Update build-standalone.cjs — mirror TopNav changes**

Open `scripts/build-standalone.cjs`. Find the TopNav section (around line 1273). Apply the same changes to the inline code:
- Add `function getDynastyName(id) { return (DYNASTIES[id] && DYNASTIES[id].name) || '唐'; }` reference — already provided by `dynastiesCode` template injected earlier.
- Update `DynastyLabel` function definition: add `dynastyId` parameter; render `getDynastyName(dynastyId)`; return `null` if no dynastyId.
- Remove `<DynastyLabel />` from the main variant block.
- Update `<DynastyLabel />` to `<DynastyLabel dynastyId={poet.dynastyId}>` in the poet variant block.
- Add `<DynastyLabel dynastyId={poet.dynastyId}>` to the poem variant block before the `<CorpusSwitcher>` wrapper.

Reference for existing pattern: `// ===== components/TopNav.tsx =====` (around line 1273). The function style is React.createElement equivalents or JSX-in-template. Match the existing style verbatim (search for `<DynastyLabel` to find all callsites).

- [ ] **Step 7: Run all tests + tsc + standalone build**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected:
- All tests pass (including `tests/poem-page-corpus.test.tsx`)
- `tsc` clean
- Standalone builds

- [ ] **Step 8: Manual visual check (optional)**

```bash
npm run dev
```

Open `/poet/82cf8f7c` (苏轼). Verify:
- TopNav shows `宋` (not `唐`)
- Main variant on `/` does NOT show any dynasty pill

If main variant looks empty/visually unbalanced, add a spacer `<div style={{ flex: 1 }} />` between SearchBox and CorpusSwitcher. Acceptable to defer.

- [ ] **Step 9: Commit**

```bash
git add src/components/TopNav.tsx scripts/build-standalone.cjs
git commit -m "T3: TopNav DynastyLabel derives from poet.dynastyId; main variant removed"
```

---

### Task 4: PoemPage dynasty label 派生

**Files:**
- Modify: `src/pages/PoemPage.tsx` line 230 (`{poet.name} · 唐`)
- Modify: `scripts/build-standalone.cjs` — 同步 PoemPage 内联块（约 line 1924）

**Interfaces:**
- Consumes: `getDynastyName` from `../data/dynasties`
- Produces: 无（渲染层修改）

- [ ] **Step 1: Read PoemPage.tsx around line 230 to confirm exact text**

Read `src/pages/PoemPage.tsx` line 226-232 to confirm the current `{poet.name} · 唐` string. (Already confirmed in audit; spec is `{poet.name} · 唐`).

- [ ] **Step 2: Add import in PoemPage.tsx**

Open `src/pages/PoemPage.tsx`. Locate the imports at the top (after line 1). Find the right alphabetical position to insert:

```tsx
import { getDynastyName } from '../data/dynasties';
```

Note: there may already be imports from `../utils/...` and `../data/load`. Insert next to those.

- [ ] **Step 3: Replace hardcoded dynasty**

In `src/pages/PoemPage.tsx`, change line 230:

```tsx
})}>{poet.name} · 唐</div>
```

to:

```tsx
})}>{poet.name} · {getDynastyName(poet.dynastyId)}</div>
```

- [ ] **Step 4: Mirror to build-standalone.cjs**

Find the PoemPage section in `scripts/build-standalone.cjs` (around line 1924 with `// ===== pages/PoemPage.tsx =====`). Search for the literal `' · 唐'` (with leading space) in the inline PoemPage code. Replace with `' · ' + getDynastyName(poet.dynastyId)`. 

Note: the standalone may use JSX-style template or React.createElement-style. Match the existing inline style.

- [ ] **Step 5: Verify**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PoemPage.tsx scripts/build-standalone.cjs
git commit -m "T4: PoemPage dynasty label derives from poet.dynastyId"
```

---

### Task 5: RiverPage P1 修复（dynasty hover + 派生 range + ticks）

**Files:**
- Modify: `src/pages/RiverPage.tsx` lines 13-20, 22-27, 132-136, 151-153
- Modify: `scripts/build-standalone.cjs` — 同步 RiverPage 内联块（约 line 1407）

**Interfaces:**
- Consumes: `useCorpus` from `../state/corpus`, `computeCorpusYearRange` from `../utils/yearRange`, `getDynastyName` from `../data/dynasties`
- Produces: 无

- [ ] **Step 1: Read RiverPage.tsx in full**

Already audited. Key lines:
- 13-20: hardcoded `RIVER_TICKS` constant
- 23: `const poets = getPoets();`
- 24: `const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, ... });`
- 135: `<span style={{ color: colors.textSecondary }}>唐</span>` (in hover)
- 152: `<TimeAxis left="618 · 唐" right="907" ticks={RIVER_TICKS} />`

- [ ] **Step 2: Add imports**

Open `src/pages/RiverPage.tsx`. Add 3 new imports (in alphabetical position among existing imports from `../...`):

```tsx
import { useCorpus } from '../state/corpus';
import { computeCorpusYearRange } from '../utils/yearRange';
import { getDynastyName } from '../data/dynasties';
```

- [ ] **Step 3: Remove hardcoded RIVER_TICKS and refactor RiverPage body**

Change 1 — Delete lines 13-20 (the entire `const RIVER_TICKS: ... = (() => {...})();` block).

Change 2 — In `RiverPage()` function (starts at line 22), after `const poets = getPoets();` (line 23), insert:

```tsx
const corpus = useCorpus();
const visiblePoems = getPoems(corpus === 'all' ? 'both' : corpus);
const visiblePoetIds = new Set(visiblePoems.map((p) => p.poetId));
const visiblePoets = poets.filter((p) => visiblePoetIds.has(p.id));
const range = computeCorpusYearRange(visiblePoets, corpus);
```

Change 3 — At line 24, replace `const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });` with:

```tsx
const positioned = layoutPoets(visiblePoets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 });
```

Change 4 — At line 135 (inside hover preview), replace `<span style={{ color: colors.textSecondary }}>唐</span>` with:

```tsx
<span style={{ color: colors.textSecondary }}>{getDynastyName(poet.dynastyId)}</span>
```

Change 5 — At line 152, replace:

```tsx
<TimeAxis left="618 · 唐" right="907" ticks={RIVER_TICKS} />
```

with:

```tsx
<TimeAxis left={range.leftLabel} right={range.rightLabel} ticks={range.ticks} />
```

- [ ] **Step 4: Verify `getPoems` is imported**

The current file imports `getPoets, getPoemCount` from `'../data/load'` (line 3). Need to also import `getPoems`:

```tsx
import { getPoets, getPoemCount, getPoems } from '../data/load';
```

- [ ] **Step 5: Mirror to build-standalone.cjs**

Find the RiverPage section (around line 1407). Apply equivalent changes:
- Remove `RIVER_TICKS` literal array (search for `RIVER_TICKS` to find it).
- Add `useCorpus`/`computeCorpusYearRange`/`getDynastyName`/`getPoems` references — these are provided by `state/corpus.tsx` (already mirrored as `useCorpus`), `yearRangeCode` (Task 2), `dynastiesCode` (Task 1), and existing `getPoems` in `data/load.ts` mirror.
- Update the hover template: `'唐'` → `getDynastyName(poet.dynastyId)`.
- Update `<TimeAxis left="618 · 唐" right="907" ticks={RIVER_TICKS} />` → `<TimeAxis left={range.leftLabel} right={range.rightLabel} ticks={range.ticks} />`.

- [ ] **Step 6: Verify**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected: all pass. In particular `tests/poem-page-corpus.test.tsx` still works (PoemPage wasn't changed in this task).

- [ ] **Step 7: Manual visual check (optional)**

```bash
npm run dev
```

- Visit `/` (诗人长河) with corpus=primary: verify TimeAxis spans ~380 to ~1980, 苏轼 (song) hover shows `宋`.
- Switch to corpus=tang: verify TimeAxis is back to ~620-910.

- [ ] **Step 8: Commit**

```bash
git add src/pages/RiverPage.tsx scripts/build-standalone.cjs
git commit -m "T5: RiverPage — dynasty hover + adaptive year range + ticks derived from corpus"
```

---

### Task 6: PoemsRiverPage P1 修复（派生 range + ticks）

**Files:**
- Modify: `src/pages/PoemsRiverPage.tsx` lines 13-20, 27-30, 157
- Modify: `scripts/build-standalone.cjs` — 同步 PoemsRiverPage 内联块（约 line 1556）

**Interfaces:**
- Consumes: `useCorpus` from `../state/corpus`, `computeCorpusYearRange` from `../utils/yearRange`
- Produces: 无

- [ ] **Step 1: Add imports**

Open `src/pages/ PoemsRiverPage.tsx`. Add:

```tsx
import { useCorpus } from '../state/corpus';
import { computeCorpusYearRange } from '../utils/yearRange';
```

(Already imports `useCorpus` at line 7 — re-check; if present, only add `computeCorpusYearRange`.)

- [ ] **Step 2: Remove hardcoded POEMS_RIVER_TICKS**

Delete lines 13-20 (the entire `const POEMS_RIVER_TICKS: ... = (() => {...})();` block).

- [ ] **Step 3: Refactor PoemsRiverPage body**

Change 1 — At line 27-30 (the existing `const corpus = useCorpus(); const poems = ...`), after `const poems = getPoems(corpus === 'all' ? 'both' : corpus);` (line 28), insert:

```tsx
const poetsList = getPoets();
const visiblePoetIds = new Set(poems.map((p) => p.poetId));
const visiblePoets = poetsList.filter((p) => visiblePoetIds.has(p.id));
const range = computeCorpusYearRange(visiblePoets, corpus);
```

Change 2 — At line 30, replace:

```tsx
const positioned = layoutAllPoems(poems, poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
```

with:

```tsx
const positioned = layoutAllPoems(poems, poets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 });
```

Change 3 — At line 157, replace:

```tsx
<TimeAxis left="618 · 唐" right="907" ticks={POEMS_RIVER_TICKS} />
```

with:

```tsx
<TimeAxis left={range.leftLabel} right={range.rightLabel} ticks={range.ticks} />
```

- [ ] **Step 4: Mirror to build-standalone.cjs**

Find the PoemsRiverPage section (around line 1556). Apply equivalent changes:
- Remove `POEMS_RIVER_TICKS` literal.
- Add `computeCorpusYearRange` call (provided by Task 2's template).
- Update `layoutAllPoems` invocation to use `range.minYear` / `range.maxYear`.
- Update `<TimeAxis left="618 · 唐" right="907" ticks={POEMS_RIVER_TICKS} />` → `<TimeAxis left={range.leftLabel} right={range.rightLabel} ticks={range.ticks} />`.

- [ ] **Step 5: Verify**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected: all pass.

- [ ] **Step 6: Manual visual check (optional)**

- Visit `/poems` (诗文长河) with corpus=primary: verify TimeAxis spans ~380 to ~1980. 毛泽东 poem node should appear around the right side, NOT collapsed at the very right edge.

- [ ] **Step 7: Commit**

```bash
git add src/pages/PoemsRiverPage.tsx scripts/build-standalone.cjs
git commit -m "T6: PoemsRiverPage — adaptive year range + ticks derived from corpus"
```

---

### Task 7: P2 体验感 — PoemPage/PoetPage 滚动复位 + 渐入

**Files:**
- Modify: `src/pages/PoemPage.tsx` — content container `key={poem.id}` + scroll reset on id change
- Modify: `src/pages/PoetPage.tsx` — scroll reset on id change
- Modify: `src/styles.css` — add `fade-in` keyframe
- Modify: `scripts/build-standalone.cjs` — 同步 PoemPage 和 PoetPage 内联块（CSS 由 `fs.readFileSync('src/styles.css')` 自动读取，不需要 mirror）
- Create: `tests/poem-page-scroll-reset.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: 全局 `@keyframes fade-in` + PoemPage 内容渐入 + PoetPage/PoemPage 滚动复位

- [ ] **Step 1: Add fade-in keyframe to styles.css**

Open `src/styles.css`. After the existing `@keyframes result-fade-scale { ... }` block at line 67-70, append:

```css
@keyframes fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

(No need to mirror to build-standalone.cjs — it reads styles.css automatically via `fs.readFileSync`.)

- [ ] **Step 2: PoemPage — add containerRef + scroll reset + fade-in**

Read `src/pages/PoemPage.tsx` to find the existing container div (the scrollable paper) and the existing `useEffect` for poem loading.

In PoemPage.tsx:
- Add `import { useEffect, useRef }` (or merge with existing import if `useEffect` already imported).
- Inside the component, add:
  ```tsx
  const paperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    paperRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [poem.id]);
  ```
- Find the scrollable paper container `<div style={{...overflowY: 'auto'...}}>` (search for `overflowY`) and add `ref={paperRef}`.
- Find the title block (around line 220-237 — confirmed in audit) and add `key={poem.id}` to its outer div.
- Find the body grid (around line 240+) and add `key={poem.id}` to its outer div.
- Add `style={{ animation: 'fade-in 0.3s ease-out' }}` to those keyed containers (the title block and body grid).

If the title block and body grid are wrapped in a single root `<div>` near the top of the content area, you can `key` the root instead of individually. Inspect the JSX tree to find the right wrapping point.

- [ ] **Step 3: PoetPage — add scroll reset**

Open `src/pages/PoetPage.tsx`. Find the `useEffect` (if any) or the component top. Add:

```tsx
import { useEffect } from 'react';
// ... inside PoetPage function:
useEffect(() => {
  window.scrollTo({ top: 0, behavior: 'auto' });
}, [poet.id]);
```

If PoetPage doesn't already import `useEffect`, add the import at the top.

- [ ] **Step 4: Mirror PoemPage and PoetPage to build-standalone.cjs**

Find the PoemPage section (around line 1924) and the PoetPage section (around line 1712). Apply equivalent changes:
- Add `paperRef` (use plain `var paperRef = { current: null };` since standalone is pre-React-18 hooks transformation) or use the equivalent pattern already used in the standalone for other refs.
- Add `useEffect` (already provided by React in standalone).
- Add `scrollTo` and `key={poem.id}` and `animation: 'fade-in 0.3s ease-out'` to the inline template.

Note: standalone uses JSX-in-template that compiles via @babel/standalone. `useRef` and `useEffect` are React built-ins — they should be available as React globals in standalone. Check existing standalone patterns: search for `useRef` or `useEffect` in the standalone to see how it's expressed.

If the inline template doesn't currently use hooks, the standalone might be a pre-hooks build that uses class components or ref-passthrough. In that case, the scroll reset on the standalone mirror may need to be skipped (acceptable degradation — dev server is the canonical user experience). Document in commit message if mirroring is partial.

- [ ] **Step 5: Write the scroll-reset test**

Create `tests/poem-page-scroll-reset.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PoemPage } from '../src/pages/PoemPage';

// Real IDs from src/data/poems.json:
//  c35a60c1a8e2 静夜思 (corpus: 'both') — always in scope
//  c987db20a4d7 赠刘景文 by 苏轼 (corpus: 'primary') — needs primary corpus
// Verify scrollTop resets to 0 when navigating between poems.

describe('PoemPage scroll reset', () => {
  beforeEach(() => localStorage.clear());

  it('resets scrollTop to 0 when poem.id changes', async () => {
    localStorage.setItem('feihuaCorpus', 'all');
    const { container, rerender } = render(
      <MemoryRouter initialEntries={['/poem/c35a60c1a8e2']}>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );

    // Find the scrollable paper container — search for an element with overflowY: 'auto'
    // or scrollHeight > clientHeight in jsdom.
    // Simulate scroll: jsdom doesn't auto-resize, so manually set scrollTop.
    const paperDiv = container.querySelector('div[style*="overflow"]') as HTMLElement;
    expect(paperDiv).toBeTruthy();
    paperDiv.scrollTop = 200;
    expect(paperDiv.scrollTop).toBe(200);

    // Re-render with a different poem id via the same component (simulating navigation).
    // Since useEffect deps are on poem.id, the reset should fire.
    // Use act() to flush effects.
    const { act } = await import('react');
    await act(async () => {
      rerender(
        <MemoryRouter initialEntries={['/poem/c987db20a4d7']}>
          <CorpusProvider>
            <Routes>
              <Route path="/poem/:poemId" element={<PoemPage />} />
            </Routes>
          </CorpusProvider>
        </MemoryRouter>
      );
    });

    // After navigation, the new paper container should have scrollTop === 0.
    const newPaperDiv = container.querySelector('div[style*="overflow"]') as HTMLElement;
    expect(newPaperDiv.scrollTop).toBe(0);
  });
});
```

- [ ] **Step 6: Run test**

Run: `npx vitest run tests/poem-page-scroll-reset.test.tsx`
Expected: PASS

If the test fails because `container.querySelector('div[style*="overflow"]')` doesn't find the right element, inspect the rendered DOM and adjust the selector. The selector should match the `<div>` containing `overflowY: 'auto'`.

- [ ] **Step 7: Verify all tests + tsc + standalone**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected: all pass. `tests/poem-page-corpus.test.tsx` continues to pass.

- [ ] **Step 8: Manual visual check (optional)**

```bash
npm run dev
```

- Open a poem, scroll down, press → (next poem). Verify scroll is at top AND there's a 0.3s fade-in.
- Navigate from one poet to another via `/poet/<id>`. Verify scroll is at top.

- [ ] **Step 9: Commit**

```bash
git add src/pages/PoemPage.tsx src/pages/PoetPage.tsx src/styles.css tests/poem-page-scroll-reset.test.tsx scripts/build-standalone.cjs
git commit -m "T7: scroll reset on PoemPage/PoetPage id change; fade-in keyframe + content animation"
```

---

### Task 8: P2 体验感 — River 页面切库 fade + 节点 :active

**Files:**
- Modify: `src/pages/RiverPage.tsx` — canvas `key={corpus}` + node `:active` style
- Modify: `src/pages/PoemsRiverPage.tsx` — canvas `key={corpus}` + node `:active` style
- Modify: `scripts/build-standalone.cjs` — 同步两处内联块

**Interfaces:**
- Consumes: 无新增
- Produces: 切库淡入 + 节点按下 scale(0.92) 反馈

- [ ] **Step 1: RiverPage — canvas key + node :active**

In `src/pages/RiverPage.tsx`:

Change 1 — Find the inner canvas `<div style={{ position: 'relative', width: '600%', height: '100%', ...vp.canvasStyle }}>` (around line 45-48) and add `key={corpus}` and an animation style:

```tsx
<div
  key={corpus}
  style={{
    position: 'relative', width: '600%', height: '100%',
    animation: 'fade-in 0.25s ease-out',
    ...vp.canvasStyle,
  }}
>
```

Change 2 — Find the node outer `<div ... onMouseEnter={...} onMouseLeave={...} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: ... }}>` (around line 78-84). Add `transition: 'transform 0.1s'` and an `:active` style via React's `onMouseDown` / `onMouseUp` OR via CSS pseudo-class. Since inline styles can't express `:active`, use a state-based approach with `onMouseDown`:

```tsx
const [pressedId, setPressedId] = useState<string | null>(null);
// ...
<div
  onMouseEnter={() => setHoverId(poet.id)}
  onMouseLeave={() => setHoverId((id) => (id === poet.id ? null : id))}
  onMouseDown={() => setPressedId(poet.id)}
  onMouseUp={() => setPressedId((id) => (id === poet.id ? null : id))}
  style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    animation: `node-float ${floatDuration}s ease-in-out ${floatDelay}s infinite`,
    position: 'relative',
    transition: 'transform 0.1s',
    transform: pressedId === poet.id ? 'scale(0.92)' : undefined,
    cursor: 'pointer',
  }}
>
```

Add `useState` to the React import if not already present. Check line 1: `import { useState } from 'react';` — already present.

- [ ] **Step 2: PoemsRiverPage — canvas key + node :active**

Same pattern as RiverPage.

Change 1 — Canvas `<div key={corpus}>` with fade-in animation.

Change 2 — Node outer `<div>` with `pressedId` state and `transform: scale(0.92)` on press.

- [ ] **Step 3: Mirror to build-standalone.cjs**

Find the RiverPage (around line 1407) and PoemsRiverPage (around line 1556) sections in build-standalone.cjs. Apply equivalent changes:
- Add `key={corpus}` to canvas div.
- Add `animation: 'fade-in 0.25s ease-out'` to canvas style.
- Add `pressedId` state + `onMouseDown`/`onMouseUp` to node div.
- Add `transform: pressedId === poet.id ? 'scale(0.92)' : undefined`.

Match the existing inline template style (likely React.createElement or destructured JSX). Search for `node-float` to see the existing animation pattern.

- [ ] **Step 4: Verify all tests + tsc + standalone**

```bash
npm test
npx tsc --noEmit
npm run build:standalone
```

Expected: all pass.

- [ ] **Step 5: Manual visual check (optional)**

```bash
npm run dev
```

- Open `/` (River), click corpus switcher from 唐 → 小学必背. Verify canvas fades in over 0.25s.
- Click on a node and HOLD mouse down: verify node shrinks to 0.92 scale.
- Same for `/poems` (PoemsRiverPage).

- [ ] **Step 6: Commit**

```bash
git add src/pages/RiverPage.tsx src/pages/PoemsRiverPage.tsx scripts/build-standalone.cjs
git commit -m "T8: river canvas fade on corpus switch + node press scale(0.92) feedback"
```

---

## Self-Review (controller pass)

**Spec coverage:**
- ✅ P1 fix #1 TopNav DynastyLabel → Task 3
- ✅ P1 fix #2 PoemPage dynasty → Task 4
- ✅ P1 fix #3 RiverPage hover → Task 5
- ✅ P1 fix #4 PoemsRiverPage range → Task 6
- ✅ P1 fix #5 RiverPage range → Task 5
- ✅ Dynasty data layer → Task 1
- ✅ Year range computation → Task 2
- ✅ P2 scroll reset PoemPage → Task 7
- ✅ P2 scroll reset PoetPage → Task 7
- ✅ P2 fade-in keyframe → Task 7
- ✅ P2 PoemPage content fade → Task 7
- ✅ P2 canvas key on corpus switch → Task 8
- ✅ P2 node :active feedback → Task 8
- ✅ Tests for dynasties → Task 1
- ✅ Tests for yearRange → Task 2
- ✅ Tests for scroll reset → Task 7
- ✅ Mirror to build-standalone.cjs → each task step

**Placeholder scan:**
- No TBDs, TODOs, "implement later" phrases
- Test code is concrete (no "write similar tests")
- Inline code blocks complete in every step

**Type consistency:**
- `DYNASTIES`, `getDynastyName`, `getDynasty` defined in Task 1, used in Tasks 2-5
- `computeCorpusYearRange`, `YearRange` defined in Task 2, used in Tasks 5-6
- `fade-in` keyframe added in Task 7, used in Tasks 7-8

**Risks noted:**
- Standalone hooks mirroring may be partial if standalone uses pre-hooks build (documented in Task 7 Step 4)
- Test selector `div[style*="overflow"]` may need adjustment (documented in Task 7 Step 6)

Plan complete and saved to `docs/superpowers/plans/2026-07-10-interaction-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?