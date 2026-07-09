import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PoemPage } from '../src/pages/PoemPage';

// PoemPage corpus integration: the inScope check + switch prompt.
//
// PoemPage derives inScope from poem.corpus vs active corpus:
//   - corpus='both' poems are always in scope.
//   - tang-only (corpus='tang') are out of scope when active='primary'.
//   - primary-only (corpus='primary') are out of scope when active='tang'.
// When out of scope, PoemPage renders "这首诗不在当前诗库。" + a switch button.
//
// Test fixtures (verified from src/data/poems.json):
//   - c35a60c1a8e2 静夜思 (corpus: 'both') — always in scope.
//   - b8148e70fea6 望江南·超然台作 by 苏轼 (corpus: 'primary') — out of scope when active='tang'.

describe('PoemPage corpus integration', () => {
  beforeEach(() => localStorage.clear());

  it('renders an in-scope poem without the switch prompt', () => {
    // 静夜思 is corpus='both', visible under both 'tang' and 'primary'.
    localStorage.setItem('feihuaCorpus', 'tang');
    render(
      <MemoryRouter initialEntries={['/poem/c35a60c1a8e2']}>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // In scope: title renders (may appear in title + nav links, so getAllByText), switch prompt absent.
    expect(screen.getAllByText('静夜思').length).toBeGreaterThan(0);
    expect(screen.queryByText(/这首诗不在当前诗库/)).not.toBeInTheDocument();
  });

  it('shows the switch prompt for an out-of-scope primary poem under corpus=tang', () => {
    // 望江南·超然台作 is corpus='primary' only; under corpus='tang' it is out of scope.
    localStorage.setItem('feihuaCorpus', 'tang');
    render(
      <MemoryRouter initialEntries={['/poem/b8148e70fea6']}>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // Out of scope: prompt + switch button (to 小学必背) appear.
    expect(screen.getByText(/这首诗不在当前诗库/)).toBeInTheDocument();
    const switchBtn = screen.getByText(/切到小学必背/);
    expect(switchBtn).toBeInTheDocument();
    // Clicking the switch button flips corpus to primary (writes localStorage).
    fireEvent.click(switchBtn);
    expect(localStorage.getItem('feihuaCorpus')).toBe('primary');
  });
});
