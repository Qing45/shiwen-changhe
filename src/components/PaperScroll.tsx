import type { ReactNode } from 'react';

const PAPER_BG = 'rgba(245, 235, 210, 0.85)';

interface Props {
  children: ReactNode;
}

// 卷轴外框：左右木轴 + 双金线 + 暖米黄底。
// 复用 PoemPage 的视觉语言，供 StagePlay / 后续页面共用。
export function PaperScroll({ children }: Props) {
  return (
    <div style={{
      maxWidth: 1100,
      margin: '0 auto',
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
    }}>
      {/* 左木轴 */}
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
      }} />
      {/* 纸面（含双金线） */}
      <div style={{
        position: 'relative',
        flex: 1,
        background: PAPER_BG,
        padding: '32px 40px',
      }}>
        {/* 双金线：内 1px 暗金，外 1px 亮金，4px 间距 */}
        <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />
        {children}
      </div>
      {/* 右木轴 */}
      <div style={{
        width: 10,
        background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
        boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}
