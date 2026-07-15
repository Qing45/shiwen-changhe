import { getPoets, getPoemCount, getPoems } from '../data/load';
import { layoutPoets } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useVisited } from '../hooks/useVisited';
import { RiverBackground } from '../components/RiverBackground';
import { RiverNode } from '../components/RiverNode';
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
            position: 'relative', width: '600%', height: '100%',
            animation: 'fade-in 0.25s ease-out',
            ...vp.canvasStyle,
          }}
        >
          <RiverBackground dragging={vp.dragging} />
          {positioned.map(({ poet, x, y }, i) => {
            const isFocal = poet.familiarity >= 4;
            return (
              <RiverNode
                key={poet.id}
                id={poet.id}
                to={`/poet/${poet.id}`}
                label={poet.name}
                size={poemCountToSize(getPoemCount(poet.id)) * scale}
                textFontSize={(isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault) * nameScale}
                isFocal={isFocal}
                isVisited={visited.has(poet.id)}
                tooltip={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{poet.birthYear}—{poet.deathYear}</span>
                    <span style={{ color: colors.textDim }}>·</span>
                    <span style={{ color: colors.textSecondary }}>{getDynastyName(poet.dynastyId)}</span>
                  </div>
                }
                x={x}
                y={y}
                variant="poet"
                floatDuration={4 + (i % 3)}
                floatDelay={-((i % 7) * 0.5)}
                dragMovedRef={vp.dragMovedRef}
                onVisited={() => markVisited(poet.id)}
              />
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
