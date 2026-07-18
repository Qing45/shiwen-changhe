import { memo, useState, type ReactNode, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { colors, fontFamilies } from '../theme';

// 三 River 页（RiverPage / PoemsRiverPage / PoetPage）的节点 JSX 原本各重复一份
// ~100 行，结构骨架完全相同，只在 variant（poet/poem）、enablePress、tooltip 内容
// 等少量字段上不同。这里抽成单一组件，行为字节级保持一致。
//
// 动画 keyframes（node-float / focal-pulse / fade-in）在 src/styles.css 全局定义，
// 本组件不再内联。
//
// React.memo 自定义 comparator：忽略 tooltip / state / onVisited —— 它们只在交互
// 时（hover / 点击）使用，每次 render 由父组件生成新引用（inline JSX）但不影响可见
// 输出。父组件传入的 `id` 是稳定的，所以 tooltip/state/onVisited 内容天然唯一。
type RiverNodeProps = {
  id: string;
  to: string;
  state?: object;
  label: string;
  size: number;
  textFontSize: number;
  isFocal: boolean;
  isVisited: boolean;
  tooltip: ReactNode;
  x: number;            // % 水平定位
  y: number;            // % 相对垂直中线的偏移
  variant: 'poet' | 'poem';
  enablePress?: boolean;       // 默认 true；PoetPage 子河传 false
  visible?: boolean;           // 默认 true；视口裁剪用
  floatDuration: number;
  floatDelay: number;
  dragMovedRef: RefObject<boolean>;
  onVisited?: () => void;
};

function RiverNodeInner({
  id,
  to,
  state,
  label,
  size,
  textFontSize,
  isFocal,
  isVisited,
  tooltip,
  x,
  y,
  variant,
  enablePress = true,
  visible = true,
  floatDuration,
  floatDelay,
  dragMovedRef,
  onVisited,
}: RiverNodeProps) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);

  // 视口外节点：渲染 1×1 占位 div 保持 canvas 尺寸稳定，避免回流抖动。
  // 不挂 Link/tooltip，参与 canvas 布局但不消耗交互 / 渲染成本。
  if (!visible) {
    return (
      <div style={{
        position: 'absolute',
        top: `calc(50% + ${y}%)`,
        left: `${x}%`,
        transform: 'translate(-50%, -50%)',
        width: 1, height: 1, pointerEvents: 'none',
      }} />
    );
  }

  const isPoet = variant === 'poet';
  const highlightCore = isVisited ? '#d8e0f0' : '#fff';
  // variant 差异集中在此处：poet 字号大、letterSpacing 宽、boxShadow 略亮；
  // poem 字号小、有 maxWidth/居中、boxShadow 略暗。
  const boxShadow = isFocal
    ? `0 0 ${size}px rgba(216,224,240,0.9), 0 0 ${isPoet ? 6 : 4}px #fff`
    : `0 0 ${size}px rgba(216,224,240,${isPoet ? 0.7 : 0.6})`;
  const focalTextShadow = isPoet
    ? '0 0 14px rgba(216,224,240,0.8), 0 0 4px #fff'
    : '0 0 12px rgba(216,224,240,0.8)';
  const nonFocalTextShadow = isPoet
    ? '0 0 6px rgba(216,224,240,0.4)'
    : 'none';

  return (
    <Link
      to={to}
      state={state}
      onClickCapture={(e) => {
        // pan/zoom 拖动误触 Link 跳转 —— dragMovedRef 标记则吞掉 click。
        if (dragMovedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={() => onVisited?.()}
      style={{
        position: 'absolute',
        top: `calc(50% + ${y}%)`,
        left: `${x}%`,
        transform: 'translate(-50%, -50%)',
        textDecoration: 'none',
      }}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          setHover(false);
          if (enablePress) setPressed(false);
        }}
        onMouseDown={enablePress ? () => setPressed(true) : undefined}
        onMouseUp={enablePress ? () => setPressed(false) : undefined}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: `node-float ${floatDuration}s ease-in-out ${floatDelay}s infinite`,
          position: 'relative',
          transition: enablePress ? 'transform 0.1s' : undefined,
          transform: enablePress && pressed ? 'scale(0.92)' : undefined,
          cursor: enablePress ? 'pointer' : undefined,
        }}
      >
        <div style={{ position: 'relative' }}>
          <div style={{
            color: isFocal ? '#fff' : colors.textPrimary,
            fontFamily: fontFamilies.chinese,
            fontSize: textFontSize,
            textShadow: isFocal ? focalTextShadow : nonFocalTextShadow,
            marginBottom: isPoet ? 8 : 6,
            fontWeight: isFocal ? 600 : undefined,
            letterSpacing: isFocal ? (isPoet ? 4 : 2) : undefined,
            ...(isPoet ? {} : {
              maxWidth: 120,
              lineHeight: 1.3,
              textAlign: 'center' as const,
              whiteSpace: 'normal' as const,
            }),
          }}>{label}</div>
          {isFocal && (
            <div style={{
              position: 'absolute', top: '100%', left: '15%', right: '15%',
              height: 1, marginTop: 2,
              background: 'linear-gradient(90deg, transparent, rgba(216,224,240,0.7), transparent)',
            }} />
          )}
        </div>
        <div style={{
          position: 'relative',
          width: size, height: size, borderRadius: '50%',
          background: `radial-gradient(circle, ${highlightCore} 0%, #d8e0f0 60%, transparent 100%)`,
          border: '1px solid rgba(216,224,240,0.45)',
          boxShadow,
          animation: isFocal ? 'focal-pulse 3.2s ease-in-out infinite' : 'none',
        }}>
          <div style={{
            position: 'absolute', inset: '25%',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9) 0%, transparent 60%)',
          }} />
        </div>
        {hover && (
          <div style={{
            position: 'absolute', bottom: '100%', left: '50%',
            transform: 'translate(-50%, -12px)',
            background: 'rgba(8,12,28,0.92)',
            border: '1px solid rgba(216,224,240,0.25)',
            borderRadius: 4, padding: 8,
            whiteSpace: 'nowrap',
            color: colors.textPrimary, fontSize: 12,
            fontFamily: fontFamilies.chinese,
            pointerEvents: 'none', zIndex: 10,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            {tooltip}
            <div style={{
              position: 'absolute', bottom: -5, left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 8, height: 8,
              background: 'rgba(8,12,28,0.92)',
              borderRight: '1px solid rgba(216,224,240,0.25)',
              borderBottom: '1px solid rgba(216,224,240,0.25)',
            }} />
          </div>
        )}
      </div>
    </Link>
  );
}

// 比较可见/动画/几何相关 prop。tooltip / state / onVisited 仅在交互时使用，
// 父组件 inline 生成但不影响渲染输出，故忽略。
function areRiverNodePropsEqual(prev: RiverNodeProps, next: RiverNodeProps): boolean {
  return (
    prev.id === next.id &&
    prev.to === next.to &&
    prev.label === next.label &&
    prev.size === next.size &&
    prev.textFontSize === next.textFontSize &&
    prev.isFocal === next.isFocal &&
    prev.isVisited === next.isVisited &&
    prev.x === next.x &&
    prev.y === next.y &&
    prev.variant === next.variant &&
    prev.enablePress === next.enablePress &&
    prev.visible === next.visible &&
    prev.floatDuration === next.floatDuration &&
    prev.floatDelay === next.floatDelay &&
    prev.dragMovedRef === next.dragMovedRef
  );
}

export const RiverNode = memo(RiverNodeInner, areRiverNodePropsEqual);
