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

export function computePercent(year: number, minYear: number, maxYear: number): number {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

/**
 * Spread positions vertically within each X-column. Items already sorted by X
 * (chronologically) get evenly distributed across [-Y_RANGE, +Y_RANGE]; a
 * column of one gets y = 0 (on the center line).
 */
function assignY<T>(items: { item: T; x: number }[]): { item: T; x: number; y: number }[] {
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
    col.items.forEach((it, i) => {
      const y = n === 1 ? 0 : -Y_RANGE + (i / (n - 1)) * 2 * Y_RANGE;
      out.push({ item: it.item, x: it.x, y });
    });
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
  return assignY(withX).map(({ item: poet, x, y }) => ({ poet, x, y }));
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

  return assignY(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
}
