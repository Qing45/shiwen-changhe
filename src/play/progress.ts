// 飞花令进度持久化（localStorage）。
// 失败静默：localStorage 在 SSR / 隐私模式 / 配额满时可能抛错，统一兜底到 INITIAL_PROGRESS。
//
// 语料库分桶（Task 6）：
//   - tang 用旧 key（'shiwen-feihua-progress'），保留既有用户进度。
//   - primary / both 用 '${STORAGE_KEY}:${corpus}' 后缀 key。
//   - tang 首次读取时若新 key 为空，回退到旧 key 做一次性迁移（读旧、写新）。
//
// 小学年级分桶（Task 5）：
//   - corpus === 'primary' && band !== MAX_BAND 时，key 追加 ':g{band}'，按年级端点隔离。
//   - tang / all / primary band === MAX_BAND（或未传 band）都走原 key。
// 初中段分桶：
//   - corpus === 'junior' && band !== '9b' 时，key 追加 ':g{band}'，按学期端点隔离。
//   - junior band === '9b'（=全部 86 首累积）或未传 band 都走 base key。
// 高中段分桶：
//   - corpus === 'senior' && band !== 'gz3l' 时，key 追加 ':g{band}'，按学期端点隔离。
//   - senior band === 'gz3l'（=全部 41 首累积）或未传 band 都走 base key。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import { getCharKeywords } from './engine';
import type { Corpus } from '../state/corpus';
import { MAX_BAND } from '../data/grades';

const STORAGE_KEY = 'shiwen-feihua-progress';
const LEGACY_KEY = 'shiwen-feihua-progress'; // tang 的旧 key（无后缀）
const JUNIOR_MAX_BAND = '9b';
const SENIOR_MAX_BAND = 'gz3l';

function storageKey(corpus: Corpus, band?: number | string): string {
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

export function loadProgress(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  try {
    const key = storageKey(corpus, band);
    let raw = window.localStorage.getItem(key);
    // 一次性迁移：tang 新 key 与旧 key 相同，无需迁移；其他 corpus 旧 key 本就不存在。
    // （此处保留兼容入口，未来 STORAGE_KEY 与 LEGACY_KEY 分离时可启用。）
    if (!raw && corpus === 'tang' && LEGACY_KEY !== STORAGE_KEY) {
      raw = window.localStorage.getItem(LEGACY_KEY);
    }
    // cleared 必须返回全新数组 —— 否则 caller (markCleared/beginStage) 的 push
    // 会污染共享的 INITIAL_PROGRESS.cleared，导致跨 corpus 串数据。
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
              blood:
                typeof parsed.current.blood === 'number'
                  ? parsed.current.blood
                  : STAGE_BLOOD,
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

export function saveProgress(p: FeihuaProgress, corpus: Corpus = 'tang', band?: number | string): void {
  try {
    window.localStorage.setItem(storageKey(corpus, band), JSON.stringify(p));
  } catch {
    // localStorage 不可用或配额满 — 静默失败
  }
}

export function markCleared(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveProgress(p, corpus, band);
    return p;
  }
  p.cleared.push(keyword);
  // unlockedIndex 必须用过滤后的 charKeywords 算 idx —— PlayHall 的 stateOf 也用它。
  // 旧实现用未过滤的 PRIMARY_KEYWORDS/KEYWORDS，band 过滤剔除某些字后两端 idx 错位，
  // 会出现「已通关该字但下一字仍 locked」的卡死。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  const keywordList = getCharKeywords(poemCorpus, band);
  const idx = keywordList.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null; // 通关清空 current
  saveProgress(p, corpus, band);
  return p;
}

export function beginStage(keyword: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p, corpus, band);
  return p;
}

export function commitStageCorrect(keyword: string, line: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p, corpus, band);
  return p;
}

export function commitStageBlood(keyword: string, blood: number, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p, corpus, band);
  return p;
}

export function clearCurrent(corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  p.current = null;
  saveProgress(p, corpus, band);
  return p;
}

// 追加一个"已问过"标识到跨关卡共享的去重集（sentence 存上句、title 存 poemId）。
// 已存在则 no-op，保证 usedItems 元素唯一。供 caller 在 answer 题或答错换题时调用。
export function addUsedItem(item: string, corpus: Corpus = 'tang', band?: number | string): FeihuaProgress {
  const p = loadProgress(corpus, band);
  if (!p.usedItems.includes(item)) {
    p.usedItems.push(item);
    saveProgress(p, corpus, band);
  }
  return p;
}
