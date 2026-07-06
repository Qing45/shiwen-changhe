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

// data/load.ts (logic preserved, JSON imports -> window globals)
const loadCode = `
// ===== data/load.ts =====
const poets = window.__POETS__;
const poems = window.__POEMS__;

function getPoets() {
  return poets;
}

function getPoems() {
  return poems;
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

function getPoemCount(poetId) {
  return poems.filter((p) => p.poetId === poetId).length;
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
const RouterContext = React.createContext({ path: '/', params: {} });
let _navState = null;

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

function useLocation() {
  const ctx = React.useContext(RouterContext);
  return { pathname: ctx.path, state: _navState };
}

function useNavigate() {
  return (to, opts) => {
    _navState = opts ? opts.state : null;
    window.location.hash = to;
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

// 给 mini-router 扩展 search params 访问，供 PlayHall tab 持久化
var useSearchParams = function() {
  var parseCurrent = function() {
    var hash = window.location.hash || '#/';
    var queryStr = '';
    var qIdx = hash.indexOf('?');
    if (qIdx >= 0) queryStr = hash.slice(qIdx + 1);
    var sp = new URLSearchParams(queryStr);
    var get = function(k) { return sp.get(k); };
    var has = function(k) { return sp.has(k); };
    var entries = function() { return sp.entries(); };
    var setParam = function(next) {
      var base = hash.split('?')[0];
      var qs = next.toString();
      var newHash = qs ? base + '?' + qs : base;
      window.location.hash = newHash;
    };
    return { get: get, has: has, entries: entries, toString: function() { return sp.toString(); }, setParam: setParam };
  };
  var sp = parseCurrent();
  var setSearchParams = function(next, options) {
    var replace = options && options.replace;
    var url = (next instanceof URLSearchParams) ? next : new URLSearchParams(next);
    var base = (window.location.hash || '#/').split('?')[0];
    var qs = url.toString();
    var newHash = qs ? base + '?' + qs : base;
    if (replace) window.location.replace(window.location.pathname + window.location.search + newHash);
    else window.location.hash = newHash;
  };
  return [sp, setSearchParams];
};
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
      transformOrigin: '0 0',
      transition: dragging ? 'none' : 'transform 0.05s linear',
      willChange: 'transform',
    },
  };
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
          <RiverToggle />
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
          <BackLink
            to={props.backTo != null ? props.backTo : \`/poet/\${props.poet.id}\`}
            label={props.backLabel != null ? props.backLabel : \`返回\${props.poet.name}\`}
          />
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

function RiverToggle() {
  const loc = useLocation();
  const btn = (to, label, count) => {
    const on = loc.pathname === to;
    const showCount = count > 0;
    const text = on && showCount ? label + '·' + count : label;
    return (
      <Link to={to} style={{
        color: on ? '#fff' : colors.textTertiary,
        fontFamily: fontFamilies.chinese,
        fontSize: 16,
        letterSpacing: 3,
        padding: '6px 14px',
        textDecoration: 'none',
        borderBottom: on ? '2px solid #fff' : '2px solid transparent',
        textShadow: on ? '0 0 10px rgba(216,224,240,0.6)' : 'none',
        boxShadow: on ? '0 2px 8px -2px rgba(212,175,106,0.55)' : 'none',
      }}>{text}</Link>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 4 }}>
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
  return <Link to={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← {label}</Link>;
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
            const size = poemCountToSize(getPoemCount(poet.id));
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
                      fontSize: isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault,
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
  const poems = getPoems();
  const poets = getPoets();
  const positioned = layoutAllPoems(poems, poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState(null);

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
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState(null);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const poems = getPoemsByPoet(poet.id);
  const positioned = layoutPoems(poems, poet, { leftPadding: 6, rightPadding: 6 });
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
  const fromPath = location.state ? location.state.from : null;
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const neighbors = fromPath === '/poems' ? getGlobalPoemNeighbors(poem.id) : getNeighbors(poem.id);
  const prev = neighbors.prev;
  const next = neighbors.next;
  const backTo = fromPath != null ? fromPath : \`/poet/\${poet.id}\`;
  const backLabel = fromPath === '/poems' ? '返回诗文' : \`返回\${poet.name}\`;
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

        <div style={{ padding: '0 32px 28px' }}>
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
              padding: '32px 40px',
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
              gridTemplateColumns: hasRightContent ? '60fr 40fr' : '1fr',
              gap: 48,
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
var DIFFICULTY_META = {
  qingdeng: { label: '青灯', missRate: 0.30, thinkMs: 3000 },
  mohe:     { label: '墨客', missRate: 0.10, thinkMs: 1500 },
  shisheng: { label: '诗圣', missRate: 0.00, thinkMs: 800  },
};
var INITIAL_RECORD = {
  qingdeng: { win: 0, lose: 0 },
  mohe:     { win: 0, lose: 0 },
  shisheng: { win: 0, lose: 0 },
};
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
var FREE_KEYWORDS = ['春','月','花','风','雪'];
`;

// play/engine.ts
const feihuaEngineCode = `
// ===== play/engine.ts =====
function buildKeywordIndex() {
  const index = new Map();
  for (const k of KEYWORDS) index.set(k, []);

  for (const poem of getPoems()) {
    const poet = getPoet(poem.poetId);
    if (!poet) continue;
    const { cleanText } = extractVariants(poem.content);
    const mode = getPoemMode(cleanText);
    const lines = splitIntoLines(cleanText, mode);

    for (const line of lines) {
      const stripped = line.replace(/[，。？！；：、,\\.\\?!;:]/g, '');
      for (const k of KEYWORDS) {
        if (stripped.includes(k)) {
          index.get(k).push({
            poemId: poem.id,
            line: line.trim(),
            poemTitle: poem.title,
            poetName: poet.name,
          });
        }
      }
    }
  }

  return index;
}

var _cache = null;

function getKeywordIndex() {
  if (_cache === null) _cache = buildKeywordIndex();
  return _cache;
}

function getVersesFor(keyword) {
  return getKeywordIndex().get(keyword) || [];
}

var DISTRACTOR_POOL_SOURCE =
  '一二三四五六七八九十百千万里外古今南北东西上下左右中青山河颜色红绿黄白青紫玉石金铁风雨霜露天地秋冬夏时光影梦魂';

var DISTRACTOR_POOL = Array.from(new Set(DISTRACTOR_POOL_SOURCE.split(''))).join('');

var PUNCT_RE = /[，。？！；：、,\\.\\?!;:]/;

function pickStageQuestion(keyword, used) {
  const pool = getVersesFor(keyword).filter(v => !used.has(v.line));
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

function loadProgress() {
  try {
    const raw = window.localStorage.getItem(FEIHUA_STORAGE_KEY);
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

function saveProgress(p) {
  try {
    window.localStorage.setItem(FEIHUA_STORAGE_KEY, JSON.stringify(p));
  } catch (e) {
    // localStorage 不可用或配额满 — 静默失败
  }
}

function markCleared(keyword) {
  const p = loadProgress();
  if (p.cleared.includes(keyword)) {
    p.current = null;
    saveProgress(p);
    return p;
  }
  p.cleared.push(keyword);
  const idx = KEYWORDS.indexOf(keyword);
  if (idx >= 0 && idx + 1 > p.unlockedIndex) p.unlockedIndex = idx + 1;
  p.current = null;
  saveProgress(p);
  return p;
}

function beginStage(keyword) {
  const p = loadProgress();
  p.current = { keyword, correct: [], blood: STAGE_BLOOD };
  saveProgress(p);
  return p;
}

function commitStageCorrect(keyword, line) {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  if (!p.current.correct.includes(line)) p.current.correct.push(line);
  saveProgress(p);
  return p;
}

function commitStageBlood(keyword, blood) {
  const p = loadProgress();
  if (!p.current || p.current.keyword !== keyword) return p;
  p.current.blood = blood;
  saveProgress(p);
  return p;
}

function clearCurrent() {
  const p = loadProgress();
  p.current = null;
  saveProgress(p);
  return p;
}
`;

// play/ai.ts
const feihuaAiCode = `
// ===== play/ai.ts =====
var buildChoiceBoard = function(used, keyword, count) {
  if (count === undefined) count = 4;
  var pool = getVersesFor(keyword).filter(function(v) { return !used.has(v.line); });
  var n = Math.min(count, pool.length);
  if (n <= 0) return [];
  var arr = pool.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr.slice(0, n);
};

var aiPickAnswer = function(keyword, used, difficulty) {
  var pool = getVersesFor(keyword).filter(function(v) { return !used.has(v.line); });
  if (pool.length === 0) return { picked: false };
  var missRate = DIFFICULTY_META[difficulty].missRate;
  if (Math.random() < missRate) return { picked: false };
  var verse = pool[Math.floor(Math.random() * pool.length)];
  return { picked: true, verse: verse };
};

var rollFirstTurn = function() {
  return Math.random() < 0.5 ? 'player' : 'ai';
};
`;

// play/record.ts
const feihuaRecordCode = `
// ===== play/record.ts =====
var STORAGE_KEY_RECORD = 'shiwen-feihua-record';

var emptyBucket = function() { return { win: 0, lose: 0 }; };

var normalizeRecord = function(parsed) {
  var base = { qingdeng: emptyBucket(), mohe: emptyBucket(), shisheng: emptyBucket() };
  if (parsed && typeof parsed === 'object') {
    ['qingdeng','mohe','shisheng'].forEach(function(key){
      var slot = parsed[key];
      if (slot && typeof slot === 'object') {
        var w = typeof slot.win === 'number' ? slot.win : 0;
        var l = typeof slot.lose === 'number' ? slot.lose : 0;
        base[key] = { win: w, lose: l };
      }
    });
  }
  return base;
};

var loadRecord = function() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY_RECORD);
    if (!raw) return normalizeRecord(null);
    var parsed = JSON.parse(raw);
    return normalizeRecord(parsed);
  } catch(e) {
    return normalizeRecord(null);
  }
};

var saveRecord = function(r) {
  try {
    window.localStorage.setItem(STORAGE_KEY_RECORD, JSON.stringify(r));
  } catch(e) {}
};

var bumpRecord = function(difficulty, field) {
  var r = loadRecord();
  var slot = r[difficulty];
  var next = {
    qingdeng: { win: r.qingdeng.win, lose: r.qingdeng.lose },
    mohe:     { win: r.mohe.win,     lose: r.mohe.lose },
    shisheng: { win: r.shisheng.win, lose: r.shisheng.lose },
  };
  next[difficulty] = { win: slot.win, lose: slot.lose };
  next[difficulty][field] = slot[field] + 1;
  saveRecord(next);
  return next;
};

var recordWin = function(difficulty) { return bumpRecord(difficulty, 'win'); };
var recordLoss = function(difficulty) { return bumpRecord(difficulty, 'lose'); };
`;

// components/AiSilhouette.tsx
const aiSilhouetteCode = `
// ===== components/AiSilhouette.tsx =====
function AiSilhouette(props) {
  var difficulty = props.difficulty;
  var W = 80, H = 120;
  if (difficulty === 'qingdeng') {
    return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
      React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
        React.createElement('circle', { cx: W/2, cy: 18, r: 10 }),
        React.createElement('path', { d: 'M ' + (W/2 - 18) + ' ' + (H - 8) + ' L ' + (W/2 - 18) + ' 36 Q ' + W/2 + ' 28 ' + (W/2 + 18) + ' 36 L ' + (W/2 + 18) + ' ' + (H - 8) + ' Z' }),
        React.createElement('line', { x1: W/2 - 16, y1: 50, x2: W/2 - 26, y2: 70, stroke: '#1a1a2e', strokeWidth: 2, opacity: 0.85 }),
        React.createElement('circle', { cx: W/2 - 28, cy: 74, r: 6, opacity: 0.85 }),
        React.createElement('circle', { cx: W/2 - 28, cy: 74, r: 3, fill: '#d4af6a' })
      )
    );
  }
  if (difficulty === 'mohe') {
    return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
      React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
        React.createElement('circle', { cx: 42, cy: 20, r: 10 }),
        React.createElement('path', { d: 'M 26 ' + (H - 8) + ' L 26 36 Q 42 28 58 36 L 58 ' + (H - 8) + ' Z' }),
        React.createElement('rect', { x: 48, y: 56, width: 26, height: 16, rx: 1 })
      )
    );
  }
  return React.createElement('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, 'aria-hidden': true },
    React.createElement('g', { fill: '#1a1a2e', opacity: 0.85 },
      React.createElement('circle', { cx: W/2, cy: 18, r: 10 }),
      React.createElement('path', { d: 'M ' + (W/2 - 16) + ' ' + (H - 8) + ' L ' + (W/2 - 16) + ' 36 Q ' + W/2 + ' 28 ' + (W/2 + 16) + ' 36 L ' + (W/2 + 16) + ' ' + (H - 8) + ' Z' }),
      React.createElement('line', { x1: W/2 + 14, y1: 42, x2: W/2 + 22, y2: 28, stroke: '#1a1a2e', strokeWidth: 2, opacity: 0.85 }),
      React.createElement('circle', { cx: W/2 + 23, cy: 26, r: 4, fill: '#d4af6a' })
    )
  );
}
`;

// components/ChoiceBoard.tsx
const choiceBoardCode = `
// ===== components/ChoiceBoard.tsx =====
var LABELS_CHOICE = ['A','B','C','D'];

function ChoiceBoard(props) {
  var verses = props.verses;
  var secondsLeft = props.secondsLeft;
  var onSelect = props.onSelect;
  var disabled = props.disabled === true;
  return React.createElement('div', { style: { position: 'relative' } },
    React.createElement('div', {
      style: {
        position: 'absolute', top: -8, right: 0,
        color: secondsLeft <= 10 ? '#a8302a' : '#000',
        fontFamily: fontFamilies.chinese, fontSize: 18, fontWeight: 700,
      },
    }, '⏱ ' + secondsLeft + 's'),
    React.createElement('div', {
      style: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16,
      },
    },
      LABELS_CHOICE.map(function(label, i) {
        var v = verses[i];
        if (!v) {
          return React.createElement('div', {
            key: label,
            style: {
              padding: 16,
              border: '1px dashed rgba(139,115,85,0.3)',
              borderRadius: 4, minHeight: 64,
            },
          });
        }
        return React.createElement('button', {
          key: label,
          onClick: function() { onSelect(v); },
          disabled: disabled,
          style: {
            padding: 16,
            background: disabled ? 'rgba(0,0,0,0.04)' : 'transparent',
            border: '1px solid #8b7355', borderRadius: 4, color: '#000',
            fontFamily: fontFamilies.chinese, fontSize: 16, textAlign: 'left',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.6 : 1,
            transition: 'background 0.15s',
          },
        },
          React.createElement('span', { style: { marginRight: 8, fontWeight: 700 } }, label + '.'),
          v.line,
          React.createElement('div', { style: { fontSize: 12, color: '#8b7355', marginTop: 4 } },
            '《' + v.poemTitle + '》· ' + v.poetName
          )
        );
      })
    )
  );
}
`;

// components/CombatResultModal.tsx
const combatResultModalCode = `
// ===== components/CombatResultModal.tsx =====
function formatTimeCombat(sec) {
  var m = Math.floor(sec / 60);
  var s = sec % 60;
  return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
}

function poemLinkCombat(v, label) {
  return React.createElement(Link, {
    key: v.poemId + '-' + v.line,
    to: '/poem/' + v.poemId,
    style: {
      display: 'block', padding: '4px 0', color: '#000',
      textDecoration: 'none', fontFamily: fontFamilies.chinese, fontSize: 14,
    },
  },
    React.createElement('span', { style: { color: '#8b7355', marginRight: 8 } }, label),
    v.line,
    React.createElement('span', { style: { color: '#8b7355', fontSize: 12, marginLeft: 8 } },
      '《' + v.poemTitle + '》· ' + v.poetName
    )
  );
}

var btnStyleCombat = {
  padding: '8px 20px',
  background: 'transparent', color: '#000',
  border: '1px solid #000', borderRadius: 3,
  fontFamily: fontFamilies.chinese, fontSize: 14, cursor: 'pointer',
};

function CombatResultModal(props) {
  var r = props.result;
  return React.createElement('div', {
    style: { animation: 'result-fade-scale 0.4s ease-out', padding: 24 },
  },
    React.createElement('div', {
      style: {
        textAlign: 'center', fontFamily: fontFamilies.chinese,
        fontSize: 48, letterSpacing: 12, marginBottom: 8, color: '#000',
      },
    }, r.winner === 'player' ? '你 胜' : 'AI 胜'),
    React.createElement('div', {
      style: {
        textAlign: 'center', color: '#8b7355',
        fontFamily: fontFamilies.chinese, fontSize: 14, marginBottom: 24,
      },
    }, '用时 ' + formatTimeCombat(r.elapsedSec) + ' · 关键字「' + r.keyword + '」'),

    React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 },
    },
      React.createElement('div', null,
        React.createElement('div', {
          style: {
            fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
            borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
          },
        }, '你的诗囊（' + r.playerPicks.length + '）'),
        r.playerPicks.length === 0
          ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（未答出）')
          : r.playerPicks.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
      ),
      React.createElement('div', null,
        React.createElement('div', {
          style: {
            fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
            borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
          },
        }, 'AI 诗囊（' + r.aiPicks.length + '）'),
        r.aiPicks.length === 0
          ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（未答出）')
          : r.aiPicks.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
      )
    ),

    React.createElement('div', { style: { marginBottom: 24 } },
      React.createElement('div', {
        style: {
          fontFamily: fontFamilies.chinese, fontSize: 16, color: '#000',
          borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
        },
      }, '未答出的诗句（' + r.unused.length + '）'),
      r.unused.length === 0
        ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13, padding: '8px 0' } }, '（题库已尽）')
        : r.unused.map(function(v, i) { return poemLinkCombat(v, (i + 1) + '.'); })
    ),

    React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 16 } },
      React.createElement('button', { onClick: r.onPlayAgain, style: btnStyleCombat }, '再来一局'),
      React.createElement('button', { onClick: r.onPickKeyword, style: btnStyleCombat }, '换关键字')
    )
  );
}
`;

// pages/AiPlay.tsx
const aiPlayCode = `
// ===== pages/AiPlay.tsx =====
var TURN_SECONDS = 30;

function isDifficulty(s) {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

function AiPlay() {
  var params = useParams();
  var search = useSearchParams();
  var sp = search[0];
  var navigate = useNavigate();
  var kw = params.kw;
  var diffParam = sp.get('difficulty');
  var difficulty = isDifficulty(diffParam) ? diffParam : 'qingdeng';

  var initialTurnRef = useRef(null);
  if (initialTurnRef.current === null) initialTurnRef.current = rollFirstTurn();
  var firstRound = initialTurnRef.current;

  var roundState = useState(firstRound);
  var round = roundState[0]; var setRound = roundState[1];
  var playerPicksState = useState([]);
  var playerPicks = playerPicksState[0]; var setPlayerPicks = playerPicksState[1];
  var aiPicksState = useState([]);
  var aiPicks = aiPicksState[0]; var setAiPicks = aiPicksState[1];
  var usedState = useState(new Set());
  var used = usedState[0]; var setUsed = usedState[1];
  var boardState = useState(buildChoiceBoard(new Set(), kw || '', 4));
  var board = boardState[0]; var setBoard = boardState[1];
  var secState = useState(TURN_SECONDS);
  var secondsLeft = secState[0]; var setSecondsLeft = secState[1];
  var resultState = useState(null);
  var result = resultState[0]; var setResult = resultState[1];
  var startTimeRef = useRef(Date.now());

  function finish(winner) {
    if (result) return;
    var elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (winner === 'player') recordWin(difficulty);
    else recordLoss(difficulty);
    var allUnused = getVersesFor(kw || '').filter(function(v) { return !used.has(v.line); });
    setResult({
      winner: winner,
      elapsedSec: elapsed,
      playerPicks: playerPicks,
      aiPicks: aiPicks,
      unused: allUnused,
      keyword: kw || '',
      onPlayAgain: function() { navigate('/play/ai/' + kw + '?difficulty=' + difficulty, { replace: true }); },
      onPickKeyword: function() { navigate('/play?tab=combat'); },
    });
  }

  // 玩家回合倒计时
  useEffect(function() {
    if (result || round !== 'player') return;
    if (secondsLeft <= 0) { finish('ai'); return; }
    var t = setTimeout(function() { setSecondsLeft(function(s) { return s - 1; }); }, 1000);
    return function() { clearTimeout(t); };
  }, [secondsLeft, round, result]);

  // AI 回合
  useEffect(function() {
    if (result || round !== 'ai' || !kw) return;
    var meta = DIFFICULTY_META[difficulty];
    var t = setTimeout(function() {
      var pick = aiPickAnswer(kw, used, difficulty);
      if (!pick.picked) { finish('player'); return; }
      setAiPicks(function(prev) { return prev.concat([pick.verse]); });
      var nextUsed = new Set(used);
      nextUsed.add(pick.verse.line);
      setUsed(nextUsed);
      var nextBoard = buildChoiceBoard(nextUsed, kw, 4);
      if (nextBoard.length === 0) { finish('player'); return; }
      setBoard(nextBoard);
      setSecondsLeft(TURN_SECONDS);
      setRound('player');
    }, meta.thinkMs);
    return function() { clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // 玩家回合进入时建题板
  useEffect(function() {
    if (round !== 'player' || result || !kw) return;
    if (board.length === 0) {
      var b = buildChoiceBoard(used, kw, 4);
      if (b.length === 0) { finish('ai'); return; }
      setBoard(b);
      setSecondsLeft(TURN_SECONDS);
    }
  }, [round, result, kw]);

  function onSelect(v) {
    if (result || round !== 'player') return;
    setPlayerPicks(function(prev) { return prev.concat([v]); });
    var nextUsed = new Set(used);
    nextUsed.add(v.line);
    setUsed(nextUsed);
    var aiBoard = buildChoiceBoard(nextUsed, kw || '', 1);
    if (aiBoard.length === 0) { finish('player'); return; }
    setRound('ai');
  }

  if (!kw) {
    return React.createElement('div', { style: { padding: 40, color: colors.textPrimary } }, '关键字缺失');
  }
  var meta = DIFFICULTY_META[difficulty];

  return React.createElement('div', { style: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column' } },
    React.createElement(TopNav, { variant: 'main' }),
    React.createElement('div', { style: { flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' } },
      React.createElement('div', { style: { marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('button', {
          onClick: function() { navigate('/play?tab=combat'); },
          style: {
            background: 'transparent', border: 'none', color: colors.textTertiary,
            fontSize: 14, fontFamily: fontFamilies.chinese, cursor: 'pointer',
          },
        }, '← 返回大厅'),
        React.createElement('div', {
          style: { color: colors.textTertiary, fontSize: 14, fontFamily: fontFamilies.chinese },
        }, round === 'player' ? '你的回合' : 'AI 思考中…')
      ),

      React.createElement(PaperScroll, null,
        React.createElement('div', { style: { textAlign: 'center', marginBottom: 24 } },
          React.createElement('div', {
            style: {
              fontFamily: fontFamilies.chinese, color: '#000',
              fontSize: 80, fontWeight: 700, lineHeight: 1, marginBottom: 8,
            },
          }, kw)
        ),

        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 } },
          // 左
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
              },
            }, '你的诗囊（' + playerPicks.length + '）'),
            playerPicks.length === 0
              ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13 } }, '（尚未出招）')
              : playerPicks.map(function(v, i) {
                  return React.createElement('div', {
                    key: v.poemId + '-' + i,
                    style: { color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese },
                  }, (i + 1) + '. ' + v.line);
                })
          ),
          // 右
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 12,
              },
            },
              React.createElement(AiSilhouette, { difficulty: difficulty }),
              React.createElement('div', null,
                React.createElement('div', null, meta.label),
                React.createElement('div', {
                  style: { fontSize: 12, color: '#8b7355' },
                }, Math.round(meta.missRate * 100) + '% 漏答 · ' + (meta.thinkMs / 1000).toFixed(1) + 's'),
                round === 'ai' ? React.createElement('div', { style: { display: 'flex', gap: 4, marginTop: 4 } },
                  [0, 1, 2].map(function(i) {
                    return React.createElement('span', {
                      key: i,
                      style: {
                        width: 6, height: 6, borderRadius: '50%', background: '#000',
                        display: 'inline-block',
                        animation: 'dot-bounce 1.2s ease-in-out ' + (i * 0.2) + 's infinite',
                      },
                    });
                  })
                ) : null
              )
            ),
            React.createElement('div', {
              style: { fontFamily: fontFamilies.chinese, color: '#000', fontSize: 14, paddingTop: 8 },
            }, 'AI 诗囊（' + aiPicks.length + '）'),
            aiPicks.length === 0
              ? React.createElement('div', { style: { color: '#8b7355', fontSize: 13 } }, '（AI 尚未出招）')
              : aiPicks.map(function(v, i) {
                  return React.createElement('div', {
                    key: v.poemId + '-' + i,
                    style: { color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese },
                  }, (i + 1) + '. ' + v.line);
                })
          )
        ),

        result
          ? React.createElement(CombatResultModal, { result: result })
          : (round === 'player'
              ? React.createElement(ChoiceBoard, {
                  verses: board,
                  secondsLeft: secondsLeft,
                  onSelect: onSelect,
                })
              : React.createElement('div', {
                  style: { textAlign: 'center', color: '#8b7355', fontFamily: fontFamilies.chinese, padding: 32, fontSize: 14 },
                }, '（AI 回合锁定中）'))
      )
    )
  );
}
`;

// components/KeywordSeal.tsx
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
  var c = SEAL_COLORS[state];
  var interactive = state !== 'locked';
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
        width: 64,
        height: 64,
        background: c.bg,
        border: '2px solid ' + c.border,
        borderRadius: 4,
        color: c.text,
        fontFamily: fontFamilies.chinese,
        fontSize: 32,
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
function NineGrid(props) {
  const chars = props.chars;
  const blankCount = props.blankCount;
  const filled = props.filled;
  const onChar = props.onChar;
  const onUndo = props.onUndo;
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {Array.from({ length: blankCount }).map((_, i) => (
          <div key={i} style={{
            width: 48, height: 48,
            border: '2px solid #8b7355', borderRadius: 4,
            background: filled[i] ? '#f5ebd2' : 'transparent',
            color: '#000', fontFamily: fontFamilies.chinese,
            fontSize: 28, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{filled[i] != null ? filled[i] : ''}</div>
        ))}
        <button
          onClick={onUndo}
          disabled={filled.length === 0}
          style={{
            marginLeft: 12, padding: '0 16px',
            background: 'transparent', color: '#8b7355',
            border: '1px solid #8b7355', borderRadius: 3,
            fontFamily: fontFamilies.chinese, fontSize: 14,
            cursor: filled.length === 0 ? 'default' : 'pointer',
            opacity: filled.length === 0 ? 0.4 : 1,
            height: 40,
          }}>退字</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {chars.map((c, idx) => {
          const disabled = filled.length >= blankCount;
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

var DIFFICULTY_ORDER = ['qingdeng', 'mohe', 'shisheng'];

function PlayHall_isDifficulty(s) {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

function PlayHall() {
  const searchPair = useSearchParams();
  const searchParams = searchPair[0];
  const setSearchParams = searchPair[1];
  const rawTab = searchParams.get('tab');
  const tab = rawTab === 'combat' ? 'combat' : 'stage';

  const setTab = function(next) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next === 'stage') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const navigate = useNavigate();
  const progress = loadProgress();
  const record = loadRecord();
  const totalCleared = progress.cleared.length;

  const stateOf = function(kw, idx) {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '32px 28px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 32, letterSpacing: 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>
              飞 花 令
            </div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 16, letterSpacing: 4,
            }}>
              已通 {totalCleared} / 50 关
            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: 32,
          }}>
            <PlayHallTabButton label="闯关 · 飞花" active={tab === 'stage'} onClick={function() { setTab('stage'); }} />
            <PlayHallTabButton label="对战 · AI"   active={tab === 'combat'} onClick={function() { setTab('combat'); }} />
          </div>

          {tab === 'stage'
            ? <PlayHallStageTab />
            : <PlayHallCombatTab progress={progress} record={record} navigate={navigate} stateOf={stateOf} />}
        </div>
      </div>
    </div>
  );
}

function PlayHallTabButton(props) {
  const label = props.label;
  const active = props.active;
  const onClick = props.onClick;
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '12px 8px',
        marginBottom: -1,
        fontFamily: fontFamilies.chinese,
        fontSize: 18,
        letterSpacing: 4,
        color: active ? colors.textPrimary : colors.textTertiary,
        borderBottom: active ? '2px solid #d4af6a' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function PlayHallStageTab() {
  const progress = loadProgress();
  const totalCleared = progress.cleared.length;
  const stateOf = function(kw, idx) {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          color: colors.textTertiary, fontFamily: fontFamilies.chinese,
          fontSize: 13, letterSpacing: 4,
        }}>
          已通 {totalCleared} / 50 关 · 按三档递进解锁
        </div>
      </div>
      {['entry', 'mid', 'advanced'].map(function(group) {
        return (
          <div key={group} style={{ marginBottom: 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[group]}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(10, 64px)',
              gap: 12, justifyContent: 'center',
            }}>
              {KEYWORD_GROUPS[group].map(function(kw) {
                const globalIdx = KEYWORDS.indexOf(kw);
                const state = stateOf(kw, globalIdx);
                return (
                  <Link key={kw} to={state === 'locked' ? '#' : '/play/stage/' + kw}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={kw} state={state} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function PlayHallCombatTab(props) {
  const progress = props.progress;
  const record = props.record;
  const navigate = props.navigate;
  const stateOf = props.stateOf;
  const allKeywords = useMemo(function() {
    const set = new Set(FREE_KEYWORDS);
    for (const k of progress.cleared) set.add(k);
    return Array.from(set);
  }, [progress.cleared]);

  const defaultKw = allKeywords.length > 0 ? allKeywords[0] : FREE_KEYWORDS[0];
  const [selectedKw, setSelectedKw] = useState(defaultKw);
  const [selectedDiff, setSelectedDiff] = useState('qingdeng');

  const canStart = PlayHall_isDifficulty(selectedDiff) && allKeywords.indexOf(selectedKw) >= 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <PlayHallSectionTitle>关键字选择</PlayHallSectionTitle>
      <PlayHallSubLabel>自由字（任何时候可玩）</PlayHallSubLabel>
      <PlayHallKeywordRow keywords={FREE_KEYWORDS.slice()} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />

      <PlayHallSubLabel>已通关关键字（通关解锁）</PlayHallSubLabel>
      {progress.cleared.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 13, padding: '12px 0' }}>
          尚无通关关键字
        </div>
      ) : (
        <PlayHallKeywordRow keywords={progress.cleared} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />
      )}

      <PlayHallSectionTitle>AI 难度</PlayHallSectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {DIFFICULTY_ORDER.map(function(d) {
          const meta = DIFFICULTY_META[d];
          const active = selectedDiff === d;
          const stat = record[d];
          return (
            <button
              key={d}
              onClick={function() { setSelectedDiff(d); }}
              style={{
                padding: 16,
                background: active ? 'rgba(212,175,106,0.15)' : 'rgba(216,224,240,0.04)',
                border: '1px solid ' + (active ? '#d4af6a' : 'rgba(216,224,240,0.15)'),
                borderRadius: 4,
                color: active ? colors.textPrimary : colors.textSecondary,
                fontFamily: fontFamilies.chinese,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, letterSpacing: 4, marginBottom: 6 }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>
                漏答 {Math.round(meta.missRate * 100)}% · {(meta.thinkMs / 1000).toFixed(1)}s
              </div>
              <div style={{ fontSize: 11, color: colors.textDim, marginTop: 6 }}>
                战绩 {stat.win}胜 / {stat.lose}负
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center' }}>
        <button
          disabled={!canStart}
          onClick={function() { navigate('/play/ai/' + selectedKw + '?difficulty=' + selectedDiff); }}
          style={{
            padding: '12px 48px',
            background: canStart ? 'transparent' : 'rgba(0,0,0,0.2)',
            color: canStart ? colors.textPrimary : colors.textDim,
            border: '1px solid ' + (canStart ? '#d4af6a' : 'rgba(216,224,240,0.1)'),
            borderRadius: 4,
            fontFamily: fontFamilies.chinese,
            fontSize: 18,
            letterSpacing: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          开 战
        </button>
      </div>
    </div>
  );
}

function PlayHallSectionTitle(props) {
  return (
    <div style={{
      textAlign: 'center', color: colors.textTertiary,
      fontFamily: fontFamilies.chinese, fontSize: 14,
      letterSpacing: 6, marginTop: 32, marginBottom: 12,
    }}>
      {props.children}
    </div>
  );
}

function PlayHallSubLabel(props) {
  return (
    <div style={{
      color: colors.textDim, fontFamily: fontFamilies.chinese,
      fontSize: 12, letterSpacing: 3, marginBottom: 8,
    }}>
      {props.children}
    </div>
  );
}

function PlayHallKeywordRow(props) {
  const keywords = props.keywords;
  const selected = props.selected;
  const onSelect = props.onSelect;
  const clearedSet = props.clearedSet;
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    }}>
      {keywords.map(function(kw) {
        const active = selected === kw;
        const isCleared = cleared.has(kw);
        return (
          <button
            key={kw}
            onClick={function() { onSelect(kw); }}
            style={{
              width: 48, height: 48,
              background: active ? 'rgba(212,175,106,0.2)' : isCleared ? '#a8302a' : 'transparent',
              border: '1px solid ' + (active ? '#d4af6a' : isCleared ? '#7a1f15' : '#d4af6a'),
              borderRadius: 4,
              color: active ? colors.textPrimary : isCleared ? '#f5ebd2' : colors.textSecondary,
              fontFamily: fontFamilies.chinese,
              fontSize: 22, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {kw}
          </button>
        );
      })}
    </div>
  );
}
`;

// pages/StagePlay.tsx
const stagePlayCode = `
// ===== pages/StagePlay.tsx =====
var FEIHUA_PAPER_TEXT = '#000000';
var FEIHUA_PAPER_TEXT_DIM = '#8b7355';

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

  const [stage, setStage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress();
    if (progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw).current;
  });

  const used = useMemo(() => new Set(stage != null ? (stage.correct || []) : []), [stage]);

  const [question, setQuestion] = useState(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used);
  });

  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  const [filled, setFilled] = useState([]);

  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [grading, setGrading] = useState(false);

  const [result, setResult] = useState(null);

  useEffect(() => {
    if (question) {
      setNineGrid(buildNineGrid(question.verse.line, question.blanks));
      setFilled([]);
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

  const handleCorrect = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const line = questionRef.current.verse.line;
    const newCorrect = [].concat(cur.correct, [line]);

    commitStageCorrect(kw, line);
    setStage(loadProgress().current);

    if (newCorrect.length >= STAGE_GOAL) {
      markCleared(kw);
      setStage(loadProgress().current);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      const nextUsed = new Set(newCorrect);
      setQuestion(pickStageQuestion(kw, nextUsed));
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  };

  const handleWrong = () => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood);
    setStage(loadProgress().current);

    if (newBlood <= 0) {
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setFilled([]);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
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

  useEffect(() => {
    if (grading) return;
    if (!question || filled.length !== question.blanks.length) return;
    const ok = validateStageInput(filled.join(''), question.verse.line, question.blanks);
    if (ok) handleCorrect();
    else handleWrong();
  }, [filled, question]);

  const handleChar = (c) => {
    if (grading) return;
    if (filled.length >= (question ? question.blanks.length : 0)) return;
    setFilled([].concat(filled, [c]));
  };
  const handleUndo = () => {
    if (grading) return;
    setFilled(filled.slice(0, -1));
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/play"
            style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}
          >
            ← 返回大厅
          </Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
            </div>
            <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: FEIHUA_PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese,
              color: FEIHUA_PAPER_TEXT,
              fontSize: 120,
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
            fontSize: 32,
            letterSpacing: 6,
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
                onChar={handleChar}
                onUndo={handleUndo}
              />
            )}
          </div>

          {result && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(245,235,210,0.95)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 40,
            }}>
              <div style={{
                fontFamily: fontFamilies.chinese, color: FEIHUA_PAPER_TEXT,
                fontSize: 48, letterSpacing: 12, marginBottom: 24,
              }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
              <div style={{
                color: FEIHUA_PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                fontSize: 16, marginBottom: 32,
              }}>
                {result.kind === 'cleared'
                  ? '已答出 ' + result.correct.length + ' 句含「' + kw + '」的诗'
                  : '血尽于此，下次再来'}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button
                  onClick={() => {
                    if (result.kind === 'failed') clearCurrent();
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
          )}
        </PaperScroll>
      </div>
    </div>
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
        <Route path="/poems" element={<PoemsRiverPage />} />
        <Route path="/poet/:poetId" element={<PoetPage />} />
        <Route path="/poem/:poemId" element={<PoemPage />} />
        <Route path="/play" element={<PlayHall />} />
        <Route path="/play/stage/:kw" element={<StagePlay />} />
        <Route path="/play/ai/:kw" element={<AiPlay />} />
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
${poemTextCode}
${riverBgCode}
${useVisitedCode}
${viewportHookCode}
${timeAxisCode}
${searchBoxCode}
${topNavCode}
${riverPageCode}
${poemsRiverPageCode}
${poetPageCode}
${poemPageCode}
${feihuaTypesCode}
${feihuaKeywordsCode}
${feihuaEngineCode}
${feihuaProgressCode}
${feihuaAiCode}
${feihuaRecordCode}
${keywordSealCode}
${paperScrollCode}
${aiSilhouetteCode}
${choiceBoardCode}
${combatResultModalCode}
${aiPlayCode}
${nineGridCode}
${playHallCode}
${stagePlayCode}
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
