import { colors } from '../theme';

export function RiverLine() {
  return (
    <>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: colors.riverLine,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '48%', left: 0, right: 0, height: 10,
        background: colors.riverGlow,
        filter: 'blur(3px)',
        pointerEvents: 'none',
      }} />
    </>
  );
}
