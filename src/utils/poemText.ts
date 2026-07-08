// Pure utilities for poem text rendering. Three concerns:
// 1. Strip inline "(X 一作：Y)" / "(X 通：Y)" variant notes from poem content.
// 2. Choose a layout mode (short vs long) based on cleaned text length.
// 3. Split cleaned text into display lines per mode.

export type PoemMode = 'short' | 'long';
export type VariantKind = '一作' | '通';

export interface Variant {
  original: string;
  variant: string;
  kind: VariantKind;
}

export interface ExtractResult {
  cleanText: string;
  variants: Variant[];
}

// Threshold: 80 chars covers 5绝 (24), 7绝 (32), 5律 (48), 7律 (64) with
// punctuation. Longer Old-style / 歌行 / long 词 forms exceed 80.
const SHORT_POEM_THRESHOLD = 80;

// Match a full-width paren and capture its inner content (no nesting).
const PAREN_RE = /\(([^()]+)\)/g;

// Inside a variant paren, each ;-separated piece looks like:
//   <original> 一作： <variant>   |   <original> 通： <variant>
// Colon may be full-width (：) or half-width (:). Whitespace tolerant.
const VARIANT_PIECE_RE = /^(.+?)\s+(一作|通)\s*[：:]\s*(.+)$/;

/**
 * Pull every `(X 一作：Y)` / `(X 通：Y)` annotation out of the body. A paren is
 * treated as a variant group only when EVERY `；`-separated piece inside it
 * matches the variant pattern — so ordinary asides like `（注释）` stay put.
 */
export function extractVariants(content: string): ExtractResult {
  const variants: Variant[] = [];
  const cleanText = content.replace(PAREN_RE, (full, inside: string) => {
    const pieces = inside.split(/[；;]/).map((s) => s.trim());
    const parsed: Variant[] = [];
    for (const piece of pieces) {
      const m = piece.match(VARIANT_PIECE_RE);
      if (!m) return full; // not a variant piece → keep whole paren verbatim
      parsed.push({
        original: m[1].trim(),
        kind: m[2] as VariantKind,
        variant: m[3].trim(),
      });
    }
    if (parsed.length === 0) return full;
    variants.push(...parsed);
    return ''; // strip from body
  });
  return { cleanText, variants };
}

export function getPoemMode(cleanText: string): PoemMode {
  return cleanText.length <= SHORT_POEM_THRESHOLD ? 'short' : 'long';
}

// Short mode splits on every clause terminator; long mode only on sentence
// terminators (keeps ，-joined couplets on one line). `*` allows empty leading
// segment so consecutive terminators don't crash; trailing non-terminated text
// is appended as its own line.
const SHORT_LINE_RE = /[^，。？！；]*[，。？！；]/g;
const LONG_LINE_RE = /[^。？！]*[。？！]/g;

export function splitIntoLines(content: string, mode: PoemMode): string[] {
  const re = mode === 'short' ? SHORT_LINE_RE : LONG_LINE_RE;
  const matches = content.match(re) || [];
  const consumed = matches.join('');
  const trailing = content.slice(consumed.length).trim();
  const lines = matches.map((s) => s.trim()).filter((s) => s.length > 0);
  if (trailing) lines.push(trailing);
  return lines.length > 0 ? lines : [content.trim()].filter((s) => s.length > 0);
}
