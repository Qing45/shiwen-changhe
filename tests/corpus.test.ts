import { describe, it, expect } from 'vitest';
import { withCorpus, getPoets, getPoems } from '../src/data/load';

describe('withCorpus', () => {
  it('defaults to "tang" when corpus missing', () => {
    expect(withCorpus({ id: 'a', title: 't' }, 'tang')).toEqual({ id: 'a', title: 't', corpus: 'tang' });
  });
  it('keeps existing corpus field', () => {
    expect(withCorpus({ id: 'a', corpus: 'primary' }, 'tang')).toEqual({ id: 'a', corpus: 'primary' });
  });
});

describe('getPoets (no arg) — back-compat', () => {
  it('returns all poets regardless of corpus', () => {
    const all = getPoets();
    expect(all.length).toBeGreaterThanOrEqual(76);
    expect(all.some(p => p.corpus === 'tang')).toBe(true);
  });
});

describe('getPoets(corpus)', () => {
  it('tang returns only tang-corpus poets', () => {
    const tang = getPoets('tang');
    expect(tang.every(p => p.corpus === 'tang')).toBe(true);
  });
  it('primary returns only primary-corpus poets (may be empty before Task 2)', () => {
    const primary = getPoets('primary');
    expect(primary.every(p => p.corpus === 'primary')).toBe(true);
  });
  it('all returns full set', () => {
    expect(getPoets('all').length).toBe(getPoets().length);
  });
});

describe('getPoems(corpus)', () => {
  it('tang excludes primary-only poems', () => {
    const tang = getPoems('tang');
    expect(tang.every(p => p.corpus !== 'primary')).toBe(true);
  });
  it('primary excludes tang-only poems', () => {
    const primary = getPoems('primary');
    expect(primary.every(p => p.corpus !== 'tang')).toBe(true);
  });
});