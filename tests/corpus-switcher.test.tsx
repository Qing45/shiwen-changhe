import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { CorpusSwitcher } from '../src/components/CorpusSwitcher';

function renderIn(ui: React.ReactNode, initialPath = '/play') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CorpusProvider>{ui}</CorpusProvider>
    </MemoryRouter>
  );
}

describe('CorpusSwitcher', () => {
  beforeEach(() => localStorage.clear());

  it('renders two segments with current highlighted', () => {
    renderIn(<CorpusSwitcher />);
    expect(screen.getByText('唐诗三百首')).toBeInTheDocument();
    expect(screen.getByText('小学必背')).toBeInTheDocument();
  });

  it('clicking the other segment switches corpus', () => {
    renderIn(<CorpusSwitcher />);
    fireEvent.click(screen.getByText('小学必背'));
    expect(localStorage.getItem('feihuaCorpus')).toBe('primary');
  });

  it('renders 3rd segment for "all" labeled 总库', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    render(
      <MemoryRouter>
        <CorpusProvider>
          <CorpusSwitcher />
        </CorpusProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId('corpus-all')).toBeTruthy();
    expect(screen.getByTestId('corpus-all').textContent).toContain('总库');
  });

  it('clicking 总库 segment switches corpus to "all"', () => {
    render(
      <MemoryRouter>
        <CorpusProvider>
          <CorpusSwitcher />
        </CorpusProvider>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByTestId('corpus-all'));
    expect(localStorage.getItem('feihuaCorpus')).toBe('all');
  });
});
