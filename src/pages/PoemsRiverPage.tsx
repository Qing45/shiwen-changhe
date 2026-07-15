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

export function PoemsRiverPage() {
  const corpus = useCorpus();
  const poems = getPoems(corpus === 'all' ? 'both' : corpus);
  const poets = getPoets();
  const visiblePoetIds = new Set(poems.map((p) => p.poetId));
  const visiblePoets = poets.filter((p) => visiblePoetIds.has(p.id));
  const range = computeCorpusYearRange(visiblePoets, corpus);
  // 唐诗 309 首在 year=700 单列 115 首这种密集场景下，最小 X 间距 0.4% 算
  // 法上无碰撞，但在 2250% 画布下移动端像素间距仅 ~31px（亮斑+文字会视觉
  // 重叠）。唐诗画布放大到 4500%（=2250%×2），最小像素间距翻倍到 ~63px
  // 移动端 / ~180px 桌面端，彻底消除视觉粘连。minDx 保持 0.4%（碰撞判
  // 定阈值不变，仅画布宽度变化）。总库 403 首分布更均匀仍用 2250%。
  const isTang = corpus === 'tang';
  const isAll = corpus === 'all';
  const layoutMinDx = isTang || isAll ? 0.4 : undefined;
  const positioned = layoutAllPoems(poems, poets, { minYear: range.minYear, maxYear: range.maxYear, leftPadding: 8, rightPadding: 8 }, layoutMinDx);
  const vp = useRiverViewport();
  const { visited, markVisited } = useVisited();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ textAlign: 'center', padding: '8px 0 0', color: '#8b7355', fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 6 }}>
        {corpus === 'tang' ? '唐 诗 三 百 首' : corpus === 'primary' ? '小 学 必 背' : '总 库'}
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
            // 唐诗画布 4500%（=2250%×2）让最小像素间距翻倍；总库 2250%。
            // 移动端尤其需要：350px 视口下 0.4% minDx 在 2250% 仅 ~31px，
            // 4500% 给到 ~63px，亮斑+标签不再视觉粘连。
            position: 'relative', width: isTang ? '4500%' : isAll ? '2250%' : '600%', height: '100%',
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
