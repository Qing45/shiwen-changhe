// 整句模式进度持久化（独立 localStorage）。
// 与单字模式的 progress.ts 结构相同，但 storageKey 不同，两套进度互不影响。
//
// 语料库分桶：
//   - tang 用旧 key（'shiwen-feihua-sentence-progress'），保留既有用户进度。
//   - primary / both / all 用 '${STORAGE_KEY}:${corpus}' 后缀 key。
//
// 小学年级分桶：
//   - corpus === 'primary' && band !== MAX_BAND 时，key 追加 ':g{band}'，按年级端点隔离。
//   - tang / all / primary band === MAX_BAND（或未传 band）都走原 key。
// 初中段分桶：
//   - corpus === 'junior' && band !== '9b' 时，key 追加 ':g{band}'，按学期端点隔离。
//   - junior band === '9b' 或未传 band 都走 base key。
// 高中段分桶：
//   - corpus === 'senior' && band !== 'gz3l' 时，key 追加 ':g{band}'，按学期端点隔离。
//   - senior band === 'gz3l' 或未传 band 都走 base key。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import type { Corpus } from '../state/corpus';
import { MAX_BAND } from '../data/grades';

const STORAGE_KEY = 'shiwen-feihua-sentence-progress';
const JUNIOR_MAX_BAND = '9b';
const SENIOR_MAX_BAND = 'gz3l';

function storageKey(corpus: Corpus, band?: number | string | string): string {
  if (corpus === 'tang') return STORAGE_KEY;
  const base = `${STORAGE_KEY}:${corpus}`;
  if (corpus === 'junior') {
    if (band == null || band === JUNIOR_MAX_BAND) return base;
    return `${base}:g${band}`;
  }
  if (corpus === 'senior') {
    if (band == null || band === SENIOR_MAX_BAND) return base;
    return `${base}:g${band}`;
  }
  if (corpus !== 'primary' || band == null || band === MAX_BAND) return base;
  return `${base}:g${band}`;
}

export function loadSentenceProgress(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(corpus, band));
    // cleared 必须返回全新数组 —— 否则 caller 的 push 会污染共享的 INITIAL_PROGRESS.cleared。
    if (!raw) return { ...INITIAL_PROGRESS, cleared: [], usedItems: [] };
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
              blood: typeof parsed.current.blood === 'number' ? parsed.current.blood : STAGE_BLOOD,
            }
          : null,
      usedItems: Array.isArray(parsed.usedItems)
        ? parsed.usedItems.filter((s: unknown) => typeof s === 'string')
        : [],
    };
  } catch {
    return { ...INITIAL_PROGRESS, cleared: [], usedItems: [] };
  }
}

export function saveSentenceProgress(p: FeihuaProgress, corpus: Corpus = 'tang', band?: number | string): void {
  try {
    window.localStorage.setItem(storageKey(corpus, band), JSON.stringify(p));
  } catch {
    // 静默失败
  }
}

export function markSentenceCleared(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveSentenceProgress(p, corpus, band);
    return p;
  }
  p.cleared.push(keyword);
  const levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) {
    p.unlockedIndex = levelNum;
  }
  p.current = null;
  saveSentenceProgress(p, corpus, band);
  return p;
}

export function beginSentenceStage(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveSentenceProgress(p, corpus, band);
  return p;
}

export function commitSentenceCorrect(keyword: string, line: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveSentenceProgress(p, corpus, band);
  return p;
}

export function commitSentenceBlood(keyword: string, blood: number, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveSentenceProgress(p, corpus, band);
  return p;
}

export function clearSentenceCurrent(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  p.current = null;
  saveSentenceProgress(p, corpus, band);
  return p;
}

// 追加"已出过的上句"到跨关卡共享去重集。50 关共享同一 couplets 池，
// 调用方在 answer 题/答错换题时调，避免不同关卡随机到同一上句。
export function addSentenceUsedItem(upperLine: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadSentenceProgress(corpus, band);
  if (!p.usedItems.includes(upperLine)) {
    p.usedItems.push(upperLine);
    saveSentenceProgress(p, corpus, band);
  }
  return p;
}
