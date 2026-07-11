import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTitleProgress, saveTitleProgress, markTitleCleared,
  beginTitleStage, commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
} from './titleProgress';
import { INITIAL_PROGRESS } from './types';

describe('title progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadTitleProgress returns INITIAL_PROGRESS when empty', () => {
    expect(loadTitleProgress('tang')).toEqual(INITIAL_PROGRESS);
  });

  it('saveTitleProgress round-trips', () => {
    const p = { ...INITIAL_PROGRESS, unlockedIndex: 5, cleared: ['3', '5'] };
    saveTitleProgress(p, 'tang');
    expect(loadTitleProgress('tang')).toEqual(p);
  });

  it('markTitleCleared appends level and bumps unlockedIndex', () => {
    saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0 }, 'tang');
    const p = markTitleCleared('5', 'tang');
    expect(p.cleared).toContain('5');
    expect(p.unlockedIndex).toBe(5);
    expect(p.current).toBeNull();
  });

  it('beginTitleStage sets current with full blood and empty correct', () => {
    const p = beginTitleStage('3', 'tang');
    expect(p.current).toEqual({ keyword: '3', correct: [], blood: 3 });
  });

  it('commitTitleCorrect appends line', () => {
    beginTitleStage('3', 'tang');
    const p = commitTitleCorrect('3', '床前明月光', 'tang');
    expect(p.current!.correct).toEqual(['床前明月光']);
  });

  it('commitTitleBlood updates blood only', () => {
    beginTitleStage('3', 'tang');
    const p = commitTitleBlood('3', 2, 'tang');
    expect(p.current!.blood).toBe(2);
  });

  it('clearTitleCurrent nulls current', () => {
    beginTitleStage('3', 'tang');
    const p = clearTitleCurrent('tang');
    expect(p.current).toBeNull();
  });

  it('tang 与 primary 进度互不串扰', () => {
    saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 7, cleared: ['5'] }, 'tang');
    expect(loadTitleProgress('primary')).toEqual(INITIAL_PROGRESS);
    expect(loadTitleProgress('tang').unlockedIndex).toBe(7);
  });

  it('survives localStorage being unavailable', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadTitleProgress('tang')).toEqual(INITIAL_PROGRESS);
    window.localStorage.getItem = orig;
  });
});
