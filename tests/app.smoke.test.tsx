import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RiverPage } from '../src/pages/RiverPage';
import { PoetPage } from '../src/pages/PoetPage';
import { PoemPage } from '../src/pages/PoemPage';
import { getPoets, getPoemsByPoet } from '../src/data/load';

function App() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
      </Routes>
    </MemoryRouter>
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

    // PoemPage renders the full poem content as a single pre-wrap text node,
    // so getByText's default exact-match cannot match just the first clause.
    // Use exact:false so testing-library matches the first clause (split on
    // terminal punctuation) as a substring of the rendered content node.
    const firstClause = firstPoem.content.split(/[。！？\n]/)[0];
    expect(screen.getByText(firstClause, { exact: false })).toBeInTheDocument();
  });
});
