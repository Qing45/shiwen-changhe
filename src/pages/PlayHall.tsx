// 飞花令大厅：[单字] [整句] [整篇] 三种玩法 tab。
// 单字：关键字印章按三档递进解锁；总数随诗库自适应（小学库按年级端点累加）。
// 整句 / 整篇：按句长 / 池大小分档，关数随诗库自适应。

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { GradeSelector } from '../components/GradeSelector';
import { KeywordSeal } from '../components/KeywordSeal';
import { getCharKeywordGroups, getCharKeywords } from '../play/engine';
import { getAvailableLevelGroups, getTotalAvailableLevels } from '../play/couplets';
import { countAvailableTitleLevels } from '../play/titles';
import { loadProgress } from '../play/progress';
import { loadSentenceProgress } from '../play/sentenceProgress';
import { loadTitleProgress } from '../play/titleProgress';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus } from '../state/corpus';
import { loadGrade, saveGrade } from '../state/primaryGrade';
import { loadJuniorGrade, saveJuniorGrade } from '../state/juniorGrade';
import { loadSeniorGrade, saveSeniorGrade } from '../state/seniorGrade';
import { getAvailableBands, getAvailableJuniorBands, getAvailableSeniorBands } from '../data/grades';
import { colors, fontFamilies } from '../theme';
import { toChineseNum } from '../utils/number';

type Mode = 'char' | 'sentence' | 'title';

const GROUP_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

function EmptyState({ compact }: { compact: boolean }) {
  return (
    <div style={{
      textAlign: 'center',
      color: colors.textSecondary,
      fontFamily: fontFamilies.chinese,
      padding: compact ? '24px 0' : '36px 0',
    }}>
      本年级暂无关卡，请选更高年级
    </div>
  );
}

export function PlayHall() {
  const [mode, setMode] = useState<Mode>('char');
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const corpus = useCorpus();

  const isPrimary = corpus === 'primary';
  const isJunior = corpus === 'junior';
  const isSenior = corpus === 'senior';
  const [band, setBand] = useState(() => loadGrade());
  const [juniorBand, setJuniorBand] = useState(() => loadJuniorGrade());
  const [seniorBand, setSeniorBand] = useState(() => loadSeniorGrade());
  const activeBand = isPrimary ? band : isJunior ? juniorBand : isSenior ? seniorBand : undefined;
  // 总库（'all'）映射到底层 'both'，与引擎/数据层语料枚举一致。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;

  const onBandChange = (next: number) => {
    setBand(next);
    saveGrade(next);
  };

  const onJuniorBandChange = (next: string) => {
    setJuniorBand(next);
    saveJuniorGrade(next);
  };

  const onSeniorBandChange = (next: string) => {
    setSeniorBand(next);
    saveSeniorGrade(next);
  };

  const charProgress = loadProgress(corpus, activeBand);
  const sentenceProgress = loadSentenceProgress(corpus, activeBand);
  const titleProgress = loadTitleProgress(corpus, activeBand);

  const charGroups = getCharKeywordGroups(poemCorpus, activeBand);
  const charKeywords = getCharKeywords(poemCorpus, activeBand);
  const totalCharStages = charKeywords.length;
  const sentenceGroups = getAvailableLevelGroups(poemCorpus, activeBand);
  const totalSentenceStages = getTotalAvailableLevels(poemCorpus, activeBand);
  const totalTitleStages = countAvailableTitleLevels(poemCorpus, activeBand);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '20px 14px 48px' : '32px 28px 64px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* 标题 */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 16 : 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: isMobile ? 24 : 32, letterSpacing: isMobile ? 6 : 12, marginBottom: 8,
              textShadow: '0 0 16px rgba(216,224,240,0.6)',
            }}>
              飞 花 令
            </div>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: isMobile ? 13 : 16, letterSpacing: isMobile ? 2 : 4,
            }}>
              {mode === 'char'
                ? `单 字 · 拾 字 模 式 · 已通 ${charProgress.cleared.length} / ${totalCharStages} 关`
                : mode === 'sentence'
                ? `整 句 · 联 句 模 式 · 已通 ${sentenceProgress.cleared.length} / ${totalSentenceStages} 关`
                : `整 篇 · 识 名 模 式 · 已通 ${titleProgress.cleared.length} / ${totalTitleStages} 关`}
            </div>
            <div style={{
              marginTop: 6, color: '#8b7355', fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>
              当前诗库：{corpus === 'tang' ? '唐诗三百首' : corpus === 'primary' ? '小学必背' : corpus === 'junior' ? '初中必背' : corpus === 'senior' ? '高中必背' : '总库'}
            </div>
          </div>

          {isPrimary && (
            <GradeSelector
              bands={getAvailableBands()}
              value={band}
              onChange={onBandChange}
            />
          )}

          {isJunior && (
            <GradeSelector
              bands={getAvailableJuniorBands()}
              value={juniorBand}
              onChange={onJuniorBandChange}
            />
          )}

          {isSenior && (
            <GradeSelector
              bands={getAvailableSeniorBands()}
              value={seniorBand}
              onChange={onSeniorBandChange}
            />
          )}

          {/* 模式切换 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: isMobile ? 12 : 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: isMobile ? 20 : 32,
          }}>
            <ModeTabButton label="单字 · 拾字" active={mode === 'char'} onClick={() => setMode('char')} compact={isMobile} />
            <ModeTabButton label="整句 · 联句" active={mode === 'sentence'} onClick={() => setMode('sentence')} compact={isMobile} />
            <ModeTabButton label="整篇 · 识名" active={mode === 'title'} onClick={() => setMode('title')} compact={isMobile} />
          </div>

          {mode === 'char' ? (
            totalCharStages === 0 ? <EmptyState compact={isMobile} /> :
            <CharModeBody progress={charProgress} compact={isMobile} groups={charGroups} charKeywords={charKeywords} />
          ) : mode === 'sentence' ? (
            totalSentenceStages === 0 ? <EmptyState compact={isMobile} /> :
            <SentenceModeBody progress={sentenceProgress} compact={isMobile} sentenceGroups={sentenceGroups} />
          ) : (
            totalTitleStages === 0 ? <EmptyState compact={isMobile} /> :
            <TitleModeBody progress={titleProgress} compact={isMobile} titleGroups={deriveTitleGroups(totalTitleStages, isPrimary)} />
          )}
        </div>
      </div>
    </div>
  );
}

// 根据 totalTitleStages 派生 entry/mid/advanced 三档分组。
// primary 库没有 advanced 档（与历史布局对齐）。
function deriveTitleGroups(totalTitleStages: number, isPrimary: boolean): { tier: 'entry' | 'mid' | 'advanced'; start: number; end: number; count: number }[] {
  return [
    { tier: 'entry' as const, start: 1, end: Math.min(10, totalTitleStages), count: Math.min(10, totalTitleStages) },
    { tier: 'mid' as const, start: 11, end: Math.min(30, totalTitleStages), count: Math.max(0, Math.min(20, totalTitleStages - 10)) },
    { tier: 'advanced' as const, start: 31, end: totalTitleStages, count: Math.max(0, totalTitleStages - 30) },
  ].filter((g) => g.count > 0 && (!isPrimary || g.tier !== 'advanced'));
}

function CharModeBody({ progress, compact, groups, charKeywords }: {
  progress: ReturnType<typeof loadProgress>;
  compact: boolean;
  groups: { tier: 'entry' | 'mid' | 'advanced'; words: readonly string[] }[];
  charKeywords: readonly string[];
}) {
  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <>
      {groups.map(({ tier, words }) => (
        <div key={tier} style={{ marginBottom: compact ? 24 : 36 }}>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
          }}>
            {GROUP_LABEL[tier]}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: compact
              ? 'repeat(auto-fill, minmax(52px, 1fr))'
              : 'repeat(10, 64px)',
            gap: compact ? 8 : 12, justifyContent: 'center',
            maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
          }}>
            {words.map((kw) => {
              const globalIdx = charKeywords.indexOf(kw);
              const state = stateOf(kw, globalIdx);
              return (
                <Link key={kw} to={state === 'locked' ? '#' : `/play/stage/${kw}`}
                  style={{ textDecoration: 'none' }}>
                  <KeywordSeal keyword={kw} state={state} compact={compact} />
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function SentenceModeBody({ progress, compact, sentenceGroups }: {
  progress: ReturnType<typeof loadSentenceProgress>;
  compact: boolean;
  sentenceGroups: { tier: 'entry' | 'mid' | 'advanced'; start: number; end: number; count: number }[];
}) {
  const stateOf = (level: number): 'cleared' | 'current' | 'locked' => {
    const key = String(level);
    if (progress.cleared.includes(key)) return 'cleared';
    if (level - 1 === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <>
      {sentenceGroups.map(({ tier, start, count }) => {
        const levels = Array.from({ length: count }, (_, i) => start + i);
        return (
          <div key={tier} style={{ marginBottom: compact ? 24 : 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[tier]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact
                ? 'repeat(auto-fill, minmax(52px, 1fr))'
                : 'repeat(10, 64px)',
              gap: compact ? 8 : 12, justifyContent: 'center',
              maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
            }}>
              {levels.map((lv) => {
                const state = stateOf(lv);
                return (
                  <Link key={lv} to={state === 'locked' ? '#' : `/play/sentence/${lv}`}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={toChineseNum(lv)} state={state} compact={compact} />
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

function TitleModeBody({ progress, compact, titleGroups }: {
  progress: ReturnType<typeof loadTitleProgress>;
  compact: boolean;
  titleGroups: { tier: 'entry' | 'mid' | 'advanced'; start: number; end: number; count: number }[];
}) {
  const stateOf = (level: number): 'cleared' | 'current' | 'locked' => {
    const key = String(level);
    if (progress.cleared.includes(key)) return 'cleared';
    if (level - 1 === progress.unlockedIndex) return 'current';
    return 'locked';
  };

  return (
    <>
      {titleGroups.map(({ tier, start, count }) => {
        const levels = Array.from({ length: count }, (_, i) => start + i);
        return (
          <div key={tier} style={{ marginBottom: compact ? 24 : 36 }}>
            <div style={{
              color: colors.textTertiary, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6, marginBottom: 14, textAlign: 'center',
            }}>
              {GROUP_LABEL[tier]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: compact
                ? 'repeat(auto-fill, minmax(52px, 1fr))'
                : 'repeat(10, 64px)',
              gap: compact ? 8 : 12, justifyContent: 'center',
              maxWidth: compact ? 360 : undefined, margin: compact ? '0 auto' : undefined,
            }}>
              {levels.map((lv) => {
                const state = stateOf(lv);
                return (
                  <Link key={lv} to={state === 'locked' ? '#' : `/play/title/${lv}`}
                    style={{ textDecoration: 'none' }}>
                    <KeywordSeal keyword={toChineseNum(lv)} state={state} compact={compact} />
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

function ModeTabButton({ label, active, onClick, compact }: { label: string; active: boolean; onClick: () => void; compact: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: compact ? '10px 6px' : '12px 8px',
        marginBottom: -1,
        fontFamily: fontFamilies.chinese,
        fontSize: compact ? 14 : 18,
        letterSpacing: compact ? 2 : 4,
        color: active ? colors.textPrimary : colors.textTertiary,
        borderBottom: active ? '2px solid #d4af6a' : '2px solid transparent',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
