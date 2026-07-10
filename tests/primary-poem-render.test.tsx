import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PoemPage } from '../src/pages/PoemPage';
import { TopNav } from '../src/components/TopNav';
import { getPoems, getPoets } from '../src/data/load';

// Smoke test: verify the 43 newly-added primary poems render correctly with
// title, content, annotations, and background all visible under corpus=primary.
//
// Picks 4 representative samples covering the 4 main paths used this session:
//   - 江南 (汉乐府, 6c494e505e9c) — reused existing poet
//   - 风 (李峤, 2ac5a099) — new poet added in this session
//   - 赠汪伦 (李白, 674e767d) — reused existing poet, longest annotations
//   - 七律·长征 (毛泽东, 6caa2050) — new poet, modern dynasty

describe('primary corpus: new poems render end-to-end', () => {
  beforeEach(() => localStorage.clear());

  const samples: Array<{
    title: string;
    poetName: string;
    contentLine: string;
    annotationTerm: string;
    annotationSubstring: string;
    backgroundSubstring: string;
  }> = [
    {
      title: '江南',
      poetName: '汉乐府',
      contentLine: '江南可采莲',
      annotationTerm: '田田',
      annotationSubstring: '莲叶新鲜碧绿',
      backgroundSubstring: '采莲歌',
    },
    {
      title: '风',
      poetName: '李峤',
      contentLine: '解落三秋叶',
      annotationTerm: '三秋',
      annotationSubstring: '农历九月',
      backgroundSubstring: '泸峰山',
    },
    {
      title: '赠汪伦',
      poetName: '李白',
      contentLine: '桃花潭水深千尺',
      annotationTerm: '踏歌',
      annotationSubstring: '脚步击地打节拍',
      backgroundSubstring: '汪伦',
    },
    {
      title: '七律·长征',
      poetName: '毛泽东',
      contentLine: '红军不怕远征难',
      annotationTerm: '逶迤',
      annotationSubstring: '弯曲绵延',
      backgroundSubstring: '长征',
    },
  ];

  for (const sample of samples) {
    it(`${sample.title} (${sample.poetName}): renders title, content, annotations, background`, () => {
      // Find the poem by title + poet
      const poet = getPoets().find((p) => p.name === sample.poetName);
      expect(poet, `poet ${sample.poetName} should exist`).toBeDefined();
      const poem = getPoems('primary').find(
        (p) => p.title === sample.title && p.poetId === poet!.id
      );
      expect(poem, `poem ${sample.title} should exist under primary corpus`).toBeDefined();

      localStorage.setItem('feihuaCorpus', 'primary');
      render(
        <MemoryRouter initialEntries={[`/poem/${poem!.id}`]}>
          <CorpusProvider>
            <TopNav variant="poem" poet={poet!} poem={poem!} />
            <Routes>
              <Route path="/poem/:poemId" element={<PoemPage />} />
            </Routes>
          </CorpusProvider>
        </MemoryRouter>
      );

      // Title renders (may appear in nav + page)
      expect(screen.getAllByText(sample.title).length).toBeGreaterThan(0);
      // At least one content line is present
      expect(screen.getAllByText(new RegExp(sample.contentLine)).length).toBeGreaterThan(0);
      // Annotation term + a hint of its explanation (annotation terms may
      // also appear in the poem content itself, so use getAllByText)
      expect(screen.getAllByText(new RegExp(sample.annotationTerm)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(new RegExp(sample.annotationSubstring)).length).toBeGreaterThan(0);
      // Background text contains expected substring
      expect(screen.getAllByText(new RegExp(sample.backgroundSubstring)).length).toBeGreaterThan(0);
      // Section headers visible
      expect(screen.getAllByText(/注 释/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/创 作 背 景/).length).toBeGreaterThan(0);
    });
  }

  it('TopNav counts reflect primary corpus on /', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    render(
      <MemoryRouter initialEntries={['/']}>
        <CorpusProvider>
          <TopNav variant="main" />
        </CorpusProvider>
      </MemoryRouter>
    );
    const primaryPoems = getPoems('primary');
    const poetCount = new Set(primaryPoems.map((p) => p.poetId)).size;
    expect(screen.getByText(`诗人·${poetCount}`)).toBeInTheDocument();
    expect(poetCount).toBeGreaterThan(50); // sanity check, was 43, now 57
  });

  it('TopNav counts reflect primary corpus on /poems', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    render(
      <MemoryRouter initialEntries={['/poems']}>
        <CorpusProvider>
          <TopNav variant="main" />
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.getByText(`诗文·108`)).toBeInTheDocument();
  });
});