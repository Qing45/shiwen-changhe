// 飞花令核心数据类型。

export interface Verse {
  poemId: string;
  line: string;
  poemTitle: string;
  poetName: string;
}

// AI 对战难度（Plan 2 用，本 Plan 仅声明）
export type Difficulty = 'qingdeng' | 'mohe' | 'shisheng';

// 单关进度：已答对的句子 + 剩余血量
export interface StageProgress {
  keyword: string;
  correct: string[];   // 已答对的诗句原文（line 字段）
  blood: number;       // 剩余血量（0-3）
}

// 整个飞花令进度
export interface FeihuaProgress {
  unlockedIndex: number;                  // 当前解锁到第几关（0-49）
  cleared: string[];                      // 已通关关键字清单
  current: StageProgress | null;          // 当前进行中的局（断点续传）
}

export const INITIAL_PROGRESS: FeihuaProgress = {
  unlockedIndex: 0,
  cleared: [],
  current: null,
};

export const STAGE_GOAL = 5;       // 每关需答出的不重复诗句数
export const STAGE_BLOOD = 3;      // 每局初始血量
export const STAGE_TIMEBOX = 120;  // 每题限时（秒）

// ============ AI 对战（Plan 2）============
// 三档难度漏答概率 + 思考时间（毫秒），与 spec §3.2 / §2.2 一致。
export const DIFFICULTY_META: Record<Difficulty, { label: string; missRate: number; thinkMs: number }> = {
  qingdeng: { label: '青灯', missRate: 0.30, thinkMs: 3000 },
  mohe:     { label: '墨客', missRate: 0.10, thinkMs: 1500 },
  shisheng: { label: '诗圣', missRate: 0.00, thinkMs: 800  },
};

// AI 对战战绩（按难度分胜负数）。localStorage 键：shiwen-feihua-record。
export interface CombatRecord {
  qingdeng: { win: number; lose: number };
  mohe:     { win: number; lose: number };
  shisheng: { win: number; lose: number };
}

export const INITIAL_RECORD: CombatRecord = {
  qingdeng: { win: 0, lose: 0 },
  mohe:     { win: 0, lose: 0 },
  shisheng: { win: 0, lose: 0 },
};
