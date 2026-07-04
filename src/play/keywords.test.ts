import { describe, it, expect } from 'vitest';
import { KEYWORDS, KEYWORD_GROUPS } from './keywords';

describe('KEYWORDS', () => {
  it('has exactly 50 characters', () => {
    expect(KEYWORDS).toHaveLength(50);
  });

  it('each character is a single CJK char', () => {
    for (const k of KEYWORDS) {
      expect(k.length).toBe(1);
      expect(/[一-鿿]/.test(k)).toBe(true);
    }
  });

  it('starts with 春 月 花 风 山 水 云 天 人 心 (entry tier)', () => {
    expect(KEYWORDS.slice(0, 10)).toEqual(['春','月','花','风','山','水','云','天','人','心']);
  });

  it('has no duplicates', () => {
    expect(new Set(KEYWORDS).size).toBe(50);
  });
});

describe('KEYWORD_GROUPS', () => {
  it('splits into 10 / 20 / 20', () => {
    expect(KEYWORD_GROUPS.entry).toHaveLength(10);
    expect(KEYWORD_GROUPS.mid).toHaveLength(20);
    expect(KEYWORD_GROUPS.advanced).toHaveLength(20);
  });

  it('groups union equals KEYWORDS in order', () => {
    expect([...KEYWORD_GROUPS.entry, ...KEYWORD_GROUPS.mid, ...KEYWORD_GROUPS.advanced])
      .toEqual(KEYWORDS);
  });
});
