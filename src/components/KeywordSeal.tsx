// 飞花令关卡印章。三态：cleared（朱红已通）/ current（金边脉冲当前关）/ locked（灰白问号）。
import { fontFamilies } from '../theme';

type SealState = 'cleared' | 'current' | 'locked';

interface Props {
  keyword: string;
  state: SealState;
  onClick?: () => void;
}

const SEAL_COLORS: Record<SealState, { bg: string; border: string; text: string; shadow: string }> = {
  cleared: { bg: '#a8302a', border: '#7a1f15', text: '#f5ebd2', shadow: '0 2px 8px rgba(168,48,42,0.4)' },
  current: { bg: '#a8302a', border: '#d4af6a', text: '#f5ebd2', shadow: '0 0 16px rgba(212,175,106,0.7)' },
  locked: { bg: 'rgba(216,224,240,0.08)', border: 'rgba(216,224,240,0.2)', text: 'rgba(216,224,240,0.3)', shadow: 'none' },
};

export function KeywordSeal({ keyword, state, onClick }: Props) {
  const c = SEAL_COLORS[state];
  const interactive = state !== 'locked';
  return (
    <button
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      style={{
        width: 64,
        height: 64,
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: 4,
        color: c.text,
        fontFamily: fontFamilies.chinese,
        fontSize: 32,
        fontWeight: 700,
        cursor: interactive ? 'pointer' : 'default',
        boxShadow: c.shadow,
        animation: state === 'current' ? 'focal-pulse 2s ease-in-out infinite' : undefined,
        transform: state === 'current' ? 'rotate(-3deg)' : 'none',
        transition: 'transform 0.15s',
      }}
    >
      {state === 'locked' ? '？' : keyword}
    </button>
  );
}
