// 抓取初中必背诗。按 JUNIOR_LIST（按 6 个学期段分组）逐首走 gushiwen 搜索接口，
// 在搜索结果页迭代挑选 poetName 匹配的那一条；找不到匹配时返回 null 并打日志。
// 与 primary.ts 同源策略：严格匹配诗人名（含别名），避免同题异作者误抓。
//
// 五首搜索查不到的诗通过 MANUAL_PATCHES 喂 canonical URL 绕过（见下方注释）。
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

// 五首 gushiwen 搜索接口查不到的诗 — 直接喂 canonical URL 绕过搜索结果匹配。
// 出现原因：
//   - 「江南逢李龟年 / 行军九日思长安故园 / 秋词 / 十一月四日风雨大作」：搜索
//     返回的相关结果是其它题材相近的诗，而非目标诗。
//   - 「夜上受降城闻笛」：搜索接口未索引（已用诗人 + 关键词组合尝试）。
// titleOverride 处理 gushiwen 页标题带后缀（"秋词二首·其一"、"十一月四日风雨大作二首"）。
// contentOverride 用于页内含多首诗（如十一月四日风雨大作二首含两首）只取所需一首。
// poetOverride 用于 gushiwen 把诗人标为「《乐府诗集》」等需归一化名时（如 十五从军征 → 汉乐府），
// 此时通用 POET_NAME_ALIASES 无法判断（乐府诗集 已映射到 北朝民歌 给敕勒歌用），需 per-poem 指定。
interface ManualPatch {
  url: string;
  titleOverride?: string;
  contentOverride?: string;
  poetOverride?: string;
}
const MANUAL_PATCHES: Record<string, ManualPatch> = {
  // 7a
  '江南逢李龟年|杜甫': { url: `${BASE}/shiwenv_514b8bc0ee4f.aspx` },
  '行军九日思长安故园|岑参': { url: `${BASE}/shiwenv_1a98a1d6bae1.aspx` },
  '夜上受降城闻笛|李益': { url: `${BASE}/gushiwen_77b77f9e10.aspx` },
  '秋词|刘禹锡': {
    url: `${BASE}/shiwenv_4995f2f0581b.aspx`,
    titleOverride: '秋词',
  },
  '十一月四日风雨大作|陆游': {
    url: `${BASE}/shiwenv_38c4a0c84fe9.aspx`,
    titleOverride: '十一月四日风雨大作',
    // gushiwen 此页含两首（七年级上册只要求第二首"僵卧孤村不自哀…"）
    contentOverride: '僵卧孤村不自哀，尚思为国戍轮台。夜阑卧听风吹雨，铁马冰河入梦来。',
  },
  // 7b — 7 首搜索不返回目标诗（多因被相近诗的题材占满首页）
  '游山西村|陆游': { url: `${BASE}/shiwenv_09294abb5f67.aspx` },
  '竹里馆|王维': { url: `${BASE}/shiwenv_4809b5e7a16a.aspx` },
  '春夜洛城闻笛|李白': { url: `${BASE}/shiwenv_be1894114330.aspx` },
  '逢入京使|岑参': { url: `${BASE}/shiwenv_10d21c96ba71.aspx` },
  '晚春|韩愈': {
    url: `${BASE}/shiwenv_9aadcdc29984.aspx`,
    titleOverride: '晚春',
  },
  '过松源晨炊漆公店|杨万里': { url: `${BASE}/shiwenv_9b06cd24ed3a.aspx` },
  '约客|赵师秀': { url: `${BASE}/shiwenv_c1537124e930.aspx` },
  '登幽州台歌|陈子昂': { url: `${BASE}/shiwenv_4083a01ac833.aspx` },
  // 8a — 6 首搜索不返回目标诗（多因被同作者/同题材热门诗占满首页）
  '使至塞上|王维': { url: `${BASE}/shiwenv_eae647c5c110.aspx` },
  '渡荆门送别|李白': { url: `${BASE}/shiwenv_d50eb19399e6.aspx` },
  '庭中有奇树|佚名': { url: `${BASE}/shiwenv_d4f03889eaad.aspx` },
  '龟虽寿|曹操': { url: `${BASE}/shiwenv_d78b6331098e.aspx` },
  '赠从弟|刘桢': { url: `${BASE}/shiwenv_2d0c9ade951e.aspx` },
  '如梦令|李清照': { url: `${BASE}/shiwenv_3e33bfbb8f79.aspx` },
  // 8b — 11 首搜索不返回目标诗。诗经 4 首在 gushiwen 标「诗经·国风·XX」需走 canonical；
  // 其它多为同作者热门诗占满首页或题名带词牌「卜算子」混淆。
  '关雎|佚名': { url: `${BASE}/shiwenv_4c5705b99143.aspx` },
  '蒹葭|佚名': { url: `${BASE}/shiwenv_15cd220102d6.aspx` },
  '式微|佚名': { url: `${BASE}/shiwenv_0e1fe871ec57.aspx` },
  '子衿|佚名': { url: `${BASE}/shiwenv_cfe0289eb931.aspx` },
  '送杜少府之任蜀州|王勃': { url: `${BASE}/shiwenv_5775c79bcd34.aspx` },
  '茅屋为秋风所破歌|杜甫': { url: `${BASE}/shiwenv_8e9ecc95d6a4.aspx` },
  '卖炭翁|白居易': { url: `${BASE}/shiwenv_2716dfb4d439.aspx` },
  '题破山寺后禅院|常建': { url: `${BASE}/shiwenv_e2890c61279c.aspx` },
  '卜算子·黄州定慧院寓居作|苏轼': { url: `${BASE}/shiwenv_c1a07129a6d3.aspx` },
  '卜算子·咏梅|陆游': { url: `${BASE}/shiwenv_2523dc7baa84.aspx` },
  // 9a — 9 首搜索不返回目标诗（多为同作者热门诗占满首页）。
  // 水调歌头 / 行香子 spec 用词牌名，gushiwen 标题带具体首句后缀需 titleOverride。
  '沁园春·雪|毛泽东': { url: `${BASE}/shiwenv_202a800b9239.aspx` },
  '酬乐天扬州初逢席上见赠|刘禹锡': { url: `${BASE}/shiwenv_f6c40e3d4893.aspx` },
  '水调歌头|苏轼': {
    url: `${BASE}/shiwenv_632c5beb84eb.aspx`,
    titleOverride: '水调歌头',
  },
  '月夜忆舍弟|杜甫': { url: `${BASE}/shiwenv_ad6f7cfa10c2.aspx` },
  '长沙过贾谊宅|刘长卿': { url: `${BASE}/shiwenv_a9a0b6b0eede.aspx` },
  '左迁至蓝关示侄孙湘|韩愈': { url: `${BASE}/shiwenv_076cedfce20c.aspx` },
  '商山早行|温庭筠': { url: `${BASE}/shiwenv_8d18260838e2.aspx` },
  '行香子|秦观': {
    url: `${BASE}/shiwenv_8005cc89b888.aspx`,
    titleOverride: '行香子',
  },
  '丑奴儿·书博山道中壁|辛弃疾': { url: `${BASE}/shiwenv_2ee36eb2ccf7.aspx` },
  // 9b — 14 首搜索不返回目标诗。词牌名（江城子/破阵子/南乡子/太常引）和散曲（山坡羊/朝天子）在
  // gushiwen 多有同调异名作；长诗（过零丁洋/南安军/别云间）则被同作者热门作占满首页。
  // 满江红/定风波 搜索能找到，无需 patch；浣溪沙 搜索会命中最热门的「谁念西风独自凉」而非课本
  // 「身向云山那畔行」，必须走 canonical。
  '浣溪沙|纳兰性德': { url: `${BASE}/shiwenv_7e5b6ca97ef2.aspx` },
  '江城子·密州出猎|苏轼': { url: `${BASE}/shiwenv_85b8792a66ac.aspx` },
  '破阵子·为陈同甫赋壮词以寄之|辛弃疾': { url: `${BASE}/shiwenv_9822debcdc64.aspx` },
  '十五从军征|汉乐府': {
    url: `${BASE}/shiwenv_5f6efd08156d.aspx`,
    // gushiwen 把这首标为「《乐府诗集》」；通用 alias 已把 乐府诗集 占给 北朝民歌（敕勒歌用），
    // 这里 per-poem 指定回 汉乐府 与课本对齐。
    poetOverride: '汉乐府',
  },
  '白雪歌送武判官归京|岑参': { url: `${BASE}/shiwenv_444df93c9bdf.aspx` },
  '南乡子·登京口北固亭有怀|辛弃疾': { url: `${BASE}/shiwenv_3cfc9856b57a.aspx` },
  '过零丁洋|文天祥': { url: `${BASE}/shiwenv_5796865dca4a.aspx` },
  '山坡羊·潼关怀古|张养浩': { url: `${BASE}/shiwenv_1bd53945715b.aspx` },
  '临江仙·夜登小阁忆洛中旧游|陈与义': { url: `${BASE}/shiwenv_ac19428da949.aspx` },
  '太常引·建康中秋夜为吕叔潜赋|辛弃疾': { url: `${BASE}/shiwenv_9d2a73f5e3bd.aspx` },
  '南安军|文天祥': { url: `${BASE}/shiwenv_04c121ce6a85.aspx` },
  '别云间|夏完淳': { url: `${BASE}/shiwenv_d01bc3fbb10b.aspx` },
  '山坡羊·骊山怀古|张养浩': { url: `${BASE}/shiwenv_614c91077b60.aspx` },
  '朝天子·咏喇叭|王磐': { url: `${BASE}/shiwenv_dff01ff4925b.aspx` },
};

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
    const manual = MANUAL_PATCHES[`${entry.title}|${entry.poetName}`];
    try {
      let detailUrl: string | null = null;
      let searchWasCached = true;
      if (manual) {
        // 直接喂 canonical URL，不走搜索（节省一次 rate limit 延迟）。
        detailUrl = manual.url;
      } else {
        const searchUrl = `${BASE}/search.aspx?value=${encodeURIComponent(entry.title)}`;
        const search = await cachedFetch(searchUrl);
        searchWasCached = search.cached;
        detailUrl = extractMatchingPoemUrl(search.html, entry.poetName);
        if (!detailUrl) {
          console.error(`  [${i + 1}/${flat.length}] ${entry.title} (${entry.poetName}, ${entryBand}): no matching result on gushiwen`);
          await rateLimitedDelay(search.cached);
          continue;
        }
      }
      const detail = await cachedFetch(detailUrl);
      const parsed = parsePoemPage(detail.html, detailUrl);
      const patched = manual
        ? {
            ...parsed,
            title: manual.titleOverride ?? parsed.title,
            content: manual.contentOverride ?? parsed.content,
            poetName: manual.poetOverride ?? parsed.poetName,
          }
        : parsed;
      out.push({ ...patched, gradeBand: entryBand });
      console.log(`  [${i + 1}/${flat.length}] ${patched.title} — ${patched.poetName} (${entryBand})${manual ? ' [manual]' : ''}`);
      await rateLimitedDelay(detail.cached && searchWasCached);
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