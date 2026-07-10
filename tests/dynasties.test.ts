import { describe, it, expect } from 'vitest';
import { DYNASTIES, getDynastyName, getDynasty } from '../src/data/dynasties';

describe('DYNASTIES', () => {
  it('contains the six expected dynasty ids', () => {
    expect(Object.keys(DYNASTIES).sort()).toEqual(['ming', 'modern', 'other', 'qing', 'song', 'tang']);
  });

  it('has contiguous year ranges with no overlap', () => {
    const sorted = (['other', 'tang', 'song', 'ming', 'qing', 'modern'] as const).map((k) => DYNASTIES[k]);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].endYear).toBeLessThanOrEqual(sorted[i + 1].startYear);
    }
  });
});

describe('getDynastyName', () => {
  it('returns the Chinese name for known ids', () => {
    expect(getDynastyName('tang')).toBe('唐');
    expect(getDynastyName('song')).toBe('宋');
    expect(getDynastyName('ming')).toBe('明');
    expect(getDynastyName('qing')).toBe('清');
    expect(getDynastyName('modern')).toBe('近现代');
    expect(getDynastyName('other')).toBe('南北朝');
  });

  it('falls back to 唐 for unknown ids', () => {
    expect(getDynastyName('unknown-id')).toBe('唐');
    expect(getDynastyName('')).toBe('唐');
  });
});

describe('getDynasty', () => {
  it('returns the full record for known ids', () => {
    expect(getDynasty('song')).toEqual({ name: '宋', startYear: 960, endYear: 1279 });
  });

  it('returns undefined for unknown ids', () => {
    expect(getDynasty('foo')).toBeUndefined();
  });
});
