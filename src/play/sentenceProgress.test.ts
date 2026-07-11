import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSentenceProgress, saveSentenceProgress, markSentenceCleared,
  beginSentenceStage, commitSentenceCorrect, commitSentenceBlood, clearSentenceCurrent,
} from './sentenceProgress';
import { INITIAL_PROGRESS } from './types';

describe('sentence progress persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('loadSentenceProgress returns INITIAL_PROGRESS when empty', () => {
    expect(loadSentenceProgress('tang')).toEqual(INITIAL_PROGRESS);
  });

  it('saveSentenceProgress round-trips', () => {
    const p = { ...INITIAL_PROGRESS, unlockedIndex: 5, cleared: ['3', '5'] };
    saveSentenceProgress(p, 'tang');
    expect(loadSentenceProgress('tang')).toEqual(p);
  });

  it('markSentenceCleared appends level and bumps unlockedIndex', () => {
    saveSentenceProgress({ ...INITIAL_PROGRESS, unlockedIndex: 0 }, 'tang');
    const p = markSentenceCleared('5', 'tang');
    expect(p.cleared).toContain('5');
    expect(p.unlockedIndex).toBe(5);
    expect(p.current).toBeNull();
  });

  it('beginSentenceStage sets current with full blood and empty correct', () => {
    const p = beginSentenceStage('3', 'tang');
    expect(p.current).toEqual({ keyword: '3', correct: [], blood: 3 });
  });

  it('commitSentenceCorrect appends line', () => {
    beginSentenceStage('3', 'tang');
    const p = commitSentenceCorrect('3', '床前明月光', 'tang');
    expect(p.current!.correct).toEqual(['床前明月光']);
  });

  it('commitSentenceBlood updates blood only', () => {
    beginSentenceStage('3', 'tang');
    const p = commitSentenceBlood('3', 2, 'tang');
    expect(p.current!.blood).toBe(2);
  });

  it('clearSentenceCurrent nulls current', () => {
    beginSentenceStage('3', 'tang');
    const p = clearSentenceCurrent('tang');
    expect(p.current).toBeNull();
  });

  it('survives localStorage being unavailable', () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('denied'); };
    expect(loadSentenceProgress('tang')).toEqual(INITIAL_PROGRESS);
    window.localStorage.getItem = orig;
  });

  it('isolates primary sentence progress by non-default grade band', () => {
    saveSentenceProgress({ ...INITIAL_PROGRESS, unlockedIndex: 2, cleared: ['1'] }, 'primary', 5);
    expect(loadSentenceProgress('primary', 5).cleared).toEqual(['1']);
    expect(loadSentenceProgress('primary', 6)).toEqual(INITIAL_PROGRESS);
  });

  it('uses the legacy primary key for MAX_BAND sentence progress', () => {
    const legacy = { ...INITIAL_PROGRESS, unlockedIndex: 8, cleared: ['1', '2'] };
    window.localStorage.setItem('shiwen-feihua-sentence-progress:primary', JSON.stringify(legacy));
    expect(loadSentenceProgress('primary', 12)).toEqual(legacy);
    expect(loadSentenceProgress('primary')).toEqual(legacy);
  });
});