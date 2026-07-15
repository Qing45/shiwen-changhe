// 飞花令 · 整句（联句）模式：50 关按句长分三档（入门 5 言 / 进阶 7 言 / 高阶混合）。
// 给出上句，4 选 1 接下句。30s 倒计时；同关答出 STAGE_GOAL 句通关。

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { getTotalAvailableLevels, pickLevelQuestion, tierOfAvailableLevel, type SentenceQuestion } from '../play/couplets';
import {
  beginSentenceStage,
  loadSentenceProgress,
  commitSentenceCorrect,
  commitSentenceBlood,
  markSentenceCleared,
  clearSentenceCurrent,
} from '../play/sentenceProgress';
import { STAGE_GOAL, STAGE_BLOOD } from '../play/types';
import { colors, fontFamilies, paperTheme } from '../theme';
import { useCorpus } from '../state/corpus';
import { loadGrade } from '../state/primaryGrade';
import { toChineseNum } from '../utils/number';

const TURN_SECONDS = 30;

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

export function SentencePlay() {
  const { level: levelParam } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const level = parseInt(levelParam ?? '', 10);

  const corpus = useCorpus();
  // 引擎/题库（couplets.ts）接受 PoemCorpus（'tang' | 'primary' | 'both'），
  // 而 state 层 Corpus 含 'all'。此处做一次边界映射：'all' → 'both'。
  // 进度函数（loadSentenceProgress 等）接受 Corpus，仍传 raw corpus —— 进度 key 自然后缀 :all。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  // 仅 primary 库下生效的年级 band；tang 走 undefined 保持旧行为（byte-identical）。
  const activeBand = corpus === 'primary' ? loadGrade() : undefined;

  // 关数按 (corpus, band) 动态计算：tang 50、primary band=1 至多 30（入门 10+进阶 20），依语料库变动。
  const totalLevels = getTotalAvailableLevels(poemCorpus, activeBand);
  const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
  const tier = validLevel ? tierOfAvailableLevel(level, poemCorpus, activeBand) : null;

  const levelKey = String(level);   // 进度存储用字符串 key

  const [stage, setStage] = useState(() => {
    if (!validLevel) return null;
    const progress = loadSentenceProgress(corpus, activeBand);
    if (progress.current && progress.current.keyword === levelKey) return progress.current;
    return beginSentenceStage(levelKey, corpus, activeBand).current;
  });

  // 从原文页返回时取出"已查看"的上句，加进排除集，避免回到题面后又看到同一题
  const [viewedUpperLine] = useState<string | null>(() => {
    if (!validLevel) return null;
    const v = sessionStorage.getItem(`feihuaSentenceViewed:${levelKey}`);
    if (v) {
      sessionStorage.removeItem(`feihuaSentenceViewed:${levelKey}`);
      return v;
    }
    return null;
  });

  const usedUpperRef = useRef<Set<string>>(
    new Set([...(stage?.correct ?? []), ...(viewedUpperLine ? [viewedUpperLine] : [])]),
  );

  const [question, setQuestion] = useState<SentenceQuestion | null>(() => {
    if (!tier) return null;
    return pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand);
  });

  const [picked, setPicked] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct: string[] } | null>(
    null,
  );

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  // React Router v6 同一 element 间导航不会重挂载组件，
  // 从 level N 通关跳到 level N+1 时 useState 初始化函数不再跑，
  // 这里手动按 levelKey 重置全部 state。
  // guard 避免挂载时重复 pickLevelQuestion 引入随机闪烁。
  useEffect(() => {
    if (!validLevel || !tier) return;
    if (stageRef.current?.keyword === levelKey) return;
    const progress = loadSentenceProgress(corpus, activeBand);
    const fresh =
      progress.current && progress.current.keyword === levelKey
        ? progress.current
        : beginSentenceStage(levelKey, corpus, activeBand).current;
    setStage(fresh);
    usedUpperRef.current = new Set(fresh?.correct ?? []);
    setQuestion(pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand));
    setPicked(null);
    setGrading(false);
    setSecondsLeft(TURN_SECONDS);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelKey]);

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

  const handleCorrect = () => {
    if (!validLevel || !tier || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const line = questionRef.current.answer.line;
    const newCorrect = [...cur.correct, line];

    commitSentenceCorrect(levelKey, line, corpus, activeBand);
    setStage(loadSentenceProgress(corpus, activeBand).current);
    usedUpperRef.current = new Set(newCorrect);

    if (newCorrect.length >= STAGE_GOAL) {
      markSentenceCleared(levelKey, corpus, activeBand);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand));
      setPicked(null);
      setSecondsLeft(TURN_SECONDS);
      setGrading(false);
    }, 800);
  };

  const handleWrong = () => {
    if (!validLevel || !tier || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitSentenceBlood(levelKey, newBlood, corpus, activeBand);
    setStage(loadSentenceProgress(corpus, activeBand).current);

    if (newBlood <= 0) {
      clearSentenceCurrent(corpus, activeBand);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand));
      setPicked(null);
      setSecondsLeft(TURN_SECONDS);
      setGrading(false);
    }, 1500);
  };

  // 查看原文：扣 1 血后跳转原文页；返回时把上句加进排除集换新题。
  // blood <= 1 时禁用 —— 不允许玩家为了看原文而自杀。
  const handleViewOriginal = () => {
    if (!validLevel || !tier || !questionRef.current || !stageRef.current) return;
    if (grading || result) return;
    if (stageRef.current.blood <= 1) return;

    const cur = stageRef.current;
    const newBlood = cur.blood - 1;
    const upperLine = questionRef.current.upper.line;
    const poemId = questionRef.current.upper.poemId;

    commitSentenceBlood(levelKey, newBlood, corpus, activeBand);
    sessionStorage.setItem(`feihuaSentenceViewed:${levelKey}`, upperLine);
    setStage(loadSentenceProgress(corpus, activeBand).current);
    navigate(`/poem/${poemId}`, { state: { from: `/play/sentence/${level}` } });
  };

  useEffect(() => {
    if (result || grading) return;
    if (secondsLeft <= 0) {
      handleWrong();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result, grading]);

  const onPick = (idx: number) => {
    if (grading || picked !== null || !question) return;
    setPicked(idx);
    setGrading(true);
    const correct = question.options[idx].line === question.answer.line;
    setTimeout(() => {
      if (correct) handleCorrect();
      else handleWrong();
    }, 500);
  };

  if (!validLevel || !stage) {
    return (
      <div style={{ padding: 40, color: colors.textPrimary }}>
        <div style={{ marginBottom: 16 }}>关卡不存在</div>
        <Link to="/play" aria-label="返回大厅" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>←</Link>
      </div>
    );
  }

  const isLastLevel = level >= totalLevels;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        <div style={{ marginBottom: 16 }}>
          <Link to="/play" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>
            ← 返回大厅
          </Link>
        </div>

        <PaperScroll>
          {/* 头部：血量（下方带「查看原文」按钮）+ 倒计时 + 进度 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
                {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
              </div>
              {question && (
                <button
                  onClick={handleViewOriginal}
                  disabled={grading || result !== null || stage.blood <= 1}
                  style={{
                    padding: '6px 0',
                    background: 'transparent',
                    border: 'none',
                    color: PAPER_RED,
                    fontFamily: fontFamilies.chinese,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 3,
                    cursor: grading || result !== null || stage.blood <= 1 ? 'default' : 'pointer',
                    opacity: grading || result !== null || stage.blood <= 1 ? 0.4 : 1,
                  }}
                >查看原文 · 扣 1 血</button>
              )}
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

          {/* 关卡序号 + 档位 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
              fontSize: 24, letterSpacing: 8, marginBottom: 8,
            }}>第 {toChineseNum(level)} 关</div>
            <div style={{
              color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
              fontSize: 14, letterSpacing: 6,
            }}>{TIER_LABEL[tier!]} · 整 句 联 句</div>
          </div>

          {/* 上句题面 */}
          {question ? (
            <>
              <div style={{
                textAlign: 'center', padding: '24px 0 12px',
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: isMobile ? 22 : 28, letterSpacing: isMobile ? 3 : 6, lineHeight: 1.5,
              }}>
                {question.upper.line}　？
              </div>
              <div style={{
                textAlign: 'center',
                color: PAPER_TEXT_DIM,
                fontFamily: fontFamilies.chinese,
                fontSize: 13,
                letterSpacing: 2,
                marginBottom: 16,
              }}>
                出自《{question.upper.poemTitle}》· {question.upper.poetName}
              </div>

              {/* 4 选 1 */}
              <div style={{
                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 12, maxWidth: 560, margin: '0 auto',
              }}>
                {question.options.map((opt, idx) => {
                  const isPicked = picked === idx;
                  const isAnswer = opt.line === question.answer.line;
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
                    >{opt.line}</button>
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

          {/* 结果遮罩 */}
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
                <div style={{
                  color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                  fontSize: 16, marginBottom: 32,
                  animation: 'feihuaFadeUp 400ms ease-out 240ms both',
                }}>
                  {result.kind === 'cleared'
                    ? `第 ${toChineseNum(level)} 关 · 已联出 ${result.correct.length} 句`
                    : '血尽于此，下次再来'}
                </div>
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={() => {
                      if (result.kind === 'failed') clearSentenceCurrent(corpus, activeBand);
                      navigate('/play');
                    }}
                    style={btnStyle}
                  >返回大厅</button>
                  {result.kind === 'cleared' && !isLastLevel && (
                    <button
                      onClick={() => navigate(`/play/sentence/${level + 1}`)}
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
