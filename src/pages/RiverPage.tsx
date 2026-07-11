import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getPoets, getPoemCount, getPoems } from '../data/load';
import { layoutPoets } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useVisited } from '../hooks/useVisited';
import { RiverBackground } from '../components/RiverBackground';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { useCorpus } from '../state/corpus';
import { computeCorpusYearRange } from '../utils/yearRange';
import { getDynastyName } from '../data/dynasties';
import { colors, fontFamilies, fontSizes, poemCountToSize } from '../theme';

export function RiverPage() {
  const poets = getPoets();
  const corpus = useCorpus();
  const visiblePoems = getPoems(corpus === 'all' ? 'both' : corpus);
  const visiblePoetIds = new Set(visiblePoems.map((p) => p.poetId));
  const visiblePoets = poets.filter((p) => visiblePoetIds.has(p.id));
  const range = computeCorpusYearRange(visiblePoets, corpus);
  const positioned = layoutPoets(visiblePoets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pressedId, setPressedId] = useState<string | null>(null);
  const bp = useBreakpoint();
  // 移动端节点整体缩小，字号收紧，避免互相重叠
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
        {/* Inner canvas is wider than viewport; wheel zooms, drag pans, pinch zooms */}
        <div
          key={corpus}
          style={{
            // 总库诗人密集，拉长 X 轴（画布加宽）以拉开节点、避免名字碰撞
            position: 'relative', width: corpus === 'all' ? '1600%' : '600%', height: '100%',
            animation: 'fade-in 0.25s ease-out',
            ...vp.canvasStyle,
          }}
        >
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
                to={`/poet/${poet.id}`}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onClick={() => markVisited(poet.id)}
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  textDecoration: 'none',
                }}
              >
                <div
                  onMouseEnter={() => setHoverId(poet.id)}
                  onMouseLeave={() => {
                    setHoverId((id) => (id === poet.id ? null : id));
                    setPressedId((id) => (id === poet.id ? null : id));
                  }}
                  onMouseDown={() => setPressedId(poet.id)}
                  onMouseUp={() => setPressedId((id) => (id === poet.id ? null : id))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    animation: `node-float ${floatDuration}s ease-in-out ${floatDelay}s infinite`,
                    position: 'relative',
                    transition: 'transform 0.1s',
                    transform: pressedId === poet.id ? 'scale(0.92)' : undefined,
                    cursor: 'pointer',
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
                    background: `radial-gradient(circle, ${highlightCore} 0%, #d8e0f0 60%, transparent 100%)`,
                    border: '1px solid rgba(216,224,240,0.45)',
                    boxShadow: isFocal
                      ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 6px #fff`
                      : `0 0 ${size}px rgba(216,224,240,0.7)`,
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
                        <span style={{ color: colors.textSecondary }}>{getDynastyName(poet.dynastyId)}</span>
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
            <TimeAxis left={range.leftLabel} right={range.rightLabel} ticks={range.ticks} />
          </div>
        </div>
      </div>
    </div>
  );
}