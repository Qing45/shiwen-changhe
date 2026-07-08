import { colors, fontFamilies } from '../theme';

export interface TimeTick {
  year: number;
  label?: string;
  // Position as percentage (0-100) within the timeline track
  pos: number;
}

interface Props {
  left: string;
  right: string;
  ticks?: TimeTick[];
}

export function TimeAxis({ left, right, ticks = [] }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      background: 'linear-gradient(180deg, transparent 0%, rgba(2,5,20,0.6) 100%)',
      borderTop: '1px solid rgba(216,224,240,0.15)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
    }}>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{left}</div>
      <div style={{
        flex: 1, position: 'relative', height: 1, margin: '0 12px',
        background: 'linear-gradient(90deg, rgba(216,224,240,0.4), rgba(216,224,240,0.6), rgba(216,224,240,0.4))',
      }}>
        {ticks.map((t) => {
          const isMajor = !!t.label;
          const opacity = isMajor ? 0.4 : 0.2;
          return (
            <div key={t.year} style={{
              position: 'absolute',
              top: -8,
              left: `${t.pos}%`,
              transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                width: 1, height: isMajor ? 16 : 10,
                background: `rgba(216,224,240,${opacity})`,
              }} />
              {isMajor && t.label && (
                <div style={{
                  position: 'absolute', top: 18,
                  color: colors.textDim, fontSize: 12, letterSpacing: 1,
                  fontFamily: fontFamilies.chinese,
                  whiteSpace: 'nowrap',
                }}>{t.label}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{right}</div>
    </div>
  );
}