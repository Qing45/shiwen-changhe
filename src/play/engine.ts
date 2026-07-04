import { getPoems, getPoet } from '../data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';
import { KEYWORDS } from './keywords';
import type { Verse } from './types';

// 一次性扫描 320 首诗，构建「关键字 -> 含该字的诗句列表」索引。
// 切句规则：先剥异文 -> 选 mode（短/长）-> splitIntoLines -> 每句独立判定。
export function buildKeywordIndex(): Map<string, Verse[]> {
  const index = new Map<string, Verse[]>();
  for (const k of KEYWORDS) index.set(k, []);

  for (const poem of getPoems()) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (const line of lines) {
      // 去标点后判定含字，但 line 字段保留原句（含标点）作为题面。
      const stripped = line.replace(/[，。？！；：、,\.\?!;:]/g, '');
      for (const k of KEYWORDS) {
        if (stripped.includes(k)) {
          index.get(k)!.push({
            poemId: poem.id,
            line: line.trim(),
            poemTitle: poem.title,
            poetName: poet.name,
          });
        }
      }
    }
  }

  return index;
}

// 模块级懒加载缓存：首次调用时构建，之后直接返回同一份 Map。
let _cache: Map<string, Verse[]> | null = null;

export function getKeywordIndex(): Map<string, Verse[]> {
  if (_cache === null) _cache = buildKeywordIndex();
  return _cache;
}

export function getVersesFor(keyword: string): Verse[] {
  return getKeywordIndex().get(keyword) ?? [];
}
