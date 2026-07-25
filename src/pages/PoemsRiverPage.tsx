import { useState, useMemo, useLayoutEffect } from 'react';
import { getPoems, getPoets } from '../data/load';
import { layoutAllPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { useVisited } from '../hooks/useVisited';
import { useCorpus, type Corpus } from '../state/corpus';
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
  // 画布宽度 + minDx 按 corpus 单独调。
  // - tang / all / primary: 数据里有真密集列（tang 单列 86、primary 单列
  //   21）。需要 1500%+ 宽画布让密集列横向铺开；minDx=0.4% 缩小碰撞阈
  //   值。tang 沿用历史值 4500%，primary 降到 1500% 让学生库节点视觉上
  //   更靠拢（之前 4500% 在 2182 年跨下每首占 ~13% 画布宽，太空）。
  // - junior: 数据稀疏（max-col=5），12x 画布 + 默认 minDx=1.5% 即可。
  //   之前 45x 在 3022 年跨下每首占 ~20% 画布宽，肉眼「离得太远」。
  // - senior: 总数 46 首，max-col=5。沿用 6x 最紧凑画布；总节点数已经够少。
  const CORPUS_CANVAS: Record<Corpus, number> = {
    all: 45,
    tang: 45,
    primary: 15,
    junior: 12,
    senior: 6,
  };
  const CORPUS_MIN_DX: Record<Corpus, number> = {
    all: 0.4,
    tang: 0.4,
    primary: 0.4,
    junior: 1.5,
    senior: 1.5,
  };
  // canvas 宽度比例（1 = container 宽度）。用于视口裁剪时把节点 % 坐标换算到像素。
  const canvasWidthRatio = CORPUS_CANVAS[corpus];
  const layoutMinDx = CORPUS_MIN_DX[corpus];
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
            // 画布宽度按 corpus 调（见 CORPUS_CANVAS 注释）。tang/all 沿用
            // 4500% 是历史最密列（86 / ~206 首）的配套设置，primary/junior
            // 收窄后视觉上节点更靠近，senior 保持 600% 最紧凑。
            position: 'relative', width: `${canvasWidthRatio * 100}%`, height: '100%',
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
