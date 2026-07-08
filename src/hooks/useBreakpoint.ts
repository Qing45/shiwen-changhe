import { useState, useEffect } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

// 手机 < 600，平板 600-899，桌面 ≥ 900。
// 跟 Tailwind 的 sm/md 阈值近似，CSS 一致。
const MOBILE_MAX = 599;
const TABLET_MAX = 899;

function compute(width: number): Breakpoint {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

/**
 * 返回当前视口断点（mobile | tablet | desktop），窗口尺寸变化时同步更新。
 * SSR 安全 —— 没有 window 时返回 'desktop'，避免水合不一致。
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return compute(window.innerWidth);
  });

  useEffect(() => {
    const onResize = () => setBp(compute(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return bp;
}
