// 朝代常量表。所有 dynastyId 取值必须在此表中，否则 getDynastyName 兜底 '唐'。
// 数据范围：先秦南北朝 → 民国初。1976 是毛泽东逝世纪念的近现代截止年。

export const DYNASTIES = {
  other:  { name: '南北朝', startYear: 386,  endYear: 589 },
  tang:   { name: '唐',     startYear: 618,  endYear: 907 },
  song:   { name: '宋',     startYear: 960,  endYear: 1279 },
  ming:   { name: '明',     startYear: 1368, endYear: 1644 },
  qing:   { name: '清',     startYear: 1644, endYear: 1912 },
  modern: { name: '近现代', startYear: 1912, endYear: 1976 },
} as const;

export type DynastyId = keyof typeof DYNASTIES;

export const getDynastyName = (id: string): string => DYNASTIES[id as DynastyId]?.name ?? '唐';

export const getDynasty = (id: string): Readonly<{ name: string; startYear: number; endYear: number }> | undefined =>
  DYNASTIES[id as DynastyId];
