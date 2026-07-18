import { describe, it, expect } from 'vitest';
import { computePercent, layoutPoets, layoutPoems, layoutAllPoems } from './layout';
import type { Poet, Poem } from '../types';

describe('computePercent', () => {
  it('returns 0 at min year', () => {
    expect(computePercent(618, 618, 907)).toBe(0);
  });

  it('returns 100 at max year', () => {
    expect(computePercent(907, 618, 907)).toBeCloseTo(100, 5);
  });

  it('returns 50 at midpoint', () => {
    expect(computePercent(762, 618, 907)).toBeCloseTo(49.8, 1);
  });

  it('clamps out-of-range years', () => {
    expect(computePercent(500, 618, 907)).toBe(0);
    expect(computePercent(1000, 618, 907)).toBe(100);
  });
});

describe('layoutPoets', () => {
  const poets: Poet[] = [
    { id: 'a', name: 'A', birthYear: 618, deathYear: 700, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    { id: 'b', name: 'B', birthYear: 700, deathYear: 770, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    { id: 'c', name: 'C', birthYear: 907, deathYear: 950, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
  ];

  it('sorts by birthYear and computes x position', () => {
    const result = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    expect(result[0].poet.id).toBe('a');
    expect(result[0].x).toBeCloseTo(5, 5);
    expect(result[2].poet.id).toBe('c');
    expect(result[2].x).toBeCloseTo(95, 5);
  });

  it('places poets in distinct columns at y=0', () => {
    const result = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    expect(result.every((p) => p.y === 0)).toBe(true);
  });

  it('scatters poets in 2D when they share an X column', () => {
    // All birthYear 700 → all in one column → must scatter without overlap
    const clustered: Poet[] = [
      { id: 'a', name: 'A', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
      { id: 'b', name: 'B', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
      { id: 'c', name: 'C', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    ];
    const result = layoutPoets(clustered, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    // Every position must be unique (no overlap)
    const keys = new Set(result.map((p) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`));
    expect(keys.size).toBe(3);
    // All within scatter bounds
    result.forEach((p) => {
      expect(Math.abs(p.y)).toBeLessThanOrEqual(40);
    });
  });

  it('keeps single-poet columns on the center line', () => {
    const single: Poet[] = [
      { id: 'solo', name: 'Solo', birthYear: 762, deathYear: 800, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    ];
    const result = layoutPoets(single, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    expect(result[0].y).toBe(0);
  });

  it('scatters a 12-poet column organically in 2D', () => {
    // 12 poets in one column — scatter layout produces a 2D cloud.
    const cluster: Poet[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i), name: String(i), birthYear: 700, deathYear: 750, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const,
    }));
    const range = { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 };
    const result = layoutPoets(cluster, range);
    // Every position must be unique (no overlap)
    const keys = new Set(result.map((p) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`));
    expect(keys.size).toBe(12);
    // Scatter, not stacked: multiple distinct X and Y values
    expect(new Set(result.map((p) => p.x.toFixed(2))).size).toBeGreaterThan(1);
    expect(new Set(result.map((p) => p.y.toFixed(2))).size).toBeGreaterThan(1);
    // Deterministic — same input gives same output across calls
    const result2 = layoutPoets(cluster, range);
    expect(result2.map((p) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`)).toEqual(
      result.map((p) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`),
    );
    // Cluster stays within the adaptive xRange of the nominal X. For n=12,
    // xRange = sqrt(12) * 12 ≈ 41.6. Scatter uses SCATTER_Y_RANGE (40).
    const expectedNominal = 5 + (((700 - 618) / (907 - 618)) * 100) * 0.9;
    result.forEach((p) => {
      expect(Math.abs(p.x - expectedNominal)).toBeLessThanOrEqual(42);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(40);
    });
  });

  it('preserves chronological order within a dense column (王勃 / 李白 junior case)', () => {
    // Regression: 初中 corpus has a dense Tang cluster where 王勃 (650) and
    // 李白 (701) — 51 years apart — were getting placed at nearly identical
    // x, y under the column-center scatter. Switching to per-item jitter
    // around each item's OWN nominal X lets the earlier poet stay left of
    // the later one.
    const wangBo: Poet = { id: 'wb', name: '王勃', birthYear: 650, deathYear: 676, dynastyId: 'tang', familiarity: 4, corpus: 'tang' as const };
    const liBai: Poet = { id: 'lb', name: '李白', birthYear: 701, deathYear: 762, dynastyId: 'tang', familiarity: 5, corpus: 'tang' as const };
    const result = layoutPoets([wangBo, liBai], { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
    const wbPos = result.find((p) => p.poet.id === 'wb')!;
    const lbPos = result.find((p) => p.poet.id === 'lb')!;
    // Chronologically earlier poet must NOT end up to the right of the later one.
    expect(wbPos.x).toBeLessThan(lbPos.x);
    // The 51-year gap (≈1.8% of corpus range) should leave visible separation.
    expect(lbPos.x - wbPos.x).toBeGreaterThan(0.5);
  });
});

describe('layoutPoems', () => {
  const poet: Poet = { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const };
  const poems: Poem[] = [
    { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 710, corpus: 'tang' as const },
    { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 750, corpus: 'tang' as const },
  ];

  it('positions poems across the poet\'s lifetime', () => {
    const result = layoutPoems(poems, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].poem.id).toBe('1');
    expect(result[0].x).toBeLessThan(result[1].x);
  });

  it('handles undefined creationYear by spreading evenly across remaining slots', () => {
    const poemsNoYear: Poem[] = [
      { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1, corpus: 'tang' as const },
      { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1, corpus: 'tang' as const },
    ];
    const result = layoutPoems(poemsNoYear, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].x).toBeLessThan(result[1].x);
  });
});

describe('layoutAllPoems', () => {
  const poets: Poet[] = [
    { id: 'pa', name: 'A', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    { id: 'pb', name: 'B', birthYear: 800, deathYear: 850, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
  ];
  const poems: Poem[] = [
    { id: '1', title: 'one', poetId: 'pa', content: '', annotations: [], familiarity: 1, creationYear: 720, corpus: 'tang' as const },
    { id: '2', title: 'two', poetId: 'pa', content: '', annotations: [], familiarity: 1, creationYear: 750, corpus: 'tang' as const },
    { id: '3', title: 'three', poetId: 'pb', content: '', annotations: [], familiarity: 1, creationYear: 830, corpus: 'tang' as const },
  ];
  const range = { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 };

  it('sorts poems by creationYear and computes X across dynasty range', () => {
    const result = layoutAllPoems(poems, poets, range);
    expect(result[0].poem.id).toBe('1');
    expect(result[2].poem.id).toBe('3');
    expect(result[0].x).toBeLessThan(result[2].x);
    expect(result.every((p) => p.x >= 8 && p.x <= 92)).toBe(true);
  });

  it('falls back to poet.birthYear when poem has no creationYear', () => {
    const noYear: Poem[] = [
      { id: '1', title: 'one', poetId: 'pa', content: '', annotations: [], familiarity: 1, corpus: 'tang' as const },
      { id: '2', title: 'two', poetId: 'pb', content: '', annotations: [], familiarity: 1, corpus: 'tang' as const },
    ];
    const result = layoutAllPoems(noYear, poets, range);
    expect(result[0].poem.id).toBe('1');
    expect(result[0].x).toBeLessThan(result[1].x);
  });

  it('does not mutate the input poems array', () => {
    const before = JSON.stringify(poems);
    layoutAllPoems(poems, poets, range);
    expect(JSON.stringify(poems)).toBe(before);
  });

  it('keeps all scattered items within canvas bounds [0, 100]', () => {
    // 62 poems at the same year — without bound-aware xRange reduction,
    // scatter at nominalX 31% with xRange ±75 would land items at [-43, 106].
    const clusterPoets: Poet[] = [
      { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    ];
    const clusterPoems: Poem[] = Array.from({ length: 62 }, (_, i) => ({
      id: String(i), title: String(i), poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 700, corpus: 'tang' as const,
    }));
    const result = layoutAllPoems(clusterPoems, clusterPoets, range);
    expect(result.length).toBe(62);
    result.forEach((p) => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
    });
  });

  it('keeps a 115-poem Tang cluster collision-free under tight minDx (0.4%)', () => {
    // Regression for 唐诗 300 首长河星星/文字碰撞：year=700 在真实数据有 115 首诗。
    // 默认 minDx=1.5% 时最佳候选采样兜底仍有 50+ 残留碰撞对；
    // minDx=0.4% + 75% xRange 上限应能归零（115 项目分布在 150%×80%≈12000 平方%）
    const clusterPoets: Poet[] = [
      { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const },
    ];
    const clusterPoems: Poem[] = Array.from({ length: 115 }, (_, i) => ({
      id: String(i), title: String(i), poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 700, corpus: 'tang' as const,
    }));
    const result = layoutAllPoems(clusterPoems, clusterPoets, range, 0.4);
    expect(result.length).toBe(115);
    const minDx = 0.4;
    const minDy = 10;
    let collisions = 0;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        if (Math.abs(result[i].x - result[j].x) < minDx && Math.abs(result[i].y - result[j].y) < minDy) {
          collisions++;
        }
      }
    }
    expect(collisions).toBe(0);
  });
});
