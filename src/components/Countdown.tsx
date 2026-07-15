import { useState, useEffect, useRef } from 'react';
import { STAGE_TIMEBOX } from '../play/types';
import { fontFamilies, paperTheme } from '../theme';

const { text: PAPER_TEXT } = paperTheme;

interface CountdownProps {
  paused: boolean;
  onZero: () => void;
  // 变化时复位到 STAGE_TIMEBOX——用 `${level}-${stage.correct.length}` 让每答一题都重置
  resetKey?: string | number;
}

// 倒计时自管 secondsLeft，每秒触发的是本组件的 setState，不再让父级（含九宫格 /
// 4 选项 grid）跟着重渲染。onZero 用 ref 包，父级每次渲染传新闭包也不会重启定时器。
export function Countdown({ paused, onZero, resetKey }: CountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;

  useEffect(() => {
    setSecondsLeft(STAGE_TIMEBOX);
  }, [resetKey]);

  useEffect(() => {
    if (paused) return;
    if (secondsLeft <= 0) {
      onZeroRef.current();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, paused]);

  return (
    <div style={{
      color: PAPER_TEXT,
      fontFamily: fontFamilies.chinese,
      fontSize: 16,
      letterSpacing: 2,
    }}>⏱ {secondsLeft}s</div>
  );
}
