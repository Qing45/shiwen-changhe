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
// a 2D grid (X jitter + Y spread) so labels don't overlap. 10 fits at ~14%
// per row in a 700px viewport; above that labels start touching.
const PURE_Y_MAX = 10;

// Half-width of the X jitter for grid layout. ±6% of canvas width = ±36% of
// viewport at zoom 1 (canvas is 600% wide). A 63-poet cluster spreads to a
// 8×8 grid where each cell is ~1.5% canvas = ~126px, comfortably larger than
// a 4-char label.
const X_JITTER_RANGE = 6;

export function computePercent(year: number, minYear: number, maxYear: number): number {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

/**
 * Spread items within each X-column. Small columns (≤ PURE_Y_MAX) distribute
 * vertically across [-Y_RANGE, +Y_RANGE]. Larger columns form a 2D grid with
 * X jitter so labels don't overlap — the cluster appears as a "constellation"
 * around the nominal X position rather than an impossibly dense vertical
 * stack.
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
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cellW = (2 * X_JITTER_RANGE) / cols;
      const cellH = (2 * Y_RANGE) / rows;
      col.items.forEach((it, i) => {
        const row = Math.floor(i / cols);
        const c = i % cols;
        const xJitter = -X_JITTER_RANGE + c * cellW + cellW / 2;
        const y = -Y_RANGE + row * cellH + cellH / 2;
        out.push({ item: it.item, x: it.x + xJitter, y });
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
