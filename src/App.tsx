import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiverPage } from './pages/RiverPage';
import { PoemsRiverPage } from './pages/PoemsRiverPage';
import { PoetPage } from './pages/PoetPage';
import { PoemPage } from './pages/PoemPage';
import { PlayHall } from './pages/PlayHall';
import { StagePlay } from './pages/StagePlay';
import { SentencePlay } from './pages/SentencePlay';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poems" element={<PoemsRiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
        <Route path="/play" element={<PlayHall />} />
        <Route path="/play/stage/:kw" element={<StagePlay />} />
        <Route path="/play/sentence/:level" element={<SentencePlay />} />
      </Routes>
    </BrowserRouter>
  );
}
