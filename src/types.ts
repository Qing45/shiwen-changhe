export interface Dynasty {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
}

export type PoetCorpus = 'tang' | 'primary';
export type PoemCorpus = 'tang' | 'primary' | 'both';

export interface Poet {
  id: string;
  name: string;
  courtesyName?: string;
  pseudonym?: string;
  birthYear: number;
  deathYear: number;
  dynastyId: string;
  familiarity: number; // 1-5
  corpus: PoetCorpus;
}

export interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: { term: string; explanation: string }[];
  background?: string;
  creationYear?: number;
  familiarity: number; // 1-5
  corpus: PoemCorpus;
  gradeBand?: number;
}

export interface VerseHit {
  poemId: string;
  verse: string;
  poemTitle: string;
  poetName: string;
}

export interface SearchResult {
  poets: Poet[];
  poems: Poem[];
  verses: VerseHit[];
}
