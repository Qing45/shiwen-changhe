// 飞花令 · 整句（联句）模式。
// 把每首诗按 splitIntoLines 切出的相邻两行配对成 (上句, 下句)。
// 整句模式不绑关键字：50 关按句长分三档：
//   entry（1-10 关）下句去标点后 5 字
//   mid（11-30 关）下句去标点后 7 字
//   advanced（31-50 关）任意句长

import { getPoems, getPoet } from '../data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import type { Verse } from './types';

export interface CoupletPair {
  upper: Verse;
  lower: Verse;
}

export interface SentenceQuestion {
  upper: Verse;
  answer: Verse;
  options: Verse[];   // 4 个下句选项，含正确答案，已洗牌
}

export type LevelTier = 'entry' | 'mid' | 'advanced';

const PUNCT_RE = /[，。？！；：、,\.\?!;:]/g;

function stripPunct(s: string): string {
  return s.replace(PUNCT_RE, '');
}

// 由关卡序号（1..50）推导所属档位
export function tierOfLevel(level: number): LevelTier {
  if (level <= 10) return 'entry';
  if (level <= 30) return 'mid';
  return 'advanced';
}

let _allPairsCache: CoupletPair[] | null = null;
let _shortPoolCache: CoupletPair[] | null = null;
let _longPoolCache: CoupletPair[] | null = null;

// 扫描所有诗，按相邻两行配对成 (上句, 下句)。
// 上下句去标点后字数必须一致 —— 否则序言、注释、长序等会混进池子，
// 导致题目（上句）和选项（下句）字数不等，玩家靠"挑短/长"就能蒙对。
export function buildAllCouplets(): CoupletPair[] {
  const out: CoupletPair[] = [];
  for (const poem of getPoems()) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (let i = 0; i + 1 < lines.length; i += 2) {
      const upperLine = lines[i].trim();
      const lowerLine = lines[i + 1].trim();
      if (!upperLine || !lowerLine) continue;
      if (stripPunct(upperLine).length !== stripPunct(lowerLine).length) continue;

      const upper: Verse = {
        poemId: poem.id,
        line: upperLine,
        poemTitle: poem.title,
        poetName: poet.name,
      };
      const lower: Verse = {
        poemId: poem.id,
        line: lowerLine,
        poemTitle: poem.title,
        poetName: poet.name,
      };
      out.push({ upper, lower });
    }
  }
  return out;
}

export function getAllCouplets(): CoupletPair[] {
  if (_allPairsCache === null) _allPairsCache = buildAllCouplets();
  return _allPairsCache;
}

function getShortPool(): CoupletPair[] {
  if (_shortPoolCache === null) {
    _shortPoolCache = getAllCouplets().filter((p) => stripPunct(p.lower.line).length === 5);
  }
  return _shortPoolCache;
}

function getLongPool(): CoupletPair[] {
  if (_longPoolCache === null) {
    _longPoolCache = getAllCouplets().filter((p) => stripPunct(p.lower.line).length === 7);
  }
  return _longPoolCache;
}

function getPoolForTier(tier: LevelTier): CoupletPair[] {
  if (tier === 'entry') return getShortPool();
  if (tier === 'mid') return getLongPool();
  return getAllCouplets();
}

let _rng: () => number = Math.random;

export function _setRng(rng: () => number): void {
  _rng = rng;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 取题：根据关卡档位选正确答案，从全局池抽 3 个不同诗的干扰。
// 干扰项字数必须与正确答案一致（去标点后），否则玩家靠"挑短/长句"就能蒙对。
// usedUpperLines 用于排除已答过的上句，避免重复出题。
export function pickLevelQuestion(
  tier: LevelTier,
  usedUpperLines: Set<string>,
): SentenceQuestion | null {
  const pool = getPoolForTier(tier).filter((p) => !usedUpperLines.has(p.upper.line));
  if (pool.length === 0) return null;

  const correct = pool[Math.floor(_rng() * pool.length)];
  const correctLen = stripPunct(correct.lower.line).length;

  const allPairs = getAllCouplets();
  const distractors: Verse[] = [];
  const seenLines = new Set<string>([correct.lower.line]);

  let attempts = 0;
  while (distractors.length < 3 && attempts < 200) {
    const candidate = allPairs[Math.floor(_rng() * allPairs.length)];
    if (
      candidate.lower.poemId !== correct.lower.poemId &&
      !seenLines.has(candidate.lower.line) &&
      stripPunct(candidate.lower.line).length === correctLen
    ) {
      distractors.push(candidate.lower);
      seenLines.add(candidate.lower.line);
    }
    attempts++;
  }

  // 兜底：从同档池补（advanced 池里仍可能有其他句长，需要长度校验）
  if (distractors.length < 3) {
    for (const p of pool) {
      if (p.upper.line === correct.upper.line) continue;
      if (seenLines.has(p.lower.line)) continue;
      if (stripPunct(p.lower.line).length !== correctLen) continue;
      distractors.push(p.lower);
      seenLines.add(p.lower.line);
      if (distractors.length === 3) break;
    }
  }

  if (distractors.length < 3) return null;

  const options = shuffle([correct.lower, ...distractors]);
  return { upper: correct.upper, answer: correct.lower, options };
}

