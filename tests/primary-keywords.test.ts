import { describe, it, expect } from 'vitest';
import { PRIMARY_KEYWORDS } from '../src/play/primaryKeywords';
import { buildKeywordIndex, getVersesFor } from '../src/play/engine';

describe('PRIMARY_KEYWORDS', () => {
  it('has 10-24 keywords', () => {
    expect(PRIMARY_KEYWORDS.length).toBeGreaterThanOrEqual(10);
    expect(PRIMARY_KEYWORDS.length).toBeLessThanOrEqual(24);
  });

  it('each keyword has ≥ 5 primary-corpus verses', () => {
    // Force build so any error surfaces here, not lazily later.
    buildKeywordIndex('primary');
    for (const kw of PRIMARY_KEYWORDS) {
      const verses = getVersesFor(kw, 'primary');
      expect(verses.length, `keyword ${kw} has only ${verses.length} primary verses`).toBeGreaterThanOrEqual(5);
    }
  });

  it('no duplicate keywords', () => {
    expect(new Set(PRIMARY_KEYWORDS).size).toBe(PRIMARY_KEYWORDS.length);
  });
});
