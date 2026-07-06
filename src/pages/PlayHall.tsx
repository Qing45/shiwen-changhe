// 飞花令大厅：双 tab（闯关 / 对战）。tab 状态用 URL ?tab=combat 持久化。

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { KeywordSeal } from '../components/KeywordSeal';
import { KEYWORDS, KEYWORD_GROUPS, FREE_KEYWORDS } from '../play/keywords';
import { loadProgress } from '../play/progress';
import { loadRecord } from '../play/record';
import { DIFFICULTY_META, type Difficulty } from '../play/types';
import { colors, fontFamilies } from '../theme';

const GROUP_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

const DIFFICULTY_ORDER: Difficulty[] = ['qingdeng', 'mohe', 'shisheng'];

function isDifficulty(s: string): s is Difficulty {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

export function PlayHall() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: 'stage' | 'combat' = rawTab === 'combat' ? 'combat' : 'stage';

  const setTab = (next: 'stage' | 'combat') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'stage') sp.delete('tab');
    else sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };

  const navigate = useNavigate();
  const progress = loadProgress();
  const record = loadRecord();
  const totalCleared = progress.cleared.length;

  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };

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
              已通 {totalCleared} / 50 关
            </div>
          </div>

          {/* Tab 切换条 */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 24,
            borderBottom: '1px solid rgba(216,224,240,0.15)',
            marginBottom: 32,
          }}>
            <TabButton label="闯关 · 飞花" active={tab === 'stage'} onClick={() => setTab('stage')} />
            <TabButton label="对战 · AI"   active={tab === 'combat'} onClick={() => setTab('combat')} />
          </div>

          {tab === 'stage' ? <StageTab /> : <CombatTab progress={progress} record={record} navigate={navigate} stateOf={stateOf} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '12px 8px',
        marginBottom: -1,                       // 抵掉父容器 border，让金线贴在底边
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

// ============ 闯关 Tab（已有逻辑）============
function StageTab() {
  const progress = loadProgress();
  const totalCleared = progress.cleared.length;
  const stateOf = (kw: string, idx: number): 'cleared' | 'current' | 'locked' => {
    if (progress.cleared.includes(kw)) return 'cleared';
    if (idx === progress.unlockedIndex) return 'current';
    return 'locked';
  };
  return (
    <>
      {/* 闯关 Tab 顶部小标题（已通总数已在父级显示，此处仅起视觉分隔）*/}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{
          color: colors.textTertiary, fontFamily: fontFamilies.chinese,
          fontSize: 13, letterSpacing: 4,
        }}>
          已通 {totalCleared} / 50 关 · 按三档递进解锁
        </div>
      </div>
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

// ============ 对战 Tab（新增）============
function CombatTab({
  progress,
  record,
  navigate,
  stateOf,
}: {
  progress: ReturnType<typeof loadProgress>;
  record: ReturnType<typeof loadRecord>;
  navigate: ReturnType<typeof useNavigate>;
  stateOf: (kw: string, idx: number) => 'cleared' | 'current' | 'locked';
}) {
  const allKeywords = useMemo(() => {
    const set = new Set<string>(FREE_KEYWORDS);
    for (const k of progress.cleared) set.add(k);
    return Array.from(set);
  }, [progress.cleared]);

  const defaultKw = allKeywords[0] ?? FREE_KEYWORDS[0];
  const [selectedKw, setSelectedKw] = useState<string>(defaultKw);
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('qingdeng');

  const canStart = isDifficulty(selectedDiff) && allKeywords.includes(selectedKw);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 关键字选择 */}
      <SectionTitle>关键字选择</SectionTitle>
      <SubLabel>自由字（任何时候可玩）</SubLabel>
      <KeywordRow keywords={[...FREE_KEYWORDS]} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />

      <SubLabel>已通关关键字（通关解锁）</SubLabel>
      {progress.cleared.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 13, padding: '12px 0' }}>
          尚无通关关键字
        </div>
      ) : (
        <KeywordRow keywords={progress.cleared} selected={selectedKw} onSelect={setSelectedKw} clearedSet={progress.cleared} />
      )}

      {/* 难度选择 */}
      <SectionTitle>AI 难度</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {DIFFICULTY_ORDER.map((d) => {
          const meta = DIFFICULTY_META[d];
          const active = selectedDiff === d;
          const stat = record[d];
          return (
            <button
              key={d}
              onClick={() => setSelectedDiff(d)}
              style={{
                padding: 16,
                background: active ? 'rgba(212,175,106,0.15)' : 'rgba(216,224,240,0.04)',
                border: `1px solid ${active ? '#d4af6a' : 'rgba(216,224,240,0.15)'}`,
                borderRadius: 4,
                color: active ? colors.textPrimary : colors.textSecondary,
                fontFamily: fontFamilies.chinese,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, letterSpacing: 4, marginBottom: 6 }}>{meta.label}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>
                漏答 {Math.round(meta.missRate * 100)}% · {(meta.thinkMs / 1000).toFixed(1)}s
              </div>
              <div style={{ fontSize: 11, color: colors.textDim, marginTop: 6 }}>
                战绩 {stat.win}胜 / {stat.lose}负
              </div>
            </button>
          );
        })}
      </div>

      {/* 开战按钮 */}
      <div style={{ textAlign: 'center' }}>
        <button
          disabled={!canStart}
          onClick={() => navigate(`/play/ai/${selectedKw}?difficulty=${selectedDiff}`)}
          style={{
            padding: '12px 48px',
            background: canStart ? 'transparent' : 'rgba(0,0,0,0.2)',
            color: canStart ? colors.textPrimary : colors.textDim,
            border: `1px solid ${canStart ? '#d4af6a' : 'rgba(216,224,240,0.1)'}`,
            borderRadius: 4,
            fontFamily: fontFamilies.chinese,
            fontSize: 18,
            letterSpacing: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
          }}
        >
          开 战
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      textAlign: 'center', color: colors.textTertiary,
      fontFamily: fontFamilies.chinese, fontSize: 14,
      letterSpacing: 6, marginTop: 32, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: colors.textDim, fontFamily: fontFamilies.chinese,
      fontSize: 12, letterSpacing: 3, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function KeywordRow({
  keywords, selected, onSelect, clearedSet,
}: {
  keywords: string[];
  selected: string;
  onSelect: (kw: string) => void;
  clearedSet: Set<string> | string[];
}) {
  const cleared = clearedSet instanceof Set ? clearedSet : new Set(clearedSet);
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
    }}>
      {keywords.map((kw) => {
        const active = selected === kw;
        const isCleared = cleared.has(kw);
        return (
          <button
            key={kw}
            onClick={() => onSelect(kw)}
            style={{
              width: 48, height: 48,
              background: active ? 'rgba(212,175,106,0.2)' : isCleared ? '#a8302a' : 'transparent',
              border: `1px solid ${active ? '#d4af6a' : isCleared ? '#7a1f15' : '#d4af6a'}`,
              borderRadius: 4,
              color: active ? colors.textPrimary : isCleared ? '#f5ebd2' : colors.textSecondary,
              fontFamily: fontFamilies.chinese,
              fontSize: 22, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {kw}
          </button>
        );
      })}
    </div>
  );
}
