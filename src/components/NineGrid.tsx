import { fontFamilies } from '../theme';

interface Props {
  chars: string[];           // 12 字块
  blankCount: number;        // 需要填几个字
  filled: string[];          // 已填字符（按点击顺序）
  onChar: (c: string, idx: number) => void;   // 点击某字块
  onUndo: () => void;
}

export function NineGrid({ chars, blankCount, filled, onChar, onUndo }: Props) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* 填字区 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {Array.from({ length: blankCount }).map((_, i) => (
          <div key={i} style={{
            width: 48, height: 48,
            border: '2px solid #8b7355', borderRadius: 4,
            background: filled[i] ? '#f5ebd2' : 'transparent',
            color: '#000', fontFamily: fontFamilies.chinese,
            fontSize: 28, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{filled[i] ?? ''}</div>
        ))}
        <button
          onClick={onUndo}
          disabled={filled.length === 0}
          style={{
            marginLeft: 12, padding: '0 16px',
            background: 'transparent', color: '#8b7355',
            border: '1px solid #8b7355', borderRadius: 3,
            fontFamily: fontFamilies.chinese, fontSize: 14,
            cursor: filled.length === 0 ? 'default' : 'pointer',
            opacity: filled.length === 0 ? 0.4 : 1,
            height: 40,
          }}>退字</button>
      </div>

      {/* 12 字块 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {chars.map((c, idx) => {
          const disabled = filled.length >= blankCount;
          return (
            <button
              key={idx}
              onClick={() => onChar(c, idx)}
              disabled={disabled}
              style={{
                height: 56,
                background: 'transparent',
                border: '1px solid #8b7355', borderRadius: 3,
                color: '#000', fontFamily: fontFamilies.chinese,
                fontSize: 26, fontWeight: 700,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                transition: 'background 0.15s',
              }}>{c}</button>
          );
        })}
      </div>
    </div>
  );
}
