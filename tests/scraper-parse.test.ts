import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePoemPage } from '../scripts/scraper/parse-poem';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures/poem-page.html'), 'utf-8');

describe('parsePoemPage', () => {
  it('extracts title, poet, content', () => {
    const result = parsePoemPage(fixture, 'https://www.gushiwen.cn/shiwenv_x.aspx');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.poetName.length).toBeGreaterThan(0);
    expect(result.content.length).toBeGreaterThan(20);
    expect(result.url).toBe('https://www.gushiwen.cn/shiwenv_x.aspx');
  });

  it('extracts at least one annotation', () => {
    const result = parsePoemPage(fixture, 'https://example.com/x');
    expect(result.annotations.length).toBeGreaterThan(0);
    expect(result.annotations[0].term).toBeTruthy();
    expect(result.annotations[0].explanation).toBeTruthy();
  });

  it('extracts background paragraph when present', () => {
    const result = parsePoemPage(fixture, 'https://example.com/x');
    expect(result.background?.length).toBeGreaterThan(20);
  });
});
