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
