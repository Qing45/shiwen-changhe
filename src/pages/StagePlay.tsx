import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { NineGrid } from '../components/NineGrid';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { colors, fontFamilies } from '../theme';
import { pickStageQuestion, buildNineGrid } from '../play/engine';
import {
  beginStage,
  loadProgress,
  commitStageCorrect,
  commitStageBlood,
  markCleared,
  clearCurrent,
} from '../play/progress';
import { STAGE_GOAL, STAGE_BLOOD, STAGE_TIMEBOX, type Verse } from '../play/types';
import { KEYWORDS } from '../play/keywords';

type CharStatus = 'correct' | 'wrong' | null;

// 纸面配色（与 PoemPage 同源，仅本文件局部声明）
const PAPER_TEXT = '#000000';
const PAPER_TEXT_DIM = '#8b7355';
const PAPER_RED = '#a8302a';

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

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();
  const navigate = useNavigate();

  // 进入页面时初始化局：current 已是本关键字则续传，否则开新局
  const [stage, setStage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress();
    if (progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw).current;
  });

  // 从原文页返回时取出"已查看"的题面句，加进排除集，避免回到题面后又看到同一题
  const [viewedLine] = useState<string | null>(() => {
    if (!kw) return null;
    const v = sessionStorage.getItem(`feihuaStageViewed:${kw}`);
    if (v) {
      sessionStorage.removeItem(`feihuaStageViewed:${kw}`);
      return v;
    }
    return null;
  });

  // 已答对句集合（用于 pickStageQuestion 排除）
  const used = useMemo(() => {
    const s = new Set(stage?.correct ?? []);
    if (viewedLine) s.add(viewedLine);
    return s;
  }, [stage, viewedLine]);

  // 当前题目（可变：答对后切换下一题）
  const [question, setQuestion] = useState<{ verse: Verse; blanks: number[] } | null>(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used);
  });

  // 九宫格字块与玩家已填字符
  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  // filled 与 charStatus 长度恒等于 blanks.length；未填位为 null
  const [filled, setFilled] = useState<(string | null)[]>([]);
  const [charStatus, setCharStatus] = useState<CharStatus[]>([]);

  // 倒计时与判定期 lock：grading 期间禁止输入与重复判定
  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [grading, setGrading] = useState(false);

  // 结果页（通关 / 失败）
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct: string[] } | null>(
    null,
  );

  // 当 question 改变时重置 nineGrid、filled 与 charStatus
  useEffect(() => {
    if (question) {
      setNineGrid(buildNineGrid(question.verse.line, question.blanks));
      setFilled(Array(question.blanks.length).fill(null));
      setCharStatus(Array(question.blanks.length).fill(null));
    }
  }, [question]);

  // Esc 返回大厅但不调用 clearCurrent —— 保留进度供下次续传
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

  // 把最新 stage / question 通过 ref 暴露给 effect 内的 handler，避免闭包陈旧。
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  // React Router v6 同一 element 间导航不重挂载组件，
  // 通关跳到下一关键字时 useState 初始化函数不重跑。
  // 这里手动按 kw 重置全部 state，guard 避免挂载时重复 pickStageQuestion 引入随机闪烁。
  useEffect(() => {
    if (!kw) return;
    if (stageRef.current?.keyword === kw) return;
    const progress = loadProgress();
    const fresh =
      progress.current && progress.current.keyword === kw
        ? progress.current
        : beginStage(kw).current;
    setStage(fresh);
    setQuestion(pickStageQuestion(kw, new Set(fresh?.correct ?? [])));
    setResult(null);
    setGrading(false);
    setSecondsLeft(STAGE_TIMEBOX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw]);

  // 答对处理：记录、判定是否通关、否则切下一题
  const handleCorrect = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const line = questionRef.current.verse.line;
    const newCorrect = [...cur.correct, line];

    commitStageCorrect(kw, line);
    setStage(loadProgress().current);

    if (newCorrect.length >= STAGE_GOAL) {
      markCleared(kw);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    // 800ms 庆祝，然后切下一题并重置倒计时
    setGrading(true);
    setTimeout(() => {
      const nextUsed = new Set(newCorrect);
      setQuestion(pickStageQuestion(kw, nextUsed));
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 800);
  };

  // 答错 / 超时处理：扣血、判定是否失败、否则清空 filled 重答同一题
  const handleWrong = () => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood);
    setStage(loadProgress().current);

    if (newBlood <= 0) {
      clearCurrent();
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    // 1500ms 反馈，然后清空 filled、重置倒计时（不换题）
    setGrading(true);
    setTimeout(() => {
      setFilled(Array(questionRef.current?.blanks.length ?? 0).fill(null));
      setCharStatus([]);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
  };

  // 部分对：扣 1 血，1500ms 后保留 correct 位置的字、清掉 wrong 位置的字
  const handlePartialWrong = (status: ('correct' | 'wrong')[]) => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood);
    setStage(loadProgress().current);

    if (newBlood <= 0) {
      clearCurrent();
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    setTimeout(() => {
      setFilled((prev) => prev.map((c, i) => (status[i] === 'correct' ? c : null)));
      setCharStatus([]);
      setGrading(false);
    }, 1500);
  };

  // 查看原文：扣 1 血后跳转原文页；返回时把题面句加进排除集换新题。
  // blood <= 1 时禁用 —— 不允许玩家为了看原文而自杀。
  const handleViewOriginal = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    if (grading || result) return;
    if (stageRef.current.blood <= 1) return;

    const cur = stageRef.current;
    const newBlood = cur.blood - 1;
    const line = questionRef.current.verse.line;
    const poemId = questionRef.current.verse.poemId;

    commitStageBlood(kw, newBlood);
    sessionStorage.setItem(`feihuaStageViewed:${kw}`, line);
    setStage(loadProgress().current);
    navigate(`/poem/${poemId}`, { state: { from: `/play/stage/${kw}` } });
  };

  // 倒计时：每秒 -1，归零视为答错（超时扣血）。
  // 依赖 secondsLeft 自驱动；handler 读 ref 避免陈旧闭包。
  useEffect(() => {
    if (result) return; // 结果页停表
    if (secondsLeft <= 0) {
      handleWrong();
      return;
    }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, result]);

  const isFull = filled.length > 0 && filled.every((c) => c != null);

  // 提交：逐字比对，全对走 handleCorrect，有错走 handlePartialWrong
  const handleSubmit = () => {
    if (grading || !question || !isFull) return;
    const status: ('correct' | 'wrong')[] = question.blanks.map(
      (pos, i) => (question.verse.line[pos] === filled[i] ? 'correct' : 'wrong'),
    );
    setCharStatus(status);
    setGrading(true);
    if (status.every((s) => s === 'correct')) {
      handleCorrect();
    } else {
      handlePartialWrong(status);
    }
  };

  const handleChar = (c: string) => {
    if (grading) return;
    const emptyIdx = filled.findIndex((v) => v == null);
    if (emptyIdx === -1) return;
    setFilled((prev) => {
      const next = [...prev];
      next[emptyIdx] = c;
      return next;
    });
  };
  const handleUndo = () => {
    if (grading) return;
    let lastIdx = -1;
    for (let i = filled.length - 1; i >= 0; i--) {
      if (filled[i] != null) { lastIdx = i; break; }
    }
    if (lastIdx === -1) return;
    setFilled((prev) => {
      const next = [...prev];
      next[lastIdx] = null;
      return next;
    });
  };

  if (!kw || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  // 显示用挖空后的句子：blanks 位置渲染为 □，其余保留原字（含标点）
  const displayLine = question
    ? Array.from(question.verse.line)
        .map((ch, i) => (question.blanks.includes(i) ? '□' : ch))
        .join('')
    : '';

  // 末关判定：当前关已是 KEYWORDS 最后一关时不再显示「下一关」
  const kwIndex = KEYWORDS.indexOf(kw);
  const isLastKeyword = kwIndex < 0 || kwIndex + 1 >= KEYWORDS.length;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: isMobile ? '16px 12px' : '24px 28px' }}>
        {/* 返回大厅 */}
        <div style={{ marginBottom: 16 }}>
          <Link
            to="/play"
            style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}
          >
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

          {/* 关键字大字 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese,
              color: PAPER_TEXT,
              fontSize: isMobile ? 80 : 120,
              fontWeight: 700,
              lineHeight: 1,
              marginBottom: 8,
            }}>{kw}</div>
            <div style={{
              color: PAPER_TEXT_DIM,
              fontFamily: fontFamilies.chinese,
              fontSize: 14,
              letterSpacing: 6,
            }}>飞 花 · 关 键 字</div>
          </div>

          {/* 题目（挖空展示） */}
          <div style={{
            textAlign: 'center',
            padding: '24px 0',
            fontFamily: fontFamilies.chinese,
            color: PAPER_TEXT,
            fontSize: isMobile ? 24 : 32,
            letterSpacing: isMobile ? 3 : 6,
            lineHeight: 2,
          }}>
            {displayLine || '（题库已空）'}
          </div>
          {question && (
            <div style={{
              textAlign: 'center',
              color: PAPER_TEXT_DIM,
              fontFamily: fontFamilies.chinese,
              fontSize: 14,
              letterSpacing: 2,
              marginBottom: 16,
            }}>
              出自《{question.verse.poemTitle}》· {question.verse.poetName}
            </div>
          )}

          {/* 九宫格输入 */}
          <div style={{ marginTop: 40 }}>
            {nineGrid && (
              <NineGrid
                chars={nineGrid.chars}
                blankCount={nineGrid.blankCount}
                filled={filled}
                charStatus={charStatus}
                onChar={handleChar}
                onUndo={handleUndo}
              />
            )}
          </div>

          {/* 提交按钮 */}
          {nineGrid && (
            <div style={{ marginTop: 24, textAlign: 'center' }}>
              <button
                onClick={handleSubmit}
                disabled={!isFull || grading}
                style={{
                  ...btnStyle,
                  padding: '10px 36px',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 6,
                  opacity: !isFull || grading ? 0.4 : 1,
                  cursor: !isFull || grading ? 'default' : 'pointer',
                }}
              >提 交</button>
            </div>
          )}

          {/* 结果遮罩（通关 / 失败） */}
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
                    ? `已答出 ${result.correct.length} 句含「${kw}」的诗`
                    : '血尽于此，下次再来'}
                </div>
                <div style={{
                  display: 'flex', gap: 16,
                  animation: 'feihuaFadeUp 400ms ease-out 420ms both',
                }}>
                  <button
                    onClick={() => {
                      if (result.kind === 'failed') clearCurrent();
                      navigate('/play');
                    }}
                    style={btnStyle}
                  >
                    返回大厅
                  </button>
                  {result.kind === 'cleared' && !isLastKeyword && (
                    <button
                      onClick={() => navigate(`/play/stage/${KEYWORDS[kwIndex + 1]}`)}
                      style={btnStyle}
                    >
                      下一关
                    </button>
                  )}
                  {result.kind === 'cleared' && isLastKeyword && (
                    <div style={{
                      color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                      fontSize: 14, alignSelf: 'center', letterSpacing: 4,
                  }}>
                    全 部 通 关
                  </div>
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
