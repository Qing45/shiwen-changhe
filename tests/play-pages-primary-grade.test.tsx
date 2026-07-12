import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { SentencePlay } from '../src/pages/SentencePlay';
import { StagePlay } from '../src/pages/StagePlay';
import { TitlePlay } from '../src/pages/TitlePlay';

function renderWithPrimary(path: string, element: React.ReactNode) {
  window.localStorage.setItem('feihuaCorpus', 'primary');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CorpusProvider>
        <Routes>
          <Route path="/play/sentence/:level" element={element} />
          <Route path="/play/title/:level" element={element} />
          <Route path="/play/stage/:kw" element={element} />
        </Routes>
      </CorpusProvider>
    </MemoryRouter>,
  );
}

describe('primary grade play pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('rejects sentence levels beyond the selected primary band total', () => {
    window.localStorage.setItem('shiwen-feihua-grade', '1');
    renderWithPrimary('/play/sentence/30', <SentencePlay />);
    expect(screen.getByText(/关卡不存在|暂无关卡|返回大厅/)).toBeInTheDocument();
  });

  it('rejects title levels beyond the selected primary band total', () => {
    window.localStorage.setItem('shiwen-feihua-grade', '1');
    renderWithPrimary('/play/title/30', <TitlePlay />);
    expect(screen.getByText(/关卡不存在|暂无关卡|返回大厅/)).toBeInTheDocument();
  });

  // 一上（band 1）小学库只有 6 首，没有关键字达到 STAGE_GOAL。
  // 任何 primary kw 在 band 1 下都不在 getCharKeywords 列表里 —— 视为关卡不存在。
  it('rejects stage keywords not in the selected primary band keyword list', () => {
    window.localStorage.setItem('shiwen-feihua-grade', '1');
    renderWithPrimary('/play/stage/春', <StagePlay />);
    expect(screen.getByText(/关卡不存在|暂无关卡|返回大厅/)).toBeInTheDocument();
  });
});
