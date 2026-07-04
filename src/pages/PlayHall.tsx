// 飞花令大厅：50 字关卡地图。三档分组（入门 10 / 进阶 20 / 高阶 20），按通关进度渲染印章状态。
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { KeywordSeal } from '../components/KeywordSeal';
import { KEYWORDS, KEYWORD_GROUPS } from '../play/keywords';
import { loadProgress } from '../play/progress';
import { colors, fontFamilies } from '../theme';

const GROUP_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

export function PlayHall() {
  const progress = loadProgress();
  const totalCleared = progress.cleared.length;

  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          background: colors.bgGradient,
          padding: '32px 28px 64px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* 标题 + 进度 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                fontFamily: fontFamilies.chinese,
                color: colors.textPrimary,
                fontSize: 32,
                letterSpacing: 12,
                marginBottom: 8,
                textShadow: '0 0 16px rgba(216,224,240,0.6)',
              }}
            >
              飞 花 令
            </div>
            <div
              style={{
                color: colors.textTertiary,
                fontFamily: fontFamilies.chinese,
                fontSize: 16,
                letterSpacing: 4,
              }}
            >
              已通 {totalCleared} / 50 关
            </div>
          </div>

          {/* 三档分组 */}
          {(['entry', 'mid', 'advanced'] as const).map((group) => (
            <div key={group} style={{ marginBottom: 36 }}>
              <div
                style={{
                  color: colors.textTertiary,
                  fontFamily: fontFamilies.chinese,
                  fontSize: 14,
                  letterSpacing: 6,
                  marginBottom: 14,
                  textAlign: 'center',
                }}
              >
                {GROUP_LABEL[group]}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, 64px)',
                  gap: 12,
                  justifyContent: 'center',
                }}
              >
                {KEYWORD_GROUPS[group].map((kw) => {
                  const globalIdx = KEYWORDS.indexOf(kw);
                  const state = stateOf(kw, globalIdx);
                  return (
                    <Link
                      key={kw}
                      to={state === 'locked' ? '#' : `/play/stage/${kw}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <KeywordSeal keyword={kw} state={state} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
