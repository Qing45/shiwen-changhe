import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiverPage } from './pages/RiverPage';
import { PoetPage } from './pages/PoetPage';
import { PoemPage } from './pages/PoemPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
      </Routes>
    </BrowserRouter>
  );
}
