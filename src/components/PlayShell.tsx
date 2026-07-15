import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TopNav } from './TopNav';
import { PaperScroll } from './PaperScroll';
import { Countdown } from './Countdown';
import { STAGE_BLOOD, STAGE_GOAL } from '../play/types';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { colors, fontFamilies, paperTheme } from '../theme';

const { text: PAPER_TEXT, textDim: PAPER_TEXT_DIM, red: PAPER_RED } = paperTheme;

// 通关/失败遮罩与 HUD 按钮共用——三 Play 页（StagePlay/SentencePlay/TitlePlay）
// 原本各自定义同一份；提到此处避免漂移。
export const playBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'transparent',
  color: PAPER_TEXT,
  border: `1px solid ${PAPER_TEXT}`,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

interface PlayShellProps {
  blood: number;
  correctCount: number;
  paused: boolean;
  onZero: () => void;
  resetKey?: string | number;
  // StagePlay/SentencePlay 在血量下方挂「查看原文」按钮；TitlePlay 不传
  bloodExtra?: ReactNode;
  result: { kind: 'cleared' | 'failed' } | null;
  // cleared / failed 副标题（如「《poemTitle》」「第 X 关 · 已联出 N 句」）
  resultSubtitle?: ReactNode;
  // failed 时点「返回大厅」会先调用此回调（清当前关进度）再 navigate('/play')
  onResultDismiss?: () => void;
  // cleared 且非最后关时传「/play/xxx/${next}」；最后关传 undefined 显示「全部通关」
  nextLevelUrl?: string;
  children: ReactNode;
}

export function PlayShell({
  blood,
  correctCount,
  paused,
  onZero,
  resetKey,
  bloodExtra,
  result,
  resultSubtitle,
  onResultDismiss,
  nextLevelUrl,
  children,
}: PlayShellProps) {
  const navigate = useNavigate();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const bloodBlock = bloodExtra ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
        {'❤'.repeat(blood)}{'♡'.repeat(STAGE_BLOOD - blood)}
      </div>
      {bloodExtra}
    </div>
  ) : (
    <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
      {'❤'.repeat(blood)}{'♡'.repeat(STAGE_BLOOD - blood)}
    </div>
  );

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← 返回大厅</Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            {bloodBlock}
            <Countdown paused={paused} onZero={onZero} resetKey={resetKey} />
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {correctCount} / {STAGE_GOAL}
            </div>
            <button
              onClick={() => navigate('/play')}
              style={{
                color: PAPER_TEXT,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 4,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >退 出</button>
          </div>

          {children}

          {result && (
            <>
              <style>{`
                @keyframes feihuaOverlayIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes feihuaStampDrop {
                  0%   { opacity: 0; transform: scale(0.4) rotate(-14deg); filter: blur(3px); }
                  55%  { opacity: 1; transform: scale(1.2) rotate(5deg); filter: blur(0); }
                  75%  { transform: scale(0.95) rotate(-2deg); }
                  100% { transform: scale(1) rotate(0); }
                }
                @keyframes feihuaFadeUp {
                  from { opacity: 0; transform: translateY(10px); }
                  to   { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'rgba(245,235,210,0.97)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center', padding: 40,
                animation: 'feihuaOverlayIn 260ms ease-out both',
              }}>
                <div style={{
                  fontFamily: fontFamilies.chinese,
                  color: result.kind === 'cleared' ? PAPER_RED : PAPER_TEXT,
                  fontSize: 64, letterSpacing: 16, marginBottom: 24,
                  textShadow: result.kind === 'cleared'
                    ? '0 0 32px rgba(168,48,42,0.35), 0 4px 12px rgba(0,0,0,0.08)'
                    : 'none',
                  animation: result.kind === 'cleared'
                    ? 'feihuaStampDrop 650ms cubic-bezier(.34,1.56,.64,1) both'
                    : 'feihuaFadeUp 500ms ease-out both',
                }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
                {result.kind === 'cleared' && resultSubtitle && (
                  <div style={{
                    color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                    fontSize: 16, marginBottom: 32,
                    animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                  }}>
                    {resultSubtitle}
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={() => {
                      if (result.kind === 'failed') onResultDismiss?.();
                      navigate('/play');
                    }}
                    style={playBtnStyle}
                  >返回大厅</button>
                  {result.kind === 'cleared' && nextLevelUrl && (
                    <button
                      onClick={() => navigate(nextLevelUrl)}
                      style={playBtnStyle}
                    >下一关</button>
                  )}
                  {result.kind === 'cleared' && !nextLevelUrl && (
                    <div style={{
                      color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                      fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                    }}>全 部 通 关</div>
                  )}
                </div>
              </div>
            </>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
