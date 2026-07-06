// AI 对战结算页：胜负大标题 + 用时 + 已答双栏 + 未答列表 + 按钮组。
// 入场动画：fade + scale-up（CSS keyframe result-fade-scale，由 styles.css 提供）。

import { Link } from 'react-router-dom';
import { fontFamilies } from '../theme';
import type { Verse } from '../play/types';

export interface CombatResult {
  winner: 'player' | 'ai';
  elapsedSec: number;
  playerPicks: Verse[];
  aiPicks: Verse[];
  unused: Verse[];
  keyword: string;
  onPlayAgain: () => void;
  onPickKeyword: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function poemLink(v: Verse, label: string) {
  return (
    <Link
      key={`${v.poemId}-${v.line}`}
      to={`/poem/${v.poemId}`}
      style={{
        display: 'block',
        padding: '4px 0',
        color: '#000',
        textDecoration: 'none',
        fontFamily: fontFamilies.chinese,
        fontSize: 14,
      }}
    >
      <span style={{ color: '#8b7355', marginRight: 8 }}>{label}</span>
      {v.line}
      <span style={{ color: '#8b7355', fontSize: 12, marginLeft: 8 }}>
        《{v.poemTitle}》· {v.poetName}
      </span>
    </Link>
  );
}

const btnStyle = {
  padding: '8px 20px',
  background: 'transparent',
  color: '#000',
  border: '1px solid #000',
  borderRadius: 3,
  fontFamily: fontFamilies.chinese,
  fontSize: 14,
  cursor: 'pointer',
};

export function CombatResultModal({ result }: { result: CombatResult }) {
  return (
    <div
      style={{
        animation: 'result-fade-scale 0.4s ease-out',
        padding: 24,
      }}
    >
      {/* 标题 */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: fontFamilies.chinese,
          fontSize: 48,
          letterSpacing: 12,
          marginBottom: 8,
          color: '#000',
        }}
      >
        {result.winner === 'player' ? '你 胜' : 'AI 胜'}
      </div>
      <div
        style={{
          textAlign: 'center',
          color: '#8b7355',
          fontFamily: fontFamilies.chinese,
          fontSize: 14,
          marginBottom: 24,
        }}
      >
        用时 {formatTime(result.elapsedSec)} · 关键字「{result.keyword}」
      </div>

      {/* 双栏已答 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        <div>
          <div
            style={{
              fontFamily: fontFamilies.chinese,
              fontSize: 16,
              color: '#000',
              borderBottom: '1px solid #8b7355',
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            你的诗囊（{result.playerPicks.length}）
          </div>
          {result.playerPicks.length === 0
            ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（未答出）</div>
            : result.playerPicks.map((v, i) => poemLink(v, `${i + 1}.`))}
        </div>
        <div>
          <div
            style={{
              fontFamily: fontFamilies.chinese,
              fontSize: 16,
              color: '#000',
              borderBottom: '1px solid #8b7355',
              paddingBottom: 6,
              marginBottom: 8,
            }}
          >
            AI 诗囊（{result.aiPicks.length}）
          </div>
          {result.aiPicks.length === 0
            ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（未答出）</div>
            : result.aiPicks.map((v, i) => poemLink(v, `${i + 1}.`))}
        </div>
      </div>

      {/* 未答列表 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontFamily: fontFamilies.chinese,
            fontSize: 16,
            color: '#000',
            borderBottom: '1px solid #8b7355',
            paddingBottom: 6,
            marginBottom: 8,
          }}
        >
          未答出的诗句（{result.unused.length}）
        </div>
        {result.unused.length === 0
          ? <div style={{ color: '#8b7355', fontSize: 13, padding: '8px 0' }}>（题库已尽）</div>
          : result.unused.map((v, i) => poemLink(v, `${i + 1}.`))}
      </div>

      {/* 按钮组 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <button onClick={result.onPlayAgain} style={btnStyle}>再来一局</button>
        <button onClick={result.onPickKeyword} style={btnStyle}>换关键字</button>
        <button onClick={result.onPickKeyword} style={btnStyle}>返回大厅</button>
      </div>
    </div>
  );
}
