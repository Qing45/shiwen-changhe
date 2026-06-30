import type { Poet, Poem } from '../types';

export interface LayoutRange {
  minYear: number;
  maxYear: number;
  leftPadding: number; // percent
  rightPadding: number; // percent
}

// Poets within COLUMN_THRESHOLD percent of X are treated as one column and
// spread vertically. Below this they're considered separate columns.
const COLUMN_THRESHOLD = 1.5;

// Vertical spread within a column, as percent offset from the center line.
// At viewport height 800px, ±35% = ±280px, enough for ~14 legible rows.
const Y_RANGE = 35;

// Above PURE_Y_MAX items in one column, switch from pure vertical spread to
// a 2D scatter (X jitter + Y spread) so labels don't overlap.
const PURE_Y_MAX = 10;

// Half-width of the X jitter for scatter layout. ±6% of canvas width = ±36%
// of viewport at zoom 1 (canvas is 600% wide). 63 poets scatter inside a
// 12% × 70% territory — area enough for ~90 poets at the minimum separation.
const X_JITTER_RANGE = 6;

// Minimum separation between two scatter points in canvas percent.
// X: 1.6% canvas ≈ 134px on a 1400px viewport — fits a 4-char name.
// Y: 6.5% canvas ≈ 46px on a 700px viewport — fits label height + node.
const SCATTER_MIN_DX = 1.6;
const SCATTER_MIN_DY = 6.5;
const SCATTER_ATTEMPTS = 60;

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
 * Returns absolute (x, y) positions; deterministic for a given (count,
 * nominalX).
 */
function scatterPositions(count: number, nominalX: number): { x: number; y: number }[] {
  const rand = mulberry32(Math.floor(nominalX * 1000) + count * 37);
  const placed: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    let x = nominalX;
    let y = 0;
    for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
      x = nominalX + (rand() * 2 - 1) * X_JITTER_RANGE;
      y = -Y_RANGE + rand() * 2 * Y_RANGE;
      const collides = placed.some(
        (p) => Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY,
      );
      if (!collides) break;
    }
    placed.push({ x, y });
  }
  return placed;
}

/**
 * Spread items within each X-column. Small columns (≤ PURE_Y_MAX) distribute
 * vertically across [-Y_RANGE, +Y_RANGE]. Larger columns scatter organically
 * in 2D so labels don't overlap — the cluster appears as a "star cloud"
 * around the nominal X position rather than a regular grid or an impossibly
 * dense vertical stack.
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
  for (const col of columns) {
    const n = col.items.length;
    if (n === 1) {
      const it = col.items[0];
      out.push({ item: it.item, x: it.x, y: 0 });
    } else if (n <= PURE_Y_MAX) {
      col.items.forEach((it, i) => {
        const y = -Y_RANGE + (i / (n - 1)) * 2 * Y_RANGE;
        out.push({ item: it.item, x: it.x, y });
      });
    } else {
      const positions = scatterPositions(n, col.x);
      col.items.forEach((it, i) => {
        out.push({ item: it.item, x: positions[i].x, y: positions[i].y });
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
