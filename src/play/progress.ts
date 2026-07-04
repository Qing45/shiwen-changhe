// 飞花令进度持久化（localStorage）。
// 失败静默：localStorage 在 SSR / 隐私模式 / 配额满时可能抛错，统一兜底到 INITIAL_PROGRESS。

import { INITIAL_PROGRESS, STAGE_BLOOD, type FeihuaProgress } from './types';
import { KEYWORDS } from './keywords';

const STORAGE_KEY = 'shiwen-feihua-progress';

export function loadProgress(): FeihuaProgress {
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

export function saveProgress(p: FeihuaProgress): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // localStorage 不可用或配额满 — 静默失败
  }
}

export function markCleared(keyword: string): FeihuaProgress {
  const p = loadProgress();
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveProgress(p);
    return p;
  }
  p.cleared.push(keyword);
  // unlockedIndex = max(已解锁序号, 该字在 KEYWORDS 中的位置 + 1)
  const idx = KEYWORDS.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null; // 通关清空 current
  saveProgress(p);
  return p;
}

export function beginStage(keyword: string): FeihuaProgress {
  const p = loadProgress();
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p);
  return p;
}

export function commitStageCorrect(keyword: string, line: string): FeihuaProgress {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p);
  return p;
}

export function commitStageBlood(keyword: string, blood: number): FeihuaProgress {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p);
  return p;
}

export function clearCurrent(): FeihuaProgress {
  const p = loadProgress();
  p.current = null;
  saveProgress(p);
  return p;
}
