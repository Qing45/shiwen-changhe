import type { Poet, Poem, SearchResult, VerseHit } from '../types';
import { getPoets } from '../data/load';
import poemsData from '../data/poems.json';

const poems = poemsData as Poem[];

export interface SearchIndex {
  query(q: string): SearchResult;
}

export function buildIndex(): SearchIndex {
  const poets = getPoets();
  const poetById = new Map(poets.map((p) => [p.id, p]));

  // Pre-split poem content into verse lines for verse-level search
  const verseIndex: { poem: Poem; poetName: string; verses: string[] }[] = poems.map((p) => ({
    poem: p,
    poetName: poetById.get(p.poetId)?.name ?? '',
    verses: splitVerses(p.content),
  }));

  return {
    query(q: string): SearchResult {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        return { poets: [], poems: [], verses: [] };
      }
      const lower = trimmed.toLowerCase();

      const matchedPoets = poets.filter((p) => p.name.includes(trimmed) || (p.courtesyName?.includes(trimmed) ?? false) || (p.pseudonym?.includes(trimmed) ?? false));

      const matchedPoems = poems.filter((p) => p.title.includes(trimmed));

      const matchedVerses: VerseHit[] = [];
      for (const entry of verseIndex) {
        for (const verse of entry.verses) {
          if (verse.includes(trimmed) || verse.toLowerCase().includes(lower)) {
            matchedVerses.push({
              poemId: entry.poem.id,
              verse,
              poemTitle: entry.poem.title,
              poetName: entry.poetName,
            });
            if (matchedVerses.length >= 50) break; // cap
          }
        }
        if (matchedVerses.length >= 50) break;
      }

      return { poets: matchedPoets, poems: matchedPoems, verses: matchedVerses };
    },
  };
}

function splitVerses(content: string): string[] {
  // Split by 。！？ or newlines, then by 、, keeping any non-empty pieces
  return content
    .split(/[。！？\n]/)
    .flatMap((s) => s.split('、'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
