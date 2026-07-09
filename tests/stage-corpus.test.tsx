import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from '../src/state/corpus';
import { StagePlay } from '../src/pages/StagePlay';
import { pickStageQuestion } from '../src/play/engine';
import { PoemCorpus } from '../src/types';

// Task 7: 飞花令 StagePlay 应消费 useCorpus() 并把 corpus 透传给 engine/progress。
//
// 这两个测试覆盖：
// 1. StagePlay 在 primary 库下渲染不崩（corpus hook 走通 + 所有调用点签名匹配）。
// 2. pickStageQuestion 在 primary 库下返回的诗来自 primary/both（非 tang-only）。
//
// 这里不直接断言页面顶部的「当前诗库」标识 —— StagePlay 没有渲染 corpus 标签
// （那是 PlayHall 的事）。改为断言引擎层符合 corpus 契约。

describe('StagePlay with corpus', () => {
  beforeEach(() => localStorage.clear());

  it('renders 月 stage in primary corpus without crash', () => {
    localStorage.setItem('feihuaCorpus', 'primary');
    const { unmount } = render(
      <MemoryRouter initialEntries={['/play/stage/月']}>
        <CorpusProvider>
          <Routes>
            <Route path="/play/stage/:kw" element={<StagePlay />} />
          </Routes>
        </CorpusProvider>
      </MemoryRouter>
    );
    // 能渲染出关键字大字即视为通过。corpus 未透传时 pickStageQuestion 默认 'tang'
    // 也不会崩，所以这条只是最小烟测；真正断言在下一条。
    unmount();
  });

  it('pickStageQuestion returns primary-or-both verse when corpus=primary', () => {
    // primary 库里包含「月」字且至少有一首诗在 primary/both 里。
    const q = pickStageQuestion('月', new Set<string>(), 'primary' as PoemCorpus);
    expect(q).not.toBeNull();
    if (!q) return;
    // 在 primary 库下出题，verse.corpus 不可能是 'tang'（tang-only 诗已被排除）。
    expect(['primary', 'both']).toContain(q.verse.corpus);
  });

  it('pickStageQuestion returns a verse when corpus=tang (default back-compat)', () => {
    // 不传 corpus 应等价于 'tang'，避免回归旧调用方。
    const q = pickStageQuestion('月', new Set<string>());
    expect(q).not.toBeNull();
  });
});
