import { describe, it, expect } from 'vitest';
import {
  buildAllCouplets,
  getAllCouplets,
  pickLevelQuestion,
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
