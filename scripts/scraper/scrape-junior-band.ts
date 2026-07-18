// 单段抓取初中诗词。用法：npm run scrape:junior-band -- 7a
// 仅抓指定段的诗，合并到 poems.json/poets.json（idempotent）。
//
// 流程：fetchJunior(band) → normalize → 与现有数据合并 → 写回。
// tang/primary 已合并数据保持不变；只新增 junior 段标注或新诗。
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJunior } from './junior';
import { normalize } from './normalize';
import type { Poet, Poem, GradeBand } from '../../src/types';
import type { JuniorBand } from './junior-list';

const here = dirname(fileURLToPath(import.meta.url));
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

function isJuniorBand(v: string | undefined): v is JuniorBand {
  return v === '7a' || v === '7b' || v === '8a' || v === '8b' || v === '9a' || v === '9b';
}

function mergeJunior(mergedPoems: Poem[], mergedPoets: Poet[], juniorNormalized: { poets: Poet[]; poems: Poem[] }) {
  // 诗人按 name 合并：同名诗人已存在时不重复添加，但要把 junior 诗里的 poetId
  // 重写成 existing poet.id —— 否则诗会指向 slug(name) 算出的新 id（孤儿引用），
  // 而 poets.json 里仍是旧 id，UI 上作者位为空。regression: 沁园春·雪 / 渔家傲·记梦 / 如梦令。
  const poetByName = new Map(mergedPoets.map((p) => [p.name, p] as const));
  const juniorPoetIdRemap = new Map<string, string>();
  for (const jp of juniorNormalized.poets) {
    const existing = poetByName.get(jp.name);
    if (existing) {
      juniorPoetIdRemap.set(jp.id, existing.id);
    } else {
      mergedPoets.push(jp);
      poetByName.set(jp.name, jp);
    }
  }

  const existingById = new Map(mergedPoems.map((p) => [p.id, p] as const));
  // Dedup by (title, poetId) too — a poem referenced via gushiwen_<hash>.aspx
  // generates a different id than the same poem at shiwenv_<hash>.aspx.
  const existingByTitlePoet = new Map<string, Poem>();
  for (const p of mergedPoems) {
    existingByTitlePoet.set(`${p.title}|${p.poetId}`, p);
  }

  for (let i = 0; i < juniorNormalized.poems.length; i++) {
    const jp = juniorNormalized.poems[i];
    if (!jp.gradeBand) continue;
    // 把 jp.poetId 重写成已合并诗人表里的真实 id（若同名诗人已存在）
    if (juniorPoetIdRemap.has(jp.poetId)) {
      jp.poetId = juniorPoetIdRemap.get(jp.poetId)!;
      juniorNormalized.poems[i] = jp;
    }
    // Prefer title+poet dedup over id-only when both keys collide.
    const existing =
      existingByTitlePoet.get(`${jp.title}|${jp.poetId}`) ?? existingById.get(jp.id);
    if (existing) {
      const bands: GradeBand[] = [...(existing.gradeBands ?? [])];
      if (!bands.some((b) => typeof b === typeof jp.gradeBand && b === jp.gradeBand)) {
        bands.push(jp.gradeBand);
      }
      const updated: Poem = { ...existing, gradeBands: bands };
      mergedPoems[mergedPoems.indexOf(existing)] = updated;
      existingById.set(jp.id, updated);
      existingByTitlePoet.set(`${jp.title}|${jp.poetId}`, updated);
    } else {
      mergedPoems.push(jp);
      existingById.set(jp.id, jp);
      existingByTitlePoet.set(`${jp.title}|${jp.poetId}`, jp);
    }
  }
}

async function main() {
  const band = process.argv[2];
  if (!isJuniorBand(band)) {
    console.error('Usage: npm run scrape:junior-band -- <7a|7b|8a|8b|9a|9b>');
    process.exit(1);
  }

  console.log(`Fetching junior band ${band}...`);
  const raw = await fetchJunior(band);
  console.log(`  got ${raw.length} poems, normalizing...`);
  const junior = normalize(raw, 'junior');

  console.log(`  loading existing poems.json / poets.json...`);
  const existingPoems: Poem[] = JSON.parse(readFileSync(POEMS_JSON, 'utf-8'));
  const existingPoets: Poet[] = JSON.parse(readFileSync(POETS_JSON, 'utf-8'));
  console.log(`  existing: ${existingPoems.length} poems, ${existingPoets.length} poets`);

  mergeJunior(existingPoems, existingPoets, junior);

  writeFileSync(POEMS_JSON, JSON.stringify(existingPoems, null, 2));
  writeFileSync(POETS_JSON, JSON.stringify(existingPoets, null, 2));
  console.log(`  wrote ${existingPoems.length} poems, ${existingPoets.length} poets`);
  console.log(`  -> ${POEMS_JSON}`);
  console.log(`  -> ${POETS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});