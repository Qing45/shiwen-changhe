export const colors = {
  bgGradient: 'linear-gradient(180deg, #050818 0%, #0a1430 40%, #152548 70%, #0a1430 100%)',
  riverLine: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.5) 8%, rgba(240,244,255,0.85) 50%, rgba(216,224,240,0.5) 92%, transparent 100%)',
  riverGlow: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.1) 8%, rgba(240,244,255,0.18) 50%, rgba(216,224,240,0.1) 92%, transparent 100%)',
  highlight: '#ffffff',
  highlightShadow: '0 0 8px rgba(255,255,255,0.85)',
  textPrimary: '#e8f0ff',
  textSecondary: '#a8b8d8',
  textTertiary: '#8a98b8',
  textDim: '#6478a0',
  textFaint: '#5a6885',
} as const;

export const fontSizes = {
  body: 14,
  meta: 14,
  nodeDefault: 16,
  nodeLarge: 20,
  nodeFocal: 26,
  poemTitle: 26,
  poemTextShort: 20,
  poemTextLong: 17,
  sectionTitle: 16,
} as const;

export const nodeSizes: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 18,
  5: 22,
};

// Map a poet's poem count to a node radius in px. Sqrt scaling so a 9-poem
// poet is noticeably bigger than a 1-poem poet but a 36-poet poet isn't 36×
// the size. Range [8, 24].
export function poemCountToSize(count: number): number {
  return Math.max(8, Math.min(24, 6 + Math.sqrt(count) * 3));
}

// Map a poem's content length (chars) to a node radius in px. Sqrt scaling so
// a 1000-char poem isn't 40× a 25-char poem. Empirical distribution (320
// poems): min 24, median 48, p75 72, p90 155, max 1029 — formula yields ~12
// for min, ~14 median, ~16 p75, ~21 p90, capped 24 for the long ones.
export function contentLengthToSize(len: number): number {
  return Math.max(8, Math.min(24, 6 + Math.sqrt(len) * 1.2));
}

export const fontFamilies = {
  chinese: "'KaiTi', 'STKaiti', 'STZhongsong', 'SimSun', serif",
} as const;

// 纸面配色：StagePlay / SentencePlay / TitlePlay / PoemPage 局部使用同一组
// 暖色调（古卷感）。原来每页各自定义一份，改动易漂移；这里集中导出。
export const paperTheme = {
  bg: 'rgba(245, 235, 210, 0.85)',   // 纸面底色（仅 PoemPage 用）
  text: '#000000',                    // 正文 / 标题
  textSoft: '#000000',                // 元信息（与正文统一；PoemPage 区分声明）
  textDim: '#8b7355',                 // 段落标题 / 次要文字
  green: '#4a7c4a',                   // 正确反馈
  red: '#a8302a',                     // 错误反馈 / 通关印章
} as const;
