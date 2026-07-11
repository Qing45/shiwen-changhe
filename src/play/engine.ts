import { getPoet } from '../data/load';
import { getPoemsForPlay } from '../data/grades';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import { KEYWORDS, KEYWORD_GROUPS } from './keywords';
import { PRIMARY_KEYWORD_GROUPS } from './primaryKeywords';
import { STAGE_GOAL } from './types';
import type { PoemCorpus } from '../types';
import type { Verse } from './types';

type KeywordTier = 'entry' | 'mid' | 'advanced';

export interface CharKeywordGroup {
  tier: KeywordTier;
  words: readonly string[];
}

function cacheKey(corpus: PoemCorpus, band?: number): string {
  return band == null ? corpus : `${corpus}:${band}`;
}

// 一次性扫描指定语料库（默认 'tang'），构建「关键字 -> 含该字的诗句列表」索引。
// 切句规则：先剥异文 -> 选 mode（短/长）-> splitIntoLines -> 每句独立判定。
// 注：仅扫描 KEYWORDS 中关键字的桶，索引只包含 KEYWORDS 字。其他字符（如
// PRIMARY_KEYWORDS 中的字）的扫描交给 caller 自行实现，或扩展 KEYWORDS。
// 此处保留 50 字 KEYWORDS 桶用于默认 tang/单人闯关玩法。
export function buildKeywordIndex(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const poems = getPoemsForPlay(corpus, band);
  const index = new Map<string, Verse[]>();
  for (const k of KEYWORDS) index.set(k, []);

  for (const poem of poems) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (const line of lines) {
      // 去标点后判定含字，但 line 字段保留原句（含标点）作为题面。
      const stripped = line.replace(/[，。？！；：、,\.\?!;:]/g, '');
      for (const k of KEYWORDS) {
        if (stripped.includes(k)) {
          index.get(k)!.push({
            poemId: poem.id,
            line: line.trim(),
            poemTitle: poem.title,
            poetName: poet.name,
            corpus: poem.corpus,
          });
        }
      }
    }
  }

  return index;
}

// 为 PRIMARY_KEYWORDS 扫描：构建「任意字 -> 含该字的所有诗句」索引（不限 KEYWORDS 桶）。
// primaryKeywords 测试需要查任意字（如 寒/酒/舟 等非 KEYWORDS 字），故不能用上面的
// 仅 KEYWORDS 桶索引。此函数扫描每行所有出现过的字。
export function buildKeywordIndexFullScan(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const poems = getPoemsForPlay(corpus, band);
  const index = new Map<string, Verse[]>();

  for (const poem of poems) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (const line of lines) {
      const stripped = line.replace(/[，。？！；：、,\.\?!;:]/g, '');
      const seen = new Set<string>();
      for (const ch of stripped) {
        if (seen.has(ch)) continue; // 同一行同字只计一次
        seen.add(ch);
        if (!index.has(ch)) index.set(ch, []);
        index.get(ch)!.push({
          poemId: poem.id,
          line: line.trim(),
          poemTitle: poem.title,
          poetName: poet.name,
          corpus: poem.corpus,
        });
      }
    }
  }

  return index;
}

// 模块级懒加载缓存（按 corpus + band 分桶）：首次调用时构建，之后直接返回同一份 Map。
const _fullScanCache = new Map<string, Map<string, Verse[]>>();

// getKeywordIndex 默认走 KEYWORDS 桶（兼容旧 tang 单人闯关玩法）。
const _keywordCache = new Map<string, Map<string, Verse[]>>();

export function getKeywordIndex(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const key = cacheKey(corpus, band);
  if (!_keywordCache.has(key)) _keywordCache.set(key, buildKeywordIndex(corpus, band));
  return _keywordCache.get(key)!;
}

// 全字符索引（PRIMARY_KEYWORDS 查询用）。同时供 getVersesFor(keyword, corpus) 使用，
// 使 primary 语料库的非 KEYWORDS 字（如 寒/酒/舟）也能查到。
export function getKeywordIndexFullScan(corpus: PoemCorpus = 'tang', band?: number): Map<string, Verse[]> {
  const key = cacheKey(corpus, band);
  if (!_fullScanCache.has(key)) _fullScanCache.set(key, buildKeywordIndexFullScan(corpus, band));
  return _fullScanCache.get(key)!;
}

export function getVersesFor(keyword: string, corpus: PoemCorpus = 'tang', band?: number): Verse[] {
  // 若该字属于 KEYWORDS，走桶索引（与历史行为一致）；
  // 否则走全字符索引（覆盖 PRIMARY_KEYWORDS 中的非 KEYWORDS 字）。
  if (KEYWORDS.includes(keyword)) {
    return getKeywordIndex(corpus, band).get(keyword) ?? [];
  }
  return getKeywordIndexFullScan(corpus, band).get(keyword) ?? [];
}

// ============ 自适应关键字组（按 band 过滤） ============

const TANG_CHAR_GROUPS: readonly CharKeywordGroup[] = [
  { tier: 'entry', words: KEYWORD_GROUPS.entry },
  { tier: 'mid', words: KEYWORD_GROUPS.mid },
  { tier: 'advanced', words: KEYWORD_GROUPS.advanced },
];

const PRIMARY_CHAR_GROUPS: readonly CharKeywordGroup[] = [
  { tier: 'entry', words: PRIMARY_KEYWORD_GROUPS.entry },
  { tier: 'mid', words: PRIMARY_KEYWORD_GROUPS.mid },
  { tier: 'advanced', words: PRIMARY_KEYWORD_GROUPS.advanced },
];

export function getCharKeywordGroups(corpus: PoemCorpus = 'tang', band?: number): CharKeywordGroup[] {
  if (corpus !== 'primary') return [...TANG_CHAR_GROUPS];
  return PRIMARY_CHAR_GROUPS
    .map((group) => ({
      tier: group.tier,
      words: group.words.filter((kw) => getVersesFor(kw, 'primary', band).length >= STAGE_GOAL),
    }))
    .filter((group) => group.words.length > 0);
}

export function getCharKeywords(corpus: PoemCorpus = 'tang', band?: number): readonly string[] {
  if (corpus !== 'primary') return KEYWORDS;
  return getCharKeywordGroups('primary', band).flatMap((group) => [...group.words]);
}

export function countAvailableCharStages(corpus: PoemCorpus = 'tang', band?: number): number {
  return getCharKeywords(corpus, band).length;
}

// ============ 单人闯关出题 / 九宫格 / 判定 ============
//
// 关于标点的说明（Task 2 review #1 的处理）：
//   Verse.line 保留原句标点（用于题面展示）。本模块的处理策略：
//   - pickStageQuestion: 不在标点位置上挖空（标点不该作为玩家输入字符）。
//   - validateStageInput: 直接按字符索引逐位比较，原句与挖空位用的是同一份 line，
//     所以标点天然被排除在外（不会出现在 blanks 中），无需额外 strip。
//   - buildNineGrid:   答案只取 blanks 位置的字，不会包含标点。

const DISTRACTOR_POOL_SOURCE =
  '一二三四五六七八九十百千万里外古今南北东西上下左右中青山河颜色红绿黄白青紫玉石金铁风雨霜露天地秋冬夏时光影梦魂';

const DISTRACTOR_POOL = Array.from(new Set(DISTRACTOR_POOL_SOURCE.split(''))).join('');

const PUNCT_RE = /[，。？！；：、,\.\?!;:]/;

// 抽一句未答过的，挖 2-3 字（必含关键字位置）。
// pool 为空时返回 null —— 不会因笛/桥等仅 5 句的小池崩溃（caller 通过 used 控制）。
export function pickStageQuestion(
  keyword: string,
  used: Set<string>,
  corpus: PoemCorpus = 'tang',
  band?: number,
): { verse: Verse; blanks: number[] } | null {
  const pool = getVersesFor(keyword, corpus, band).filter(v => !used.has(v.line));
  if (pool.length === 0) return null;
  const verse = pool[Math.floor(Math.random() * pool.length)];

  // 关键字在原句中的所有出现位置
  const kwPositions: number[] = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (verse.line[i] === keyword) kwPositions.push(i);
  }
  // 关键字至少挖一处（取第一处，保证玩家必须填出关键字）
  const blanks = new Set<number>([kwPositions[0]]);

  // 候选拆空位：非关键字、非标点
  const candidates: number[] = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (kwPositions.includes(i)) continue;
    if (PUNCT_RE.test(verse.line[i])) continue;
    candidates.push(i);
  }
  // Fisher-Yates 洗牌
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  // 额外挖 1 或 2 处，凑成 2-3 空（含关键字位）
  const extra = candidates.length === 0 ? 0 : Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < extra && i < candidates.length; i++) {
    blanks.add(candidates[i]);
  }

  return { verse, blanks: Array.from(blanks).sort((a, b) => a - b) };
}

// 构建 12 字块：blanks 位置的答案字 + 干扰字，洗牌返回。
// 干扰字不与答案字（任一位置）重复、彼此不重复。
export function buildNineGrid(
  answer: string,
  blanks: number[],
): { chars: string[]; blankCount: number } {
  const answerChars = blanks.map(i => answer[i]);
  const distractors: string[] = [];
  let attempts = 0;
  const maxAttempts = DISTRACTOR_POOL.length * 20;
  while (
    distractors.length < 12 - blanks.length &&
    attempts < maxAttempts
  ) {
    const c = DISTRACTOR_POOL[Math.floor(Math.random() * DISTRACTOR_POOL.length)];
    if (!answer.includes(c) && !distractors.includes(c)) {
      distractors.push(c);
    }
    attempts++;
  }
  if (distractors.length !== 12 - blanks.length) {
    throw new Error('九宫格去重失败');
  }

  const all = [...answerChars, ...distractors];
  for (let j = all.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    [all[j], all[k]] = [all[k], all[j]];
  }
  return { chars: all, blankCount: blanks.length };
}

// 玩家拼出的字串按 blanks 顺序回填后是否等于原句对应位置的字。
// 注：blanks 由 pickStageQuestion 生成，仅指向非标点位置，因此直接逐位比较即可。
export function validateStageInput(
  filled: string,
  answer: string,
  blanks: number[],
): boolean {
  if (filled.length !== blanks.length) return false;
  for (let i = 0; i < blanks.length; i++) {
    if (answer[blanks[i]] !== filled[i]) return false;
  }
  return true;
}
