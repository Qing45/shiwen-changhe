export interface Dynasty {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
}

// 年级段：小学 1-12（数字，按学年学期编号），初中 '7a'-'9b'（字符串，7-9 年级上下学期）。
// 用 number | string 联合类型让 TS 在比较时强制区分，避免小学段数字与初中段字符串误判等值。
export type GradeBand = number | string;

export type PoetCorpus = 'tang' | 'primary' | 'junior' | 'senior';
export type PoemCorpus = 'tang' | 'primary' | 'junior' | 'senior' | 'both';

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
  gradeBand?: GradeBand;
  // 跨段 / 跨库：同一首诗出现在多个年级段或多个库时，把所有 gradeBand 集中放这里。
  // gradeBand 字段保留「主段」（通常是首发库的段位），gradeBands 列出其它段。
  // 例：'both' 类诗在 tang + primary grade 5 + junior '7a'，
  //     gradeBand=5，gradeBands=['7a']。
  gradeBands?: GradeBand[];
  // 配图文件名（不含路径）。文件放在 public/illustrations/ 下。
  // 有配图的诗在 PoemPage 右栏显示「注释 / 配图」切换 tab，默认配图，点击可放大。
  illustration?: string;
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
