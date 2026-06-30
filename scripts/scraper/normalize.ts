import type { Poet, Poem } from '../../src/types';

// Hand-curated metadata for famous poets. Birth/death years are historical.
// Poets not in this map default to birthYear=700, deathYear=750, familiarity=2.
const POET_META: Record<
  string,
  { courtesyName?: string; pseudonym?: string; birthYear: number; deathYear: number; familiarity: number }
> = {
  '李白': { courtesyName: '太白', pseudonym: '青莲居士', birthYear: 701, deathYear: 762, familiarity: 5 },
  '杜甫': { courtesyName: '子美', pseudonym: '少陵野老', birthYear: 712, deathYear: 770, familiarity: 5 },
  '王维': { courtesyName: '摩诘', pseudonym: '摩诘居士', birthYear: 701, deathYear: 761, familiarity: 4 },
  '白居易': { courtesyName: '乐天', pseudonym: '香山居士', birthYear: 772, deathYear: 846, familiarity: 4 },
  '李商隐': { courtesyName: '义山', pseudonym: '玉谿生', birthYear: 813, deathYear: 858, familiarity: 4 },
  '杜牧': { courtesyName: '牧之', pseudonym: '樊川居士', birthYear: 803, deathYear: 852, familiarity: 3 },
  '孟浩然': { courtesyName: '浩然', birthYear: 689, deathYear: 740, familiarity: 3 },
  '王昌龄': { courtesyName: '少伯', birthYear: 698, deathYear: 757, familiarity: 3 },
  '王之涣': { birthYear: 688, deathYear: 742, familiarity: 2 },
  '刘禹锡': { courtesyName: '梦得', birthYear: 772, deathYear: 842, familiarity: 3 },
  '柳宗元': { courtesyName: '子厚', birthYear: 773, deathYear: 819, familiarity: 3 },
  '岑参': { birthYear: 715, deathYear: 770, familiarity: 2 },
  '高适': { courtesyName: '达夫', birthYear: 704, deathYear: 765, familiarity: 2 },
  '韦应物': { birthYear: 737, deathYear: 792, familiarity: 2 },
  '孟郊': { courtesyName: '东野', birthYear: 751, deathYear: 814, familiarity: 2 },
};

const DEFAULT_POET_META = { birthYear: 700, deathYear: 750, familiarity: 2 };

// Canonical poems get familiarity 5
const FAMOUS_POEMS = new Set([
  '静夜思', '将进酒', '春晓', '登鹳雀楼', '望庐山瀑布', '绝句', '春望',
  '登高', '蜀道难', '琵琶行', '忆江南', '悯农', '寻隐者不遇',
]);

export interface NormalizedData {
  poets: Poet[];
  poems: Poem[];
}

export function normalize(
  raw: {
    url: string;
    title: string;
    poetName: string;
    content: string;
    annotations: { term: string; explanation: string }[];
    background?: string;
  }[],
): NormalizedData {
  const poets = new Map<string, Poet>();
  const poems: Poem[] = [];

  for (const r of raw) {
    const meta = POET_META[r.poetName] ?? DEFAULT_POET_META;

    if (!poets.has(r.poetName)) {
      const poet: Poet = {
        id: slug(r.poetName),
        name: r.poetName,
        courtesyName: meta.courtesyName,
        pseudonym: 'pseudonym' in meta ? meta.pseudonym : undefined,
        birthYear: meta.birthYear,
        deathYear: meta.deathYear,
        dynastyId: 'tang',
        familiarity: meta.familiarity,
      };
      poets.set(r.poetName, poet);
    }

    const poem: Poem = {
      id: poemIdFromUrl(r.url),
      title: r.title,
      poetId: poets.get(r.poetName)!.id,
      content: r.content,
      annotations: r.annotations,
      background: r.background,
      creationYear: undefined, // gushiwen.cn doesn't expose this cleanly; default to undefined
      familiarity: FAMOUS_POEMS.has(r.title) ? 5 : 2,
    };
    poems.push(poem);
  }

  return { poets: Array.from(poets.values()), poems };
}

function slug(s: string): string {
  // Pinyin would be ideal; for MVP, hash by char codes
  return s.split('').map((c) => c.charCodeAt(0).toString(16)).join('');
}

function poemIdFromUrl(url: string): string {
  const match = url.match(/shiwenv_([a-zA-Z0-9]+)\.aspx/);
  if (match) return match[1];
  // Fallback for unexpected URL shapes: slug the full URL
  return url.split('').map((c) => c.charCodeAt(0).toString(16)).join('').slice(0, 32);
}
