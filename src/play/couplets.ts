// 飞花令 · 整句（联句）模式。
// 把每首诗按 splitIntoLines 切出的相邻两行配对成 (上句, 下句)。
// 整句模式不绑关键字：关数按句长分档。
//   tang/default：entry(1-10, 5字) / mid(11-30, 7字) / advanced(31-50, 任意)
//   primary：entry(1-10, 5字) / mid(11-30, 7字)（无 advanced 关，因为教材句子总数有限）

import { getPoet } from '../data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import { getPoemsForPlay } from '../data/grades';
import type { PoemCorpus } from '../types';
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

// 由关卡序号（1..50）推导所属档位。
// 注意：这是 tang 历史布局的固定映射（entry 1-10 / mid 11-30 / advanced 31-50）。
// primary 等动态关数请用 tierOfAvailableLevel，它基于当前 (corpus, band) 实际池子。
export function tierOfLevel(level: number): LevelTier {
  if (level <= 10) return 'entry';
  if (level <= 30) return 'mid';
  return 'advanced';
}

// 语料分桶缓存：(corpus + band) → pools。
// band 可选：未传时按 corpus 自身（tang/both 用全量；primary 用全部 primary 诗）。
// key 用字符串拼接，避免不同 (corpus, band) 组合互相污染。
function cacheKey(corpus: PoemCorpus, band?: number): string {
  return band == null ? corpus : `${corpus}:${band}`;
}

const _allPairsCacheByCorpus = new Map<string, CoupletPair[]>();
const _shortPoolCacheByCorpus = new Map<string, CoupletPair[]>();
const _longPoolCacheByCorpus = new Map<string, CoupletPair[]>();

// 扫描所有诗（默认 tang 语料），按相邻两行配对成 (上句, 下句)。
// 上下句去标点后字数必须一致 —— 否则序言、注释、长序等会混进池子，
// 导致题目（上句）和选项（下句）字数不等，玩家靠"挑短/长"就能蒙对。
export function buildAllCouplets(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const poems = getPoemsForPlay(corpus, band);
  const out: CoupletPair[] = [];
  for (const poem of poems) {
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
        corpus: poem.corpus,
      };
      const lower: Verse = {
        poemId: poem.id,
        line: lowerLine,
        poemTitle: poem.title,
        poetName: poet.name,
        corpus: poem.corpus,
      };
      out.push({ upper, lower });
    }
  }
  return out;
}

export function getAllCouplets(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_allPairsCacheByCorpus.has(key)) {
    _allPairsCacheByCorpus.set(key, buildAllCouplets(corpus, band));
  }
  return _allPairsCacheByCorpus.get(key)!;
}

function getShortPool(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_shortPoolCacheByCorpus.has(key)) {
    _shortPoolCacheByCorpus.set(
      key,
      getAllCouplets(corpus, band).filter((p) => stripPunct(p.lower.line).length === 5),
    );
  }
  return _shortPoolCacheByCorpus.get(key)!;
}

function getLongPool(corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  const key = cacheKey(corpus, band);
  if (!_longPoolCacheByCorpus.has(key)) {
    _longPoolCacheByCorpus.set(
      key,
      getAllCouplets(corpus, band).filter((p) => stripPunct(p.lower.line).length === 7),
    );
  }
  return _longPoolCacheByCorpus.get(key)!;
}

function getPoolForTier(tier: LevelTier, corpus: PoemCorpus = 'tang', band?: number): CoupletPair[] {
  if (tier === 'entry') return getShortPool(corpus, band);
  if (tier === 'mid') return getLongPool(corpus, band);
  return getAllCouplets(corpus, band);
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
  corpus: PoemCorpus = 'tang',
  band?: number,
): SentenceQuestion | null {
  const pool = getPoolForTier(tier, corpus, band).filter((p) => !usedUpperLines.has(p.upper.line));
  if (pool.length === 0) return null;

  const correct = pool[Math.floor(_rng() * pool.length)];
  const correctLen = stripPunct(correct.lower.line).length;

  const allPairs = getAllCouplets(corpus, band);
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

// 动态关数：根据当前 (corpus, band) 池子算出每档实际能出多少题。
// 每个候选上句需要至少 3 个同字数的下句干扰项（来自不同诗）才能凑出题目。

export interface SentenceLevelGroup {
  tier: LevelTier;
  start: number;
  end: number;
  count: number;
}

const TIER_CAPS: Record<LevelTier, number> = {
  entry: 10,
  mid: 20,
  advanced: 20,
};

function canMakeQuestion(pair: CoupletPair, allPairs: CoupletPair[]): boolean {
  const correctLen = stripPunct(pair.lower.line).length;
  const seen = new Set<string>([pair.lower.line]);
  let count = 0;
  for (const candidate of allPairs) {
    if (candidate.lower.poemId === pair.lower.poemId) continue;
    if (seen.has(candidate.lower.line)) continue;
    if (stripPunct(candidate.lower.line).length !== correctLen) continue;
    seen.add(candidate.lower.line);
    count++;
    if (count >= 3) return true;
  }
  return false;
}

export function countAvailableLevels(tier: LevelTier, corpus: PoemCorpus = 'tang', band?: number): number {
  if (corpus === 'primary' && tier === 'advanced') return 0;
  const pool = getPoolForTier(tier, corpus, band);
  const allPairs = getAllCouplets(corpus, band);
  const upperLines = new Set<string>();
  for (const pair of pool) {
    if (!canMakeQuestion(pair, allPairs)) continue;
    upperLines.add(pair.upper.line);
  }
  return Math.min(TIER_CAPS[tier], upperLines.size);
}

export function getAvailableLevelGroups(corpus: PoemCorpus = 'tang', band?: number): SentenceLevelGroup[] {
  const tiers: LevelTier[] = corpus === 'primary' ? ['entry', 'mid'] : ['entry', 'mid', 'advanced'];
  const groups: SentenceLevelGroup[] = [];
  let start = 1;
  for (const tier of tiers) {
    const count = countAvailableLevels(tier, corpus, band);
    if (count === 0) continue;
    groups.push({ tier, start, end: start + count - 1, count });
    start += count;
  }
  return groups;
}

export function getTotalAvailableLevels(corpus: PoemCorpus = 'tang', band?: number): number {
  return getAvailableLevelGroups(corpus, band).reduce((sum, group) => sum + group.count, 0);
}

export function tierOfAvailableLevel(level: number, corpus: PoemCorpus = 'tang', band?: number): LevelTier | null {
  return getAvailableLevelGroups(corpus, band).find((group) => level >= group.start && level <= group.end)?.tier ?? null;
}
