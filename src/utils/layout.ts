import type { Poet, Poem } from '../types';

export interface LayoutRange {
  minYear: number;
  maxYear: number;
  leftPadding: number; // percent
  rightPadding: number; // percent
}

// Module-scope caches: 相同逻辑输入跳过 scatter 算法。Key 用 ID + 年份编码，
// 对同一组诗文（无论传入数组的顺序/引用如何）返回稳定结果。每次切换 corpus /
// 诗人 / corpus=小学 ↔ 总库都命中。容量上限 ~数十条（corpus×诗人组合），无
// 需 LRU。
const layoutPoetsCache = new Map<string, { poet: Poet; x: number; y: number }[]>();
const layoutPoemsCache = new Map<string, { poem: Poem; x: number; y: number }[]>();
const layoutAllPoemsCache = new Map<string, { poem: Poem; x: number; y: number }[]>();

function layoutPoetsKey(
  poets: ReadonlyArray<{ id: string; birthYear: number; deathYear: number }>,
  range: LayoutRange,
): string {
  return 'p:' + [...poets]
    .map((p) => `${p.id}:${p.birthYear}-${p.deathYear}`)
    .sort()
    .join(',') + `|${range.minYear}-${range.maxYear}-${range.leftPadding}-${range.rightPadding}`;
}

function layoutPoemsKey(
  poems: ReadonlyArray<{ id: string; creationYear?: number }>,
  poet: { id: string; birthYear: number; deathYear: number },
  padding: { leftPadding: number; rightPadding: number },
): string {
  return 'm:' + poet.id + ':' + poet.birthYear + '-' + poet.deathYear + '|' + [...poems]
    .map((p) => `${p.id}:${p.creationYear ?? '_'}`)
    .sort()
    .join(',') + `|${padding.leftPadding}-${padding.rightPadding}`;
}

function layoutAllPoemsKey(
  poems: ReadonlyArray<{ id: string; creationYear?: number; poetId: string }>,
  poets: ReadonlyArray<{ id: string; birthYear: number; deathYear: number }>,
  range: LayoutRange,
  minDx: number,
): string {
  const byPoet = new Map(poets.map((p) => [p.id, `${p.birthYear}-${p.deathYear}`] as const));
  return 'a:' + [...poems]
    .map((p) => `${p.id}:${p.creationYear ?? '_'}:${p.poetId}`)
    .sort()
    .join(',') + '|' + [...poets]
    .map((p) => `${p.id}:${byPoet.get(p.id)}`)
    .sort()
    .join(',') + `|${range.minYear}-${range.maxYear}-${range.leftPadding}-${range.rightPadding}-${minDx}`;
}

// Poets within COLUMN_THRESHOLD percent of X are treated as one column and
// scatter together. Below this they're considered separate columns.
const COLUMN_THRESHOLD = 1.5;

// Vertical search range for the singleton fallback (n=1 columns): ±35% stays
// near the center line. At viewport height 800px, ±35% = ±280px.
const Y_RANGE = 35;

// Vertical spread for SCATTER layout (all multi-item columns). ±40% keeps
// node centers above the 36px TimeAxis at the bottom of the canvas. Node
// at y=+40% has center at canvas-Y 90%; with ~5% half-height (3-line title
// + dot), its bottom reaches ~95% — clear of the axis top at 95.5%.
const SCATTER_Y_RANGE = 40;

// Half-width of the X jitter for scatter layout. ±9% canvas ≈ 54% viewport
// at zoom 1 (canvas is 600% wide). The 61-poet default-year cluster needs
// the extra territory — at 80% packing it requires ~22% canvas width.
const X_JITTER_RANGE = 9;

// 多项目列在超过这个数量时跳过 singleton 邻接 cap，让 X 扩散用满
// X_JITTER_RANGE。66 项的 dense 列 cap=±1.7% × 8 Y 行 = 32 容量，溢出 34；
// 放开后 cap=±9% × 8 Y 行 = 360 容量。threshold 选 20：tang 115、primary
// 61、all 66 都覆盖；tang / primary / junior / senior 在阈值以下不触发。
const DENSE_COLUMN_THRESHOLD = 20;

// Dense 列 X jitter 按规模放大：n 项目用 X_JITTER_RANGE + (n - threshold) *
// 0.6% 额外 jitter。66 项 → ±28%，115 项 → 上限 ±40%。让真密集簇有更大
// 横向空间，避免「66 项全堆在 ±9%」中碰撞；其他列（≤ threshold）走 X_JITTER_RANGE。
const DENSE_JITTER_PER_ITEM = 0.6;
const DENSE_JITTER_MAX_BONUS = 31; // 总 jitter 上限 40% (=9+31)

// Minimum separation between two scatter points in canvas percent.
// X: 1.5% canvas ≈ 126px on a 1400px viewport — fits a wrapped title (≤96px)
// plus dot on each side.
// Y: 10% canvas ≈ 80px on a 800px viewport — fits a 3-line wrapped title
// (54px) + dot (14px) + gap. Required because the title sits ABOVE the dot
// in a flex-column, so two containers can overlap visually even when their
// centers are 64px apart vertically.
const SCATTER_MIN_DX = 1.5;
const SCATTER_MIN_DY = 10;
const SCATTER_ATTEMPTS = 1000;

// Margin from canvas edges so scatter doesn't place items at exactly 0 or
// 100 (where they'd be half-clipped by the canvas boundary).
const SCATTER_BOUND_PAD = 1;

export function computePercent(year: number, minYear: number, maxYear: number): number {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

// Deterministic PRNG so a given cluster always scatters the same way across
// renders (no jitter on every re-render). mulberry32 is a well-behaved
// non-cryptographic generator.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick positions for `count` items, each one around its OWN nominal X (passed
 * as `nominalXs[i]`), inside [-Y_RANGE, +Y_RANGE]. Used for dense columns
 * where items have distinct birth years and must preserve their chronological
 * order — e.g. 王勃 (650) and 李白 (701) in 初中 corpus are 51 years apart,
 * so their nominal Xs differ by 1.4%. Per-item jitter lets each one scatter
 * near itself instead of all collapsing onto the column's leftmost X.
 *
 * `existing` carries positions already placed by neighbouring columns so a
 * big cluster's scatter doesn't swallow singletons nearby (and vice versa).
 * `xRangeCap` (per-item) comes from singleton adjacency in `assignPositions`.
 * Returns the new positions only; deterministic for a given
 * (nominalXs, existing, xRangeCap).
 */
function scatterPositions(
  nominalXs: number[],
  existing: { x: number; y: number }[] = [],
  minDx: number = SCATTER_MIN_DX,
  xRangeCap: number = Infinity,
  extraJitter: number = 0,
): { x: number; y: number }[] {
  // Per-item X jitter: each item searches around its own nominal X. The shared
  // xRangeCap (singleton adjacency) minus the natural spread of nominal Xs
  // is split between left and right jitter so dense columns stay inside the
  // adjacent singleton's territory and chronological order is preserved.
  // Floored at SCATTER_MIN_DX so even tiny xRangeCap gives a chance of
  // non-overlapping positions; capped at X_JITTER_RANGE so wide caps don't
  // make items in sparse columns (e.g. 115 identical-year poems) wander
  // unnecessarily.
  const xSpread = nominalXs.length > 0 ? Math.max(...nominalXs) - Math.min(...nominalXs) : 0;
  const perItemJitter = Math.min(
    X_JITTER_RANGE + extraJitter,
    Math.max(SCATTER_MIN_DX, (xRangeCap - xSpread) / 2),
  );
  const placed = [...existing];
  const added: { x: number; y: number }[] = [];
  for (let i = 0; i < nominalXs.length; i++) {
    const nominalX = nominalXs[i];
    // Bound-aware shrink: keep this item inside [pad, 100-pad].
    const edgeLimit = Math.max(
      0,
      Math.min(nominalX, 100 - nominalX) - SCATTER_BOUND_PAD,
    );
    const xRange = Math.min(perItemJitter, edgeLimit, xRangeCap);
    // Seed includes the item's index so siblings in the same column get
    // independent random sequences, but two items with same nominalX get the
    // same seed (deterministic across renders).
    const rand = mulberry32(Math.floor(nominalX * 1000) + i * 37);
    // Best-candidate sampling: try N random spots, prefer collision-free, but
    // if none found, fall back to the spot with fewest collisions. Random
    // scatter in dense clusters can't always find a free spot — using the
    // least-colliding candidate minimises visual overlap.
    let bestX = nominalX;
    let bestY = 0;
    let bestCollisionCount = Infinity;
    for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
      const x = nominalX + (rand() * 2 - 1) * xRange;
      const y = -SCATTER_Y_RANGE + rand() * 2 * SCATTER_Y_RANGE;
      let collisions = 0;
      for (const p of placed) {
        if (Math.abs(p.x - x) < minDx && Math.abs(p.y - y) < SCATTER_MIN_DY) {
          collisions++;
        }
      }
      // Also avoid colliding with already-placed siblings in this column.
      for (const p of added) {
        if (Math.abs(p.x - x) < minDx && Math.abs(p.y - y) < SCATTER_MIN_DY) {
          collisions++;
        }
      }
      if (collisions === 0) {
        bestX = x;
        bestY = y;
        bestCollisionCount = 0;
        break;
      }
      if (collisions < bestCollisionCount) {
        bestX = x;
        bestY = y;
        bestCollisionCount = collisions;
      }
    }
    placed.push({ x: bestX, y: bestY });
    added.push({ x: bestX, y: bestY });
  }
  return added;
}

/**
 * Spread items within each X-column. Single-item columns snap to the center
 * line (y=0) with a fallback search when that spot is taken. All multi-item
 * columns scatter organically in 2D so labels don't overlap — the cluster
 * appears as a "star cloud" around the nominal X position rather than a
 * regular grid or an impossibly dense vertical stack.
 */
function assignPositions<T>(items: { item: T; x: number }[], minDx: number = SCATTER_MIN_DX): { item: T; x: number; y: number }[] {
  const columns: { x: number; items: { item: T; x: number }[] }[] = [];
  for (const it of items) {
    const last = columns[columns.length - 1];
    if (last && Math.abs(it.x - last.x) < COLUMN_THRESHOLD) {
      last.items.push(it);
    } else {
      columns.push({ x: it.x, items: [it] });
    }
  }

  // 预先收集所有 singleton 列的 nominalX（升序）。dense 列 scatter 时用它算
  // X 上限，避免侵入相邻 singleton 领地。
  const singletonXs = columns
    .filter((c) => c.items.length === 1)
    .map((c) => c.x)
    .sort((a, b) => a - b);

  const out: { item: T; x: number; y: number }[] = [];
  // Global collision registry across ALL columns. A singleton at y=0 next to
  // a big scattered cluster can be swallowed by a scatter point that happens
  // to land at the same Y — checking against this registry prevents that.
  const placed: { x: number; y: number }[] = [];

  const collides = (x: number, y: number) =>
    placed.some((p) => Math.abs(p.x - x) < minDx && Math.abs(p.y - y) < SCATTER_MIN_DY);
  const countCollisions = (x: number, y: number) =>
    placed.reduce((sum, p) => sum + ((Math.abs(p.x - x) < minDx && Math.abs(p.y - y) < SCATTER_MIN_DY) ? 1 : 0), 0);

  for (const col of columns) {
    const n = col.items.length;
    if (n === 1) {
      const it = col.items[0];
      // Prefer the center line; fall back to random search when a nearby
      // scatter point already occupies y=0 at this X. Best-candidate
      // fallback ensures we don't end up at a known-colliding y.
      let y = 0;
      if (collides(it.x, 0)) {
        const rand = mulberry32(Math.floor(it.x * 1000) + 1);
        let bestY = 0;
        let bestCollisions = countCollisions(it.x, 0);
        for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
          const candidate = -Y_RANGE + rand() * 2 * Y_RANGE;
          const collisions = countCollisions(it.x, candidate);
          if (collisions === 0) {
            bestY = candidate;
            break;
          }
          if (collisions < bestCollisions) {
            bestY = candidate;
            bestCollisions = collisions;
          }
        }
        y = bestY;
      }
      out.push({ item: it.item, x: it.x, y });
      placed.push({ x: it.x, y });
    } else {
      // 算 dense 列 X 上限：到下一个 singleton 的距离 - minDx 缓冲。两侧都无
      // singleton 时退化为 Infinity（保留原 scatter 行为）。不加 X_JITTER_RANGE
      // 下限——dense 列紧贴 singleton 时本就该散布受限（否则会侵入 singleton）。
      // 注：曾尝试 dense-dense 边界（dense 列不侵入相邻 dense 列 nominalX），但
      // tang 库 27 个 dense 列挤在 50% 范围内、列间距 1.5%，dense-dense cap 把
      // 项目压死在 nominalX 上导致 collisions 12x 飙升（78→972），违反「密集区
      // 可读性优先」的设计前提。dense 列互相侵入的代价靠用户 pinch zoom 解决。
      //
      // 例外：n > DENSE_COLUMN_THRESHOLD 的真密集列（如 'all' 库 year=701
      // 有 66 项目），singleton cap 把 X 扩散锁在 ±1.7%，scatter 算法只能
      // 靠 Y（也只有 8 行）排，66 项严重溢出。collision 检查本身走 placed
      // 注册表，已能防止侵入 singleton——cap 是额外的搜索空间限制，对真密
      // 集列 over-binding。放开 cap + 按规模放大 jitter（66 → ±36.6%，115
      // → 上限 ±40%）让真密集簇横向铺开，避免相邻簇 jitter 区重叠时无处可去。
      let xRangeCap: number;
      let extraJitter = 0;
      if (n > DENSE_COLUMN_THRESHOLD) {
        xRangeCap = Infinity;
        extraJitter = Math.min(
          DENSE_JITTER_MAX_BONUS,
          (n - DENSE_COLUMN_THRESHOLD) * DENSE_JITTER_PER_ITEM,
        );
      } else {
        const nextSingleton = singletonXs.find((x) => x > col.x);
        const prevSingleton = [...singletonXs].reverse().find((x) => x < col.x);
        const upper = nextSingleton !== undefined ? nextSingleton - col.x - minDx : Infinity;
        const lower = prevSingleton !== undefined ? col.x - prevSingleton - minDx : Infinity;
        xRangeCap = Math.min(upper, lower);
      }
      // Pass each item's individual nominal X so dense columns preserve their
      // chronological order instead of collapsing onto the column's leftmost X.
      const nominalXs = col.items.map((it) => it.x);
      const positions = scatterPositions(nominalXs, placed, minDx, xRangeCap, extraJitter);
      positions.forEach((pos, i) => {
        const it = col.items[i];
        out.push({ item: it.item, x: pos.x, y: pos.y });
        placed.push({ x: pos.x, y: pos.y });
      });
    }
  }
  return out;
}

export function layoutPoets(poets: Poet[], range: LayoutRange): { poet: Poet; x: number; y: number }[] {
  const key = layoutPoetsKey(poets, range);
  const cached = layoutPoetsCache.get(key);
  if (cached) return cached;
  const sorted = [...poets].sort((a, b) => a.birthYear - b.birthYear);
  const span = 100 - range.leftPadding - range.rightPadding;
  const withX = sorted.map((poet) => {
    const pct = computePercent(poet.birthYear, range.minYear, range.maxYear);
    return { item: poet, x: range.leftPadding + (pct / 100) * span };
  });
  const result = assignPositions(withX).map(({ item: poet, x, y }) => ({ poet, x, y }));
  layoutPoetsCache.set(key, result);
  return result;
}

export function layoutPoems(poems: Poem[], poet: Poet, padding: { leftPadding: number; rightPadding: number }): { poem: Poem; x: number; y: number }[] {
  const key = layoutPoemsKey(poems, poet, padding);
  const cached = layoutPoemsCache.get(key);
  if (cached) return cached;
  const sorted = [...poems].sort((a, b) => {
    if (a.creationYear == null && b.creationYear == null) return 0;
    if (a.creationYear == null) return 1;
    if (b.creationYear == null) return -1;
    return a.creationYear - b.creationYear;
  });

  const span = 100 - padding.leftPadding - padding.rightPadding;
  const minYear = poet.birthYear;
  const maxYear = poet.deathYear;

  // Position poems with known years by their year; poems without years
  // get evenly distributed in the remaining empty slots
  const withX = sorted.map((poem, idx) => {
    let pct: number;
    if (poem.creationYear != null) {
      pct = computePercent(poem.creationYear, minYear, maxYear);
    } else {
      // Spread evenly across the range as a fallback
      pct = (sorted.length === 1) ? 50 : (idx / (sorted.length - 1)) * 100;
    }
    return { item: poem, x: padding.leftPadding + (pct / 100) * span };
  });

  const result = assignPositions(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
  layoutPoemsCache.set(key, result);
  return result;
}

/**
 * Position all poems across a dynasty-wide year range. Poems with `creationYear`
 * use that; poems without fall back to their parent poet's `birthYear`. Reuses
 * `assignPositions` so the same column/scatter/collision logic as `layoutPoets`
 * applies — a poem-dense year (e.g. all of 杜甫's poems) auto-scatters in 2D.
 */
export function layoutAllPoems(
  poems: Poem[],
  poets: Poet[],
  range: LayoutRange,
  minDx: number = SCATTER_MIN_DX,
): { poem: Poem; x: number; y: number }[] {
  const key = layoutAllPoemsKey(poems, poets, range, minDx);
  const cached = layoutAllPoemsCache.get(key);
  if (cached) return cached;
  const poetMap = new Map(poets.map((p) => [p.id, p]));
  const sorted = [...poems].sort((a, b) => {
    const ya = a.creationYear ?? poetMap.get(a.poetId)?.birthYear ?? 0;
    const yb = b.creationYear ?? poetMap.get(b.poetId)?.birthYear ?? 0;
    return ya - yb;
  });
  const span = 100 - range.leftPadding - range.rightPadding;
  const withX = sorted.map((poem) => {
    const year = poem.creationYear ?? poetMap.get(poem.poetId)?.birthYear ?? range.minYear;
    const pct = computePercent(year, range.minYear, range.maxYear);
    return { item: poem, x: range.leftPadding + (pct / 100) * span };
  });
  const result = assignPositions(withX, minDx).map(({ item: poem, x, y }) => ({ poem, x, y }));
  layoutAllPoemsCache.set(key, result);
  return result;
}
