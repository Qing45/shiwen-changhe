// 飞花令 · 整篇识名模式。
// 题目展示诗正文（隐藏作者），4 个诗名选项多选。
// 多关卡递进解锁（30 / 50 关），血量 3 + 30s 倒计时。

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { countAvailableTitleLevels, pickTitleQuestion, type TitleQuestion } from '../play/titles';
import {
  loadTitleProgress, markTitleCleared, beginTitleStage,
  commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
} from '../play/titleProgress';
import { tierOfAvailableLevel } from '../play/couplets';
import { STAGE_BLOOD, STAGE_GOAL, STAGE_TIMEBOX } from '../play/types';
import { splitIntoLines } from '../utils/poemText';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus } from '../state/corpus';
import { colors, fontFamilies, paperTheme } from '../theme';
import { loadGrade } from '../state/primaryGrade';

const { text: PAPER_TEXT, textDim: PAPER_TEXT_DIM, green: PAPER_GREEN, red: PAPER_RED } = paperTheme;

const TIER_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: 'transparent',
  color: PAPER_TEXT,
  border: `1px solid ${PAPER_TEXT}`,
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

function toChineseNum(n: number): string {
  const digits = ['零','一','二','三','四','五','六','七','八','九','十'];
  if (n <= 10) return digits[n];
  if (n < 20) return '十' + digits[n - 10];
  if (n === 20) return '二十';
  if (n < 30) return '二十' + digits[n - 20];
  if (n === 30) return '三十';
  if (n < 40) return '三十' + digits[n - 30];
  if (n === 40) return '四十';
  if (n <= 50) return '四十' + digits[n - 40];
  return String(n);
}

export function TitlePlay() {
  const { level: levelParam } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const level = parseInt(levelParam ?? '', 10);

  const corpus = useCorpus();
  // 引擎/题库（titles.ts）接受 PoemCorpus，state 层 Corpus 含 'all'。
  // 'all' → 'both' 边界映射。进度函数接受 Corpus，仍传 raw corpus。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  // 仅 primary 库下生效的年级 band；tang 走 undefined 保持旧行为（byte-identical）。
  const activeBand = corpus === 'primary' ? loadGrade() : undefined;

  // 关数按 (corpus, band) 动态计算：tang 50、primary band=1 较小；依语料库变动。
  const totalLevels = countAvailableTitleLevels(poemCorpus, activeBand);
  const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
  const tier = validLevel ? tierOfAvailableLevel(level, poemCorpus, activeBand) : null;

  const levelKey = String(level);

  const [stage, setStage] = useState(() => {
    if (!validLevel) return null;
    const progress = loadTitleProgress(corpus, activeBand);
    if (progress.current && progress.current.keyword === levelKey) return progress.current;
    return beginTitleStage(levelKey, corpus, activeBand).current;
  });

  const usedPoemIdsRef = useRef<Set<string>>(
    new Set(stage ? (stage.correct ?? []) : []),
  );

  const [question, setQuestion] = useState<TitleQuestion | null>(() => {
    if (!validLevel) return null;
    return pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand);
  });

  const [picked, setPicked] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct?: string[] } | null>(null);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  // breakpoint 必须在所有 early return 之前调用（Rules of Hooks）
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  // 关卡切换时复位状态（同一 element 内导航不会重挂载）
  useEffect(() => {
    if (!validLevel) return;
    if (stageRef.current && stageRef.current.keyword === levelKey) return;
    const progress = loadTitleProgress(corpus, activeBand);
    const fresh =
      progress.current && progress.current.keyword === levelKey
        ? progress.current
        : beginTitleStage(levelKey, corpus, activeBand).current;
    setStage(fresh);
    usedPoemIdsRef.current = new Set(fresh ? (fresh.correct ?? []) : []);
    setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand));
    setPicked(null);
    setGrading(false);
    setSecondsLeft(STAGE_TIMEBOX);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

  // ESC 退出
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        navigate('/play');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  function handleCorrect() {
    if (!validLevel || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const poemId = questionRef.current.poemId;
    const newCorrect = [...cur.correct, poemId];

    commitTitleCorrect(levelKey, poemId, corpus, activeBand);
    setStage(loadTitleProgress(corpus, activeBand).current);
    usedPoemIdsRef.current = new Set(newCorrect);

    if (newCorrect.length >= STAGE_GOAL) {
      markTitleCleared(levelKey, corpus, activeBand);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  }

  function handleWrong() {
    if (!validLevel || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitTitleBlood(levelKey, newBlood, corpus, activeBand);
    setStage(loadTitleProgress(corpus, activeBand).current);

    if (newBlood <= 0) {
      clearTitleCurrent(corpus, activeBand);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand));
      setPicked(null);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
  }

  // 倒计时
  useEffect(() => {
    if (result || grading) return;
    if (secondsLeft <= 0) { handleWrong(); return; }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, grading]);

  function onPick(idx: number) {
    if (grading || picked !== null || !question) return;
    setPicked(idx);
    setGrading(true);
    const correct = question.options[idx].title === question.poemTitle;
    setTimeout(() => {
      if (correct) handleCorrect();
      else handleWrong();
    }, 500);
  }

  if (!validLevel || !stage) {
    return (
      <div style={{ padding: 40, color: colors.textPrimary }}>
        <div style={{ marginBottom: 16 }}>关卡不存在</div>
        <Link to="/play" aria-label="返回大厅" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>←</Link>
      </div>
    );
  }

  const isLastLevel = level >= totalLevels;

  const lines = question ? splitIntoLines(question.content, 'short') : [];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← 返回大厅</Link>
        </div>

        <PaperScroll>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
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

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
              fontSize: 24, letterSpacing: 8, marginBottom: 8,
            }}>第 {toChineseNum(level)} 关</div>
            <div style={{
              color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>{tier ? TIER_LABEL[tier] : ''} · 整 篇 识 名</div>
          </div>

          {question ? (
            <>
              <div style={{
                padding: '24px 0 16px',
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: isMobile ? 20 : 26, letterSpacing: isMobile ? 3 : 6, lineHeight: 2.2,
                textAlign: 'center',
              }}>
                {lines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12, maxWidth: 560, margin: '0 auto',
              }}>
                {question.options.map((opt, idx) => {
                  const isPicked = picked === idx;
                  const isAnswer = opt.title === question.poemTitle;
                  let bg = '#f5ebd2';
                  let border = `1px solid ${PAPER_TEXT_DIM}`;
                  let color = PAPER_TEXT;
                  if (grading && isAnswer) {
                    bg = PAPER_GREEN; border = `2px solid ${PAPER_GREEN}`; color = '#f5ebd2';
                  } else if (grading && isPicked && !isAnswer) {
                    bg = PAPER_RED; border = `2px solid ${PAPER_RED}`; color = '#f5ebd2';
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => onPick(idx)}
                      disabled={grading}
                      style={{
                        padding: '16px 12px',
                        background: bg,
                        border,
                        borderRadius: 4,
                        color,
                        fontFamily: fontFamilies.chinese,
                        fontSize: 18, letterSpacing: 3,
                        cursor: grading ? 'default' : 'pointer',
                        opacity: grading && !isPicked && !isAnswer ? 0.5 : 1,
                        transition: 'all 0.15s',
                      }}
                    >{opt.title}</button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{
              textAlign: 'center', padding: 40,
              fontFamily: fontFamilies.chinese, color: PAPER_TEXT_DIM, fontSize: 16,
            }}>题库已空</div>
          )}

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
                {result.kind === 'cleared' && question && (
                  <div style={{
                    color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                    fontSize: 16, marginBottom: 32,
                    animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                  }}>
                    《{question.poemTitle}》
                  </div>
                )}
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={() => {
                      if (result.kind === 'failed') clearTitleCurrent(corpus, activeBand);
                      navigate('/play');
                    }}
                    style={btnStyle}
                  >返回大厅</button>
                  {result.kind === 'cleared' && !isLastLevel && (
                    <button
                      onClick={() => navigate('/play/title/' + (level + 1))}
                      style={btnStyle}
                    >下一关</button>
                  )}
                  {result.kind === 'cleared' && isLastLevel && (
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
