import { describe, it, expect } from 'vitest';
import { getPoets, getPoet, getPoemsByPoet, getPoem, getNeighbors, poemInCorpus } from '../src/data/load';
import type { Poem } from '../src/types';

describe('data loader', () => {
  it('exposes a list of poets', () => {
    const poets = getPoets();
    expect(poets.length).toBeGreaterThan(50);
    expect(poets[0].id).toBeTruthy();
    expect(poets[0].name).toBeTruthy();
  });

  it('looks up a single poet by id', () => {
    const poets = getPoets();
    const first = poets[0];
    expect(getPoet(first.id)).toEqual(first);
    expect(getPoet('does-not-exist')).toBeUndefined();
  });

  it('lists poems for a poet', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    expect(poems.length).toBeGreaterThan(0);
    for (const p of poems) {
      expect(p.poetId).toBe(poets[0].id);
    }
  });

  it('looks up a single poem by id', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    expect(getPoem(poems[0].id)).toEqual(poems[0]);
    expect(getPoem('does-not-exist')).toBeUndefined();
  });

  it('finds prev/next neighbors within a poet', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    if (poems.length < 2) return; // can't test neighbors with < 2 poems
    const { prev, next } = getNeighbors(poems[0].id);
    expect(prev).toBeUndefined();
    expect(next?.id).toBe(poems[1].id);
    const middle = getNeighbors(poems[1].id);
    expect(middle.prev?.id).toBe(poems[0].id);
    expect(middle.next?.id).toBe(poems[2].id);
  });
});

describe('poemInCorpus', () => {
  // 构造一个最小 Poem，corpus/gradeBand/gradeBands 由用例自定义。
  function makePoem(overrides: Partial<Poem>): Poem {
    return {
      id: 'x', title: 't', poetId: 'p', content: 'c', annotations: [],
      familiarity: 3, corpus: 'tang', ...overrides,
    };
  }

  it('direct-corpus poems match their own corpus', () => {
    expect(poemInCorpus(makePoem({ corpus: 'tang' }), 'tang')).toBe(true);
    expect(poemInCorpus(makePoem({ corpus: 'tang' }), 'primary')).toBe(false);
    expect(poemInCorpus(makePoem({ corpus: 'primary', gradeBand: 5 }), 'primary')).toBe(true);
    expect(poemInCorpus(makePoem({ corpus: 'primary', gradeBand: 5 }), 'junior')).toBe(false);
    expect(poemInCorpus(makePoem({ corpus: 'junior', gradeBand: '7a' }), 'junior')).toBe(true);
    expect(poemInCorpus(makePoem({ corpus: 'junior', gradeBand: '7a' }), 'primary')).toBe(false);
  });

  it('legacy both = tang + primary, but not junior', () => {
    const poem = makePoem({ corpus: 'both', gradeBand: 5 });
    expect(poemInCorpus(poem, 'tang')).toBe(true);
    expect(poemInCorpus(poem, 'primary')).toBe(true);
    expect(poemInCorpus(poem, 'junior')).toBe(false);
  });

  it('both with junior gradeBand is also junior', () => {
    const poem = makePoem({ corpus: 'both', gradeBands: [5, '7a'] });
    expect(poemInCorpus(poem, 'tang')).toBe(true);
    expect(poemInCorpus(poem, 'primary')).toBe(true);
    expect(poemInCorpus(poem, 'junior')).toBe(true);
  });

  it('primary poem with gradeBands containing junior string is cross-corpus', () => {
    // 例：己亥杂诗 — 原在小学 grade 6，新增初中 9a 段。corpus 保持 'primary'。
    const poem = makePoem({ corpus: 'primary', gradeBand: 12, gradeBands: ['9a'] });
    expect(poemInCorpus(poem, 'tang')).toBe(false);
    expect(poemInCorpus(poem, 'primary')).toBe(true);
    expect(poemInCorpus(poem, 'junior')).toBe(true);
  });

  it('tang poem with gradeBands containing junior string is cross-corpus', () => {
    // 例：静夜思 — 原在唐诗三百首，新增初中段。
    const poem = makePoem({ corpus: 'tang', gradeBands: ['7a'] });
    expect(poemInCorpus(poem, 'tang')).toBe(true);
    expect(poemInCorpus(poem, 'primary')).toBe(false);
    expect(poemInCorpus(poem, 'junior')).toBe(true);
  });
});
