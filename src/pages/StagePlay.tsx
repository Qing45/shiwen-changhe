import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { NineGrid } from '../components/NineGrid';
import { colors, fontFamilies } from '../theme';
import { pickStageQuestion, buildNineGrid, validateStageInput } from '../play/engine';
import {
  beginStage,
  loadProgress,
  commitStageCorrect,
  commitStageBlood,
  markCleared,
} from '../play/progress';
import { STAGE_GOAL, STAGE_BLOOD, STAGE_TIMEBOX, type Verse } from '../play/types';
import { KEYWORDS } from '../play/keywords';

// 纸面配色（与 PoemPage 同源，仅本文件局部声明）
const PAPER_TEXT = '#000000';
const PAPER_TEXT_DIM = '#8b7355';

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

  // 已答对句集合（用于 pickStageQuestion 排除）
  const used = useMemo(() => new Set(stage?.correct ?? []), [stage]);

  // 当前题目（可变：答对后切换下一题）
  const [question, setQuestion] = useState<{ verse: Verse; blanks: number[] } | null>(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used);
  });

  // 九宫格字块与玩家已填字符
  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  const [filled, setFilled] = useState<string[]>([]);

  // 倒计时与判定期 lock：grading 期间禁止输入与重复判定
  const [secondsLeft, setSecondsLeft] = useState(STAGE_TIMEBOX);
  const [grading, setGrading] = useState(false);

  // 结果页（通关 / 失败）
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct: string[] } | null>(
    null,
  );

  // 当 question 改变时重置 nineGrid 与 filled
  useEffect(() => {
    if (question) {
      setNineGrid(buildNineGrid(question.verse.line, question.blanks));
      setFilled([]);
    }
  }, [question]);

  // 把最新 stage / question 通过 ref 暴露给 effect 内的 handler，避免闭包陈旧。
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;
  const gradingRef = useRef(grading);
  gradingRef.current = grading;

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
      setStage(loadProgress().current);
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
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    // 1500ms 反馈，然后清空 filled、重置倒计时（不换题）
    setGrading(true);
    setTimeout(() => {
      setFilled([]);
      setSecondsLeft(STAGE_TIMEBOX);
      setGrading(false);
    }, 1500);
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

  // 判定 effect：filled 填满后判定一次（grading flag 防止重复触发）
  useEffect(() => {
    if (grading) return;
    if (!question || filled.length !== question.blanks.length) return;
    const ok = validateStageInput(filled.join(''), question.verse.line, question.blanks);
    if (ok) handleCorrect();
    else handleWrong();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, question]);

  const handleChar = (c: string) => {
    if (grading) return;
    if (filled.length >= (question?.blanks.length ?? 0)) return;
    setFilled([...filled, c]);
  };
  const handleUndo = () => {
    if (grading) return;
    setFilled(filled.slice(0, -1));
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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' }}>
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
          {/* 头部：血量 + 倒计时 + 进度 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              ⏱ {secondsLeft}s
            </div>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 4 }}>
              {stage.correct.length} / {STAGE_GOAL}
            </div>
          </div>

          {/* 关键字大字 */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontFamily: fontFamilies.chinese,
              color: PAPER_TEXT,
              fontSize: 120,
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
            fontSize: 32,
            letterSpacing: 6,
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
                onChar={handleChar}
                onUndo={handleUndo}
              />
            )}
          </div>

          {/* 结果遮罩（通关 / 失败） */}
          {result && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(245,235,210,0.95)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: 40,
            }}>
              <div style={{
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: 48, letterSpacing: 12, marginBottom: 24,
              }}>{result.kind === 'cleared' ? '通 关' : '失 败'}</div>
              <div style={{
                color: PAPER_TEXT_DIM, fontFamily: fontFamilies.chinese,
                fontSize: 16, marginBottom: 32,
              }}>
                {result.kind === 'cleared'
                  ? `已答出 ${result.correct.length} 句含「${kw}」的诗`
                  : '血尽于此，下次再来'}
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button onClick={() => navigate('/play')} style={btnStyle}>返回大厅</button>
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
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
