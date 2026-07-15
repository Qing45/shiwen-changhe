// 抓取初中必背诗。按 JUNIOR_LIST（按 6 个学期段分组）逐首走 gushiwen 搜索接口，
// 在搜索结果页迭代挑选 poetName 匹配的那一条；找不到匹配时返回 null 并打日志。
// 与 primary.ts 同源策略：严格匹配诗人名（含别名），避免同题异作者误抓。
//
// 用法：
//   fetchJunior()        — 抓全部 6 个段 86 首
//   fetchJunior('7a')    — 仅抓七年级上册 12 首（按段批跑）
import * as cheerio from 'cheerio';
import { cachedFetch, rateLimitedDelay } from './index-helpers';
import { parsePoemPage } from './parse-poem';
import { JUNIOR_LIST, type JuniorBand, type JuniorListEntry } from './junior-list';
import type { RawPoem } from './parse-poem';

const BASE = 'https://www.gushiwen.cn';

// 初中新增的诗人/作品在 spec 与 gushiwen 间标签不一致项统一化匹配。
// primary.ts 的别名也兼容此处（北朝民歌 / 汉乐府 / 佚名）。
const POET_ALIASES: Record<string, string[]> = {
  北朝民歌: ['乐府诗集', '乐府民歌', '佚名'],
  汉乐府: ['乐府诗集', '乐府民歌', '佚名'],
  佚名: ['乐府诗集', '乐府民歌', '北朝民歌', '汉乐府', '诗经', '古诗十九首'],
  诗经: ['佚名'],
  古诗十九首: ['佚名'],
};

function poetMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  const aliases = POET_ALIASES[expected];
  return !!aliases && aliases.includes(actual);
}

export async function fetchJunior(band?: JuniorBand): Promise<RawPoem[]> {
  // 展开成 (entry, band) 元组列表，方便日志标注段位。
  const allSections = band
    ? JUNIOR_LIST.filter((s) => s.band === band)
    : JUNIOR_LIST;
  const flat: { entry: JuniorListEntry; band: JuniorBand }[] = [];
  for (const section of allSections) {
    for (const entry of section.entries) {
      flat.push({ entry, band: section.band });
    }
  }

  const out: RawPoem[] = [];
  for (let i = 0; i < flat.length; i++) {
    const { entry, band: entryBand } = flat[i];
    try {
      const searchUrl = `${BASE}/search.aspx?value=${encodeURIComponent(entry.title)}`;
      const search = await cachedFetch(searchUrl);
      const detailUrl = extractMatchingPoemUrl(search.html, entry.poetName);
      if (!detailUrl) {
        console.error(`  [${i + 1}/${flat.length}] ${entry.title} (${entry.poetName}, ${entryBand}): no matching result on gushiwen`);
        await rateLimitedDelay(search.cached);
        continue;
      }
      const detail = await cachedFetch(detailUrl);
      const parsed = parsePoemPage(detail.html, detailUrl);
      out.push({ ...parsed, gradeBand: entryBand });
      console.log(`  [${i + 1}/${flat.length}] ${parsed.title} — ${parsed.poetName} (${entryBand})`);
      await rateLimitedDelay(detail.cached && search.cached);
    } catch (err) {
      console.error(`  [${i + 1}/${flat.length}] FAILED ${entry.title} (${entryBand}):`, err);
    }
  }
  return out;
}

// 复用 primary.ts 的搜索结果解析策略：从 zhengwen 块取 url + source img.alt。
function extractSearchResults(html: string): Array<{ poet: string; url: string }> {
  const $ = cheerio.load(html);
  const results: Array<{ poet: string; url: string }> = [];
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
  const match = results.find((r) => poetMatches(r.poet, expectedPoet));
  return match ? match.url : null;
}