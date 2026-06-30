import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parsePoemList } from '../scripts/scraper/list';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'fixtures/poem-list.html'), 'utf-8');

describe('parsePoemList', () => {
  it('extracts poem entries with url and title', () => {
    const entries = parsePoemList(fixture);
    expect(entries.length).toBeGreaterThan(200);
    expect(entries[0]).toEqual({
      url: expect.stringMatching(/^https:\/\/www\.gushiwen\.cn\/shiwenv_[a-zA-Z0-9]+\.aspx$/),
      title: expect.any(String),
    });
  });

  it('titles are non-empty', () => {
    const entries = parsePoemList(fixture);
    for (const e of entries) {
      expect(e.title.trim().length).toBeGreaterThan(0);
    }
  });
});
