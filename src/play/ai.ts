// AI 对战纯函数：构建题板 + AI 选句 + 抛硬币先后手。
// 与 pickStageQuestion 不同：本模块不做挖空，做“题板四选一”。

import { getVersesFor } from './engine';
import { DIFFICULTY_META, type Difficulty, type Verse } from './types';

// 从题库排除已用句，随机抽 min(count, available) 个返回。
// available < 1 返回 []（玩家入局即负 — 由 caller 决策胜负）。
export function buildChoiceBoard(
  used: Set<string>,
  keyword: string,
  count: number = 4,
): Verse[] {
  const pool = getVersesFor(keyword).filter((v) => !used.has(v.line));
  const n = Math.min(count, pool.length);
  if (n <= 0) return [];
  // Fisher-Yates 洗前 n 个
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// AI 按难度概率决定答出 / 漏答。答出时从题库排除 used 随机抽 1 句。
// 漏答时 caller 判 AI 负（玩家胜）。
export function aiPickAnswer(
  keyword: string,
  used: Set<string>,
  difficulty: Difficulty,
): { picked: boolean; verse?: Verse } {
  const pool = getVersesFor(keyword).filter((v) => !used.has(v.line));
  if (pool.length === 0) return { picked: false };

  const missRate = DIFFICULTY_META[difficulty].missRate;
  if (Math.random() < missRate) return { picked: false };

  const verse = pool[Math.floor(Math.random() * pool.length)];
  return { picked: true, verse };
}

// 50/50 决定玩家先 / AI 先。
export function rollFirstTurn(): 'player' | 'ai' {
  return Math.random() < 0.5 ? 'player' : 'ai';
}
