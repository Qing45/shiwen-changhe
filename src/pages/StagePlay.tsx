import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PlayShell, playBtnStyle } from '../components/PlayShell';
import { NineGrid } from '../components/NineGrid';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { colors, fontFamilies, paperTheme } from '../theme';
import { pickStageQuestion, buildNineGrid, getCharKeywords } from '../play/engine';
import {
  beginStage,
  loadProgress,
  commitStageCorrect,
  commitStageBlood,
  markCleared,
  clearCurrent,
} from '../play/progress';
import { STAGE_GOAL, type Verse } from '../play/types';
import { useCorpus } from '../state/corpus';
import { loadGrade } from '../state/primaryGrade';
import { loadJuniorGrade } from '../state/juniorGrade';

type CharStatus = 'correct' | 'wrong' | null;

const { text: PAPER_TEXT, textDim: PAPER_TEXT_DIM, red: PAPER_RED } = paperTheme;

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();
  const navigate = useNavigate();
  const corpus = useCorpus();
  // 引擎/题库（engine.ts）接受 PoemCorpus（'tang' | 'primary' | 'both'），
  // 而 state 层 Corpus 含 'all'。此处做一次边界映射：'all' → 'both'。
  // 进度函数（loadProgress 等）接受 Corpus，仍传 raw corpus —— 进度 key 自然后缀 :all。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  // 仅 primary / junior 库下生效的年级 band；tang 走 undefined 保持旧行为（byte-identical）。
  const activeBand = corpus === 'primary' ? loadGrade() : corpus === 'junior' ? loadJuniorGrade() : undefined;

  // breakpoint 必须在所有 early return 之前调用（Rules of Hooks）
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  // 从原文页返回时取出"已查看"的题面句，加进排除集，避免回到题面后又看到同一题。
  // key 带 corpus+band 前缀，避免不同库下同关键字互相污染。
  // viewedKey 同时作为"刚从查看原文返回"的唯一信号 —— 仅此时续传 mid-level 进度，
  // 用户主动退出再进入一律开新局（progress.current 被 beginStage 覆盖）。
  const viewedKey = `feihuaStageViewed:${corpus}:${activeBand ?? ''}:${kw ?? ''}`;

  // 进入页面时初始化局：仅"从查看原文返回"时续传，其它情况一律开新局。
  // 用户语义：退出（Esc / 返回大厅）= 放弃 mid-level 进度。
  const [stage, setStage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress(corpus, activeBand);
    const isReturningFromView = sessionStorage.getItem(viewedKey) !== null;
    if (isReturningFromView && progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw, corpus, activeBand).current;
  });

  const [viewedLine] = useState<string | null>(() => {
    if (!kw) return null;
    const v = sessionStorage.getItem(viewedKey);
    if (v) {
      sessionStorage.removeItem(viewedKey);
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
    return pickStageQuestion(kw, used, poemCorpus, activeBand);
  });

  // 九宫格字块与玩家已填字符
  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  // filled 与 charStatus 长度恒等于 blanks.length；未填位为 null
  const [filled, setFilled] = useState<(string | null)[]>([]);
  const [charStatus, setCharStatus] = useState<CharStatus[]>([]);

  // 判定期 lock：grading 期间禁止输入与重复判定（倒计时由 PlayShell 暂停）
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
    const progress = loadProgress(corpus, activeBand);
    // 同 useState 初始化：仅"从查看原文返回"时续传，其它一律开新局。
    const isReturningFromView = sessionStorage.getItem(viewedKey) !== null;
    const fresh =
      isReturningFromView && progress.current && progress.current.keyword === kw
        ? progress.current
        : beginStage(kw, corpus, activeBand).current;
    setStage(fresh);
    setQuestion(pickStageQuestion(kw, new Set(fresh?.correct ?? []), poemCorpus, activeBand));
    setResult(null);
    setGrading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kw]);

  // 答对处理：记录、判定是否通关、否则切下一题
  const handleCorrect = () => {
    if (!kw || !questionRef.current || !stageRef.current) return;
    const cur = stageRef.current;
    const line = questionRef.current.verse.line;
    const newCorrect = [...cur.correct, line];

    commitStageCorrect(kw, line, corpus, activeBand);
    setStage(loadProgress(corpus, activeBand).current);

    if (newCorrect.length >= STAGE_GOAL) {
      markCleared(kw, corpus, activeBand);
      setResult({ kind: 'cleared', correct: newCorrect });
      return;
    }
    // 800ms 庆祝，然后切下一题（resetKey 变化 → Countdown 自动复位）
    setGrading(true);
    setTimeout(() => {
      const nextUsed = new Set(newCorrect);
      setQuestion(pickStageQuestion(kw, nextUsed, poemCorpus, activeBand));
      setGrading(false);
    }, 800);
  };

  // 答错 / 超时处理：扣血、判定是否失败、否则清空 filled 重答同一题
  const handleWrong = () => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood, corpus, activeBand);
    setStage(loadProgress(corpus, activeBand).current);

    if (newBlood <= 0) {
      clearCurrent(corpus, activeBand);
      setResult({ kind: 'failed', correct: cur.correct });
      return;
    }
    // 1500ms 反馈，然后清空 filled（resetKey 因 blood 变化 → Countdown 自动复位）
    setGrading(true);
    setTimeout(() => {
      setFilled(Array(questionRef.current?.blanks.length ?? 0).fill(null));
      setCharStatus([]);
      setGrading(false);
    }, 1500);
  };

  // 部分对：扣 1 血，1500ms 后保留 correct 位置的字、清掉 wrong 位置的字
  const handlePartialWrong = (status: ('correct' | 'wrong')[]) => {
    if (!kw || !stageRef.current) return;
    const cur = stageRef.current;
    const newBlood = cur.blood - 1;

    commitStageBlood(kw, newBlood, corpus, activeBand);
    setStage(loadProgress(corpus, activeBand).current);

    if (newBlood <= 0) {
      clearCurrent(corpus, activeBand);
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

    commitStageBlood(kw, newBlood, corpus, activeBand);
    sessionStorage.setItem(viewedKey, line);
    setStage(loadProgress(corpus, activeBand).current);
    navigate(`/poem/${poemId}`, { state: { from: `/play/stage/${kw}` } });
  };

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

  // 按 band 过滤后的关键字表（仅 primary 生效；tang 走默认 KEYWORDS）
  const charKeywords = getCharKeywords(poemCorpus, activeBand);
  const kwIndex = charKeywords.indexOf(kw);

  // 当前关键字不在所选 band 的可用表中 —— 视为关卡不存在
  if (kwIndex < 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <TopNav variant="main" />
        <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: 40 }}>
          <div style={{ color: colors.textPrimary, fontSize: 16, marginBottom: 16 }}>关卡不存在</div>
          <Link to="/play" aria-label="返回大厅" style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>←</Link>
        </div>
      </div>
    );
  }
  const isLastKeyword = kwIndex + 1 >= charKeywords.length;

  // 血量下方的「查看原文」按钮：传给 PlayShell 作为 bloodExtra
  const viewOriginalBtn = question ? (
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
  ) : null;

  // resetKey 在关卡切换 / 答对推进 / 答错扣血 时都变化 → Countdown 复位
  const resetKey = `${kw}-${stage.correct.length}-${stage.blood}`;

  return (
    <PlayShell
      blood={stage.blood}
      correctCount={Math.min(stage.correct.length + 1, STAGE_GOAL)}
      paused={grading || result !== null}
      onZero={handleWrong}
      resetKey={resetKey}
      bloodExtra={viewOriginalBtn}
      result={result}
      resultSubtitle={
        result
          ? result.kind === 'cleared'
            ? `已答出 ${result.correct.length} 句含「${kw}」的诗`
            : '血尽于此，下次再来'
          : null
      }
      onResultDismiss={() => clearCurrent(corpus, activeBand)}
      nextLevelUrl={isLastKeyword ? undefined : `/play/stage/${charKeywords[kwIndex + 1]}`}
    >
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
              ...playBtnStyle,
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
    </PlayShell>
  );
}
