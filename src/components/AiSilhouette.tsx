// AI 三个难度对应的水墨剪影（80×120 SVG）。
// 三个 path 用极简几何勾出人形剪影，单色填充 + 半透明。
// 开放问题（spec §12）：具体曲线在 plan 阶段定稿后微调，这里先放可用版本。

import type { Difficulty } from '../play/types';

interface Props {
  difficulty: Difficulty;
}

const W = 80;
const H = 120;

export function AiSilhouette({ difficulty }: Props) {
  if (difficulty === 'qingdeng') {
    // 青灯：书生提灯背影（头 + 肩 + 提灯手臂）
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <g fill="#1a1a2e" opacity="0.85">
          {/* 头 */}
          <circle cx={W / 2} cy={18} r={10} />
          {/* 肩身 */}
          <path d={`M ${W / 2 - 18} ${H - 8} L ${W / 2 - 18} ${36} Q ${W / 2} ${28} ${W / 2 + 18} ${36} L ${W / 2 + 18} ${H - 8} Z`} />
          {/* 左手提灯（圆 + 杆） */}
          <line x1={W / 2 - 16} y1={50} x2={W / 2 - 26} y2={70} stroke="#1a1a2e" strokeWidth={2} opacity="0.85" />
          <circle cx={W / 2 - 28} cy={74} r={6} opacity="0.85" />
          <circle cx={W / 2 - 28} cy={74} r={3} fill="#d4af6a" />
        </g>
      </svg>
    );
  }
  if (difficulty === 'mohe') {
    // 墨客：文士持卷侧坐（头 + 侧身 + 手展书卷）
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
        <g fill="#1a1a2e" opacity="0.85">
          <circle cx={42} cy={20} r={10} />
          <path d={`M 26 ${H - 8} L 26 ${36} Q 42 ${28} 58 ${36} L 58 ${H - 8} Z`} />
          {/* 手展书卷（前方矩形） */}
          <rect x={48} y={56} width={26} height={16} rx={1} />
        </g>
      </svg>
    );
  }
  // 诗圣：李白举杯（头微仰 + 站立身 + 举杯手）
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <g fill="#1a1a2e" opacity="0.85">
        <circle cx={W / 2} cy={18} r={10} />
        <path d={`M ${W / 2 - 16} ${H - 8} L ${W / 2 - 16} ${36} Q ${W / 2} ${28} ${W / 2 + 16} ${36} L ${W / 2 + 16} ${H - 8} Z`} />
        {/* 举杯右臂 */}
        <line x1={W / 2 + 14} y1={42} x2={W / 2 + 22} y2={28} stroke="#1a1a2e" strokeWidth={2} opacity="0.85" />
        <circle cx={W / 2 + 23} cy={26} r={4} fill="#d4af6a" />
      </g>
    </svg>
  );
}
