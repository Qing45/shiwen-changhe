// 4 选 1 输入板（含右上角倒计时）。
// 支持 1/2/3/4 个选项（少于 4 时按实际数显示）。

import { fontFamilies } from '../theme';
import type { Verse } from '../play/types';

interface Props {
  verses: Verse[];              // 1-4 句
  secondsLeft: number;          // 显示在右上角
  onSelect: (verse: Verse) => void;
  disabled?: boolean;           // AI 回合时锁定
}

const LABELS = ['A', 'B', 'C', 'D'];

export function ChoiceBoard({ verses, secondsLeft, onSelect, disabled = false }: Props) {
  return (
    <div style={{ position: 'relative' }}>
      {/* 右上角倒计时 */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          right: 0,
          color: secondsLeft <= 10 ? '#a8302a' : '#000',
          fontFamily: fontFamilies.chinese,
          fontSize: 18,
          fontWeight: 700,
        }}
      >
        ⏱ {secondsLeft}s
      </div>

      {/* 2x2 grid（不足 4 行后留空）*/}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 16,
        }}
      >
        {LABELS.map((label, i) => {
          const v = verses[i];
          if (!v) {
            return (
              <div
                key={label}
                style={{
                  padding: 16,
                  border: '1px dashed rgba(139,115,85,0.3)',
                  borderRadius: 4,
                  minHeight: 64,
                }}
              />
            );
          }
          return (
            <button
              key={label}
              onClick={() => onSelect(v)}
              disabled={disabled}
              style={{
                padding: 16,
                background: disabled ? 'rgba(0,0,0,0.04)' : 'transparent',
                border: '1px solid #8b7355',
                borderRadius: 4,
                color: '#000',
                fontFamily: fontFamilies.chinese,
                fontSize: 16,
                textAlign: 'left',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'background 0.15s',
              }}
            >
              <span style={{ marginRight: 8, fontWeight: 700 }}>{label}.</span>
              {v.line}
              <div style={{ fontSize: 12, color: '#8b7355', marginTop: 4 }}>
                《{v.poemTitle}》· {v.poetName}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
