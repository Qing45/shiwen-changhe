import type { Poet, Poem, PoetCorpus, PoemCorpus } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

// JSON 字段兜底：现有 320/76 数据没有 corpus 字段，运行时默认 'tang'
export function withCorpus<T extends object>(x: T, fallback: string): T {
  return { ...x, corpus: (x as { corpus?: string }).corpus ?? fallback };
}

const poets: Poet[] = (poetsData as Poet[]).map((p) => withCorpus(p, 'tang')) as Poet[];
const poems: Poem[] = (poemsData as Poem[]).map((p) => withCorpus(p, 'tang')) as Poem[];

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
  if (corpus === 'tang') return poems.filter((p) => p.corpus !== 'primary');
  // 'primary'
  return poems.filter((p) => p.corpus !== 'tang');
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
