# PoemPage Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure PoemPage into a two-column grid (body left, annotations+background right) with adaptive verse-splitting (clause-per-line for short poems ≤80 chars, couplet-per-line for longer poems).

**Architecture:** Add a pure utility module `src/utils/poemText.ts` that handles three concerns: stripping inline `(X 一作：Y)` variant notes from poem content, choosing a layout mode based on cleaned-text length, and splitting the cleaned text into display lines per mode. PoemPage becomes a 60/40 grid (collapses to single column when right side is empty), with title and pagination spanning full width above/below. The standalone HTML build (`scripts/build-standalone.cjs`) is kept manually in sync since it inlines all source as template strings.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Babel-standalone (for standalone.html build).

## Global Constraints

- **No Git:** Project is not a git repo. Do NOT add commit steps; "verify" steps replace "commit" steps.
- **Dual-source maintenance:** Every source file under `src/` has a manually-synced copy embedded in `scripts/build-standalone.cjs` as a template literal. Each task that touches `src/` must also touch the corresponding section in the build script.
- **Font family:** All Chinese text uses `fontFamilies.chinese` (`'KaiTi', 'STKaiti', serif`) — never override.
- **Existing tests:** 32 vitest tests pass as of plan start. Do not regress.
- **Build verification:** After Task 4, both `npx vitest run` (32+ new tests) and `node scripts/build-standalone.cjs` must succeed, and the output `standalone.html` size must remain <500KB.
- **Color palette:** Use `colors.textPrimary` (`#e8f0ff`) for body and emphasized terms, `colors.textSecondary` (`#a8b8d8`) for explanations, `colors.textDim` (`#6478a0`) for meta. Never raw hex outside `src/theme.ts`.

---

## File Structure

| File | Role | Status |
|---|---|---|
| `src/utils/poemText.ts` | Pure text utilities: extract variant notes, choose layout mode, split into display lines | Create |
| `src/utils/poemText.test.ts` | Vitest coverage for all three utilities | Create |
| `src/theme.ts` | Add two new font sizes: `poemTextShort`, `poemTextLong` | Modify (lines 14-23) |
| `src/pages/PoemPage.tsx` | Replace vertical stack with grid layout; consume new utilities | Modify (whole file) |
| `scripts/build-standalone.cjs` | Sync theme font sizes, embed new `poemTextCode` section, replace `poemPageCode` | Modify (3 sections) |

---

## Task 1: Create poem text utilities

**Files:**
- Create: `src/utils/poemText.ts`
- Create: `src/utils/poemText.test.ts`

**Interfaces:**

This task exposes the following for downstream tasks (no internal dependencies):

```ts
export type PoemMode = 'short' | 'long';
export type VariantKind = '一作' | '通';

export interface Variant {
  original: string;   // e.g. "倾耳听"
  variant: string;    // e.g. "侧耳听"
  kind: VariantKind;  // "一作" or "通"
}

export interface ExtractResult {
  cleanText: string;       // content with variant parens removed
  variants: Variant[];     // extracted variant notes
}

export function extractVariants(content: string): ExtractResult;
export function getPoemMode(cleanText: string): PoemMode;
export function splitIntoLines(content: string, mode: PoemMode): string[];
```

- [ ] **Step 1: Write the failing test file**

Create `src/utils/poemText.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { extractVariants, getPoemMode, splitIntoLines } from './poemText';

describe('extractVariants', () => {
  it('returns clean text unchanged when no variants present', () => {
    const r = extractVariants('寥落古行宫，宫花寂寞红。');
    expect(r.cleanText).toBe('寥落古行宫，宫花寂寞红。');
    expect(r.variants).toEqual([]);
  });

  it('extracts a single 一作 variant', () => {
    const r = extractVariants('请君为我倾耳听。(倾耳听 一作：侧耳听)');
    expect(r.cleanText).toBe('请君为我倾耳听。');
    expect(r.variants).toEqual([
      { original: '倾耳听', variant: '侧耳听', kind: '一作' },
    ]);
  });

  it('extracts multiple variants separated by ；within one paren', () => {
    const r = extractVariants('x(不足贵 一作：何足贵；不愿醒 一作：不复醒)y');
    expect(r.cleanText).toBe('xy');
    expect(r.variants).toEqual([
      { original: '不足贵', variant: '何足贵', kind: '一作' },
      { original: '不愿醒', variant: '不复醒', kind: '一作' },
    ]);
  });

  it('extracts 通 variants', () => {
    const r = extractVariants('x(惟 通：唯)y');
    expect(r.variants).toEqual([
      { original: '惟', variant: '唯', kind: '通' },
    ]);
  });

  it('extracts mixed 一作 and 通 in same paren', () => {
    const r = extractVariants('x(古来 一作：自古；惟 通：唯)y');
    expect(r.variants).toEqual([
      { original: '古来', variant: '自古', kind: '一作' },
      { original: '惟', variant: '唯', kind: '通' },
    ]);
  });

  it('handles half-width colon after marker', () => {
    const r = extractVariants('x(倾耳听 一作: 侧耳听)y');
    expect(r.variants).toEqual([
      { original: '倾耳听', variant: '侧耳听', kind: '一作' },
    ]);
  });

  it('preserves non-variant parenthetical asides', () => {
    const r = extractVariants('正文（不是变体注释）继续。');
    expect(r.cleanText).toBe('正文（不是变体注释）继续。');
    expect(r.variants).toEqual([]);
  });

  it('extracts variants from real-world 将进酒 excerpt', () => {
    const content = '与君歌一曲，请君为我倾耳听。(倾耳听 一作：侧耳听)钟鼓馔玉不足贵，但愿长醉不愿醒。(不足贵 一作：何足贵；不愿醒 一作：不复醒)';
    const r = extractVariants(content);
    expect(r.cleanText).toBe('与君歌一曲，请君为我倾耳听。钟鼓馔玉不足贵，但愿长醉不愿醒。');
    expect(r.variants.length).toBe(3);
    expect(r.variants[0]).toEqual({ original: '倾耳听', variant: '侧耳听', kind: '一作' });
  });
});

describe('getPoemMode', () => {
  it('returns short for <= 80 chars', () => {
    expect(getPoemMode('寥落古行宫，宫花寂寞红。白头宫女在，闲坐说玄宗。')).toBe('short');
  });

  it('returns long for > 80 chars', () => {
    const long = '汉皇重色思倾国，御宇多年求不得。杨家有女初长成，养在深闺人未识。天生丽质难自弃，一朝选在君王侧。回眸一笑百媚生，六宫粉黛无颜色。春寒赐浴华清池，温泉水滑洗凝脂。侍儿扶起娇无力，始是新承恩泽时。';
    expect(long.length).toBeGreaterThan(80);
    expect(getPoemMode(long)).toBe('long');
  });

  it('boundary: 80 chars → short, 81 chars → long', () => {
    expect(getPoemMode('a'.repeat(80))).toBe('short');
    expect(getPoemMode('a'.repeat(81))).toBe('long');
  });
});

describe('splitIntoLines', () => {
  it('short mode: splits on each clause terminator', () => {
    const lines = splitIntoLines('寥落古行宫，宫花寂寞红。白头宫女在，闲坐说玄宗。', 'short');
    expect(lines).toEqual([
      '寥落古行宫，',
      '宫花寂寞红。',
      '白头宫女在，',
      '闲坐说玄宗。',
    ]);
  });

  it('long mode: keeps comma inside line, splits only on 。？！', () => {
    const lines = splitIntoLines('君不见黄河之水天上来，奔流到海不复回。君不见高堂明镜悲白发，朝如青丝暮成雪。', 'long');
    expect(lines).toEqual([
      '君不见黄河之水天上来，奔流到海不复回。',
      '君不见高堂明镜悲白发，朝如青丝暮成雪。',
    ]);
  });

  it('short mode: splits on ！ and ？ too', () => {
    const lines = splitIntoLines('谁家玉笛暗飞声？散入春风满洛城。', 'short');
    expect(lines).toEqual(['谁家玉笛暗飞声？', '散入春风满洛城。']);
  });

  it('short mode: splits on ； as a clause terminator', () => {
    const lines = splitIntoLines('first；second。', 'short');
    expect(lines).toEqual(['first；', 'second。']);
  });

  it('long mode: does NOT split on ，', () => {
    const lines = splitIntoLines('出句，对句。', 'long');
    expect(lines).toEqual(['出句，对句。']);
  });

  it('handles content with no terminators by returning single line', () => {
    const lines = splitIntoLines('no terminators here', 'short');
    expect(lines).toEqual(['no terminators here']);
  });

  it('long mode: 将进酒 multi-comma line stays on one line', () => {
    const content = '岑夫子，丹丘生，将进酒，杯莫停。';
    expect(splitIntoLines(content, 'long')).toEqual([content]);
  });
});
```

- [ ] **Step 2: Run the test suite to verify it fails**

Run: `cd D:/claude/诗文长河 && npx vitest run src/utils/poemText.test.ts`
Expected: FAIL with "Failed to resolve import" or "extractVariants is not a function" — because `./poemText` does not exist yet.

- [ ] **Step 3: Write the implementation**

Create `src/utils/poemText.ts` with this exact content:

```ts
// Pure utilities for poem text rendering. Three concerns:
// 1. Strip inline "(X 一作：Y)" / "(X 通：Y)" variant notes from poem content.
// 2. Choose a layout mode (short vs long) based on cleaned text length.
// 3. Split cleaned text into display lines per mode.

export type PoemMode = 'short' | 'long';
export type VariantKind = '一作' | '通';

export interface Variant {
  original: string;
  variant: string;
  kind: VariantKind;
}

export interface ExtractResult {
  cleanText: string;
  variants: Variant[];
}

// Threshold: 80 chars covers 5绝 (24), 7绝 (32), 5律 (48), 7律 (64) with
// punctuation. Longer Old-style / 歌行 / long 词 forms exceed 80.
const SHORT_POEM_THRESHOLD = 80;

// Match a full-width paren and capture its inner content (no nesting).
const PAREN_RE = /\(([^()]+)\)/g;

// Inside a variant paren, each ;-separated piece looks like:
//   <original> 一作： <variant>   |   <original> 通： <variant>
// Colon may be full-width (：) or half-width (:). Whitespace tolerant.
const VARIANT_PIECE_RE = /^(.+?)\s+(一作|通)\s*[：:]\s*(.+)$/;

/**
 * Pull every `(X 一作：Y)` / `(X 通：Y)` annotation out of the body. A paren is
 * treated as a variant group only when EVERY `；`-separated piece inside it
 * matches the variant pattern — so ordinary asides like `（注释）` stay put.
 */
export function extractVariants(content: string): ExtractResult {
  const variants: Variant[] = [];
  const cleanText = content.replace(PAREN_RE, (full, inside: string) => {
    const pieces = inside.split(/[；;]/).map((s) => s.trim());
    const parsed: Variant[] = [];
    for (const piece of pieces) {
      const m = piece.match(VARIANT_PIECE_RE);
      if (!m) return full; // not a variant piece → keep whole paren verbatim
      parsed.push({
        original: m[1].trim(),
        kind: m[2] as VariantKind,
        variant: m[3].trim(),
      });
    }
    if (parsed.length === 0) return full;
    variants.push(...parsed);
    return ''; // strip from body
  });
  return { cleanText, variants };
}

export function getPoemMode(cleanText: string): PoemMode {
  return cleanText.length <= SHORT_POEM_THRESHOLD ? 'short' : 'long';
}

// Short mode splits on every clause terminator; long mode only on sentence
// terminators (keeps ，-joined couplets on one line). `*` allows empty leading
// segment so consecutive terminators don't crash; trailing non-terminated text
// is appended as its own line.
const SHORT_LINE_RE = /[^，。？！；]*[，。？！；]/g;
const LONG_LINE_RE = /[^。？！]*[。？！]/g;

export function splitIntoLines(content: string, mode: PoemMode): string[] {
  const re = mode === 'short' ? SHORT_LINE_RE : LONG_LINE_RE;
  const matches = content.match(re) || [];
  const consumed = matches.join('');
  const trailing = content.slice(consumed.length).trim();
  const lines = matches.map((s) => s.trim()).filter((s) => s.length > 0);
  if (trailing) lines.push(trailing);
  return lines.length > 0 ? lines : [content.trim()].filter((s) => s.length > 0);
}
```

- [ ] **Step 4: Run the test suite to verify all tests pass**

Run: `cd D:/claude/诗文长河 && npx vitest run src/utils/poemText.test.ts`
Expected: PASS — all 15 tests green.

- [ ] **Step 5: Verify the full suite is not regressed**

Run: `cd D:/claude/诗文长河 && npx vitest run`
Expected: PASS — previous 32 tests + 15 new tests = 47 total, all green.

---

## Task 2: Add poem font sizes to theme

**Files:**
- Modify: `src/theme.ts:14-23` (the `fontSizes` object)
- Modify: `scripts/build-standalone.cjs:33-42` (the inline `fontSizes` copy)

**Interfaces:**

Adds two new keys to the existing `fontSizes` const. Existing keys (`body`, `meta`, `nodeDefault`, `nodeLarge`, `nodeFocal`, `poemTitle`, `poemText`, `sectionTitle`) remain unchanged. Downstream tasks access these as `fontSizes.poemTextShort` (20) and `fontSizes.poemTextLong` (17).

- [ ] **Step 1: Update `src/theme.ts`**

In `src/theme.ts`, locate the `fontSizes` object (currently lines 14-23). Add two keys **after `poemText: 18,` and before `sectionTitle: 16,`**:

The current state:
```ts
export const fontSizes = {
  body: 14,
  meta: 14,
  nodeDefault: 16,
  nodeLarge: 20,
  nodeFocal: 26,
  poemTitle: 26,
  poemText: 18,
  sectionTitle: 16,
} as const;
```

The new state:
```ts
export const fontSizes = {
  body: 14,
  meta: 14,
  nodeDefault: 16,
  nodeLarge: 20,
  nodeFocal: 26,
  poemTitle: 26,
  poemText: 18,
  poemTextShort: 20,
  poemTextLong: 17,
  sectionTitle: 16,
} as const;
```

Use the Edit tool with `old_string` = the existing block and `new_string` = the new block. Both blocks must match the file exactly (the file uses 2-space indentation).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/claude/诗文长河 && npx tsc --noEmit`
Expected: PASS — no errors.

- [ ] **Step 3: Sync to standalone build script**

In `scripts/build-standalone.cjs`, locate the `fontSizes` block (lines 33-42). Use the Edit tool to perform the same insertion (also after `poemText: 18,` and before `sectionTitle: 16,`):

old_string:
```
  poemText: 18,
  sectionTitle: 16,
};
```

new_string:
```
  poemText: 18,
  poemTextShort: 20,
  poemTextLong: 17,
  sectionTitle: 16,
};
```

- [ ] **Step 4: Verify standalone build still succeeds**

Run: `cd D:/claude/诗文长河 && node scripts/build-standalone.cjs`
Expected: prints success message; `standalone.html` regenerated. (Task 4 will replace more of this file, but for now the build must still succeed with the two new keys in place.)

---

## Task 3: Restructure PoemPage to grid layout

**Files:**
- Modify: `src/pages/PoemPage.tsx` (full file replacement)

**Interfaces:**

Consumes:
- `extractVariants`, `getPoemMode`, `splitIntoLines` from `../utils/poemText` (Task 1)
- `fontSizes.poemTextShort`, `fontSizes.poemTextLong` from `../theme` (Task 2)
- Existing `colors`, `fontFamilies`, `fontSizes`, `TopNav`, `getPoem`, `getPoet`, `getNeighbors`

- [ ] **Step 1: Replace `src/pages/PoemPage.tsx` with the new implementation**

Use the Write tool to overwrite the entire file with this content:

```tsx
import { useParams, Link, useLocation } from 'react-router-dom';
import { getPoem, getPoet, getNeighbors } from '../data/load';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes } from '../theme';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';

export function PoemPage() {
  const { poemId } = useParams<{ poemId: string }>();
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const { prev, next } = getNeighbors(poem.id);
  const backTo = fromPath ?? `/poet/${poet.id}`;
  const backLabel = fromPath === '/poems' ? '返回诗文' : `返回${poet.name}`;
  const linkState = { from: fromPath };

  // Strip inline variants, pick layout mode, split into display lines.
  const { cleanText, variants } = extractVariants(poem.content);
  const mode = getPoemMode(cleanText);
  const lines = splitIntoLines(cleanText, mode);

  const hasAnnotations = poem.annotations.length > 0;
  const hasVariants = variants.length > 0;
  const hasBackground = Boolean(poem.background);
  const hasRightContent = hasAnnotations || hasVariants || hasBackground;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} backTo={backTo} backLabel={backLabel} />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient }}>
        {/* 月夜氛围带 */}
        <div style={{ position: 'relative', height: 70, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 16, right: '14%',
            width: 36, height: 36, borderRadius: '50%',
            background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
            boxShadow: '0 0 30px rgba(216,224,240,0.4)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(circle at 18% 40%, #fff 0.6px, transparent 1.5px),
              radial-gradient(circle at 38% 20%, #e8f0ff 0.6px, transparent 1.5px),
              radial-gradient(circle at 62% 50%, #fff 0.5px, transparent 1.5px),
              radial-gradient(circle at 82% 25%, #e8f0ff 0.6px, transparent 1.5px)
            `,
          }} />
        </div>

        {/* 标题区（跨栏） */}
        <div style={{ padding: '8px 32px 24px', textAlign: 'center' }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: '#fff',
            fontSize: fontSizes.poemTitle, letterSpacing: 8,
            marginBottom: 8, fontWeight: 600,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{poem.title}</div>
          <div style={{
            color: colors.textDim, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.body, letterSpacing: 3,
          }}>{poet.name} · 唐</div>
        </div>

        {/* 主体 grid */}
        <div style={{
          padding: '0 32px 28px',
          display: 'grid',
          gridTemplateColumns: hasRightContent ? '60fr 40fr' : '1fr',
          gap: 48,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {/* 左：正文 */}
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: mode === 'short' ? fontSizes.poemTextShort : fontSizes.poemTextLong,
            lineHeight: mode === 'short' ? 2.4 : 2.0,
            letterSpacing: mode === 'short' ? 4 : 2,
            textAlign: mode === 'short' ? 'center' : 'left',
            paddingLeft: mode === 'long' ? 24 : 0,
          }}>
            {lines.map((line, i) => <div key={i}>{line}</div>)}
          </div>

          {/* 右：注释 + 异文 + 背景 */}
          {hasRightContent && (
            <div>
              {hasAnnotations && (
                <section>
                  <SectionTitle>注 释</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 1.9,
                  }}>
                    {poem.annotations.map((a, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <span style={{ color: colors.textPrimary }}>{a.term}：</span>
                        {a.explanation}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {hasVariants && (
                <section style={{ marginTop: hasAnnotations ? 32 : 0 }}>
                  <SectionTitle>异 文</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 1.9,
                  }}>
                    {variants.map((v, i) => (
                      <div key={i} style={{ marginBottom: 12 }}>
                        <span style={{ color: colors.textPrimary }}>{v.original}：</span>
                        {v.kind}「{v.variant}」
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {hasBackground && (
                <section style={{ marginTop: (hasAnnotations || hasVariants) ? 32 : 0 }}>
                  <SectionTitle>创 作 背 景</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 2,
                  }}>{poem.background}</div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* 翻页（跨栏） */}
        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {prev ? (
            <Link to={`/poem/${prev.id}`} state={linkState} style={navCardStyle}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{prev.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是第一首）</div>
            </div>
          )}
          {next ? (
            <Link to={`/poem/${next.id}`} state={linkState} style={{ ...navCardStyle, textAlign: 'right' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{next.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, textAlign: 'right', opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是最后一首）</div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

const navCardStyle: React.CSSProperties = {
  flex: 1, padding: '14px 18px',
  background: 'rgba(216,224,240,0.05)',
  border: '1px solid rgba(216,224,240,0.18)',
  borderRadius: 4,
  textDecoration: 'none',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
```

Notes on what changed vs the old file:
- Added `extractVariants`, `getPoemMode`, `splitIntoLines` import.
- Replaced the centered "原文" block (was lines 49-66) with a grid container that has the title above and two columns below.
- Title block now sits BETWEEN the atmosphere band and the grid (it was previously inside the "原文" block).
- The "注释" / "创作背景" sections are now children of the right grid column, no longer separated by `<Divider />` (the column gap visually separates them).
- Body text uses `mode === 'short' ? fontSizes.poemTextShort : fontSizes.poemTextLong` and conditionally centers (short) or left-aligns (long).
- `Divider` helper removed (no longer used).
- When `hasRightContent` is false, grid collapses to one column (`1fr`).
- A new "异 文" section appears when variants were stripped, showing each as `original：一作「variant」` or `original：通「variant」`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd D:/claude/诗文长河 && npx tsc --noEmit`
Expected: PASS — no errors. If you see "Property 'poemTextShort' does not exist", recheck Task 2 step 1.

- [ ] **Step 3: Verify vitest still passes**

Run: `cd D:/claude/诗文长河 && npx vitest run`
Expected: PASS — all 47 tests still green (no test changes needed for PoemPage itself; the page is exercised via integration in later tasks).

- [ ] **Step 4: Run the dev server and visually verify**

Run: `cd D:/claude/诗文长河 && npm run dev`

Open the dev URL in a browser. Visit these routes one by one and confirm:

1. **Short poem (行宫, 24 chars):** `/poem/45c396367f59`
   - Body in 4 lines, centered, large font.
   - 6 annotations on the right side.
   - 创作背景 below annotations on right.
2. **Short poem (登鹳雀楼, 24 chars):** `/poem/c90ff9ea5a71`
   - Same shape, 4 centered lines.
3. **Long poem with stripped variants (将进酒):** find its ID via the poems list — load it.
   - Body in long mode (one couplet per line), left-aligned.
   - Right side has "异 文" section listing the stripped variants (倾耳听 → 侧耳听, etc.).
4. **Long poem with 0 annotations but has variants (长恨歌):** load it.
   - Right side shows "异 文" only (no 注释 section, since annotations array is empty).
   - Background section below.
5. **A poem with neither annotations nor background** (if any exists): body should occupy full width — no right column, no grid gap.

Stop the dev server with Ctrl+C when done.

---

## Task 4: Sync utilities + PoemPage to standalone build

**Files:**
- Modify: `scripts/build-standalone.cjs` — two sections:
  - Insert new `poemTextCode` block after the layout block ends (after line 267, before line 269).
  - Replace `poemPageCode` block (lines 1179-1330).

**Interfaces:**

Same as Tasks 1+3, but expressed in plain JS (no TypeScript types) and embedded as a template literal. The build script reads `src/styles.css`, `poets.json`, `poems.json`, then concatenates all `*Code` template literals into a single in-browser Babel-compiled bundle.

- [ ] **Step 1: Insert `poemTextCode` into the standalone build**

In `scripts/build-standalone.cjs`, locate the end of the `layoutCode` block. It ends at line 267 with:

```js
`;
```

The next line (269) begins a comment: `// utils/search.ts (types dropped; ...)`

Use the Edit tool to insert a new `poemTextCode` block BETWEEN them.

old_string (the closing backtick of layoutCode + the search.ts comment that follows):

```
`;
}

// utils/search.ts (types dropped; \`poems\` already declared in load.ts scope — reuse it)
```

⚠ Note: the actual closing of layoutCode is the literal characters above. Read the file around lines 264-271 to confirm the exact text before editing.

new_string (insert poemTextCode between layoutCode and searchCode):

```
`;
}

// utils/poemText.ts (types dropped)
const poemTextCode = `
// ===== utils/poemText.ts =====
function extractVariants(content) {
  const variants = [];
  const cleanText = content.replace(/\\(([^()]+)\\)/g, function(full, inside) {
    const pieces = inside.split(/[；;]/).map(function(s) { return s.trim(); });
    const parsed = [];
    for (let i = 0; i < pieces.length; i++) {
      const m = pieces[i].match(/^(.+?)\\s+(一作|通)\\s*[：:]\\s*(.+)$/);
      if (!m) return full;
      parsed.push({ original: m[1].trim(), kind: m[2], variant: m[3].trim() });
    }
    if (parsed.length === 0) return full;
    for (let i = 0; i < parsed.length; i++) variants.push(parsed[i]);
    return '';
  });
  return { cleanText: cleanText, variants: variants };
}

function getPoemMode(cleanText) {
  return cleanText.length <= 80 ? 'short' : 'long';
}

function splitIntoLines(content, mode) {
  const re = mode === 'short'
    ? /[^，。？！；]*[，。？！；]/g
    : /[^。？！]*[。？！]/g;
  const matches = content.match(re) || [];
  const consumed = matches.join('');
  const trailing = content.slice(consumed.length).trim();
  const lines = matches.map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  if (trailing) lines.push(trailing);
  return lines.length > 0 ? lines : [content.trim()].filter(function(s) { return s.length > 0; });
}
`;

// utils/search.ts (types dropped; \`poems\` already declared in load.ts scope — reuse it)
```

Notes on escaping:
- Inside a JS template literal, `\(` and `\)` need to be written as `\\(` and `\\)`.
- `\s` → `\\s`.
- `\d` → `\\d` (not used here, but same rule).
- The `[：:]` is fine as-is.
- `[；;]` would also be fine; we use `[；;]` form is fine — but this version uses `[；;]`? Wait, the source uses `/[；;]/` (only full-width). Let me match the source exactly: source uses `split(/[；;]/)` — that's full-width only. Keep consistent.

⚠ Actually re-read: the source `poemText.ts` uses `/[；;]/` (full-width only). The standalone version above also uses `/[；;]/`. Good — they match.

- [ ] **Step 2: Locate the existing `poemPageCode` block to replace**

Run: `cd D:/claude/诗文长河 && grep -n "poemPageCode" scripts/build-standalone.cjs`

Expected: matches at the declaration line (around line 1181) and wherever the code is concatenated into the bundle output (search for `${poemPageCode}`).

The block to replace spans from `const poemPageCode = \`` (around line 1181) to the closing `\`;` (around line 1330). Read these lines to confirm the exact start and end before editing.

- [ ] **Step 3: Replace `poemPageCode` with the synced version**

Use the Edit tool. The `old_string` is the entire current `poemPageCode` block. To keep the Edit call manageable, do it in two sub-edits if needed:

**Sub-edit 3a — Replace the body of `PoemPage()`** (everything from `function PoemPage() {` through the closing `}` of the function, inside the template literal):

old_string begins with:
```
function PoemPage() {
  const { poemId } = useParams();
```

…and ends with the function's closing brace (around line 1308).

new_string is the same function written in plain JSX-stripped JS. Use this content (note: no TypeScript generics on `useParams`, no `<{ poemId: string }>`, no `as { from?: string }`, no `: React.CSSProperties`):

```js
function PoemPage() {
  const { poemId } = useParams();
  const location = useLocation();
  const fromPath = location.state ? location.state.from : null;
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const { prev, next } = getNeighbors(poem.id);
  const backTo = fromPath != null ? fromPath : \`/poet/\${poet.id}\`;
  const backLabel = fromPath === '/poems' ? '返回诗文' : \`返回\${poet.name}\`;
  const linkState = { from: fromPath };

  const extracted = extractVariants(poem.content);
  const cleanText = extracted.cleanText;
  const variants = extracted.variants;
  const mode = getPoemMode(cleanText);
  const lines = splitIntoLines(cleanText, mode);

  const hasAnnotations = poem.annotations.length > 0;
  const hasVariants = variants.length > 0;
  const hasBackground = Boolean(poem.background);
  const hasRightContent = hasAnnotations || hasVariants || hasBackground;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} backTo={backTo} backLabel={backLabel} />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient }}>
        <div style={{ position: 'relative', height: 70, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 16, right: '14%',
            width: 36, height: 36, borderRadius: '50%',
            background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
            boxShadow: '0 0 30px rgba(216,224,240,0.4)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: \`
              radial-gradient(circle at 18% 40%, #fff 0.6px, transparent 1.5px),
              radial-gradient(circle at 38% 20%, #e8f0ff 0.6px, transparent 1.5px),
              radial-gradient(circle at 62% 50%, #fff 0.5px, transparent 1.5px),
              radial-gradient(circle at 82% 25%, #e8f0ff 0.6px, transparent 1.5px)
            \`,
          }} />
        </div>

        <div style={{ padding: '8px 32px 24px', textAlign: 'center' }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: '#fff',
            fontSize: fontSizes.poemTitle, letterSpacing: 8,
            marginBottom: 8, fontWeight: 600,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{poem.title}</div>
          <div style={{
            color: colors.textDim, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.body, letterSpacing: 3,
          }}>{poet.name} · 唐</div>
        </div>

        <div style={{
          padding: '0 32px 28px',
          display: 'grid',
          gridTemplateColumns: hasRightContent ? '60fr 40fr' : '1fr',
          gap: 48,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: mode === 'short' ? fontSizes.poemTextShort : fontSizes.poemTextLong,
            lineHeight: mode === 'short' ? 2.4 : 2.0,
            letterSpacing: mode === 'short' ? 4 : 2,
            textAlign: mode === 'short' ? 'center' : 'left',
            paddingLeft: mode === 'long' ? 24 : 0,
          }}>
            {lines.map(function(line, i) { return <div key={i}>{line}</div>; })}
          </div>

          {hasRightContent && (
            <div>
              {hasAnnotations && (
                <section>
                  <SectionTitle>注 释</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 1.9,
                  }}>
                    {poem.annotations.map(function(a, i) {
                      return (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <span style={{ color: colors.textPrimary }}>{a.term}：</span>
                          {a.explanation}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {hasVariants && (
                <section style={{ marginTop: hasAnnotations ? 32 : 0 }}>
                  <SectionTitle>异 文</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 1.9,
                  }}>
                    {variants.map(function(v, i) {
                      return (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <span style={{ color: colors.textPrimary }}>{v.original}：</span>
                          {v.kind}「{v.variant}」
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {hasBackground && (
                <section style={{ marginTop: (hasAnnotations || hasVariants) ? 32 : 0 }}>
                  <SectionTitle>创 作 背 景</SectionTitle>
                  <div style={{
                    color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                    fontSize: fontSizes.body, lineHeight: 2,
                  }}>{poem.background}</div>
                </section>
              )}
            </div>
          )}
        </div>

        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {prev ? (
            <Link to={\`/poem/\${prev.id}\`} state={linkState} style={navCardStyle}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{prev.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是第一首）</div>
            </div>
          )}
          {next ? (
            <Link to={\`/poem/\${next.id}\`} state={linkState} style={{ ...navCardStyle, textAlign: 'right' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{next.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, textAlign: 'right', opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是最后一首）</div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}
```

**Sub-edit 3b — Update the trailing helper declarations.**

The current template literal also defines `navCardStyle`, `Divider`, and `SectionTitle` (lines 1310-1329 in the current file). The new version drops `Divider` (no longer used). Leave `navCardStyle` and `SectionTitle` as they are.

Specifically: locate this block inside the template literal:

```js
const navCardStyle = {
  flex: 1, padding: '14px 18px',
  background: 'rgba(216,224,240,0.05)',
  border: '1px solid rgba(216,224,240,0.18)',
  borderRadius: 4,
  textDecoration: 'none',
};

function Divider() {
  return <div style={{ margin: '0 32px', borderTop: '1px dashed rgba(216,224,240,0.18)' }} />;
}

function SectionTitle({ children }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
```

Replace with (just remove `Divider`):

```js
const navCardStyle = {
  flex: 1, padding: '14px 18px',
  background: 'rgba(216,224,240,0.05)',
  border: '1px solid rgba(216,224,240,0.18)',
  borderRadius: 4,
  textDecoration: 'none',
};

function SectionTitle({ children }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
```

- [ ] **Step 4: Wire `poemTextCode` into the bundle assembly**

The build script concatenates the `*Code` constants somewhere into a final bundle string. Find that concatenation:

Run: `cd D:/claude/诗文长河 && grep -n "layoutCode\|searchCode\|poemPageCode" scripts/build-standalone.cjs | head -20`

You'll see where `${layoutCode}` and `${searchCode}` are interpolated into the final bundle template. Add `${poemTextCode}` immediately AFTER `${layoutCode}` (and before `${searchCode}`). The order matters because PoemPage (which calls `extractVariants`) must come after the function is defined — but actually JS function declarations are hoisted within their scope, so in practice order is flexible. Still, put it after layoutCode for symmetry with file ordering in `src/utils/`.

Use the Edit tool with `old_string` = the line containing `${layoutCode}` (read the file to see the exact surrounding context) and `new_string` = the same line plus a new line with `${poemTextCode}`.

- [ ] **Step 5: Run the standalone build and verify output**

Run: `cd D:/claude/诗文长河 && node scripts/build-standalone.cjs`

Expected: script prints a success message (e.g., "wrote standalone.html, NNNN bytes"). The output size should be roughly the prior size + ~3KB for the new utility and longer PoemPage. Should remain under 500,000 bytes.

- [ ] **Step 6: Open the standalone HTML and visually verify**

Open `D:/claude/诗文长河/standalone.html` directly in a browser (double-click or `file://` URL).

Navigate via the hash router to the same five poems checked in Task 3 Step 4:
- `#/poem/45c396367f59` (行宫)
- `#/poem/c90ff9ea5a71` (登鹳雀楼)
- 将进酒 (find ID via the poems list)
- 长恨歌 (find ID via the poems list)
- A poem with no annotations and no background

Confirm each renders identically to the dev server version from Task 3 Step 4.

- [ ] **Step 7: Final regression — vitest + tsc**

Run both:

```bash
cd D:/claude/诗文长河 && npx vitest run
cd D:/claude/诗文长河 && npx tsc --noEmit
```

Expected: 47 tests pass, no TypeScript errors.

---

## Self-Review Notes

This plan was checked against the design (Sections 1-4 of the brainstorming dialogue):

- ✅ Section 1 (overall layout): Title above grid, two-column 60/40 grid, pagination below — covered in Task 3.
- ✅ Section 2 (splitting rules): 80-char threshold, short mode splits on `，。？！；`, long mode splits on `。？！`, variants stripped — covered in Task 1, applied in Task 3.
- ✅ Section 3 (visual): font sizes 20/17 for short/long, alignment conditional on mode, whole-page scroll, no separate scroll containers — covered in Task 3 (inline styles).
- ✅ Section 4 (edge cases): all 7 cases (multi-comma, empty right column, variants-only long poems, etc.) handled by `hasRightContent` collapsing + 异文 section logic.
- ✅ Standalone build kept in sync: Tasks 2 and 4 explicitly mirror src changes into `scripts/build-standalone.cjs`.
