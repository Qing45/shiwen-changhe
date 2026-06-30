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
