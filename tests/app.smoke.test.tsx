import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RiverPage } from '../src/pages/RiverPage';
import { PoetPage } from '../src/pages/PoetPage';
import { PoemPage } from '../src/pages/PoemPage';
import { CorpusProvider } from '../src/state/corpus';
import { getPoets, getPoemsByPoet } from '../src/data/load';
import { extractVariants, getPoemMode, splitIntoLines } from '../src/utils/poemText';

function App() {
  return (
    <CorpusProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<RiverPage />} />
          <Route path="/poet/:poetId" element={<PoetPage />} />
          <Route path="/poem/:poemId" element={<PoemPage />} />
        </Routes>
      </MemoryRouter>
    </CorpusProvider>
  );
}

describe('app smoke', () => {
  it('renders the main river with poet links', () => {
    render(<App />);
    const poets = getPoets();
    const firstPoet = poets[0];
    expect(screen.getByText(firstPoet.name)).toBeInTheDocument();
  });

  it('clicking a poet navigates to the sub-river with poems', () => {
    render(<App />);
    const poets = getPoets();
    const target = poets.find((p) => getPoemsByPoet(p.id).length >= 3) ?? poets[0];

    fireEvent.click(screen.getByText(target.name));

    const poems = getPoemsByPoet(target.id);
    expect(screen.getByText(`${target.birthYear} · 生`)).toBeInTheDocument();
    expect(screen.getByText(poems[0].title)).toBeInTheDocument();
  });

  it('clicking a poem navigates to the reading page', () => {
    render(<App />);
    const poets = getPoets();
    const target = poets.find((p) => getPoemsByPoet(p.id).length >= 2) ?? poets[0];

    fireEvent.click(screen.getByText(target.name));
    const firstPoem = getPoemsByPoet(target.id)[0];
    fireEvent.click(screen.getByText(firstPoem.title));

    // PoemPage now splits the poem body into per-line <div>s via the same
    // helpers the page uses. Match the first rendered line directly.
    const { cleanText } = extractVariants(firstPoem.content);
    const lines = splitIntoLines(cleanText, getPoemMode(cleanText));
    expect(screen.getByText(lines[0])).toBeInTheDocument();
  });
});
