import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { fireEvent, screen } from '@testing-library/react';
import { CorpusProvider, useCorpus, useSetCorpus } from '../src/state/corpus';
import { PoemsRiverPage } from '../src/pages/PoemsRiverPage';
import { PoemPage } from '../src/pages/PoemPage';
import { PoetPage } from '../src/pages/PoetPage';
import { PlayHall } from '../src/pages/PlayHall';

beforeEach(() => {
  localStorage.clear();
});

describe('Corpus type includes "all"', () => {
  it('reads "all" from localStorage on mount', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    const { result } = renderHook(() => useCorpus(), {
      wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider>,
    });
    expect(result.current).toBe('all');
  });

  it('useSetCorpus("all") writes "all" to localStorage', () => {
    const { result } = renderHook(
      () => {
        const corpus = useCorpus();
        const setCorpus = useSetCorpus();
        return { corpus, setCorpus };
      },
      { wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider> }
    );
    result.current.setCorpus('all');
    expect(localStorage.getItem('feihuaCorpus')).toBe('all');
  });

  it('defaults to "tang" when localStorage empty', () => {
    const { result } = renderHook(() => useCorpus(), {
      wrapper: ({ children }) => <CorpusProvider>{children}</CorpusProvider>,
    });
    expect(result.current).toBe('tang');
  });
});

describe('PoemsRiverPage in corpus=all', () => {
  it('renders 总 库 title', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    render(
      <MemoryRouter>
        <CorpusProvider>
          <PoemsRiverPage />
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('总 库')).toBeTruthy();
  });
});

describe('PoemPage in corpus=all', () => {
  it('any poem is in scope (no switch prompt)', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    // c35a60c1a8e2 is the real hash id for 静夜思 in poems.json.
    const REAL_POEM_ID = 'c35a60c1a8e2';
    render(
      <MemoryRouter initialEntries={[`/poem/${REAL_POEM_ID}`]}>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // Guard against silent not-found passes: if the id were stale, PoemPage
    // would early-return and the assertion below would pass vacuously.
    expect(screen.queryByText('诗未找到')).toBeNull();
    expect(screen.queryByText(/这首诗不在当前诗库/)).toBeNull();
  });
});

describe('PoetPage in corpus=all', () => {
  it('does not render 看全部 toggle', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    // 674e767d is the real hash id for 李白 in poets.json.
    const REAL_POET_ID = '674e767d';
    render(
      <MemoryRouter initialEntries={[`/poet/${REAL_POET_ID}`]}>
        <CorpusProvider>
          <Routes>
            <Route path="/poet/:poetId" element={<PoetPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // Guard against silent not-found passes: if the id were stale, PoetPage
    // would early-return and the assertions below would pass vacuously.
    expect(screen.queryByText('诗人未找到')).toBeNull();
    expect(screen.queryByText('看全部')).toBeNull();
    expect(screen.queryByText('只看本库')).toBeNull();
  });
});

describe('PlayHall in corpus=all', () => {
  it('shows 总库 label and 50 stages', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    render(
      <MemoryRouter>
        <CorpusProvider>
          <PlayHall />
        </CorpusProvider>
      </MemoryRouter>
    );
    // PlayHall label「当前诗库：总库」(CorpusSwitcher also renders a 总库 button, so match the label text)
    expect(screen.getByText(/当前诗库：总库/)).toBeTruthy();
    // 50 关 — sentence mode shows "已通 X / 50 关"
    expect(screen.getByText(/\/ 50 关/)).toBeTruthy();
  });
});
