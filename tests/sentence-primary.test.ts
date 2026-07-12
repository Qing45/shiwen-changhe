import { describe, it, expect } from 'vitest';
import { getAllCouplets, pickLevelQuestion, _setRng } from '../src/play/couplets';
import { MAX_BAND } from '../src/data/grades';

const PUNCT_RE = /[，。？！；：、,\.\?!;:]/g;
const strip = (s: string) => s.replace(PUNCT_RE, '');

describe('primary sentence mode', () => {
  it('has enough 5-char pairs for entry (10 levels) and 7-char for mid (20 levels)', () => {
    const pairs = getAllCouplets('primary', MAX_BAND);
    const short = pairs.filter(p => strip(p.lower.line).length === 5);
    const long = pairs.filter(p => strip(p.lower.line).length === 7);
    // 每关需 1 正确 + 3 干扰（同长），且 usedUpper 递增，故上句数须覆盖关数
    expect(new Set(short.map(p => p.upper.line)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(long.map(p => p.upper.line)).size).toBeGreaterThanOrEqual(20);
  });

  it('pickLevelQuestion returns a valid 4-option question for entry & mid tiers', () => {
    _setRng(() => 0.42);
    for (const tier of ['entry', 'mid'] as const) {
      const q = pickLevelQuestion(tier, new Set(), 'primary', MAX_BAND);
      expect(q, `tier ${tier} should yield a question`).not.toBeNull();
      expect(q!.options.length).toBe(4);
      expect(q!.options).toContainEqual(q!.answer);
      const lens = new Set(q!.options.map(o => strip(o.line).length));
      expect(lens.size, 'all options same length (no length tell)').toBe(1);
    }
    _setRng(Math.random);
  });

  it('entry tier can run 10 distinct levels without repeating upper lines', () => {
    _setRng(() => 0.13);
    const used = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const q = pickLevelQuestion('entry', used, 'primary', MAX_BAND);
      expect(q, `level ${i + 1} should yield a question`).not.toBeNull();
      expect(used.has(q!.upper.line)).toBe(false);
      used.add(q!.upper.line);
    }
    _setRng(Math.random);
  });
});
