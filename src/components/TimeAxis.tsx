import { colors, fontFamilies } from '../theme';

interface Props {
  left: string;
  right: string;
}

export function TimeAxis({ left, right }: Props) {
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 36,
      background: 'linear-gradient(180deg, transparent 0%, rgba(2,5,20,0.6) 100%)',
      borderTop: '1px solid rgba(216,224,240,0.15)',
      display: 'flex', alignItems: 'center', padding: '0 24px',
    }}>
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{left}</div>
      <div style={{
        flex: 1, height: 1, margin: '0 12px',
        background: 'linear-gradient(90deg, rgba(216,224,240,0.4), rgba(216,224,240,0.6), rgba(216,224,240,0.4))',
      }} />
      <div style={{ color: colors.textDim, fontSize: 14, letterSpacing: 1, fontFamily: fontFamilies.chinese }}>{right}</div>
    </div>
  );
}
