import { describe, it, expect, beforeEach } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { CorpusProvider, useCorpus, useSetCorpus } from '../src/state/corpus';

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
