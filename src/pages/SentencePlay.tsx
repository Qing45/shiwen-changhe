// 飞花令 · 整句（联句）模式：50 关按句长分三档（入门 5 言 / 进阶 7 言 / 高阶混合）。
// 给出上句，4 选 1 接下句。30s 倒计时；同关答出 STAGE_GOAL 句通关。

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PlayShell } from '../components/PlayShell';
import { getTotalAvailableLevels, pickLevelQuestion, tierOfAvailableLevel, type SentenceQuestion } from '../play/couplets';
import {
  beginSentenceStage,
  loadSentenceProgress,
  commitSentenceCorrect,
  commitSentenceBlood,
  markSentenceCleared,
  clearSentenceCurrent,
} from '../play/sentenceProgress';
import { STAGE_GOAL } from '../play/types';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus } from '../state/corpus';
import { loadGrade } from '../state/primaryGrade';
import { loadJuniorGrade } from '../state/juniorGrade';
import { toChineseNum } from '../utils/number';
import { fontFamilies, paperTheme } from '../theme';
import { colors } from '../theme';

const { text: PAPER_TEXT, textDim: PAPER_TEXT_DIM, green: PAPER_GREEN, red: PAPER_RED } = paperTheme;

const TIER_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

export function SentencePlay() {
  const { level: levelParam } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const level = parseInt(levelParam ?? '', 10);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const corpus = useCorpus();
  // 引擎/题库（couplets.ts）接受 PoemCorpus（'tang' | 'primary' | 'both'），
  // 而 state 层 Corpus 含 'all'。此处做一次边界映射：'all' → 'both'。
  // 进度函数（loadSentenceProgress 等）接受 Corpus，仍传 raw corpus —— 进度 key 自然后缀 :all。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  // 仅 primary / junior 库下生效的年级 band；tang 走 undefined 保持旧行为（byte-identical）。
  const activeBand = corpus === 'primary' ? loadGrade() : corpus === 'junior' ? loadJuniorGrade() : undefined;

  // 关数按 (corpus, band) 动态计算：tang 50、primary band=1 至多 30（入门 10+进阶 20），依语料库变动。
  const totalLevels = getTotalAvailableLevels(poemCorpus, activeBand);
  const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
  const tier = validLevel ? tierOfAvailableLevel(level, poemCorpus, activeBand) : null;

  const levelKey = String(level);   // 进度存储用字符串 key

  // 从原文页返回时取出"已查看"的上句，加进排除集，避免回到题面后又看到同一题。
  // key 带 corpus+band 前缀，避免不同库下同 levelKey 互相污染。
  // viewedKey 同时作为"刚从查看原文返回"的唯一信号 —— 仅此时续传 mid-level 进度，
  // 用户主动退出再进入一律开新局（progress.current 被 beginSentenceStage 覆盖）。
  const viewedKey = `feihuaSentenceViewed:${corpus}:${activeBand ?? ''}:${levelKey}`;

  const [stage, setStage] = useState(() => {
    if (!validLevel) return null;
    const progress = loadSentenceProgress(corpus, activeBand);
    // 仅"从查看原文返回"时续传：viewedKey flag 表示玩家点了"查看原文"跳到 PoemPage 后回来。
    // 其它情况（首次进入、退出再进、切关）一律 beginSentenceStage 开新局 —— 用户语义：退出 = 放弃进度。
    const isReturningFromView = sessionStorage.getItem(viewedKey) !== null;
    if (isReturningFromView && progress.current && progress.current.keyword === levelKey) {
      return progress.current;
    }
    return beginSentenceStage(levelKey, corpus, activeBand).current;
  });

  const [viewedUpperLine] = useState<string | null>(() => {
    if (!validLevel) return null;
    const v = sessionStorage.getItem(viewedKey);
    if (v) {
      sessionStorage.removeItem(viewedKey);
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
    // 同 useState 初始化：仅"从查看原文返回"时续传，其它一律开新局。
    const isReturningFromView = sessionStorage.getItem(viewedKey) !== null;
    const fresh =
      isReturningFromView && progress.current && progress.current.keyword === levelKey
        ? progress.current
        : beginSentenceStage(levelKey, corpus, activeBand).current;
    setStage(fresh);
    usedUpperRef.current = new Set(fresh?.correct ?? []);
    setQuestion(pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand));
    setPicked(null);
    setGrading(false);
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
    // stage.correct 存的是"已答过的上句"——pickLevelQuestion 用 upper.line 排除，
    // 必须同维度记录；若存下句会导致排除集失效，5 题里随机到重复上句。
    const upperLine = questionRef.current.upper.line;
    const newCorrect = [...cur.correct, upperLine];

    commitSentenceCorrect(levelKey, upperLine, corpus, activeBand);
    const next = loadSentenceProgress(corpus, activeBand);
    setStage(next.current);
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
    // 答错也排除当前上句，避免换题后又被随机到同一道
    if (questionRef.current) {
      const newUsed = new Set(usedUpperRef.current);
      newUsed.add(questionRef.current.upper.line);
      usedUpperRef.current = newUsed;
    }
    setGrading(true);
    setTimeout(() => {
      setQuestion(pickLevelQuestion(tier, usedUpperRef.current, poemCorpus, activeBand));
      setPicked(null);
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
    sessionStorage.setItem(viewedKey, upperLine);
    setStage(loadSentenceProgress(corpus, activeBand).current);
    navigate(`/poem/${poemId}`, { state: { from: `/play/sentence/${level}` } });
  };

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

  const resetKey = `${levelKey}-${stage.correct.length}-${stage.blood}`;

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
            ? `第 ${toChineseNum(level)} 关 · 已联出 ${result.correct.length} 句`
            : '血尽于此，下次再来'
          : null
      }
      onResultDismiss={() => clearSentenceCurrent(corpus, activeBand)}
      nextLevelUrl={isLastLevel ? undefined : `/play/sentence/${level + 1}`}
    >
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
    </PlayShell>
  );
}
