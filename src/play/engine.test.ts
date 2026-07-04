import { describe, it, expect, beforeEach } from 'vitest';
import type { Verse } from './types';
import { buildKeywordIndex, getVersesFor, getKeywordIndex } from './engine';
import { KEYWORDS } from './keywords';

describe('buildKeywordIndex', () => {
  let index: Map<string, Verse[]>;

  beforeEach(() => {
    index = buildKeywordIndex();
  });

  it('returns a Map keyed by every KEYWORDS character', () => {
    for (const k of KEYWORDS) {
      expect(index.has(k)).toBe(true);
    }
  });

  it('each verse contains its keyword', () => {
    for (const [kw, verses] of index.entries()) {
      for (const v of verses) {
        expect(v.line).toContain(kw);
      }
    }
  });

  it('春 has at least 5 verses (entry-tier must be playable)', () => {
    expect(getVersesFor('春').length).toBeGreaterThanOrEqual(5);
  });

  it('月 has at least 5 verses', () => {
    expect(getVersesFor('月').length).toBeGreaterThanOrEqual(5);
  });

  it('every verse has non-empty poemId, poemTitle, poetName', () => {
    for (const verses of index.values()) {
      for (const v of verses) {
        expect(v.poemId.length).toBeGreaterThan(0);
        expect(v.poemTitle.length).toBeGreaterThan(0);
        expect(v.poetName.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('getKeywordIndex (lazy cache)', () => {
  it('returns the same Map on second call', () => {
    const a = getKeywordIndex();
    const b = getKeywordIndex();
    expect(a).toBe(b);
  });
});
