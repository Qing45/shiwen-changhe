import { describe, it, expect } from 'vitest';
import { MAX_BAND } from '../data/grades';
import {
  buildAllCouplets,
  countAvailableLevels,
  getAllCouplets,
  getAvailableLevelGroups,
  getTotalAvailableLevels,
  pickLevelQuestion,
  tierOfAvailableLevel,
  tierOfLevel,
  _setRng,
} from './couplets';

describe('buildAllCouplets', () => {
  it('returns a non-empty array of paired upper/lower lines', () => {
    const pairs = buildAllCouplets();
    expect(pairs.length).toBeGreaterThan(0);
    for (const p of pairs) {
      expect(p.upper.line.length).toBeGreaterThan(0);
      expect(p.lower.line.length).toBeGreaterThan(0);
      expect(p.upper.poemId).toBe(p.lower.poemId);
    }
  });
});

describe('getAllCouplets (lazy cache)', () => {
  it('returns the same reference on repeat calls', () => {
    const a = getAllCouplets();
    const b = getAllCouplets();
    expect(a).toBe(b);
  });
});

describe('tierOfLevel', () => {
  it('maps levels 1-10 to entry', () => {
    for (let i = 1; i <= 10; i++) expect(tierOfLevel(i)).toBe('entry');
  });
  it('maps levels 11-30 to mid', () => {
    for (let i = 11; i <= 30; i++) expect(tierOfLevel(i)).toBe('mid');
  });
  it('maps levels 31-50 to advanced', () => {
    for (let i = 31; i <= 50; i++) expect(tierOfLevel(i)).toBe('advanced');
  });
});

describe('pickLevelQuestion', () => {
  it('returns 4 options including the correct answer', () => {
    _setRng(() => 0.5);
    const q = pickLevelQuestion('entry', new Set());
    expect(q).not.toBeNull();
    if (!q) return;

    expect(q.options.length).toBe(4);
    expect(q.options).toContain(q.answer);
    expect(q.upper.poemId).toBe(q.answer.poemId);
  });

  it('entry tier answers are 5-char (after stripping punctuation)', () => {
    _setRng(() => 0.6);
    const strip = (s: string) => s.replace(/[，。？！；：、,\.\?!;:]/g, '');
    for (let i = 0; i < 5; i++) {
      const q = pickLevelQuestion('entry', new Set());
      if (!q) continue;
      expect(strip(q.answer.line).length).toBe(5);
    }
  });

  it('mid tier answers are 7-char (after stripping punctuation)', () => {
    _setRng(() => 0.7);
    const strip = (s: string) => s.replace(/[，。？！；：、,\.\?!;:]/g, '');
    for (let i = 0; i < 5; i++) {
      const q = pickLevelQuestion('mid', new Set());
      if (!q) continue;
      expect(strip(q.answer.line).length).toBe(7);
    }
  });

  it('distractors are not from the same poem as the correct answer', () => {
    _setRng(() => 0.8);
    const q = pickLevelQuestion('advanced', new Set());
    if (!q) return;
    const distractors = q.options.filter((o) => o.line !== q.answer.line);
    for (const d of distractors) {
      expect(d.poemId).not.toBe(q.answer.poemId);
    }
  });

  it('4 options are all distinct lines', () => {
    _setRng(() => 0.3);
    const q = pickLevelQuestion('advanced', new Set());
    if (!q) return;
    const lines = q.options.map((o) => o.line);
    expect(new Set(lines).size).toBe(4);
  });

  it('all 4 options share the same character count as the answer', () => {
    _setRng(() => 0.5);
    const strip = (s: string) => s.replace(/[，。？！；：、,\.\?!;:]/g, '');
    for (const tier of ['entry', 'mid', 'advanced'] as const) {
      for (let i = 0; i < 5; i++) {
        const q = pickLevelQuestion(tier, new Set());
        if (!q) continue;
        const ansLen = strip(q.answer.line).length;
        for (const opt of q.options) {
          expect(strip(opt.line).length).toBe(ansLen);
        }
      }
    }
  });

  it('upper line shares the same character count as the answer (题目与选项字数一致)', () => {
    _setRng(() => 0.5);
    const strip = (s: string) => s.replace(/[，。？！；：、,\.\?!;:]/g, '');
    for (const tier of ['entry', 'mid', 'advanced'] as const) {
      for (let i = 0; i < 5; i++) {
        const q = pickLevelQuestion(tier, new Set());
        if (!q) continue;
        expect(strip(q.upper.line).length).toBe(strip(q.answer.line).length);
      }
    }
  });

  it('usedUpperLines excludes previously-seen upper lines', () => {
    _setRng(() => 0.4);
    const first = pickLevelQuestion('entry', new Set());
    if (!first) return;
    const used = new Set<string>([first.upper.line]);
    for (let i = 0; i < 10; i++) {
      const q = pickLevelQuestion('entry', used);
      if (!q) continue;
      expect(q.upper.line).not.toBe(first.upper.line);
    }
  });
});

describe('pickLevelQuestion pool filtering (regression: junior 7a 关卡打开就题库已空)', () => {
  // 旧实现 pickLevelQuestion 从整个 tier 池随机抽 pair，没过滤 canMakeQuestion。
  // countAvailableLevels 用 canMakeQuestion 算关数（=可出题 pair 数），两端不一致：
  // 池里若混着凑不齐 3 个不同诗干扰的 pair，pickLevelQuestion 有概率抽到 → 返回 null
  // → 用户打开页面看到「题库已空」。修复后两端一致：pool 必先 canMakeQuestion 过滤。
  it('never returns null on any RNG seed when countAvailableLevels > 0', () => {
    _setRng(Math.random);
    const cases: Array<{ corpus: 'tang' | 'primary' | 'junior' | 'both'; band?: number | string }> = [
      { corpus: 'tang' },
      { corpus: 'primary', band: MAX_BAND },
      { corpus: 'primary', band: 6 },
      { corpus: 'junior', band: '7a' },
      { corpus: 'junior', band: '8a' },
      { corpus: 'junior', band: '9b' },
      { corpus: 'both' },
    ];
    for (const { corpus, band } of cases) {
      for (const tier of ['entry', 'mid', 'advanced'] as const) {
        const count = countAvailableLevels(tier, corpus, band);
        if (count === 0) continue;
        for (let i = 0; i < 30; i++) {
          const q = pickLevelQuestion(tier, new Set(), corpus, band);
          if (q === null) {
            throw new Error(
              `pickLevelQuestion returned null for ${corpus}/${band ?? '-'} ${tier}` +
              ` (count=${count}) on iteration ${i}`,
            );
          }
          expect(q.options.length).toBe(4);
        }
      }
    }
  });
});

describe('primary grade band filtering for sentence mode', () => {
  it('filters couplet pools by grade band monotonically', () => {
    const full = getAllCouplets('primary', MAX_BAND).map((p) => `${p.upper.poemId}:${p.upper.line}`);
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const current = getAllCouplets('primary', band).map((p) => `${p.upper.poemId}:${p.upper.line}`);
      expect(current.length).toBeGreaterThanOrEqual(previous);
      expect(current.every((hit) => full.includes(hit))).toBe(true);
      previous = current.length;
    }
  });

  it('returns dynamic level groups and preserves the full primary total at band 12', () => {
    expect(getTotalAvailableLevels('primary', MAX_BAND)).toBe(30);
    expect(getAvailableLevelGroups('primary', MAX_BAND)).toEqual([
      { tier: 'entry', start: 1, end: 10, count: 10 },
      { tier: 'mid', start: 11, end: 30, count: 20 },
    ]);
    expect(getTotalAvailableLevels('primary', 1)).toBeLessThan(30);
  });

  it('maps dynamic level numbers back to tiers', () => {
    expect(tierOfAvailableLevel(1, 'primary', MAX_BAND)).toBe('entry');
    expect(tierOfAvailableLevel(10, 'primary', MAX_BAND)).toBe('entry');
    expect(tierOfAvailableLevel(11, 'primary', MAX_BAND)).toBe('mid');
    expect(tierOfAvailableLevel(30, 'primary', MAX_BAND)).toBe('mid');
    expect(tierOfAvailableLevel(31, 'primary', MAX_BAND)).toBeNull();
  });

  it('countAvailableLevels never leaves a tier with fewer than STAGE_GOAL pairs (regression: 7a level 2 答完 3 题就题库已空)', () => {
    // 每关需 STAGE_GOAL=5 句不重复的上句才能通关。可出题 pair 不足 5 时整档必须归零，
    // 否则用户打开的关卡注定无法通关 —— 答完几题后 pool 干涸，看到「题库已空」。
    const STAGE_GOAL = 5;
    const cases: Array<{ corpus: 'tang' | 'primary' | 'junior' | 'both'; band?: number | string }> = [
      { corpus: 'tang' },
      { corpus: 'primary', band: 1 },
      { corpus: 'primary', band: 3 },
      { corpus: 'primary', band: MAX_BAND },
      { corpus: 'junior', band: '7a' },
      { corpus: 'junior', band: '8a' },
      { corpus: 'junior', band: '9b' },
      { corpus: 'both' },
    ];
    for (const { corpus, band } of cases) {
      for (const tier of ['entry', 'mid', 'advanced'] as const) {
        const count = countAvailableLevels(tier, corpus, band);
        if (count > 0) {
          // 关数 > 0 时必须保证可通关：池子足够大，pickLevelQuestion 跑 STAGE_GOAL 次
          // 不应撞空。注意每关 usedUpperLines 独立累积，模拟一关内连答 5 次。
          const used = new Set<string>();
          for (let i = 0; i < STAGE_GOAL; i++) {
            _setRng(Math.random);
            const q = pickLevelQuestion(tier, used, corpus, band);
            if (q === null) {
              throw new Error(
                `pickLevelQuestion returned null at step ${i} for ${corpus}/${band ?? '-'} ${tier}`,
              );
            }
            expect(q.options.length).toBe(4);
            used.add(q.upper.line);
          }
        }
      }
    }
  });

  it('keeps tang sentence mode at 50 levels', () => {
    expect(getTotalAvailableLevels('tang')).toBe(50);
    expect(getAvailableLevelGroups('tang')).toEqual([
      { tier: 'entry', start: 1, end: 10, count: 10 },
      { tier: 'mid', start: 11, end: 30, count: 20 },
      { tier: 'advanced', start: 31, end: 50, count: 20 },
    ]);
  });
});
