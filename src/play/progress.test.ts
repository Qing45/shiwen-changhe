import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress, saveProgress, markCleared,
  beginStage, commitStageCorrect, commitStageBlood, clearCurrent,
} from './progress';
import { INITIAL_PROGRESS } from './types';
import { PRIMARY_KEYWORDS } from './primaryKeywords';

describe('progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadProgress returns INITIAL_PROGRESS when empty', () => {
    expect(loadProgress()).toEqual(INITIAL_PROGRESS);
  });

  it('saveProgress round-trips', () => {
    const p = { ...INITIAL_PROGRESS, unlockedIndex: 3, cleared: ['春','月','花'] };
    saveProgress(p);
    expect(loadProgress()).toEqual(p);
  });

  it('markCleared adds keyword and bumps unlockedIndex', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0 });
    const p = markCleared('春');
    expect(p.cleared).toContain('春');
    expect(p.unlockedIndex).toBe(1);
  });

  it('markCleared advances unlockedIndex using primary keyword order', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0, cleared: [] }, 'primary');
    const kw = '来'; // 唐诗 KEYWORDS 里没有的小学专属字
    const expectedIdx = PRIMARY_KEYWORDS.indexOf(kw) + 1;
    expect(PRIMARY_KEYWORDS.includes(kw)).toBe(true);
    const p = markCleared(kw, 'primary');
    expect(p.cleared).toContain(kw);
    expect(p.unlockedIndex).toBe(expectedIdx);
  });

  it('markCleared for tang still uses tang KEYWORDS order', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0, cleared: [] }, 'tang');
    const p = markCleared('月', 'tang'); // 月 在 KEYWORDS index 1 → unlockedIndex 2
    expect(p.unlockedIndex).toBe(2);
  });

  it('beginStage sets current with full blood and empty correct', () => {
    const p = beginStage('春');
    expect(p.current).toEqual({ keyword: '春', correct: [], blood: 3 });
  });

  it('commitStageCorrect appends line', () => {
    beginStage('春');
    const p = commitStageCorrect('春', '春眠不觉晓');
    expect(p.current!.correct).toEqual(['春眠不觉晓']);
  });

  it('commitStageBlood updates blood only', () => {
    beginStage('春');
    const p = commitStageBlood('春', 2);
    expect(p.current!.blood).toBe(2);
  });

  it('clearCurrent nulls current', () => {
    beginStage('春');
    const p = clearCurrent();
    expect(p.current).toBeNull();
  });

  it('survives localStorage being unavailable', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadProgress()).toEqual(INITIAL_PROGRESS);
    window.localStorage.getItem = orig;
  });

  it('isolates primary char progress by non-default grade band', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 2, cleared: ['春'] }, 'primary', 5);
    expect(loadProgress('primary', 5).cleared).toEqual(['春']);
    expect(loadProgress('primary', 6)).toEqual(INITIAL_PROGRESS);
  });

  it('uses the legacy primary key for MAX_BAND char progress', () => {
    const legacy = { ...INITIAL_PROGRESS, unlockedIndex: 9, cleared: ['春', '月'] };
    window.localStorage.setItem('shiwen-feihua-progress:primary', JSON.stringify(legacy));
    expect(loadProgress('primary', 12)).toEqual(legacy);
    expect(loadProgress('primary')).toEqual(legacy);
  });

  it('does not add grade suffixes for tang or all char progress', () => {
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 3, cleared: ['春'] }, 'tang', 5);
    saveProgress({ ...INITIAL_PROGRESS, unlockedIndex: 4, cleared: ['月'] }, 'all', 5);
    expect(window.localStorage.getItem('shiwen-feihua-progress')).not.toBeNull();
    expect(window.localStorage.getItem('shiwen-feihua-progress:all')).not.toBeNull();
    expect(window.localStorage.getItem('shiwen-feihua-progress:tang:g5')).toBeNull();
    expect(window.localStorage.getItem('shiwen-feihua-progress:all:g5')).toBeNull();
  });
});
