import type { Poet, Poem } from '../types';
import poetsData from './poets.json';
import poemsData from './poems.json';

const poets: Poet[] = poetsData as Poet[];
const poems: Poem[] = poemsData as Poem[];

export function getPoets(): Poet[] {
  return poets;
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
