// 飞花令进度持久化（localStorage）。
// 失败静默：localStorage 在 SSR / 隐私模式 / 配额满时可能抛错，统一兜底到 INITIAL_PROGRESS。
//
// 语料库分桶（Task 6）：
//   - tang 用旧 key（'shiwen-feihua-progress'），保留既有用户进度。
//   - primary / both 用 '${STORAGE_KEY}:${corpus}' 后缀 key。
//   - tang 首次读取时若新 key 为空，回退到旧 key 做一次性迁移（读旧、写新）。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import { KEYWORDS } from './keywords';
import type { Corpus } from '../state/corpus';

const STORAGE_KEY = 'shiwen-feihua-progress';
const LEGACY_KEY = 'shiwen-feihua-progress'; // tang 的旧 key（无后缀）

function storageKey(corpus: Corpus): string {
  return corpus === 'tang' ? STORAGE_KEY : `${STORAGE_KEY}:${corpus}`;
}

export function loadProgress(corpus: Corpus = 'tang'): FeihuaProgress {
  try {
    const key = storageKey(corpus);
    let raw = window.localStorage.getItem(key);
    // 一次性迁移：tang 新 key 与旧 key 相同，无需迁移；其他 corpus 旧 key 本就不存在。
    // （此处保留兼容入口，未来 STORAGE_KEY 与 LEGACY_KEY 分离时可启用。）
    if (!raw && corpus === 'tang' && LEGACY_KEY !== STORAGE_KEY) {
      raw = window.localStorage.getItem(LEGACY_KEY);
    }
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

export function saveProgress(p: FeihuaProgress, corpus: Corpus = 'tang'): void {
  try {
    window.localStorage.setItem(storageKey(corpus), JSON.stringify(p));
  } catch {
    // localStorage 不可用或配额满 — 静默失败
  }
}

export function markCleared(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadProgress(corpus);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  // unlockedIndex = max(已解锁序号, 该字在 KEYWORDS 中的位置 + 1)
  const idx = KEYWORDS.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null; // 通关清空 current
  saveProgress(p, corpus);
  return p;
}

export function beginStage(keyword: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadProgress(corpus);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p, corpus);
  return p;
}

export function commitStageCorrect(keyword: string, line: string, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p, corpus);
  return p;
}

export function commitStageBlood(keyword: string, blood: number, corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p, corpus);
  return p;
}

export function clearCurrent(corpus: Corpus = 'tang'): FeihuaProgress {
  const p = loadProgress(corpus);
  p.current = null;
  saveProgress(p, corpus);
  return p;
}
