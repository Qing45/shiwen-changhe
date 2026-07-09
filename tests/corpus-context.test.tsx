import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CorpusProvider, useCorpus, useSetCorpus } from '../src/state/corpus';

function Show() {
  const corpus = useCorpus();
  const set = useSetCorpus();
  return (
    <div>
      <span data-testid="corpus">{corpus}</span>
      <button data-testid="to-primary" onClick={() => set('primary')}>to primary</button>
      <button data-testid="to-tang" onClick={() => set('tang')}>to tang</button>
    </div>
  );
}

describe('CorpusContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to tang when no localStorage', () => {
    render(<CorpusProvider><Show /></CorpusProvider>);
    expect(screen.getByTestId('corpus').textContent).toBe('tang');
  });

  it('reads from localStorage on mount', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    render(<CorpusProvider><Show /></CorpusProvider>);
    expect(screen.getByTestId('corpus').textContent).toBe('primary');
  });

  it('setCorpus updates state and writes localStorage', () => {
    render(<CorpusProvider><Show /></CorpusProvider>);
    act(() => screen.getByTestId('to-primary').click());
    expect(screen.getByTestId('corpus').textContent).toBe('primary');
    expect(localStorage.getItem('feihuaCorpus')).toBe('primary');
  });

  it('useCorpus outside provider throws', () => {
    expect(() => render(<Show />)).toThrow(/outside CorpusProvider/);
  });
});
