import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder>main river</Placeholder>} />
        <Route path="/poet/:poetId" element={<Placeholder>poet sub-river</Placeholder>} />
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
