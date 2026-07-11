import { describe, it, expect, beforeEach } from 'vitest';
import { pickTitleQuestion, _setRng } from './titles';
import { getPoem } from '../data/load';

describe('pickTitleQuestion', () => {
  beforeEach(() => {
    _setRng(Math.random);
  });

  it('returns a question with 4 options including the correct answer', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'tang');
    expect(q).not.toBeNull();
    if (!q) return;

    expect(q.options.length).toBe(4);
    expect(q.options.map(o => o.title)).toContain(q.poemTitle);

    // 4 个选项的 title 各不相同
    const titles = q.options.map(o => o.title);
    expect(new Set(titles).size).toBe(4);
  });

  it('cleaned content has no parenthesized variant annotations', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'tang');
    if (!q) return;
    // extractVariants 已剥除 (X 一作：Y) 类括号，content 应不含全角圆括号
    expect(q.content).not.toMatch(/[（(]/);
  });

  it('returns null when every poem in corpus is already used', () => {
    // 构造一个覆盖整个候选池的 usedPoemIds（500 > 309 tang 候选池，留出增长余量）
    const allIds = new Set<string>();
    for (let i = 0; i < 500; i++) {
      _setRng(() => 0.5);
      const q = pickTitleQuestion(1, allIds, 'tang');
      if (!q) break;
      allIds.add(q.poemId);
    }
    const q = pickTitleQuestion(1, allIds, 'tang');
    expect(q).toBeNull();
  });

  it('excludes the correct poem from its own distractors', () => {
    _setRng(() => 0.5);
    for (let i = 0; i < 5; i++) {
      const q = pickTitleQuestion(1, new Set(), 'tang');
      if (!q) continue;
      const distractors = q.options.filter(o => o.id !== q.poemId);
      expect(distractors.length).toBe(3);
      for (const d of distractors) {
        expect(d.id).not.toBe(q.poemId);
      }
    }
  });

  it('同作者优先：distractors 中至少 1 个与正确答案同作者', () => {
    _setRng(() => 0.42);
    // 跑多次直到遇到作者有 ≥3 个其他诗的题
    let foundSameAuthor = false;
    for (let i = 0; i < 30; i++) {
      const q = pickTitleQuestion(1, new Set(), 'tang');
      if (!q) continue;
      const correctPoem = getPoem(q.poemId);
      if (!correctPoem) continue;
      const distractors = q.options.filter(o => o.id !== q.poemId);
      const sameAuthor = distractors.filter(d => {
        const dPoem = getPoem(d.id);
        return dPoem?.poetId === correctPoem.poetId;
      });
      if (sameAuthor.length > 0) {
        foundSameAuthor = true;
        break;
      }
    }
    expect(foundSameAuthor).toBe(true);
  });

  it('works for primary corpus', () => {
    _setRng(() => 0.5);
    const q = pickTitleQuestion(1, new Set(), 'primary');
    expect(q).not.toBeNull();
    expect(q!.options.length).toBe(4);
  });
});