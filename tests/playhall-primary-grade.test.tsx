import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { PlayHall } from '../src/pages/PlayHall';

function renderHallWithPrimaryCorpus() {
  window.localStorage.setItem('feihuaCorpus', 'primary');
  return render(
    <MemoryRouter>
      <CorpusProvider>
        <PlayHall />
      </CorpusProvider>
    </MemoryRouter>,
  );
}

// Char mode 下，关卡 Link 包了一个 KeywordSeal（其中含 <button>）。
// 这样可以用结构过滤把 char 关卡和 TopNav/TopNav 链接区分开。
function countCharStageLinks(container: HTMLElement): number {
  const allLinks = container.querySelectorAll('a');
  let count = 0;
  for (const link of Array.from(allLinks)) {
    if (link.querySelector('button')) count++;
  }
  return count;
}

describe('PlayHall primary grade selector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows grade chips only for primary corpus and defaults to 六下', () => {
    renderHallWithPrimaryCorpus();
    expect(screen.getByRole('button', { name: '一上' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '六下' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('saves the selected grade band when a chip is clicked', () => {
    renderHallWithPrimaryCorpus();
    fireEvent.click(screen.getByRole('button', { name: '三上' }));
    expect(window.localStorage.getItem('shiwen-feihua-grade')).toBe('5');
    expect(screen.getByRole('button', { name: '三上' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders fewer primary char stages for 三上 than for 六下', () => {
    const { container } = renderHallWithPrimaryCorpus();
    const fullLinks = countCharStageLinks(container);
    fireEvent.click(screen.getByRole('button', { name: '三上' }));
    const lowLinks = countCharStageLinks(container);
    expect(lowLinks).toBeGreaterThan(0);
    expect(lowLinks).toBeLessThan(fullLinks);
  });
});
