import { describe, it, expect, beforeEach } from 'vitest';
import { loadProgress, markCleared, clearCurrent } from '../src/play/progress';
import { loadSentenceProgress } from '../src/play/sentenceProgress';

beforeEach(() => {
  localStorage.clear();
});

describe('progress keys are corpus-suffixed', () => {
  it('all-corpus progress is independent of tang', () => {
    markCleared('月', 'all');
    const tangProgress = loadProgress('tang');
    const allProgress = loadProgress('all');
    expect(allProgress.cleared).toContain('月');
    expect(tangProgress.cleared).not.toContain('月');
  });

  it('all-corpus progress is independent of primary', () => {
    markCleared('月', 'all');
    const primaryProgress = loadProgress('primary');
    expect(primaryProgress.cleared).not.toContain('月');
  });

  it('all key is shiwen-feihua-progress:all', () => {
    markCleared('月', 'all');
    expect(localStorage.getItem('shiwen-feihua-progress:all')).not.toBeNull();
    // 反查原始 key 内容应包含 月
    const raw = localStorage.getItem('shiwen-feihua-progress:all');
    expect(raw).toContain('月');
  });

  it('clearCurrent on all does not touch tang key', () => {
    // 预设 tang 有 current
    const raw = JSON.stringify({ unlockedIndex: 1, cleared: [], current: { keyword: '月', correct: [], blood: 3 } });
    localStorage.setItem('shiwen-feihua-progress', raw);
    clearCurrent('all');
    // tang key 不变
    expect(localStorage.getItem('shiwen-feihua-progress')).toBe(raw);
  });
});
