import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { TopNav } from '../src/components/TopNav';
import { getPoems } from '../src/data/load';

// Counts are only shown next to the active route label (诗人·N when on /,
// 诗文·N when on /poems), so each test renders at the path whose button
// carries the count.

function renderAt(path: '/' | '/poems') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CorpusProvider>
        <TopNav variant="main" />
      </CorpusProvider>
    </MemoryRouter>
  );
}

describe('TopNav RiverToggle corpus-aware counts', () => {
  beforeEach(() => localStorage.clear());

  it('shows tang poet count when on /', () => {
    renderAt('/');
    const tangPoems = getPoems('tang');
    const tangPoetCount = new Set(tangPoems.map((p) => p.poetId)).size;
    expect(screen.getByText(`诗人·${tangPoetCount}`)).toBeInTheDocument();
  });

  it('shows tang poem count when on /poems', () => {
    renderAt('/poems');
    const tangPoems = getPoems('tang');
    expect(screen.getByText(`诗文·${tangPoems.length}`)).toBeInTheDocument();
  });

  it('shows primary poet count when on / and corpus=primary', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    renderAt('/');
    const primaryPoems = getPoems('primary');
    const primaryPoetCount = new Set(primaryPoems.map((p) => p.poetId)).size;
    expect(screen.getByText(`诗人·${primaryPoetCount}`)).toBeInTheDocument();
  });

  it('shows primary poem count when on /poems and corpus=primary', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    renderAt('/poems');
    const primaryPoems = getPoems('primary');
    expect(screen.getByText(`诗文·${primaryPoems.length}`)).toBeInTheDocument();
  });

  it('shows full poet count when on / and corpus=all', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    renderAt('/');
    const allPoems = getPoems('both');
    const allPoetCount = new Set(allPoems.map((p) => p.poetId)).size;
    expect(screen.getByText(`诗人·${allPoetCount}`)).toBeInTheDocument();
  });

  it('shows full poem count when on /poems and corpus=all', () => {
    localStorage.setItem('feihuaCorpus', 'all');
    renderAt('/poems');
    const allPoems = getPoems('both');
    expect(screen.getByText(`诗文·${allPoems.length}`)).toBeInTheDocument();
  });
});