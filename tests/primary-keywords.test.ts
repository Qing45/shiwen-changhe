import { describe, it, expect } from 'vitest';
import { PRIMARY_KEYWORDS, PRIMARY_KEYWORD_GROUPS } from '../src/play/primaryKeywords';
import { buildKeywordIndex, getVersesFor } from '../src/play/engine';
import { MAX_BAND } from '../src/data/grades';

describe('PRIMARY_KEYWORDS', () => {
  it('has 30 keywords across three tiers', () => {
    expect(PRIMARY_KEYWORD_GROUPS.entry.length).toBe(10);
    expect(PRIMARY_KEYWORD_GROUPS.mid.length).toBe(12);
    expect(PRIMARY_KEYWORD_GROUPS.advanced.length).toBe(8);
    expect(PRIMARY_KEYWORDS.length).toBe(30);
  });

  it('each keyword has ≥ 5 primary-corpus verses', () => {
    // Force build so any error surfaces here, not lazily later.
    buildKeywordIndex('primary');
    for (const kw of PRIMARY_KEYWORDS) {
      const verses = getVersesFor(kw, 'primary', MAX_BAND);
      expect(verses.length, `keyword ${kw} has only ${verses.length} primary verses`).toBeGreaterThanOrEqual(5);
    }
  });

  it('no duplicate keywords', () => {
    expect(new Set(PRIMARY_KEYWORDS).size).toBe(PRIMARY_KEYWORDS.length);
  });
});
