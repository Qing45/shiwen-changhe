import { getPoems, getPoet } from '../data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import { KEYWORDS } from './keywords';
import type { Verse } from './types';

// 一次性扫描 320 首诗，构建「关键字 -> 含该字的诗句列表」索引。
// 切句规则：先剥异文 -> 选 mode（短/长）-> splitIntoLines -> 每句独立判定。
export function buildKeywordIndex(): Map<string, Verse[]> {
  const index = new Map<string, Verse[]>();
  for (const k of KEYWORDS) index.set(k, []);

  for (const poem of getPoems()) {
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
          });
        }
      }
    }
  }

  return index;
}

// 模块级懒加载缓存：首次调用时构建，之后直接返回同一份 Map。
let _cache: Map<string, Verse[]> | null = null;

export function getKeywordIndex(): Map<string, Verse[]> {
  if (_cache === null) _cache = buildKeywordIndex();
  return _cache;
}

export function getVersesFor(keyword: string): Verse[] {
  return getKeywordIndex().get(keyword) ?? [];
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
): { verse: Verse; blanks: number[] } | null {
  const pool = getVersesFor(keyword).filter(v => !used.has(v.line));
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
