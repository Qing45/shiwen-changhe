import { SENIOR_BAND_VALUES } from '../data/grades';

const KEY = 'shiwen-feihua-senior-grade';

// 高中段默认 'gz3l'（=全部 41 首累积）。用户切换段位时按 gz1u→gz3l 顺序累积显示。
const DEFAULT_BAND = 'gz3l';

export function loadSeniorGrade(): string {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw != null && SENIOR_BAND_VALUES.includes(raw)) return raw;
  } catch {
    // localStorage 不可用
  }
  return DEFAULT_BAND;
}

export function saveSeniorGrade(band: string): void {
  if (!SENIOR_BAND_VALUES.includes(band)) return;
  try {
    window.localStorage.setItem(KEY, band);
  } catch {
    // 忽略
  }
}