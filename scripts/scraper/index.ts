import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPoemList } from './list';
import { parsePoemPage } from './parse-poem';
import type { RawPoem } from './parse-poem';
import { normalize } from './normalize';
import { fetchPrimary } from './primary';
import { fetchJunior } from './junior';
import { cachedFetch, rateLimitedDelay } from './index-helpers';
import type { Poet, Poem, GradeBand } from '../../src/types';

// 重导出 helper 给其他 scraper 文件用
export { cachedFetch, rateLimitedDelay, CACHE_DIR } from './index-helpers';
// 重导出供单段抓取脚本（如 抓七上）使用
export { fetchJunior } from './junior';

const here = dirname(fileURLToPath(import.meta.url));
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

// 合并 junior 段信息到已合并的 poems 列表。
// 三种情况：
//   1) junior 诗已存在于 tang/primary → 保留原 corpus，gradeBand 移入 gradeBands。
//   2) junior 诗不存在 → 新增 corpus='junior' + gradeBand。
//   3) 诗人已在 tang/primary → 沿用现有 entry；否则新增 corpus='junior'。
function mergeJunior(mergedPoems: Poem[], mergedPoets: Poet[], juniorNormalized: { poets: Poet[]; poems: Poem[] }) {
  const existingById = new Map(mergedPoems.map((p) => [p.id, p] as const));

  for (const jp of juniorNormalized.poems) {
    if (!jp.gradeBand) continue; // junior 必带 gradeBand，否则跳过异常数据

    const existing = existingById.get(jp.id);
    if (existing) {
      // 跨库复用：把 junior 段加到 gradeBands 里，corpus 保留原值。
      // - 已有 corpus='both'（tang+primary 历史 both）→ 不变，gradeBands 加 junior 段
      // - 已有 corpus='tang' 或 'primary' → 不变，gradeBands 加 junior 段
      const bands: GradeBand[] = [...(existing.gradeBands ?? [])];
      if (!bands.some((b) => typeof b === typeof jp.gradeBand && b === jp.gradeBand)) {
        bands.push(jp.gradeBand);
      }
      const updated: Poem = { ...existing, gradeBands: bands };
      mergedPoems[mergedPoems.indexOf(existing)] = updated;
      existingById.set(jp.id, updated);
    } else {
      // 新诗：corpus='junior' + gradeBand
      mergedPoems.push(jp);
      existingById.set(jp.id, jp);
    }
  }

  // 诗人去重：按 name 合并
  const poetByName = new Map(mergedPoets.map((p) => [p.name, p] as const));
  for (const jp of juniorNormalized.poets) {
    if (!poetByName.has(jp.name)) {
      mergedPoets.push(jp);
      poetByName.set(jp.name, jp);
    }
  }
}

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
      const result = await cachedFetch(entry.url);
      const parsed = parsePoemPage(result.html, entry.url);
      tangRaw.push(parsed);
      console.log(`  [${i}/${tangList.length}] ${parsed.title} — ${parsed.poetName}`);
      await rateLimitedDelay(result.cached);
    } catch (err) {
      console.error(`  [${i}/${tangList.length}] FAILED ${entry.title}:`, err);
    }
  }

  console.log('Step 3: fetching primary list...');
  const primaryRaw = await fetchPrimary();

  console.log('Step 4: fetching junior list...');
  const juniorRaw = await fetchJunior();

  console.log(`Step 5: normalizing ${tangRaw.length} tang + ${primaryRaw.length} primary + ${juniorRaw.length} junior...`);
  const tang = normalize(tangRaw, 'tang');
  const primary = normalize(primaryRaw, 'primary');
  const junior = normalize(juniorRaw, 'junior');

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

  // 合并 junior：复用 tang/primary 诗条时把 junior 段写到 gradeBands
  mergeJunior(mergedPoems, mergedPoets, junior);

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
