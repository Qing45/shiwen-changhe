import type { Poet, Poem } from '../types';

export interface LayoutRange {
  minYear: number;
  maxYear: number;
  leftPadding: number; // percent
  rightPadding: number; // percent
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

// Cap on adaptive X jitter for very dense columns. ±75% canvas lets the
// 62-poem cluster (year 700+703 merged) spread widely enough that
// best-candidate sampling can find collision-free positions for nearly all
// items. Above this the timeline becomes unreadable.
const SCATTER_X_RANGE_CAP = 75;

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
 * Pick count positions inside the rectangle [nominalX ± X_JITTER_RANGE] ×
 * [-Y_RANGE, +Y_RANGE] using seeded random sampling with collision avoidance.
 * `existing` carries positions already placed by neighbouring columns so a
 * big cluster's scatter doesn't swallow singletons nearby (and vice versa).
 * Returns the new positions only; deterministic for a given (count,
 * nominalX, existing).
 */
function scatterPositions(
  count: number,
  nominalX: number,
  existing: { x: number; y: number }[] = [],
): { x: number; y: number }[] {
  // Adaptive X jitter: dense columns spread wider so 60+ poems in one decade
  // don't pile on top of each other. sqrt scaling with multiplier 12 — a
  // 62-item cluster gets ~94% canvas X range (capped at 75%). The wide spread
  // is the user's explicit preference: dense areas may drift from their
  // nominal X as long as the overall chronological trend is preserved.
  const baseRange = Math.min(SCATTER_X_RANGE_CAP, Math.max(X_JITTER_RANGE, Math.sqrt(count) * 12));
  // Bound-aware shrink: near canvas edges, reduce xRange so scatter stays
  // inside [pad, 100-pad]. Without this, a cluster at nominalX 31% with
  // xRange ±75% lands items at canvas-X [-43, 106] — off-canvas on both
  // sides. Traded cost: less territory means more collisions in dense
  // edge clusters (the 62-poem cluster picks up ~24 collisions vs 1
  // unbounded). Acceptable: overlapping labels are still readable, while
  // items clipped by the canvas edge are not visible at all.
  const edgeLimit = Math.max(
    X_JITTER_RANGE,
    Math.min(nominalX, 100 - nominalX) - SCATTER_BOUND_PAD,
  );
  const xRange = Math.min(baseRange, edgeLimit);
  const rand = mulberry32(Math.floor(nominalX * 1000) + count * 37);
  const placed = [...existing];
  const added: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
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
        if (Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY) {
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
function assignPositions<T>(items: { item: T; x: number }[]): { item: T; x: number; y: number }[] {
  const columns: { x: number; items: { item: T; x: number }[] }[] = [];
  for (const it of items) {
    const last = columns[columns.length - 1];
    if (last && Math.abs(it.x - last.x) < COLUMN_THRESHOLD) {
      last.items.push(it);
    } else {
      columns.push({ x: it.x, items: [it] });
    }
  }

  const out: { item: T; x: number; y: number }[] = [];
  // Global collision registry across ALL columns. A singleton at y=0 next to
  // a big scattered cluster can be swallowed by a scatter point that happens
  // to land at the same Y — checking against this registry prevents that.
  const placed: { x: number; y: number }[] = [];

  const collides = (x: number, y: number) =>
    placed.some((p) => Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY);
  const countCollisions = (x: number, y: number) =>
    placed.reduce((sum, p) => sum + ((Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY) ? 1 : 0), 0);

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
      const positions = scatterPositions(n, col.x, placed);
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
  const sorted = [...poets].sort((a, b) => a.birthYear - b.birthYear);
  const span = 100 - range.leftPadding - range.rightPadding;
  const withX = sorted.map((poet) => {
    const pct = computePercent(poet.birthYear, range.minYear, range.maxYear);
    return { item: poet, x: range.leftPadding + (pct / 100) * span };
  });
  return assignPositions(withX).map(({ item: poet, x, y }) => ({ poet, x, y }));
}

export function layoutPoems(poems: Poem[], poet: Poet, padding: { leftPadding: number; rightPadding: number }): { poem: Poem; x: number; y: number }[] {
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

  return assignPositions(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
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
): { poem: Poem; x: number; y: number }[] {
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
  return assignPositions(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
}
