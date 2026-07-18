import { memo, useEffect, useRef, useState } from 'react';

// Nebula clouds: large blurred colored blobs that drift slowly across the
// canvas. Each is wrapped so the outer div centers via translate(-50%, -50%)
// while the inner div owns the drift animation — keeping the two transforms
// from clobbering each other.
const NEBULA_CLOUDS = [
  { x: 18, y: 50, w: 700, h: 240, color: 'rgba(180,140,220,0.20)', dur: 50, delay: 0 },
  { x: 50, y: 45, w: 820, h: 280, color: 'rgba(150,180,230,0.18)', dur: 62, delay: -15 },
  { x: 78, y: 52, w: 600, h: 220, color: 'rgba(220,160,180,0.16)', dur: 55, delay: -25 },
  { x: 35, y: 55, w: 520, h: 180, color: 'rgba(200,180,140,0.14)', dur: 48, delay: -8 },
];

// 60 stars; 60% biased into the Milky Way band (top 28-72%), rest scattered
// across the full canvas. Sizes/durations/delays all randomized so no two
// twinkle in phase.
const STARS = Array.from({ length: 60 }, () => {
  const inBand = Math.random() < 0.6;
  return {
    top: inBand ? 28 + Math.random() * 44 : Math.random() * 100,
    left: Math.random() * 100,
    size: 0.6 + Math.random() * 1.4,
    duration: 2 + Math.random() * 4,
    delay: -Math.random() * 6,
  };
});

// Secondary starfield layer: offset positions/seeds for parallax depth.
const STARS_LAYER2 = Array.from({ length: 40 }, () => {
  const inBand = Math.random() < 0.5;
  return {
    top: inBand ? 35 + Math.random() * 30 : Math.random() * 100,
    left: Math.random() * 100,
    size: 0.5 + Math.random() * 1.0,
    duration: 3 + Math.random() * 5,
    delay: -Math.random() * 6,
  };
});

// A handful of rare bright twinkle dots scattered sparsely.
const TWINKLE_DOTS = Array.from({ length: 7 }, (_, i) => ({
  top: 10 + Math.random() * 80,
  left: 8 + Math.random() * 84,
  size: 1 + Math.random() * 1,
  delay: -(i * 0.85 + Math.random() * 6),
}));

// Parallax coefficients: max pixel offset per layer at mouse extremes (±1).
// Moon moves most (furthest perceived depth), stars least (nearest).
const PARALLAX_COEFS = {
  moon: 12,
  nebula: 6,
  stars: 3.6,
  starsLayer2: 2.4,
};

// Second-layer background: a sparse radial-gradient constellation that
// drifts at a different rate to imply depth.
const STARS_LAYER2_BG = `
  radial-gradient(circle at 12% 22%, rgba(255,255,255,0.35) 0px, transparent 1.5px),
  radial-gradient(circle at 33% 78%, rgba(216,224,240,0.3) 0px, transparent 1.5px),
  radial-gradient(circle at 55% 18%, rgba(255,255,255,0.25) 0px, transparent 1.5px),
  radial-gradient(circle at 72% 60%, rgba(216,224,240,0.32) 0px, transparent 1.5px),
  radial-gradient(circle at 88% 35%, rgba(255,255,255,0.28) 0px, transparent 1.5px),
  radial-gradient(circle at 22% 50%, rgba(216,224,240,0.22) 0px, transparent 1.5px)
`;

// Static sub-layers: 内容完全静态（mount 后不再变化），React.memo 永远 bail out。
// 这些层被包在 RiverBackground 内联的 parallax wrapper 里 —— wrapper 必须每帧
// 重渲染以更新 transform，而内部这 100+ 个 div 不需要重新 diff。
const NebulaClouds = memo(function NebulaClouds() {
  return (
    <>
      {NEBULA_CLOUDS.map((c, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${c.y}%`,
          left: `${c.x}%`,
          transform: 'translate(-50%, -50%)',
        }}>
          <div style={{
            width: c.w,
            height: c.h,
            background: `radial-gradient(ellipse, ${c.color} 0%, transparent 70%)`,
            filter: 'blur(40px)',
            animation: `nebula-drift ${c.dur}s ease-in-out ${c.delay}s infinite alternate`,
          }} />
        </div>
      ))}
    </>
  );
});

const StarsLayer1 = memo(function StarsLayer1() {
  return (
    <>
      {STARS.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${s.top}%`,
          left: `${s.left}%`,
          width: s.size,
          height: s.size,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.7)`,
          animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
        }} />
      ))}
    </>
  );
});

const StarsLayer2Inner = memo(function StarsLayer2Inner() {
  return (
    <>
      <div style={{
        position: 'absolute', inset: 0,
        background: STARS_LAYER2_BG,
        backgroundSize: '320px 320px',
        animation: 'star-drift-slow 180s linear infinite alternate',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: STARS_LAYER2_BG,
        backgroundSize: '480px 480px',
        backgroundPosition: '120px 60px',
        animation: 'star-drift-slower 240s linear infinite alternate',
      }} />
      {STARS_LAYER2.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: `${s.top}%`,
          left: `${s.left}%`,
          width: s.size,
          height: s.size,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: `0 0 ${s.size * 2}px rgba(255,255,255,0.55)`,
          animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite alternate`,
        }} />
      ))}
    </>
  );
});

const TwinkleDots = memo(function TwinkleDots() {
  return (
    <>
      {TWINKLE_DOTS.map((d, i) => (
        <div key={`tw-${i}`} style={{
          position: 'absolute',
          top: `${d.top}%`,
          left: `${d.left}%`,
          width: d.size,
          height: d.size,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: `0 0 ${d.size * 3}px rgba(255,255,255,0.85)`,
          animation: `twinkle 4s ease-in-out ${d.delay}s infinite alternate`,
          pointerEvents: 'none',
        }} />
      ))}
    </>
  );
});

export function RiverBackground({ dragging }: { dragging: boolean }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(dragging);

  // Keep draggingRef in sync so the mousemove handler (registered once) reads
  // current value without re-binding on every state change.
  useEffect(() => { draggingRef.current = dragging; }, [dragging]);

  // Listen at window level so parallax works even when the cursor is over a
  // node label, not just empty canvas. rAF throttle caps updates at one per
  // frame; drag freezes parallax entirely to avoid fighting the pan.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
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

  // Parallax wrapper style —— 必须每帧重建（transform 依赖 mouse）。但 wrapper
  // 内部子树都是 memo 组件，React.memo bail out 后只更新 wrapper 自己的 transform
  // CSS 属性，~100+ 子 div 不再走 diff。
  const wrapStyle = (coef: number) => ({
    position: 'absolute' as const,
    inset: 0,
    transform: `translate(${(mouse.x * coef).toFixed(1)}px, ${(mouse.y * coef).toFixed(1)}px)`,
    willChange: 'transform',
    pointerEvents: 'none' as const,
  });

  return (
    <>
      {/* 星云气尘 — parallax wrapper around existing clouds */}
      <div style={wrapStyle(PARALLAX_COEFS.nebula)}>
        <NebulaClouds />
      </div>

      {/* 星点 layer 1 — outer parallax + inner drift + per-star twinkle */}
      <div style={wrapStyle(PARALLAX_COEFS.stars)}>
        <div style={{
          position: 'absolute', inset: 0,
          animation: 'stars-drift 360s ease-in-out infinite alternate',
        }}>
          <StarsLayer1 />
        </div>
      </div>

      {/* 星点 layer 2 — slower parallax + slow drift background pattern */}
      <div style={wrapStyle(PARALLAX_COEFS.starsLayer2)}>
        <StarsLayer2Inner />
      </div>

      {/* Rare twinkle dots — sparse bright points, no parallax */}
      <TwinkleDots />

      {/* 月亮 — parallax only (单元素，每帧重建 style 成本极低) */}
      <div style={{
        position: 'absolute', top: '8%', right: '6%',
        width: 72, height: 72, borderRadius: '50%',
        background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
        boxShadow: '0 0 60px rgba(216,224,240,0.3)',
        transform: `translate(${(mouse.x * PARALLAX_COEFS.moon).toFixed(1)}px, ${(mouse.y * PARALLAX_COEFS.moon).toFixed(1)}px)`,
        pointerEvents: 'none',
        willChange: 'transform',
      }} />
    </>
  );
}
