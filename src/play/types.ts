// 飞花令核心数据类型。

import type { PoemCorpus } from '../types';

export interface Verse {
  poemId: string;
  line: string;
  poemTitle: string;
  poetName: string;
  corpus: PoemCorpus;
}

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
