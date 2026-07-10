// Post-scrape fix-up: truncate multi-part poems to the single part spec expects.
// Spec (PRIMARY_LIST) lists base titles like "悯农"/"惠崇春江晚景"/etc., but
// gushiwen.cn serves the full 组诗 with all parts concatenated. Elementary
// curriculum only requires one specific part per poem.
//
// Rules (verified against 人教版 primary school textbook):
//   - 悯农 (李绅): keep 其二 only (锄禾日当午)
//   - 惠崇春江晚景 (苏轼): keep 其一 only (竹外桃花三两枝)
//   - 六月二十七日望湖楼醉书 (苏轼): keep 其一 only (黑云翻墨未遮山)
//   - 秋夜将晓出篱门迎凉有感 (陆游): keep 其二 only (三万里河东入海)
//
// Also filters annotations: drops any whose term no longer appears in truncated content.
// Also normalizes titles to spec base form.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const POEMS_JSON = resolve(here, '../src/data/poems.json');

interface Annotation {
  term: string;
  explanation: string;
}

interface Poem {
  id: string;
  title: string;
  poetId: string;
  content: string;
  annotations: Annotation[];
  background?: string;
  familiarity: number;
  corpus: string;
  creationYear?: number;
}

// (poetId prefix match is too loose; use exact poem.id from data inspection)
// Key: poem.id. Value: { newTitle, keepContent, newBackground? }
interface TruncationRule {
  matchId: string;
  newTitle: string;
  keepContent: string;
}

const RULES: TruncationRule[] = [
  {
    matchId: 'ea761be0f016', // 悯农二首 — 李绅
    newTitle: '悯农',
    keepContent: '锄禾日当午，汗滴禾下土。谁知盘中餐，粒粒皆辛苦？',
  },
  {
    // 惠崇春江晚景二首 — 苏轼
    // Find by content match below since we don't know id yet
    matchId: '__BY_CONTENT__',
    newTitle: '惠崇春江晚景',
    keepContent: '竹外桃花三两枝，春江水暖鸭先知。蒌蒿满地芦芽短，正是河豚欲上时。',
  },
  {
    // 六月二十七日望湖楼醉书五首 — 苏轼
    matchId: '__BY_CONTENT__',
    newTitle: '六月二十七日望湖楼醉书',
    keepContent: '黑云翻墨未遮山，白雨跳珠乱入船。卷地风来忽吹散，望湖楼下水如天。',
  },
  {
    // 秋夜将晓出篱门迎凉有感二首 — 陆游
    matchId: '__BY_CONTENT__',
    newTitle: '秋夜将晓出篱门迎凉有感',
    keepContent: '三万里河东入海，五千仞岳上摩天。遗民泪尽胡尘里，南望王师又一年。',
  },
];

function findPoemByContent(poems: Poem[], substring: string): Poem | undefined {
  return poems.find((p) => p.content.includes(substring));
}

function filterAnnotations(annos: Annotation[], content: string): Annotation[] {
  return annos.filter((a) => content.includes(a.term));
}

const poems = JSON.parse(readFileSync(POEMS_JSON, 'utf-8')) as Poem[];
let modified = 0;

for (const rule of RULES) {
  let poem: Poem | undefined;
  if (rule.matchId === '__BY_CONTENT__') {
    poem = findPoemByContent(poems, rule.keepContent.slice(0, 6));
  } else {
    poem = poems.find((p) => p.id === rule.matchId);
  }

  if (!poem) {
    console.log('SKIP (not found): ' + rule.newTitle);
    continue;
  }

  const oldTitle = poem.title;
  const oldContent = poem.content;
  poem.title = rule.newTitle;
  poem.content = rule.keepContent;
  poem.annotations = filterAnnotations(poem.annotations, rule.keepContent);
  modified++;
  console.log('TRUNCATED: "' + oldTitle + '" → "' + poem.title + '"');
  console.log('  old content (' + oldContent.length + ' chars): ' + oldContent.slice(0, 80) + '...');
  console.log('  new content (' + poem.content.length + ' chars): ' + poem.content);
  console.log('  annotations: ' + poem.annotations.length + ' kept');
}

writeFileSync(POEMS_JSON, JSON.stringify(poems, null, 2));
console.log('\n' + modified + ' poems truncated');
