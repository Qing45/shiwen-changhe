// 整句模式进度持久化（独立 localStorage）。
// 与单字模式的 progress.ts 结构相同，但 storageKey 不同，两套进度互不影响。
//
// 语料库分桶（Task 6）：
//   - tang 用旧 key（'shiwen-feihua-sentence-progress'），保留既有用户进度。
//   - primary / both 用 '${STORAGE_KEY}:${corpus}' 后缀 key。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import type { Corpus } from '../state/corpus';

const STORAGE_KEY = 'shiwen-feihua-sentence-progress';

function storageKey(corpus: Corpus): string {
  return corpus === 'tang' ? STORAGE_KEY : `${STORAGE_KEY}:${corpus}`;
}

export function loadSentenceProgress(corpus: Corpus = 'tang'): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(corpus));
    // cleared 必须返回全新数组 —— 否则 caller 的 push 会污染共享的 INITIAL_PROGRESS.cleared。
    if (!raw) return { ...INITIAL_PROGRESS, cleared: [] };
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
    return { ...INITIAL_PROGRESS, cleared: [] };
  }
}

export function saveSentenceProgress(p: FeihuaProgress, corpus: Corpus = 'tang'): void {
  try {
    window.localStorage.setItem(storageKey(corpus), JSON.stringify(p));
  } catch {
    // 静默失败
  }
}

export function markSentenceCleared(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadSentenceProgress(corpus);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveSentenceProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  const levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) {
    p.unlockedIndex = levelNum;
  }
  p.current = null;
  saveSentenceProgress(p, corpus);
  return p;
}

export function beginSentenceStage(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadSentenceProgress(corpus);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveSentenceProgress(p, corpus);
  return p;
}

export function commitSentenceCorrect(keyword: string, line: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadSentenceProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveSentenceProgress(p, corpus);
  return p;
}

export function commitSentenceBlood(keyword: string, blood: number, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadSentenceProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveSentenceProgress(p, corpus);
  return p;
}

export function clearSentenceCurrent(corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadSentenceProgress(corpus);
  p.current = null;
  saveSentenceProgress(p, corpus);
  return p;
}
