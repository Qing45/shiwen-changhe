import { describe, it, expect } from 'vitest';
import { getPoets, getPoet, getPoemsByPoet, getPoem, getNeighbors } from '../src/data/load';

describe('data loader', () => {
  it('exposes a list of poets', () => {
    const poets = getPoets();
    expect(poets.length).toBeGreaterThan(50);
    expect(poets[0].id).toBeTruthy();
    expect(poets[0].name).toBeTruthy();
  });

  it('looks up a single poet by id', () => {
    const poets = getPoets();
    const first = poets[0];
    expect(getPoet(first.id)).toEqual(first);
    expect(getPoet('does-not-exist')).toBeUndefined();
  });

  it('lists poems for a poet', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    expect(poems.length).toBeGreaterThan(0);
    for (const p of poems) {
      expect(p.poetId).toBe(poets[0].id);
    }
  });

  it('looks up a single poem by id', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    expect(getPoem(poems[0].id)).toEqual(poems[0]);
    expect(getPoem('does-not-exist')).toBeUndefined();
  });

  it('finds prev/next neighbors within a poet', () => {
    const poets = getPoets();
    const poems = getPoemsByPoet(poets[0].id);
    if (poems.length < 2) return; // can't test neighbors with < 2 poems
    const { prev, next } = getNeighbors(poems[0].id);
    expect(prev).toBeUndefined();
    expect(next?.id).toBe(poems[1].id);
    const middle = getNeighbors(poems[1].id);
    expect(middle.prev?.id).toBe(poems[0].id);
    expect(middle.next?.id).toBe(poems[2].id);
  });
});
