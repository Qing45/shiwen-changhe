import { useState, useMemo, useLayoutEffect } from 'react';
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

// 视口裁剪的边距缓冲：节点最大半径 + 阴影 + tooltip 余量。
const VIEWPORT_PAD = 80;

export function RiverPage() {
  const poets = getPoets();
  const corpus = useCorpus();
  const visiblePoems = getPoems(corpus === 'all' ? 'both' : corpus);
  const visiblePoetIds = new Set(visiblePoems.map((p) => p.poetId));
  const visiblePoets = poets.filter((p) => visiblePoetIds.has(p.id));
  const range = computeCorpusYearRange(visiblePoets, corpus);
  const positioned = layoutPoets(visiblePoets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport(`river:${corpus}`);
  const { visited, markVisited } = useVisited();
  const bp = useBreakpoint();
  // 移动端节点整体缩小，字号收紧，避免互相重叠
  const scale = bp === 'mobile' ? 0.7 : bp === 'tablet' ? 0.85 : 1;
  const nameScale = bp === 'mobile' ? 0.85 : 1;

  // RiverPage 画布固定 600%（6× container 宽度）。用于视口裁剪像素换算。
  const canvasWidthRatio = 6;

  // 视口裁剪：测量 container 实际尺寸 + pan/zoom，算出可见节点 id 集。
  // 未测量（首帧 / 无 ResizeObserver 环境）返回 null = 全显。
  const containerRef = vp.containerProps.ref;
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleIds = useMemo<Set<string> | null>(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return null;
    const set = new Set<string>();
    const cw = containerSize.w;
    const ch = containerSize.h;
    for (const { poet, x, y } of positioned) {
      const nodeX = (x / 100) * canvasWidthRatio * cw;
      const nodeY = (0.5 + y / 100) * ch;
      const sx = nodeX * vp.zoom + vp.pan.x;
      const sy = nodeY * vp.zoom + vp.pan.y;
      if (
        sx > -VIEWPORT_PAD && sx < cw + VIEWPORT_PAD &&
        sy > -VIEWPORT_PAD && sy < ch + VIEWPORT_PAD
      ) {
        set.add(poet.id);
      }
    }
    return set;
  }, [positioned, vp.pan, vp.zoom, containerSize, canvasWidthRatio]);

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
                visible={visibleIds === null ? true : visibleIds.has(poet.id)}
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
