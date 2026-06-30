// Build script: assembles standalone.html from source files + inline JSON data.
// Usage: node scripts/build-standalone.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ---- 1. Read CSS ----
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf-8');

// ---- 2. Read JSON data inline (raw — valid JS array literal) ----
const poetsJson = fs.readFileSync(path.join(SRC, 'data', 'poets.json'), 'utf-8');
const poemsJson = fs.readFileSync(path.join(SRC, 'data', 'poems.json'), 'utf-8');

// ---- 3. App code (JSX, TS types stripped, imports replaced with globals) ----
// theme.ts (verbatim values, drop `as const` and type annotations)
const themeCode = `
// ===== theme.ts =====
const colors = {
  bgGradient: 'linear-gradient(180deg, #050818 0%, #0a1430 40%, #152548 70%, #0a1430 100%)',
  riverLine: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.5) 8%, rgba(240,244,255,0.85) 50%, rgba(216,224,240,0.5) 92%, transparent 100%)',
  riverGlow: 'linear-gradient(90deg, transparent 0%, rgba(216,224,240,0.1) 8%, rgba(240,244,255,0.18) 50%, rgba(216,224,240,0.1) 92%, transparent 100%)',
  highlight: '#ffffff',
  highlightShadow: '0 0 8px rgba(255,255,255,0.85)',
  textPrimary: '#e8f0ff',
  textSecondary: '#a8b8d8',
  textTertiary: '#8a98b8',
  textDim: '#6478a0',
  textFaint: '#5a6885',
};

const fontSizes = {
  body: 14,
  meta: 14,
  nodeDefault: 16,
  nodeLarge: 20,
  nodeFocal: 26,
  poemTitle: 26,
  poemText: 18,
  sectionTitle: 16,
};

const nodeSizes = {
  1: 10,
  2: 12,
  3: 14,
  4: 18,
  5: 22,
};

const fontFamilies = {
  chinese: "'KaiTi', 'STKaiti', serif",
};
`;

// data/load.ts (logic preserved, JSON imports -> window globals)
const loadCode = `
// ===== data/load.ts =====
const poets = window.__POETS__;
const poems = window.__POEMS__;

function getPoets() {
  return poets;
}

function getPoet(poetId) {
  return poets.find((p) => p.id === poetId);
}

function getPoemsByPoet(poetId) {
  return poems
    .filter((p) => p.poetId === poetId)
    .sort((a, b) => {
      if (a.creationYear === undefined && b.creationYear === undefined) return 0;
      if (a.creationYear === undefined) return 1;
      if (b.creationYear === undefined) return -1;
      return a.creationYear - b.creationYear;
    });
}

function getPoem(poemId) {
  return poems.find((p) => p.id === poemId);
}

function getNeighbors(poemId) {
  const poem = getPoem(poemId);
  if (!poem) return {};
  const siblings = getPoemsByPoet(poem.poetId);
  const idx = siblings.findIndex((p) => p.id === poemId);
  return {
    prev: idx > 0 ? siblings[idx - 1] : undefined,
    next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined,
  };
}
`;

// utils/layout.ts (types dropped)
const layoutCode = `
// ===== utils/layout.ts =====
const COLUMN_THRESHOLD = 1.5;
const Y_RANGE = 35;

function computePercent(year, minYear, maxYear) {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

function assignY(items) {
  const columns = [];
  for (const it of items) {
    const last = columns[columns.length - 1];
    if (last && Math.abs(it.x - last.x) < COLUMN_THRESHOLD) {
      last.items.push(it);
    } else {
      columns.push({ x: it.x, items: [it] });
    }
  }
  const out = [];
  for (const col of columns) {
    const n = col.items.length;
    col.items.forEach((it, i) => {
      const y = n === 1 ? 0 : -Y_RANGE + (i / (n - 1)) * 2 * Y_RANGE;
      out.push({ item: it.item, x: it.x, y });
    });
  }
  return out;
}

function layoutPoets(poets, range) {
  const sorted = [...poets].sort((a, b) => a.birthYear - b.birthYear);
  const span = 100 - range.leftPadding - range.rightPadding;
  const withX = sorted.map((poet) => {
    const pct = computePercent(poet.birthYear, range.minYear, range.maxYear);
    return { item: poet, x: range.leftPadding + (pct / 100) * span };
  });
  return assignY(withX).map(({ item: poet, x, y }) => ({ poet, x, y }));
}

function layoutPoems(poems, poet, padding) {
  const sorted = [...poems].sort((a, b) => {
    if (a.creationYear == null && b.creationYear == null) return 0;
    if (a.creationYear == null) return 1;
    if (b.creationYear == null) return -1;
    return a.creationYear - b.creationYear;
  });

  const span = 100 - padding.leftPadding - padding.rightPadding;
  const minYear = poet.birthYear;
  const maxYear = poet.deathYear;

  const withX = sorted.map((poem, idx) => {
    let pct;
    if (poem.creationYear != null) {
      pct = computePercent(poem.creationYear, minYear, maxYear);
    } else {
      pct = (sorted.length === 1) ? 50 : (idx / (sorted.length - 1)) * 100;
    }
    return { item: poem, x: padding.leftPadding + (pct / 100) * span };
  });

  return assignY(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
}
`;

// utils/search.ts (types dropped; `poems` already declared in load.ts scope — reuse it)
const searchCode = `
// ===== utils/search.ts =====
function buildIndex() {
  const poets = getPoets();
  const poetById = new Map(poets.map((p) => [p.id, p]));

  const verseIndex = poems.map((p) => ({
    poem: p,
    poetName: poetById.get(p.poetId)?.name ?? '',
    verses: splitVerses(p.content),
  }));

  return {
    query(q) {
      const trimmed = q.trim();
      if (trimmed.length === 0) {
        return { poets: [], poems: [], verses: [] };
      }
      const lower = trimmed.toLowerCase();

      const matchedPoets = poets.filter((p) => p.name.includes(trimmed) || (p.courtesyName?.includes(trimmed) ?? false) || (p.pseudonym?.includes(trimmed) ?? false));

      const matchedPoems = poems.filter((p) => p.title.includes(trimmed));

      const matchedVerses = [];
      for (const entry of verseIndex) {
        for (const verse of entry.verses) {
          if (verse.includes(trimmed) || verse.toLowerCase().includes(lower)) {
            matchedVerses.push({
              poemId: entry.poem.id,
              verse,
              poemTitle: entry.poem.title,
              poetName: entry.poetName,
            });
            if (matchedVerses.length >= 50) break;
          }
        }
        if (matchedVerses.length >= 50) break;
      }

      return { poets: matchedPoets, poems: matchedPoems, verses: matchedVerses };
    },
  };
}

function splitVerses(content) {
  return content
    .split(/[。！？\\n]/)
    .flatMap((s) => s.split('、'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
`;

// Mini hash router (replaces react-router-dom for the standalone HTML).
// react-router-dom v6 UMD pulls in ReactRouter + RemixRouter globals that
// aren't trivially available from a CDN; this 60-line router covers the
// three routes the app actually uses (/, /poet/:id, /poem/:id).
const miniRouterCode = `
// ---- Mini hash router ----
const RouterContext = React.createContext({ path: '/', params: {} });

function HashRouter({ children }) {
  const [path, setPath] = useState(() => {
    const h = window.location.hash.slice(1);
    return h || '/';
  });
  useEffect(() => {
    const handler = () => {
      const h = window.location.hash.slice(1);
      setPath(h || '/');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return <RouterContext.Provider value={{ path, params: {} }}>{children}</RouterContext.Provider>;
}

function matchPath(pattern, path) {
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  }) + '$';
  const m = new RegExp(regexStr).exec(path);
  if (!m) return null;
  const params = {};
  paramNames.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
  return params;
}

function Routes({ children }) {
  const ctx = React.useContext(RouterContext);
  const routes = React.Children.toArray(children);
  for (const r of routes) {
    const { path: pattern, element } = r.props;
    const params = matchPath(pattern, ctx.path);
    if (params !== null) {
      return <RouterContext.Provider value={{ path: ctx.path, params }}>{element}</RouterContext.Provider>;
    }
  }
  return null;
}

function Route() {
  return null;
}

function useParams() {
  return React.useContext(RouterContext).params;
}

function useNavigate() {
  return (to) => {
    window.location.hash = to;
  };
}

function Link({ to, children, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={'#' + to}
      onClick={(e) => { e.preventDefault(); navigate(to); }}
      {...rest}
    >{children}</a>
  );
}
// ---- end mini router ----
`;

// components/RiverBackground.tsx
const riverBgCode = `
// ===== components/RiverBackground.tsx =====
function RiverBackground() {
  return (
    <>
      {/* 远山墨影 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: \`
          radial-gradient(ellipse 320px 60px at 12% 78%, rgba(60,80,120,0.35) 0%, transparent 60%),
          radial-gradient(ellipse 380px 80px at 45% 85%, rgba(50,70,110,0.4) 0%, transparent 60%),
          radial-gradient(ellipse 280px 50px at 78% 75%, rgba(70,90,130,0.3) 0%, transparent 60%)
        \`,
        pointerEvents: 'none',
      }} />
      {/* 月亮 */}
      <div style={{
        position: 'absolute', top: '8%', right: '6%',
        width: 72, height: 72, borderRadius: '50%',
        background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
        boxShadow: '0 0 60px rgba(216,224,240,0.3)',
        pointerEvents: 'none',
      }} />
      {/* 星点 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: \`
          radial-gradient(circle at 5% 18%, #fff 0.8px, transparent 2px),
          radial-gradient(circle at 15% 8%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 28% 22%, #e8f0ff 0.7px, transparent 1.8px),
          radial-gradient(circle at 42% 12%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 58% 25%, #e8f0ff 0.8px, transparent 2px),
          radial-gradient(circle at 72% 15%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 88% 28%, #fff 0.7px, transparent 1.8px)
        \`,
        pointerEvents: 'none',
      }} />
    </>
  );
}
`;

// components/RiverLine.tsx
const riverLineCode = `
// ===== components/RiverLine.tsx =====
function RiverLine() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: colors.riverLine,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '48%', left: 0, right: 0, height: 10,
        background: colors.riverGlow,
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)',
        backgroundSize: '200% 100%',
        animation: 'river-flow 6s linear infinite',
        pointerEvents: 'none',
      }} />
    </>
  );
}
`;

// hooks/useRiverViewport.ts (types dropped; React hooks already destructured)
const viewportHookCode = `
// ===== hooks/useRiverViewport.ts =====
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_FACTOR = 1.1;
const DRAG_THRESHOLD = 4;

function useRiverViewport() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    dragMovedRef.current = false;
  }, [pan]);

  const onMouseMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    dragMovedRef.current = true;
    setDragging(true);
    setPan({ x: d.panX + dx, y: d.panY + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  return {
    zoom,
    pan,
    dragging,
    dragMovedRef,
    containerProps: {
      ref: containerRef,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      style: { cursor: dragging ? 'grabbing' : 'grab' },
    },
    canvasStyle: {
      transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')',
      transformOrigin: '0 50%',
      transition: dragging ? 'none' : 'transform 0.05s linear',
      willChange: 'transform',
    },
  };
}
`;

// components/TimeAxis.tsx
const timeAxisCode = `
// ===== components/TimeAxis.tsx =====
function TimeAxis({ left, right }) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      background: 'linear-gradient(180deg, transparent 0%, rgba(2,5,20,0.6) 100%)',
      borderTop: '1px solid rgba(216,224,240,0.15)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
    }}>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{left}</div>
      <div style={{
        flex: 1, height: 1, margin: '0 12px',
        background: 'linear-gradient(90deg, rgba(216,224,240,0.4), rgba(216,224,240,0.6), rgba(216,224,240,0.4))',
      }} />
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{right}</div>
    </div>
  );
}
`;

// components/SearchBox.tsx (note: buildIndex called at module top-level;
// must be invoked AFTER poets/poems globals exist. We'll call it inline below.)
const searchBoxCode = `
// ===== components/SearchBox.tsx =====
function SearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const result = useMemo(() => searchIndex.query(query), [query]);

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
          border: \`1px solid \${query && open ? 'rgba(216,224,240,0.55)' : 'rgba(216,224,240,0.25)'}\`,
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
              <ResultRow key={p.id} onClick={() => { navigate(\`/poet/\${p.id}\`); setOpen(false); }}>
                <span>{highlight(p.name, query)}</span>
              </ResultRow>
            ))}
            {result.poets.length > 3 && <MoreHint>还有 {result.poets.length - 3} 位 ↓</MoreHint>}
          </Section>
          <Section title="诗 名" count={result.poems.length}>
            {result.poems.length === 0 && <Empty>无匹配诗名</Empty>}
            {result.poems.slice(0, 3).map((p) => (
              <ResultRow key={p.id} onClick={() => { navigate(\`/poem/\${p.id}\`); setOpen(false); }}>
                <span>{highlight(p.title, query)}</span>
              </ResultRow>
            ))}
            {result.poems.length > 3 && <MoreHint>还有 {result.poems.length - 3} 首 ↓</MoreHint>}
          </Section>
          <Section title="诗 句" count={result.verses.length}>
            {result.verses.length === 0 && <Empty>无匹配诗句</Empty>}
            {result.verses.slice(0, 3).map((v, i) => (
              <ResultRow key={i} onClick={() => { navigate(\`/poem/\${v.poemId}\`); setOpen(false); }}>
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

function Section({ title, count, children }) {
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

function ResultRow({ children, onClick }) {
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

function Empty({ children }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '4px 0' }}>{children}</div>;
}

function MoreHint({ children }) {
  return <div style={{ color: colors.textFaint, fontSize: 14, fontFamily: fontFamilies.chinese, padding: '6px 8px' }}>{children}</div>;
}

function highlight(text, query) {
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
`;

// components/TopNav.tsx
const topNavCode = `
// ===== components/TopNav.tsx =====
function TopNav(props) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #020514 0%, #0a1228 100%)',
      padding: '16px 28px',
      borderBottom: '1px solid rgba(216,224,240,0.18)',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {props.variant === 'main' && (
        <>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 22, letterSpacing: 6,
            textShadow: '0 0 12px rgba(216,224,240,0.5)',
          }}>诗文长河</div>
          <SearchBox />
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poet' && (
        <>
          <BackLink to="/" label="返回长河" />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 24, letterSpacing: 6,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{props.poet.name}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>
            {(() => {
              const meta = metaString(props.poet);
              const years = \`\${props.poet.birthYear}—\${props.poet.deathYear}\`;
              return meta ? \`\${meta} · \${years}\` : years;
            })()}
          </div>
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poem' && (
        <>
          <BackLink to={\`/poet/\${props.poet.id}\`} label={\`返回\${props.poet.name}\`} />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 20, letterSpacing: 4,
            textShadow: '0 0 10px rgba(216,224,240,0.5)',
          }}>{props.poem.title}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>{props.poem.creationYear != null
            ? \`\${props.poet.name} · \${props.poem.creationYear}\`
            : props.poet.name}</div>
        </>
      )}
    </div>
  );
}

function metaString(poet) {
  const parts = [];
  if (poet.courtesyName) parts.push(\`字\${poet.courtesyName}\`);
  if (poet.pseudonym) parts.push(\`号\${poet.pseudonym}\`);
  return parts.join(' · ');
}

function DynastyLabel() {
  return (
    <div style={{
      marginLeft: 'auto',
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.meta, letterSpacing: 3,
      padding: '6px 14px',
      border: '1px solid rgba(216,224,240,0.2)',
      borderRadius: 3,
    }}>唐</div>
  );
}

function BackLink({ to, label }) {
  return <Link to={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← {label}</Link>;
}
`;

// pages/RiverPage.tsx
const riverPageCode = `
// ===== pages/RiverPage.tsx =====
function RiverPage() {
  const poets = getPoets();
  const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div
        {...vp.containerProps}
        style={{
          position: 'relative', flex: 1,
          background: colors.bgGradient, overflow: 'hidden',
          ...vp.containerProps.style,
        }}
      >
        <div style={{
          position: 'relative', width: '600%', height: '100%',
          ...vp.canvasStyle,
        }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poet, x, y }) => {
            const size = nodeSizes[poet.familiarity] ?? nodeSizes[2];
            const isFocal = poet.familiarity >= 4;
            return (
              <Link
                key={poet.id}
                to={\`/poet/\${poet.id}\`}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                style={{
                  position: 'absolute',
                  top: \`calc(50% + \${y}%)\`,
                  left: \`\${x}%\`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  color: isFocal ? '#fff' : colors.textPrimary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault,
                  textShadow: isFocal ? '0 0 14px rgba(216,224,240,0.8), 0 0 4px #fff' : '0 0 6px rgba(216,224,240,0.4)',
                  marginBottom: 8,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 4 : undefined,
                }}>{poet.name}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? \`0 0 \${size}px rgba(216,224,240,0.9), 0 0 6px #fff\`
                    : \`0 0 \${size}px rgba(216,224,240,0.7)\`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left="618 · 唐" right="907" />
          </div>
        </div>
      </div>
    </div>
  );
}
`;

// pages/PoetPage.tsx
const poetPageCode = `
// ===== pages/PoetPage.tsx =====
function PoetPage() {
  const { poetId } = useParams();
  const poet = poetId ? getPoet(poetId) : undefined;
  const vp = useRiverViewport();
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const poems = getPoemsByPoet(poet.id);
  const positioned = layoutPoems(poems, poet, { leftPadding: 6, rightPadding: 6 });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poet" poet={poet} />
      <div
        {...vp.containerProps}
        style={{
          position: 'relative', flex: 1,
          background: colors.bgGradient, overflow: 'hidden',
          ...vp.containerProps.style,
        }}
      >
        <div style={{
          position: 'relative', width: '600%', height: '100%',
          ...vp.canvasStyle,
        }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poem, x, y }) => {
            const size = nodeSizes[poem.familiarity] ?? nodeSizes[2];
            const isFocal = poem.familiarity >= 5;
            return (
              <Link
                key={poem.id}
                to={\`/poem/\${poem.id}\`}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                style={{
                  position: 'absolute',
                  top: \`calc(50% + \${y}%)\`,
                  left: \`\${x}%\`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  color: isFocal ? '#fff' : colors.textPrimary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: isFocal ? fontSizes.nodeLarge : fontSizes.body,
                  textShadow: isFocal ? '0 0 12px rgba(216,224,240,0.8)' : 'none',
                  marginBottom: 6,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 2 : undefined,
                }}>{poem.title}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? \`0 0 \${size}px rgba(216,224,240,0.9), 0 0 4px #fff\`
                    : \`0 0 \${size}px rgba(216,224,240,0.6)\`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left={\`\${poet.birthYear} · 生\`} right={\`\${poet.deathYear} · 卒\`} />
          </div>
        </div>
      </div>
    </div>
  );
}
`;

// pages/PoemPage.tsx (local helpers navCardStyle/Divider/SectionTitle stay top-level in shared scope;
// no collision with other files since they're unique names)
const poemPageCode = `
// ===== pages/PoemPage.tsx =====
function PoemPage() {
  const { poemId } = useParams();
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const { prev, next } = getNeighbors(poem.id);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} />
      <div style={{
        flex: 1, overflowY: 'auto',
        background: colors.bgGradient,
      }}>
        <div style={{ position: 'relative', height: 70, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 16, right: '14%',
            width: 36, height: 36, borderRadius: '50%',
            background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
            boxShadow: '0 0 30px rgba(216,224,240,0.4)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: \`
              radial-gradient(circle at 18% 40%, #fff 0.6px, transparent 1.5px),
              radial-gradient(circle at 38% 20%, #e8f0ff 0.6px, transparent 1.5px),
              radial-gradient(circle at 62% 50%, #fff 0.5px, transparent 1.5px),
              radial-gradient(circle at 82% 25%, #e8f0ff 0.6px, transparent 1.5px)
            \`,
          }} />
        </div>

        <div style={{ padding: '8px 32px 28px', textAlign: 'center' }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: '#fff',
            fontSize: fontSizes.poemTitle, letterSpacing: 8,
            marginBottom: 8, fontWeight: 600,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{poem.title}</div>
          <div style={{
            color: colors.textDim, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.body, letterSpacing: 3, marginBottom: 28,
          }}>{poet.name} · 唐</div>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: fontSizes.poemText, lineHeight: 2.6, letterSpacing: 2,
            whiteSpace: 'pre-wrap',
          }}>{poem.content}</div>
        </div>

        <Divider />

        {poem.annotations.length > 0 && (
          <>
            <section style={{ padding: '24px 32px' }}>
              <SectionTitle>注 释</SectionTitle>
              <div style={{
                color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                fontSize: fontSizes.body, lineHeight: 1.9,
              }}>
                {poem.annotations.map((a, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <span style={{ color: colors.textPrimary }}>{a.term}：</span>
                    {a.explanation}
                  </div>
                ))}
              </div>
            </section>
            <Divider />
          </>
        )}

        {poem.background && (
          <>
            <section style={{ padding: '24px 32px' }}>
              <SectionTitle>创 作 背 景</SectionTitle>
              <div style={{
                color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                fontSize: fontSizes.body, lineHeight: 2,
              }}>{poem.background}</div>
            </section>
            <Divider />
          </>
        )}

        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
        }}>
          {prev ? (
            <Link to={\`/poem/\${prev.id}\`} style={navCardStyle}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{prev.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是第一首）</div>
            </div>
          )}
          {next ? (
            <Link to={\`/poem/\${next.id}\`} style={{ ...navCardStyle, textAlign: 'right' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{next.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, textAlign: 'right', opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是最后一首）</div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

const navCardStyle = {
  flex: 1, padding: '14px 18px',
  background: 'rgba(216,224,240,0.05)',
  border: '1px solid rgba(216,224,240,0.18)',
  borderRadius: 4,
  textDecoration: 'none',
};

function Divider() {
  return <div style={{ margin: '0 32px', borderTop: '1px dashed rgba(216,224,240,0.18)' }} />;
}

function SectionTitle({ children }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
`;

// App.tsx (BrowserRouter -> HashRouter)
const appCode = `
// ===== App.tsx =====
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
      </Routes>
    </HashRouter>
  );
}

// Build search index now that poets/poems globals + loadCode are defined.
const searchIndex = buildIndex();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`;

// ---- Assemble the app source (plain text, compiled by bootstrap) ----
const appSource = `
const { useState, useMemo, useRef, useEffect, useCallback } = React;

${miniRouterCode}
${themeCode}
${loadCode}
${searchCode}
${layoutCode}
${riverBgCode}
${riverLineCode}
${viewportHookCode}
${timeAxisCode}
${searchBoxCode}
${topNavCode}
${riverPageCode}
${poetPageCode}
${poemPageCode}
${appCode}
`;

// ---- Assemble the final HTML ----
const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>诗文长河</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- CDN libs (no react-router-dom — mini router inlined below) -->
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Inline data -->
  <script>
    window.__POETS__ = ${poetsJson};
    window.__POEMS__ = ${poemsJson};
  </script>

  <!-- App source (NOT executed as-is — bootstrap below compiles it with classic JSX runtime) -->
  <script type="text/plain" id="app-source">
${appSource}
  </script>

  <!-- Bootstrap: transform app source with classic JSX runtime (no \`import\`), then execute -->
  <script>
    (function () {
      var src = document.getElementById('app-source').textContent;
      var out = Babel.transform(src, {
        presets: [['react', { runtime: 'classic' }]]
      });
      var s = document.createElement('script');
      s.textContent = out.code;
      document.body.appendChild(s);
    })();
  </script>
</body>
</html>
`;

const OUT = path.join(ROOT, 'standalone.html');
fs.writeFileSync(OUT, html, 'utf-8');
console.log('Wrote', OUT, '(' + fs.statSync(OUT).size + ' bytes)');
