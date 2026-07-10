import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = resolve(here, '.cache');

export const RATE_LIMIT_MS = 2000;
export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

export async function rateLimitedDelay(wasCached = false): Promise<void> {
  if (wasCached) return;
  return new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}

export async function cachedFetch(url: string): Promise<{ html: string; cached: boolean }> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = resolve(
    CACHE_DIR,
    Buffer.from(url).toString('base64url').slice(0, 80) + '.html',
  );
  if (existsSync(cacheFile)) {
    return { html: readFileSync(cacheFile, 'utf-8'), cached: true };
  }
  console.log(`  fetching ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  // Don't cache gushiwen anti-bot login-redirect stubs — they'd poison retries.
  if (html.length < 6000 && html.includes('user/login.aspx')) {
    return { html, cached: false };
  }
  writeFileSync(cacheFile, html);
  return { html, cached: false };
}
