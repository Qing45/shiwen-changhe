// 抓取小学必背诗。按 PRIMARY_LIST 逐首走 gushiwen 搜索接口，
// 在搜索结果页迭代，挑选 poetName 匹配的那一条；找不到匹配时返回 null。
// 严格匹配避免「同题异作者」误抓（例如望洞庭曾抓到孟浩然而非刘禹锡、
// 忆江南搜索首条是苏轼的望江南·超然台作）。
import * as cheerio from 'cheerio';
import { cachedFetch, rateLimitedDelay } from './index-helpers';
import { parsePoemPage } from './parse-poem';
import { PRIMARY_LIST } from './primary-list';
import type { RawPoem } from './parse-poem';

const BASE = 'https://www.gushiwen.cn';

// 民歌/乐府类诗人在 spec 与 gushiwen 间标签不同，统一化匹配。
// spec 用「北朝民歌」「汉乐府」，gushiwen 多归到「乐府诗集」「佚名」。
const POET_ALIASES: Record<string, string[]> = {
  北朝民歌: ['乐府诗集', '乐府民歌', '佚名'],
  汉乐府: ['乐府诗集', '乐府民歌', '佚名'],
  佚名: ['乐府诗集', '乐府民歌', '北朝民歌', '汉乐府'],
};

function poetMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  const aliases = POET_ALIASES[expected];
  return !!aliases && aliases.includes(actual);
}

export async function fetchPrimary(): Promise<RawPoem[]> {
  const out: RawPoem[] = [];
  for (let i = 0; i < PRIMARY_LIST.length; i++) {
    const entry = PRIMARY_LIST[i];
    try {
      const searchUrl = `${BASE}/search.aspx?value=${encodeURIComponent(entry.title)}`;
      const search = await cachedFetch(searchUrl);
      const detailUrl = extractMatchingPoemUrl(search.html, entry.poetName);
      if (!detailUrl) {
        console.error(`  [${i + 1}/${PRIMARY_LIST.length}] ${entry.title} (${entry.poetName}): no matching result on gushiwen`);
        await rateLimitedDelay(search.cached);
        continue;
      }
      const detail = await cachedFetch(detailUrl);
      const parsed = parsePoemPage(detail.html, detailUrl);
      out.push(parsed);
      console.log(`  [${i + 1}/${PRIMARY_LIST.length}] ${parsed.title} — ${parsed.poetName}`);
      await rateLimitedDelay(detail.cached && search.cached);
    } catch (err) {
      console.error(`  [${i + 1}/${PRIMARY_LIST.length}] FAILED ${entry.title}:`, err);
    }
  }
  return out;
}

// 从搜索结果页解析所有结果，返回 (title, poet, url) 列表。
function extractSearchResults(html: string): Array<{ poet: string; url: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ poet: string; url: string }> = [];
  // gushiwen 搜索结果每条包裹在 <div id="zhengwenXXX"> 内：
  //   <div id="zhengwen_xxx">
  //     <p><a href="/shiwenv_xxx.aspx"><span class="timu">标题</span></a></p>
  //     ...
  //     <p class="source"><a><img alt="诗人名" />诗人名</a>...</p>
  //   </div>
  // 逐块扫描，从块内取 shiwenv URL 与 source img.alt，避免被中间 <div> 隔断。
  $('div[id^="zhengwen"]').each((_, block) => {
    const $block = $(block);
    const titleA = $block.find('a[href*="shiwenv_"]').first();
    const href = titleA.attr('href');
    if (!href) return;
    const url = new URL(href, BASE).toString();
    if (results.some((r) => r.url === url)) return;
    const poet = $block.find('p.source img').attr('alt') || $block.find('p.source').text().replace(/〔[^〕]+〕/, '').trim();
    results.push({ poet: poet || '', url });
  });
  return results;
}

function extractMatchingPoemUrl(html: string, expectedPoet: string): string | null {
  const results = extractSearchResults(html);
  if (results.length === 0) return null;
  // 严格匹配：必须找到 poetName 匹配（含别名）的那一条，否则返回 null。
  // 旧版「回退首条」会引入同题异作者误抓（望江南·超然台作 等）。
  const match = results.find((r) => poetMatches(r.poet, expectedPoet));
  return match ? match.url : null;
}
