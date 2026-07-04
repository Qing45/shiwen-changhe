import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadProgress, saveProgress, markCleared,
  beginStage, commitStageCorrect, commitStageBlood, clearCurrent,
} from './progress';
import { INITIAL_PROGRESS } from './types';

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
});
