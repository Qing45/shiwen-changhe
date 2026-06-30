import { useParams, Link } from 'react-router-dom';
import { getPoet, getPoemsByPoet } from '../data/load';
import { layoutPoems } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { RiverBackground } from '../components/RiverBackground';
import { RiverLine } from '../components/RiverLine';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, nodeSizes } from '../theme';

export function PoetPage() {
  const { poetId } = useParams<{ poetId: string }>();
  const poet = poetId ? getPoet(poetId) : undefined;
  const vp = useRiverViewport();

  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗人未找到</div>;
  }

  const poems = getPoemsByPoet(poet.id);
  const positioned = layoutPoems(poems, poet, { leftPadding: 6, rightPadding: 6 });

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
        <div style={{
          position: 'relative', width: '600%', height: '100%',
          ...vp.canvasStyle,
        }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poem, x, y }) => {
            const size = nodeSizes[poem.familiarity] ?? nodeSizes[2];
            const isFocal = poem.familiarity >= 5;
            return (
              <Link
                key={poem.id}
                to={`/poem/${poem.id}`}
                onClickCapture={(e) => {
                  if (vp.dragMovedRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                style={{
                  position: 'absolute',
                  top: `calc(50% + ${y}%)`,
                  left: `${x}%`,
                  transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  color: isFocal ? '#fff' : colors.textPrimary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: isFocal ? fontSizes.nodeLarge : fontSizes.body,
                  textShadow: isFocal ? '0 0 12px rgba(216,224,240,0.8)' : 'none',
                  marginBottom: 6,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 2 : undefined,
                }}>{poem.title}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 4px #fff`
                    : `0 0 ${size}px rgba(216,224,240,0.6)`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left={`${poet.birthYear} · 生`} right={`${poet.deathYear} · 卒`} />
          </div>
        </div>
      </div>
    </div>
  );
}
