import type { Poem, PoemCorpus, GradeBand as GradeBandValue } from '../types';
import { getPoems } from './load';

// UI 选择器用的 band 元数据。value 类型与 types.GradeBand 对齐（number|string）。
export interface GradeBand {
  value: GradeBandValue;
  label: string;
}

// 小学段：1-12（数字，按 1-6 年级 × 上下学期编号）。
export const GRADE_BANDS: readonly GradeBand[] = [
  { value: 1, label: '一上' },
  { value: 2, label: '一下' },
  { value: 3, label: '二上' },
  { value: 4, label: '二下' },
  { value: 5, label: '三上' },
  { value: 6, label: '三下' },
  { value: 7, label: '四上' },
  { value: 8, label: '四下' },
  { value: 9, label: '五上' },
  { value: 10, label: '五下' },
  { value: 11, label: '六上' },
  { value: 12, label: '六下' },
];

export const MAX_BAND = 12;

// 初中段：'7a'-'9b'（7-9 年级 × 上下学期）。与小学段用不同 value 类型区分，
// 避免小学段的 7（=四上）与初中段 '7a'（=七年级上）混淆。
export const JUNIOR_BANDS: readonly GradeBand[] = [
  { value: '7a', label: '七上' },
  { value: '7b', label: '七下' },
  { value: '8a', label: '八上' },
  { value: '8b', label: '八下' },
  { value: '9a', label: '九上' },
  { value: '9b', label: '九下' },
];

// 所有有效的初中段字符串值，用于校验。
export const JUNIOR_BAND_VALUES: readonly string[] = JUNIOR_BANDS.map((b) => b.value as string);

export const PRIMARY_GRADE_BAND_BY_POEM_ID = {
  c90ff9ea5a71: 3,
  e9b1a8b4def0: 7,
  c35a60c1a8e2: 2,
  '63d3ff8f6b61': 11,
  ccee5691ba93: 2,
  '58313be2d918': 3,
  '40954072f541': 2,
  f433a64dd504: 8,
  d75a706935de: 6,
  '9312f5349cd7': 7,
  d3f231047aef: 10,
  '0f81015a040c': 5,
  caef25db347c: 7,
  f6bd6356c843: 6,
  '6fb73f607ad3': 9,
  f459f8ed8d23: 4,
  f26e62f4bfc8: 12,
  '44ba4afb80db': 9,
  b7820a12ebaa: 4,
  '4a0d548bebb3': 11,
  '519029b7355c': 10,
  '3963afd966bc': 10,
  b9e14c6e09aa: 7,
  '12a2295aa76b': 12,
  '161d06b0b556': 6,
  eeb3869b6242: 1,
  b6bd9a33dfd7: 1,
  ea761be0f016: 1,
  '04c68a9b161e': 1,
  '31dd7d07323c': 2,
  '846e626d74d3': 3,
  '200d28227643': 3,
  f996111bff75: 3,
  '425fb837c387': 4,
  '9936770100ef': 4,
  d88e3533fc4a: 4,
  '58699ebb5e93': 5,
  '3c36881bd247': 5,
  c987db20a4d7: 5,
  '7ccd1778ba07': 5,
  '97e6296bfb8d': 5,
  '8949464433f0': 5,
  '880912218fc8': 5,
  '84b5b3488790': 6,
  fbbd80710c5e: 6,
  '6ad0636b01a9': 6,
  a167901c9c90: 6,
  '5e26797704a7': 6,
  '0daa9748bcb5': 7,
  f2f5469a6044: 7,
  '8f1be8b774c2': 7,
  '4b3ccba01be6': 7,
  '20869108a51c': 11,
  '03e80e28a0c2': 8,
  '07f5e3403665': 8,
  c8414cce04e1: 9,
  e152d043be94: 9,
  '966c8a76211f': 9,
  '63f2cb1073ff': 9,
  d78d2dc95f06: 9,
  '0a4d69889c65': 9,
  ee72baa043c8: 8,
  '4c1364cb1da5': 9,
  be04bba6288c: 10,
  '8ec950bd1395': 10,
  dab95da71436: 10,
  '183d69f50755': 12,
  ba4626c44270: 11,
  '857567307e6a': 11,
  '33cbdb2cf9b3': 11,
  '2367f5ae6dee': 12,
  '55174e6ebe20': 12,
  d48451f00541: 12,
  '4b21381d3a76': 12,
  df14e6fd217b: 12,
  a9a16104dd1b: 12,
  '62087a6f': 1,
  '0fd5b47e': 1,
  '8388ae3b': 2,
  '94441bef': 2,
  dbcbb06e: 2,
  e7e0d52d: 3,
  f84a15b9: 3,
  b568bb8b: 4,
  f1442135: 4,
  '9c3a223e': 6,
  '7c70e45f': 6,
  '5fe2412f': 7,
  bd6891b0: 11,
  e17392f0: 12,
  '8e665500': 7,
  a8579c5c: 10,
  c466edb2: 8,
  '2448b323': 8,
  fb4dc4ce: 10,
  '3b04159f': 12,
  '70029042': 12,
  '7766a467': 11,
  '261d792c': 11,
  '2119d972': 11,
  '96b5e8a5': 12,
  a8d239f1: 12,
  c3687f97: 12,
  '68c412a8': 12,
  ffe0b931: 12,
  e6d5eb00: 12,
  '49f41b11': 12,
  c2bcb55b: 8,
} as const satisfies Record<string, number>;

export function normalizeBand(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= MAX_BAND ? value : MAX_BAND;
}

// 校验初中段字符串。合法值见 JUNIOR_BAND_VALUES。
export function isJuniorBand(value: unknown): value is string {
  return typeof value === 'string' && JUNIOR_BAND_VALUES.includes(value);
}

// 把诗的所有 gradeBand 收集到一个数组（合并 gradeBand + gradeBands）。
function collectBands(poem: Poem): GradeBandValue[] {
  const out: GradeBandValue[] = [];
  if (poem.gradeBand !== undefined) out.push(poem.gradeBand);
  if (poem.gradeBands) out.push(...poem.gradeBands);
  return out;
}

export function getPrimaryPoemsUpTo(band: number): Poem[] {
  const normalized = normalizeBand(band);
  return getPoems('primary').filter((p) => {
    const bands = collectBands(p);
    return bands.some((b) => typeof b === 'number' && b <= normalized);
  });
}

// 初中段：返回该段及更早段的全部诗。段顺序按 7a < 7b < 8a < 8b < 9a < 9b。
export function getJuniorPoemsUpTo(band: string): Poem[] {
  const idx = JUNIOR_BAND_VALUES.indexOf(band);
  if (idx < 0) return getPoems('junior');
  const upTo = JUNIOR_BAND_VALUES.slice(0, idx + 1);
  return getPoems('junior').filter((p) => {
    const bands = collectBands(p).filter((b): b is string => typeof b === 'string');
    return bands.some((b) => upTo.includes(b));
  });
}

// 小学段（value 永为 number）的窄类型，便于 GradeSelector 直接消费。
export interface PrimaryBand {
  value: number;
  label: string;
}

export function getAvailableBands(): PrimaryBand[] {
  const present = new Set<number>(
    getPoems('primary')
      .flatMap((p) => collectBands(p))
      .filter((b): b is number => typeof b === 'number'),
  );
  return GRADE_BANDS.filter((b) => present.has(b.value as number)) as unknown as PrimaryBand[];
}

// 初中段端点筛选：仅返回该年级有 ≥1 首诗的段。
export function getAvailableJuniorBands(): GradeBand[] {
  const present = new Set<string>(
    getPoems('junior')
      .flatMap((p) => collectBands(p))
      .filter((b): b is string => typeof b === 'string'),
  );
  return JUNIOR_BANDS.filter((b) => present.has(b.value as string));
}

// band 参数类型扩为支持初中段字符串。primary 走 cumulative、junior 走 cumulative、tang 忽略。
export function getPoemsForPlay(corpus: PoemCorpus, band?: number | string): Poem[] {
  if (corpus === 'junior' && band != null && typeof band === 'string') {
    return getJuniorPoemsUpTo(band);
  }
  if (corpus !== 'tang' && corpus !== 'junior' && band != null && typeof band === 'number') {
    return getPrimaryPoemsUpTo(band);
  }
  return corpus === 'both' ? getPoems() : getPoems(corpus);
}
