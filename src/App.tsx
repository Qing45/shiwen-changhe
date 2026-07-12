import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CorpusProvider } from './state/corpus';
import { RiverPage } from './pages/RiverPage';
import { UpdateToast } from './components/UpdateToast';

// RiverPage 是首屏：保留静态导入。其余路由按页切 chunk，首屏 JS 从 ~657K 压到 ~250K。
// React.lazy 接收 default export；项目页面用 named export，这里用 .then 重映射。
const PoemsRiverPage = lazy(() => import('./pages/PoemsRiverPage').then((m) => ({ default: m.PoemsRiverPage })));
const PoetPage = lazy(() => import('./pages/PoetPage').then((m) => ({ default: m.PoetPage })));
const PoemPage = lazy(() => import('./pages/PoemPage').then((m) => ({ default: m.PoemPage })));
const PlayHall = lazy(() => import('./pages/PlayHall').then((m) => ({ default: m.PlayHall })));
const StagePlay = lazy(() => import('./pages/StagePlay').then((m) => ({ default: m.StagePlay })));
const SentencePlay = lazy(() => import('./pages/SentencePlay').then((m) => ({ default: m.SentencePlay })));
const TitlePlay = lazy(() => import('./pages/TitlePlay').then((m) => ({ default: m.TitlePlay })));

function PageFallback() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a8b8d8',
        fontFamily: "'KaiTi', 'STKaiti', serif",
        fontSize: 16,
        letterSpacing: 4,
      }}
    >
      载 入 中 …
    </div>
  );
}

export default function App() {
  return (
    <CorpusProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<RiverPage />} />
            <Route path="/poems" element={<PoemsRiverPage />} />
            <Route path="/poet/:poetId" element={<PoetPage />} />
            <Route path="/poem/:poemId" element={<PoemPage />} />
            <Route path="/play" element={<PlayHall />} />
            <Route path="/play/stage/:kw" element={<StagePlay />} />
            <Route path="/play/sentence/:level" element={<SentencePlay />} />
            <Route path="/play/title/:level" element={<TitlePlay />} />
          </Routes>
        </Suspense>
        <UpdateToast />
      </BrowserRouter>
    </CorpusProvider>
  );
}
