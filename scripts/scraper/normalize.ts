import type { Poet, Poem } from '../../src/types';

// Hand-curated metadata for famous poets. Birth/death years are historical.
// Poets not in this map default to birthYear=700, deathYear=750, familiarity=2.
//
// dynastyId: 之前所有新诗人都硬编码为 'tang'，导致宋/清/现代诗人显示错误朝代。
// 现按诗人实际朝代标注；未列入者仍兜底 'tang'（仅适用于唐诗三百首）。
const POET_META: Record<
  string,
  {
    courtesyName?: string;
    pseudonym?: string;
    birthYear: number;
    deathYear: number;
    familiarity: number;
    dynastyId?: Poet['dynastyId'];
  }
> = {
  '李白': { courtesyName: '太白', pseudonym: '青莲居士', birthYear: 701, deathYear: 762, familiarity: 5, dynastyId: 'tang' },
  '杜甫': { courtesyName: '子美', pseudonym: '少陵野老', birthYear: 712, deathYear: 770, familiarity: 5, dynastyId: 'tang' },
  '王维': { courtesyName: '摩诘', pseudonym: '摩诘居士', birthYear: 701, deathYear: 761, familiarity: 4, dynastyId: 'tang' },
  '白居易': { courtesyName: '乐天', pseudonym: '香山居士', birthYear: 772, deathYear: 846, familiarity: 4, dynastyId: 'tang' },
  '李商隐': { courtesyName: '义山', pseudonym: '玉谿生', birthYear: 813, deathYear: 858, familiarity: 4, dynastyId: 'tang' },
  '杜牧': { courtesyName: '牧之', pseudonym: '樊川居士', birthYear: 803, deathYear: 852, familiarity: 3, dynastyId: 'tang' },
  '孟浩然': { courtesyName: '浩然', birthYear: 689, deathYear: 740, familiarity: 3, dynastyId: 'tang' },
  '王昌龄': { courtesyName: '少伯', birthYear: 698, deathYear: 757, familiarity: 3, dynastyId: 'tang' },
  '王之涣': { birthYear: 688, deathYear: 742, familiarity: 2, dynastyId: 'tang' },
  '刘禹锡': { courtesyName: '梦得', birthYear: 772, deathYear: 842, familiarity: 3, dynastyId: 'tang' },
  '柳宗元': { courtesyName: '子厚', birthYear: 773, deathYear: 819, familiarity: 3, dynastyId: 'tang' },
  '岑参': { birthYear: 715, deathYear: 770, familiarity: 2, dynastyId: 'tang' },
  '高适': { courtesyName: '达夫', birthYear: 704, deathYear: 765, familiarity: 2, dynastyId: 'tang' },
  '韦应物': { birthYear: 737, deathYear: 792, familiarity: 2, dynastyId: 'tang' },
  '孟郊': { courtesyName: '东野', birthYear: 751, deathYear: 814, familiarity: 2, dynastyId: 'tang' },
  // 小学必背诗新增诗人（宋/明/清/现代）
  '苏轼': { courtesyName: '子瞻', pseudonym: '东坡居士', birthYear: 1037, deathYear: 1101, familiarity: 5, dynastyId: 'song' },
  '王安石': { courtesyName: '介甫', pseudonym: '半山', birthYear: 1021, deathYear: 1086, familiarity: 4, dynastyId: 'song' },
  '杨万里': { courtesyName: '廷秀', pseudonym: '诚斋', birthYear: 1127, deathYear: 1206, familiarity: 4, dynastyId: 'song' },
  '范成大': { courtesyName: '致能', pseudonym: '石湖居士', birthYear: 1126, deathYear: 1193, familiarity: 3, dynastyId: 'song' },
  '陆游': { courtesyName: '放翁', birthYear: 1125, deathYear: 1210, familiarity: 5, dynastyId: 'song' },
  '辛弃疾': { courtesyName: '幼安', pseudonym: '稼轩', birthYear: 1140, deathYear: 1207, familiarity: 5, dynastyId: 'song' },
  '李清照': { courtesyName: '易安', birthYear: 1084, deathYear: 1155, familiarity: 4, dynastyId: 'song' },
  '朱熹': { courtesyName: '元晦', pseudonym: '晦庵', birthYear: 1130, deathYear: 1200, familiarity: 4, dynastyId: 'song' },
  '范仲淹': { courtesyName: '希文', birthYear: 989, deathYear: 1052, familiarity: 3, dynastyId: 'song' },
  '叶绍翁': { courtesyName: '嗣宗', birthYear: 1100, deathYear: 1150, familiarity: 2, dynastyId: 'song' },
  '卢钺': { birthYear: 1100, deathYear: 1150, familiarity: 2, dynastyId: 'song' },
  '郑思肖': { courtesyName: '忆翁', birthYear: 1241, deathYear: 1318, familiarity: 2, dynastyId: 'song' },
  '黄庭坚': { courtesyName: '鲁直', pseudonym: '山谷道人', birthYear: 1045, deathYear: 1105, familiarity: 3, dynastyId: 'song' },
  '王观': { courtesyName: '达叟', birthYear: 1050, deathYear: 1120, familiarity: 2, dynastyId: 'song' },
  '林升': { courtesyName: '云友', birthYear: 1120, deathYear: 1170, familiarity: 2, dynastyId: 'song' },
  '龚自珍': { courtesyName: '璱人', pseudonym: '定盦', birthYear: 1792, deathYear: 1841, familiarity: 3, dynastyId: 'qing' },
  '查慎行': { courtesyName: '悔余', birthYear: 1650, deathYear: 1727, familiarity: 2, dynastyId: 'qing' },
  '袁枚': { courtesyName: '子才', pseudonym: '简斋', birthYear: 1716, deathYear: 1797, familiarity: 3, dynastyId: 'qing' },
  '郑燮': { courtesyName: '克柔', pseudonym: '板桥', birthYear: 1693, deathYear: 1765, familiarity: 3, dynastyId: 'qing' },
  '于谦': { courtesyName: '廷益', birthYear: 1398, deathYear: 1457, familiarity: 3, dynastyId: 'ming' },
  '毛泽东': { birthYear: 1893, deathYear: 1976, familiarity: 5, dynastyId: 'modern' },
  '林杰': { courtesyName: '智周', birthYear: 750, deathYear: 800, familiarity: 2, dynastyId: 'tang' },
  '虞世南': { courtesyName: '伯施', birthYear: 558, deathYear: 638, familiarity: 2, dynastyId: 'tang' },
  '张志和': { courtesyName: '子同', birthYear: 730, deathYear: 790, familiarity: 2, dynastyId: 'tang' },
  '张继': { birthYear: 710, deathYear: 780, familiarity: 2, dynastyId: 'tang' },
  '纳兰性德': { courtesyName: '容若', birthYear: 1655, deathYear: 1685, familiarity: 3, dynastyId: 'qing' },
  '雷震': { birthYear: 1100, deathYear: 1150, familiarity: 2, dynastyId: 'song' },
  '翁卷': { courtesyName: '续古', birthYear: 1180, deathYear: 1240, familiarity: 2, dynastyId: 'song' },
  '曾几': { courtesyName: '志甫', pseudonym: '茶山居士', birthYear: 1085, deathYear: 1166, familiarity: 2, dynastyId: 'song' },
  '韩翃': { courtesyName: '君平', birthYear: 720, deathYear: 790, familiarity: 2, dynastyId: 'tang' },
  '王建': { courtesyName: '仲初', birthYear: 766, deathYear: 830, familiarity: 2, dynastyId: 'tang' },
  '唐寅': { courtesyName: '伯虎', pseudonym: '六如居士', birthYear: 1470, deathYear: 1524, familiarity: 3, dynastyId: 'ming' },
  '李绅': { courtesyName: '公垂', birthYear: 792, deathYear: 858, familiarity: 2, dynastyId: 'tang' },
  '胡令能': { birthYear: 750, deathYear: 820, familiarity: 2, dynastyId: 'tang' },
  '贾岛': { courtesyName: '浪仙', birthYear: 779, deathYear: 843, familiarity: 3, dynastyId: 'tang' },
  '李峤': { courtesyName: '巨山', birthYear: 644, deathYear: 713, familiarity: 2, dynastyId: 'tang' },
  // 乐府民歌/乐府诗集类：归入 'other' 朝代（先秦至南北朝民歌）
  '北朝民歌': { birthYear: 386, deathYear: 581, familiarity: 2, dynastyId: 'other' },
  '汉乐府': { birthYear: -206, deathYear: 220, familiarity: 2, dynastyId: 'other' },
  '乐府诗集': { birthYear: 500, deathYear: 600, familiarity: 2, dynastyId: 'other' },
  '高鼎': { birthYear: 1820, deathYear: 1880, familiarity: 2, dynastyId: 'qing' },
  '贺知章': { courtesyName: '季真', pseudonym: '四明狂客', birthYear: 659, deathYear: 744, familiarity: 3, dynastyId: 'tang' },
};

// 民歌/乐府类诗人别名归一化：gushiwen 用「乐府诗集」「佚名」时映射回 spec 期望名。
const POET_NAME_ALIASES: Record<string, string> = {
  乐府诗集: '北朝民歌', // 敕勒歌 spec 标 北朝民歌
  乐府民歌: '北朝民歌',
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
  corpusHint: 'tang' | 'primary' = 'tang',
): NormalizedData {
  const poets = new Map<string, Poet>();
  const poems: Poem[] = [];

  for (const r of raw) {
    // 应用诗人别名归一化（如 乐府诗集 → 北朝民歌），让数据匹配 spec。
    const poetName = POET_NAME_ALIASES[r.poetName] ?? r.poetName;
    const meta = POET_META[poetName] ?? DEFAULT_POET_META;

    if (!poets.has(poetName)) {
      const poet: Poet = {
        id: slug(poetName),
        name: poetName,
        courtesyName: meta.courtesyName,
        pseudonym: 'pseudonym' in meta ? meta.pseudonym : undefined,
        birthYear: meta.birthYear,
        deathYear: meta.deathYear,
        // 未列入 POET_META 的诗人兜底为 'tang'（仅适用于唐诗三百首源）；
        // primary 语料的所有新增诗人都已在 POET_META 中标注 dynastyId。
        dynastyId: meta.dynastyId ?? 'tang',
        familiarity: meta.familiarity,
        corpus: corpusHint,
      };
      poets.set(poetName, poet);
    }

    const poem: Poem = {
      id: poemIdFromUrl(r.url),
      title: r.title,
      poetId: poets.get(poetName)!.id,
      content: r.content,
      annotations: r.annotations,
      background: r.background,
      creationYear: undefined, // gushiwen.cn doesn't expose this cleanly; default to undefined
      familiarity: FAMOUS_POEMS.has(r.title) ? 5 : 2,
      corpus: corpusHint,
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
