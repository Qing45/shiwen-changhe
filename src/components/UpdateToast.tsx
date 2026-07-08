// 检测到 PWA 新版本时显示底部 Toast；用户点"刷新"才激活新 SW。
// 用 useState + useEffect 在 mount 时只 register 一次。
// 走 vite-plugin-pwa 的 virtual:pwa-register/react，build 产物里会内联 SW 注册逻辑。
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { colors, fontFamilies } from '../theme';

export function UpdateToast() {
  const [visible, setVisible] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    // 装好新 SW 后立刻停在这，等用户点刷新再 activate
    onRegisteredSW(_swUrl, _registration) {
      // no-op：useRegisterSW 内部已经处理了 polling 与 state
    },
    onRegisterError() {
      // SW 注册失败（本地 file:// 协议、HTTPS 缺失等）。开发期可以忽略。
    },
  });

  useEffect(() => {
    if (needRefresh) setVisible(true);
  }, [needRefresh]);

  // 关闭 offlineReady 提示（暂不展示，保留接口以便未来扩展）
  useEffect(() => {
    if (offlineReady) {
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes pwaUpdateIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 24,
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          background: '#1a2855',
          color: '#f5ebd2',
          border: '1px solid #d4af6a',
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          fontFamily: fontFamilies.chinese,
          fontSize: 14,
          letterSpacing: 2,
          maxWidth: 'calc(100vw - 32px)',
          animation: 'pwaUpdateIn 260ms ease-out both',
        }}
      >
        <span>新版本已就绪</span>
        <button
          onClick={() => updateServiceWorker(true)}
          style={{
            padding: '4px 12px',
            background: '#d4af6a',
            color: '#1a2855',
            border: 'none',
            borderRadius: 3,
            fontFamily: fontFamilies.chinese,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 2,
            cursor: 'pointer',
          }}
        >刷 新</button>
        <button
          onClick={() => {
            setVisible(false);
            setNeedRefresh(false);
          }}
          aria-label="关闭"
          style={{
            padding: '0 4px',
            background: 'transparent',
            color: '#d4af6a',
            border: 'none',
            fontFamily: fontFamilies.chinese,
            fontSize: 18,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >×</button>
      </div>
    </>
  );
}
