import { describe, it, expect } from 'vitest';
import { buildIndex } from './search';

describe('search index', () => {
  const index = buildIndex();

  it('finds poets by name', () => {
    const result = index.query('李白');
    expect(result.poets.some((p) => p.name === '李白')).toBe(true);
  });

  it('finds poems by title', () => {
    const result = index.query('月');
    expect(result.poems.some((p) => p.title.includes('月'))).toBe(true);
  });

  it('finds verses by substring', () => {
    const result = index.query('月');
    expect(result.verses.some((v) => v.verse.includes('月'))).toBe(true);
  });

  it('returns empty for short queries', () => {
    expect(index.query('').poets.length).toBe(0);
    expect(index.query('').poems.length).toBe(0);
  });
});
