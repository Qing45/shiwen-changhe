import { useState, useMemo, useLayoutEffect } from 'react';
import { getPoems, getPoets } from '../data/load';
import { layoutAllPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useVisited } from '../hooks/useVisited';
import { useCorpus } from '../state/corpus';
import { computeCorpusYearRange } from '../utils/yearRange';
import { RiverBackground } from '../components/RiverBackground';
import { RiverNode } from '../components/RiverNode';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, contentLengthToSize } from '../theme';

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// 视口裁剪的边距缓冲：节点最大半径 + 阴影 + tooltip 余量。
// 节点提前在视口外 PAD 像素内就开始完整渲染，避免 pan/zoom 时看见「闪入」。
const VIEWPORT_PAD = 80;

export function PoemsRiverPage() {
  const corpus = useCorpus();
  // getPoems/getPoets 返回新数组引用。把整条依赖链 memo 起来，确保 layout 调用的 deps
  // 在同一 corpus 下引用稳定 —— 否则 useMemo 失效，每次 render 仍重算（cache 兜底）。
  const poets = getPoets();
  const poems = useMemo(
    () => getPoems(corpus === 'all' ? 'both' : corpus),
    [corpus],
  );
  const visiblePoetIds = useMemo(
    () => new Set(poems.map((p) => p.poetId)),
    [poems],
  );
  const visiblePoets = useMemo(
    () => poets.filter((p) => visiblePoetIds.has(p.id)),
    [poets, visiblePoetIds],
  );
  const range = useMemo(
    () => computeCorpusYearRange(visiblePoets, corpus),
    [visiblePoets, corpus],
  );
  // 唐诗 309 首在 year=700 单列 115 首这种密集场景下，最小 X 间距 0.4% 算
  // 法上无碰撞，但在 2250% 画布下移动端像素间距仅 ~31px（亮斑+文字会视觉
  // 重叠）。唐诗画布放大到 4500%（=2250%×2），最小像素间距翻倍到 ~63px
  // 移动端 / ~180px 桌面端，彻底消除视觉粘连。minDx 保持 0.4%（碰撞判
  // 定阈值不变，仅画布宽度变化）。总库 464 首分布更不均匀——最大 dense
  // 列 206 首（李白+杜甫合并），比唐诗还密集——也用 4500% 才能避免视觉粘连。
  const isTang = corpus === 'tang';
  const isAll = corpus === 'all';
  const layoutMinDx = isTang || isAll ? 0.4 : undefined;
  // canvas 宽度比例（1 = container 宽度）。用于视口裁剪时把节点 % 坐标换算到像素。
  const canvasWidthRatio = isTang || isAll ? 45 : 6;
  const positioned = useMemo(
    () => layoutAllPoems(poems, poets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 }, layoutMinDx),
    [poems, poets, range, layoutMinDx],
  );
  const vp = useRiverViewport(`poems:${corpus}`);
  const { visited, markVisited } = useVisited();

  // 视口裁剪：测量 container 实际尺寸 + pan/zoom，算出可见节点 id 集。
  // 未测量（首帧 / 无 ResizeObserver 环境，如 jsdom）返回 null = 全显。
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
    // containerRef 由 hook 持有，identity 稳定，可不进 deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleIds = useMemo<Set<string> | null>(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return null;
    const set = new Set<string>();
    const cw = containerSize.w;
    const ch = containerSize.h;
    for (const { poem, x, y } of positioned) {
      // 节点在 canvas 内的像素坐标（canvas transform 前）
      const nodeX = (x / 100) * canvasWidthRatio * cw;
      const nodeY = (0.5 + y / 100) * ch;
      // 应用 canvas transform（translate + scale，origin 0,0）
      const sx = nodeX * vp.zoom + vp.pan.x;
      const sy = nodeY * vp.zoom + vp.pan.y;
      if (
        sx > -VIEWPORT_PAD && sx < cw + VIEWPORT_PAD &&
        sy > -VIEWPORT_PAD && sy < ch + VIEWPORT_PAD
      ) {
        set.add(poem.id);
      }
    }
    return set;
  }, [positioned, vp.pan, vp.zoom, containerSize, canvasWidthRatio]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ textAlign: 'center', padding: '8px 0 0', color: '#8b7355', fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 6 }}>
        {corpus === 'tang' ? '唐 诗 三 百 首' : corpus === 'primary' ? '小 学 必 背' : corpus === 'junior' ? '初 中 必 背' : corpus === 'senior' ? '高 中 必 背' : '总 库'}
      </div>
      <div
        {...vp.containerProps}
        style={{
          position: 'relative', flex: 1,
          background: colors.bgGradient, overflow: 'hidden',
          ...vp.containerProps.style,
        }}
      >
        <div
          key={corpus}
          style={{
            // 唐诗 + 总库画布 4500%：让最小像素间距翻倍。移动端尤其需要：
            // 350px 视口下 0.4% minDx 在 2250% 仅 ~31px，4500% 给到 ~63px，
            // 亮斑+标签不再视觉粘连。
            position: 'relative', width: isTang || isAll ? '4500%' : '600%', height: '100%',
            animation: 'fade-in 0.25s ease-out',
            ...vp.canvasStyle,
          }}
        >
          <RiverBackground dragging={vp.dragging} />
          {positioned.map(({ poem, x, y }, i) => {
            const isFocal = poem.familiarity >= 5;
            return (
              <RiverNode
                key={poem.id}
                id={poem.id}
                to={`/poem/${poem.id}`}
                state={{ from: '/poems' }}
                label={poem.title}
                size={contentLengthToSize(poem.content.length)}
                textFontSize={isFocal ? fontSizes.nodeLarge : fontSizes.body}
                isFocal={isFocal}
                isVisited={visited.has(poem.id)}
                tooltip={<div>{truncate(poem.content, 12)}</div>}
                x={x}
                y={y}
                variant="poem"
                floatDuration={4 + (i % 3)}
                floatDelay={-((i % 7) * 0.5)}
                dragMovedRef={vp.dragMovedRef}
                onVisited={() => markVisited(poem.id)}
                visible={visibleIds === null ? true : visibleIds.has(poem.id)}
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
