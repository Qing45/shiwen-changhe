import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchPoemList } from './list';
import { parsePoemPage } from './parse-poem';
import { normalize } from './normalize';

const here = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(here, '.cache');
const POEMS_JSON = resolve(here, '../../src/data/poems.json');
const POETS_JSON = resolve(here, '../../src/data/poets.json');

const RATE_LIMIT_MS = 1000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function rateLimitedDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}

async function cachedFetch(url: string): Promise<string> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = resolve(
    CACHE_DIR,
    Buffer.from(url).toString('base64url').slice(0, 80) + '.html',
  );
  if (existsSync(cacheFile)) {
    return readFileSync(cacheFile, 'utf-8');
  }
  console.log(`  fetching ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  writeFileSync(cacheFile, html);
  return html;
}

async function main() {
  console.log('Step 1: fetching poem list...');
  const list = await fetchPoemList();
  console.log(`  found ${list.length} poems`);

  console.log('Step 2: fetching each poem page (rate-limited)...');
  const raw: Parameters<typeof normalize>[0] = [];
  let i = 0;
  for (const entry of list) {
    i++;
    try {
      const html = await cachedFetch(entry.url);
      const parsed = parsePoemPage(html, entry.url);
      raw.push(parsed);
      console.log(`  [${i}/${list.length}] ${parsed.title} — ${parsed.poetName}`);
    } catch (err) {
      console.error(`  [${i}/${list.length}] FAILED ${entry.title}:`, err);
    }
    await rateLimitedDelay();
  }

  console.log(`Step 3: normalizing ${raw.length} poems...`);
  const { poets, poems } = normalize(raw);

  writeFileSync(POEMS_JSON, JSON.stringify(poems, null, 2));
  writeFileSync(POETS_JSON, JSON.stringify(poets, null, 2));
  console.log(`  wrote ${poems.length} poems, ${poets.length} poets`);
  console.log(`  -> ${POEMS_JSON}`);
  console.log(`  -> ${POETS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
