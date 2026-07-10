import { describe, it, expect } from 'vitest';
import { computeCorpusYearRange } from '../src/utils/yearRange';
import type { Poet } from '../src/types';

const mkPoet = (id: string, birthYear: number, deathYear: number, dynastyId: string = 'tang'): Poet => ({
  id, name: id, birthYear, deathYear, dynastyId, familiarity: 1, corpus: 'tang' as const,
});

describe('computeCorpusYearRange', () => {
  it('returns tang-style range for tang poets', () => {
    const poets = [mkPoet('a', 618, 700), mkPoet('b', 800, 850)];
    const r = computeCorpusYearRange(poets, 'tang');
    expect(r.minYear).toBeGreaterThanOrEqual(595);
    expect(r.minYear).toBeLessThanOrEqual(625);
    expect(r.maxYear).toBeGreaterThanOrEqual(870);
    expect(r.maxYear).toBeLessThanOrEqual(920);
    // Tick spacing 30 years for spans <=300
    expect(r.ticks.length).toBeGreaterThanOrEqual(5);
    expect(r.leftLabel).toMatch(/^\d+ · .+$/);
    expect(r.rightLabel).toMatch(/^\d+$/);
  });

  it('returns wide range covering primary poets incl. 毛泽东 1976', () => {
    const poets = [
      mkPoet('a', 386, 500, 'other'),
      mkPoet('b', 1037, 1101, 'song'),
      mkPoet('c', 1893, 1976, 'modern'),
    ];
    const r = computeCorpusYearRange(poets, 'primary');
    expect(r.minYear).toBeLessThanOrEqual(400); // covers 北朝民歌 386
    expect(r.maxYear).toBeGreaterThanOrEqual(1960); // covers 毛泽东 1976
    // Tick spacing 100 years for spans >700
    const years = r.ticks.map((t) => t.year);
    for (let i = 1; i < years.length; i++) {
      expect(years[i] - years[i - 1]).toBe(100);
    }
  });

  it('leftLabel uses earliest dynasty name', () => {
    const poets = [
      mkPoet('a', 386, 500, 'other'),
      mkPoet('b', 700, 800, 'tang'),
    ];
    const r = computeCorpusYearRange(poets, 'primary');
    expect(r.leftLabel).toMatch(/· 南北朝$/);
  });

  it('pos values are 0-100', () => {
    const poets = [mkPoet('a', 618, 700), mkPoet('b', 1893, 1976, 'modern')];
    const r = computeCorpusYearRange(poets, 'all');
    for (const t of r.ticks) {
      expect(t.pos).toBeGreaterThanOrEqual(0);
      expect(t.pos).toBeLessThanOrEqual(100);
    }
  });
});