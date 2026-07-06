import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildChoiceBoard, aiPickAnswer, rollFirstTurn } from './ai';
import { getVersesFor } from './engine';

describe('buildChoiceBoard', () => {
  it('returns 4 verses when pool has ≥ 4 unused', () => {
    const kw = '春';
    const used = new Set<string>();
    const board = buildChoiceBoard(used, kw, 4);
    expect(board).toHaveLength(4);
  });

  it('all returned verses are unused', () => {
    const kw = '春';
    const used = new Set<string>();
    const board = buildChoiceBoard(used, kw, 4);
    for (const v of board) expect(used.has(v.line)).toBe(false);
  });

  it('respects used set by excluding those lines', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    expect(pool.length).toBeGreaterThan(4);
    const used = new Set([pool[0].line, pool[1].line]);
    const board = buildChoiceBoard(used, kw, 4);
    for (const v of board) expect(used.has(v.line)).toBe(false);
    expect(board).toHaveLength(4);
  });

  it('returns fewer than 4 when pool is mostly used', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    const allExceptTwo = pool.slice(2).map((v) => v.line);
    const used = new Set(allExceptTwo);
    const board = buildChoiceBoard(used, kw, 4);
    expect(board.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when everything is used', () => {
    const kw = '春';
    const pool = getVersesFor(kw);
    const used = new Set(pool.map((v) => v.line));
    expect(buildChoiceBoard(used, kw, 4)).toEqual([]);
  });

  it('returns empty array for an empty/non-existent keyword', () => {
    expect(buildChoiceBoard(new Set(), '?', 4)).toEqual([]);
  });
});

describe('aiPickAnswer', () => {
  it('shisheng always picks when pool has verses', () => {
    const kw = '春';
    const used = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = aiPickAnswer(kw, used, 'shisheng');
      expect(r.picked).toBe(true);
      expect(r.verse).toBeDefined();
      expect(used.has(r.verse!.line)).toBe(false);
    }
  });

  it('shisheng picks false when pool is empty', () => {
    const pool = getVersesFor('春');
    const used = new Set(pool.map((v) => v.line));
    expect(aiPickAnswer('春', used, 'shisheng').picked).toBe(false);
  });

  it('qingdeng misses roughly 30% of the time (statistical)', () => {
    let misses = 0;
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (!aiPickAnswer('春', used, 'qingdeng').picked) misses++;
    }
    // ~30% miss rate; allow ±5% tolerance
    expect(misses / N).toBeGreaterThan(0.25);
    expect(misses / N).toBeLessThan(0.35);
  });

  it('mohe misses roughly 10% of the time', () => {
    let misses = 0;
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      if (!aiPickAnswer('春', used, 'mohe').picked) misses++;
    }
    expect(misses / N).toBeGreaterThan(0.05);
    expect(misses / N).toBeLessThan(0.15);
  });

  it('shisheng never misses (sample 1000)', () => {
    const N = 1000;
    const used = new Set<string>();
    for (let i = 0; i < N; i++) {
      expect(aiPickAnswer('春', used, 'shisheng').picked).toBe(true);
    }
  });
});

describe('rollFirstTurn', () => {
  it('returns player or ai only', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollFirstTurn();
      expect(r === 'player' || r === 'ai').toBe(true);
    }
  });

  it('splits roughly 50/50 over 1000 calls', () => {
    let players = 0;
    const N = 1000;
    for (let i = 0; i < N; i++) {
      if (rollFirstTurn() === 'player') players++;
    }
    expect(players / N).toBeGreaterThan(0.45);
    expect(players / N).toBeLessThan(0.55);
  });
});
