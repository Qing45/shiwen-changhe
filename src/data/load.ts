import type { Poet, Poem, PoetCorpus, PoemCorpus, GradeBand } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

// JSON 字段兜底：现有 320/76 数据没有 corpus 字段，运行时默认 'tang'
export function withCorpus<T extends object>(x: T, fallback: string): T {
  return { ...x, corpus: (x as { corpus?: string }).corpus ?? fallback };
}

const poets: Poet[] = (poetsData as Poet[]).map((p) => withCorpus(p, 'tang')) as Poet[];
const poems: Poem[] = (poemsData as Poem[]).map((p) => withCorpus(p, 'tang')) as Poem[];

// 收集一首诗的全部 gradeBand（合并 gradeBand + gradeBands）。用于跨库段判定。
function collectBands(poem: Poem): GradeBand[] {
  const out: GradeBand[] = [];
  if (poem.gradeBand !== undefined) out.push(poem.gradeBand);
  if (poem.gradeBands) out.push(...poem.gradeBands);
  return out;
}

// 跨库判定：一首诗是否属于某个特定 corpus。
// - 直接匹配：poem.corpus === target
// - 'both' 兼容：现有 both 数据默认是 tang+primary，tang/primary 都应返回 true；
//   新增 junior 维度后，'both' 也可能涵盖 junior，需通过 gradeBands 中是否含字符串段判定。
// - 跨段扩展：corpus='tang'/'primary' + gradeBands 含其它类型段 → 也属于另一库。
export function poemInCorpus(poem: Poem, target: 'tang' | 'primary' | 'junior'): boolean {
  if (poem.corpus === target) return true;
  if (poem.corpus === 'both') {
    // 兼容历史 both = tang+primary；新增 junior 维度下若 gradeBands 含字符串段也算 junior。
    if (target === 'junior') {
      return collectBands(poem).some((b) => typeof b === 'string');
    }
    return true; // tang / primary
  }
  // 非 both：通过 gradeBands 是否含对应类型段判定跨库归属
  const bands = collectBands(poem);
  if (target === 'primary') return bands.some((b) => typeof b === 'number');
  if (target === 'junior') return bands.some((b) => typeof b === 'string');
  return false; // tang 没有段位标记，跨库仅通过 'both' 走
}

export function getPoets(): Poet[];
export function getPoets(corpus: PoetCorpus | 'all'): Poet[];
export function getPoets(corpus?: PoetCorpus | 'all'): Poet[] {
  if (!corpus || corpus === 'all') return poets;
  return poets.filter((p) => p.corpus === corpus);
}

export function getPoem(id: string): Poem | undefined {
  return poems.find((p) => p.id === id);
}

export function getPoet(poetId: string): Poet | undefined {
  return poets.find((p) => p.id === poetId);
}

export function getPoetByName(name: string): Poet | undefined {
  return poets.find((p) => p.name === name);
}

export function getPoemsByPoet(poetId: string): Poem[] {
  return poems
    .filter((p) => p.poetId === poetId)
    .sort((a, b) => {
      if (a.creationYear === undefined && b.creationYear === undefined) return 0;
      if (a.creationYear === undefined) return 1;
      if (b.creationYear === undefined) return -1;
      return a.creationYear - b.creationYear;
    });
}

export function getPoemCount(poetId: string): number {
  return poems.filter((p) => p.poetId === poetId).length;
}

export function getPoems(): Poem[];
export function getPoems(corpus: PoemCorpus): Poem[];
export function getPoems(corpus?: PoemCorpus): Poem[] {
  if (!corpus || corpus === 'both') return poems;
  if (corpus === 'tang') return poems.filter((p) => poemInCorpus(p, 'tang'));
  if (corpus === 'primary') return poems.filter((p) => poemInCorpus(p, 'primary'));
  // 'junior'
  return poems.filter((p) => poemInCorpus(p, 'junior'));
}

export function getNeighbors(poemId: string): { prev?: Poem; next?: Poem } {
  const poem = getPoem(poemId);
  if (!poem) return {};
  const siblings = getPoemsByPoet(poem.poetId);
  const idx = siblings.findIndex((p) => p.id === poemId);
  return {
    prev: idx > 0 ? siblings[idx - 1] : undefined,
    next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined,
  };
}

// Global next/prev across all poems, sorted the same way PoemsRiverPage lays
// them out: by creationYear, falling back to the poet's birthYear. Used when
// the user entered PoemPage from /poems so pagination follows the river's
// order rather than the poet's.
export function getGlobalPoemNeighbors(poemId: string): { prev?: Poem; next?: Poem } {
  const sorted = [...poems].sort((a, b) => {
    const ya = a.creationYear ?? getPoet(a.poetId)?.birthYear ?? 0;
    const yb = b.creationYear ?? getPoet(b.poetId)?.birthYear ?? 0;
    return ya - yb;
  });
  const idx = sorted.findIndex((p) => p.id === poemId);
  if (idx < 0) return {};
  return {
    prev: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}
