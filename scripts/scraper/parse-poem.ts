import * as cheerio from 'cheerio';
import type { GradeBand } from '../../src/types';

export interface RawAnnotation {
  term: string;
  explanation: string;
}

export interface RawPoem {
  url: string;
  title: string;
  poetName: string;
  content: string;
  annotations: RawAnnotation[];
  background?: string;
  // 仅 junior 抓取时使用：标明这首诗所属的初中段（七上/七下/...）。
  // tang / primary 源始终 undefined。
  gradeBand?: GradeBand;
}

/**
 * Strip the dynasty suffix from a poet label like "王之涣〔唐代〕" -> "王之涣".
 * Handles full-width/half-width brackets: [ ] 〔 〕 （ ） 〈 〉 < >.
 * Falls back to the original string if no bracket is found.
 */
function cleanPoetName(raw: string): string {
  // Strip any dynasty/affix that follows the poet name. gushiwen.cn uses the
  // full-width tortoise-shell bracket 〔〕 (U+3014/U+3015), so match up to any
  // of the common opening brackets incl. 〔.
  const m = raw.match(/^([^[【〈（(〈<〔〖]+)/);
  return (m ? m[1] : raw).trim();
}

/**
 * Parse the annotation paragraph from a "译文及注释" block.
 *
 * Real gushiwen.cn format observed on fixture: a single <p> beginning with the
 * literal prefix "注释", followed by concatenated entries of the form
 *   词：解释。
 * where a term may include pinyin groups like "鹳（guàn）雀（què）楼".
 * We strip the "注释" prefix, then scan for "term：" boundaries.
 */
function parseAnnotations(text: string): RawAnnotation[] {
  const cleaned = text.replace(/^\s*注释\s*/, '').trim();
  if (!cleaned) return [];

  // Term = CJK chars optionally interleaved with pinyin groups in （）,
  // plus spaces. Must be short (<=20 chars) so we don't swallow explanations.
  const termChar = '[\\u4e00-\\u9fff（）a-zà-ÿ\\s]{1,20}';
  const re = new RegExp(
    `(${termChar})[：:]((?:(?!${termChar}[：:]).)+)`,
    'g',
  );

  const out: RawAnnotation[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const term = m[1].trim();
    const explanation = m[2].trim();
    if (term && explanation) {
      out.push({ term, explanation });
    }
  }
  return out;
}

/**
 * Parse a single gushiwen.cn poem page.
 *
 * Selectors verified against a real fixture (登鹳雀楼, shiwenv_c90ff9ea5a71.aspx):
 * - Title:   first <h1>
 * - Poet:    first <p class="source"> text
 * - Content: first <div class="contson">
 * - Annotations / background: <div class="contyishang"> blocks, each with an
 *   <h2><span>HEADING</span></h2> describing its role ("译文及注释", "创作背景", ...).
 */
export function parsePoemPage(html: string, url: string): RawPoem {
  const $ = cheerio.load(html);

  const title = $('h1').first().text().trim();

  const poetName = cleanPoetName($('.source').first().text().trim());

  const content = $('.contson').first().text().trim();

  let annotations: RawAnnotation[] = [];
  let background: string | undefined;

  $('.contyishang').each((_, block) => {
    const $block = $(block);
    const heading = $block.find('h2 span').first().text().trim();

    if (heading.includes('注') || heading.includes('译文')) {
      // The annotation paragraph: gushiwen.cn concatenates all entries into a
      // single <p> that begins with "注释". Prefer the <p> whose text starts
      // with "注释"; fall back to scanning every <p>.
      const ps = $block.find('p').toArray();
      for (const p of ps) {
        const t = $(p).text().trim();
        if (t.startsWith('注释') || t.includes('：')) {
          const found = parseAnnotations(t);
          if (found.length > 0) {
            annotations = found;
            break;
          }
        }
      }
    }

    if (heading.includes('背景') || heading.includes('创作')) {
      // Background block: text sits as the block's own text content (not in
      // <p> tags). Grab the block's full text, drop the heading word, and trim
      // the "展开阅读全文" UI affordance.
      const full = $block
        .text()
        .replace(heading, '')
        .replace(/展开阅读全文\s*▾?/g, '')
        .replace(/　+/g, ' ')
        .trim();
      if (full.length > 20) {
        background = full;
      }
    }
  });

  return { url, title, poetName, content, annotations, background };
}
