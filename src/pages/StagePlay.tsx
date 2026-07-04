import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { NineGrid } from '../components/NineGrid';
import { colors, fontFamilies } from '../theme';
import { pickStageQuestion, buildNineGrid } from '../play/engine';
import { beginStage, loadProgress } from '../play/progress';
import { STAGE_GOAL, STAGE_BLOOD, type Verse } from '../play/types';

// 纸面配色（与 PoemPage 同源，仅本文件局部声明）
const PAPER_TEXT = '#000000';
const PAPER_TEXT_DIM = '#8b7355';

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();

  // 进入页面时初始化局：current 已是本关键字则续传，否则开新局
  const [stage] = useState(() => {
    if (!kw) return null;
    const progress = loadProgress();
    if (progress.current && progress.current.keyword === kw) {
      return progress.current;
    }
    return beginStage(kw).current;
  });

  // 已答对句集合（用于 pickStageQuestion 排除）
  const used = useMemo(() => new Set(stage?.correct ?? []), [stage]);

  // 当前题目
  const [question] = useState<{ verse: Verse; blanks: number[] } | null>(() => {
    if (!kw) return null;
    return pickStageQuestion(kw, used);
  });

  // 九宫格字块与玩家已填字符
  const [nineGrid, setNineGrid] = useState(() =>
    question ? buildNineGrid(question.verse.line, question.blanks) : null
  );
  const [filled, setFilled] = useState<string[]>([]);

  // 当 question 改变时重置 nineGrid 与 filled
  useEffect(() => {
    if (question) {
      setNineGrid(buildNineGrid(question.verse.line, question.blanks));
      setFilled([]);
    }
  }, [question]);

  const handleChar = (c: string) => {
    if (filled.length >= (question?.blanks.length ?? 0)) return;
    setFilled([...filled, c]);
    // 答完所有空位时不立即判定（Task 9 处理）
  };
  const handleUndo = () => setFilled(filled.slice(0, -1));

  if (!kw || !stage) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  // 显示用挖空后的句子：blanks 位置渲染为 □，其余保留原字（含标点）
  const displayLine = question
    ? Array.from(question.verse.line).map((ch, i) =>
        question.blanks.includes(i) ? '□' : ch
      ).join('')
    : '';

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
          {/* 头部：血量 + 进度 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ color: PAPER_TEXT, fontFamily: fontFamilies.chinese, fontSize: 16, letterSpacing: 2 }}>
              {'❤'.repeat(stage.blood)}{'♡'.repeat(STAGE_BLOOD - stage.blood)}
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
        </PaperScroll>
      </div>
    </div>
  );
}
