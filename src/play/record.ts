// AI 对战战绩持久化（localStorage）。
// 与 progress.ts 风格一致：失败静默降级到 INITIAL_RECORD。

import { INITIAL_RECORD, type CombatRecord, type Difficulty } from './types';

const STORAGE_KEY = 'shiwen-feihua-record';

function emptyBucket(): { win: number; lose: number } {
  return { win: 0, lose: 0 };
}

function normalizeRecord(parsed: unknown): CombatRecord {
  const base: Record<string, { win: number; lose: number }> = {
    qingdeng: emptyBucket(),
    mohe: emptyBucket(),
    shisheng: emptyBucket(),
  };
  if (parsed && typeof parsed === 'object') {
    for (const key of ['qingdeng', 'mohe', 'shisheng'] as const) {
      const slot = (parsed as Record<string, unknown>)[key];
      if (slot && typeof slot === 'object') {
        const win =
          typeof (slot as Record<string, unknown>).win === 'number'
            ? (slot as Record<string, number>).win
            : 0;
        const lose =
          typeof (slot as Record<string, unknown>).lose === 'number'
            ? (slot as Record<string, number>).lose
            : 0;
        base[key] = { win, lose };
      }
    }
  }
  return base as unknown as CombatRecord;
}

export function loadRecord(): CombatRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_RECORD, ...{ qingdeng: emptyBucket(), mohe: emptyBucket(), shisheng: emptyBucket() } };
    const parsed = JSON.parse(raw);
    return normalizeRecord(parsed);
  } catch {
    return normalizeRecord(null);
  }
}

export function saveRecord(r: CombatRecord): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
  } catch {
    // 静默失败
  }
}

function bump(difficulty: Difficulty, field: 'win' | 'lose'): CombatRecord {
  const r = loadRecord();
  const slot = r[difficulty];
  const next: CombatRecord = {
    ...r,
    [difficulty]: { win: slot.win, lose: slot.lose, [field]: slot[field] + 1 },
  };
  saveRecord(next);
  return next;
}

export function recordWin(difficulty: Difficulty): CombatRecord {
  return bump(difficulty, 'win');
}

export function recordLoss(difficulty: Difficulty): CombatRecord {
  return bump(difficulty, 'lose');
}
