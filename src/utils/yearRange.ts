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