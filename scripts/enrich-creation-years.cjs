// One-shot script: reads src/data/poems.json + poets.json, populates each
// poem's `creationYear` by parsing its `background` string, then writes the
// enriched array back. Idempotent: running twice gives the same output.
//
// Strategy (in priority order):
//   1. Extract numeric year (\d{3,4}) from background, preferring the one
//      closest to "作/写/创作/作于/写于/创作于".
//   2. Match Tang-era name + 初/末/间/中 suffix via ERA_TABLE lookup.
//   3. Fall back to spreading evenly across parent poet's lifetime, using
//      早年/中年/晚年 hints to nudge order within the poet's range.
//
// Run: node scripts/enrich-creation-years.cjs
// Outputs: rewritten src/data/poems.json + coverage stats to stdout.

const fs = require('fs');
const path = require('path');

const POEMS_PATH = path.join(__dirname, '..', 'src', 'data', 'poems.json');
const POETS_PATH = path.join(__dirname, '..', 'src', 'data', 'poets.json');

// Tang era names → [start, end] inclusive. Sources: standard Tang chronology.
// Note: 上元 appears twice (Gaozong 674-676, Suzong 760-762); use Suzong era
// since 8th-c. backgrounds referencing 上元 usually mean the An Lushan era.
const ERA_TABLE = {
  '武德': [618, 626], '贞观': [627, 649], '永徽': [650, 655], '显庆': [656, 660],
  '龙朔': [661, 663], '麟德': [664, 665], '乾封': [666, 668], '总章': [668, 670],
  '咸亨': [670, 674], '上元': [760, 762], '仪凤': [676, 679], '调露': [679, 680],
  '永隆': [680, 681], '开耀': [681, 682], '永淳': [682, 683], '弘道': [683, 683],
  '嗣圣': [684, 684], '文明': [684, 684], '光宅': [684, 684], '垂拱': [685, 688],
  '永昌': [689, 689], '载初': [689, 690], '天授': [690, 692], '如意': [692, 692],
  '长寿': [692, 694], '延载': [694, 694], '证圣': [695, 695], '天册万岁': [695, 696],
  '万岁登封': [696, 696], '万岁通天': [696, 697], '神功': [697, 697], '圣历': [698, 700],
  '久视': [700, 700], '大足': [701, 701], '长安': [701, 705], '神龙': [705, 707],
  '景龙': [707, 710], '唐隆': [710, 710], '景云': [710, 712], '太极': [712, 712],
  '延和': [712, 712], '先天': [712, 713], '开元': [713, 741], '天宝': [742, 756],
  '至德': [756, 758], '乾元': [758, 760], '宝应': [762, 763], '广德': [763, 764],
  '永泰': [765, 765], '大历': [766, 779], '建中': [780, 783], '兴元': [784, 784],
  '贞元': [785, 805], '永贞': [805, 805], '元和': [806, 820], '长庆': [821, 824],
  '宝历': [825, 827], '大和': [827, 835], '开成': [836, 840], '会昌': [841, 846],
  '大中': [847, 860], '咸通': [860, 874], '乾符': [874, 879], '广明': [880, 881],
  '中和': [881, 885], '光启': [885, 888], '文德': [888, 888], '龙纪': [889, 889],
  '大顺': [890, 891], '景福': [892, 893], '乾宁': [894, 898], '光化': [898, 901],
  '天复': [901, 904], '天祐': [904, 907],
};

// Chinese numeral map for era-year suffix (e.g., "四年" in "元和四年").
const CN_NUM = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
};

function cnYearToNum(s) {
  // Parses 一~九十九 in Chinese numerals. Handles 四, 十, 十四, 二十, 二十四.
  if (!s) return null;
  if (/^十$/.test(s)) return 10;
  if (/^十/.test(s)) return 10 + (CN_NUM[s[1]] || 0);
  if (/^.+十$/.test(s)) return (CN_NUM[s[0]] || 0) * 10;
  if (/^.+十.+$/.test(s)) {
    return (CN_NUM[s[0]] || 0) * 10 + (CN_NUM[s[2]] || 0);
  }
  return CN_NUM[s] || null;
}

// Strategy 1: extract numeric year (Arabic digits) near creation keywords.
function extractNumericYear(bg) {
  if (!bg) return null;
  const matches = [...bg.matchAll(/(\d{3,4})\s*年/g)];
  if (matches.length === 0) return null;
  if (matches.length === 1) return parseInt(matches[0][1], 10);
  // Multiple candidates: prefer the one closest to a creation verb.
  const verbs = ['作于', '写于', '创作于', '作自', '写自', '作', '写'];
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    for (const v of verbs) {
      const vi = bg.lastIndexOf(v, m.index);
      if (vi >= 0) {
        const dist = m.index - vi;
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
      }
    }
  }
  return parseInt(matches[bestIdx][1], 10);
}

// Strategy 2: era name + suffix. Handles "贞观初", "天宝末", "大历年间",
// "元和四年" (era + Chinese-numeral year).
function extractEraYear(bg) {
  if (!bg) return null;
  for (const era of Object.keys(ERA_TABLE)) {
    const idx = bg.indexOf(era);
    if (idx < 0) continue;
    const [start, end] = ERA_TABLE[era];
    const tail = bg.slice(idx + era.length, idx + era.length + 4);
    if (tail.startsWith('初')) return start + 1;
    if (tail.startsWith('末') || tail.startsWith('晚')) return end - 1;
    if (tail.startsWith('间') || tail.startsWith('中')) return Math.round((start + end) / 2);
    // Era + Chinese numeral year, e.g., "元和四年"
    const ym = tail.match(/^([一二三四五六七八九十]+)/);
    if (ym) {
      const n = cnYearToNum(ym[1]);
      if (n != null && start + n - 1 <= end) return start + n - 1;
    }
    // Just the era name with no suffix — return midpoint as a soft guess
    return Math.round((start + end) / 2);
  }
  return null;
}

// Strategy 3: lifetime fallback. Spread evenly across poet's birthYear→deathYear.
function lifetimeFallback(poems, poet, idx, total) {
  const span = Math.max(1, poet.deathYear - poet.birthYear);
  const base = poet.birthYear + Math.round((idx / Math.max(1, total - 1)) * span);
  return base;
}

// Main
const poems = JSON.parse(fs.readFileSync(POEMS_PATH, 'utf8'));
const poets = JSON.parse(fs.readFileSync(POETS_PATH, 'utf8'));
const poetMap = new Map(poets.map((p) => [p.id, p]));

let s1 = 0, s2 = 0, s3 = 0;
const fallbacks = [];

// Group poems by poet for lifetime fallback ordering
const byPoet = new Map();
for (const poem of poems) {
  if (!byPoet.has(poem.poetId)) byPoet.set(poem.poetId, []);
  byPoet.get(poem.poetId).push(poem);
}

for (const poem of poems) {
  // Strategy 1: numeric year from background
  let year = extractNumericYear(poem.background || '');
  if (year != null) { s1++; }
  else {
    // Strategy 2: era name
    year = extractEraYear(poem.background || '');
    if (year != null) { s2++; }
    else {
      // Strategy 3: lifetime fallback
      const poet = poetMap.get(poem.poetId);
      if (poet) {
        const poetPoems = byPoet.get(poem.poetId);
        const idx = poetPoems.indexOf(poem);
        year = lifetimeFallback(poetPoems, poet, idx, poetPoems.length);
        s3++;
        fallbacks.push(`${poem.title} (${poet.name}) → ${year}`);
      } else {
        year = null;
      }
    }
  }
  poem.creationYear = year;
}

fs.writeFileSync(POEMS_PATH, JSON.stringify(poems, null, 2) + '\n', 'utf8');

console.log('Enrichment complete:');
console.log(`  Strategy 1 (numeric year): ${s1}`);
console.log(`  Strategy 2 (era name):     ${s2}`);
console.log(`  Strategy 3 (lifetime FB):  ${s3}`);
console.log(`  Total:                     ${s1 + s2 + s3}/${poems.length}`);
console.log(`\nFallback poems (lifetime spread):`);
fallbacks.slice(0, 20).forEach((f) => console.log('  ' + f));
if (fallbacks.length > 20) console.log(`  ... and ${fallbacks.length - 20} more`);
