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
  poemTextShort: 20,
  poemTextLong: 17,
  sectionTitle: 16,
};

const nodeSizes = {
  1: 10,
  2: 12,
  3: 14,
  4: 18,
  5: 22,
};

function poemCountToSize(count) {
  return Math.max(8, Math.min(24, 6 + Math.sqrt(count) * 3));
}

function contentLengthToSize(len) {
  return Math.max(8, Math.min(24, 6 + Math.sqrt(len) * 1.2));
}

const fontFamilies = {
  chinese: "'KaiTi', 'STKaiti', 'STZhongsong', 'SimSun', serif",
};
`;

// state/corpus.tsx (Context + Provider + hooks; localStorage persistence)
const corpusCode = `
// ===== state/corpus.tsx =====
const CORPUS_STORAGE_KEY = 'feihuaCorpus';
const CorpusCtx = React.createContext(null);

function CorpusProvider({ children }) {
  const [corpus, setCorpusState] = useState(function () {
    if (typeof localStorage === 'undefined') return 'tang';
    var v = localStorage.getItem(CORPUS_STORAGE_KEY);
    return v === 'primary' ? 'primary' : 'tang';
  });

  // 跨标签页同步
  useEffect(function () {
    function onStorage(e) {
      if (e.key === CORPUS_STORAGE_KEY && (e.newValue === 'primary' || e.newValue === 'tang' || e.newValue === null)) {
        setCorpusState(e.newValue === 'primary' ? 'primary' : 'tang');
      }
    }
    window.addEventListener('storage', onStorage);
    return function () { window.removeEventListener('storage', onStorage); };
  }, []);

  function setCorpus(c) {
    setCorpusState(c);
    try { localStorage.setItem(CORPUS_STORAGE_KEY, c); } catch (e) {}
  }

  return <CorpusCtx.Provider value={{ corpus: corpus, setCorpus: setCorpus }}>{children}</CorpusCtx.Provider>;
}

function useCorpus() {
  var v = React.useContext(CorpusCtx);
  if (!v) throw new Error('useCorpus outside CorpusProvider');
  return v.corpus;
}

function useSetCorpus() {
  var v = React.useContext(CorpusCtx);
  if (!v) throw new Error('useCorpus outside CorpusProvider');
  return v.setCorpus;
}
`;

// data/load.ts (logic preserved, JSON imports -> window globals)
const loadCode = `
// ===== data/load.ts =====
function withCorpus(x, fallback) {
  return Object.assign({}, x, { corpus: x.corpus != null ? x.corpus : fallback });
}

const poets = window.__POETS__.map(function(p) { return withCorpus(p, 'tang'); });
const poems = window.__POEMS__.map(function(p) { return withCorpus(p, 'tang'); });

function getPoets() {
  return poets;
}

function getPoetsCorpus(corpus) {
  if (!corpus || corpus === 'all') return poets;
  return poets.filter(function(p) { return p.corpus === corpus; });
}

function getPoems() {
  return poems;
}

function getPoemsCorpus(corpus) {
  if (!corpus || corpus === 'both') return poems;
  if (corpus === 'tang') return poems.filter(function(p) { return p.corpus !== 'primary'; });
  return poems.filter(function(p) { return p.corpus !== 'tang'; });
}

function getPoet(poetId) {
  return poets.find(function(p) { return p.id === poetId; });
}

function getPoetByName(name) {
  return poets.find(function(p) { return p.name === name; });
}

function getPoemsByPoet(poetId) {
  return poems
    .filter(function(p) { return p.poetId === poetId; })
    .sort(function(a, b) {
      if (a.creationYear === undefined && b.creationYear === undefined) return 0;
      if (a.creationYear === undefined) return 1;
      if (b.creationYear === undefined) return -1;
      return a.creationYear - b.creationYear;
    });
}

function getPoemCount(poetId) {
  return poems.filter(function(p) { return p.poetId === poetId; }).length;
}

function getPoem(poemId) {
  return poems.find(function(p) { return p.id === poemId; });
}

function getNeighbors(poemId) {
  const poem = getPoem(poemId);
  if (!poem) return {};
  const siblings = getPoemsByPoet(poem.poetId);
  const idx = siblings.findIndex(function(p) { return p.id === poemId; });
  return {
    prev: idx > 0 ? siblings[idx - 1] : undefined,
    next: idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined,
  };
}

function getGlobalPoemNeighbors(poemId) {
  const sorted = poems.slice().sort(function(a, b) {
    const ya = a.creationYear != null ? a.creationYear : (getPoet(a.poetId) ? getPoet(a.poetId).birthYear : 0);
    const yb = b.creationYear != null ? b.creationYear : (getPoet(b.poetId) ? getPoet(b.poetId).birthYear : 0);
    return ya - yb;
  });
  const idx = sorted.findIndex(function(p) { return p.id === poemId; });
  if (idx < 0) return {};
  return {
    prev: idx > 0 ? sorted[idx - 1] : undefined,
    next: idx < sorted.length - 1 ? sorted[idx + 1] : undefined,
  };
}
`;

// utils/layout.ts (types dropped)
const layoutCode = `
// ===== utils/layout.ts =====
const COLUMN_THRESHOLD = 1.5;
const Y_RANGE = 35;
const SCATTER_Y_RANGE = 40;
const X_JITTER_RANGE = 9;
const SCATTER_MIN_DX = 1.5;
const SCATTER_MIN_DY = 10;
const SCATTER_ATTEMPTS = 1000;
const SCATTER_X_RANGE_CAP = 75;
const SCATTER_BOUND_PAD = 1;

function computePercent(year, minYear, maxYear) {
  if (year <= minYear) return 0;
  if (year >= maxYear) return 100;
  return ((year - minYear) / (maxYear - minYear)) * 100;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterPositions(count, nominalX, existing) {
  const baseRange = Math.min(SCATTER_X_RANGE_CAP, Math.max(X_JITTER_RANGE, Math.sqrt(count) * 12));
  const edgeLimit = Math.max(X_JITTER_RANGE, Math.min(nominalX, 100 - nominalX) - SCATTER_BOUND_PAD);
  const xRange = Math.min(baseRange, edgeLimit);
  const rand = mulberry32(Math.floor(nominalX * 1000) + count * 37);
  const placed = existing ? existing.slice() : [];
  const added = [];
  for (let i = 0; i < count; i++) {
    let bestX = nominalX, bestY = 0, bestCollisions = Infinity;
    for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
      const x = nominalX + (rand() * 2 - 1) * xRange;
      const y = -SCATTER_Y_RANGE + rand() * 2 * SCATTER_Y_RANGE;
      let collisions = 0;
      for (const p of placed) {
        if (Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY) collisions++;
      }
      if (collisions === 0) { bestX = x; bestY = y; bestCollisions = 0; break; }
      if (collisions < bestCollisions) { bestX = x; bestY = y; bestCollisions = collisions; }
    }
    placed.push({ x: bestX, y: bestY });
    added.push({ x: bestX, y: bestY });
  }
  return added;
}

function assignPositions(items) {
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
  const placed = [];
  const collides = (x, y) =>
    placed.some((p) => Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY);
  const countCollisions = (x, y) =>
    placed.reduce((sum, p) => sum + ((Math.abs(p.x - x) < SCATTER_MIN_DX && Math.abs(p.y - y) < SCATTER_MIN_DY) ? 1 : 0), 0);
  for (const col of columns) {
    const n = col.items.length;
    if (n === 1) {
      const it = col.items[0];
      let y = 0;
      if (collides(it.x, 0)) {
        const rand = mulberry32(Math.floor(it.x * 1000) + 1);
        let bestY = 0;
        let bestCollisions = countCollisions(it.x, 0);
        for (let attempt = 0; attempt < SCATTER_ATTEMPTS; attempt++) {
          const candidate = -Y_RANGE + rand() * 2 * Y_RANGE;
          const collisions = countCollisions(it.x, candidate);
          if (collisions === 0) { bestY = candidate; break; }
          if (collisions < bestCollisions) { bestY = candidate; bestCollisions = collisions; }
        }
        y = bestY;
      }
      out.push({ item: it.item, x: it.x, y });
      placed.push({ x: it.x, y });
    } else {
      const positions = scatterPositions(n, col.x, placed);
      positions.forEach((pos, i) => {
        const it = col.items[i];
        out.push({ item: it.item, x: pos.x, y: pos.y });
        placed.push({ x: pos.x, y: pos.y });
      });
    }
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
  return assignPositions(withX).map(({ item: poet, x, y }) => ({ poet, x, y }));
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

  return assignPositions(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
}

function layoutAllPoems(poems, poets, range) {
  const poetMap = new Map(poets.map((p) => [p.id, p]));
  const sorted = [...poems].sort((a, b) => {
    const ya = a.creationYear != null ? a.creationYear : (poetMap.get(a.poetId) ? poetMap.get(a.poetId).birthYear : 0);
    const yb = b.creationYear != null ? b.creationYear : (poetMap.get(b.poetId) ? poetMap.get(b.poetId).birthYear : 0);
    return ya - yb;
  });
  const span = 100 - range.leftPadding - range.rightPadding;
  const withX = sorted.map((poem) => {
    const year = poem.creationYear != null
      ? poem.creationYear
      : (poetMap.get(poem.poetId) ? poetMap.get(poem.poetId).birthYear : range.minYear);
    const pct = computePercent(year, range.minYear, range.maxYear);
    return { item: poem, x: range.leftPadding + (pct / 100) * span };
  });
  return assignPositions(withX).map(({ item: poem, x, y }) => ({ poem, x, y }));
}
`;

// utils/poemText.ts (types dropped)
const poemTextCode = `
// ===== utils/poemText.ts =====
function extractVariants(content) {
  const variants = [];
  const cleanText = content.replace(/\\(([^()]+)\\)/g, function(full, inside) {
    const pieces = inside.split(/[；;]/).map(function(s) { return s.trim(); });
    const parsed = [];
    for (let i = 0; i < pieces.length; i++) {
      const m = pieces[i].match(/^(.+?)\\s+(一作|通)\\s*[：:]\\s*(.+)$/);
      if (!m) return full;
      parsed.push({ original: m[1].trim(), kind: m[2], variant: m[3].trim() });
    }
    if (parsed.length === 0) return full;
    for (let i = 0; i < parsed.length; i++) variants.push(parsed[i]);
    return '';
  });
  return { cleanText: cleanText, variants: variants };
}

function getPoemMode(cleanText) {
  return cleanText.length <= 80 ? 'short' : 'long';
}

function splitIntoLines(content, mode) {
  const re = mode === 'short'
    ? /[^，。？！；]*[，。？！；]/g
    : /[^。？！]*[。？！]/g;
  const matches = content.match(re) || [];
  const consumed = matches.join('');
  const trailing = content.slice(consumed.length).trim();
  const lines = matches.map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  if (trailing) lines.push(trailing);
  return lines.length > 0 ? lines : [content.trim()].filter(function(s) { return s.length > 0; });
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
// 把"当前路径"存到模块级 _routerPath；URL 写入是 best-effort 副作用。
// 这样即使 file:// 协议下 Chrome 静默拦截 location.hash 修改，
// React 状态也能同步更新，tab 切换不被卡住。
const RouterContext = React.createContext({ path: '/', params: {} });
let _navState = null;
let _routerPath = (window.location.hash.slice(1)) || '/';
let _routerSetters = [];

function _setRouterPath(next) {
  _routerPath = next;
  // file:// 协议下任何 URL 修改都会被 Chrome 当作安全违规并静默拦截，跳过即可
  if (window.location.protocol !== 'file:') {
    try {
      var target = '#' + next;
      if (window.location.hash !== target) window.location.hash = target;
    } catch (e) {}
  }
  _routerSetters.forEach(function(s) { try { s(next); } catch (e) {} });
}

function HashRouter({ children }) {
  const [path, setPath] = useState(_routerPath);
  useEffect(() => {
    _routerSetters.push(setPath);
    const handler = () => {
      const h = window.location.hash.slice(1) || '/';
      if (h !== _routerPath) {
        _routerPath = h;
        setPath(h);
      }
    };
    window.addEventListener('hashchange', handler);
    return () => {
      window.removeEventListener('hashchange', handler);
      _routerSetters = _routerSetters.filter(function(s) { return s !== setPath; });
    };
  }, []);
  return <RouterContext.Provider value={{ path, params: {} }}>{children}</RouterContext.Provider>;
}

function matchPath(pattern, path) {
  // Strip query string suffix before matching — otherwise /play?tab=combat
  // fails to match ^/play$ and :kw captures "春?difficulty=qingdeng".
  var cleanPath = String(path).split('?')[0];
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  }) + '$';
  const m = new RegExp(regexStr).exec(cleanPath);
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

function useLocation() {
  const ctx = React.useContext(RouterContext);
  return { pathname: ctx.path, state: _navState };
}

function useNavigate() {
  return (to, opts) => {
    _navState = opts ? opts.state : null;
    var cleanTo = String(to).startsWith('#') ? String(to).slice(1) : String(to);
    _setRouterPath(cleanTo);
  };
}

function Link({ to, children, state, onClick, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={'#' + to}
      onClick={(e) => {
        if (onClick) onClick(e);
        if (e.defaultPrevented) return;
        e.preventDefault();
        navigate(to, { state: state });
      }}
      {...rest}
    >{children}</a>
  );
}

// ---- end mini router ----
`;

// components/RiverBackground.tsx
const riverBgCode = `
// ===== components/RiverBackground.tsx =====
const NEBULA_CLOUDS = [
  { x: 18, y: 50, w: 700, h: 240, color: 'rgba(180,140,220,0.20)', dur: 50, delay: 0 },
  { x: 50, y: 45, w: 820, h: 280, color: 'rgba(150,180,230,0.18)', dur: 62, delay: -15 },
  { x: 78, y: 52, w: 600, h: 220, color: 'rgba(220,160,180,0.16)', dur: 55, delay: -25 },
  { x: 35, y: 55, w: 520, h: 180, color: 'rgba(200,180,140,0.14)', dur: 48, delay: -8 },
];

const STARS = Array.from({ length: 60 }, function () {
  const inBand = Math.random() < 0.6;
  return {
    top: inBand ? 28 + Math.random() * 44 : Math.random() * 100,
    left: Math.random() * 100,
    size: 0.6 + Math.random() * 1.4,
    duration: 2 + Math.random() * 4,
    delay: -Math.random() * 6,
  };
});

const STARS_LAYER2 = Array.from({ length: 40 }, function () {
  const inBand = Math.random() < 0.5;
  return {
    top: inBand ? 35 + Math.random() * 30 : Math.random() * 100,
    left: Math.random() * 100,
    size: 0.5 + Math.random() * 1.0,
    duration: 3 + Math.random() * 5,
    delay: -Math.random() * 6,
  };
});

const TWINKLE_DOTS = Array.from({ length: 7 }, function (i) {
  return {
    top: 10 + Math.random() * 80,
    left: 8 + Math.random() * 84,
    size: 1 + Math.random() * 1,
    delay: -(i * 0.85 + Math.random() * 6),
  };
});

const PARALLAX_COEFS = {
  moon: 12,
  nebula: 6,
  stars: 3.6,
  starsLayer2: 2.4,
};

function RiverBackground({ dragging }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(null);
  const draggingRef = useRef(dragging);

  useEffect(() => { draggingRef.current = dragging; }, [dragging]);

  useEffect(() => {
    const handler = (e) => {
      if (draggingRef.current) return;
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      };
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          setMouse(mouseRef.current);
        });
      }
    };
    window.addEventListener('mousemove', handler);
    return () => {
      window.removeEventListener('mousemove', handler);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const parallax = (coef) =>
    \`translate(\${(mouse.x * coef).toFixed(1)}px, \${(mouse.y * coef).toFixed(1)}px)\`;

  const layer2Bg = \`
    radial-gradient(circle at 12% 22%, rgba(255,255,255,0.35) 0px, transparent 1.5px),
    radial-gradient(circle at 33% 78%, rgba(216,224,240,0.3) 0px, transparent 1.5px),
    radial-gradient(circle at 55% 18%, rgba(255,255,255,0.25) 0px, transparent 1.5px),
    radial-gradient(circle at 72% 60%, rgba(216,224,240,0.32) 0px, transparent 1.5px),
    radial-gradient(circle at 88% 35%, rgba(255,255,255,0.28) 0px, transparent 1.5px),
    radial-gradient(circle at 22% 50%, rgba(216,224,240,0.22) 0px, transparent 1.5px)
  \`;

  return (
    <>
      {/* 星云气尘 — parallax wrapper */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: parallax(PARALLAX_COEFS.nebula),
        willChange: 'transform',
        pointerEvents: 'none',
      }}>
        {NEBULA_CLOUDS.map((c, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: \`\${c.y}%\`,
            left: \`\${c.x}%\`,
            transform: 'translate(-50%, -50%)',
          }}>
            <div style={{
              width: c.w,
              height: c.h,
              background: \`radial-gradient(ellipse, \${c.color} 0%, transparent 70%)\`,
              filter: 'blur(40px)',
              animation: \`nebula-drift \${c.dur}s ease-in-out \${c.delay}s infinite alternate\`,
            }} />
          </div>
        ))}
      </div>

      {/* 星点 layer 1 — outer parallax + inner drift + per-star twinkle */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: parallax(PARALLAX_COEFS.stars),
        willChange: 'transform',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          animation: 'stars-drift 360s ease-in-out infinite alternate',
        }}>
          {STARS.map((s, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: \`\${s.top}%\`,
              left: \`\${s.left}%\`,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: \`0 0 \${s.size * 2}px rgba(255,255,255,0.7)\`,
              animation: \`twinkle \${s.duration}s ease-in-out \${s.delay}s infinite alternate\`,
            }} />
          ))}
        </div>
      </div>

      {/* 星点 layer 2 — slower parallax + drift background pattern */}
      <div style={{
        position: 'absolute', inset: 0,
        transform: parallax(PARALLAX_COEFS.starsLayer2),
        willChange: 'transform',
        pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: layer2Bg,
          backgroundSize: '320px 320px',
          animation: 'star-drift-slow 180s linear infinite alternate',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: layer2Bg,
          backgroundSize: '480px 480px',
          backgroundPosition: '120px 60px',
          animation: 'star-drift-slower 240s linear infinite alternate',
        }} />
        {STARS_LAYER2.map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: \`\${s.top}%\`,
            left: \`\${s.left}%\`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: \`0 0 \${s.size * 2}px rgba(255,255,255,0.55)\`,
            animation: \`twinkle \${s.duration}s ease-in-out \${s.delay}s infinite alternate\`,
          }} />
        ))}
      </div>

      {/* Rare twinkle dots */}
      {TWINKLE_DOTS.map(function(d, i) {
        return (
          <div key={\`tw-\${i}\`} style={{
            position: 'absolute',
            top: d.top + '%',
            left: d.left + '%',
            width: d.size,
            height: d.size,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 ' + (d.size * 3) + 'px rgba(255,255,255,0.85)',
            animation: 'twinkle 4s ease-in-out ' + d.delay + 's infinite alternate',
            pointerEvents: 'none',
          }} />
        );
      })}

      {/* 月亮 */}
      <div style={{
        position: 'absolute', top: '8%', right: '6%',
        width: 72, height: 72, borderRadius: '50%',
        background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
        boxShadow: '0 0 60px rgba(216,224,240,0.3)',
        transform: parallax(PARALLAX_COEFS.moon),
        pointerEvents: 'none',
        willChange: 'transform',
      }} />
    </>
  );
}
`;

// hooks/useVisited.ts
const useVisitedCode = `
// ===== hooks/useVisited.ts =====
function readVisitedIds() {
  try {
    var raw = window.localStorage.getItem('shiwen-visited');
    if (!raw) return new Set();
    var parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(function(v) { return typeof v === 'string'; }));
  } catch (e) {
    return new Set();
  }
}

function writeVisitedIds(ids) {
  try {
    window.localStorage.setItem('shiwen-visited', JSON.stringify(Array.from(ids)));
  } catch (e) {
    // localStorage unavailable — silently fail
  }
}

function useVisited() {
  const [ids, setIds] = useState(function() { return new Set(); });

  useEffect(function() {
    setIds(readVisitedIds());
  }, []);

  function markVisited(id) {
    setIds(function(prev) {
      if (prev.has(id)) return prev;
      var next = new Set(prev);
      next.add(id);
      writeVisitedIds(next);
      return next;
    });
  }

  return { visited: ids, markVisited: markVisited };
}
`;

// hooks/useRiverViewport.ts (types dropped; React hooks already destructured)
// Pointer Events: single-pointer drag, two-pointer pinch zoom, wheel zoom.
// Works for mouse + touch + pen from one code path.
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
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const realFactor = newZoom / oldZoom;
      const oldPan = panRef.current;
      setPan({
        x: cx - (cx - oldPan.x) * realFactor,
        y: cy - (cy - oldPan.y) * realFactor,
      });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ }

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        panX: panRef.current.x, panY: panRef.current.y,
        moved: false,
      };
      dragMovedRef.current = false;
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const a = pts[0], b = pts[1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const el = containerRef.current;
      if (!el || dist === 0) return;
      const rect = el.getBoundingClientRect();
      pinchRef.current = {
        startDist: dist,
        startZoom: zoomRef.current,
        startPan: { x: panRef.current.x, y: panRef.current.y },
        midX: (a.x + b.x) / 2 - rect.left,
        midY: (a.y + b.y) / 2 - rect.top,
      };
      dragRef.current = null;
    }
  }, []);

  const onPointerMove = useCallback((e) => {
    const stored = pointersRef.current.get(e.pointerId);
    if (!stored) return;
    stored.x = e.clientX;
    stored.y = e.clientY;

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const a = pts[0], b = pts[1];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / pinchRef.current.startDist;
      const oldZoom = pinchRef.current.startZoom;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const realFactor = newZoom / oldZoom;
      const cx = pinchRef.current.midX;
      const cy = pinchRef.current.midY;
      const oldPan = pinchRef.current.startPan;
      setPan({
        x: cx - (cx - oldPan.x) * realFactor,
        y: cy - (cy - oldPan.y) * realFactor,
      });
      setZoom(newZoom);
      setDragging(true);
      return;
    }

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

  const endPointer = useCallback((e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      setDragging(false);
    }
    try { e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (_) { /* not capturable */ }
  }, []);

  const onPointerUp = endPointer;
  const onPointerCancel = endPointer;
  const onPointerLeave = useCallback((e) => {
    if (pointersRef.current.has(e.pointerId)) endPointer(e);
  }, [endPointer]);

  return {
    zoom,
    pan,
    dragging,
    dragMovedRef,
    containerProps: {
      ref: containerRef,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      style: { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' },
    },
    canvasStyle: {
      transform: 'translate(' + pan.x + 'px,' + pan.y + 'px) scale(' + zoom + ')',
      transformOrigin: '0 0',
      transition: dragging ? 'none' : 'transform 0.05s linear',
      willChange: 'transform',
    },
  };
}
`;

// hooks/useBreakpoint.ts — mobile < 600, tablet 600-899, desktop >= 900.
const useBreakpointCode = `
// ===== hooks/useBreakpoint.ts =====
const MOBILE_MAX = 599;
const TABLET_MAX = 899;

function computeBreakpoint(width) {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

function useBreakpoint() {
  const [bp, setBp] = useState(function () {
    if (typeof window === 'undefined') return 'desktop';
    return computeBreakpoint(window.innerWidth);
  });
  useEffect(function () {
    const onResize = function () { setBp(computeBreakpoint(window.innerWidth)); };
    window.addEventListener('resize', onResize);
    return function () { window.removeEventListener('resize', onResize); };
  }, []);
  return bp;
}
`;

// components/TimeAxis.tsx
const timeAxisCode = `
// ===== components/TimeAxis.tsx =====
function TimeAxis({ left, right, ticks }) {
  if (!Array.isArray(ticks)) ticks = [];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      background: 'linear-gradient(180deg, transparent 0%, rgba(2,5,20,0.6) 100%)',
      borderTop: '1px solid rgba(216,224,240,0.15)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
    }}>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{left}</div>
      <div style={{
        flex: 1, position: 'relative', height: 1, margin: '0 12px',
        background: 'linear-gradient(90deg, rgba(216,224,240,0.4), rgba(216,224,240,0.6), rgba(216,224,240,0.4))',
      }}>
        {ticks.map(function(t) {
          var isMajor = !!t.label;
          var opacity = isMajor ? 0.4 : 0.2;
          return (
            <div key={t.year} style={{
              position: 'absolute',
              top: -8,
              left: t.pos + '%',
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 1, height: isMajor ? 16 : 10,
                background: 'rgba(216,224,240,' + opacity + ')',
              }} />
              {isMajor && t.label && (
                <div style={{
                  position: 'absolute', top: 18,
                  color: colors.textDim, fontSize: 12, letterSpacing: 1,
                  fontFamily: fontFamilies.chinese,
                  whiteSpace: 'nowrap',
                }}>{t.label}</div>
              )}
            </div>
          );
        })}
      </div>
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

// components/CorpusSwitcher.tsx (TS types dropped; uses globals useCorpus/useSetCorpus/useBreakpoint/useLocation/useNavigate)
const corpusSwitcherCode = `
// ===== components/CorpusSwitcher.tsx =====
var PLAY_SCREEN_RE = /^\\/play\\/(stage|sentence)\\//;

function CorpusSwitcher() {
  const corpus = useCorpus();
  const setCorpus = useSetCorpus();
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  function onSwitch(next) {
    if (next === corpus) return;
    if (PLAY_SCREEN_RE.test(location.pathname)) {
      navigate('/play', { replace: true });
    }
    setCorpus(next);
  }

  const baseStyle = {
    fontFamily: fontFamilies.chinese,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: isMobile ? '4px 10px' : '6px 14px',
    fontSize: isMobile ? 11 : 13,
    letterSpacing: 2,
    borderRadius: 3,
    transition: 'all 0.15s',
  };
  const activeStyle = Object.assign({}, baseStyle, {
    background: '#f5ebd2',
    color: '#1a2855',
    boxShadow: 'inset 0 0 0 1px #d4af6a',
  });
  const inactiveStyle = Object.assign({}, baseStyle, {
    color: '#d4af6a',
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #d4af6a',
        borderRadius: 4,
        overflow: 'hidden',
      }}
      role="tablist"
      aria-label="诗库切换"
    >
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'tang'}
        onClick={function () { onSwitch('tang'); }}
        style={corpus === 'tang' ? activeStyle : inactiveStyle}
        data-testid="corpus-tang"
      >{isMobile ? '唐诗' : '唐诗三百首'}</button>
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'primary'}
        onClick={function () { onSwitch('primary'); }}
        style={corpus === 'primary' ? activeStyle : inactiveStyle}
        data-testid="corpus-primary"
      >{isMobile ? '小学' : '小学必背'}</button>
    </div>
  );
}
`;

// components/TopNav.tsx
const topNavCode = `
// ===== components/TopNav.tsx =====
function TopNav(props) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  return (
    <div style={{
      background: 'linear-gradient(180deg, #020514 0%, #0a1228 100%)',
      padding: isMobile ? '12px 14px' : '16px 28px',
      borderBottom: '1px solid rgba(216,224,240,0.18)',
      display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20,
    }}>
      {props.variant === 'main' && (
        <>
          {!isMobile && (
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 22, letterSpacing: 6,
              textShadow: '0 0 12px rgba(216,224,240,0.5)',
            }}>诗文长河</div>
          )}
          <RiverToggle compact={isMobile} />
          <SearchBox />
          <DynastyLabel />
          <CorpusSwitcher />
        </>
      )}

      {props.variant === 'poet' && (
        <>
          <BackLink to="/" label="返回长河" />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: isMobile ? 18 : 24, letterSpacing: isMobile ? 3 : 6,
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
          <CorpusSwitcher />
        </>
      )}

      {props.variant === 'poem' && (
        <>
          <BackLink
            to={props.backTo != null ? props.backTo : \`/poet/\${props.poet.id}\`}
            label={props.backLabel != null ? props.backLabel : \`返回\${props.poet.name}\`}
          />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: isMobile ? 16 : 20, letterSpacing: isMobile ? 2 : 4,
            textShadow: '0 0 10px rgba(216,224,240,0.5)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: isMobile ? '40vw' : undefined,
          }}>{props.poem.title}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
            display: isMobile ? 'none' : undefined,
          }}>{props.poem.creationYear != null
            ? \`\${props.poet.name} · \${props.poem.creationYear}\`
            : props.poet.name}</div>
          <div style={{ marginLeft: 'auto' }}><CorpusSwitcher /></div>
        </>
      )}
    </div>
  );
}

function RiverToggle({ compact }) {
  const loc = useLocation();
  const btn = (to, label, count) => {
    const on = loc.pathname === to;
    const showCount = count > 0;
    const text = on && showCount ? label + '·' + count : label;
    return (
      <Link to={to} style={{
        color: on ? '#fff' : colors.textTertiary,
        fontFamily: fontFamilies.chinese,
        fontSize: compact ? 14 : 16,
        letterSpacing: compact ? 1 : 3,
        padding: compact ? '4px 8px' : '6px 14px',
        textDecoration: 'none',
        borderBottom: on ? '2px solid #fff' : '2px solid transparent',
        textShadow: on ? '0 0 10px rgba(216,224,240,0.6)' : 'none',
        boxShadow: on ? '0 2px 8px -2px rgba(212,175,106,0.55)' : 'none',
        whiteSpace: 'nowrap',
      }}>{text}</Link>
    );
  };
  return (
    <div style={{ display: 'flex', gap: compact ? 0 : 4 }}>
      {btn('/', '诗人', getPoets().length)}
      {btn('/poems', '诗文', getPoems().length)}
      {btn('/play', '飞花令', 0)}
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
  return <Link to={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>← {label}</Link>;
}
`;

// pages/RiverPage.tsx
const riverPageCode = `
// ===== pages/RiverPage.tsx =====
const RIVER_TICKS = (function () {
  const out = [];
  for (let y = 618; y <= 897; y += 30) {
    const isMajor = y % 30 === 0;
    out.push({ year: y, label: isMajor ? String(y) : undefined, pos: ((y - 618) / (907 - 618)) * 100 });
  }
  return out;
})();

function RiverPage() {
  const poets = getPoets();
  const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState(null);
  const bp = useBreakpoint();
  const scale = bp === 'mobile' ? 0.7 : bp === 'tablet' ? 0.85 : 1;
  const nameScale = bp === 'mobile' ? 0.85 : 1;

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
          <RiverBackground dragging={vp.dragging} />
          {positioned.map(({ poet, x, y }, i) => {
            const size = poemCountToSize(getPoemCount(poet.id)) * scale;
            const isFocal = poet.familiarity >= 4;
            const isVisited = visited.has(poet.id);
            const floatDuration = 4 + (i % 3);
            const floatDelay = -((i % 7) * 0.5);
            const highlightCore = isVisited ? '#d8e0f0' : '#fff';
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
                onClick={() => markVisited(poet.id)}
                style={{
                  position: 'absolute',
                  top: \`calc(50% + \${y}%)\`,
                  left: \`\${x}%\`,
                  transform: 'translate(-50%, -50%)',
                  textDecoration: 'none',
                }}
              >
                <div
                  onMouseEnter={() => setHoverId(poet.id)}
                  onMouseLeave={() => setHoverId((id) => (id === poet.id ? null : id))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: \`node-float \${floatDuration}s ease-in-out \${floatDelay}s infinite\`,
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      color: isFocal ? '#fff' : colors.textPrimary,
                      fontFamily: fontFamilies.chinese,
                      fontSize: (isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault) * nameScale,
                      textShadow: isFocal ? '0 0 14px rgba(216,224,240,0.8), 0 0 4px #fff' : '0 0 6px rgba(216,224,240,0.4)',
                      marginBottom: 8,
                      fontWeight: isFocal ? 600 : undefined,
                      letterSpacing: isFocal ? 4 : undefined,
                    }}>{poet.name}</div>
                    {isFocal && (
                      <div style={{
                        position: 'absolute', top: '100%', left: '15%', right: '15%',
                        height: 1, marginTop: 2,
                        background: 'linear-gradient(90deg, transparent, rgba(216,224,240,0.7), transparent)',
                      }} />
                    )}
                  </div>
                  <div style={{
                    position: 'relative',
                    width: size, height: size, borderRadius: '50%',
                    background: \`radial-gradient(circle, \${highlightCore} 0%, #d8e0f0 60%, transparent 100%)\`,
                    border: '1px solid rgba(216,224,240,0.45)',
                    boxShadow: isFocal
                      ? \`0 0 \${size}px rgba(216,224,240,0.9), 0 0 6px #fff\`
                      : \`0 0 \${size}px rgba(216,224,240,0.7)\`,
                    animation: isFocal ? 'focal-pulse 3.2s ease-in-out infinite' : 'none',
                  }}>
                    <div style={{
                      position: 'absolute', inset: '25%',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, transparent 60%)',
                    }} />
                  </div>
                  {hoverId === poet.id && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%',
                      transform: 'translate(-50%, -12px)',
                      background: 'rgba(8,12,28,0.92)',
                      border: '1px solid rgba(216,224,240,0.25)',
                      borderRadius: 4, padding: 8,
                      whiteSpace: 'nowrap',
                      color: colors.textPrimary, fontSize: 12,
                      fontFamily: fontFamilies.chinese,
                      pointerEvents: 'none', zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{poet.birthYear}—{poet.deathYear}</span>
                        <span style={{ color: colors.textDim }}>·</span>
                        <span style={{ color: colors.textSecondary }}>唐</span>
                      </div>
                      <div style={{
                        position: 'absolute', bottom: -5, left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: 8, height: 8,
                        background: 'rgba(8,12,28,0.92)',
                        borderRight: '1px solid rgba(216,224,240,0.25)',
                        borderBottom: '1px solid rgba(216,224,240,0.25)',
                      }} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left="618 · 唐" right="907" ticks={RIVER_TICKS} />
          </div>
        </div>
      </div>
    </div>
  );
}
`;

// pages/PoemsRiverPage.tsx
const poemsRiverPageCode = `
// ===== pages/PoemsRiverPage.tsx =====
const POEMS_RIVER_TICKS = (function () {
  const out = [];
  for (let y = 618; y <= 897; y += 30) {
    const isMajor = y % 30 === 0;
    out.push({ year: y, label: isMajor ? String(y) : undefined, pos: ((y - 618) / (907 - 618)) * 100 });
  }
  return out;
})();

function truncateStr(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function PoemsRiverPage() {
  const corpus = useCorpus();
  const poems = getPoemsCorpus(corpus);
  const poets = getPoets();
  const positioned = layoutAllPoems(poems, poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState(null);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ textAlign: 'center', padding: '8px 0 0', color: '#8b7355', fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 6 }}>
        {corpus === 'tang' ? '唐 诗 三 百 首' : '小 学 必 背'}
      </div>
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
          <RiverBackground dragging={vp.dragging} />
          {positioned.map(({ poem, x, y }, i) => {
            const size = contentLengthToSize(poem.content.length);
            const isFocal = poem.familiarity >= 5;
            const isVisited = visited.has(poem.id);
            const floatDuration = 4 + (i % 3);
            const floatDelay = -((i % 7) * 0.5);
            const highlightCore = isVisited ? '#d8e0f0' : '#fff';
            return (
              <Link
                key={poem.id}
                to={\`/poem/\${poem.id}\`}
                state={{ from: '/poems' }}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onClick={() => markVisited(poem.id)}
                style={{
                  position: 'absolute',
                  top: \`calc(50% + \${y}%)\`,
                  left: \`\${x}%\`,
                  transform: 'translate(-50%, -50%)',
                  textDecoration: 'none',
                }}
              >
                <div
                  onMouseEnter={() => setHoverId(poem.id)}
                  onMouseLeave={() => setHoverId((id) => (id === poem.id ? null : id))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: \`node-float \${floatDuration}s ease-in-out \${floatDelay}s infinite\`,
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      color: isFocal ? '#fff' : colors.textPrimary,
                      fontFamily: fontFamilies.chinese,
                      fontSize: isFocal ? fontSizes.nodeLarge : fontSizes.body,
                      textShadow: isFocal ? '0 0 12px rgba(216,224,240,0.8)' : 'none',
                      marginBottom: 6,
                      fontWeight: isFocal ? 600 : undefined,
                      letterSpacing: isFocal ? 2 : undefined,
                      maxWidth: 120,
                      lineHeight: 1.3,
                      textAlign: 'center',
                      whiteSpace: 'normal',
                    }}>{poem.title}</div>
                    {isFocal && (
                      <div style={{
                        position: 'absolute', top: '100%', left: '15%', right: '15%',
                        height: 1, marginTop: 2,
                        background: 'linear-gradient(90deg, transparent, rgba(216,224,240,0.7), transparent)',
                      }} />
                    )}
                  </div>
                  <div style={{
                    position: 'relative',
                    width: size, height: size, borderRadius: '50%',
                    background: \`radial-gradient(circle, \${highlightCore} 0%, #d8e0f0 60%, transparent 100%)\`,
                    border: '1px solid rgba(216,224,240,0.45)',
                    boxShadow: isFocal
                      ? \`0 0 \${size}px rgba(216,224,240,0.9), 0 0 4px #fff\`
                      : \`0 0 \${size}px rgba(216,224,240,0.6)\`,
                    animation: isFocal ? 'focal-pulse 3.2s ease-in-out infinite' : 'none',
                  }}>
                    <div style={{
                      position: 'absolute', inset: '25%',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, transparent 60%)',
                    }} />
                  </div>
                  {hoverId === poem.id && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%',
                      transform: 'translate(-50%, -12px)',
                      background: 'rgba(8,12,28,0.92)',
                      border: '1px solid rgba(216,224,240,0.25)',
                      borderRadius: 4, padding: 8,
                      whiteSpace: 'nowrap',
                      color: colors.textPrimary, fontSize: 12,
                      fontFamily: fontFamilies.chinese,
                      pointerEvents: 'none', zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}>
                      <div>{truncateStr(poem.content, 12)}</div>
                      <div style={{
                        position: 'absolute', bottom: -5, left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: 8, height: 8,
                        background: 'rgba(8,12,28,0.92)',
                        borderRight: '1px solid rgba(216,224,240,0.25)',
                        borderBottom: '1px solid rgba(216,224,240,0.25)',
                      }} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left="618 · 唐" right="907" ticks={POEMS_RIVER_TICKS} />
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
function buildPoetTicks(birth, death) {
  const out = [];
  const start = Math.ceil(birth / 10) * 10;
  const end = Math.floor(death / 10) * 10;
  const span = Math.max(1, death - birth);
  for (let y = start; y <= end; y += 10) {
    const isMajor = y % 30 === 0;
    out.push({ year: y, label: isMajor ? String(y) : undefined, pos: ((y - birth) / span) * 100 });
  }
  return out;
}

function truncateStrPoet(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function PoetPage() {
  const { poetId } = useParams();
  const poet = poetId ? getPoet(poetId) : undefined;
  const corpus = useCorpus();
  const [showAll, setShowAll] = useState(false);
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState(null);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const allPoems = getPoemsByPoet(poet.id);
  const filteredPoems = allPoems.filter(function(p) {
    if (corpus === 'tang') return p.corpus !== 'primary';
    return p.corpus !== 'tang';
  });
  const hasFilteredOut = filteredPoems.length < allPoems.length;
  const visiblePoems = showAll ? allPoems : filteredPoems;

  // 空态：当前诗库下该诗人无作品
  if (visiblePoems.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TopNav variant="poet" poet={poet} />
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: colors.textTertiary, fontFamily: fontFamilies.chinese,
          fontSize: 18, letterSpacing: 4, textAlign: 'center', padding: 24,
        }}>
          <div style={{ marginBottom: 16 }}>该诗人在{corpus === 'tang' ? '唐诗三百首' : '小学必背'}库中无作品</div>
          <button
            onClick={function() { setShowAll(true); }}
            style={{
              padding: '8px 22px', background: 'transparent',
              color: colors.textPrimary, border: '1px solid ' + colors.textPrimary,
              borderRadius: 3, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 4, cursor: 'pointer',
            }}
          >看全部</button>
        </div>
      </div>
    );
  }

  const positioned = layoutPoems(visiblePoems, poet, { leftPadding: 6, rightPadding: 6 });
  const ticks = buildPoetTicks(poet.birthYear, poet.deathYear);

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
        {hasFilteredOut && (
          <button
            onClick={function() { setShowAll(function(s) { return !s; }); }}
            style={{
              position: 'absolute', top: 12, right: 16, zIndex: 5,
              padding: '6px 14px', background: 'rgba(8,12,28,0.7)',
              color: colors.textPrimary, border: '1px solid rgba(216,224,240,0.3)',
              borderRadius: 3, fontFamily: fontFamilies.chinese,
              fontSize: 13, letterSpacing: 2, cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
          >{showAll ? '只看本库' : '看全部'}</button>
        )}
        <div style={{
          position: 'relative', width: '600%', height: '100%',
          ...vp.canvasStyle,
        }}>
          <RiverBackground dragging={vp.dragging} />
          {positioned.map(({ poem, x, y }, i) => {
            const size = contentLengthToSize(poem.content.length);
            const isFocal = poem.familiarity >= 5;
            const isVisited = visited.has(poem.id);
            const floatDuration = 4 + (i % 3);
            const floatDelay = -((i % 7) * 0.5);
            const highlightCore = isVisited ? '#d8e0f0' : '#fff';
            return (
              <Link
                key={poem.id}
                to={\`/poem/\${poem.id}\`}
                state={{ from: \`/poet/\${poet.id}\` }}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onClick={() => markVisited(poem.id)}
                style={{
                  position: 'absolute',
                  top: \`calc(50% + \${y}%)\`,
                  left: \`\${x}%\`,
                  transform: 'translate(-50%, -50%)',
                  textDecoration: 'none',
                }}
              >
                <div
                  onMouseEnter={() => setHoverId(poem.id)}
                  onMouseLeave={() => setHoverId((id) => (id === poem.id ? null : id))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: \`node-float \${floatDuration}s ease-in-out \${floatDelay}s infinite\`,
                    position: 'relative',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      color: isFocal ? '#fff' : colors.textPrimary,
                      fontFamily: fontFamilies.chinese,
                      fontSize: isFocal ? fontSizes.nodeLarge : fontSizes.body,
                      textShadow: isFocal ? '0 0 12px rgba(216,224,240,0.8)' : 'none',
                      marginBottom: 6,
                      fontWeight: isFocal ? 600 : undefined,
                      letterSpacing: isFocal ? 2 : undefined,
                      maxWidth: 120,
                      lineHeight: 1.3,
                      textAlign: 'center',
                      whiteSpace: 'normal',
                    }}>{poem.title}</div>
                    {isFocal && (
                      <div style={{
                        position: 'absolute', top: '100%', left: '15%', right: '15%',
                        height: 1, marginTop: 2,
                        background: 'linear-gradient(90deg, transparent, rgba(216,224,240,0.7), transparent)',
                      }} />
                    )}
                  </div>
                  <div style={{
                    position: 'relative',
                    width: size, height: size, borderRadius: '50%',
                    background: \`radial-gradient(circle, \${highlightCore} 0%, #d8e0f0 60%, transparent 100%)\`,
                    border: '1px solid rgba(216,224,240,0.45)',
                    boxShadow: isFocal
                      ? \`0 0 \${size}px rgba(216,224,240,0.9), 0 0 4px #fff\`
                      : \`0 0 \${size}px rgba(216,224,240,0.6)\`,
                    animation: isFocal ? 'focal-pulse 3.2s ease-in-out infinite' : 'none',
                  }}>
                    <div style={{
                      position: 'absolute', inset: '25%',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, transparent 60%)',
                    }} />
                  </div>
                  {hoverId === poem.id && (
                    <div style={{
                      position: 'absolute', bottom: '100%', left: '50%',
                      transform: 'translate(-50%, -12px)',
                      background: 'rgba(8,12,28,0.92)',
                      border: '1px solid rgba(216,224,240,0.25)',
                      borderRadius: 4, padding: 8,
                      whiteSpace: 'nowrap',
                      color: colors.textPrimary, fontSize: 12,
                      fontFamily: fontFamilies.chinese,
                      pointerEvents: 'none', zIndex: 10,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    }}>
                      <div>{truncateStrPoet(poem.content, 12)}</div>
                      <div style={{
                        position: 'absolute', bottom: -5, left: '50%',
                        transform: 'translateX(-50%) rotate(45deg)',
                        width: 8, height: 8,
                        background: 'rgba(8,12,28,0.92)',
                        borderRight: '1px solid rgba(216,224,240,0.25)',
                        borderBottom: '1px solid rgba(216,224,240,0.25)',
                      }} />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left={\`\${poet.birthYear} · 生\`} right={\`\${poet.deathYear} · 卒\`} ticks={ticks} />
          </div>
        </div>
      </div>
    </div>
  );
}
`;

// pages/PoemPage.tsx (local helpers navCardStyle/SectionTitle stay top-level in shared scope;
// no collision with other files since they're unique names)
const poemPageCode = `
// ===== pages/PoemPage.tsx =====
// 纸张面板配色 — 暖米黄底，纯黑字。仅用于诗文阅读区
var PAPER_BG = 'rgba(245, 235, 210, 0.85)';
var PAPER_TEXT = '#000000';        // 正文 / 标题 / 注释释义：纯黑
var PAPER_TEXT_SOFT = '#000000';   // 元信息：纯黑（与正文统一）
var PAPER_TEXT_DIM = '#8b7355';    // 段落标题：暖灰褐（保留层次）

var SIZE_MODE_KEY = 'shiwen-size-mode';

function readSizeMode() {
  try {
    var v = window.localStorage.getItem(SIZE_MODE_KEY);
    if (v === 'small' || v === 'medium' || v === 'large') return v;
  } catch (e) {}
  return 'medium';
}

function PoemPage() {
  const [sizeMode, setSizeMode] = useState(readSizeMode);
  const { poemId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const corpus = useCorpus();
  const setCorpus = useSetCorpus();
  const fromPath = location.state ? location.state.from : null;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  // inScope: poem is visible under the active corpus.
  var inScope = poem.corpus === 'both' || poem.corpus === corpus;
  var switchTarget = corpus === 'tang' ? 'primary' : 'tang';
  var switchLabel = switchTarget === 'tang' ? '唐诗三百首' : '小学必背';
  const neighbors = fromPath === '/poems' ? getGlobalPoemNeighbors(poem.id) : getNeighbors(poem.id);
  const prev = neighbors.prev;
  const next = neighbors.next;
  const isFromFeihua = typeof fromPath === 'string' &&
    (fromPath.indexOf('/play/stage/') === 0 || fromPath.indexOf('/play/sentence/') === 0);
  const backTo = fromPath != null ? fromPath : \`/poet/\${poet.id}\`;
  const backLabel = fromPath === '/poems'
    ? '返回诗文'
    : isFromFeihua
      ? '返回飞花令'
      : \`返回\${poet.name}\`;
  const linkState = { from: fromPath };

  useEffect(function () {
    try { window.localStorage.setItem(SIZE_MODE_KEY, sizeMode); } catch (e) {}
  }, [sizeMode]);

  useEffect(function () {
    function onKey(e) {
      var t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t && t.isContentEditable)) return;
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        navigate('/poem/' + prev.id, { state: linkState });
      } else if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        navigate('/poem/' + next.id, { state: linkState });
      } else if (e.key === 'Escape') {
        navigate(backTo);
      }
    }
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, [prev, next, navigate, fromPath, backTo]);

  const extracted = extractVariants(poem.content);
  const cleanText = extracted.cleanText;
  const variants = extracted.variants;
  const mode = getPoemMode(cleanText);
  const lines = splitIntoLines(cleanText, mode);
  const sizeOffset = sizeMode === 'small' ? 0 : sizeMode === 'large' ? 6 : 3;
  const poemFontSize = (mode === 'short' ? fontSizes.poemTextShort : fontSizes.poemTextLong) + sizeOffset;
  const metaFontSize = fontSizes.body + sizeOffset;
  const titleFontSize = fontSizes.poemTitle + sizeOffset;
  const sectionTitleFontSize = fontSizes.sectionTitle + sizeOffset;
  const buttonFontSize = 13 + sizeOffset;

  const hasAnnotations = poem.annotations.length > 0;
  const hasVariants = variants.length > 0;
  const hasBackground = Boolean(poem.background);
  const hasRightContent = hasAnnotations || hasVariants || hasBackground;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} backTo={backTo} backLabel={backLabel} />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient }}>
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

        {/* 不在当前诗库提示：仍展示诗文，但提示可切库 */}
        {!inScope && (
          <div style={{
            maxWidth: 1400, margin: '0 auto', padding: '12px 32px 0',
            textAlign: 'center', color: '#8b7355',
            fontFamily: fontFamilies.chinese, fontSize: 13, letterSpacing: 2,
          }}>
            这首诗不在当前诗库。
            <button
              onClick={function() { setCorpus(switchTarget); }}
              style={{
                marginLeft: 8, padding: '4px 14px',
                background: 'transparent', color: colors.textPrimary,
                border: '1px solid ' + colors.textPrimary, borderRadius: 3,
                fontFamily: fontFamilies.chinese, fontSize: 13, letterSpacing: 2,
                cursor: 'pointer',
              }}
            >切到{switchLabel}</button>
          </div>
        )}

        <div style={{ padding: isMobile ? '0 12px 24px' : '0 32px 28px' }}>
          <div style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{
              width: 10,
              background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
              boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
            }} />
            <div style={{
              position: 'relative',
              flex: 1,
              background: PAPER_BG,
              padding: isMobile ? '20px 16px' : '32px 40px',
            }}>
              <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />

              <div style={{ position: 'absolute', top: 14, left: 22, zIndex: 2 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" style={{
                  transform: 'rotate(-3deg)',
                  filter: 'drop-shadow(0.5px 0.5px 1.2px rgba(60,20,15,0.45))',
                }}>
                  <rect x="2" y="2" width="28" height="28" rx="1.5"
                    fill="#a8302a" stroke="#7a1f15" strokeWidth="0.6" />
                  <text x="16" y="23" textAnchor="middle"
                    fontFamily="'STKaiti', 'KaiTi', serif" fontSize="18"
                    fill="#f5ebd2" fontWeight="700">诗</text>
                </svg>
              </div>

              <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', gap: 4, zIndex: 2 }}>
                {['small', 'medium', 'large'].map(function(s) {
                  var label = s === 'small' ? '小' : s === 'medium' ? '中' : '大';
                  var active = sizeMode === s;
                  return (
                    <button
                      key={s}
                      onClick={function() { setSizeMode(s); }}
                      style={{
                        padding: '3px 10px',
                        background: active ? PAPER_TEXT : 'transparent',
                        color: active ? '#f5ebd2' : PAPER_TEXT_DIM,
                        border: '1px solid ' + PAPER_TEXT_DIM,
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: fontFamilies.chinese,
                        fontSize: buttonFontSize,
                        letterSpacing: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ textAlign: 'center', marginBottom: 28, paddingTop: 16 }}>
                <div style={{
                  fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                  fontSize: titleFontSize, letterSpacing: 12,
                  marginBottom: 8, fontWeight: 600,
                }}>{poem.title}</div>
                <div style={{
                  color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                  fontSize: metaFontSize, letterSpacing: 3,
                }}>{poet.name} · 唐</div>
                <div style={{
                  marginTop: 14,
                  height: 1,
                  background: 'linear-gradient(90deg, transparent, rgba(176,138,74,0.55), transparent)',
                }} />
              </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : (hasRightContent ? '60fr 40fr' : '1fr'),
              gap: isMobile ? 24 : 48,
            }}>
              <div style={{
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: poemFontSize,
                lineHeight: mode === 'short' ? 2.4 : 2.0,
                letterSpacing: mode === 'short' ? 4 : 2,
                textAlign: 'center',
              }}>
                {lines.map(function(line, i) { return <div key={i}>{line}</div>; })}
              </div>

              {hasRightContent && (
                <div style={{ textAlign: 'left' }}>
                  {hasAnnotations && (
                    <section>
                      <SectionTitle fontSize={sectionTitleFontSize} bold>注 释</SectionTitle>
                      <div style={{
                        color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                        fontSize: metaFontSize, lineHeight: 1.9,
                      }}>
                        {poem.annotations.map(function(a, i) {
                          return (
                            <div key={i} style={{ marginBottom: 12, textIndent: '2em' }}>
                              <span style={{ color: PAPER_TEXT }}>{a.term}：</span>
                              {a.explanation}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {hasAnnotations && hasVariants && (
                    <div style={{ height: 24 }} />
                  )}

                  {hasVariants && (
                    <section>
                      <SectionTitle fontSize={sectionTitleFontSize}>异 文</SectionTitle>
                      <div style={{
                        color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                        fontSize: metaFontSize, lineHeight: 1.9,
                      }}>
                        {variants.map(function(v, i) {
                          return (
                            <div key={i} style={{ marginBottom: 12, textIndent: '2em' }}>
                              <span style={{ color: PAPER_TEXT }}>{v.original}：</span>
                              {v.kind}「{v.variant}」
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {(hasAnnotations || hasVariants) && hasBackground && (
                    <div style={{ height: 24 }} />
                  )}

                  {hasBackground && (
                    <section>
                      <SectionTitle fontSize={sectionTitleFontSize} bold>创 作 背 景</SectionTitle>
                      <div style={{
                        color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                        fontSize: metaFontSize, lineHeight: 2, textIndent: '2em',
                      }}>{poem.background}</div>
                    </section>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{
            width: 10,
            background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
            boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
          }} />
          </div>
        </div>

        {isFromFeihua && (
          <div style={{ padding: '20px 32px 0', maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
            <button
              onClick={function() { navigate(fromPath); }}
              style={{
                padding: '8px 22px',
                background: 'transparent',
                color: colors.textPrimary,
                border: '1px solid ' + colors.textPrimary,
                borderRadius: 3,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                letterSpacing: 4,
                cursor: 'pointer',
              }}
            >← 返 回 飞 花 令</button>
          </div>
        )}

        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {prev ? (
            <Link to={\`/poem/\${prev.id}\`} state={linkState} style={navCardStyle}>
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
            <Link to={\`/poem/\${next.id}\`} state={linkState} style={{ ...navCardStyle, textAlign: 'right' }}>
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

function SectionTitle({ children, fontSize, bold }) {
  return (
    <div style={{
      color: PAPER_TEXT, fontFamily: fontFamilies.chinese,
      fontSize: fontSize, letterSpacing: 4, marginBottom: 14,
      fontWeight: bold ? 700 : undefined,
      textAlign: 'center',
    }}>{children}</div>
  );
}
`;

// play/types.ts
const feihuaTypesCode = `
// ===== play/types.ts =====
var STAGE_GOAL = 5;
var STAGE_BLOOD = 3;
var STAGE_TIMEBOX = 120;
var INITIAL_PROGRESS = { unlockedIndex: 0, cleared: [], current: null };
`;

// play/keywords.ts
const feihuaKeywordsCode = `
// ===== play/keywords.ts =====
var KEYWORD_GROUPS = {
  entry: ['春','月','花','风','山','水','云','天','人','心'],
  mid: ['夜','秋','年','日','雪','酒','梦','愁','思','江',
        '河','雨','柳','草','木','落','竹','松','飞','楼'],
  advanced: ['寒','桃','燕','鸟','马','衣','书','剑','琴','笛',
             '钟','灯','影','台','城','海','舟','桥','鹤','霜'],
};
var KEYWORDS = [].concat(KEYWORD_GROUPS.entry, KEYWORD_GROUPS.mid, KEYWORD_GROUPS.advanced);
`;

// play/primaryKeywords.ts
const feihuaPrimaryKeywordsCode = `
// ===== play/primaryKeywords.ts =====
var PRIMARY_KEYWORD_GROUPS = {
  entry: ['春','月','花','风','山','水','人','天'],
  mid: ['雪','江','日','雨','寒','明','酒','落','清','城','舟','头'],
};
var PRIMARY_KEYWORDS = [].concat(PRIMARY_KEYWORD_GROUPS.entry, PRIMARY_KEYWORD_GROUPS.mid);
`;

// play/engine.ts
const feihuaEngineCode = `
// ===== play/engine.ts =====
// 语料分桶缓存（PoemCorpus -> index）
var _keywordCache = new Map();
var _fullScanCache = new Map();

function buildKeywordIndex(corpus) {
  corpus = corpus || 'tang';
  var poems = corpus === 'both' ? getPoems() : getPoems(corpus);
  var index = new Map();
  for (var ki = 0; ki < KEYWORDS.length; ki++) index.set(KEYWORDS[ki], []);

  for (var pi = 0; pi < poems.length; pi++) {
    var poem = poems[pi];
    var poet = getPoet(poem.poetId);
    if (!poet) continue;
    var cleanText = extractVariants(poem.content).cleanText;
    var mode = getPoemMode(cleanText);
    var lines = splitIntoLines(cleanText, mode);

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var stripped = line.replace(/[，。？！；：、,\\.\\?!;:]/g, '');
      for (var kj = 0; kj < KEYWORDS.length; kj++) {
        var k = KEYWORDS[kj];
        if (stripped.indexOf(k) >= 0) {
          index.get(k).push({
            poemId: poem.id,
            line: line.trim(),
            poemTitle: poem.title,
            poetName: poet.name,
            corpus: poem.corpus,
          });
        }
      }
    }
  }

  return index;
}

function buildKeywordIndexFullScan(corpus) {
  corpus = corpus || 'tang';
  var poems = corpus === 'both' ? getPoems() : getPoems(corpus);
  var index = new Map();
  for (var pi = 0; pi < poems.length; pi++) {
    var poem = poems[pi];
    var poet = getPoet(poem.poetId);
    if (!poet) continue;
    var cleanText = extractVariants(poem.content).cleanText;
    var mode = getPoemMode(cleanText);
    var lines = splitIntoLines(cleanText, mode);

    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      var stripped = line.replace(/[，。？！；：、,\\.\\?!;:]/g, '');
      var seen = new Set();
      for (var ci = 0; ci < stripped.length; ci++) {
        var ch = stripped[ci];
        if (seen.has(ch)) continue;
        seen.add(ch);
        if (!index.has(ch)) index.set(ch, []);
        index.get(ch).push({
          poemId: poem.id,
          line: line.trim(),
          poemTitle: poem.title,
          poetName: poet.name,
          corpus: poem.corpus,
        });
      }
    }
  }
  return index;
}

function getKeywordIndex(corpus) {
  corpus = corpus || 'tang';
  if (!_keywordCache.has(corpus)) _keywordCache.set(corpus, buildKeywordIndex(corpus));
  return _keywordCache.get(corpus);
}

function getKeywordIndexFullScan(corpus) {
  corpus = corpus || 'tang';
  if (!_fullScanCache.has(corpus)) _fullScanCache.set(corpus, buildKeywordIndexFullScan(corpus));
  return _fullScanCache.get(corpus);
}

function getVersesFor(keyword, corpus) {
  corpus = corpus || 'tang';
  if (KEYWORDS.indexOf(keyword) >= 0) {
    return getKeywordIndex(corpus).get(keyword) || [];
  }
  return getKeywordIndexFullScan(corpus).get(keyword) || [];
}

var DISTRACTOR_POOL_SOURCE =
  '一二三四五六七八九十百千万里外古今南北东西上下左右中青山河颜色红绿黄白青紫玉石金铁风雨霜露天地秋冬夏时光影梦魂';

var DISTRACTOR_POOL = Array.from(new Set(DISTRACTOR_POOL_SOURCE.split(''))).join('');

var PUNCT_RE = /[，。？！；：、,\\.\\?!;:]/;

function pickStageQuestion(keyword, used, corpus) {
  corpus = corpus || 'tang';
  const pool = getVersesFor(keyword, corpus).filter(v => !used.has(v.line));
  if (pool.length === 0) return null;
  const verse = pool[Math.floor(Math.random() * pool.length)];

  const kwPositions = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (verse.line[i] === keyword) kwPositions.push(i);
  }
  const blanks = new Set([kwPositions[0]]);

  const candidates = [];
  for (let i = 0; i < verse.line.length; i++) {
    if (kwPositions.includes(i)) continue;
    if (PUNCT_RE.test(verse.line[i])) continue;
    candidates.push(i);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }
  const extra = candidates.length === 0 ? 0 : Math.random() < 0.5 ? 1 : 2;
  for (let i = 0; i < extra && i < candidates.length; i++) {
    blanks.add(candidates[i]);
  }

  return { verse, blanks: Array.from(blanks).sort((a, b) => a - b) };
}

function buildNineGrid(answer, blanks) {
  const answerChars = blanks.map(i => answer[i]);
  const distractors = [];
  let attempts = 0;
  const maxAttempts = DISTRACTOR_POOL.length * 20;
  while (
    distractors.length < 12 - blanks.length &&
    attempts < maxAttempts
  ) {
    const c = DISTRACTOR_POOL[Math.floor(Math.random() * DISTRACTOR_POOL.length)];
    if (!answer.includes(c) && !distractors.includes(c)) {
      distractors.push(c);
    }
    attempts++;
  }
  if (distractors.length !== 12 - blanks.length) {
    throw new Error('九宫格去重失败');
  }

  const all = answerChars.concat(distractors);
  for (let j = all.length - 1; j > 0; j--) {
    const k = Math.floor(Math.random() * (j + 1));
    const tmp = all[j];
    all[j] = all[k];
    all[k] = tmp;
  }
  return { chars: all, blankCount: blanks.length };
}

function validateStageInput(filled, answer, blanks) {
  if (filled.length !== blanks.length) return false;
  for (let i = 0; i < blanks.length; i++) {
    if (answer[blanks[i]] !== filled[i]) return false;
  }
  return true;
}
`;

// play/progress.ts
const feihuaProgressCode = `
// ===== play/progress.ts =====
var FEIHUA_STORAGE_KEY = 'shiwen-feihua-progress';

function _progressKey(corpus) {
  corpus = corpus || 'tang';
  return corpus === 'tang' ? FEIHUA_STORAGE_KEY : FEIHUA_STORAGE_KEY + ':' + corpus;
}

function loadProgress(corpus) {
  corpus = corpus || 'tang';
  try {
    const raw = window.localStorage.getItem(_progressKey(corpus));
    if (!raw) return { ...INITIAL_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared)
        ? parsed.cleared.filter(s => typeof s === 'string')
        : [],
      current:
        parsed.current && typeof parsed.current === 'object'
          ? {
              keyword: String(parsed.current.keyword != null ? parsed.current.keyword : ''),
              correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
              blood:
                typeof parsed.current.blood === 'number'
                  ? parsed.current.blood
                  : STAGE_BLOOD,
            }
          : null,
    };
  } catch (e) {
    return { ...INITIAL_PROGRESS };
  }
}

function saveProgress(p, corpus) {
  corpus = corpus || 'tang';
  try {
    window.localStorage.setItem(_progressKey(corpus), JSON.stringify(p));
  } catch (e) {
    // localStorage 不可用或配额满 — 静默失败
  }
}

function markCleared(keyword, corpus) {
  corpus = corpus || 'tang';
  const p = loadProgress(corpus);
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  const idx = KEYWORDS.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null;
  saveProgress(p, corpus);
  return p;
}

function beginStage(keyword, corpus) {
  corpus = corpus || 'tang';
  const p = loadProgress(corpus);
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p, corpus);
  return p;
}

function commitStageCorrect(keyword, line, corpus) {
  corpus = corpus || 'tang';
  const p = loadProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p, corpus);
  return p;
}

function commitStageBlood(keyword, blood, corpus) {
  corpus = corpus || 'tang';
  const p = loadProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p, corpus);
  return p;
}

function clearCurrent(corpus) {
  corpus = corpus || 'tang';
  const p = loadProgress(corpus);
  p.current = null;
  saveProgress(p, corpus);
  return p;
}
`;

// play/couplets.ts
const feihuaCoupletsCode = `
// ===== play/couplets.ts =====
var FEIHUA_PUNCT_RE = /[，。？！；：、,\.\?!;:]/g;
function _stripPunct(s) { return s.replace(FEIHUA_PUNCT_RE, ''); }

var _allPairsCacheByCorpus = new Map();
var _shortPoolCacheByCorpus = new Map();
var _longPoolCacheByCorpus = new Map();

function buildAllCouplets(corpus) {
  corpus = corpus || 'tang';
  var poems = corpus === 'both' ? getPoems() : getPoems(corpus);
  var out = [];
  for (var pi = 0; pi < poems.length; pi++) {
    var poem = poems[pi];
    var poet = getPoet(poem.poetId);
    if (!poet) continue;
    var cleanText = extractVariants(poem.content).cleanText;
    var mode = getPoemMode(cleanText);
    var lines = splitIntoLines(cleanText, mode);

    for (var i = 0; i + 1 < lines.length; i += 2) {
      var upperLine = lines[i].trim();
      var lowerLine = lines[i + 1].trim();
      if (!upperLine || !lowerLine) continue;
      if (_stripPunct(upperLine).length !== _stripPunct(lowerLine).length) continue;
      var upper = { poemId: poem.id, line: upperLine, poemTitle: poem.title, poetName: poet.name, corpus: poem.corpus };
      var lower = { poemId: poem.id, line: lowerLine, poemTitle: poem.title, poetName: poet.name, corpus: poem.corpus };
      out.push({ upper: upper, lower: lower });
    }
  }
  return out;
}

function getAllCouplets(corpus) {
  corpus = corpus || 'tang';
  if (!_allPairsCacheByCorpus.has(corpus)) {
    _allPairsCacheByCorpus.set(corpus, buildAllCouplets(corpus));
  }
  return _allPairsCacheByCorpus.get(corpus);
}

function _getShortPool(corpus) {
  corpus = corpus || 'tang';
  if (!_shortPoolCacheByCorpus.has(corpus)) {
    var all = getAllCouplets(corpus);
    _shortPoolCacheByCorpus.set(corpus, all.filter(function(p) { return _stripPunct(p.lower.line).length === 5; }));
  }
  return _shortPoolCacheByCorpus.get(corpus);
}

function _getLongPool(corpus) {
  corpus = corpus || 'tang';
  if (!_longPoolCacheByCorpus.has(corpus)) {
    var all = getAllCouplets(corpus);
    _longPoolCacheByCorpus.set(corpus, all.filter(function(p) { return _stripPunct(p.lower.line).length === 7; }));
  }
  return _longPoolCacheByCorpus.get(corpus);
}

function _getPoolForTier(tier, corpus) {
  corpus = corpus || 'tang';
  if (tier === 'entry') return _getShortPool(corpus);
  if (tier === 'mid') return _getLongPool(corpus);
  return getAllCouplets(corpus);
}

function tierOfLevel(level) {
  if (level <= 10) return 'entry';
  if (level <= 30) return 'mid';
  return 'advanced';
}

function _shuffleArr(arr) {
  var a = [].concat(arr);
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function pickLevelQuestion(tier, usedUpperLines, corpus) {
  corpus = corpus || 'tang';
  var pool = _getPoolForTier(tier, corpus).filter(function(p) { return !usedUpperLines.has(p.upper.line); });
  if (pool.length === 0) return null;

  var correct = pool[Math.floor(Math.random() * pool.length)];
  var correctLen = _stripPunct(correct.lower.line).length;

  var allPairs = getAllCouplets(corpus);
  var distractors = [];
  var seenLines = new Set([correct.lower.line]);

  var attempts = 0;
  while (distractors.length < 3 && attempts < 200) {
    var candidate = allPairs[Math.floor(Math.random() * allPairs.length)];
    if (
      candidate.lower.poemId !== correct.lower.poemId &&
      !seenLines.has(candidate.lower.line) &&
      _stripPunct(candidate.lower.line).length === correctLen
    ) {
      distractors.push(candidate.lower);
      seenLines.add(candidate.lower.line);
    }
    attempts++;
  }

  if (distractors.length < 3) {
    for (var i = 0; i < pool.length && distractors.length < 3; i++) {
      var p = pool[i];
      if (p.upper.line === correct.upper.line) continue;
      if (seenLines.has(p.lower.line)) continue;
      if (_stripPunct(p.lower.line).length !== correctLen) continue;
      distractors.push(p.lower);
      seenLines.add(p.lower.line);
    }
  }

  if (distractors.length < 3) return null;

  var options = _shuffleArr([correct.lower].concat(distractors));
  return { upper: correct.upper, answer: correct.lower, options: options };
}
`;

// play/sentenceProgress.ts
const feihuaSentenceProgressCode = `
// ===== play/sentenceProgress.ts =====
var SENTENCE_STORAGE_KEY = 'shiwen-feihua-sentence-progress';

function _sentenceKey(corpus) {
  corpus = corpus || 'tang';
  return corpus === 'tang' ? SENTENCE_STORAGE_KEY : SENTENCE_STORAGE_KEY + ':' + corpus;
}

function loadSentenceProgress(corpus) {
  corpus = corpus || 'tang';
  try {
    var raw = window.localStorage.getItem(_sentenceKey(corpus));
    if (!raw) return { unlockedIndex: 0, cleared: [], current: null };
    var parsed = JSON.parse(raw);
    return {
      unlockedIndex: typeof parsed.unlockedIndex === 'number' ? parsed.unlockedIndex : 0,
      cleared: Array.isArray(parsed.cleared)
        ? parsed.cleared.filter(function(s) { return typeof s === 'string'; })
        : [],
      current:
        parsed.current && typeof parsed.current === 'object'
          ? {
              keyword: String(parsed.current.keyword || ''),
              correct: Array.isArray(parsed.current.correct) ? parsed.current.correct : [],
              blood: typeof parsed.current.blood === 'number' ? parsed.current.blood : STAGE_BLOOD,
            }
          : null,
    };
  } catch (e) {
    return { unlockedIndex: 0, cleared: [], current: null };
  }
}

function saveSentenceProgress(p, corpus) {
  corpus = corpus || 'tang';
  try { window.localStorage.setItem(_sentenceKey(corpus), JSON.stringify(p)); } catch (e) {}
}

function markSentenceCleared(keyword, corpus) {
  corpus = corpus || 'tang';
  var p = loadSentenceProgress(corpus);
  if (p.cleared.indexOf(keyword) >= 0) {
    p.current = null;
    saveSentenceProgress(p, corpus);
    return p;
  }
  p.cleared.push(keyword);
  var levelNum = parseInt(keyword, 10);
  if (!Number.isNaN(levelNum) && levelNum > p.unlockedIndex) p.unlockedIndex = levelNum;
  p.current = null;
  saveSentenceProgress(p, corpus);
  return p;
}

function beginSentenceStage(keyword, corpus) {
  corpus = corpus || 'tang';
  var p = loadSentenceProgress(corpus);
  p.current = { keyword: keyword, correct: [], blood: STAGE_BLOOD };
  saveSentenceProgress(p, corpus);
  return p;
}

function commitSentenceCorrect(keyword, line, corpus) {
  corpus = corpus || 'tang';
  var p = loadSentenceProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  if (p.current.correct.indexOf(line) < 0) p.current.correct.push(line);
  saveSentenceProgress(p, corpus);
  return p;
}

function commitSentenceBlood(keyword, blood, corpus) {
  corpus = corpus || 'tang';
  var p = loadSentenceProgress(corpus);
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveSentenceProgress(p, corpus);
  return p;
}

function clearSentenceCurrent(corpus) {
  corpus = corpus || 'tang';
  var p = loadSentenceProgress(corpus);
  p.current = null;
  saveSentenceProgress(p, corpus);
  return p;
}
`;

const keywordSealCode = `
// ===== components/KeywordSeal.tsx =====
var SEAL_COLORS = {
  cleared: { bg: '#a8302a', border: '#7a1f15', text: '#f5ebd2', shadow: '0 2px 8px rgba(168,48,42,0.4)' },
  current: { bg: '#a8302a', border: '#d4af6a', text: '#f5ebd2', shadow: '0 0 16px rgba(212,175,106,0.7)' },
  locked: { bg: 'rgba(216,224,240,0.08)', border: 'rgba(216,224,240,0.2)', text: 'rgba(216,224,240,0.3)', shadow: 'none' },
};

function KeywordSeal(props) {
  var keyword = props.keyword;
  var state = props.state;
  var onClick = props.onClick;
  var compact = props.compact;
  var c = SEAL_COLORS[state];
  var interactive = state !== 'locked';
  var size = compact ? 52 : 64;
  var sealFontSize = compact ? 26 : 32;
  return React.createElement('div', {
    style: {
      transform: state === 'current' ? 'rotate(-3deg)' : 'rotate(0)',
      transition: 'transform 0.15s',
    },
  },
    React.createElement('button', {
      onClick: interactive ? onClick : undefined,
      disabled: !interactive,
      style: {
        width: size,
        height: size,
        background: c.bg,
        border: '2px solid ' + c.border,
        borderRadius: 4,
        color: c.text,
        fontFamily: fontFamilies.chinese,
        fontSize: sealFontSize,
        fontWeight: 700,
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: c.shadow,
        animation: state === 'current' ? 'focal-pulse 2s ease-in-out infinite' : undefined,
      },
    }, state === 'locked' ? '？' : keyword)
  );
}
`;

// components/PaperScroll.tsx
const paperScrollCode = `
// ===== components/PaperScroll.tsx =====
var PAPER_SCROLL_BG = 'rgba(245, 235, 210, 0.85)';

function PaperScroll(props) {
  var children = props.children;
  var enter = props.enter === undefined ? true : props.enter;
  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
      animation: enter ? 'scroll-enter 0.6s ease-out' : undefined,
      transformOrigin: 'top center',
    }}>
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
      }} />
      <div style={{
        position: 'relative',
        flex: 1,
        background: PAPER_SCROLL_BG,
        padding: '32px 40px',
      }}>
        <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />
        {children}
      </div>
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
`;

// components/NineGrid.tsx
const nineGridCode = `
// ===== components/NineGrid.tsx =====
var NINE_SLOT_BG = { correct: '#4a7c4a', wrong: '#a8302a' };
function NineGrid(props) {
  const chars = props.chars;
  const blankCount = props.blankCount;
  const filled = props.filled;
  const charStatus = props.charStatus;
  const onChar = props.onChar;
  const onUndo = props.onUndo;
  var filledCount = filled.filter(function(c) { return c != null; }).length;
  var full = filledCount >= blankCount;
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {Array.from({ length: blankCount }).map(function(_, i) {
          var status = (charStatus && charStatus[i]) || null;
          var bg = status ? NINE_SLOT_BG[status] : (filled[i] ? '#f5ebd2' : 'transparent');
          var color = status ? '#f5ebd2' : '#000';
          return (
            <div key={i} style={{
              width: 48, height: 48,
              border: '2px solid #8b7355', borderRadius: 4,
              background: bg, color: color,
              fontFamily: fontFamilies.chinese,
              fontSize: 28, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}>{filled[i] != null ? filled[i] : ''}</div>
          );
        })}
        <button
          onClick={onUndo}
          disabled={filledCount === 0}
          style={{
            marginLeft: 12, padding: '0 16px',
            background: 'transparent', color: '#8b7355',
            border: '1px solid #8b7355', borderRadius: 3,
            fontFamily: fontFamilies.chinese, fontSize: 14,
            cursor: filledCount === 0 ? 'default' : 'pointer',
            opacity: filledCount === 0 ? 0.4 : 1,
            height: 40,
          }}>退字</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {chars.map(function(c, idx) {
          const disabled = full;
          return (
            <button
              key={idx}
              onClick={() => onChar(c, idx)}
              disabled={disabled}
              style={{
                height: 56,
                background: 'transparent',
                border: '1px solid #8b7355', borderRadius: 3,
                color: '#000', fontFamily: fontFamilies.chinese,
                fontSize: 26, fontWeight: 700,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.15s',
              }}>{c}</button>
          );
        })}
      </div>
    </div>
  );
}
`;

// pages/PlayHall.tsx
const playHallCode = `
// ===== pages/PlayHall.tsx =====
var GROUP_LABEL = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

var LEVEL_GROUPS = [
  { tier: 'entry', range: [1, 10] },
  { tier: 'mid', range: [11, 30] },
  { tier: 'advanced', range: [31, 50] },
];

var PLAY_HALL_CN_DIGITS = ['零','一','二','三','四','五','六','七','八','九','十'];

function playHallToChineseNum(n) {
  if (n <= 10) return PLAY_HALL_CN_DIGITS[n];
  if (n < 20) return '十' + PLAY_HALL_CN_DIGITS[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + PLAY_HALL_CN_DIGITS[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + PLAY_HALL_CN_DIGITS[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + PLAY_HALL_CN_DIGITS[n - 40];
  return String(n);
}

function PlayHallModeTab(props) {
  var label = props.label;
  var active = props.active;
  var onClick = props.onClick;
  var compact = props.compact;
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: compact ? '10px 6px' : '12px 8px',
        marginBottom: -1,
        fontFamily: fontFamilies.chinese,
        fontSize: compact ? 14 : 18,
        letterSpacing: compact ? 2 : 4,
        color: active ? colors.textPrimary : colors.textTertiary,
        borderBottom: active ? '2px solid #d4af6a' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >{label}</button>
  );
}

function CharModeBody(props) {
  var progress = props.progress;
  var compact = props.compact;
  var stateOf = function(kw, idx) {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };
  return (
    <React.Fragment>
      {['entry', 'mid', 'advanced'].map(function(group) {
        return (
          <div key={group} style={{ marginBottom: compact ? 24 : 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[group]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact
                ? 'repeat(auto-fill, minmax(52px, 1fr))'
                : 'repeat(10, 64px)',
              gap: compact ? 8 : 12, justifyContent: 'center',
              maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
            }}>
              {KEYWORD_GROUPS[group].map(function(kw) {
                var globalIdx = KEYWORDS.indexOf(kw);
                var state = stateOf(kw, globalIdx);
                return (
                  <Link key={kw} to={state === 'locked' ? '#' : '/play/stage/' + kw}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={kw} state={state} compact={compact} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </React.Fragment>
  );
}

function SentenceModeBody(props) {
  var progress = props.progress;
  var compact = props.compact;
  var stateOf = function(level) {
    var key = String(level);
    if (progress.cleared.includes(key)) return 'cleared';
    if (level - 1 === progress.unlockedIndex) return 'current';
    return 'locked';
  };
  return (
    <React.Fragment>
      {LEVEL_GROUPS.map(function(group) {
        var tier = group.tier;
        var range = group.range;
        var levels = [];
        for (var i = range[0]; i <= range[1]; i++) levels.push(i);
        return (
          <div key={tier} style={{ marginBottom: compact ? 24 : 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[tier]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact
                ? 'repeat(auto-fill, minmax(52px, 1fr))'
                : 'repeat(10, 64px)',
              gap: compact ? 8 : 12, justifyContent: 'center',
              maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
            }}>
              {levels.map(function(lv) {
                var state = stateOf(lv);
                return (
                  <Link key={lv} to={state === 'locked' ? '#' : '/play/sentence/' + lv}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={playHallToChineseNum(lv)} state={state} compact={compact} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </React.Fragment>
  );
}

function PlayHall() {
  const [mode, setMode] = useState('char');
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const corpus = useCorpus();

  var charProgress = loadProgress();
  var sentenceProgress = loadSentenceProgress();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '20px 14px 48px' : '32px 28px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: isMobile ? 24 : 32, letterSpacing: isMobile ? 6 : 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>
              飞 花 令
            </div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: isMobile ? 13 : 16, letterSpacing: isMobile ? 2 : 4,
            }}>
              {mode === 'char'
                ? '单 字 · 拾 字 模 式 · 已通 ' + charProgress.cleared.length + ' / 50 关'
                : '整 句 · 联 句 模 式 · 已通 ' + sentenceProgress.cleared.length + ' / 50 关'}
            </div>
            <div style={{
              marginTop: 6, color: '#8b7355', fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>
              当前诗库：{corpus === 'tang' ? '唐诗三百首' : '小学必背'}
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: isMobile ? 12 : 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: isMobile ? 20 : 32,
          }}>
            <PlayHallModeTab label="单字 · 拾字" active={mode === 'char'} onClick={function() { setMode('char'); }} compact={isMobile} />
            <PlayHallModeTab label="整句 · 联句" active={mode === 'sentence'} onClick={function() { setMode('sentence'); }} compact={isMobile} />
          </div>

          {mode === 'char'
            ? <CharModeBody progress={charProgress} compact={isMobile} />
            : <SentenceModeBody progress={sentenceProgress} compact={isMobile} />}
        </div>
      </div>
    </div>
  );
}
`;

// pages/SentencePlay.tsx
const sentencePlayCode = `
// ===== pages/SentencePlay.tsx =====
var SENTENCE_TOTAL_LEVELS = 50;
var SENTENCE_TURN_SECONDS = 30;
var SENTENCE_PAPER_TEXT = '#000000';
var SENTENCE_PAPER_TEXT_DIM = '#8b7355';
var SENTENCE_PAPER_GREEN = '#4a7c4a';
var SENTENCE_PAPER_RED = '#a8302a';

var SENTENCE_TIER_LABEL = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

var sentenceBtnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: SENTENCE_PAPER_TEXT,
  border: '1px solid ' + SENTENCE_PAPER_TEXT,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

function sentenceToChineseNum(n) {
  var digits = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return digits[n];
  if (n < 20) return '十' + digits[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + digits[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + digits[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + digits[n - 40];
  return String(n);
}

function SentencePlay() {
  var params = useParams();
  var levelParam = params.level;
  var navigate = useNavigate();
  var level = parseInt(levelParam || '', 10);
  var validLevel = Number.isFinite(level) && level >= 1 && level <= SENTENCE_TOTAL_LEVELS;
  var tier = validLevel ? tierOfLevel(level) : 'entry';
  var levelKey = String(level);

  var corpus = useCorpus();

  const [stage, setStage] = useState(function() {
    if (!validLevel) return null;
    var progress = loadSentenceProgress(corpus);
    if (progress.current && progress.current.keyword === levelKey) return progress.current;
    return beginSentenceStage(levelKey, corpus).current;
  });

  // 从原文页返回时取出"已查看"的上句，加进排除集，避免回到题面后又看到同一题
  const [viewedUpperLine] = useState(function() {
    if (!validLevel) return null;
    var v = sessionStorage.getItem('feihuaSentenceViewed:' + levelKey);
    if (v) { sessionStorage.removeItem('feihuaSentenceViewed:' + levelKey); return v; }
    return null;
  });

  const usedUpperRef = useRef(new Set(
    [].concat(stage ? (stage.correct || []) : [], viewedUpperLine ? [viewedUpperLine] : [])
  ));

  const [question, setQuestion] = useState(function() {
    if (!validLevel) return null;
    return pickLevelQuestion(tier, usedUpperRef.current, corpus);
  });

  const [picked, setPicked] = useState(null);
  const [grading, setGrading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SENTENCE_TURN_SECONDS);
  const [result, setResult] = useState(null);

  const stageRef = useRef(stage); stageRef.current = stage;
  const questionRef = useRef(question); questionRef.current = question;

  useEffect(function() {
    if (!validLevel) return;
    if (stageRef.current && stageRef.current.keyword === levelKey) return;
    var progress = loadSentenceProgress(corpus);
    var fresh = progress.current && progress.current.keyword === levelKey
      ? progress.current
      : beginSentenceStage(levelKey, corpus).current;
    setStage(fresh);
    usedUpperRef.current = new Set(fresh ? (fresh.correct || []) : []);
    setQuestion(pickLevelQuestion(tier, usedUpperRef.current, corpus));
    setPicked(null);
    setGrading(false);
    setSecondsLeft(SENTENCE_TURN_SECONDS);
    setResult(null);
  }, [levelKey]);

  useEffect(function() {
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); navigate('/play'); }
    }
    window.addEventListener('keydown', onKey);
    return function() { window.removeEventListener('keydown', onKey); };
  }, [navigate]);

  function handleCorrect() {
    if (!validLevel || !questionRef.current || !stageRef.current) return;
    var cur = stageRef.current;
    var line = questionRef.current.answer.line;
    var newCorrect = [].concat(cur.correct, [line]);

    commitSentenceCorrect(levelKey, line, corpus);
    setStage(loadSentenceProgress(corpus).current);
    usedUpperRef.current = new Set(newCorrect);

    if (newCorrect.length >= STAGE_GOAL) {
      markSentenceCleared(levelKey, corpus);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(function() {
      setQuestion(pickLevelQuestion(tier, usedUpperRef.current, corpus));
      setPicked(null);
      setSecondsLeft(SENTENCE_TURN_SECONDS);
      setGrading(false);
    }, 800);
  }

  function handleWrong() {
    if (!validLevel || !stageRef.current) return;
    var cur = stageRef.current;
    var newBlood = cur.blood - 1;

    commitSentenceBlood(levelKey, newBlood, corpus);
    setStage(loadSentenceProgress(corpus).current);

    if (newBlood <= 0) {
      clearSentenceCurrent(corpus);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(function() {
      setQuestion(pickLevelQuestion(tier, usedUpperRef.current, corpus));
      setPicked(null);
      setSecondsLeft(SENTENCE_TURN_SECONDS);
      setGrading(false);
    }, 1500);
  }

  // 查看原文：扣 1 血后跳转原文页；返回时把上句加进排除集换新题。
  // blood <= 1 时禁用 —— 不允许玩家为了看原文而自杀。
  function handleViewOriginal() {
    if (!validLevel || !questionRef.current || !stageRef.current) return;
    if (grading || result) return;
    if (stageRef.current.blood <= 1) return;

    var cur = stageRef.current;
    var newBlood = cur.blood - 1;
    var upperLine = questionRef.current.upper.line;
    var poemId = questionRef.current.upper.poemId;

    commitSentenceBlood(levelKey, newBlood, corpus);
    sessionStorage.setItem('feihuaSentenceViewed:' + levelKey, upperLine);
    setStage(loadSentenceProgress(corpus).current);
    navigate('/poem/' + poemId, { state: { from: '/play/sentence/' + level } });
  }

  useEffect(function() {
    if (result || grading) return;
    if (secondsLeft <= 0) { handleWrong(); return; }
    var t = setTimeout(function() { setSecondsLeft(function(s) { return s - 1; }); }, 1000);
    return function() { clearTimeout(t); };
  }, [secondsLeft, result, grading]);

  function onPick(idx) {
    if (grading || picked !== null || !question) return;
    setPicked(idx);
    setGrading(true);
    var correct = question.options[idx].line === question.answer.line;
    setTimeout(function() {
      if (correct) handleCorrect();
      else handleWrong();
    }, 500);
  }

  if (!validLevel || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关卡序号无效</div>;
  }

  var isLastLevel = level >= SENTENCE_TOTAL_LEVELS;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← 返回大厅</Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: SENTENCE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
                {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
              </div>
              {question && (
                <button
                  onClick={handleViewOriginal}
                  disabled={grading || result !== null || stage.blood <= 1}
                  style={{
                    padding: '6px 0',
                    background: 'transparent',
                    border: 'none',
                    color: SENTENCE_PAPER_RED,
                    fontFamily: fontFamilies.chinese,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 3,
                    cursor: grading || result !== null || stage.blood <= 1 ? 'default' : 'pointer',
                    opacity: grading || result !== null || stage.blood <= 1 ? 0.4 : 1,
                  }}
                >查看原文 · 扣 1 血</button>
              )}
            </div>
            <div style={{ color: SENTENCE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: SENTENCE_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
            <button
              onClick={function() { navigate('/play'); }}
              style={{
                color: SENTENCE_PAPER_TEXT,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 4,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >退 出</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: SENTENCE_PAPER_TEXT,
              fontSize: 24, letterSpacing: 8, marginBottom: 8,
            }}>第 {sentenceToChineseNum(level)} 关</div>
            <div style={{
              color: SENTENCE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>{SENTENCE_TIER_LABEL[tier]} · 整 句 联 句</div>
          </div>

          {question ? (
            <React.Fragment>
              <div style={{
                textAlign: 'center', padding: '24px 0 12px',
                fontFamily: fontFamilies.chinese, color: SENTENCE_PAPER_TEXT,
                fontSize: isMobile ? 22 : 28, letterSpacing: isMobile ? 3 : 6, lineHeight: 1.5,
              }}>{question.upper.line}　？</div>
              <div style={{
                textAlign: 'center',
                color: SENTENCE_PAPER_TEXT_DIM,
                fontFamily: fontFamilies.chinese,
                fontSize: 13,
                letterSpacing: 2,
                marginBottom: 16,
              }}>出自《{question.upper.poemTitle}》· {question.upper.poetName}</div>

              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12, maxWidth: 560, margin: '0 auto',
              }}>
                {question.options.map(function(opt, idx) {
                  var isPicked = picked === idx;
                  var isAnswer = opt.line === question.answer.line;
                  var bg = '#f5ebd2';
                  var border = '1px solid ' + SENTENCE_PAPER_TEXT_DIM;
                  var color = SENTENCE_PAPER_TEXT;
                  if (grading && isAnswer) {
                    bg = SENTENCE_PAPER_GREEN; border = '2px solid ' + SENTENCE_PAPER_GREEN; color = '#f5ebd2';
                  } else if (grading && isPicked && !isAnswer) {
                    bg = SENTENCE_PAPER_RED; border = '2px solid ' + SENTENCE_PAPER_RED; color = '#f5ebd2';
                  }
                  return (
                    <button
                      key={idx}
                      onClick={function() { onPick(idx); }}
                      disabled={grading}
                      style={{
                        padding: '16px 12px',
                        background: bg,
                        border: border,
                        borderRadius: 4,
                        color: color,
                        fontFamily: fontFamilies.chinese,
                        fontSize: 18, letterSpacing: 3,
                        cursor: grading ? 'default' : 'pointer',
                        opacity: grading && !isPicked && !isAnswer ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >{opt.line}</button>
                  );
                })}
              </div>
            </React.Fragment>
          ) : (
            <div style={{
              textAlign: 'center', padding: 40,
              fontFamily: fontFamilies.chinese, color: SENTENCE_PAPER_TEXT_DIM, fontSize: 16,
            }}>题库已空</div>
          )}

          {result && (
            <React.Fragment>
              <style>{\`
                @keyframes feihuaOverlayIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes feihuaStampDrop {
                  0%   { opacity: 0; transform: scale(0.4) rotate(-14deg); filter: blur(3px); }
                  55%  { opacity: 1; transform: scale(1.2) rotate(5deg); filter: blur(0); }
                  75%  { transform: scale(0.95) rotate(-2deg); }
                  100% { transform: scale(1) rotate(0); }
                }
                @keyframes feihuaFadeUp {
                  from { opacity: 0; transform: translateY(10px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              \`}</style>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(245,235,210,0.97)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: 40,
                animation: 'feihuaOverlayIn 260ms ease-out both',
              }}>
                <div style={{
                  fontFamily: fontFamilies.chinese,
                  color: result.kind === 'cleared' ? FEIHUA_PAPER_RED : FEIHUA_PAPER_TEXT,
                  fontSize: 64, letterSpacing: 16, marginBottom: 24,
                  textShadow: result.kind === 'cleared'
                    ? '0 0 32px rgba(168,48,42,0.35), 0 4px 12px rgba(0,0,0,0.08)'
                    : 'none',
                  animation: result.kind === 'cleared'
                    ? 'feihuaStampDrop 650ms cubic-bezier(.34,1.56,.64,1) both'
                    : 'feihuaFadeUp 500ms ease-out both',
                }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
                <div style={{
                  color: SENTENCE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                  fontSize: 16, marginBottom: 32,
                  animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                }}>
                  {result.kind === 'cleared'
                    ? '第 ' + sentenceToChineseNum(level) + ' 关 · 已联出 ' + result.correct.length + ' 句'
                    : '血尽于此，下次再来'}
                </div>
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={function() {
                      if (result.kind === 'failed') clearSentenceCurrent(corpus);
                      navigate('/play');
                    }}
                    style={sentenceBtnStyle}
                  >返回大厅</button>
                  {result.kind === 'cleared' && !isLastLevel && (
                    <button
                      onClick={function() { navigate('/play/sentence/' + (level + 1)); }}
                      style={sentenceBtnStyle}
                    >下一关</button>
                  )}
                  {result.kind === 'cleared' && isLastLevel && (
                    <div style={{
                      color: SENTENCE_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                      fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                    }}>全 部 通 关</div>
                  )}
                </div>
              </div>
            </React.Fragment>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
`;

// pages/StagePlay.tsx
const stagePlayCode = `
// ===== pages/StagePlay.tsx =====
var FEIHUA_PAPER_TEXT = '#000000';
var FEIHUA_PAPER_TEXT_DIM = '#8b7355';
var FEIHUA_PAPER_RED = '#a8302a';

var feihuaBtnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: FEIHUA_PAPER_TEXT,
  border: '1px solid ' + FEIHUA_PAPER_TEXT,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

function StagePlay() {
  const params = useParams();
  const kw = params.kw;
  const navigate = useNavigate();
  const corpus = useCorpus();

  const [stage, setStage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress(corpus);
    if (progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw, corpus).current;
  });

  // 从原文页返回时取出"已查看"的题面句，加进排除集，避免回到题面后又看到同一题
  const [viewedLine] = useState(() => {
    if (!kw) return null;
    const v = sessionStorage.getItem('feihuaStageViewed:' + kw);
    if (v) { sessionStorage.removeItem('feihuaStageViewed:' + kw); return v; }
    return null;
  });

  const used = useMemo(() => {
    const s = new Set(stage != null ? (stage.correct || []) : []);
    if (viewedLine) s.add(viewedLine);
    return s;
  }, [stage, viewedLine]);

  const [question, setQuestion] = useState(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used, corpus);
  });

  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  const [filled, setFilled] = useState([]);
  const [charStatus, setCharStatus] = useState([]);

  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [grading, setGrading] = useState(false);

  const [result, setResult] = useState(null);

  useEffect(() => {
    if (question) {
      setNineGrid(buildNineGrid(question.verse.line, question.blanks));
      setFilled(Array(question.blanks.length).fill(null));
      setCharStatus(Array(question.blanks.length).fill(null));
    }
  }, [question]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  useEffect(function() {
    if (!kw) return;
    if (stageRef.current && stageRef.current.keyword === kw) return;
    var progress = loadProgress(corpus);
    var fresh = progress.current && progress.current.keyword === kw
      ? progress.current
      : beginStage(kw, corpus).current;
    setStage(fresh);
    setQuestion(pickStageQuestion(kw, new Set(fresh ? (fresh.correct || []) : []), corpus));
    setResult(null);
    setGrading(false);
    setSecondsLeft(STAGE_TIMEBOX);
  }, [kw]);

  const handleCorrect = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    var cur = stageRef.current;
    const line = questionRef.current.verse.line;
    const newCorrect = [].concat(cur.correct, [line]);

    commitStageCorrect(kw, line, corpus);
    setStage(loadProgress(corpus).current);

    if (newCorrect.length >= STAGE_GOAL) {
      markCleared(kw, corpus);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      const nextUsed = new Set(newCorrect);
      setQuestion(pickStageQuestion(kw, nextUsed, corpus));
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  };

  const handleWrong = () => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood, corpus);
    setStage(loadProgress(corpus).current);

    if (newBlood <= 0) {
      clearCurrent(corpus);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setFilled(Array(questionRef.current && questionRef.current.blanks ? questionRef.current.blanks.length : 0).fill(null));
      setCharStatus([]);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
  };

  // 部分对：扣 1 血，1500ms 后保留 correct 位置、清掉 wrong 位置
  const handlePartialWrong = (status) => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood, corpus);
    setStage(loadProgress(corpus).current);

    if (newBlood <= 0) {
      clearCurrent(corpus);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setTimeout(() => {
      setFilled(function(prev) {
        return prev.map(function(c, i) { return status[i] === 'correct' ? c : null; });
      });
      setCharStatus([]);
      setGrading(false);
    }, 1500);
  };

  // 查看原文：扣 1 血后跳转原文页；返回时把题面句加进排除集换新题。
  // blood <= 1 时禁用 —— 不允许玩家为了看原文而自杀。
  const handleViewOriginal = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    if (grading || result) return;
    if (stageRef.current.blood <= 1) return;

    const cur = stageRef.current;
    const newBlood = cur.blood - 1;
    const line = questionRef.current.verse.line;
    const poemId = questionRef.current.verse.poemId;

    commitStageBlood(kw, newBlood, corpus);
    sessionStorage.setItem('feihuaStageViewed:' + kw, line);
    setStage(loadProgress(corpus).current);
    navigate('/poem/' + poemId, { state: { from: '/play/stage/' + kw } });
  };

  useEffect(() => {
    if (result) return;
    if (secondsLeft <= 0) {
      handleWrong();
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result]);

  const isFull = filled.length > 0 && filled.every(function(c) { return c != null; });

  const handleSubmit = () => {
    if (grading || !question || !isFull) return;
    const status = question.blanks.map(function(pos, i) {
      return question.verse.line[pos] === filled[i] ? 'correct' : 'wrong';
    });
    setCharStatus(status);
    setGrading(true);
    if (status.every(function(s) { return s === 'correct'; })) {
      handleCorrect();
    } else {
      handlePartialWrong(status);
    }
  };

  const handleChar = (c) => {
    if (grading) return;
    var emptyIdx = -1;
    for (var i = 0; i < filled.length; i++) {
      if (filled[i] == null) { emptyIdx = i; break; }
    }
    if (emptyIdx === -1) return;
    setFilled(function(prev) {
      var next = [].concat(prev);
      next[emptyIdx] = c;
      return next;
    });
  };
  const handleUndo = () => {
    if (grading) return;
    var lastIdx = -1;
    for (var i = filled.length - 1; i >= 0; i--) {
      if (filled[i] != null) { lastIdx = i; break; }
    }
    if (lastIdx === -1) return;
    setFilled(function(prev) {
      var next = [].concat(prev);
      next[lastIdx] = null;
      return next;
    });
  };

  if (!kw || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  const displayLine = question
    ? Array.from(question.verse.line)
        .map((ch, i) => (question.blanks.includes(i) ? '□' : ch))
        .join('')
    : '';

  const kwIndex = KEYWORDS.indexOf(kw);
  const isLastKeyword = kwIndex < 0 || kwIndex + 1 >= KEYWORDS.length;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/play"
            style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}
          >
            ← 返回大厅
          </Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
                {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
              </div>
              {question && (
                <button
                  onClick={handleViewOriginal}
                  disabled={grading || result !== null || stage.blood <= 1}
                  style={{
                    padding: '6px 0',
                    background: 'transparent',
                    border: 'none',
                    color: FEIHUA_PAPER_RED,
                    fontFamily: fontFamilies.chinese,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 3,
                    cursor: grading || result !== null || stage.blood <= 1 ? 'default' : 'pointer',
                    opacity: grading || result !== null || stage.blood <= 1 ? 0.4 : 1,
                  }}
                >查看原文 · 扣 1 血</button>
              )}
            </div>
            <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
            <button
              onClick={function() { navigate('/play'); }}
              style={{
                color: FEIHUA_PAPER_TEXT,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 4,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >退 出</button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese,
              color: FEIHUA_PAPER_TEXT,
              fontSize: isMobile ? 80 : 120,
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: 8,
            }}>{kw}</div>
            <div style={{
              color: FEIHUA_PAPER_TEXT_DIM,
              fontFamily: fontFamilies.chinese,
              fontSize: 14,
              letterSpacing: 6,
            }}>飞 花 · 关 键 字</div>
          </div>

          <div style={{
            textAlign: 'center',
            padding: '24px 0',
            fontFamily: fontFamilies.chinese,
            color: FEIHUA_PAPER_TEXT,
            fontSize: isMobile ? 24 : 32,
            letterSpacing: isMobile ? 3 : 6,
            lineHeight: 2,
          }}>
            {displayLine || '（题库已空）'}
          </div>
          {question && (
            <div style={{
              textAlign: 'center',
              color: FEIHUA_PAPER_TEXT_DIM,
              fontFamily: fontFamilies.chinese,
              fontSize: 14,
              letterSpacing: 2,
              marginBottom: 16,
            }}>
              出自《{question.verse.poemTitle}》· {question.verse.poetName}
            </div>
          )}

          <div style={{ marginTop: 40 }}>
            {nineGrid && (
              <NineGrid
                chars={nineGrid.chars}
                blankCount={nineGrid.blankCount}
                filled={filled}
                charStatus={charStatus}
                onChar={handleChar}
                onUndo={handleUndo}
              />
            )}
          </div>

          {nineGrid && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                onClick={handleSubmit}
                disabled={!isFull || grading}
                style={Object.assign({}, feihuaBtnStyle, {
                  padding: '10px 36px',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 6,
                  opacity: (!isFull || grading) ? 0.4 : 1,
                  cursor: (!isFull || grading) ? 'default' : 'pointer',
                })}
              >提 交</button>
            </div>
          )}

          {result && (
            <React.Fragment>
              <style>{\`
                @keyframes feihuaOverlayIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes feihuaStampDrop {
                  0%   { opacity: 0; transform: scale(0.4) rotate(-14deg); filter: blur(3px); }
                  55%  { opacity: 1; transform: scale(1.2) rotate(5deg); filter: blur(0); }
                  75%  { transform: scale(0.95) rotate(-2deg); }
                  100% { transform: scale(1) rotate(0); }
                }
                @keyframes feihuaFadeUp {
                  from { opacity: 0; transform: translateY(10px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              \`}</style>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(245,235,210,0.97)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: 40,
                animation: 'feihuaOverlayIn 260ms ease-out both',
              }}>
                <div style={{
                  fontFamily: fontFamilies.chinese,
                  color: result.kind === 'cleared' ? FEIHUA_PAPER_RED : FEIHUA_PAPER_TEXT,
                  fontSize: 64, letterSpacing: 16, marginBottom: 24,
                  textShadow: result.kind === 'cleared'
                    ? '0 0 32px rgba(168,48,42,0.35), 0 4px 12px rgba(0,0,0,0.08)'
                    : 'none',
                  animation: result.kind === 'cleared'
                    ? 'feihuaStampDrop 650ms cubic-bezier(.34,1.56,.64,1) both'
                    : 'feihuaFadeUp 500ms ease-out both',
                }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
                <div style={{
                  color: FEIHUA_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                  fontSize: 16, marginBottom: 32,
                  animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                }}>
                  {result.kind === 'cleared'
                    ? '已答出 ' + result.correct.length + ' 句含「' + kw + '」的诗'
                    : '血尽于此，下次再来'}
                </div>
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={() => {
                      if (result.kind === 'failed') clearCurrent(corpus);
                      navigate('/play');
                    }}
                    style={feihuaBtnStyle}
                  >
                    返回大厅
                  </button>
                  {result.kind === 'cleared' && !isLastKeyword && (
                    <button
                      onClick={() => navigate('/play/stage/' + KEYWORDS[kwIndex + 1])}
                      style={feihuaBtnStyle}
                    >
                      下一关
                    </button>
                  )}
                  {result.kind === 'cleared' && isLastKeyword && (
                    <div style={{
                      color: FEIHUA_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                      fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                    }}>
                      全 部 通 关
                    </div>
                  )}
                </div>
              </div>
            </React.Fragment>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
`;

// UpdateToast.tsx (no-op in standalone — service worker only runs in hosted builds)
const updateToastCode = `
// ===== UpdateToast.tsx (standalone: no service worker, no-op) =====
function UpdateToast() { return null; }
`;

// App.tsx (BrowserRouter -> HashRouter)
const appCode = `
// ===== App.tsx =====
function App() {
  return (
    <CorpusProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RiverPage />} />
          <Route path="/poems" element={<PoemsRiverPage />} />
          <Route path="/poet/:poetId" element={<PoetPage />} />
          <Route path="/poem/:poemId" element={<PoemPage />} />
          <Route path="/play" element={<PlayHall />} />
          <Route path="/play/stage/:kw" element={<StagePlay />} />
          <Route path="/play/sentence/:level" element={<SentencePlay />} />
        </Routes>
        <UpdateToast />
      </HashRouter>
    </CorpusProvider>
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
${corpusCode}
${loadCode}
${searchCode}
${layoutCode}
${poemTextCode}
${riverBgCode}
${useVisitedCode}
${viewportHookCode}
${useBreakpointCode}
${timeAxisCode}
${searchBoxCode}
${corpusSwitcherCode}
${topNavCode}
${riverPageCode}
${poemsRiverPageCode}
${poetPageCode}
${poemPageCode}
${feihuaTypesCode}
${feihuaKeywordsCode}
${feihuaPrimaryKeywordsCode}
${feihuaEngineCode}
${feihuaProgressCode}
${feihuaCoupletsCode}
${feihuaSentenceProgressCode}
${keywordSealCode}
${paperScrollCode}
${nineGridCode}
${playHallCode}
${stagePlayCode}
${sentencePlayCode}
${updateToastCode}
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
