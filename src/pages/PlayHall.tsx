// 飞花令大厅：[单字] [整句] 两种玩法 tab。
// 单字：50 个关键字印章，三档递进解锁。
// 整句：50 关按句长分三档（入门 5 言 / 进阶 7 言 / 高阶混合），入口显示「第 N 关」。

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { KeywordSeal } from '../components/KeywordSeal';
import { KEYWORDS, KEYWORD_GROUPS } from '../play/keywords';
import { loadProgress } from '../play/progress';
import { loadSentenceProgress } from '../play/sentenceProgress';
import { colors, fontFamilies } from '../theme';

type Mode = 'char' | 'sentence';

const GROUP_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

const LEVEL_GROUPS: { tier: 'entry' | 'mid' | 'advanced'; range: [number, number] }[] = [
  { tier: 'entry', range: [1, 10] },
  { tier: 'mid', range: [11, 30] },
  { tier: 'advanced', range: [31, 50] },
];

const CN_DIGITS = ['零','一','二','三','四','五','六','七','八','九','十'];

function toChineseNum(n: number): string {
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return '十' + CN_DIGITS[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + CN_DIGITS[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + CN_DIGITS[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + CN_DIGITS[n - 40];
  return String(n);
}

export function PlayHall() {
  const [mode, setMode] = useState<Mode>('char');

  const charProgress = loadProgress();
  const sentenceProgress = loadSentenceProgress();

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '32px 28px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 32, letterSpacing: 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>
              飞 花 令
            </div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 16, letterSpacing: 4,
            }}>
              {mode === 'char'
                ? `单 字 · 拾 字 模 式 · 已通 ${charProgress.cleared.length} / 50 关`
                : `整 句 · 联 句 模 式 · 已通 ${sentenceProgress.cleared.length} / 50 关`}
            </div>
          </div>

          {/* 模式切换 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: 32,
          }}>
            <ModeTabButton label="单字 · 拾字" active={mode === 'char'} onClick={() => setMode('char')} />
            <ModeTabButton label="整句 · 联句" active={mode === 'sentence'} onClick={() => setMode('sentence')} />
          </div>

          {mode === 'char' ? (
            <CharModeBody progress={charProgress} />
          ) : (
            <SentenceModeBody progress={sentenceProgress} />
          )}
        </div>
      </div>
    </div>
  );
}

function CharModeBody({ progress }: { progress: ReturnType<typeof loadProgress> }) {
  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <>
      {(['entry', 'mid', 'advanced'] as const).map((group) => (
        <div key={group} style={{ marginBottom: 36 }}>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
          }}>
            {GROUP_LABEL[group]}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(10, 64px)',
            gap: 12, justifyContent: 'center',
          }}>
            {KEYWORD_GROUPS[group].map((kw) => {
              const globalIdx = KEYWORDS.indexOf(kw);
              const state = stateOf(kw, globalIdx);
              return (
                <Link key={kw} to={state === 'locked' ? '#' : `/play/stage/${kw}`}
                  style={{ textDecoration: 'none' }}>
                  <KeywordSeal keyword={kw} state={state} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function SentenceModeBody({ progress }: { progress: ReturnType<typeof loadSentenceProgress> }) {
  const stateOf = (level: number): 'cleared' | 'current' | 'locked' => {
    const key = String(level);
    if (progress.cleared.includes(key)) return 'cleared';
    if (level - 1 === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <>
      {LEVEL_GROUPS.map(({ tier, range }) => {
        const levels: number[] = [];
        for (let i = range[0]; i <= range[1]; i++) levels.push(i);
        return (
          <div key={tier} style={{ marginBottom: 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[tier]}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(10, 64px)',
              gap: 12, justifyContent: 'center',
            }}>
              {levels.map((lv) => {
                const state = stateOf(lv);
                return (
                  <Link key={lv} to={state === 'locked' ? '#' : `/play/sentence/${lv}`}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={toChineseNum(lv)} state={state} />
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

function ModeTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '12px 8px',
        marginBottom: -1,
        fontFamily: fontFamilies.chinese,
        fontSize: 18,
        letterSpacing: 4,
        color: active ? colors.textPrimary : colors.textTertiary,
        borderBottom: active ? '2px solid #d4af6a' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
