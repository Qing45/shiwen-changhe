import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadTitleProgress, saveTitleProgress, markTitleCleared,
  beginTitleStage, commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
  addTitleUsedItem,
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

  it('isolates primary title progress by non-default grade band', () => {
    saveTitleProgress({ ...INITIAL_PROGRESS, unlockedIndex: 2, cleared: ['1'] }, 'primary', 5);
    expect(loadTitleProgress('primary', 5).cleared).toEqual(['1']);
    expect(loadTitleProgress('primary', 6)).toEqual(INITIAL_PROGRESS);
  });

  it('uses the legacy primary key for MAX_BAND title progress', () => {
    const legacy = { ...INITIAL_PROGRESS, unlockedIndex: 8, cleared: ['1', '2'] };
    window.localStorage.setItem('shiwen-feihua-title-progress:primary', JSON.stringify(legacy));
    expect(loadTitleProgress('primary', 12)).toEqual(legacy);
    expect(loadTitleProgress('primary')).toEqual(legacy);
  });
});

describe('title usedItems cross-level dedup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('addTitleUsedItem accumulates and dedupes poem ids', () => {
    addTitleUsedItem('c90ff9ea5a71', 'tang');
    addTitleUsedItem('e9b1a8b4def0', 'tang');
    addTitleUsedItem('c90ff9ea5a71', 'tang'); // 重复 no-op
    expect(loadTitleProgress('tang').usedItems).toEqual(['c90ff9ea5a71', 'e9b1a8b4def0']);
  });

  it('loadTitleProgress tolerates missing usedItems field in legacy JSON', () => {
    const legacy = { unlockedIndex: 0, cleared: [], current: null };
    window.localStorage.setItem('shiwen-feihua-title-progress', JSON.stringify(legacy));
    const p = loadTitleProgress('tang');
    expect(p.usedItems).toEqual([]);
  });
});
