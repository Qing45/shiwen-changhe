import { describe, it, expect } from 'vitest';
import { getPoems } from './load';
import {
  GRADE_BANDS,
  MAX_BAND,
  PRIMARY_GRADE_BAND_BY_POEM_ID,
  SENIOR_BANDS,
  SENIOR_BAND_VALUES,
  getAvailableBands,
  getAvailableSeniorBands,
  getPoemsForPlay,
  getPrimaryPoemsUpTo,
  getSeniorPoemsUpTo,
  isSeniorBand,
  normalizeBand,
} from './grades';

describe('primary grade bands', () => {
  it('defines the 12 grade-semester endpoints', () => {
    expect(GRADE_BANDS.map((b) => b.label)).toEqual([
      '一上', '一下', '二上', '二下', '三上', '三下',
      '四上', '四下', '五上', '五下', '六上', '六下',
    ]);
    expect(GRADE_BANDS.map((b) => b.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(MAX_BAND).toBe(12);
  });

  it('assigns every primary poem exactly one gradeBand that matches the mapping table', () => {
    const primary = getPoems('primary');
    expect(primary.length).toBe(108);
    expect(Object.keys(PRIMARY_GRADE_BAND_BY_POEM_ID).length).toBe(108);

    const mapping: Record<string, number> = PRIMARY_GRADE_BAND_BY_POEM_ID;
    for (const poem of primary) {
      expect(poem.id in mapping, `${poem.title} missing from mapping`).toBe(true);
      expect(poem.gradeBand, `${poem.title} gradeBand`).toBe(mapping[poem.id]);
      expect(poem.gradeBand).toBeGreaterThanOrEqual(1);
      expect(poem.gradeBand).toBeLessThanOrEqual(MAX_BAND);
    }

    const tangOnly = getPoems('tang').filter((p) => p.corpus === 'tang');
    expect(tangOnly.some((p) => p.gradeBand !== undefined)).toBe(false);
  });

  it('accumulates primary poems monotonically up to the selected band', () => {
    const expectedCumulative = [6, 13, 20, 27, 35, 45, 55, 62, 71, 79, 89, 108];
    let previous = 0;
    for (let band = 1; band <= MAX_BAND; band++) {
      const poems = getPrimaryPoemsUpTo(band);
      expect(poems.length).toBe(expectedCumulative[band - 1]);
      expect(poems.length).toBeGreaterThanOrEqual(previous);
      expect(poems.every((p) => typeof p.gradeBand === 'number' && p.gradeBand <= band)).toBe(true);
      previous = poems.length;
    }
  });

  it('band 12 is the full primary corpus and getPoemsForPlay applies band only to non-tang pools', () => {
    expect(getPrimaryPoemsUpTo(12).map((p) => p.id).sort()).toEqual(getPoems('primary').map((p) => p.id).sort());
    expect(getPoemsForPlay('primary', 5).map((p) => p.id)).toEqual(getPrimaryPoemsUpTo(5).map((p) => p.id));
    expect(getPoemsForPlay('both', 5).map((p) => p.id)).toEqual(getPrimaryPoemsUpTo(5).map((p) => p.id));
    expect(getPoemsForPlay('tang', 5).length).toBe(getPoems('tang').length);
  });

  it('shows only endpoints whose own band has at least one poem', () => {
    expect(getAvailableBands().map((b) => b.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('normalizes corrupt or out-of-range band values to MAX_BAND', () => {
    expect(normalizeBand(1)).toBe(1);
    expect(normalizeBand(12)).toBe(12);
    expect(normalizeBand(0)).toBe(MAX_BAND);
    expect(normalizeBand(13)).toBe(MAX_BAND);
    expect(normalizeBand(3.5)).toBe(MAX_BAND);
    expect(normalizeBand(Number.NaN)).toBe(MAX_BAND);
  });
});

describe('senior grade bands', () => {
  it('defines the 5 senior grade-semester endpoints', () => {
    expect(SENIOR_BANDS.map((b) => b.label)).toEqual([
      '高一上', '高一下', '高二上', '高二下', '高三下',
    ]);
    expect(SENIOR_BAND_VALUES).toEqual(['gz1u', 'gz1l', 'gz2u', 'gz2l', 'gz3l']);
  });

  it('isSeniorBand accepts only the five valid values', () => {
    expect(isSeniorBand('gz1u')).toBe(true);
    expect(isSeniorBand('gz3l')).toBe(true);
    expect(isSeniorBand('9b')).toBe(false);
    expect(isSeniorBand('high1')).toBe(false);
    expect(isSeniorBand(5)).toBe(false);
    expect(isSeniorBand(null)).toBe(false);
  });

  it('getAvailableSeniorBands returns only bands with at least one poem', () => {
    const available = getAvailableSeniorBands().map((b) => b.value);
    // 5 段都应该至少有一首诗
    expect(available).toEqual(['gz1u', 'gz1l', 'gz2u', 'gz2l', 'gz3l']);
  });

  it('senior corpus contains 41 PEP-required poems (高中必背)', () => {
    // 人教版 2017 课标：高一 21 首（16 上 + 6 下，减去阿房宫赋等归类差异），高二 8，
    // 高三 11（含 离骚 + 孔雀东南飞）= 41。回归测试：后续不要掉数。
    expect(getPoems('senior').length).toBe(41);
  });

  it('accumulates senior poems monotonically up to the selected band', () => {
    const expected = [16, 22, 26, 30, 41];
    let previous = 0;
    for (let i = 0; i < SENIOR_BAND_VALUES.length; i++) {
      const band = SENIOR_BAND_VALUES[i];
      const poems = getSeniorPoemsUpTo(band);
      expect(poems.length).toBe(expected[i]);
      expect(poems.length).toBeGreaterThanOrEqual(previous);
      previous = poems.length;
    }
  });

  it('senior pool includes tang poems whose gradeBands list a gz band', () => {
    // 蜀道难 / 登高 / 将进酒 等 9 首原本就在 tang 的诗，加 gradeBands='gz*'
    // 后也属于 senior —— 通过 poemInCorpus 的 gradeBands 跨库判定。
    const senior = new Set(getPoems('senior').map((p) => p.id));
    const tangSet = new Set(getPoems('tang').map((p) => p.id));
    const shared = ['蜀道难', '登高', '将进酒', '锦瑟', '蜀相'];
    for (const title of shared) {
      const tangPoem = getPoems('tang').find((p) => p.title === title);
      expect(tangPoem).toBeDefined();
      expect(tangSet.has(tangPoem!.id)).toBe(true);
      expect(senior.has(tangPoem!.id)).toBe(true);
    }
  });
});
