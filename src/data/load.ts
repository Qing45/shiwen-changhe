import type { Poet, Poem } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

const poets: Poet[] = poetsData as Poet[];
const poems: Poem[] = poemsData as Poem[];

export function getPoets(): Poet[] {
  return poets;
}

export function getPoems(): Poem[] {
  return poems;
}

export function getPoet(poetId: string): Poet | undefined {
  return poets.find((p) => p.id === poetId);
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

export function getPoem(poemId: string): Poem | undefined {
  return poems.find((p) => p.id === poemId);
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
