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
      {/* Moving highlight that scans left → right along the river */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)',
        backgroundSize: '200% 100%',
        animation: 'river-flow 6s linear infinite',
        pointerEvents: 'none',
      }} />
    </>
  );
}
