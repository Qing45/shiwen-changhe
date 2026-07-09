import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PoemsRiverPage } from '../src/pages/PoemsRiverPage';
import { getPoems } from '../src/data/load';

// Smoke tests for corpus integration into PoemsRiverPage.
//
// The corpus *filtering* itself (getPoems(corpus) excluding primary-only
// poems when corpus='tang' and vice versa) is already covered in
// tests/corpus.test.ts. These tests only verify the page surfaces the
// active corpus as a visible label and re-renders when it switches.
//
// Rendering PoemsRiverPage lays out 340+ poem nodes; vitest handles it
// in well under a second, but we keep assertions to the label only so
// the test stays focused on the corpus integration.

function renderPoemsRiver() {
  return render(
    <MemoryRouter initialEntries={['/poems']}>
      <CorpusProvider>
        <PoemsRiverPage />
      </CorpusProvider>
    </MemoryRouter>
  );
}

describe('PoemsRiverPage corpus label', () => {
  beforeEach(() => localStorage.clear());

  it('shows 唐诗三百首 label when corpus=tang (default)', () => {
    renderPoemsRiver();
    // Label uses letter-spacing, so the literal text is "唐 诗 三 百 首".
    expect(screen.getByText('唐 诗 三 百 首')).toBeInTheDocument();
  });

  it('shows 小学必背 label when corpus=primary (from localStorage)', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    renderPoemsRiver();
    expect(screen.getByText('小 学 必 背')).toBeInTheDocument();
  });

  it('renders the filtered poem set (sanity: count matches getPoems(corpus))', () => {
    // Default corpus=tang: page should render exactly getPoems('tang').length poem links.
    // This guards against the page silently ignoring the corpus hook.
    renderPoemsRiver();
    const tangPoems = getPoems('tang');
    // Each poem renders as a <Link> wrapping its title text.
    const links = document.querySelectorAll('a[href^="/poem/"]');
    expect(links.length).toBe(tangPoems.length);
  });
});
