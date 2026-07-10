import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useState, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PoemPage } from '../src/pages/PoemPage';

// Real IDs from src/data/poems.json:
//  c35a60c1a8e2 静夜思 (corpus: 'both') — always in scope
//  c987db20a4d7 赠刘景文 by 苏轼 (corpus: 'primary') — needs primary corpus
// Verify scrollTop resets to 0 when navigating between poems (same PoemPage instance, different poemId).

describe('PoemPage scroll reset', () => {
  beforeEach(() => localStorage.clear());

  it('resets scrollTop to 0 when poem.id changes', async () => {
    localStorage.setItem('feihuaCorpus', 'all');

    // Performs an in-app navigation (does NOT remount the router).
    function NavOnMount({ to }: { to: string }) {
      const navigate = useNavigate();
      useEffect(() => {
        navigate(to);
        // Only run once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }

    // Flips path after first paint: mounts a NavOnMount for the first poem, then
    // re-mounts one for the second poem when the flip button is clicked.
    function NavAfterPaint({ from, to }: { from: string; to: string }) {
      const [step, setStep] = useState<'first' | 'second'>('first');
      return (
        <>
          {step === 'first' && <NavOnMount to={from} />}
          {step === 'second' && <NavOnMount to={to} />}
          <button data-testid="flip" onClick={() => setStep('second')}>flip</button>
        </>
      );
    }

    const { container, getByTestId } = render(
      <MemoryRouter>
        <CorpusProvider>
          <Routes>
            <Route path="/poem/:poemId" element={<PoemPage />} />
          </Routes>
          <NavAfterPaint from="/poem/c35a60c1a8e2" to="/poem/c987db20a4d7" />
        </CorpusProvider>
      </MemoryRouter>
    );

    // The scrollable paper container is the only div with `overflow-y: auto`
    // (the TopNav/moon band/wrapper use `overflow: hidden`). Use that to disambiguate.
    const paperDiv = container.querySelector('div[style*="overflow-y"]') as HTMLElement;
    expect(paperDiv).toBeTruthy();
    paperDiv.scrollTop = 200;
    expect(paperDiv.scrollTop).toBe(200);

    // Flip to the second poem — NavOnMount uses navigate() in useEffect, so the URL
    // changes within the same MemoryRouter. PoemPage is not unmounted, only its
    // `poem.id` prop changes via useParams, which fires our useEffect to reset scroll.
    const { act } = await import('react');
    await act(async () => {
      getByTestId('flip').click();
    });

    // Same paper div instance — useEffect on [poem.id] should have reset scrollTop to 0.
    expect(paperDiv.scrollTop).toBe(0);
  });
});