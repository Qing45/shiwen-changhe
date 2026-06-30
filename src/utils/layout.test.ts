import { describe, it, expect } from 'vitest';
import { computePercent, layoutPoets, layoutPoems } from './layout';
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
    { id: 'a', name: 'A', birthYear: 618, deathYear: 700, dynastyId: 'tang', familiarity: 1 },
    { id: 'b', name: 'B', birthYear: 700, deathYear: 770, dynastyId: 'tang', familiarity: 1 },
    { id: 'c', name: 'C', birthYear: 907, deathYear: 950, dynastyId: 'tang', familiarity: 1 },
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

  it('spreads poets vertically when they share an X column', () => {
    // All birthYear 700 → all in one column → must spread across [-35, +35]
    const clustered: Poet[] = [
      { id: 'a', name: 'A', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1 },
      { id: 'b', name: 'B', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1 },
      { id: 'c', name: 'C', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1 },
    ];
    const result = layoutPoets(clustered, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    const ys = result.map((p) => p.y);
    expect(ys[0]).toBeCloseTo(-35, 5);
    expect(ys[1]).toBeCloseTo(0, 5);
    expect(ys[2]).toBeCloseTo(35, 5);
    // Same X column → all xs equal
    expect(result.every((p) => p.x === result[0].x)).toBe(true);
  });

  it('keeps single-poet columns on the center line', () => {
    const single: Poet[] = [
      { id: 'solo', name: 'Solo', birthYear: 762, deathYear: 800, dynastyId: 'tang', familiarity: 1 },
    ];
    const result = layoutPoets(single, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    expect(result[0].y).toBe(0);
  });

  it('switches to a 2D grid when a column exceeds PURE_Y_MAX, scattering poets on X and Y', () => {
    // 12 poets in one column — beyond PURE_Y_MAX (10), triggers grid layout.
    const cluster: Poet[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i), name: String(i), birthYear: 700, deathYear: 750, dynastyId: 'tang', familiarity: 1,
    }));
    const result = layoutPoets(cluster, { minYear: 618, maxYear: 907, leftPadding: 5, rightPadding: 5 });
    // Every position must be unique (no overlap)
    const keys = new Set(result.map((p) => `${p.x.toFixed(3)}|${p.y.toFixed(3)}`));
    expect(keys.size).toBe(12);
    // X jitter applied: at least two distinct X values
    const xs = new Set(result.map((p) => p.x.toFixed(3)));
    expect(xs.size).toBeGreaterThan(1);
    // Cluster stays centered around the nominal X (≈28.4%) — every X within ±6% of it
    const nominalX = result[0].x; // first item also has jitter; instead compute expected nominal
    const expectedNominal = 5 + (((700 - 618) / (907 - 618)) * 100) * 0.9;
    result.forEach((p) => {
      expect(Math.abs(p.x - expectedNominal)).toBeLessThanOrEqual(6.5);
    });
  });
});

describe('layoutPoems', () => {
  const poet: Poet = { id: 'p', name: 'P', birthYear: 700, deathYear: 760, dynastyId: 'tang', familiarity: 1 };
  const poems: Poem[] = [
    { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 710 },
    { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1, creationYear: 750 },
  ];

  it('positions poems across the poet\'s lifetime', () => {
    const result = layoutPoems(poems, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].poem.id).toBe('1');
    expect(result[0].x).toBeLessThan(result[1].x);
  });

  it('handles undefined creationYear by spreading evenly across remaining slots', () => {
    const poemsNoYear: Poem[] = [
      { id: '1', title: 'one', poetId: 'p', content: '', annotations: [], familiarity: 1 },
      { id: '2', title: 'two', poetId: 'p', content: '', annotations: [], familiarity: 1 },
    ];
    const result = layoutPoems(poemsNoYear, poet, { leftPadding: 5, rightPadding: 5 });
    expect(result[0].x).toBeLessThan(result[1].x);
  });
});
