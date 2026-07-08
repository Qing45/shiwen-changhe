import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPoems, getPoets } from '../data/load';
import { layoutAllPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useVisited } from '../hooks/useVisited';
import { RiverBackground } from '../components/RiverBackground';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, contentLengthToSize } from '../theme';

const POEMS_RIVER_TICKS: { year: number; label?: string; pos: number }[] = (() => {
  const out: { year: number; label?: string; pos: number }[] = [];
  for (let y = 618; y <= 897; y += 30) {
    const isMajor = y % 30 === 0;
    out.push({ year: y, label: isMajor ? String(y) : undefined, pos: ((y - 618) / (907 - 618)) * 100 });
  }
  return out;
})();

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function PoemsRiverPage() {
  const poems = getPoems();
  const poets = getPoets();
  const positioned = layoutAllPoems(poems, poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState<string | null>(null);

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
                to={`/poem/${poem.id}`}
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
                  top: `calc(50% + ${y}%)`,
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  textDecoration: 'none',
                }}
              >
                <div
                  onMouseEnter={() => setHoverId(poem.id)}
                  onMouseLeave={() => setHoverId((id) => (id === poem.id ? null : id))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: `node-float ${floatDuration}s ease-in-out ${floatDelay}s infinite`,
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
                    background: `radial-gradient(circle, ${highlightCore} 0%, #d8e0f0 60%, transparent 100%)`,
                    border: '1px solid rgba(216,224,240,0.45)',
                    boxShadow: isFocal
                      ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 4px #fff`
                      : `0 0 ${size}px rgba(216,224,240,0.6)`,
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
                      <div>{truncate(poem.content, 12)}</div>
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