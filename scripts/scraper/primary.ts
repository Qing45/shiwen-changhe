// 抓取 112 首小学必背诗。按 PRIMARY_LIST 逐首走 gushiwen 搜索接口，
// 取第一条匹配的搜索结果，再用现有 parsePoemPage 解析详情。
import * as cheerio from 'cheerio';
import { cachedFetch, rateLimitedDelay } from './index-helpers';
import { parsePoemPage } from './parse-poem';
import { PRIMARY_LIST } from './primary-list';
import type { RawPoem } from './parse-poem';

const BASE = 'https://www.gushiwen.cn';

export async function fetchPrimary(): Promise<RawPoem[]> {
  const out: RawPoem[] = [];
  for (let i = 0; i < PRIMARY_LIST.length; i++) {
    const entry = PRIMARY_LIST[i];
    try {
      const searchUrl = `${BASE}/search.aspx?value=${encodeURIComponent(entry.title)}`;
      const searchHtml = await cachedFetch(searchUrl);
      const detailUrl = extractFirstPoemUrl(searchHtml);
      if (!detailUrl) {
        console.error(`  [${i + 1}/${PRIMARY_LIST.length}] ${entry.title}: no result on gushiwen`);
        continue;
      }
      const detailHtml = await cachedFetch(detailUrl);
      const parsed = parsePoemPage(detailHtml, detailUrl);
      out.push(parsed);
      console.log(`  [${i + 1}/${PRIMARY_LIST.length}] ${parsed.title} — ${parsed.poetName}`);
    } catch (err) {
      console.error(`  [${i + 1}/${PRIMARY_LIST.length}] FAILED ${entry.title}:`, err);
    }
    await rateLimitedDelay();
  }
  return out;
}

function extractFirstPoemUrl(html: string): string | null {
  const $ = cheerio.load(html);
  // gushiwen 搜索结果每条 item 含 <a href="/shiwenv_xxx.aspx">
  let firstUrl: string | null = null;
  $('a[href*="shiwenv_"]').each((_, el) => {
    if (firstUrl) return;
    const href = $(el).attr('href');
    if (href) firstUrl = new URL(href, BASE).toString();
  });
  return firstUrl;
}
