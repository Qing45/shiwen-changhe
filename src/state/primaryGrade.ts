import { MAX_BAND, normalizeBand } from '../data/grades';

const KEY = 'shiwen-feihua-grade';

export function loadGrade(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw == null ? Number.NaN : parseInt(raw, 10);
    return normalizeBand(parsed);
  } catch {
    return MAX_BAND;
  }
}

export function saveGrade(band: number): void {
  try {
    window.localStorage.setItem(KEY, String(normalizeBand(band)));
  } catch {
    // localStorage 不可用时忽略，页面仍用当前 React state。
  }
}