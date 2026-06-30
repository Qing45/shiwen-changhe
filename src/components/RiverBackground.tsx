export function RiverBackground() {
  return (
    <>
      {/* 远山墨影 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 320px 60px at 12% 78%, rgba(60,80,120,0.35) 0%, transparent 60%),
          radial-gradient(ellipse 380px 80px at 45% 85%, rgba(50,70,110,0.4) 0%, transparent 60%),
          radial-gradient(ellipse 280px 50px at 78% 75%, rgba(70,90,130,0.3) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
      }} />
      {/* 月亮 */}
      <div style={{
        position: 'absolute', top: '8%', right: '6%',
        width: 72, height: 72, borderRadius: '50%',
        background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
        boxShadow: '0 0 60px rgba(216,224,240,0.3)',
        pointerEvents: 'none',
      }} />
      {/* 星点 */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(circle at 5% 18%, #fff 0.8px, transparent 2px),
          radial-gradient(circle at 15% 8%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 28% 22%, #e8f0ff 0.7px, transparent 1.8px),
          radial-gradient(circle at 42% 12%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 58% 25%, #e8f0ff 0.8px, transparent 2px),
          radial-gradient(circle at 72% 15%, #fff 0.6px, transparent 1.5px),
          radial-gradient(circle at 88% 28%, #fff 0.7px, transparent 1.8px)
        `,
        pointerEvents: 'none',
      }} />
    </>
  );
}
