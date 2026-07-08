import { fontFamilies } from '../theme';

type CharStatus = 'correct' | 'wrong' | null;

interface Props {
  chars: string[];                              // 12 字块
  blankCount: number;                           // 需要填几个字
  filled: (string | null)[];                    // 每个填字位的字（按位序，未填为 null）
  charStatus?: CharStatus[];                    // 每个填字位的判定结果，用于染色
  onChar: (c: string, idx: number) => void;     // 点击某字块
  onUndo: () => void;
}

const SLOT_BG: Record<NonNullable<CharStatus>, string> = {
  correct: '#4a7c4a',
  wrong: '#a8302a',
};

export function NineGrid({ chars, blankCount, filled, charStatus, onChar, onUndo }: Props) {
  const filledCount = filled.filter((c) => c != null).length;
  const full = filledCount >= blankCount;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* 填字区 */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        {Array.from({ length: blankCount }).map((_, i) => {
          const status = charStatus?.[i] ?? null;
          const bg = status ? SLOT_BG[status] : (filled[i] ? '#f5ebd2' : 'transparent');
          const color = status ? '#f5ebd2' : '#000';
          return (
            <div key={i} style={{
              width: 48, height: 48,
              border: '2px solid #8b7355', borderRadius: 4,
              background: bg,
              color, fontFamily: fontFamilies.chinese,
              fontSize: 28, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}>{filled[i] ?? ''}</div>
          );
        })}
        <button
          onClick={onUndo}
          disabled={filledCount === 0}
          style={{
            marginLeft: 12, padding: '0 16px',
            background: 'transparent', color: '#8b7355',
            border: '1px solid #8b7355', borderRadius: 3,
            fontFamily: fontFamilies.chinese, fontSize: 14,
            cursor: filledCount === 0 ? 'default' : 'pointer',
            opacity: filledCount === 0 ? 0.4 : 1,
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
          const disabled = full;
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
