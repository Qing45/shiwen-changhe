// 飞花令 · 整篇识名模式。
// 题目展示诗正文（隐藏作者），4 个诗名选项多选。
// 多关卡递进解锁（30 / 50 关），血量 3 + 30s 倒计时。

import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { PlayShell } from '../components/PlayShell';
import { countAvailableTitleLevels, pickTitleQuestion, type TitleQuestion } from '../play/titles';
import {
  loadTitleProgress, markTitleCleared, beginTitleStage,
  commitTitleCorrect, commitTitleBlood, clearTitleCurrent,
} from '../play/titleProgress';
import { tierOfAvailableLevel } from '../play/couplets';
import { STAGE_GOAL } from '../play/types';
import { splitIntoLines } from '../utils/poemText';
import { toChineseNum } from '../utils/number';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus } from '../state/corpus';
import { colors, fontFamilies, paperTheme } from '../theme';
import { loadGrade } from '../state/primaryGrade';
import { loadJuniorGrade } from '../state/juniorGrade';

const { text: PAPER_TEXT, textDim: PAPER_TEXT_DIM, green: PAPER_GREEN, red: PAPER_RED } = paperTheme;

const TIER_LABEL: Record<'entry' | 'mid' | 'advanced', string> = {
  entry: '入 门',
  mid: '进 阶',
  advanced: '高 阶',
};

export function TitlePlay() {
  const { level: levelParam } = useParams<{ level: string }>();
  const navigate = useNavigate();
  const level = parseInt(levelParam ?? '', 10);

  const corpus = useCorpus();
  // 引擎/题库（titles.ts）接受 PoemCorpus，state 层 Corpus 含 'all'。
  // 'all' → 'both' 边界映射。进度函数接受 Corpus，仍传 raw corpus。
  const poemCorpus = corpus === 'all' ? 'both' : corpus;
  // 仅 primary / junior 库下生效的年级 band；tang 走 undefined 保持旧行为（byte-identical）。
  const activeBand = corpus === 'primary' ? loadGrade() : corpus === 'junior' ? loadJuniorGrade() : undefined;

  // 关数按 (corpus, band) 动态计算：tang 50、primary band=1 较小；依语料库变动。
  const totalLevels = countAvailableTitleLevels(poemCorpus, activeBand);
  const validLevel = Number.isFinite(level) && level >= 1 && level <= totalLevels;
  const tier = validLevel ? tierOfAvailableLevel(level, poemCorpus, activeBand) : null;

  const levelKey = String(level);

  // 进入页面时永远开新局 —— 整篇识名模式没有"查看原文"跳转，无需 mid-level 续传。
  // 用户主动退出再进入也应从第 1 题开始：beginTitleStage 会覆盖 progress.current。
  const [stage, setStage] = useState(() => {
    if (!validLevel) return null;
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
  const [result, setResult] = useState<{ kind: 'cleared' | 'failed'; correct?: string[] } | null>(null);

  const stageRef = useRef(stage);
  stageRef.current = stage;
  const questionRef = useRef(question);
  questionRef.current = question;

  // breakpoint 必须在所有 early return 之前调用（Rules of Hooks）
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  // 关卡切换时复位状态（同一 element 内导航不会重挂载）；永远开新局
  useEffect(() => {
    if (!validLevel) return;
    if (stageRef.current && stageRef.current.keyword === levelKey) return;
    const fresh = beginTitleStage(levelKey, corpus, activeBand).current;
    setStage(fresh);
    usedPoemIdsRef.current = new Set(fresh ? (fresh.correct ?? []) : []);
    setQuestion(pickTitleQuestion(level, usedPoemIdsRef.current, poemCorpus, activeBand));
    setPicked(null);
    setGrading(false);
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
      setGrading(false);
    }, 1500);
  }

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

  // resetKey 在关卡切换 / 答对推进 / 答错扣血 时都变化 → Countdown 复位
  const resetKey = `${levelKey}-${stage.correct.length}-${stage.blood}`;

  return (
    <PlayShell
      blood={stage.blood}
      correctCount={Math.min(stage.correct.length + 1, STAGE_GOAL)}
      paused={grading || result !== null}
      onZero={handleWrong}
      resetKey={resetKey}
      result={result}
      resultSubtitle={result?.kind === 'cleared' && question ? `《${question.poemTitle}》` : null}
      onResultDismiss={() => clearTitleCurrent(corpus, activeBand)}
      nextLevelUrl={isLastLevel ? undefined : `/play/title/${level + 1}`}
    >
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
    </PlayShell>
  );
}
