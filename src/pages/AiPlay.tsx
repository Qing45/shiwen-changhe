// 飞花令 · AI 对战局。
// 双栏对坐：左「你的诗囊」/ 右「AI 诗囊 + 剪影 + 难度」；底部 4 选 1 题板。
// 30 秒倒计时，玩家超时判负；AI 按难度概率漏答，漏了判 AI 负。

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/TopNav';
import { PaperScroll } from '../components/PaperScroll';
import { AiSilhouette } from '../components/AiSilhouette';
import { ChoiceBoard } from '../components/ChoiceBoard';
import { CombatResultModal, type CombatResult } from '../components/CombatResultModal';
import { colors, fontFamilies } from '../theme';
import { getVersesFor } from '../play/engine';
import { buildChoiceBoard, aiPickAnswer, rollFirstTurn } from '../play/ai';
import { recordWin, recordLoss } from '../play/record';
import { DIFFICULTY_META, type Difficulty, type Verse } from '../play/types';

const TURN_SECONDS = 30;

function isDifficulty(s: string | null): s is Difficulty {
  return s === 'qingdeng' || s === 'mohe' || s === 'shisheng';
}

export function AiPlay() {
  const { kw } = useParams<{ kw: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const diffParam = searchParams.get('difficulty');
  const difficulty: Difficulty = isDifficulty(diffParam) ? diffParam : 'qingdeng';

  // 入局时确定首回合方（仅首次；ref 保存，避免 useEffect 重新触发）
  const initialTurnRef = useRef<'player' | 'ai' | null>(null);
  if (initialTurnRef.current === null) initialTurnRef.current = rollFirstTurn();

  const firstRound = initialTurnRef.current;

  const [round, setRound] = useState<'player' | 'ai'>(firstRound);
  const [playerPicks, setPlayerPicks] = useState<Verse[]>([]);
  const [aiPicks, setAiPicks] = useState<Verse[]>([]);
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [board, setBoard] = useState<Verse[]>(() => buildChoiceBoard(new Set(), kw ?? '', 4));
  const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
  const [result, setResult] = useState<CombatResult | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // 玩家回合倒计时
  useEffect(() => {
    if (result || round !== 'player') return;
    if (secondsLeft <= 0) {
      finish('ai');
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, round, result]);

  // AI 回合：thinkMs 后决策
  useEffect(() => {
    if (result || round !== 'ai' || !kw) return;
    const meta = DIFFICULTY_META[difficulty];
    const t = setTimeout(() => {
      const pick = aiPickAnswer(kw, used, difficulty);
      if (!pick.picked) {
        // AI 漏答，玩家胜
        finish('player');
        return;
      }
      setAiPicks((prev) => [...prev, pick.verse!]);
      const nextUsed = new Set(used);
      nextUsed.add(pick.verse!.line);
      setUsed(nextUsed);
      // 移交玩家回合
      const nextBoard = buildChoiceBoard(nextUsed, kw, 4);
      if (nextBoard.length === 0) {
        finish('player');
        return;
      }
      setBoard(nextBoard);
      setSecondsLeft(TURN_SECONDS);
      setRound('player');
    }, meta.thinkMs);
    return () => clearTimeout(t);
    // 注意：依赖故意不全 — used/result 变化不应重启定时
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // 玩家首次入局 + 每次回合开始（切回 player）时重建题板
  useEffect(() => {
    if (round !== 'player' || result || !kw) return;
    if (board.length === 0) {
      const b = buildChoiceBoard(used, kw, 4);
      if (b.length === 0) {
        finish('ai');
        return;
      }
      setBoard(b);
      setSecondsLeft(TURN_SECONDS);
    }
  }, [round, result, kw]);

  function finish(winner: 'player' | 'ai') {
    if (result) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (winner === 'player') recordWin(difficulty);
    else recordLoss(difficulty);

    const allUnused = getVersesFor(kw ?? '').filter((v) => !used.has(v.line));
    setResult({
      winner,
      elapsedSec: elapsed,
      playerPicks,
      aiPicks,
      unused: allUnused,
      keyword: kw ?? '',
      onPlayAgain: () => navigate(`/play/ai/${kw}?difficulty=${difficulty}`, { replace: true }),
      onPickKeyword: () => navigate('/play?tab=combat'),
    });
  }

  const onSelect = (v: Verse) => {
    if (result || round !== 'player') return;
    setPlayerPicks((prev) => [...prev, v]);
    const nextUsed = new Set(used);
    nextUsed.add(v.line);
    setUsed(nextUsed);
    // AI 回合前置检查：题库空就判 AI 负
    const aiBoard = buildChoiceBoard(nextUsed, kw ?? '', 1);
    if (aiBoard.length === 0) {
      finish('player');
      return;
    }
    setRound('ai');
  };

  if (!kw) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>关键字缺失</div>;
  }

  const meta = DIFFICULTY_META[difficulty];

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="main" />
      <div style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient, padding: '24px 28px' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/play?tab=combat')}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.textTertiary,
              fontSize: 14,
              fontFamily: fontFamilies.chinese,
              cursor: 'pointer',
            }}
          >
            ← 返回大厅
          </button>
          <div style={{ color: colors.textTertiary, fontSize: 14, fontFamily: fontFamilies.chinese }}>
            {round === 'player' ? '你的回合' : 'AI 思考中…'}
          </div>
        </div>

        <PaperScroll>
          {/* 关键字 + 回合 */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontFamily: fontFamilies.chinese, color: '#000',
              fontSize: 80, fontWeight: 700, lineHeight: 1, marginBottom: 8,
            }}>
              {kw}
            </div>
          </div>

          {/* 双栏 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* 左：你的诗囊 */}
            <div>
              <div style={{
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
              }}>
                你的诗囊（{playerPicks.length}）
              </div>
              {playerPicks.length === 0
                ? <div style={{ color: '#8b7355', fontSize: 13 }}>（尚未出招）</div>
                : playerPicks.map((v, i) => (
                    <div key={`${v.poemId}-${i}`} style={{ color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese }}>
                      {i + 1}. {v.line}
                    </div>
                  ))}
            </div>

            {/* 右：AI */}
            <div>
              <div style={{
                fontFamily: fontFamilies.chinese, color: '#000', fontSize: 16,
                borderBottom: '1px solid #8b7355', paddingBottom: 6, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <AiSilhouette difficulty={difficulty} />
                <div>
                  <div>{meta.label}</div>
                  <div style={{ fontSize: 12, color: '#8b7355' }}>
                    {Math.round(meta.missRate * 100)}% 漏答 · {(meta.thinkMs / 1000).toFixed(1)}s
                  </div>
                  {round === 'ai' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#000',
                            display: 'inline-block',
                            animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontFamily: fontFamilies.chinese, color: '#000', fontSize: 14, paddingTop: 8 }}>
                AI 诗囊（{aiPicks.length}）
              </div>
              {aiPicks.length === 0
                ? <div style={{ color: '#8b7355', fontSize: 13 }}>（AI 尚未出招）</div>
                : aiPicks.map((v, i) => (
                    <div key={`${v.poemId}-${i}`} style={{ color: '#000', fontSize: 14, padding: '4px 0', fontFamily: fontFamilies.chinese }}>
                      {i + 1}. {v.line}
                    </div>
                  ))}
            </div>
          </div>

          {/* 题板 / 锁屏 / 结算 */}
          {result ? (
            <CombatResultModal result={result} />
          ) : round === 'player' ? (
            <ChoiceBoard
              verses={board}
              secondsLeft={secondsLeft}
              onSelect={onSelect}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#8b7355', fontFamily: fontFamilies.chinese, padding: 32, fontSize: 14 }}>
              （AI 回合锁定中）
            </div>
          )}
        </PaperScroll>
      </div>
    </div>
  );
}
