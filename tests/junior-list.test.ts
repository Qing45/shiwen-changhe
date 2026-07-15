import { describe, it, expect } from 'vitest';
import { JUNIOR_LIST, JUNIOR_LIST_TOTAL } from '../scripts/scraper/junior-list';

describe('junior poem list', () => {
  it('contains exactly 86 poems across 6 semester bands', () => {
    expect(JUNIOR_LIST_TOTAL).toBe(86);
    expect(JUNIOR_LIST.length).toBe(6);
  });

  it('distributes poems per band as 12/14/18/13/12/17', () => {
    const counts = JUNIOR_LIST.map((s) => s.entries.length);
    expect(counts).toEqual([12, 14, 18, 13, 12, 17]);
  });

  it('bands are in chronological 7a→9b order', () => {
    expect(JUNIOR_LIST.map((s) => s.band)).toEqual([
      '7a', '7b', '8a', '8b', '9a', '9b',
    ]);
  });

  it('every entry has non-empty title and poetName', () => {
    for (const section of JUNIOR_LIST) {
      for (const entry of section.entries) {
        expect(entry.title.trim().length).toBeGreaterThan(0);
        expect(entry.poetName.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('titles are unique within each band', () => {
    for (const section of JUNIOR_LIST) {
      const titles = section.entries.map((e) => e.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });

  it('dynasty values are within the allowed set', () => {
    const allowed = ['tang', 'song', 'ming', 'qing', 'modern', 'other'];
    for (const section of JUNIOR_LIST) {
      for (const entry of section.entries) {
        expect(allowed).toContain(entry.dynasty);
      }
    }
  });

  it('includes 已亥杂诗 in 7b (overlap with primary library)', () => {
    const band7b = JUNIOR_LIST.find((s) => s.band === '7b')!;
    expect(band7b.entries.some((e) => e.title === '己亥杂诗' && e.poetName === '龚自珍')).toBe(true);
  });
});
