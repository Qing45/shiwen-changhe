import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildIndex } from '../utils/search';
import { colors, fontFamilies } from '../theme';

const index = buildIndex();

export function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const result = useMemo(() => index.query(query), [query]);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="🔍 搜索诗人、诗名、诗句……"
        style={{
          width: '100%',
          background: query && open ? 'rgba(216,224,240,0.12)' : 'rgba(216,224,240,0.08)',
          border: `1px solid ${query && open ? 'rgba(216,224,240,0.55)' : 'rgba(216,224,240,0.25)'}`,
          borderRadius: 4, padding: '10px 16px',
          color: colors.textPrimary, fontSize: 15,
          fontFamily: fontFamilies.chinese,
          outline: 'none',
        }}
      />
      {query && open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
          background: 'linear-gradient(180deg, #0a1228 0%, #050818 100%)',
          border: '1px solid rgba(216,224,240,0.3)',
          borderRadius: 4, padding: '14px 0',
          boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
          maxHeight: 440, overflowY: 'auto',
          zIndex: 20,
        }}>
          <Section title="诗 人" count={result.poets.length}>
            {result.poets.length === 0 && <Empty>无匹配诗人</Empty>}
            {result.poets.slice(0, 3).map((p) => (
              <ResultRow key={p.id} onClick={() => { navigate(`/poet/${p.id}`); setOpen(false); }}>
                <span>{highlight(p.name, query)}</span>
              </ResultRow>
            ))}
            {result.poets.length > 3 && <MoreHint>还有 {result.poets.length - 3} 位 ↓</MoreHint>}
          </Section>
          <Section title="诗 名" count={result.poems.length}>
            {result.poems.length === 0 && <Empty>无匹配诗名</Empty>}
            {result.poems.slice(0, 3).map((p) => (
              <ResultRow key={p.id} onClick={() => { navigate(`/poem/${p.id}`); setOpen(false); }}>
                <span>{highlight(p.title, query)}</span>
              </ResultRow>
            ))}
            {result.poems.length > 3 && <MoreHint>还有 {result.poems.length - 3} 首 ↓</MoreHint>}
          </Section>
          <Section title="诗 句" count={result.verses.length}>
            {result.verses.length === 0 && <Empty>无匹配诗句</Empty>}
            {result.verses.slice(0, 3).map((v, i) => (
              <ResultRow key={i} onClick={() => { navigate(`/poem/${v.poemId}`); setOpen(false); }}>
                <div>{highlight(v.verse, query)}</div>
                <div style={{ color: colors.textDim, fontSize: 14, marginTop: 2 }}>— {v.poetName}《{v.poemTitle}》</div>
              </ResultRow>
            ))}
            {result.verses.length > 3 && <MoreHint>还有 {result.verses.length - 3} 句 ↓</MoreHint>}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 16px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
        <div style={{ color: colors.textTertiary, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 3 }}>{title}</div>
        <div style={{ color: colors.textFaint, fontSize: 14 }}>{count}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function ResultRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '7px 8px', background: 'transparent',
        border: 'none', borderRadius: 3,
        color: colors.textPrimary, fontFamily: fontFamilies.chinese, fontSize: 15,
        cursor: 'pointer',
      }}
    >{children}</button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '4px 0' }}>{children}</div>;
}

function MoreHint({ children }: { children: React.ReactNode }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '6px 8px' }}>{children}</div>;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: colors.highlight, textShadow: colors.highlightShadow }}>{query}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
