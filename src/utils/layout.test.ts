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

  it('keeps a real-data 初中必背 dense column (39 items) collision-free under minDx 0.4%', () => {
    // Regression: 初中 corpus 实际数据有 39 首密集列（次北固山下至贾生，
    // 跨 7.4% X）。默认 minDx=1.5% 留 14 个碰撞对，肉眼明显。Tang 早就
    // 用 minDx=0.4% + 4500% 画布组合修过同样问题；初中 / 小学需要同样的
    // 组合（见 PoemsRiverPage.tsx isDense）。
    const clusterPoets: Poet[] = Array.from({ length: 12 }, (_, i) => ({
      id: 'p' + i, name: 'P' + i, birthYear: 650 + i * 10, deathYear: 700 + i * 10, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const,
    }));
    const clusterPoems: Poem[] = Array.from({ length: 39 }, (_, i) => ({
      id: String(i), title: String(i), poetId: clusterPoets[i % 12].id, content: '', annotations: [], familiarity: 1,
      creationYear: 650 + Math.floor(i / 4) * 8, corpus: 'tang' as const,
    }));
    const result = layoutAllPoems(clusterPoems, clusterPoets, range, 0.4);
    expect(result.length).toBe(39);
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

  it('keeps a real-data 小学必背 dense column (61 items) collision-free under minDx 0.4%', () => {
    // 同上 — 小学 corpus 在 default year range 下最大密集列 61 首，
    // 用 minDx=1.5% 留 44 个碰撞对。
    const clusterPoets: Poet[] = Array.from({ length: 14 }, (_, i) => ({
      id: 'p' + i, name: 'P' + i, birthYear: 200 + i * 12, deathYear: 250 + i * 12, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const,
    }));
    const clusterPoems: Poem[] = Array.from({ length: 61 }, (_, i) => ({
      id: String(i), title: String(i), poetId: clusterPoets[i % 14].id, content: '', annotations: [], familiarity: 1,
      creationYear: 200 + Math.floor(i / 5) * 9, corpus: 'tang' as const,
    }));
    const result = layoutAllPoems(clusterPoems, clusterPoets, range, 0.4);
    expect(result.length).toBe(61);
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

  it('keeps a 66-poem "all" corpus dense cluster (李白+王维 year=701) collision-free', () => {
    // Regression for 'all' corpus year=701 cluster: 李白 37 + 王维 29 poems
    // all at the same year due to fallback to birthYear. Previously with
    // 9% X jitter cap, 66 items overflowed 8 Y rows → 381 collisions.
    // Fix: dense columns (n > DENSE_COLUMN_THRESHOLD=20) get scaled X jitter
    // (66 → 9 + (66-20)*0.6 = 39.6 ≈ cap 40) so 66 items fit comfortably.
    const twoPoets: Poet[] = [
      { id: 'lb', name: 'LB', birthYear: 701, deathYear: 762, dynastyId: 'tang', familiarity: 5, corpus: 'tang' as const },
      { id: 'ww', name: 'WW', birthYear: 701, deathYear: 761, dynastyId: 'tang', familiarity: 5, corpus: 'tang' as const },
    ];
    const poems66: Poem[] = [
      ...Array.from({ length: 37 }, (_, i) => ({
        id: 'lb' + i, title: 'L' + i, poetId: 'lb', content: '', annotations: [], familiarity: 1, creationYear: 701, corpus: 'tang' as const,
      })),
      ...Array.from({ length: 29 }, (_, i) => ({
        id: 'ww' + i, title: 'W' + i, poetId: 'ww', content: '', annotations: [], familiarity: 1, creationYear: 701, corpus: 'tang' as const,
      })),
    ];
    const result = layoutAllPoems(poems66, twoPoets, range, 0.4);
    expect(result.length).toBe(66);
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
    // Dense column jitter scales: 66 items should spread across a wide X range
    // (≈ ±40% jitter), not be capped at ±1.7%. Verify that items reach far
    // from their nominal X (= ((701-618)/(907-618))*84 + 8 ≈ 28.9).
    const nominalX = 8 + ((701 - 618) / (907 - 618)) * 84;
    const maxDeltaFromNominal = Math.max(...result.map((r) => Math.abs(r.x - nominalX)));
    expect(maxDeltaFromNominal).toBeGreaterThan(20);
  });

  it('keeps small dense columns (n ≤ 20) on the original cap, not the wide-jitter path', () => {
    // Guard against accidentally enabling wide jitter for all multi-item columns.
    // 20-item column at a unique year (no singleton neighbors) must still be
    // bounded — it doesn't trigger DENSE_COLUMN_THRESHOLD.
    const poet: Poet = { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1, corpus: 'tang' as const };
    const poems20: Poem[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), title: String(i), poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 700, corpus: 'tang' as const,
    }));
    const result = layoutAllPoems(poems20, [poet], range, 0.4);
    expect(result.length).toBe(20);
    // Nominal X for year=700 in tang range ≈ ((700-618)/(907-618))*84 + 8 ≈ 28.5
    const nominalX = 8 + ((700 - 618) / (907 - 618)) * 84;
    // 20 items at threshold boundary: DENSE_COLUMN_THRESHOLD=20 means n > 20
    // triggers wide jitter, n ≤ 20 stays on the regular cap (no singleton
    // neighbors → xRangeCap = Infinity → perItemJitter = X_JITTER_RANGE=9).
    const maxDeltaFromNominal = Math.max(...result.map((r) => Math.abs(r.x - nominalX)));
    expect(maxDeltaFromNominal).toBeLessThan(9.5); // stays within ±9%
  });
});
