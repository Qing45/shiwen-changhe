import { describe, it, expect, beforeEach } from 'vitest';
import type { Verse } from './types';
import { buildKeywordIndex, getVersesFor, getKeywordIndex, pickStageQuestion, buildNineGrid, validateStageInput } from './engine';
import { KEYWORDS } from './keywords';
import { MAX_BAND } from '../data/grades';
import { PRIMARY_KEYWORDS } from './primaryKeywords';
import { countAvailableCharStages, getCharKeywordGroups, getCharKeywords } from './engine';

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

// ============ Task 3: 单人闯关出题 / 九宫格 / 判定 ============

describe('pickStageQuestion', () => {
  it('returns a verse not in `used`', () => {
    const verses = getVersesFor('春');
    const used = new Set([verses[0].line]);
    const q = pickStageQuestion('春', used);
    expect(q).not.toBeNull();
    expect(used.has(q!.verse.line)).toBe(false);
  });

  it('returns null when all verses are used', () => {
    const verses = getVersesFor('春');
    const used = new Set(verses.map(v => v.line));
    expect(pickStageQuestion('春', used)).toBeNull();
  });

  it('returns null when keyword has no verses (empty pool, no crash)', () => {
    expect(pickStageQuestion('不存在', new Set())).toBeNull();
  });

  it('blanks array contains a position where keyword occurs', () => {
    // 多次随机抽样，避免单次偶然
    for (let attempt = 0; attempt < 20; attempt++) {
      const q = pickStageQuestion('春', new Set());
      if (!q) continue;
      // 至少一处 blanks 指向 '春'（关键字必挖）
      expect(q.blanks.some(pos => q.verse.line[pos] === '春')).toBe(true);
    }
  });

  it('blanks length is 2 or 3', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const q = pickStageQuestion('春', new Set());
      if (!q) continue;
      expect(q.blanks.length).toBeGreaterThanOrEqual(2);
      expect(q.blanks.length).toBeLessThanOrEqual(3);
    }
  });

  it('does not blank out punctuation', () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const q = pickStageQuestion('春', new Set());
      if (!q) continue;
      for (const pos of q.blanks) {
        const ch = q.verse.line[pos];
        expect(/[，。？！；：、,\.\?!;:]/.test(ch)).toBe(false);
      }
    }
  });

  it('works on small pools (笛 has ~5 verses, no crash)', () => {
    const q = pickStageQuestion('笛', new Set());
    // 不论返回是否为 null（笛存在），都不应抛错
    if (q) {
      expect(q.blanks.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('buildNineGrid', () => {
  it('returns 12 character blocks', () => {
    const g = buildNineGrid('春眠不觉晓', [0, 2]);
    expect(g.chars).toHaveLength(12);
  });

  it('contains all blank answer chars and reports correct blankCount', () => {
    const answer = '春眠不觉晓';
    const g = buildNineGrid(answer, [0, 2]);
    // blanks = [0, 2] → answer[0]='春', answer[2]='不' must be in grid
    expect(g.chars).toContain('春');
    expect(g.chars).toContain('不');
    expect(g.blankCount).toBe(2);
  });

  it('distractor chars are not equal to any answer char', () => {
    const answer = '春眠不觉晓';
    const g = buildNineGrid(answer, [0, 2]);
    const blankChars = [answer[0], answer[2]];
    // 干扰字 = 全部字 - blanks 出现的字符
    const distractors = g.chars.filter(c => !blankChars.includes(c));
    // 干扰字数量应为 12 - blanks.length
    expect(distractors.length).toBe(12 - 2);
    for (const d of distractors) {
      expect(answer).not.toContain(d);
    }
  });
});

describe('validateStageInput', () => {
  it('matches when filled equals answer chars at all blank positions', () => {
    // blanks=[0,2] in '春眠不觉晓' → answer[0]='春', answer[2]='不' → '春不'
    expect(validateStageInput('春不', '春眠不觉晓', [0, 2])).toBe(true);
  });

  it('rejects wrong character', () => {
    // '春眠' → answer[2]='不' !== '眠'
    expect(validateStageInput('春眠', '春眠不觉晓', [0, 2])).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(validateStageInput('春', '春眠不觉晓', [0, 2])).toBe(false);
    expect(validateStageInput('春不觉', '春眠不觉晓', [0, 2])).toBe(false);
  });
});

// ============ Task 3: 单字引擎 band 过滤与自适应关键字 ============

describe('primary grade band filtering for char mode', () => {
  it('getVersesFor(primary, band) is a subset of the full primary pool and grows monotonically', () => {
    const keyword = '春';
    const full = getVersesFor(keyword, 'primary', MAX_BAND).map((v) => `${v.poemId}:${v.line}`);
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const current = getVersesFor(keyword, 'primary', band).map((v) => `${v.poemId}:${v.line}`);
      expect(current.length).toBeGreaterThanOrEqual(previous);
      expect(current.every((hit) => full.includes(hit))).toBe(true);
      previous = current.length;
    }
  });

  it('returns empty primary keywords/groups at band 1 when no keyword reaches STAGE_GOAL', () => {
    // band=1 has too few poems: no PRIMARY_KEYWORD reaches STAGE_GOAL (5) verses,
    // so both helpers must safely return empty arrays (not throw, not return all).
    const keywords = getCharKeywords('primary', 1);
    const groups = getCharKeywordGroups('primary', 1);
    expect(keywords).toEqual([]);
    expect(groups).toEqual([]);
  });

  it('filters primary keywords by a mid band pool while preserving order', () => {
    // Use band=3 — the lowest band where some keywords actually reach STAGE_GOAL.
    // Asserting > 0 prevents the filter test from passing vacuously when no
    // keywords survive; asserting < full proves filtering actually happened.
    const mid = getCharKeywords('primary', 3);
    const full = getCharKeywords('primary', MAX_BAND);
    expect(full).toEqual(PRIMARY_KEYWORDS);
    expect(mid.length).toBeGreaterThan(0);
    expect(mid.length).toBeLessThan(full.length);
    expect(mid.every((kw) => PRIMARY_KEYWORDS.includes(kw))).toBe(true);
    expect(mid).toEqual(PRIMARY_KEYWORDS.filter((kw) => mid.includes(kw)));
  });

  it('returns grouped primary keywords with empty groups removed for a mid band', () => {
    const groups = getCharKeywordGroups('primary', 3);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.words.length > 0)).toBe(true);
    expect(groups.flatMap((g) => [...g.words])).toEqual(getCharKeywords('primary', 3));
  });

  it('keeps tang and full primary char counts unchanged', () => {
    expect(countAvailableCharStages('tang')).toBe(50);
    expect(countAvailableCharStages('primary', MAX_BAND)).toBe(30);
  });
});
