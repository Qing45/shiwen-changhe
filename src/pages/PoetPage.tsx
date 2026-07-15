import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPoet, getPoemsByPoet } from '../data/load';
import { layoutPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useVisited } from '../hooks/useVisited';
import { useCorpus } from '../state/corpus';
import { RiverBackground } from '../components/RiverBackground';
import { RiverNode } from '../components/RiverNode';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, contentLengthToSize, fontSizes } from '../theme';
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

  // 切换诗人时复位 window 滚动到顶部
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [poet?.id]);

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
            const isFocal = poem.familiarity >= 5;
            return (
              <RiverNode
                key={poem.id}
                id={poem.id}
                to={`/poem/${poem.id}`}
                state={{ from: `/poet/${poet.id}` }}
                label={poem.title}
                size={contentLengthToSize(poem.content.length)}
                textFontSize={isFocal ? fontSizes.nodeLarge : fontSizes.body}
                isFocal={isFocal}
                isVisited={visited.has(poem.id)}
                tooltip={<div>{truncate(poem.content, 12)}</div>}
                x={x}
                y={y}
                variant="poem"
                enablePress={false}
                floatDuration={4 + (i % 3)}
                floatDelay={-((i % 7) * 0.5)}
                dragMovedRef={vp.dragMovedRef}
                onVisited={() => markVisited(poem.id)}
              />
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
