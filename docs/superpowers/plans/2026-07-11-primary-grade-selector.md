# 小学飞花令年级学期选择器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在飞花令小学诗库中加入「年级·学期」端点选择器，使单字、整句、整篇三个玩法的题库都按 1 上累加到当前端点，并为每个非默认端点隔离进度。

**Architecture:** 数据层给小学诗文写入 `gradeBand`，`src/data/grades.ts` 提供端点、累加池、映射校验常量和通用取诗入口；三个玩法引擎增加可选 `band` 参数与按 `corpus:band` 分桶缓存，并导出可用关数函数供大厅和 play 页共用。UI 层只在 `corpus === 'primary'` 时渲染横排印章式 `GradeSelector`，play 页通过同一 `loadGrade()` 读取端点，不改路由结构；默认 `MAX_BAND=12` 复用旧 `:primary` 进度 key。

**Tech Stack:** React 18 + TypeScript + Vite；Vitest 2 + React Testing Library；localStorage；standalone 构建脚本 `scripts/build-standalone.cjs`。

## Global Constraints

- band 整数编码必须固定为：`1上=1, 1下=2, 2上=3, 2下=4, 3上=5, 3下=6, 4上=7, 4下=8, 5上=9, 5下=10, 6上=11, 6下=12`。
- 「累加到 band N」必须取所有 `gradeBand <= N` 的小学诗文；小学诗库等于 `primary + both`，即现有 `getPoems('primary')` 的结果。
- 诗库=小学时，飞花令大厅顶部显示年级端点选择器；长河主视图不增加年级过滤。
- 三个玩法（单字 / 整句 / 整篇）全部按年级累加池过滤题库。
- 默认端点必须是 `MAX_BAND = 12`（六下=全部 108 首），并与现有行为一致。
- localStorage 必须记住上次选择的端点，key 使用 `shiwen-feihua-grade`。
- 单字关键字策略必须沿用现有 30 字 `PRIMARY_KEYWORDS`，按累加池过滤，保留 entry/mid/advanced 分档与顺序。
- 可玩关数必须随累加池伸缩；某模式当前端点下 0 关时显示「本年级暂无关卡，请选更高年级」。
- 每个年级端点必须独立记录进度；默认端点 `band === MAX_BAND` 必须复用旧的无 band 后缀小学 key（例如 `shiwen-feihua-progress:primary`），以保留老用户小学进度。
- tang / all 路径不传 band，必须保持现有题库与 key 规则不变。
- standalone 镜像必须同步同样逻辑，完成后运行 `npm run build:standalone && npm run verify:standalone`。
- 本计划对 spec 中 `getAvailableBands` 示例代码做一个明确取舍：以「只列数据中真有诗的端点」为准，使用 `present.has(b.value)`；不是示例代码里「累加非空即显示」的 `some(v <= b.value)`。

---

## File Structure

- `src/types.ts` — `Poem` 增加可选 `gradeBand?: number`。
- `src/data/poems.json` — 给所有 `corpus !== 'tang'` 的 108 首诗写入 `gradeBand`；唐诗独有诗不写该字段。
- `src/data/grades.ts` — 新建。端点常量、初始 ID→band 映射、band 校验、累加取诗、通用引擎取诗入口。
- `src/data/grades.test.ts` — 新建。校验 108 首小学诗都有 band、JSON 与映射表一致、累加单调、band=12 等于全集。
- `src/state/primaryGrade.ts` / `src/state/primaryGrade.test.ts` — 新建。年级端点 localStorage 读写与越界兜底。
- `src/play/engine.ts` / `src/play/engine.test.ts` / `tests/primary-keywords.test.ts` — 单字引擎 band 过滤、缓存键、可用关键字/关数函数。
- `src/play/couplets.ts` / `src/play/couplets.test.ts` / `tests/sentence-primary.test.ts` — 整句引擎 band 过滤、动态关数组、level→tier 函数。
- `src/play/titles.ts` / `src/play/titles.test.ts` — 整篇引擎 band 过滤、可用关数函数。
- `src/play/progress.ts` / `src/play/sentenceProgress.ts` / `src/play/titleProgress.ts` and corresponding tests — 进度函数透传 `band`，小学非默认端点追加 `:g{band}`。
- `src/components/GradeSelector.tsx` — 新建横排印章式 chips 组件。
- `src/pages/PlayHall.tsx` — 年级选择器、动态关卡网格、0 关占位。
- `src/pages/StagePlay.tsx` / `SentencePlay.tsx` / `TitlePlay.tsx` — 读 `loadGrade()`，传 band 构题与读写进度，按动态总关数处理下一关。
- `tests/stage-corpus.test.tsx` and new `tests/playhall-primary-grade.test.tsx` — UI 回归：小学显示选择器、切端点后关数/进度隔离生效。
- `scripts/build-standalone.cjs` / `standalone.html` — 镜像所有 runtime 改动并重新生成 standalone。

---

## Initial Grade Mapping

Implementation must use this initial mapping. It is duplicated into `src/data/grades.ts` as `PRIMARY_GRADE_BAND_BY_POEM_ID`, and `src/data/poems.json` must match it exactly. Counts by band are: `1:6, 2:7, 3:7, 4:7, 5:8, 6:10, 7:10, 8:7, 9:9, 10:8, 11:10, 12:19`.

```ts
export const PRIMARY_GRADE_BAND_BY_POEM_ID = {
  c90ff9ea5a71: 3,   // 登鹳雀楼
  e9b1a8b4def0: 7,   // 鹿柴
  c35a60c1a8e2: 2,   // 静夜思
  '63d3ff8f6b61': 11, // 宿建德江
  ccee5691ba93: 2,   // 春晓
  '58313be2d918': 3, // 江雪
  '40954072f541': 2, // 寻隐者不遇
  f433a64dd504: 8,   // 芙蓉楼送辛渐
  d75a706935de: 6,   // 九月九日忆山东兄弟
  '9312f5349cd7': 7, // 凉州词
  d3f231047aef: 10,  // 黄鹤楼送孟浩然之广陵
  '0f81015a040c': 5, // 早发白帝城
  caef25db347c: 7,   // 嫦娥
  f6bd6356c843: 6,   // 滁州西涧
  '6fb73f607ad3': 9, // 枫桥夜泊
  f459f8ed8d23: 4,   // 回乡偶书
  f26e62f4bfc8: 12,  // 寒食
  '44ba4afb80db': 9, // 山居秋暝
  b7820a12ebaa: 4,   // 赋得古原草送别
  '4a0d548bebb3': 11, // 过故人庄
  '519029b7355c': 10, // 闻官军收河南河北
  '3963afd966bc': 10, // 凉州词二首·其一
  b9e14c6e09aa: 7,   // 出塞
  '12a2295aa76b': 12, // 送元二使安西
  '161d06b0b556': 6, // 游子吟
  eeb3869b6242: 1,   // 咏鹅
  b6bd9a33dfd7: 1,   // 画
  ea761be0f016: 1,   // 悯农
  '04c68a9b161e': 1, // 古朗月行
  '31dd7d07323c': 2, // 小池
  '846e626d74d3': 3, // 梅花
  '200d28227643': 3, // 小儿垂钓
  f996111bff75: 3,   // 敕勒歌
  '425fb837c387': 4, // 村居
  '9936770100ef': 4, // 咏柳
  d88e3533fc4a: 4,   // 舟夜书所见
  '58699ebb5e93': 5, // 所见
  '3c36881bd247': 5, // 山行
  c987db20a4d7: 5,   // 赠刘景文
  '7ccd1778ba07': 5, // 夜书所见
  '97e6296bfb8d': 5, // 望天门山
  '8949464433f0': 5, // 饮湖上初晴后雨
  '880912218fc8': 5, // 望洞庭
  '84b5b3488790': 6, // 惠崇春江晚景
  fbbd80710c5e: 6,   // 三衢道中
  '6ad0636b01a9': 6, // 忆江南
  a167901c9c90: 6,   // 元日
  '5e26797704a7': 6, // 大林寺桃花
  '0daa9748bcb5': 7, // 暮江吟
  f2f5469a6044: 7,   // 题西林壁
  '8f1be8b774c2': 7, // 雪梅
  '4b3ccba01be6': 7, // 别董大
  '20869108a51c': 11, // 六月二十七日望湖楼醉书
  '03e80e28a0c2': 8, // 清平乐·村居
  '07f5e3403665': 8, // 乡村四月
  c8414cce04e1: 9,   // 蝉
  e152d043be94: 9,   // 乞巧
  '966c8a76211f': 9, // 示儿
  '63f2cb1073ff': 9, // 题临安邸
  d78d2dc95f06: 9,   // 己亥杂诗·其五
  '0a4d69889c65': 9, // 长相思·山一程
  ee72baa043c8: 8,   // 渔歌子·西塞山前白鹭飞
  '4c1364cb1da5': 9, // 观书有感·其一
  be04bba6288c: 10,  // 村晚
  '8ec950bd1395': 10, // 鸟鸣涧
  dab95da71436: 10,  // 秋夜将晓出篱门迎凉有感
  '183d69f50755': 12, // 长歌行
  ba4626c44270: 11,  // 春日
  '857567307e6a': 11, // 浪淘沙·其一
  '33cbdb2cf9b3': 11, // 江南春
  '2367f5ae6dee': 12, // 十五夜望月
  '55174e6ebe20': 12, // 马诗二十三首·其五
  d48451f00541: 12,  // 春夜喜雨
  '4b21381d3a76': 12, // 江上渔者
  df14e6fd217b: 12,  // 泊船瓜洲
  a9a16104dd1b: 12,  // 浣溪沙·游蕲水清泉寺
  '62087a6f': 1,      // 江南
  '0fd5b47e': 1,      // 风
  '8388ae3b': 2,      // 赠汪伦
  '94441bef': 2,      // 池上
  dbcbb06e: 2,        // 画鸡
  e7e0d52d: 3,        // 望庐山瀑布
  f84a15b9: 3,        // 夜宿山寺
  b568bb8b: 4,        // 晓出净慈寺送林子方
  f1442135: 4,        // 绝句
  '9c3a223e': 6,      // 采莲曲
  '7c70e45f': 6,      // 清明
  '5fe2412f': 7,      // 夏日绝句
  bd6891b0: 11,       // 西江月·夜行黄沙道中
  e17392f0: 12,       // 卜算子·送鲍浩然之浙东
  '8e665500': 7,      // 独坐敬亭山
  a8579c5c: 10,       // 四时田园杂兴
  c466edb2: 8,        // 墨梅
  '2448b323': 8,      // 蜂
  fb4dc4ce: 10,       // 稚子弄冰
  '3b04159f': 12,     // 寒菊
  '70029042': 12,     // 江畔独步寻花
  '7766a467': 11,     // 七律·长征
  '261d792c': 11,     // 菩萨蛮·大柏地
  '2119d972': 11,     // 书湖阴先生壁
  '96b5e8a5': 12,     // 迢迢牵牛星
  a8d239f1: 12,       // 石灰吟
  c3687f97: 12,       // 竹石
  '68c412a8': 12,     // 采薇
  ffe0b931: 12,       // 早春呈水部张十八员外
  e6d5eb00: 12,       // 游园不值
  '49f41b11': 12,     // 清平乐
  c2bcb55b: 8,        // 塞下曲
} as const satisfies Record<string, number>;
```

---

### Task 1: 数据模型、年级映射与累加取诗入口

**Files:**
- Modify: `src/types.ts`
- Modify: `src/data/poems.json`
- Create: `src/data/grades.ts`
- Create: `src/data/grades.test.ts`

**Interfaces:**
- Consumes: `getPoems('primary')` from `src/data/load.ts` returns小学全集（`primary + both`）。
- Produces:
  - `gradeBand?: number` on `Poem`
  - `GRADE_BANDS: readonly GradeBand[]`
  - `MAX_BAND = 12`
  - `PRIMARY_GRADE_BAND_BY_POEM_ID`
  - `normalizeBand(value: number): number`
  - `getPrimaryPoemsUpTo(band: number): Poem[]`
  - `getAvailableBands(): GradeBand[]`
  - `getPoemsForPlay(corpus: PoemCorpus, band?: number): Poem[]`

- [ ] **Step 1: Write the failing test** — create `src/data/grades.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getPoems } from './load';
import {
  GRADE_BANDS,
  MAX_BAND,
  PRIMARY_GRADE_BAND_BY_POEM_ID,
  getAvailableBands,
  getPoemsForPlay,
  getPrimaryPoemsUpTo,
  normalizeBand,
} from './grades';

describe('primary grade bands', () => {
  it('defines the 12 grade-semester endpoints', () => {
    expect(GRADE_BANDS.map((b) => b.label)).toEqual([
      '一上', '一下', '二上', '二下', '三上', '三下',
      '四上', '四下', '五上', '五下', '六上', '六下',
    ]);
    expect(GRADE_BANDS.map((b) => b.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(MAX_BAND).toBe(12);
  });

  it('assigns every primary poem exactly one gradeBand that matches the mapping table', () => {
    const primary = getPoems('primary');
    expect(primary.length).toBe(108);
    expect(Object.keys(PRIMARY_GRADE_BAND_BY_POEM_ID).length).toBe(108);

    for (const poem of primary) {
      expect(poem.id in PRIMARY_GRADE_BAND_BY_POEM_ID, `${poem.title} missing from mapping`).toBe(true);
      expect(poem.gradeBand, `${poem.title} gradeBand`).toBe(PRIMARY_GRADE_BAND_BY_POEM_ID[poem.id]);
      expect(poem.gradeBand).toBeGreaterThanOrEqual(1);
      expect(poem.gradeBand).toBeLessThanOrEqual(MAX_BAND);
    }

    const tangOnly = getPoems('tang').filter((p) => p.corpus === 'tang');
    expect(tangOnly.some((p) => p.gradeBand !== undefined)).toBe(false);
  });

  it('accumulates primary poems monotonically up to the selected band', () => {
    const expectedCumulative = [6, 13, 20, 27, 35, 45, 55, 62, 71, 79, 89, 108];
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const poems = getPrimaryPoemsUpTo(band);
      expect(poems.length).toBe(expectedCumulative[band - 1]);
      expect(poems.length).toBeGreaterThanOrEqual(previous);
      expect(poems.every((p) => typeof p.gradeBand === 'number' && p.gradeBand <= band)).toBe(true);
      previous = poems.length;
    }
  });

  it('band 12 is the full primary corpus and getPoemsForPlay applies band only to non-tang pools', () => {
    expect(getPrimaryPoemsUpTo(12).map((p) => p.id).sort()).toEqual(getPoems('primary').map((p) => p.id).sort());
    expect(getPoemsForPlay('primary', 5).map((p) => p.id)).toEqual(getPrimaryPoemsUpTo(5).map((p) => p.id));
    expect(getPoemsForPlay('both', 5).map((p) => p.id)).toEqual(getPrimaryPoemsUpTo(5).map((p) => p.id));
    expect(getPoemsForPlay('tang', 5).length).toBe(getPoems('tang').length);
  });

  it('shows only endpoints whose own band has at least one poem', () => {
    expect(getAvailableBands().map((b) => b.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('normalizes corrupt or out-of-range band values to MAX_BAND', () => {
    expect(normalizeBand(1)).toBe(1);
    expect(normalizeBand(12)).toBe(12);
    expect(normalizeBand(0)).toBe(MAX_BAND);
    expect(normalizeBand(13)).toBe(MAX_BAND);
    expect(normalizeBand(3.5)).toBe(MAX_BAND);
    expect(normalizeBand(Number.NaN)).toBe(MAX_BAND);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/data/grades.test.ts`

Expected: FAIL because `src/data/grades.ts` does not exist and `Poem.gradeBand` is not defined.

- [ ] **Step 3: Add `gradeBand` to `Poem`** — in `src/types.ts`, change the `Poem` interface to:

```ts
export interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: { term: string; explanation: string }[];
  background?: string;
  creationYear?: number;
  familiarity: number; // 1-5
  corpus: PoemCorpus;
  gradeBand?: number;
}
```

- [ ] **Step 4: Create `src/data/grades.ts`** — use this file body, including the full mapping from the “Initial Grade Mapping” section:

```ts
import type { Poem, PoemCorpus } from '../types';
import { getPoems } from './load';

export interface GradeBand {
  value: number;
  label: string;
}

export const GRADE_BANDS: readonly GradeBand[] = [
  { value: 1, label: '一上' },
  { value: 2, label: '一下' },
  { value: 3, label: '二上' },
  { value: 4, label: '二下' },
  { value: 5, label: '三上' },
  { value: 6, label: '三下' },
  { value: 7, label: '四上' },
  { value: 8, label: '四下' },
  { value: 9, label: '五上' },
  { value: 10, label: '五下' },
  { value: 11, label: '六上' },
  { value: 12, label: '六下' },
];

export const MAX_BAND = 12;

export const PRIMARY_GRADE_BAND_BY_POEM_ID = {
  c90ff9ea5a71: 3,
  e9b1a8b4def0: 7,
  c35a60c1a8e2: 2,
  '63d3ff8f6b61': 11,
  ccee5691ba93: 2,
  '58313be2d918': 3,
  '40954072f541': 2,
  f433a64dd504: 8,
  d75a706935de: 6,
  '9312f5349cd7': 7,
  d3f231047aef: 10,
  '0f81015a040c': 5,
  caef25db347c: 7,
  f6bd6356c843: 6,
  '6fb73f607ad3': 9,
  f459f8ed8d23: 4,
  f26e62f4bfc8: 12,
  '44ba4afb80db': 9,
  b7820a12ebaa: 4,
  '4a0d548bebb3': 11,
  '519029b7355c': 10,
  '3963afd966bc': 10,
  b9e14c6e09aa: 7,
  '12a2295aa76b': 12,
  '161d06b0b556': 6,
  eeb3869b6242: 1,
  b6bd9a33dfd7: 1,
  ea761be0f016: 1,
  '04c68a9b161e': 1,
  '31dd7d07323c': 2,
  '846e626d74d3': 3,
  '200d28227643': 3,
  f996111bff75: 3,
  '425fb837c387': 4,
  '9936770100ef': 4,
  d88e3533fc4a: 4,
  '58699ebb5e93': 5,
  '3c36881bd247': 5,
  c987db20a4d7: 5,
  '7ccd1778ba07': 5,
  '97e6296bfb8d': 5,
  '8949464433f0': 5,
  '880912218fc8': 5,
  '84b5b3488790': 6,
  fbbd80710c5e: 6,
  '6ad0636b01a9': 6,
  a167901c9c90: 6,
  '5e26797704a7': 6,
  '0daa9748bcb5': 7,
  f2f5469a6044: 7,
  '8f1be8b774c2': 7,
  '4b3ccba01be6': 7,
  '20869108a51c': 11,
  '03e80e28a0c2': 8,
  '07f5e3403665': 8,
  c8414cce04e1: 9,
  e152d043be94: 9,
  '966c8a76211f': 9,
  '63f2cb1073ff': 9,
  d78d2dc95f06: 9,
  '0a4d69889c65': 9,
  ee72baa043c8: 8,
  '4c1364cb1da5': 9,
  be04bba6288c: 10,
  '8ec950bd1395': 10,
  dab95da71436: 10,
  '183d69f50755': 12,
  ba4626c44270: 11,
  '857567307e6a': 11,
  '33cbdb2cf9b3': 11,
  '2367f5ae6dee': 12,
  '55174e6ebe20': 12,
  d48451f00541: 12,
  '4b21381d3a76': 12,
  df14e6fd217b: 12,
  a9a16104dd1b: 12,
  '62087a6f': 1,
  '0fd5b47e': 1,
  '8388ae3b': 2,
  '94441bef': 2,
  dbcbb06e: 2,
  e7e0d52d: 3,
  f84a15b9: 3,
  b568bb8b: 4,
  f1442135: 4,
  '9c3a223e': 6,
  '7c70e45f': 6,
  '5fe2412f': 7,
  bd6891b0: 11,
  e17392f0: 12,
  '8e665500': 7,
  a8579c5c: 10,
  c466edb2: 8,
  '2448b323': 8,
  fb4dc4ce: 10,
  '3b04159f': 12,
  '70029042': 12,
  '7766a467': 11,
  '261d792c': 11,
  '2119d972': 11,
  '96b5e8a5': 12,
  a8d239f1: 12,
  c3687f97: 12,
  '68c412a8': 12,
  ffe0b931: 12,
  e6d5eb00: 12,
  '49f41b11': 12,
  c2bcb55b: 8,
} as const satisfies Record<string, number>;

export function normalizeBand(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BAND ? value : MAX_BAND;
}

export function getPrimaryPoemsUpTo(band: number): Poem[] {
  const normalized = normalizeBand(band);
  return getPoems('primary').filter(
    (p) => typeof p.gradeBand === 'number' && p.gradeBand <= normalized,
  );
}

export function getAvailableBands(): GradeBand[] {
  const present = new Set(
    getPoems('primary')
      .map((p) => p.gradeBand)
      .filter((b): b is number => typeof b === 'number'),
  );
  return GRADE_BANDS.filter((b) => present.has(b.value));
}

export function getPoemsForPlay(corpus: PoemCorpus, band?: number): Poem[] {
  if (corpus !== 'tang' && band != null) return getPrimaryPoemsUpTo(band);
  return corpus === 'both' ? getPoems() : getPoems(corpus);
}
```

- [ ] **Step 5: Add `gradeBand` to `src/data/poems.json`** — run this one-time patch script from the repository root. The script already contains the complete initial mapping and must be run exactly as written.

Run:

```bash
PYTHONIOENCODING=utf-8 python - <<'PY'
import json
from pathlib import Path

mapping = {
  'c90ff9ea5a71': 3, 'e9b1a8b4def0': 7, 'c35a60c1a8e2': 2, '63d3ff8f6b61': 11,
  'ccee5691ba93': 2, '58313be2d918': 3, '40954072f541': 2, 'f433a64dd504': 8,
  'd75a706935de': 6, '9312f5349cd7': 7, 'd3f231047aef': 10, '0f81015a040c': 5,
  'caef25db347c': 7, 'f6bd6356c843': 6, '6fb73f607ad3': 9, 'f459f8ed8d23': 4,
  'f26e62f4bfc8': 12, '44ba4afb80db': 9, 'b7820a12ebaa': 4, '4a0d548bebb3': 11,
  '519029b7355c': 10, '3963afd966bc': 10, 'b9e14c6e09aa': 7, '12a2295aa76b': 12,
  '161d06b0b556': 6, 'eeb3869b6242': 1, 'b6bd9a33dfd7': 1, 'ea761be0f016': 1,
  '04c68a9b161e': 1, '31dd7d07323c': 2, '846e626d74d3': 3, '200d28227643': 3,
  'f996111bff75': 3, '425fb837c387': 4, '9936770100ef': 4, 'd88e3533fc4a': 4,
  '58699ebb5e93': 5, '3c36881bd247': 5, 'c987db20a4d7': 5, '7ccd1778ba07': 5,
  '97e6296bfb8d': 5, '8949464433f0': 5, '880912218fc8': 5, '84b5b3488790': 6,
  'fbbd80710c5e': 6, '6ad0636b01a9': 6, 'a167901c9c90': 6, '5e26797704a7': 6,
  '0daa9748bcb5': 7, 'f2f5469a6044': 7, '8f1be8b774c2': 7, '4b3ccba01be6': 7,
  '20869108a51c': 11, '03e80e28a0c2': 8, '07f5e3403665': 8, 'c8414cce04e1': 9,
  'e152d043be94': 9, '966c8a76211f': 9, '63f2cb1073ff': 9, 'd78d2dc95f06': 9,
  '0a4d69889c65': 9, 'ee72baa043c8': 8, '4c1364cb1da5': 9, 'be04bba6288c': 10,
  '8ec950bd1395': 10, 'dab95da71436': 10, '183d69f50755': 12, 'ba4626c44270': 11,
  '857567307e6a': 11, '33cbdb2cf9b3': 11, '2367f5ae6dee': 12, '55174e6ebe20': 12,
  'd48451f00541': 12, '4b21381d3a76': 12, 'df14e6fd217b': 12, 'a9a16104dd1b': 12,
  '62087a6f': 1, '0fd5b47e': 1, '8388ae3b': 2, '94441bef': 2, 'dbcbb06e': 2,
  'e7e0d52d': 3, 'f84a15b9': 3, 'b568bb8b': 4, 'f1442135': 4, '9c3a223e': 6,
  '7c70e45f': 6, '5fe2412f': 7, 'bd6891b0': 11, 'e17392f0': 12, '8e665500': 7,
  'a8579c5c': 10, 'c466edb2': 8, '2448b323': 8, 'fb4dc4ce': 10, '3b04159f': 12,
  '70029042': 12, '7766a467': 11, '261d792c': 11, '2119d972': 11, '96b5e8a5': 12,
  'a8d239f1': 12, 'c3687f97': 12, '68c412a8': 12, 'ffe0b931': 12, 'e6d5eb00': 12,
  '49f41b11': 12, 'c2bcb55b': 8,
}

path = Path('src/data/poems.json')
poems = json.loads(path.read_text(encoding='utf-8'))
seen = set()
for poem in poems:
    corpus = poem.get('corpus', 'tang')
    if corpus == 'tang':
        poem.pop('gradeBand', None)
        continue
    if poem['id'] not in mapping:
        raise SystemExit(f"missing mapping: {poem['id']} {poem['title']}")
    poem['gradeBand'] = mapping[poem['id']]
    seen.add(poem['id'])
missing = set(mapping) - seen
if missing:
    raise SystemExit(f"mapping ids not found in poems.json: {sorted(missing)}")
path.write_text(json.dumps(poems, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PY
```

- [ ] **Step 6: Run the data test**

Run: `npx vitest run src/data/grades.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/data/poems.json src/data/grades.ts src/data/grades.test.ts
git commit -m "feat(feihua): add primary grade band data"
```

---

### Task 2: 年级端点 localStorage 状态

**Files:**
- Create: `src/state/primaryGrade.ts`
- Create: `src/state/primaryGrade.test.ts`

**Interfaces:**
- Consumes: `MAX_BAND` and `normalizeBand(value)` from `src/data/grades.ts`.
- Produces:
  - `loadGrade(): number`
  - `saveGrade(band: number): void`

- [ ] **Step 1: Write the failing test** — create `src/state/primaryGrade.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_BAND } from '../data/grades';
import { loadGrade, saveGrade } from './primaryGrade';

describe('primary grade state', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to MAX_BAND when no saved value exists', () => {
    expect(loadGrade()).toBe(MAX_BAND);
  });

  it('round-trips a selected band', () => {
    saveGrade(5);
    expect(loadGrade()).toBe(5);
  });

  it('normalizes corrupt or out-of-range saved values to MAX_BAND', () => {
    window.localStorage.setItem('shiwen-feihua-grade', 'abc');
    expect(loadGrade()).toBe(MAX_BAND);
    window.localStorage.setItem('shiwen-feihua-grade', '0');
    expect(loadGrade()).toBe(MAX_BAND);
    window.localStorage.setItem('shiwen-feihua-grade', '13');
    expect(loadGrade()).toBe(MAX_BAND);
  });

  it('normalizes before saving', () => {
    saveGrade(99);
    expect(window.localStorage.getItem('shiwen-feihua-grade')).toBe(String(MAX_BAND));
  });

  it('survives localStorage being unavailable', () => {
    const originalGet = window.localStorage.getItem;
    const originalSet = window.localStorage.setItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    window.localStorage.setItem = () => { throw new Error('denied'); };
    expect(loadGrade()).toBe(MAX_BAND);
    expect(() => saveGrade(5)).not.toThrow();
    window.localStorage.getItem = originalGet;
    window.localStorage.setItem = originalSet;
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/primaryGrade.test.ts`

Expected: FAIL because `src/state/primaryGrade.ts` does not exist.

- [ ] **Step 3: Implement `src/state/primaryGrade.ts`**

```ts
import { MAX_BAND, normalizeBand } from '../data/grades';

const KEY = 'shiwen-feihua-grade';

export function loadGrade(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw == null ? Number.NaN : parseInt(raw, 10);
    return normalizeBand(parsed);
  } catch {
    return MAX_BAND;
  }
}

export function saveGrade(band: number): void {
  try {
    window.localStorage.setItem(KEY, String(normalizeBand(band)));
  } catch {
    // localStorage 不可用时忽略，页面仍用当前 React state。
  }
}
```

- [ ] **Step 4: Run the state tests**

Run: `npx vitest run src/state/primaryGrade.test.ts src/data/grades.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/primaryGrade.ts src/state/primaryGrade.test.ts
git commit -m "feat(feihua): remember selected primary grade band"
```

---

### Task 3: 单字引擎 band 过滤与自适应关键字

**Files:**
- Modify: `src/play/engine.ts`
- Modify: `src/play/engine.test.ts`
- Modify: `tests/primary-keywords.test.ts`

**Interfaces:**
- Consumes:
  - `getPoemsForPlay(corpus, band?)` from `src/data/grades.ts`
  - `PRIMARY_KEYWORD_GROUPS`, `PRIMARY_KEYWORDS` from `src/play/primaryKeywords.ts`
  - `STAGE_GOAL = 5` from `src/play/types.ts`
- Produces:
  - `buildKeywordIndex(corpus?: PoemCorpus, band?: number)`
  - `buildKeywordIndexFullScan(corpus?: PoemCorpus, band?: number)`
  - `getKeywordIndex(corpus?: PoemCorpus, band?: number)`
  - `getKeywordIndexFullScan(corpus?: PoemCorpus, band?: number)`
  - `getVersesFor(keyword, corpus?, band?)`
  - `pickStageQuestion(keyword, used, corpus?, band?)`
  - `getCharKeywords(corpus?: PoemCorpus, band?: number): readonly string[]`
  - `getCharKeywordGroups(corpus?: PoemCorpus, band?: number): { tier: 'entry' | 'mid' | 'advanced'; words: readonly string[] }[]`
  - `countAvailableCharStages(corpus?: PoemCorpus, band?: number): number`

- [ ] **Step 1: Write failing tests** — append these tests to `src/play/engine.test.ts`:

```ts
import { MAX_BAND } from '../data/grades';
import { PRIMARY_KEYWORDS } from './primaryKeywords';
import { countAvailableCharStages, getCharKeywordGroups, getCharKeywords, getVersesFor } from './engine';

describe('primary grade band filtering for char mode', () => {
  it('getVersesFor(primary, band) is a subset of the full primary pool and grows monotonically', () => {
    const keyword = '春';
    const full = getVersesFor(keyword, 'primary', MAX_BAND).map((v) => `${v.poemId}:${v.line}`);
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const current = getVersesFor(keyword, 'primary', band).map((v) => `${v.poemId}:${v.line}`);
      expect(current.length).toBeGreaterThanOrEqual(previous);
      expect(current.every((hit) => full.includes(hit))).toBe(true);
      previous = current.length;
    }
  });

  it('filters primary keywords by the current cumulative pool while preserving order', () => {
    const low = getCharKeywords('primary', 1);
    const full = getCharKeywords('primary', MAX_BAND);
    expect(full).toEqual(PRIMARY_KEYWORDS);
    expect(low.length).toBeLessThan(full.length);
    expect(low.every((kw) => PRIMARY_KEYWORDS.includes(kw))).toBe(true);
    expect(low).toEqual(PRIMARY_KEYWORDS.filter((kw) => low.includes(kw)));
  });

  it('returns grouped primary keywords with empty groups removed for a low band', () => {
    const groups = getCharKeywordGroups('primary', 1);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.words.length > 0)).toBe(true);
    expect(groups.flatMap((g) => [...g.words])).toEqual(getCharKeywords('primary', 1));
  });

  it('keeps tang and full primary char counts unchanged', () => {
    expect(countAvailableCharStages('tang')).toBe(50);
    expect(countAvailableCharStages('primary', MAX_BAND)).toBe(30);
  });
});
```

Also update `tests/primary-keywords.test.ts` so the “each keyword has ≥ 5 primary-corpus verses” assertion explicitly checks full band:

```ts
const verses = getVersesFor(kw, 'primary', MAX_BAND);
```

and import `MAX_BAND` from `../src/data/grades`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/play/engine.test.ts tests/primary-keywords.test.ts`

Expected: FAIL because the new exports/signatures do not exist.

- [ ] **Step 3: Update `src/play/engine.ts` imports and cache keys**

At the top, add imports:

```ts
import { getPoemsForPlay } from '../data/grades';
import { PRIMARY_KEYWORDS, PRIMARY_KEYWORD_GROUPS } from './primaryKeywords';
import { STAGE_GOAL } from './types';
```

Add local types and helper near the imports:

```ts
type KeywordTier = 'entry' | 'mid' | 'advanced';

export interface CharKeywordGroup {
  tier: KeywordTier;
  words: readonly string[];
}

function cacheKey(corpus: PoemCorpus, band?: number): string {
  return band == null ? corpus : `${corpus}:${band}`;
}
```

Change `_fullScanCache` and `_keywordCache` to:

```ts
const _fullScanCache = new Map<string, Map<string, Verse[]>>();
const _keywordCache = new Map<string, Map<string, Verse[]>>();
```

- [ ] **Step 4: Thread `band` through index builders and lookups**

Change the signatures and poem source:

```ts
export function buildKeywordIndex(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const poems = getPoemsForPlay(corpus, band);
  const index = new Map<string, Verse[]>();
  for (const k of KEYWORDS) index.set(k, []);
  // keep the existing loop body unchanged
}

export function buildKeywordIndexFullScan(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const poems = getPoemsForPlay(corpus, band);
  const index = new Map<string, Verse[]>();
  // keep the existing loop body unchanged
}

export function getKeywordIndex(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const key = cacheKey(corpus, band);
  if (!_keywordCache.has(key)) _keywordCache.set(key, buildKeywordIndex(corpus, band));
  return _keywordCache.get(key)!;
}

export function getKeywordIndexFullScan(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const key = cacheKey(corpus, band);
  if (!_fullScanCache.has(key)) _fullScanCache.set(key, buildKeywordIndexFullScan(corpus, band));
  return _fullScanCache.get(key)!;
}

export function getVersesFor(keyword: string, corpus: PoemCorpus = 'tang', band?: number): Verse[] {
  if (KEYWORDS.includes(keyword)) {
    return getKeywordIndex(corpus, band).get(keyword) ?? [];
  }
  return getKeywordIndexFullScan(corpus, band).get(keyword) ?? [];
}
```

Change `pickStageQuestion` signature and first line:

```ts
export function pickStageQuestion(
  keyword: string,
  used: Set<string>,
  corpus: PoemCorpus = 'tang',
  band?: number,
): { verse: Verse; blanks: number[] } | null {
  const pool = getVersesFor(keyword, corpus, band).filter(v => !used.has(v.line));
  // keep the rest unchanged
}
```

- [ ] **Step 5: Export adaptive keyword helpers** — append to `engine.ts` after `getVersesFor`:

```ts
const TANG_CHAR_GROUPS: readonly CharKeywordGroup[] = [
  { tier: 'entry', words: KEYWORD_GROUPS.entry },
  { tier: 'mid', words: KEYWORD_GROUPS.mid },
  { tier: 'advanced', words: KEYWORD_GROUPS.advanced },
];

const PRIMARY_CHAR_GROUPS: readonly CharKeywordGroup[] = [
  { tier: 'entry', words: PRIMARY_KEYWORD_GROUPS.entry },
  { tier: 'mid', words: PRIMARY_KEYWORD_GROUPS.mid },
  { tier: 'advanced', words: PRIMARY_KEYWORD_GROUPS.advanced },
];

export function getCharKeywordGroups(corpus: PoemCorpus = 'tang', band?: number): CharKeywordGroup[] {
  if (corpus !== 'primary') return [...TANG_CHAR_GROUPS];
  return PRIMARY_CHAR_GROUPS
    .map((group) => ({
      tier: group.tier,
      words: group.words.filter((kw) => getVersesFor(kw, 'primary', band).length >= STAGE_GOAL),
    }))
    .filter((group) => group.words.length > 0);
}

export function getCharKeywords(corpus: PoemCorpus = 'tang', band?: number): readonly string[] {
  if (corpus !== 'primary') return KEYWORDS;
  return getCharKeywordGroups('primary', band).flatMap((group) => [...group.words]);
}

export function countAvailableCharStages(corpus: PoemCorpus = 'tang', band?: number): number {
  return getCharKeywords(corpus, band).length;
}
```

- [ ] **Step 6: Run char-engine tests**

Run: `npx vitest run src/play/engine.test.ts tests/primary-keywords.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/play/engine.ts src/play/engine.test.ts tests/primary-keywords.test.ts
git commit -m "feat(feihua): filter char stages by primary grade band"
```

---

### Task 4: 整句与整篇引擎 band 过滤和动态关数

**Files:**
- Modify: `src/play/couplets.ts`
- Modify: `src/play/couplets.test.ts`
- Modify: `tests/sentence-primary.test.ts`
- Modify: `src/play/titles.ts`
- Modify: `src/play/titles.test.ts`

**Interfaces:**
- Consumes: `getPoemsForPlay(corpus, band?)` and `MAX_BAND`.
- Produces in `couplets.ts`:
  - `buildAllCouplets(corpus?: PoemCorpus, band?: number)`
  - `getAllCouplets(corpus?: PoemCorpus, band?: number)`
  - `countAvailableLevels(tier: LevelTier, corpus?: PoemCorpus, band?: number): number`
  - `getAvailableLevelGroups(corpus?: PoemCorpus, band?: number): SentenceLevelGroup[]`
  - `getTotalAvailableLevels(corpus?: PoemCorpus, band?: number): number`
  - `tierOfAvailableLevel(level: number, corpus?: PoemCorpus, band?: number): LevelTier | null`
  - `pickLevelQuestion(tier, usedUpperLines, corpus?, band?)`
- Produces in `titles.ts`:
  - `pickTitleQuestion(level, usedPoemIds, corpus, band?)`
  - `countAvailableTitleLevels(corpus: PoemCorpus, band?: number): number`

- [ ] **Step 1: Write failing couplet tests** — append to `src/play/couplets.test.ts`:

```ts
import { MAX_BAND } from '../data/grades';
import {
  countAvailableLevels,
  getAllCouplets,
  getAvailableLevelGroups,
  getTotalAvailableLevels,
  tierOfAvailableLevel,
} from './couplets';

describe('primary grade band filtering for sentence mode', () => {
  it('filters couplet pools by grade band monotonically', () => {
    const full = getAllCouplets('primary', MAX_BAND).map((p) => `${p.upper.poemId}:${p.upper.line}`);
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const current = getAllCouplets('primary', band).map((p) => `${p.upper.poemId}:${p.upper.line}`);
      expect(current.length).toBeGreaterThanOrEqual(previous);
      expect(current.every((hit) => full.includes(hit))).toBe(true);
      previous = current.length;
    }
  });

  it('returns dynamic level groups and preserves the full primary total at band 12', () => {
    expect(getTotalAvailableLevels('primary', MAX_BAND)).toBe(30);
    expect(getAvailableLevelGroups('primary', MAX_BAND)).toEqual([
      { tier: 'entry', start: 1, end: 10, count: 10 },
      { tier: 'mid', start: 11, end: 30, count: 20 },
    ]);
    expect(getTotalAvailableLevels('primary', 1)).toBeLessThan(30);
  });

  it('maps dynamic level numbers back to tiers', () => {
    expect(tierOfAvailableLevel(1, 'primary', MAX_BAND)).toBe('entry');
    expect(tierOfAvailableLevel(10, 'primary', MAX_BAND)).toBe('entry');
    expect(tierOfAvailableLevel(11, 'primary', MAX_BAND)).toBe('mid');
    expect(tierOfAvailableLevel(30, 'primary', MAX_BAND)).toBe('mid');
    expect(tierOfAvailableLevel(31, 'primary', MAX_BAND)).toBeNull();
  });

  it('keeps tang sentence mode at 50 levels', () => {
    expect(getTotalAvailableLevels('tang')).toBe(50);
    expect(getAvailableLevelGroups('tang')).toEqual([
      { tier: 'entry', start: 1, end: 10, count: 10 },
      { tier: 'mid', start: 11, end: 30, count: 20 },
      { tier: 'advanced', start: 31, end: 50, count: 20 },
    ]);
  });
});
```

Update `tests/sentence-primary.test.ts` to pass `MAX_BAND` in existing primary calls:

```ts
const pairs = getAllCouplets('primary', MAX_BAND);
const q = pickLevelQuestion(tier, new Set(), 'primary', MAX_BAND);
const q = pickLevelQuestion('entry', used, 'primary', MAX_BAND);
```

- [ ] **Step 2: Write failing title tests** — append to `src/play/titles.test.ts`:

```ts
import { MAX_BAND } from '../data/grades';
import { countAvailableTitleLevels } from './titles';

describe('primary grade band filtering for title mode', () => {
  it('counts title levels from the current cumulative primary pool', () => {
    expect(countAvailableTitleLevels('primary', 1)).toBe(6);
    expect(countAvailableTitleLevels('primary', MAX_BAND)).toBe(30);
    expect(countAvailableTitleLevels('tang')).toBe(50);
  });

  it('pickTitleQuestion uses only poems from the selected primary band', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'primary', 1);
    expect(q).not.toBeNull();
    expect(['eeb3869b6242', 'b6bd9a33dfd7', 'ea761be0f016', '04c68a9b161e', '62087a6f', '0fd5b47e']).toContain(q!.poemId);
  });
});
```

- [ ] **Step 3: Run the engine tests to verify they fail**

Run: `npx vitest run src/play/couplets.test.ts tests/sentence-primary.test.ts src/play/titles.test.ts`

Expected: FAIL because new exports/signatures do not exist.

- [ ] **Step 4: Update `src/play/couplets.ts` caches and poem source**

Add import:

```ts
import { getPoemsForPlay } from '../data/grades';
```

Replace the three `Map<PoemCorpus, ...>` caches with `Map<string, ...>` and add:

```ts
function cacheKey(corpus: PoemCorpus, band?: number): string {
  return band == null ? corpus : `${corpus}:${band}`;
}
```

Change `buildAllCouplets` poem source:

```ts
export function buildAllCouplets(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const poems = getPoemsForPlay(corpus, band);
  // keep existing loop body
}
```

Change getters:

```ts
export function getAllCouplets(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_allPairsCacheByCorpus.has(key)) {
    _allPairsCacheByCorpus.set(key, buildAllCouplets(corpus, band));
  }
  return _allPairsCacheByCorpus.get(key)!;
}

function getShortPool(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_shortPoolCacheByCorpus.has(key)) {
    _shortPoolCacheByCorpus.set(key, getAllCouplets(corpus, band).filter((p) => stripPunct(p.lower.line).length === 5));
  }
  return _shortPoolCacheByCorpus.get(key)!;
}

function getLongPool(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_longPoolCacheByCorpus.has(key)) {
    _longPoolCacheByCorpus.set(key, getAllCouplets(corpus, band).filter((p) => stripPunct(p.lower.line).length === 7));
  }
  return _longPoolCacheByCorpus.get(key)!;
}

function getPoolForTier(tier: LevelTier, corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  if (tier === 'entry') return getShortPool(corpus, band);
  if (tier === 'mid') return getLongPool(corpus, band);
  return getAllCouplets(corpus, band);
}
```

Change `pickLevelQuestion` signature and calls to pools:

```ts
export function pickLevelQuestion(
  tier: LevelTier,
  usedUpperLines: Set<string>,
  corpus: PoemCorpus = 'tang',
  band?: number,
): SentenceQuestion | null {
  const pool = getPoolForTier(tier, corpus, band).filter((p) => !usedUpperLines.has(p.upper.line));
  // ...
  const allPairs = getAllCouplets(corpus, band);
  // keep rest unchanged
}
```

- [ ] **Step 5: Export dynamic sentence level helpers** — append below `tierOfLevel` or below `pickLevelQuestion`:

```ts
export interface SentenceLevelGroup {
  tier: LevelTier;
  start: number;
  end: number;
  count: number;
}

const TIER_CAPS: Record<LevelTier, number> = {
  entry: 10,
  mid: 20,
  advanced: 20,
};

function canMakeQuestion(pair: CoupletPair, allPairs: CoupletPair[]): boolean {
  const correctLen = stripPunct(pair.lower.line).length;
  const seen = new Set<string>([pair.lower.line]);
  let count = 0;
  for (const candidate of allPairs) {
    if (candidate.lower.poemId === pair.lower.poemId) continue;
    if (seen.has(candidate.lower.line)) continue;
    if (stripPunct(candidate.lower.line).length !== correctLen) continue;
    seen.add(candidate.lower.line);
    count++;
    if (count >= 3) return true;
  }
  return false;
}

export function countAvailableLevels(tier: LevelTier, corpus: PoemCorpus = 'tang', band?: number): number {
  if (corpus === 'primary' && tier === 'advanced') return 0;
  const pool = getPoolForTier(tier, corpus, band);
  const allPairs = getAllCouplets(corpus, band);
  const upperLines = new Set<string>();
  for (const pair of pool) {
    if (!canMakeQuestion(pair, allPairs)) continue;
    upperLines.add(pair.upper.line);
  }
  return Math.min(TIER_CAPS[tier], upperLines.size);
}

export function getAvailableLevelGroups(corpus: PoemCorpus = 'tang', band?: number): SentenceLevelGroup[] {
  const tiers: LevelTier[] = corpus === 'primary' ? ['entry', 'mid'] : ['entry', 'mid', 'advanced'];
  const groups: SentenceLevelGroup[] = [];
  let start = 1;
  for (const tier of tiers) {
    const count = countAvailableLevels(tier, corpus, band);
    if (count === 0) continue;
    groups.push({ tier, start, end: start + count - 1, count });
    start += count;
  }
  return groups;
}

export function getTotalAvailableLevels(corpus: PoemCorpus = 'tang', band?: number): number {
  return getAvailableLevelGroups(corpus, band).reduce((sum, group) => sum + group.count, 0);
}

export function tierOfAvailableLevel(level: number, corpus: PoemCorpus = 'tang', band?: number): LevelTier | null {
  return getAvailableLevelGroups(corpus, band).find((group) => level >= group.start && level <= group.end)?.tier ?? null;
}
```

- [ ] **Step 6: Update `src/play/titles.ts`**

Add import:

```ts
import { getPoemsForPlay } from '../data/grades';
```

Change `buildPool` and `pickTitleQuestion`:

```ts
const TITLE_LEVEL_CAP: Record<PoemCorpus, number> = {
  tang: 50,
  primary: 30,
  both: 50,
};

function buildPool(corpus: PoemCorpus, band?: number) {
  return getPoemsForPlay(corpus, band).filter(p => p.content && p.content.length > 0);
}

export function countAvailableTitleLevels(corpus: PoemCorpus, band?: number): number {
  const pool = buildPool(corpus, band);
  if (pool.length < 4) return 0;
  return Math.min(TITLE_LEVEL_CAP[corpus], pool.length);
}

export function pickTitleQuestion(
  level: number,
  usedPoemIds: ReadonlySet<string>,
  corpus: PoemCorpus,
  band?: number,
): TitleQuestion | null {
  const pool = buildPool(corpus, band);
  // keep rest unchanged
}
```

- [ ] **Step 7: Run sentence/title engine tests**

Run: `npx vitest run src/play/couplets.test.ts tests/sentence-primary.test.ts src/play/titles.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/play/couplets.ts src/play/couplets.test.ts tests/sentence-primary.test.ts src/play/titles.ts src/play/titles.test.ts
git commit -m "feat(feihua): count sentence and title levels by grade band"
```

---

### Task 5: 三套进度按小学年级端点隔离

**Files:**
- Modify: `src/play/progress.ts`
- Modify: `src/play/sentenceProgress.ts`
- Modify: `src/play/titleProgress.ts`
- Modify: `src/play/progress.test.ts`
- Modify: `src/play/titleProgress.test.ts`
- Create: `src/play/sentenceProgress.test.ts` if it does not already exist; otherwise modify the existing file.

**Interfaces:**
- Consumes: `MAX_BAND` from `src/data/grades.ts`.
- Produces: all load/save/mark/begin/commit/clear progress functions accept optional `band?: number` and use `:g{band}` only for `corpus === 'primary' && band !== MAX_BAND`.

- [ ] **Step 1: Add failing progress tests** — append to `src/play/progress.test.ts`:

```ts
it('isolates primary char progress by non-default grade band', () => {
  saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 2, cleared: ['春'] }, 'primary', 5);
  expect(loadProgress('primary', 5).cleared).toEqual(['春']);
  expect(loadProgress('primary', 6)).toEqual(INITIAL_PROGRESS);
});

it('uses the legacy primary key for MAX_BAND char progress', () => {
  const legacy = { ...INITIAL_PROGRESS, unlockedIndex: 9, cleared: ['春', '月'] };
  window.localStorage.setItem('shiwen-feihua-progress:primary', JSON.stringify(legacy));
  expect(loadProgress('primary', 12)).toEqual(legacy);
  expect(loadProgress('primary')).toEqual(legacy);
});

it('does not add grade suffixes for tang or all char progress', () => {
  saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 3, cleared: ['春'] }, 'tang', 5);
  saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 4, cleared: ['月'] }, 'all', 5);
  expect(window.localStorage.getItem('shiwen-feihua-progress')).not.toBeNull();
  expect(window.localStorage.getItem('shiwen-feihua-progress:all')).not.toBeNull();
  expect(window.localStorage.getItem('shiwen-feihua-progress:tang:g5')).toBeNull();
  expect(window.localStorage.getItem('shiwen-feihua-progress:all:g5')).toBeNull();
});
```

Add analogous tests to `src/play/titleProgress.test.ts`:

```ts
it('isolates primary title progress by non-default grade band', () => {
  saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 2, cleared: ['1'] }, 'primary', 5);
  expect(loadTitleProgress('primary', 5).cleared).toEqual(['1']);
  expect(loadTitleProgress('primary', 6)).toEqual(INITIAL_PROGRESS);
});

it('uses the legacy primary key for MAX_BAND title progress', () => {
  const legacy = { ...INITIAL_PROGRESS, unlockedIndex: 8, cleared: ['1', '2'] };
  window.localStorage.setItem('shiwen-feihua-title-progress:primary', JSON.stringify(legacy));
  expect(loadTitleProgress('primary', 12)).toEqual(legacy);
  expect(loadTitleProgress('primary')).toEqual(legacy);
});
```

Create or update `src/play/sentenceProgress.test.ts` with the same structure as `titleProgress.test.ts`, using `loadSentenceProgress`, `saveSentenceProgress`, and key prefix `shiwen-feihua-sentence-progress`.

- [ ] **Step 2: Run progress tests to verify they fail**

Run: `npx vitest run src/play/progress.test.ts src/play/sentenceProgress.test.ts src/play/titleProgress.test.ts`

Expected: FAIL because progress APIs do not accept `band` and storage keys do not use `:g{band}`.

- [ ] **Step 3: Update `src/play/progress.ts`**

Import `MAX_BAND`:

```ts
import { MAX_BAND } from '../data/grades';
```

Replace `storageKey` and thread `band` through all exported functions:

```ts
function storageKey(corpus: Corpus, band?: number): string {
  if (corpus === 'tang') return STORAGE_KEY;
  const base = `${STORAGE_KEY}:${corpus}`;
  if (corpus !== 'primary' || band == null || band === MAX_BAND) return base;
  return `${base}:g${band}`;
}

export function loadProgress(corpus: Corpus = 'tang', band?: number): FeihuaProgress {
  // use storageKey(corpus, band)
}

export function saveProgress(p: FeihuaProgress, corpus: Corpus = 'tang', band?: number): void {
  // use storageKey(corpus, band)
}

export function markCleared(keyword: string, corpus: Corpus = 'tang', band?: number): FeihuaProgress {
  const p = loadProgress(corpus, band);
  // existing body, then saveProgress(p, corpus, band)
}

export function beginStage(keyword: string, corpus: Corpus = 'tang', band?: number): FeihuaProgress {
  const p = loadProgress(corpus, band);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p, corpus, band);
  return p;
}
```

Also apply the same `band` parameter to `commitStageCorrect`, `commitStageBlood`, and `clearCurrent`.

- [ ] **Step 4: Update `src/play/sentenceProgress.ts` and `src/play/titleProgress.ts`**

Use the same storage key rule, changing only `STORAGE_KEY` and function names. Every exported function must accept optional `band?: number`; every internal load/save call must pass the same `band`.

For sentence progress, the key rule is:

```ts
function storageKey(corpus: Corpus, band?: number): string {
  if (corpus === 'tang') return STORAGE_KEY;
  const base = `${STORAGE_KEY}:${corpus}`;
  if (corpus !== 'primary' || band == null || band === MAX_BAND) return base;
  return `${base}:g${band}`;
}
```

For title progress, use the identical function body.

- [ ] **Step 5: Run progress tests**

Run: `npx vitest run src/play/progress.test.ts src/play/sentenceProgress.test.ts src/play/titleProgress.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/play/progress.ts src/play/sentenceProgress.ts src/play/titleProgress.ts src/play/progress.test.ts src/play/sentenceProgress.test.ts src/play/titleProgress.test.ts
git commit -m "feat(feihua): isolate primary progress by grade band"
```

---

### Task 6: 飞花令大厅选择器、动态关卡网格和 0 关占位

**Files:**
- Create: `src/components/GradeSelector.tsx`
- Modify: `src/pages/PlayHall.tsx`
- Create: `tests/playhall-primary-grade.test.tsx`

**Interfaces:**
- Consumes:
  - `getAvailableBands`, `MAX_BAND` from `src/data/grades.ts`
  - `loadGrade`, `saveGrade` from `src/state/primaryGrade.ts`
  - `getCharKeywordGroups`, `getCharKeywords` from `src/play/engine.ts`
  - `getAvailableLevelGroups`, `getTotalAvailableLevels` from `src/play/couplets.ts`
  - `countAvailableTitleLevels` from `src/play/titles.ts`
  - progress functions with `band?: number`
- Produces: `<GradeSelector bands value onChange />` and PlayHall rendering that adapts all three tabs to selected band.

- [ ] **Step 1: Write failing UI tests** — create `tests/playhall-primary-grade.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PlayHall } from '../src/pages/PlayHall';

function renderHallWithPrimaryCorpus() {
  window.localStorage.setItem('feihuaCorpus', 'primary');
  return render(
    <MemoryRouter>
      <CorpusProvider>
        <PlayHall />
      </CorpusProvider>
    </MemoryRouter>,
  );
}

describe('PlayHall primary grade selector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows grade chips only for primary corpus and defaults to 六下', () => {
    renderHallWithPrimaryCorpus();
    expect(screen.getByRole('button', { name: '一上' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '六下' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the selected grade band when a chip is clicked', () => {
    renderHallWithPrimaryCorpus();
    fireEvent.click(screen.getByRole('button', { name: '三上' }));
    expect(window.localStorage.getItem('shiwen-feihua-grade')).toBe('5');
    expect(screen.getByRole('button', { name: '三上' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders fewer primary char stages for 一上 than for 六下', () => {
    renderHallWithPrimaryCorpus();
    const fullLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/play/stage/'));
    fireEvent.click(screen.getByRole('button', { name: '一上' }));
    const lowLinks = screen.getAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/play/stage/'));
    expect(lowLinks.length).toBeGreaterThan(0);
    expect(lowLinks.length).toBeLessThan(fullLinks.length);
  });
});
```

- [ ] **Step 2: Run UI test to verify it fails**

Run: `npx vitest run tests/playhall-primary-grade.test.tsx`

Expected: FAIL because `GradeSelector` does not exist and PlayHall has no grade UI.

- [ ] **Step 3: Create `src/components/GradeSelector.tsx`**

```tsx
import type { GradeBand } from '../data/grades';
import { fontFamilies } from '../theme';

interface Props {
  bands: readonly GradeBand[];
  value: number;
  onChange: (band: number) => void;
}

export function GradeSelector({ bands, value, onChange }: Props) {
  return (
    <div style={{ margin: '0 auto 18px', maxWidth: 920 }}>
      <div style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '2px 2px 8px',
        justifyContent: 'center',
      }}>
        {bands.map((band) => {
          const active = band.value === value;
          return (
            <button
              key={band.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(band.value)}
              style={{
                flex: '0 0 auto',
                minWidth: 52,
                height: 38,
                padding: '0 12px',
                borderRadius: 4,
                border: active ? '2px solid #d4af6a' : '2px solid rgba(216,224,240,0.22)',
                background: active ? '#a8302a' : 'rgba(216,224,240,0.08)',
                color: active ? '#f5ebd2' : 'rgba(216,224,240,0.72)',
                fontFamily: fontFamilies.chinese,
                fontSize: 18,
                fontWeight: 700,
                boxShadow: active ? '0 0 14px rgba(212,175,106,0.45)' : 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {band.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update PlayHall imports and band state**

In `src/pages/PlayHall.tsx`, add imports:

```ts
import { GradeSelector } from '../components/GradeSelector';
import { getAvailableBands } from '../data/grades';
import { loadGrade, saveGrade } from '../state/primaryGrade';
import { getCharKeywordGroups, getCharKeywords } from '../play/engine';
import { getAvailableLevelGroups, getTotalAvailableLevels } from '../play/couplets';
import { countAvailableTitleLevels } from '../play/titles';
```

Remove direct imports of `KEYWORDS`, `KEYWORD_GROUPS`, `PRIMARY_KEYWORDS`, and `PRIMARY_KEYWORD_GROUPS` if they become unused.

Inside `PlayHall`, after `const corpus = useCorpus();`, add:

```ts
const isPrimary = corpus === 'primary';
const [band, setBand] = useState(() => loadGrade());
const activeBand = isPrimary ? band : undefined;
const poemCorpus = corpus === 'all' ? 'both' : corpus;

const onBandChange = (next: number) => {
  setBand(next);
  saveGrade(next);
};
```

Change progress loads:

```ts
const charProgress = loadProgress(corpus, activeBand);
const sentenceProgress = loadSentenceProgress(corpus, activeBand);
const titleProgress = loadTitleProgress(corpus, activeBand);
```

Change keyword/level counts:

```ts
const charGroups = getCharKeywordGroups(poemCorpus, activeBand);
const charKeywords = getCharKeywords(poemCorpus, activeBand);
const totalCharStages = charKeywords.length;
const sentenceGroups = getAvailableLevelGroups(poemCorpus, activeBand);
const totalSentenceStages = getTotalAvailableLevels(poemCorpus, activeBand);
const totalTitleStages = countAvailableTitleLevels(poemCorpus, activeBand);
```

- [ ] **Step 5: Render `GradeSelector` above the tabs**

Place this between the title block and the tab buttons:

```tsx
{isPrimary && (
  <GradeSelector
    bands={getAvailableBands()}
    value={band}
    onChange={onBandChange}
  />
)}
```

- [ ] **Step 6: Update mode bodies to use dynamic groups and placeholders**

For char mode, keep the existing `KeywordSeal` grid structure, but iterate `charGroups`. If `totalCharStages === 0`, render:

```tsx
<div style={{ textAlign: 'center', color: colors.textSecondary, fontFamily: fontFamilies.chinese, padding: '36px 0' }}>
  本年级暂无关卡，请选更高年级
</div>
```

For sentence mode, replace the old `LEVEL_GROUPS` / `isPrimary ? filter advanced` logic with `sentenceGroups`. For each group, iterate:

```ts
Array.from({ length: group.count }, (_, i) => group.start + i)
```

For title mode, use a single dynamic group list derived from `sentenceGroups` shape but capped by `totalTitleStages`. The simplest implementation is:

```ts
const titleGroups = [
  { tier: 'entry' as const, start: 1, end: Math.min(10, totalTitleStages), count: Math.min(10, totalTitleStages) },
  { tier: 'mid' as const, start: 11, end: Math.min(30, totalTitleStages), count: Math.max(0, Math.min(20, totalTitleStages - 10)) },
  { tier: 'advanced' as const, start: 31, end: totalTitleStages, count: Math.max(0, totalTitleStages - 30) },
].filter((g) => g.count > 0 && (!isPrimary || g.tier !== 'advanced'));
```

If `totalSentenceStages === 0` or `totalTitleStages === 0`, show the same placeholder text instead of a grid.

- [ ] **Step 7: Run PlayHall UI tests**

Run: `npx vitest run tests/playhall-primary-grade.test.tsx tests/stage-corpus.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/GradeSelector.tsx src/pages/PlayHall.tsx tests/playhall-primary-grade.test.tsx
git commit -m "feat(feihua): add primary grade selector to play hall"
```

---

### Task 7: Play 页读取 band、构题与进度写入

**Files:**
- Modify: `src/pages/StagePlay.tsx`
- Modify: `src/pages/SentencePlay.tsx`
- Modify: `src/pages/TitlePlay.tsx`
- Modify: `tests/stage-corpus.test.tsx`
- Create: `tests/play-pages-primary-grade.test.tsx`

**Interfaces:**
- Consumes:
  - `loadGrade()` from `src/state/primaryGrade.ts`
  - `getCharKeywords()` and `pickStageQuestion(..., band?)`
  - `getTotalAvailableLevels()`, `tierOfAvailableLevel()`, `pickLevelQuestion(..., band?)`
  - `countAvailableTitleLevels()`, `pickTitleQuestion(..., band?)`
  - progress APIs with `band?: number`
- Produces: Stage/Sentence/Title play pages that use the same selected primary band as the hall.

- [ ] **Step 1: Write failing tests** — create `tests/play-pages-primary-grade.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { SentencePlay } from '../src/pages/SentencePlay';
import { TitlePlay } from '../src/pages/TitlePlay';

function renderWithPrimary(path: string, element: React.ReactNode) {
  window.localStorage.setItem('feihuaCorpus', 'primary');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CorpusProvider>
        <Routes>
          <Route path="/play/sentence/:level" element={element} />
          <Route path="/play/title/:level" element={element} />
        </Routes>
      </CorpusProvider>
    </MemoryRouter>,
  );
}

describe('primary grade play pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rejects sentence levels beyond the selected primary band total', () => {
    window.localStorage.setItem('shiwen-feihua-grade', '1');
    renderWithPrimary('/play/sentence/30', <SentencePlay />);
    expect(screen.getByText(/关卡不存在|暂无关卡|返回大厅/)).toBeInTheDocument();
  });

  it('rejects title levels beyond the selected primary band total', () => {
    window.localStorage.setItem('shiwen-feihua-grade', '1');
    renderWithPrimary('/play/title/30', <TitlePlay />);
    expect(screen.getByText(/关卡不存在|暂无关卡|返回大厅/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/play-pages-primary-grade.test.tsx tests/stage-corpus.test.tsx`

Expected: FAIL because play pages still use fixed totals and do not read grade band.

- [ ] **Step 3: Update `StagePlay.tsx`**

Add imports:

```ts
import { loadGrade } from '../state/primaryGrade';
import { getCharKeywords } from '../play/engine';
```

Inside the component after corpus/poemCorpus:

```ts
const activeBand = corpus === 'primary' ? loadGrade() : undefined;
```

Change every progress call to include `activeBand`:

```ts
loadProgress(corpus, activeBand)
beginStage(kw, corpus, activeBand)
commitStageCorrect(kw, line, corpus, activeBand)
markCleared(kw, corpus, activeBand)
commitStageBlood(kw, newBlood, corpus, activeBand)
clearCurrent(corpus, activeBand)
```

Change every question call:

```ts
pickStageQuestion(kw, used, poemCorpus, activeBand)
```

Change keyword list near the result/next button:

```ts
const charKeywords = getCharKeywords(poemCorpus, activeBand);
```

If `kwIndex < 0`, render the existing invalid/fallback UI used for missing question, with copy containing `关卡不存在` and a link back to `/play`.

- [ ] **Step 4: Update `SentencePlay.tsx`**

Add imports:

```ts
import { loadGrade } from '../state/primaryGrade';
import { getTotalAvailableLevels, pickLevelQuestion, tierOfAvailableLevel, type SentenceQuestion } from '../play/couplets';
```

Replace fixed total/tier logic:

```ts
const activeBand = corpus === 'primary' ? loadGrade() : undefined;
const totalLevels = getTotalAvailableLevels(poemCorpus, activeBand);
const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
const tier = validLevel ? tierOfAvailableLevel(level, poemCorpus, activeBand) : null;
```

Change question creation to guard `tier`:

```ts
if (!tier) return null;
return pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand);
```

Thread `activeBand` through all sentence progress calls:

```ts
loadSentenceProgress(corpus, activeBand)
beginSentenceStage(levelKey, corpus, activeBand)
commitSentenceCorrect(levelKey, line, corpus, activeBand)
markSentenceCleared(levelKey, corpus, activeBand)
commitSentenceBlood(levelKey, newBlood, corpus, activeBand)
clearSentenceCurrent(corpus, activeBand)
```

Change `isLastLevel`:

```ts
const isLastLevel = level >= totalLevels;
```

- [ ] **Step 5: Update `TitlePlay.tsx`**

Add imports:

```ts
import { loadGrade } from '../state/primaryGrade';
import { countAvailableTitleLevels, pickTitleQuestion, type TitleQuestion } from '../play/titles';
```

Replace fixed total logic:

```ts
const activeBand = corpus === 'primary' ? loadGrade() : undefined;
const totalLevels = countAvailableTitleLevels(poemCorpus, activeBand);
const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
```

Change question creation:

```ts
return pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand);
```

Thread `activeBand` through all title progress calls:

```ts
loadTitleProgress(corpus, activeBand)
beginTitleStage(levelKey, corpus, activeBand)
commitTitleCorrect(levelKey, poemId, corpus, activeBand)
markTitleCleared(levelKey, corpus, activeBand)
commitTitleBlood(levelKey, newBlood, corpus, activeBand)
clearTitleCurrent(corpus, activeBand)
```

Change `isLastLevel`:

```ts
const isLastLevel = level >= totalLevels;
```

- [ ] **Step 6: Run play page tests**

Run: `npx vitest run tests/play-pages-primary-grade.test.tsx tests/stage-corpus.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/StagePlay.tsx src/pages/SentencePlay.tsx src/pages/TitlePlay.tsx tests/stage-corpus.test.tsx tests/play-pages-primary-grade.test.tsx
git commit -m "feat(feihua): use selected primary grade in play pages"
```

---

### Task 8: Standalone 镜像与全量验证

**Files:**
- Modify: `scripts/build-standalone.cjs`
- Modify: `standalone.html`

**Interfaces:**
- Consumes: completed `src/` implementation from Tasks 1–7.
- Produces: standalone HTML with identical gradeBand data, band-aware engines/progress, GradeSelector UI, and play-page behavior.

- [ ] **Step 1: Mirror data helpers and `gradeBand` fields**

In `scripts/build-standalone.cjs`, locate the inline data and helpers. The current relevant anchors are:

```text
function buildKeywordIndex(corpus)        around line 2431
function buildAllCouplets(corpus)         around line 2707
function pickTitleQuestion(...)           around line 2840
function PlayHall()                       around line 3447
var SENTENCE_TOTAL_LEVELS = 50            around line 3528
var TITLE_TOTAL_LEVELS = 50               around line 3935
function StagePlay()                      around line 4295
```

Add standalone equivalents of:

```js
var GRADE_BANDS = [
  { value: 1, label: '一上' }, { value: 2, label: '一下' },
  { value: 3, label: '二上' }, { value: 4, label: '二下' },
  { value: 5, label: '三上' }, { value: 6, label: '三下' },
  { value: 7, label: '四上' }, { value: 8, label: '四下' },
  { value: 9, label: '五上' }, { value: 10, label: '五下' },
  { value: 11, label: '六上' }, { value: 12, label: '六下' },
];
var MAX_BAND = 12;
function normalizeBand(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BAND ? value : MAX_BAND;
}
function getPrimaryPoemsUpTo(band) {
  var normalized = normalizeBand(band);
  return getPoems('primary').filter(function(p) { return typeof p.gradeBand === 'number' && p.gradeBand <= normalized; });
}
function getAvailableBands() {
  var present = new Set(getPoems('primary').map(function(p) { return p.gradeBand; }).filter(function(b) { return typeof b === 'number'; }));
  return GRADE_BANDS.filter(function(b) { return present.has(b.value); });
}
function getPoemsForPlay(corpus, band) {
  if (corpus !== 'tang' && band != null) return getPrimaryPoemsUpTo(band);
  return corpus === 'both' ? getPoems() : getPoems(corpus);
}
```

Ensure the JSON objects emitted into standalone include the `gradeBand` fields from updated `src/data/poems.json`.

- [ ] **Step 2: Mirror primary grade localStorage**

Add:

```js
var PRIMARY_GRADE_KEY = 'shiwen-feihua-grade';
function loadGrade() {
  try {
    var raw = window.localStorage.getItem(PRIMARY_GRADE_KEY);
    var parsed = raw == null ? Number.NaN : parseInt(raw, 10);
    return normalizeBand(parsed);
  } catch (e) {
    return MAX_BAND;
  }
}
function saveGrade(band) {
  try { window.localStorage.setItem(PRIMARY_GRADE_KEY, String(normalizeBand(band))); } catch (e) {}
}
```

- [ ] **Step 3: Mirror engine changes**

For each standalone engine, replace `getPoems(corpus)` selection with `getPoemsForPlay(corpus, band)`, use string cache keys, and add the new helpers:

```js
function cacheKey(corpus, band) {
  return band == null ? corpus : corpus + ':' + band;
}
```

Mirror `getCharKeywords`, `getCharKeywordGroups`, `countAvailableCharStages`, `countAvailableLevels`, `getAvailableLevelGroups`, `getTotalAvailableLevels`, `tierOfAvailableLevel`, and `countAvailableTitleLevels` exactly from the `src/` implementation, converting TypeScript syntax to plain JavaScript.

- [ ] **Step 4: Mirror progress key changes**

For all three standalone progress modules, use this storage key rule:

```js
function storageKey(corpus, band) {
  if (corpus === 'tang') return STORAGE_KEY;
  var base = STORAGE_KEY + ':' + corpus;
  if (corpus !== 'primary' || band == null || band === MAX_BAND) return base;
  return base + ':g' + band;
}
```

Thread `band` through load/save/mark/begin/commit/clear functions exactly as in `src/play/*.ts`.

- [ ] **Step 5: Mirror `GradeSelector`, `PlayHall`, and play pages**

Add a standalone `GradeSelector` function using `React.createElement` style consistent with the rest of `build-standalone.cjs`.

In standalone `PlayHall`, add:

```js
var isPrimary = corpus === 'primary';
var gradeState = React.useState(function() { return loadGrade(); });
var band = gradeState[0];
var setBand = gradeState[1];
var activeBand = isPrimary ? band : undefined;
var poemCorpus = corpus === 'all' ? 'both' : corpus;
```

Then mirror dynamic char/sentence/title counts and `GradeSelector` rendering from `src/pages/PlayHall.tsx`.

In standalone `StagePlay`, `SentencePlay`, and `TitlePlay`, read `activeBand` from `loadGrade()` when `corpus === 'primary'` and pass it through engine/progress calls exactly as in Task 7.

- [ ] **Step 6: Build and verify standalone**

Run: `npm run build:standalone && npm run verify:standalone`

Expected: both commands PASS and `standalone.html` is updated.

- [ ] **Step 7: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Build app**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 9: Manual UI smoke test**

Run: `npm run dev`

Manual checks:

1. 顶栏切到「小学」，进入 `/play`，应看到年级 chips，默认高亮「六下」。
2. 单字 tab 默认显示 30 个小学关键字；点「一上」后关卡数减少，且没有锁死的空关卡。
3. 点「三上」进入一个单字关卡，题句只来自 `gradeBand <= 5` 的诗。
4. 整句 tab 在「六下」显示 30 关；低年级关数减少，越界 URL（如低年级 `/play/sentence/30`）返回不可玩提示。
5. 整篇 tab 在「一上」显示 6 关，在「六下」显示 30 关。
6. 在非默认端点通关后切到另一个端点，进度不串；切回「六下」仍读取旧 `:primary` 进度。
7. 切到「唐诗」和「总库」，确认没有年级选择器，关数/进度保持原行为。

- [ ] **Step 10: Commit**

```bash
git add scripts/build-standalone.cjs standalone.html
git commit -m "build(standalone): mirror primary grade selector"
```

---

## Verification

After all tasks are complete, run:

```bash
npx vitest run src/data/grades.test.ts src/state/primaryGrade.test.ts src/play/engine.test.ts src/play/couplets.test.ts src/play/titles.test.ts src/play/progress.test.ts src/play/sentenceProgress.test.ts src/play/titleProgress.test.ts tests/primary-keywords.test.ts tests/sentence-primary.test.ts tests/playhall-primary-grade.test.tsx tests/play-pages-primary-grade.test.tsx tests/stage-corpus.test.tsx
npm test
npm run build
npm run build:standalone && npm run verify:standalone
```

Expected: all commands PASS. If UI smoke test cannot be performed in the current environment, report that explicitly and include the automated results above.
