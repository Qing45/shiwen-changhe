// 整篇识名模式进度持久化（独立 localStorage）。
// 与 sentenceProgress.ts 结构相同，storageKey 不同，三套进度互不影响（char/sentence/title）。
//
// 语料库分桶：
//   - tang 用旧 key（'shiwen-feihua-title-progress'），保留既有用户进度。
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

const STORAGE_KEY = 'shiwen-feihua-title-progress';
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

export function loadTitleProgress(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  try {
    const raw = window.localStorage.getItem(storageKey(corpus, band));
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

export function saveTitleProgress(p: FeihuaProgress, corpus: Corpus = 'tang', band?: number | string): void {
  try {
    window.localStorage.setItem(storageKey(corpus, band), JSON.stringify(p));
  } catch {
    // 静默失败
  }
}

export function markTitleCleared(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveTitleProgress(p, corpus, band);
    return p;
  }
  p.cleared.push(keyword);
  const levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) {
    p.unlockedIndex = levelNum;
  }
  p.current = null;
  saveTitleProgress(p, corpus, band);
  return p;
}

export function beginTitleStage(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveTitleProgress(p, corpus, band);
  return p;
}

export function commitTitleCorrect(keyword: string, line: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveTitleProgress(p, corpus, band);
  return p;
}

export function commitTitleBlood(keyword: string, blood: number, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveTitleProgress(p, corpus, band);
  return p;
}

export function clearTitleCurrent(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  p.current = null;
  saveTitleProgress(p, corpus, band);
  return p;
}

// 追加"已出过的诗 id"到跨关卡共享去重集。50 关共享同一诗池，
// 调用方在 answer 题/答错换题时调，避免不同关卡随机到同一首诗。
export function addTitleUsedItem(poemId: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadTitleProgress(corpus, band);
  if (!p.usedItems.includes(poemId)) {
    p.usedItems.push(poemId);
    saveTitleProgress(p, corpus, band);
  }
  return p;
}
