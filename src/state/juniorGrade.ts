import { JUNIOR_BAND_VALUES } from '../data/grades';

const KEY = 'shiwen-feihua-junior-grade';

// 初中段默认 '9b'（=全部 86 首累积）。用户切换段位时按 7a→9b 顺序累积显示。
const DEFAULT_BAND = '9b';

export function loadJuniorGrade(): string {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw != null && JUNIOR_BAND_VALUES.includes(raw)) return raw;
  } catch {
    // localStorage 不可用
  }
  return DEFAULT_BAND;
}

export function saveJuniorGrade(band: string): void {
  if (!JUNIOR_BAND_VALUES.includes(band)) return;
  try {
    window.localStorage.setItem(KEY, band);
  } catch {
    // 忽略
  }
}
