import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPoet, getPoemsByPoet } from '../data/load';
import { layoutPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useVisited } from '../hooks/useVisited';
import { useCorpus } from '../state/corpus';
import { RiverBackground } from '../components/RiverBackground';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, contentLengthToSize } from '../theme';
import type { Poem } from '../types';

function buildPoetTicks(birth: number, death: number): { year: number; label?: string; pos: number }[] {
  const out: { year: number; label?: string; pos: number }[] = [];
  // Snap start down to nearest multiple of 10
  const start = Math.ceil(birth / 10) * 10;
  const end = Math.floor(death / 10) * 10;
  const span = Math.max(1, death - birth);
  for (let y = start; y <= end; y += 10) {
    const isMajor = y % 30 === 0;
    out.push({ year: y, label: isMajor ? String(y) : undefined, pos: ((y - birth) / span) * 100 });
  }
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function PoetPage() {
  const { poetId } = useParams<{ poetId: string }>();
  const poet = poetId ? getPoet(poetId) : undefined;
  const corpus = useCorpus();
  const [showAll, setShowAll] = useState(false);
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const allPoems = getPoemsByPoet(poet.id);
  const filteredPoems: Poem[] = corpus === 'all'
    ? allPoems
    : allPoems.filter((p) => {
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
          <div style={{ marginBottom: 16 }}>{corpus === 'all' ? '该诗人无作品' : `该诗人在${corpus === 'tang' ? '唐诗三百首' : '小学必背'}库中无作品`}</div>
          <button
            onClick={() => setShowAll(true)}
            style={{
              padding: '8px 22px', background: 'transparent',
              color: colors.textPrimary, border: `1px solid ${colors.textPrimary}`,
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
            onClick={() => setShowAll((s) => !s)}
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
                to={`/poem/${poem.id}`}
                state={{ from: `/poet/${poet.id}` }}
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
            <TimeAxis left={`${poet.birthYear} · 生`} right={`${poet.deathYear} · 卒`} ticks={ticks} />
          </div>
        </div>
      </div>
    </div>
  );
}