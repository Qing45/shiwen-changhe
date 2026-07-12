// 飞花令 · 整篇识名模式出题引擎。
// 题目：诗正文（去异文括号）；选项：4 个诗名，1 正确 + 3 干扰。
// 干扰项优先选同作者其他诗名，不足 3 个则从候选池随机补足。
// 候选池来自 getPoemsForPlay(corpus, band?)：
//   - tang/both：不传 band 时返回全量
//   - primary：可按年级 band 过滤（band=1 时仅 1 年级，band=MAX_BAND 时全部 primary）

import { extractVariants } from '../utils/poemText';
import { getPoemsForPlay } from '../data/grades';
import type { PoemCorpus } from '../types';

export interface TitleQuestion {
  poemId: string;
  content: string;
  poemTitle: string;
  options: Array<{ id: string; title: string }>;
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

// 候选池：必须有 content（极少数诗可能 content 为空）
function buildPool(corpus: PoemCorpus, band?: number) {
  return getPoemsForPlay(corpus, band).filter(p => p.content && p.content.length > 0);
}

// 整篇模式关数上限：tang 50，primary 30（与句子模式入口档对齐）。
const TITLE_LEVEL_CAP: Record<PoemCorpus, number> = {
  tang: 50,
  primary: 30,
  both: 50,
};

export function countAvailableTitleLevels(corpus: PoemCorpus, band?: number): number {
  const pool = buildPool(corpus, band);
  if (pool.length < 4) return 0;
  // 池子大小即关数：pickTitleQuestion 仅需 4 首诗（1 正确 + 3 干扰），
  // 干扰项在同作者不足时会回退到任意不同诗名，因此池中 4 首诗就够出 1 题。
  return Math.min(TITLE_LEVEL_CAP[corpus], pool.length);
}

export function pickTitleQuestion(
  level: number,
  usedPoemIds: ReadonlySet<string>,
  corpus: PoemCorpus,
  band?: number,
): TitleQuestion | null {
  const pool = buildPool(corpus, band);
  if (pool.length === 0) return null;

  const candidates = pool.filter(p => !usedPoemIds.has(p.id));
  if (candidates.length === 0) return null;

  // 优先选作者有 ≥1 个其他诗的诗，保证同作者干扰能凑出。
  // 100 次尝试失败则降级为任意候选。
  let chosen = candidates[Math.floor(_rng() * candidates.length)];
  for (let i = 0; i < 100; i++) {
    const cand = candidates[Math.floor(_rng() * candidates.length)];
    const others = pool.filter(p => p.poetId === cand.poetId && p.id !== cand.id);
    if (others.length > 0) { chosen = cand; break; }
  }

  // 干扰项：先同作者其他诗名（去重、去自身），不足 3 则从池子随机补足
  const authorOthers = pool.filter(p => p.poetId === chosen.poetId && p.id !== chosen.id);
  const authorTitles = shuffle(authorOthers.map(p => ({ id: p.id, title: p.title })));

  const distractors: Array<{ id: string; title: string }> = [];
  const seenTitles = new Set<string>([chosen.title]);
  for (const t of authorTitles) {
    if (distractors.length >= 3) break;
    if (!seenTitles.has(t.title)) {
      distractors.push(t);
      seenTitles.add(t.title);
    }
  }
  if (distractors.length < 3) {
    const fallback = shuffle(pool.map(p => ({ id: p.id, title: p.title })));
    for (const t of fallback) {
      if (distractors.length >= 3) break;
      if (t.id === chosen.id) continue;
      if (seenTitles.has(t.title)) continue;
      distractors.push(t);
      seenTitles.add(t.title);
    }
  }
  if (distractors.length < 3) return null;

  const options = shuffle([
    { id: chosen.id, title: chosen.title },
    ...distractors,
  ]);

  const cleanText = extractVariants(chosen.content).cleanText;
  return {
    poemId: chosen.id,
    content: cleanText,
    poemTitle: chosen.title,
    options,
  };
}
