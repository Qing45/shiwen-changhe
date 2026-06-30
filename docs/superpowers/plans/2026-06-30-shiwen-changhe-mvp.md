# 诗文长河 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Web app that renders 唐诗三百首 as a moonlit ink-wash horizontal river, with per-poet sub-rivers and a poem reading view, data scraped from gushiwen.cn.

**Architecture:** Vite + React + TypeScript SPA. React Router v6 wires three pages (main river / poet sub-river / poem reading). Static JSON data is produced by a Node.js scraper (cheerio + native fetch) run as a build-time script. Visual style is pure CSS gradients — no image assets in MVP.

**Tech Stack:** Vite 5, React 18, TypeScript 5, React Router v6, Vitest, @testing-library/react, cheerio, tsx, native fetch (Node 18+)

## Global Constraints

- Chinese text uses `font-family: 'KaiTi', 'STKaiti', serif`
- All visible font sizes ≥ 14px
- Page background gradient: `linear-gradient(180deg, #050818 0%, #0a1430 40%, #152548 70%, #0a1430 100%)`
- River line gradient: `linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.5) 8%, rgba(240,244,255,0.85) 50%, rgba(216,224,240,0.5) 92%, transparent 100%)`
- Familiarity 1–5 maps to node diameter {10, 12, 14, 18, 22}px
- Scraper rate limit: ≤ 1 request per second to gushiwen.cn
- Scraper cache: `scripts/scraper/.cache/` (gitignored); scraper must be re-runnable and idempotent
- Tests never make network calls — all scraper tests use HTML fixtures under `tests/fixtures/`
- Node 18+ required (for native `fetch`)

---

## File Structure

```
D:/claude/
├── .gitignore
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx                      # React entry
│   ├── App.tsx                       # Router + routes
│   ├── styles.css                    # Base styles
│   ├── theme.ts                      # Color tokens, font sizes, node sizes
│   ├── types.ts                      # Dynasty, Poet, Poem, SearchResult
│   ├── data/
│   │   ├── poems.json                # Scraper output (committed)
│   │   ├── poets.json                # Scraper output (committed)
│   │   └── load.ts                   # Typed accessors (getPoets, getPoet, getPoemsByPoet, getPoem, getNeighbors)
│   ├── utils/
│   │   ├── layout.ts                 # Year → x-position math
│   │   ├── layout.test.ts
│   │   ├── search.ts                 # Build index, query
│   │   └── search.test.ts
│   ├── components/
│   │   ├── RiverBackground.tsx       # Moon, stars, mountains (CSS only)
│   │   ├── RiverLine.tsx             # Horizontal silver line + glow
│   │   ├── TimeAxis.tsx              # Bottom timeline strip
│   │   ├── TopNav.tsx                # Logo + (optional search) + dynasty label
│   │   └── SearchBox.tsx             # Input + dropdown results
│   └── pages/
│       ├── RiverPage.tsx             # Main river of poets
│       ├── PoetPage.tsx              # Sub-river of one poet's poems
│       └── PoemPage.tsx              # Reading page with annotations + prev/next
├── scripts/
│   └── scraper/
│       ├── index.ts                  # Entry: orchestrates full scrape
│       ├── list.ts                   # Fetch 300-poem URL list
│       ├── parse-poem.ts             # Parse single poem HTML
│       ├── normalize.ts              # Convert scraped data → our schema
│       └── .cache/                   # Raw HTML cache (gitignored)
├── tests/
│   ├── fixtures/
│   │   ├── poem-list.html            # Saved sample of gushiwen.cn 唐诗三百首 index
│   │   └── poem-page.html            # Saved sample of one poem page
│   ├── scraper-list.test.ts
│   ├── scraper-parse.test.ts
│   ├── load.test.ts
│   └── app.smoke.test.ts
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-06-29-shiwen-changhe-design.md
        └── plans/
            └── 2026-06-30-shiwen-changhe-mvp.md  # This file
```

**Responsibility notes:**
- `theme.ts` is the single source of truth for colors/sizes — every component imports from here, no hex codes inline
- `data/load.ts` is the only module that touches `poems.json`/`poets.json` directly — components go through it
- `utils/layout.ts` is a pure module (no React) so it's trivial to unit test
- Each page owns its own node rendering (PoetNode / PoemNode are inline, not shared — they differ enough to not force abstraction)

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/theme.ts`, `src/types.ts`
- Create: `.gitignore`, `tests/vitest-setup.ts`

**Interfaces:**
- Produces: `src/types.ts` exports `Dynasty`, `Poet`, `Poem`, `SearchResult` (used by all later tasks)
- Produces: `src/theme.ts` exports `colors`, `fontSizes`, `nodeSizes` (used by all visual tasks)

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "shiwen-changhe",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "scrape": "tsx scripts/scraper/index.ts"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "cheerio": "^1.0.0",
    "jsdom": "^24.1.1",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/vitest-setup.ts',
  },
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Write `src/types.ts`**

```ts
export interface Dynasty {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
}

export interface Poet {
  id: string;
  name: string;
  courtesyName?: string;
  pseudonym?: string;
  birthYear: number;
  deathYear: number;
  dynastyId: string;
  familiarity: number; // 1-5
}

export interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: { term: string; explanation: string }[];
  background?: string;
  creationYear?: number;
  familiarity: number; // 1-5
}

export interface VerseHit {
  poemId: string;
  verse: string;
  poemTitle: string;
  poetName: string;
}

export interface SearchResult {
  poets: Poet[];
  poems: Poem[];
  verses: VerseHit[];
}
```

- [ ] **Step 6: Write `src/theme.ts`**

```ts
export const colors = {
  bgGradient: 'linear-gradient(180deg, #050818 0%, #0a1430 40%, #152548 70%, #0a1430 100%)',
  riverLine: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.5) 8%, rgba(240,244,255,0.85) 50%, rgba(216,224,240,0.5) 92%, transparent 100%)',
  riverGlow: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.1) 8%, rgba(240,244,255,0.18) 50%, rgba(216,224,240,0.1) 92%, transparent 100%)',
  highlight: '#ffffff',
  highlightShadow: '0 0 8px rgba(255,255,255,0.85)',
  textPrimary: '#e8f0ff',
  textSecondary: '#a8b8d8',
  textTertiary: '#8a98b8',
  textDim: '#6478a0',
  textFaint: '#5a6885',
} as const;

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

export const nodeSizes: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 18,
  5: 22,
};

export const fontFamilies = {
  chinese: "'KaiTi', 'STKaiti', serif",
} as const;
```

- [ ] **Step 7: Write `src/App.tsx`** (placeholder, real routing added in Task 8)

```tsx
export default function App() {
  return (
    <div style={{ background: '#050818', color: '#e8f0ff', minHeight: '100vh', padding: 40, fontFamily: "'KaiTi', 'STKaiti', serif" }}>
      诗文长河
    </div>
  );
}
```

- [ ] **Step 8: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: Write `src/styles.css`**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { width: 100%; height: 100%; }
body {
  font-family: 'KaiTi', 'STKaiti', serif;
  background: #050818;
  color: #e8f0ff;
  overflow: hidden;
}
button { font-family: inherit; cursor: pointer; }
```

- [ ] **Step 10: Write `index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>诗文长河</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Write `tests/vitest-setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 12: Write `.gitignore`**

```
node_modules
dist
.vite
scripts/scraper/.cache
```

- [ ] **Step 13: Install deps and verify dev server**

Run: `npm install && npm run dev`
Expected: Vite dev server starts; browser at the printed URL shows "诗文长河" on a dark background. Stop the server with Ctrl+C.

- [ ] **Step 14: Init git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold Vite + React + TS project with theme tokens and types"
```

---

### Task 2: Scraper — poem list fetcher

**Files:**
- Create: `scripts/scraper/list.ts`
- Create: `tests/scraper-list.test.ts`
- Create: `tests/fixtures/poem-list.html` (manually saved sample)

**Interfaces:**
- Produces: `fetchPoemList(): Promise<{ url: string; title: string }[]>` — returns the 300+ poem URLs and titles from the gushiwen.cn 唐诗三百首 index page

**Note on selectors:** gushiwen.cn's HTML structure changes occasionally. The selectors below are best-guess based on typical structure. The implementer **must first save a real sample** of the index page to `tests/fixtures/poem-list.html`, inspect it, and adjust selectors to match. The test asserts against the fixture.

- [ ] **Step 1: Save a real fixture of the index page**

Run: `curl -o tests/fixtures/poem-list.html "https://so.gushiwen.cn/gushiwensang.aspx"`
Then open the file, find the elements containing poem links (typically `<a href="shiwenv_XXXX.aspx">将进酒</a>` inside `<div class="typecont">` blocks), and note the actual selector pattern.

- [ ] **Step 2: Write `tests/scraper-list.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePoemList } from '../scripts/scraper/list';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures/poem-list.html'), 'utf-8');

describe('parsePoemList', () => {
  it('extracts poem entries with url and title', () => {
    const entries = parsePoemList(fixture);
    expect(entries.length).toBeGreaterThan(200);
    expect(entries[0]).toEqual({
      url: expect.stringMatching(/^https:\/\/so\.gushiwen\.cn\/shiwenv_[a-zA-Z0-9]+\.aspx$/),
      title: expect.any(String),
    });
  });

  it('titles are non-empty', () => {
    const entries = parsePoemList(fixture);
    for (const e of entries) {
      expect(e.title.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/scraper-list.test.ts`
Expected: FAIL with "parsePoemList is not a function" or module not found.

- [ ] **Step 4: Write `scripts/scraper/list.ts`**

```ts
import * as cheerio from 'cheerio';

export interface PoemListEntry {
  url: string;
  title: string;
}

const BASE = 'https://so.gushiwen.cn';

/**
 * Parse the 唐诗三百首 index HTML into a list of {url, title} entries.
 *
 * Selectors target gushiwen.cn's typical layout: poem links inside
 * `<div class="typecont">` blocks, with href like `shiwenv_XXXX.aspx`.
 * Adjust selectors if the fixture shows a different structure.
 */
export function parsePoemList(html: string): PoemListEntry[] {
  const $ = cheerio.load(html);
  const entries: PoemListEntry[] = [];

  $('.typecont a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const title = $(el).text().trim();
    if (!href.includes('shiwenv_') || !title) return;
    entries.push({ url: new URL(href, BASE).toString(), title });
  });

  // dedupe by url (index pages sometimes list a poem under multiple categories)
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

async function rateLimitedDelay(ms = 1000): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchPoemList(): Promise<PoemListEntry[]> {
  const url = `${BASE}/gushiwensang.aspx`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch poem list: ${res.status}`);
  const html = await res.text();
  return parsePoemList(html);
}

// When run directly, fetch and print count
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchPoemList().then((entries) => {
    console.log(`Found ${entries.length} poems`);
    console.log(JSON.stringify(entries.slice(0, 3), null, 2));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/scraper-list.test.ts`
Expected: PASS. If the count assertion fails (>200), inspect the fixture and adjust selectors.

- [ ] **Step 6: Commit**

```bash
git add scripts/scraper/list.ts tests/scraper-list.test.ts tests/fixtures/poem-list.html
git commit -m "feat(scraper): parse Tang 300 poem list from gushiwen.cn index"
```

---

### Task 3: Scraper — poem page parser

**Files:**
- Create: `scripts/scraper/parse-poem.ts`
- Create: `tests/scraper-parse.test.ts`
- Create: `tests/fixtures/poem-page.html` (manually saved sample)

**Interfaces:**
- Produces: `parsePoemPage(html, url): RawPoem` where `RawPoem` has `{ title, poetName, content, annotations, background }` (unverified shape — normalization happens in Task 4)

**Note on selectors:** As in Task 2, save a real poem page first and adjust. Typical gushiwen.cn poem pages have:
- Title: `<h1>` inside `.sonspic` or `cont`
- Author: `<p class="source">` 
- Content: `<div class="contson">`
- Annotations/translation/background: nested `<div class="contyishang">` blocks

- [ ] **Step 1: Save a real fixture**

Pick one poem URL from Task 2's output (e.g., 将进酒's page). Run:
`curl -o tests/fixtures/poem-page.html "https://so.gushiwen.cn/shiwenv_XXXX.aspx"`
Inspect to confirm selectors.

- [ ] **Step 2: Write `tests/scraper-parse.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePoemPage } from '../scripts/scraper/parse-poem';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures/poem-page.html'), 'utf-8');

describe('parsePoemPage', () => {
  it('extracts title, poet, content', () => {
    const result = parsePoemPage(fixture, 'https://example.com/x');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.poetName.length).toBeGreaterThan(0);
    expect(result.content.length).toBeGreaterThan(20);
  });

  it('extracts at least one annotation', () => {
    const result = parsePoemPage(fixture, 'https://example.com/x');
    expect(result.annotations.length).toBeGreaterThan(0);
    expect(result.annotations[0].term).toBeTruthy();
    expect(result.annotations[0].explanation).toBeTruthy();
  });

  it('extracts background paragraph when present', () => {
    const result = parsePoemPage(fixture, 'https://example.com/x');
    expect(result.background?.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- tests/scraper-parse.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 4: Write `scripts/scraper/parse-poem.ts`**

```ts
import * as cheerio from 'cheerio';

export interface RawAnnotation {
  term: string;
  explanation: string;
}

export interface RawPoem {
  url: string;
  title: string;
  poetName: string;
  content: string;
  annotations: RawAnnotation[];
  background?: string;
}

/**
 * Parse a single gushiwen.cn poem page.
 * Selectors are best-guess; verify against fixture and adjust.
 */
export function parsePoemPage(html: string, url: string): RawPoem {
  const $ = cheerio.load(html);

  const title = $('.sonspic h1').first().text().trim()
    || $('h1').first().text().trim();

  const poetName = $('.sonspic .source a').first().text().trim()
    || $('.source a').first().text().trim();

  const content = $('.contson').first().text().trim();

  // Annotations appear in .contyishang blocks; the "注释" block usually has
  // entries like "【字】解释" or "字：解释" — pattern varies. Try common forms.
  const annotations: RawAnnotation[] = [];
  $('.contyishang').each((_, block) => {
    const $block = $(block);
    const heading = $block.find('p').first().text().trim();
    if (!heading.includes('注')) return;
    $block.find('p').slice(1).each((_, p) => {
      const text = $(p).text().trim();
      // Try patterns like "【xxx】解释" or "xxx：解释" or "xxx。解释"
      const match = text.match(/^[【(]?(.+?)[】)]?[：。\s—]+(.+)$/);
      if (match) {
        annotations.push({ term: match[1].trim(), explanation: match[2].trim() });
      }
    });
  });

  // Background: the "创作背景" block
  let background: string | undefined;
  $('.contyishang').each((_, block) => {
    const $block = $(block);
    const heading = $block.find('p').first().text().trim();
    if (heading.includes('背景') || heading.includes('创作')) {
      background = $block.find('p').slice(1).text().trim();
    }
  });

  return { url, title, poetName, content, annotations, background };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/scraper-parse.test.ts`
Expected: PASS. If annotations or background assertions fail, inspect fixture and adjust the matching logic.

- [ ] **Step 6: Commit**

```bash
git add scripts/scraper/parse-poem.ts tests/scraper-parse.test.ts tests/fixtures/poem-page.html
git commit -m "feat(scraper): parse single poem page (title/content/annotations/background)"
```

---

### Task 4: Scraper — orchestrate, normalize, write JSON

**Files:**
- Create: `scripts/scraper/normalize.ts`
- Create: `scripts/scraper/index.ts`
- Create: `src/data/poems.json` (output, committed)
- Create: `src/data/poets.json` (output, committed)

**Interfaces:**
- Consumes: `fetchPoemList` from Task 2; `parsePoemPage` from Task 3
- Produces: `src/data/poets.json` (`Poet[]`) and `src/data/poems.json` (`Poem[]`) matching schemas in `src/types.ts`

- [ ] **Step 1: Write `scripts/scraper/normalize.ts`**

The normalizer fills schema gaps that gushiwen.cn doesn't provide (birth/death years, courtesy name, familiarity, creation year). For MVP, we hardcode a small `poet-metadata.json` for the ~15 most famous poets (李白, 杜甫, 王维, etc.) and default the rest. Familiarity defaults to 2; bump to 5 for canonical poems (静夜思, 将进酒, etc.) via a small list.

```ts
import type { Poet, Poem } from '../../src/types';

// Hand-curated metadata for famous poets. Birth/death years are historical.
// Poets not in this map default to birthYear=700, deathYear=750, familiarity=2.
const POET_META: Record<string, { courtesyName?: string; pseudonym?: string; birthYear: number; deathYear: number; familiarity: number }> = {
  '李白': { courtesyName: '太白', pseudonym: '青莲居士', birthYear: 701, deathYear: 762, familiarity: 5 },
  '杜甫': { courtesyName: '子美', pseudonym: '少陵野老', birthYear: 712, deathYear: 770, familiarity: 5 },
  '王维': { courtesyName: '摩诘', pseudonym: '摩诘居士', birthYear: 701, deathYear: 761, familiarity: 4 },
  '白居易': { courtesyName: '乐天', pseudonym: '香山居士', birthYear: 772, deathYear: 846, familiarity: 4 },
  '李商隐': { courtesyName: '义山', pseudonym: '玉谿生', birthYear: 813, deathYear: 858, familiarity: 4 },
  '杜牧': { courtesyName: '牧之', pseudonym: '樊川居士', birthYear: 803, deathYear: 852, familiarity: 3 },
  '孟浩然': { courtesyName: '浩然', birthYear: 689, deathYear: 740, familiarity: 3 },
  '王昌龄': { courtesyName: '少伯', birthYear: 698, deathYear: 757, familiarity: 3 },
  '王之涣': { birthYear: 688, deathYear: 742, familiarity: 2 },
  '刘禹锡': { courtesyName: '梦得', birthYear: 772, deathYear: 842, familiarity: 3 },
  '柳宗元': { courtesyName: '子厚', birthYear: 773, deathYear: 819, familiarity: 3 },
  '岑参': { birthYear: 715, deathYear: 770, familiarity: 2 },
  '高适': { courtesyName: '达夫', birthYear: 704, deathYear: 765, familiarity: 2 },
  '韦应物': { birthYear: 737, deathYear: 792, familiarity: 2 },
  '孟郊': { courtesyName: '东野', birthYear: 751, deathYear: 814, familiarity: 2 },
};

const DEFAULT_POET_META = { birthYear: 700, deathYear: 750, familiarity: 2 };

// Canonical poems get familiarity 5
const FAMOUS_POEMS = new Set([
  '静夜思', '将进酒', '春晓', '登鹳雀楼', '望庐山瀑布', '绝句', '春望',
  '登高', '蜀道难', '琵琶行', '忆江南', '悯农', '寻隐者不遇',
]);

export interface NormalizedData {
  poets: Poet[];
  poems: Poem[];
}

export function normalize(
  raw: { url: string; title: string; poetName: string; content: string; annotations: { term: string; explanation: string }[]; background?: string }[],
): NormalizedData {
  const poets = new Map<string, Poet>();
  const poems: Poem[] = [];

  for (const r of raw) {
    const meta = POET_META[r.poetName] ?? DEFAULT_POET_META;

    if (!poets.has(r.poetName)) {
      const poet: Poet = {
        id: slug(r.poetName),
        name: r.poetName,
        courtesyName: meta.courtesyName,
        pseudonym: 'pseudonym' in meta ? meta.pseudonym : undefined,
        birthYear: meta.birthYear,
        deathYear: meta.deathYear,
        dynastyId: 'tang',
        familiarity: meta.familiarity,
      };
      poets.set(r.poetName, poet);
    }

    const poem: Poem = {
      id: slug(r.title) + '_' + slug(r.poetName),
      title: r.title,
      poetId: poets.get(r.poetName)!.id,
      content: r.content,
      annotations: r.annotations,
      background: r.background,
      creationYear: undefined, // gushiwen.cn doesn't expose this cleanly; default to undefined
      familiarity: FAMOUS_POEMS.has(r.title) ? 5 : 2,
    };
    poems.push(poem);
  }

  return { poets: Array.from(poets.values()), poems };
}

function slug(s: string): string {
  // Pinyin would be ideal; for MVP, hash by char codes
  return s.split('').map((c) => c.charCodeAt(0).toString(16)).join('');
}
```

- [ ] **Step 2: Write `scripts/scraper/index.ts`**

```ts
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPoemList } from './list';
import { parsePoemPage } from './parse-poem';
import { normalize } from './normalize';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(here, '.cache');
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

const RATE_LIMIT_MS = 1000;

async function rateLimitedDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}

async function cachedFetch(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = resolve(CACHE_DIR, Buffer.from(url).toString('base64url').slice(0, 80) + '.html');
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf-8');
  }
  console.log(`  fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  writeFileSync(cacheFile, html);
  return html;
}

async function main() {
  console.log('Step 1: fetching poem list...');
  const list = await fetchPoemList();
  console.log(`  found ${list.length} poems`);

  console.log('Step 2: fetching each poem page (rate-limited)...');
  const raw: Parameters<typeof normalize>[0] = [];
  let i = 0;
  for (const entry of list) {
    i++;
    try {
      const html = await cachedFetch(entry.url);
      const parsed = parsePoemPage(html, entry.url);
      raw.push(parsed);
      console.log(`  [${i}/${list.length}] ${parsed.title} — ${parsed.poetName}`);
    } catch (err) {
      console.error(`  [${i}/${list.length}] FAILED ${entry.title}:`, err);
    }
    await rateLimitedDelay();
  }

  console.log(`Step 3: normalizing ${raw.length} poems...`);
  const { poets, poems } = normalize(raw);

  writeFileSync(POEMS_JSON, JSON.stringify(poems, null, 2));
  writeFileSync(POETS_JSON, JSON.stringify(poets, null, 2));
  console.log(`  wrote ${poems.length} poems, ${poets.length} poets`);
  console.log(`  → ${POEMS_JSON}`);
  console.log(`  → ${POETS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the scraper end-to-end**

Run: `npm run scrape`
Expected: Prints progress like `[1/311] 静夜思 — 李白`, then writes `src/data/poems.json` and `src/data/poets.json`. Takes ~5–6 minutes (rate-limited).

If the scraper hits errors midway, re-running resumes from cache — only uncached poems re-fetch.

- [ ] **Step 4: Verify output shape**

Run:
```bash
node -e "const p=require('./src/data/poets.json'); console.log('poets:',p.length); console.log(p[0]);"
node -e "const p=require('./src/data/poems.json'); console.log('poems:',p.length); console.log(p[0].title, p[0].poetId);"
```
Expected: poets count ~70–80, poems count ~300; sample values look right.

- [ ] **Step 5: Commit**

```bash
git add scripts/scraper/normalize.ts scripts/scraper/index.ts src/data/poets.json src/data/poems.json
git commit -m "feat(scraper): orchestrate full Tang 300 scrape and emit normalized JSON"
```

---

### Task 5: Data loader

**Files:**
- Create: `src/data/load.ts`
- Create: `tests/load.test.ts`

**Interfaces:**
- Consumes: `src/data/poets.json`, `src/data/poems.json` (from Task 4)
- Produces:
  - `getPoets(): Poet[]`
  - `getPoet(poetId: string): Poet | undefined`
  - `getPoemsByPoet(poetId: string): Poem[]` (sorted by creationYear ascending, with undefined years at the end)
  - `getPoem(poemId: string): Poem | undefined`
  - `getNeighbors(poemId: string): { prev?: Poem; next?: Poem }` (within the same poet)

- [ ] **Step 1: Write `tests/load.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { getPoets, getPoet, getPoemsByPoet, getPoem, getNeighbors } from '../src/data/load';

describe('data loader', () => {
  it('returns all poets', () => {
    const poets = getPoets();
    expect(poets.length).toBeGreaterThan(50);
    expect(poets[0]).toHaveProperty('id');
    expect(poets[0]).toHaveProperty('name');
  });

  it('getPoet returns by id', () => {
    const poet = getPoets()[0];
    expect(getPoet(poet.id)).toEqual(poet);
  });

  it('getPoemsByPoet returns sorted poems', () => {
    const poet = getPoets()[0];
    const poems = getPoemsByPoet(poet.id);
    expect(poems.length).toBeGreaterThan(0);
    expect(poems.every((p) => p.poetId === poet.id)).toBe(true);
  });

  it('getNeighbors returns same-poet prev/next', () => {
    const poet = getPoets()[0];
    const poems = getPoemsByPoet(poet.id);
    if (poems.length < 2) return; // skip if poet has only 1 poem
    const mid = poems[Math.floor(poems.length / 2)];
    const neighbors = getNeighbors(mid.id);
    expect(neighbors.prev?.poetId).toBe(poet.id);
    expect(neighbors.next?.poetId).toBe(poet.id);
  });

  it('getNeighbors first poem has no prev', () => {
    const poet = getPoets()[0];
    const poems = getPoemsByPoet(poet.id);
    const neighbors = getNeighbors(poems[0].id);
    expect(neighbors.prev).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/load.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/data/load.ts`**

```ts
import type { Poet, Poem } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

const poets = poetsData as Poet[];
const poems = poemsData as Poem[];

export function getPoets(): Poet[] {
  return poets;
}

export function getPoet(poetId: string): Poet | undefined {
  return poets.find((p) => p.id === poetId);
}

export function getPoemsByPoet(poetId: string): Poem[] {
  return poems
    .filter((p) => p.poetId === poetId)
    .sort((a, b) => {
      // defined years first, sorted ascending; undefined years last
      if (a.creationYear == null && b.creationYear == null) return 0;
      if (a.creationYear == null) return 1;
      if (b.creationYear == null) return -1;
      return a.creationYear - b.creationYear;
    });
}

export function getPoem(poemId: string): Poem | undefined {
  return poems.find((p) => p.id === poemId);
}

export function getNeighbors(poemId: string): { prev?: Poem; next?: Poem } {
  const poem = getPoem(poemId);
  if (!poem) return {};
  const siblings = getPoemsByPoet(poem.poetId);
  const idx = siblings.findIndex((p) => p.id === poemId);
  if (idx === -1) return {};
  return {
    prev: idx > 0 ? siblings[idx - 1] : undefined,
    next: idx < siblings.length - 1 ? siblings[idx + 1] : undefined,
  };
}
```

- [ ] **Step 4: Enable JSON imports in `tsconfig.json`**

Edit `tsconfig.json` `compilerOptions` to add:
```json
"resolveJsonModule": true,
"allowSyntheticDefaultImports": true
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/load.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/load.ts tests/load.test.ts tsconfig.json
git commit -m "feat(data): typed accessors for poets and poems"
```

---

### Task 6: Layout positioning math

**Files:**
- Create: `src/utils/layout.ts`
- Create: `src/utils/layout.test.ts`

**Interfaces:**
- Produces:
  - `computePercent(year, minYear, maxYear): number` — returns 0–100
  - `layoutPoets(poets: Poet[]): { poet: Poet; x: number }[]` — spreads poets across a 0–100 range by birthYear
  - `layoutPoems(poems: Poem[], poet: Poet): { poem: Poem; x: number }[]` — same but for poems within a poet's lifetime

- [ ] **Step 1: Write `src/utils/layout.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computePercent, layoutPoets, layoutPoems } from './layout';
import type { Poet, Poem } from '../types';

describe('computePercent', () => {
  it('returns 0 at min year', () => {
    expect(computePercent(618, 618, 907)).toBe(0);
  });

  it('returns 100 at max year', () => {
    expect(computePercent(907, 618, 907)).toBeCloseTo(100, 5);
  });

  it('returns 50 at midpoint', () => {
    expect(computePercent(762, 618, 907)).toBeCloseTo(49.8, 1);
  });

  it('clamps out-of-range years', () => {
    expect(computePercent(500, 618, 907)).toBe(0);
    expect(computePercent(1000, 618, 907)).toBe(100);
  });
});

describe('layoutPoets', () => {
  const poets: Poet[] = [
    { id: 'a', name: 'A', birthYear: 618, deathYear: 700, dynastyId: 'tang', familiarity: 1 },
    { id: 'b', name: 'B', birthYear: 700, deathYear: 770, dynastyId: 'tang', familiarity: 1 },
    { id: 'c', name: 'C', birthYear: 907, deathYear: 950, dynastyId: 'tang', familiarity: 1 },
  ];

  it('sorts by birthYear and computes x position', () => {
    const result = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    expect(result[0].poet.id).toBe('a');
    expect(result[0].x).toBeCloseTo(5, 5);
    expect(result[2].poet.id).toBe('c');
    expect(result[2].x).toBeCloseTo(95, 5);
  });
});

describe('layoutPoems', () => {
  const poet: Poet = { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1 };
  const poems: Poem[] = [
    { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 710 },
    { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 750 },
  ];

  it('positions poems across the poet\'s lifetime', () => {
    const result = layoutPoems(poems, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].poem.id).toBe('1');
    expect(result[0].x).toBeLessThan(result[1].x);
  });

  it('handles undefined creationYear by spreading evenly across remaining slots', () => {
    const poemsNoYear: Poem[] = [
      { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1 },
      { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1 },
    ];
    const result = layoutPoems(poemsNoYear, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].x).toBeLessThan(result[1].x);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/layout.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/utils/layout.ts`**

```ts
import type { Poet, Poem } from '../types';

export interface LayoutRange {
  minYear: number;
  maxYear: number;
  leftPadding: number; // percent
  rightPadding: number; // percent
}

export function computePercent(year: number, minYear: number, maxYear: number): number {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

export function layoutPoets(poets: Poet[], range: LayoutRange): { poet: Poet; x: number }[] {
  const sorted = [...poets].sort((a, b) => a.birthYear - b.birthYear);
  const span = 100 - range.leftPadding - range.rightPadding;
  return sorted.map((poet) => {
    const pct = computePercent(poet.birthYear, range.minYear, range.maxYear);
    return { poet, x: range.leftPadding + (pct / 100) * span };
  });
}

export function layoutPoems(poems: Poem[], poet: Poet, padding: { leftPadding: number; rightPadding: number }): { poem: Poem; x: number }[] {
  const sorted = [...poems].sort((a, b) => {
    if (a.creationYear == null && b.creationYear == null) return 0;
    if (a.creationYear == null) return 1;
    if (b.creationYear == null) return -1;
    return a.creationYear - b.creationYear;
  });

  const span = 100 - padding.leftPadding - padding.rightPadding;
  const minYear = poet.birthYear;
  const maxYear = poet.deathYear;
  const withYears = sorted.filter((p) => p.creationYear != null);

  // Position poems with known years by their year; poems without years
  // get evenly distributed in the remaining empty slots
  return sorted.map((poem, idx) => {
    let pct: number;
    if (poem.creationYear != null) {
      pct = computePercent(poem.creationYear, minYear, maxYear);
    } else {
      // Spread evenly across the range as a fallback
      pct = (sorted.length === 1) ? 50 : (idx / (sorted.length - 1)) * 100;
    }
    return { poem, x: padding.leftPadding + (pct / 100) * span };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/layout.ts src/utils/layout.test.ts
git commit -m "feat(layout): pure functions for positioning poets and poems by year"
```

---

### Task 7: River visual primitives

**Files:**
- Create: `src/components/RiverBackground.tsx`
- Create: `src/components/RiverLine.tsx`
- Create: `src/components/TimeAxis.tsx`

**Interfaces:**
- Produces:
  - `<RiverBackground />` — full-bleed CSS background with moon, stars, mountains (used by RiverPage and PoetPage)
  - `<RiverLine />` — the horizontal silver line + glow (positioned at 50% height of parent)
  - `<TimeAxis left={string} right={string} />` — bottom timeline strip

No tests for these components — they're pure presentation. Verified visually in Task 13's smoke test.

- [ ] **Step 1: Write `src/components/RiverBackground.tsx`**

```tsx
export function RiverBackground() {
  return (
    <>
      {/* 远山墨影 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 320px 60px at 12% 78%, rgba(60,80,120,0.35) 0%, transparent 60%),
          radial-gradient(ellipse 380px 80px at 45% 85%, rgba(50,70,110,0.4) 0%, transparent 60%),
          radial-gradient(ellipse 280px 50px at 78% 75%, rgba(70,90,130,0.3) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
      }} />
      {/* 月亮 */}
      <div style={{
        position: 'absolute', top: '8%', right: '6%',
        width: 72, height: 72, borderRadius: '50%',
        background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
        boxShadow: '0 0 60px rgba(216,224,240,0.3)',
        pointerEvents: 'none',
      }} />
      {/* 星点 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(circle at 5% 18%, #fff 0.8px, transparent 2px),
          radial-gradient(circle at 15% 8%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 28% 22%, #e8f0ff 0.7px, transparent 1.8px),
          radial-gradient(circle at 42% 12%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 58% 25%, #e8f0ff 0.8px, transparent 2px),
          radial-gradient(circle at 72% 15%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 88% 28%, #fff 0.7px, transparent 1.8px)
        `,
        pointerEvents: 'none',
      }} />
    </>
  );
}
```

- [ ] **Step 2: Write `src/components/RiverLine.tsx`**

```tsx
import { colors } from '../theme';

export function RiverLine() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: colors.riverLine,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '48%', left: 0, right: 0, height: 10,
        background: colors.riverGlow,
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />
    </>
  );
}
```

- [ ] **Step 3: Write `src/components/TimeAxis.tsx`**

```tsx
import { colors, fontFamilies } from '../theme';

interface Props {
  left: string;
  right: string;
}

export function TimeAxis({ left, right }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      background: 'linear-gradient(180deg, transparent 0%, rgba(2,5,20,0.6) 100%)',
      borderTop: '1px solid rgba(216,224,240,0.15)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
    }}>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{left}</div>
      <div style={{
        flex: 1, height: 1, margin: '0 12px',
        background: 'linear-gradient(90deg, rgba(216,224,240,0.4), rgba(216,224,240,0.6), rgba(216,224,240,0.4))',
      }} />
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{right}</div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the file count**

Run: `ls src/components/`
Expected: lists `RiverBackground.tsx`, `RiverLine.tsx`, `TimeAxis.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/
git commit -m "feat(components): river background, line, and time axis primitives"
```

---

### Task 8: TopNav + routing skeleton

**Files:**
- Modify: `src/App.tsx` (add router + routes)
- Create: `src/components/TopNav.tsx`

**Interfaces:**
- Produces: `<TopNav variant="main" | "poet" | "poem" poet={...} poem={...} />` (variant determines which fields show)
- Produces: Routes `/`, `/poet/:poetId`, `/poem/:poemId` wired to placeholder pages

- [ ] **Step 1: Write `src/components/TopNav.tsx`**

```tsx
import { colors, fontFamilies, fontSizes } from '../theme';
import type { Poet, Poem } from '../types';

interface BaseProps {
  variant: 'main' | 'poet' | 'poem';
}

interface MainVariantProps extends BaseProps {
  variant: 'main';
}
interface PoetVariantProps extends BaseProps {
  variant: 'poet';
  poet: Poet;
}
interface PoemVariantProps extends BaseProps {
  variant: 'poem';
  poet: Poet;
  poem: Poem;
}

type Props = MainVariantProps | PoetVariantProps | PoemVariantProps;

export function TopNav(props: Props) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #020514 0%, #0a1228 100%)',
      padding: '16px 28px',
      borderBottom: '1px solid rgba(216,224,240,0.18)',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {props.variant === 'main' && (
        <>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 22, letterSpacing: 6,
            textShadow: '0 0 12px rgba(216,224,240,0.5)',
          }}>诗文长河</div>
          <div style={{
            flex: 1, maxWidth: 440,
            background: 'rgba(216,224,240,0.08)',
            border: '1px solid rgba(216,224,240,0.25)',
            borderRadius: 4, padding: '10px 16px',
            color: colors.textTertiary, fontSize: 15,
          }}>🔍 搜索诗人、诗名、诗句……</div>
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poet' && (
        <>
          <BackLink to="/" label="返回长河" />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 24, letterSpacing: 6,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{props.poet.name}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>
            {metaString(props.poet)} · {props.poet.birthYear}—{props.poet.deathYear}
          </div>
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poem' && (
        <>
          <BackLink to={`/poet/${props.poet.id}`} label={`返回${props.poet.name}`} />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 20, letterSpacing: 4,
            textShadow: '0 0 10px rgba(216,224,240,0.5)',
          }}>{props.poem.title}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>{props.poet.name} · {props.poem.creationYear ?? ''}</div>
        </>
      )}
    </div>
  );
}

function metaString(poet: Poet): string {
  const parts: string[] = [];
  if (poet.courtesyName) parts.push(`字${poet.courtesyName}`);
  if (poet.pseudonym) parts.push(`号${poet.pseudonym}`);
  return parts.join(' · ');
}

function DynastyLabel() {
  return (
    <div style={{
      marginLeft: 'auto',
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.meta, letterSpacing: 3,
      padding: '6px 14px',
      border: '1px solid rgba(216,224,240,0.2)',
      borderRadius: 3,
    }}>唐</div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  // Use plain anchor for now — react-router Link wiring added in Task 12
  return <a href={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← {label}</a>;
}
```

- [ ] **Step 2: Rewrite `src/App.tsx` with router and placeholder pages**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder>main river</Placeholder>} />
        <Route path="/poet/:poetId" element={<Placeholder>poet sub-river</Placeholder>} />
        <Route path="/poem/:poemId" element={<Placeholder>poem reading</Placeholder>} />
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#050818', color: '#e8f0ff', padding: 40 }}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify dev server renders placeholders**

Run: `npm run dev`
Open browser, navigate to `/`, `/poet/x`, `/poem/y`. Each should show the placeholder text on dark background. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/TopNav.tsx
git commit -m "feat(nav): TopNav component with main/poet/poem variants and router skeleton"
```

---

### Task 9: RiverPage (main river)

**Files:**
- Modify: `src/pages/RiverPage.tsx` (create)
- Modify: `src/App.tsx` (wire `/` route)

**Interfaces:**
- Consumes: `getPoets` from Task 5, `layoutPoets` from Task 6, `RiverBackground`, `RiverLine`, `TimeAxis`, `TopNav` from Tasks 7–8

- [ ] **Step 1: Create `src/pages/RiverPage.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { getPoets } from '../data/load';
import { layoutPoets } from '../utils/layout';
import { RiverBackground } from '../components/RiverBackground';
import { RiverLine } from '../components/RiverLine';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, nodeSizes } from '../theme';

export function RiverPage() {
  const poets = getPoets();
  const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{
        position: 'relative', flex: 1,
        background: colors.bgGradient, overflowX: 'auto', overflowY: 'hidden',
      }}>
        {/* Inner canvas is wider than viewport to enable horizontal scroll */}
        <div style={{ position: 'relative', width: '600%', height: '100%' }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poet, x }) => {
            const size = nodeSizes[poet.familiarity] ?? nodeSizes[2];
            const isFocal = poet.familiarity >= 4;
            return (
              <Link
                key={poet.id}
                to={`/poet/${poet.id}`}
                style={{
                  position: 'absolute', top: '50%', left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  color: isFocal ? '#fff' : colors.textPrimary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault,
                  textShadow: isFocal ? '0 0 14px rgba(216,224,240,0.8), 0 0 4px #fff' : '0 0 6px rgba(216,224,240,0.4)',
                  marginBottom: 8,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 4 : undefined,
                }}>{poet.name}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 6px #fff`
                    : `0 0 ${size}px rgba(216,224,240,0.7)`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left="618 · 唐" right="907" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire route in `src/App.tsx`**

Replace the `/` placeholder:
```tsx
import { RiverPage } from './pages/RiverPage';
// ...
<Route path="/" element={<RiverPage />} />
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Open `/`. Expected: top nav with logo + search box + 唐. Below, a horizontal river with poets spread across, focal poets (李白, 杜甫, 王维) larger and brighter. Horizontal scroll works (drag with trackpad or shift+wheel). Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/RiverPage.tsx src/App.tsx
git commit -m "feat(river): main river page renders poets as nodes positioned by birth year"
```

---

### Task 10: PoetPage (sub-river)

**Files:**
- Create: `src/pages/PoetPage.tsx`
- Modify: `src/App.tsx` (wire `/poet/:poetId`)

**Interfaces:**
- Consumes: `getPoet`, `getPoemsByPoet` from Task 5, `layoutPoems` from Task 6, primitives from Tasks 7–8

- [ ] **Step 1: Create `src/pages/PoetPage.tsx`**

```tsx
import { useParams, Link } from 'react-router-dom';
import { getPoet, getPoemsByPoet } from '../data/load';
import { layoutPoems } from '../utils/layout';
import { RiverBackground } from '../components/RiverBackground';
import { RiverLine } from '../components/RiverLine';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, nodeSizes } from '../theme';

export function PoetPage() {
  const { poetId } = useParams<{ poetId: string }>();
  const poet = poetId ? getPoet(poetId) : undefined;
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const poems = getPoemsByPoet(poet.id);
  const positioned = layoutPoems(poems, poet, { leftPadding: 6, rightPadding: 6 });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poet" poet={poet} />
      <div style={{
        position: 'relative', flex: 1,
        background: colors.bgGradient, overflowX: 'auto', overflowY: 'hidden',
      }}>
        <div style={{ position: 'relative', width: '600%', height: '100%' }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poem, x }) => {
            const size = nodeSizes[poem.familiarity] ?? nodeSizes[2];
            const isFocal = poem.familiarity >= 5;
            return (
              <Link
                key={poem.id}
                to={`/poem/${poem.id}`}
                style={{
                  position: 'absolute', top: '50%', left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  color: isFocal ? '#fff' : colors.textPrimary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: isFocal ? fontSizes.nodeLarge : fontSizes.body,
                  textShadow: isFocal ? '0 0 12px rgba(216,224,240,0.8)' : 'none',
                  marginBottom: 6,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 2 : undefined,
                }}>{poem.title}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 4px #fff`
                    : `0 0 ${size}px rgba(216,224,240,0.6)`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left={`${poet.birthYear} · 生`} right={`${poet.deathYear} · 卒`} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire route in `src/App.tsx`**

```tsx
import { PoetPage } from './pages/PoetPage';
// ...
<Route path="/poet/:poetId" element={<PoetPage />} />
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
From the main river, click 李白. Expected: navigates to `/poet/<id>`, shows the poet sub-river with his 30 poems as nodes. Clicking a poem navigates to `/poem/<id>` (placeholder for now). Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PoetPage.tsx src/App.tsx
git commit -m "feat(poet): sub-river page renders one poet's poems positioned by creation year"
```

---

### Task 11: PoemPage (reading)

**Files:**
- Create: `src/pages/PoemPage.tsx`
- Modify: `src/App.tsx` (wire `/poem/:poemId`)

**Interfaces:**
- Consumes: `getPoem`, `getPoet`, `getNeighbors` from Task 5, `TopNav` from Task 8

- [ ] **Step 1: Create `src/pages/PoemPage.tsx`**

```tsx
import { useParams, Link } from 'react-router-dom';
import { getPoem, getPoet, getNeighbors } from '../data/load';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes } from '../theme';

export function PoemPage() {
  const { poemId } = useParams<{ poemId: string }>();
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const { prev, next } = getNeighbors(poem.id);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} />
      <div style={{
        flex: 1, overflowY: 'auto',
        background: colors.bgGradient,
      }}>
        {/* 月夜氛围带（无题图） */}
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

        {/* 原文 */}
        <div style={{ padding: '8px 32px 28px', textAlign: 'center' }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: '#fff',
            fontSize: fontSizes.poemTitle, letterSpacing: 8,
            marginBottom: 8, fontWeight: 600,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{poem.title}</div>
          <div style={{
            color: colors.textDim, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.body, letterSpacing: 3, marginBottom: 28,
          }}>{poet.name} · 唐</div>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: fontSizes.poemText, lineHeight: 2.6, letterSpacing: 2,
            whiteSpace: 'pre-wrap',
          }}>{poem.content}</div>
        </div>

        <Divider />

        {/* 注释 */}
        {poem.annotations.length > 0 && (
          <>
            <section style={{ padding: '24px 32px' }}>
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
            <Divider />
          </>
        )}

        {/* 创作背景 */}
        {poem.background && (
          <>
            <section style={{ padding: '24px 32px' }}>
              <SectionTitle>创 作 背 景</SectionTitle>
              <div style={{
                color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                fontSize: fontSizes.body, lineHeight: 2,
              }}>{poem.background}</div>
            </section>
            <Divider />
          </>
        )}

        {/* 翻页 */}
        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
        }}>
          {prev ? (
            <Link to={`/poem/${prev.id}`} style={navCardStyle}>
              <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{prev.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是第一首）</div>
            </div>
          )}
          {next ? (
            <Link to={`/poem/${next.id}`} style={{ ...navCardStyle, textAlign: 'right' }}>
              <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{next.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, textAlign: 'right', opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
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

function Divider() {
  return <div style={{ margin: '0 32px', borderTop: '1px dashed rgba(216,224,240,0.18)' }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
```

- [ ] **Step 2: Wire route in `src/App.tsx`**

```tsx
import { PoemPage } from './pages/PoemPage';
// ...
<Route path="/poem/:poemId" element={<PoemPage />} />
```

- [ ] **Step 3: Verify visually**

Run: `npm run dev`
Navigate to a poem (e.g., from poet page click 将进酒). Expected: title, content, annotations, background, prev/next cards all render. Prev/next cards navigate to sibling poems by the same poet. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/PoemPage.tsx src/App.tsx
git commit -m "feat(poem): reading page with annotations, background, and prev/next navigation"
```

---

### Task 12: Search dropdown

**Files:**
- Create: `src/utils/search.ts`
- Create: `src/utils/search.test.ts`
- Create: `src/components/SearchBox.tsx`
- Modify: `src/components/TopNav.tsx` (use SearchBox in main variant)

**Interfaces:**
- Consumes: `getPoets`, `getPoem`, `getPoet` from Task 5
- Produces:
  - `buildIndex(): SearchIndex` (called once at app startup)
  - `SearchIndex.query(q: string): SearchResult`
  - `<SearchBox />` (input + dropdown, navigates on click)

- [ ] **Step 1: Write `src/utils/search.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildIndex } from './search';

describe('search index', () => {
  const index = buildIndex();

  it('finds poets by name', () => {
    const result = index.query('李白');
    expect(result.poets.some((p) => p.name === '李白')).toBe(true);
  });

  it('finds poems by title', () => {
    const result = index.query('月');
    expect(result.poems.some((p) => p.title.includes('月'))).toBe(true);
  });

  it('finds verses by substring', () => {
    const result = index.query('月');
    expect(result.verses.some((v) => v.verse.includes('月'))).toBe(true);
  });

  it('returns empty for short queries', () => {
    expect(index.query('').poets.length).toBe(0);
    expect(index.query('').poems.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/utils/search.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Write `src/utils/search.ts`**

```ts
import type { Poet, Poem, SearchResult, VerseHit } from '../types';
import { getPoets } from '../data/load';
import poemsData from '../data/poems.json';

const poems = poemsData as Poem[];

export interface SearchIndex {
  query(q: string): SearchResult;
}

export function buildIndex(): SearchIndex {
  const poets = getPoets();
  const poetById = new Map(poets.map((p) => [p.id, p]));

  // Pre-split poem content into verse lines for verse-level search
  const verseIndex: { poem: Poem; poetName: string; verses: string[] }[] = poems.map((p) => ({
    poem: p,
    poetName: poetById.get(p.poetId)?.name ?? '',
    verses: splitVerses(p.content),
  }));

  return {
    query(q: string): SearchResult {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        return { poets: [], poems: [], verses: [] };
      }
      const lower = trimmed.toLowerCase();

      const matchedPoets = poets.filter((p) => p.name.includes(trimmed) || (p.courtesyName?.includes(trimmed) ?? false) || (p.pseudonym?.includes(trimmed) ?? false));

      const matchedPoems = poems.filter((p) => p.title.includes(trimmed));

      const matchedVerses: VerseHit[] = [];
      for (const entry of verseIndex) {
        for (const verse of entry.verses) {
          if (verse.includes(trimmed) || verse.toLowerCase().includes(lower)) {
            matchedVerses.push({
              poemId: entry.poem.id,
              verse,
              poemTitle: entry.poem.title,
              poetName: entry.poetName,
            });
            if (matchedVerses.length >= 50) break; // cap
          }
        }
        if (matchedVerses.length >= 50) break;
      }

      return { poets: matchedPoets, poems: matchedPoems, verses: matchedVerses };
    },
  };
}

function splitVerses(content: string): string[] {
  // Split by 。！？ or newlines, then by 、, keeping any non-empty pieces
  return content
    .split(/[。！？\n]/)
    .flatMap((s) => s.split('、'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/utils/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/components/SearchBox.tsx`**

```tsx
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildIndex } from '../utils/search';
import { colors, fontFamilies } from '../theme';

const index = buildIndex();

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const result = useMemo(() => index.query(query), [query]);
  const totalHits = result.poets.length + result.poems.length + result.verses.length;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 搜索诗人、诗名、诗句……"
        style={{
          width: '100%',
          background: query && open ? 'rgba(216,224,240,0.12)' : 'rgba(216,224,240,0.08)',
          border: `1px solid ${query && open ? 'rgba(216,224,240,0.55)' : 'rgba(216,224,240,0.25)'}`,
          borderRadius: 4, padding: '10px 16px',
          color: colors.textPrimary, fontSize: 15,
          fontFamily: fontFamilies.chinese,
          outline: 'none',
        }}
      />
      {query && open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'linear-gradient(180deg, #0a1228 0%, #050818 100%)',
          border: '1px solid rgba(216,224,240,0.3)',
          borderRadius: 4, padding: '14px 0',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          maxHeight: 440, overflowY: 'auto',
          zIndex: 20,
        }}>
          <Section title="诗 人" count={result.poets.length}>
            {result.poets.length === 0 && <Empty>无匹配诗人</Empty>}
            {result.poets.slice(0, 3).map((p) => (
              <ResultRow key={p.id} onClick={() => { navigate(`/poet/${p.id}`); setOpen(false); }}>
                <span>{highlight(p.name, query)}</span>
              </ResultRow>
            ))}
            {result.poets.length > 3 && <MoreHint>还有 {result.poets.length - 3} 位 ↓</MoreHint>}
          </Section>
          <Section title="诗 名" count={result.poems.length}>
            {result.poems.length === 0 && <Empty>无匹配诗名</Empty>}
            {result.poems.slice(0, 3).map((p) => (
              <ResultRow key={p.id} onClick={() => { navigate(`/poem/${p.id}`); setOpen(false); }}>
                <span>{highlight(p.title, query)}</span>
              </ResultRow>
            ))}
            {result.poems.length > 3 && <MoreHint>还有 {result.poems.length - 3} 首 ↓</MoreHint>}
          </Section>
          <Section title="诗 句" count={result.verses.length}>
            {result.verses.length === 0 && <Empty>无匹配诗句</Empty>}
            {result.verses.slice(0, 3).map((v, i) => (
              <ResultRow key={i} onClick={() => { navigate(`/poem/${v.poemId}`); setOpen(false); }}>
                <div>{highlight(v.verse, query)}</div>
                <div style={{ color: colors.textDim, fontSize: 14, marginTop: 2 }}>— {v.poetName}《{v.poemTitle}》</div>
              </ResultRow>
            ))}
            {result.verses.length > 3 && <MoreHint>还有 {result.verses.length - 3} 句 ↓</MoreHint>}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 16px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ color: colors.textTertiary, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 3 }}>{title}</div>
        <div style={{ color: colors.textFaint, fontSize: 14 }}>{count}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function ResultRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 8px', background: 'transparent',
        border: 'none', borderRadius: 3,
        color: colors.textPrimary, fontFamily: fontFamilies.chinese, fontSize: 15,
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '4px 0' }}>{children}</div>;
}

function MoreHint({ children }: { children: React.ReactNode }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '6px 8px' }}>{children}</div>;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: colors.highlight, textShadow: colors.highlightShadow }}>{query}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
```

- [ ] **Step 6: Modify `src/components/TopNav.tsx` main variant to use SearchBox**

Replace the search `<div>` placeholder in the `'main'` branch of `TopNav` with:

```tsx
import { SearchBox } from './SearchBox';
// ...inside main variant:
<SearchBox />
```

(Replaces the previous `<div>🔍 搜索诗人、诗名、诗句……</div>`.)

- [ ] **Step 7: Verify visually**

Run: `npm run dev`
Open `/`, click the search box, type `月`. Expected: dropdown opens below search box with three sections (诗人/诗名/诗句) and hits highlighted. Main river dims visually (we'll add a backdrop in this step). Click a hit — navigates to the right page. Press Esc — closes dropdown.

For the backdrop dimming effect, wrap the river area in a div with `filter: brightness(0.45)` when search is open. This requires lifting the "open" state — for MVP, add a prop to SearchBox that calls back when open state changes, and RiverPage uses that to apply the filter. (Simplification: skip the dimming for MVP and just rely on the dropdown's heavy shadow to focus attention. Add it as a polish item only if a smoke-test reviewer flags it.)

- [ ] **Step 8: Commit**

```bash
git add src/utils/search.ts src/utils/search.test.ts src/components/SearchBox.tsx src/components/TopNav.tsx
git commit -m "feat(search): inline dropdown with grouped results and highlighted hits"
```

---

### Task 13: End-to-end smoke test

**Files:**
- Create: `tests/app.smoke.test.ts`

**Goal:** Verify the full flow works end-to-end: app renders → river has poet links → click navigates → poet page renders → click poem → poem page renders → prev/next works.

- [ ] **Step 1: Write `tests/app.smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RiverPage } from '../src/pages/RiverPage';
import { PoetPage } from '../src/pages/PoetPage';
import { PoemPage } from '../src/pages/PoemPage';
import { getPoets, getPoemsByPoet } from '../src/data/load';

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('app smoke', () => {
  it('renders the main river with poet links', () => {
    render(<App />);
    const poets = getPoets();
    const firstPoet = poets[0];
    expect(screen.getByText(firstPoet.name)).toBeInTheDocument();
  });

  it('clicking a poet navigates to the sub-river with poems', () => {
    render(<App />);
    const poets = getPoets();
    const target = poets.find((p) => getPoemsByPoet(p.id).length >= 3) ?? poets[0];

    fireEvent.click(screen.getByText(target.name));

    const poems = getPoemsByPoet(target.id);
    expect(screen.getByText(`${target.birthYear} · 生`)).toBeInTheDocument();
    expect(screen.getByText(poems[0].title)).toBeInTheDocument();
  });

  it('clicking a poem navigates to the reading page', () => {
    render(<App />);
    const poets = getPoets();
    const target = poets.find((p) => getPoemsByPoet(p.id).length >= 2) ?? poets[0];

    fireEvent.click(screen.getByText(target.name));
    const firstPoem = getPoemsByPoet(target.id)[0];
    fireEvent.click(screen.getByText(firstPoem.title));

    expect(screen.getByText(firstPoem.content.split(/[。！？\n]/)[0])).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run smoke test**

Run: `npm test`
Expected: ALL tests pass (smoke test + all earlier unit tests).

- [ ] **Step 3: Manual end-to-end verification in browser**

Run: `npm run dev`
Verify this flow end-to-end:
1. Home page (`/`) loads. Top nav shows logo + search + 唐. River renders ~70–80 poets spread horizontally.
2. Drag the river left/right; scroll works.
3. Click 李白 (focal node, larger). Navigates to `/poet/<id>`.
4. Poet page shows ~30 of Li Bai's poems spread along the river.
5. Click 将进酒. Navigates to `/poem/<id>`.
6. Poem page shows: title + content + (if annotations exist) notes section + (if background exists) background section + bottom prev/next cards.
7. Click 下一首 → navigates to next poem by Li Bai.
8. Navigate back to home. Type `月` in search. Dropdown shows three sections with hits. Click any → navigates correctly. Press Esc → dropdown closes.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add tests/app.smoke.test.ts
git commit -m "test: end-to-end smoke test for the full navigation flow"
```

---

## Self-Review Checklist

**Spec coverage** (after writing, the plan covers):
- ✓ §4 MVP scope: 唐诗三百首 only, Tang only, no images, no courses — respected throughout
- ✓ §5 Three pages: RiverPage (Task 9), PoetPage (Task 10), PoemPage (Task 11)
- ✓ §6 Visual system: theme.ts (Task 1) holds all colors/sizes; primitives in Task 7; pages consume them
- ✓ §7 Data model: types.ts (Task 1), scraper output (Task 4), loaders (Task 5)
- ✓ §8.1 Main river: Task 9
- ✓ §8.2 Search dropdown: Task 12
- ✓ §8.3 Sub-river: Task 10 (no life phases, no years under nodes — spec-compliant)
- ✓ §8.4 Reading page: Task 11 (70px moonlit band with no real image, prev/next within poet)
- ✓ §9 Interactions: search click → page jump (Task 12), prev/next (Task 11), horizontal scroll (Task 9/10)
- ✓ §11 YAGNI exclusions: no emperor track, no literary subdivision, no semantic zoom, no images

**Gaps to flag:**
- The scraper selectors (Tasks 2–3) are best-guess; the implementer must verify against real fixtures and adjust. This is noted in the tasks.
- Familiarity assignments (Task 4 normalize) only bump 15 famous poets and ~13 famous poems to high familiarity. Poet metadata (birth/death years, courtesy/pseudonym names) is only present for the 15 in `POET_META`. Other poets get default 700–750 + familiarity 2. This is acceptable for MVP but worth flagging to the user as a future data-quality improvement.
- The `slug` function uses char-code hex; IDs aren't human-readable in the JSON. This is fine because the data loader looks up by ID, not by name. If the user wants readable URLs later, swap to a pinyin-based slug (would require a pinyin library — deferred).

**Type consistency check:** `Poet.id` and `Poem.poetId` types align across loader, layout, search, and pages. `SearchResult` shape used in Task 12's index matches types.ts. `getNeighbors` return shape matches PoemPage usage.

**No placeholders:** Every step has runnable code or a concrete command with expected output. The two "inspect and adjust" notes in Tasks 2–3 are explicit about what to inspect and how to verify — they're not filler.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-30-shiwen-changhe-mvp.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 13-task plan because each task gets clean context and you can stop/redirect between any two tasks.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Faster start, but you carry the whole plan in context.

Which approach?
