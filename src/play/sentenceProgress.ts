// 整句模式进度持久化（独立 localStorage）。
// 与单字模式的 progress.ts 结构相同，但 storageKey 不同，两套进度互不影响。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';

const STORAGE_KEY = 'shiwen-feihua-sentence-progress';

export function loadSentenceProgress(): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared)
        ? parsed.cleared.filter((s: unknown) => typeof s === 'string')
        : [],
      current:
        parsed.current && typeof parsed.current === 'object'
          ? {
              keyword: String(parsed.current.keyword ?? ''),
              correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
              blood:
                typeof parsed.current.blood === 'number'
                  ? parsed.current.blood
                  : STAGE_BLOOD,
            }
          : null,
    };
  } catch {
    return { ...INITIAL_PROGRESS };
  }
}

export function saveSentenceProgress(p: FeihuaProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // 静默失败
  }
}

export function markSentenceCleared(keyword: string): FeihuaProgress {
  const p = loadSentenceProgress();
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveSentenceProgress(p);
    return p;
  }
  p.cleared.push(keyword);
  const levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) {
    p.unlockedIndex = levelNum;
  }
  p.current = null;
  saveSentenceProgress(p);
  return p;
}

export function beginSentenceStage(keyword: string): FeihuaProgress {
  const p = loadSentenceProgress();
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveSentenceProgress(p);
  return p;
}

export function commitSentenceCorrect(keyword: string, line: string): FeihuaProgress {
  const p = loadSentenceProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveSentenceProgress(p);
  return p;
}

export function commitSentenceBlood(keyword: string, blood: number): FeihuaProgress {
  const p = loadSentenceProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveSentenceProgress(p);
  return p;
}

export function clearSentenceCurrent(): FeihuaProgress {
  const p = loadSentenceProgress();
  p.current = null;
  saveSentenceProgress(p);
  return p;
}
