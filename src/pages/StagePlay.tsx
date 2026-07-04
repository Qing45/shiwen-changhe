import { useParams } from 'react-router-dom';

export function StagePlay() {
  const { kw } = useParams<{ kw: string }>();
  return <div style={{ padding: 40, color: '#e8f0ff' }}>飞花令 · 关键字「{kw}」（待实现）</div>;
}
