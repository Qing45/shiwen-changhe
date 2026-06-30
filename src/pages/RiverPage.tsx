import { Link } from 'react-router-dom';
import { getPoets } from '../data/load';
import { layoutPoets } from '../utils/layout';
import { useRiverViewport } from '../hooks/useRiverViewport';
import { RiverBackground } from '../components/RiverBackground';
import { RiverLine } from '../components/RiverLine';
import { TimeAxis } from '../components/TimeAxis';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes, nodeSizes } from '../theme';

export function RiverPage() {
  const poets = getPoets();
  const positioned = layoutPoets(poets, { minYear: 618, maxYear: 907, leftPadding: 8, rightPadding: 8 });
  const vp = useRiverViewport();

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
        {/* Inner canvas is wider than viewport; wheel zooms, drag pans */}
        <div style={{
          position: 'relative', width: '600%', height: '100%',
          ...vp.canvasStyle,
        }}>
          <RiverBackground />
          <RiverLine />
          {positioned.map(({ poet, x, y }) => {
            const size = nodeSizes[poet.familiarity] ?? nodeSizes[2];
            const isFocal = poet.familiarity >= 4;
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
                  fontSize: isFocal ? fontSizes.nodeFocal : fontSizes.nodeDefault,
                  textShadow: isFocal ? '0 0 14px rgba(216,224,240,0.8), 0 0 4px #fff' : '0 0 6px rgba(216,224,240,0.4)',
                  marginBottom: 8,
                  fontWeight: isFocal ? 600 : undefined,
                  letterSpacing: isFocal ? 4 : undefined,
                }}>{poet.name}</div>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: 'radial-gradient(circle, #fff 0%, #d8e0f0 60%, transparent 100%)',
                  boxShadow: isFocal
                    ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 6px #fff`
                    : `0 0 ${size}px rgba(216,224,240,0.7)`,
                }} />
              </Link>
            );
          })}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            <TimeAxis left="618 · 唐" right="907" />
          </div>
        </div>
      </div>
    </div>
  );
}
