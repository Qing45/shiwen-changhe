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
  poemText: 18,
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

export const fontFamilies = {
  chinese: "'KaiTi', 'STKaiti', serif",
} as const;
