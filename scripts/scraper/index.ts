import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPoemList } from './list';
import { parsePoemPage } from './parse-poem';
import type { RawPoem } from './parse-poem';
import { normalize } from './normalize';
import { fetchPrimary } from './primary';
import { cachedFetch, rateLimitedDelay } from './index-helpers';
import type { Poet, Poem } from '../../src/types';

// 重导出 helper 给其他 scraper 文件用
export { cachedFetch, rateLimitedDelay, CACHE_DIR } from './index-helpers';

const here = dirname(fileURLToPath(import.meta.url));
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

async function main() {
  console.log('Step 1: fetching Tang poem list...');
  const tangList = await fetchPoemList();
  console.log(`  found ${tangList.length} tang poems`);

  console.log('Step 2: fetching each Tang poem page (rate-limited)...');
  const tangRaw: RawPoem[] = [];
  let i = 0;
  for (const entry of tangList) {
    i++;
    try {
      const html = await cachedFetch(entry.url);
      const parsed = parsePoemPage(html, entry.url);
      tangRaw.push(parsed);
      console.log(`  [${i}/${tangList.length}] ${parsed.title} — ${parsed.poetName}`);
    } catch (err) {
      console.error(`  [${i}/${tangList.length}] FAILED ${entry.title}:`, err);
    }
    await rateLimitedDelay();
  }

  console.log('Step 3: fetching primary list...');
  const primaryRaw = await fetchPrimary();

  console.log(`Step 4: normalizing ${tangRaw.length} tang + ${primaryRaw.length} primary...`);
  const tang = normalize(tangRaw, 'tang');
  const primary = normalize(primaryRaw, 'primary');

  // 按 poemId 去重：primary 中已存在于 tang 的 → corpus: 'both'
  const tangPoemIds = new Set(tang.poems.map((p) => p.id));
  const mergedPoems: Poem[] = [...tang.poems];
  const primaryPoemIdsAdded = new Set<string>(); // tracks primary-only poems we've already pushed
  for (const p of primary.poems) {
    if (tangPoemIds.has(p.id)) {
      // tang-primary overlap → mark tang entry as 'both' (idempotent)
      const idx = mergedPoems.findIndex((m) => m.id === p.id);
      if (mergedPoems[idx].corpus !== 'both') {
        mergedPoems[idx] = { ...mergedPoems[idx], corpus: 'both' };
      }
    } else if (!primaryPoemIdsAdded.has(p.id)) {
      // not in tang, not yet added as primary → push
      mergedPoems.push(p);
      primaryPoemIdsAdded.add(p.id);
    }
    // else: primary-within-primary dup → skip
  }

  // 按诗人名合并：primary 中已存在的诗人 → 仍保留 tang 身份（用 tang entry）
  // 独有诗人加入
  const tangPoetNames = new Set(tang.poets.map((p) => p.name));
  const mergedPoets: Poet[] = [...tang.poets];
  for (const p of primary.poets) {
    if (!tangPoetNames.has(p.name)) {
      mergedPoets.push({ ...p, corpus: 'primary' });
    }
    // 否则原 tang 诗人保留 corpus: 'tang'
  }

  writeFileSync(POEMS_JSON, JSON.stringify(mergedPoems, null, 2));
  writeFileSync(POETS_JSON, JSON.stringify(mergedPoets, null, 2));
  console.log(`  wrote ${mergedPoems.length} poems, ${mergedPoets.length} poets`);
  console.log(`  -> ${POEMS_JSON}`);
  console.log(`  -> ${POETS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
