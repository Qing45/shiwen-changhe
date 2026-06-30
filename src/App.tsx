import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { RiverPage } from './pages/RiverPage';
import { PoetPage } from './pages/PoetPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<Placeholder>poem reading</Placeholder>} />
      </Routes>
    </BrowserRouter>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', background: '#050818', color: '#e8f0ff', padding: 40 }}>
      {children}
    </div>
  );
}
