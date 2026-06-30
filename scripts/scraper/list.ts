import * as cheerio from 'cheerio';

export interface PoemListEntry {
  url: string;
  title: string;
}

const BASE = 'https://www.gushiwen.cn';

/**
 * Parse the 唐诗三百首 index HTML into a list of {url, title} entries.
 *
 * Selectors target gushiwen.cn's actual layout (verified against the saved
 * fixture): poem links are `<a>` elements inside `<div class="typecont">`
 * blocks, with href like `/shiwenv_XXXX.aspx`. The page groups the ~311
 * Tang-300 poems under 7 `typecont` category blocks (五言古诗, 七言古诗, ...),
 * which can repeat a poem, so results are deduped by URL.
 */
export function parsePoemList(html: string): PoemListEntry[] {
  const $ = cheerio.load(html);
  const entries: PoemListEntry[] = [];

  $('.typecont a').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const title = $(el).text().trim();
    if (!href.includes('shiwenv_') || !title) return;
    entries.push({ url: new URL(href, BASE).toString(), title });
  });

  // dedupe by url (index pages sometimes list a poem under multiple categories)
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
}

export async function fetchPoemList(): Promise<PoemListEntry[]> {
  const url = `${BASE}/gushi/tangshi.aspx`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch poem list: ${res.status}`);
  const html = await res.text();
  return parsePoemList(html);
}

// When run directly, fetch and print count
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchPoemList().then((entries) => {
    console.log(`Found ${entries.length} poems`);
    console.log(JSON.stringify(entries.slice(0, 3), null, 2));
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
