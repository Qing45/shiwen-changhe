import { useParams, Link } from 'react-router-dom';
import { getPoem, getPoet, getNeighbors } from '../data/load';
import { TopNav } from '../components/TopNav';
import { colors, fontFamilies, fontSizes } from '../theme';

export function PoemPage() {
  const { poemId } = useParams<{ poemId: string }>();
  const poem = poemId ? getPoem(poemId) : undefined;
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  const { prev, next } = getNeighbors(poem.id);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} />
      <div style={{
        flex: 1, overflowY: 'auto',
        background: colors.bgGradient,
      }}>
        {/* 月夜氛围带（无题图） */}
        <div style={{ position: 'relative', height: 70, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 16, right: '14%',
            width: 36, height: 36, borderRadius: '50%',
            background: 'radial-gradient(circle, #f0f4ff 0%, #d8e0f0 40%, rgba(216,224,240,0.2) 70%, transparent 100%)',
            boxShadow: '0 0 30px rgba(216,224,240,0.4)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            background: `
              radial-gradient(circle at 18% 40%, #fff 0.6px, transparent 1.5px),
              radial-gradient(circle at 38% 20%, #e8f0ff 0.6px, transparent 1.5px),
              radial-gradient(circle at 62% 50%, #fff 0.5px, transparent 1.5px),
              radial-gradient(circle at 82% 25%, #e8f0ff 0.6px, transparent 1.5px)
            `,
          }} />
        </div>

        {/* 原文 */}
        <div style={{ padding: '8px 32px 28px', textAlign: 'center' }}>
          <div style={{
            fontFamily: fontFamilies.chinese, color: '#fff',
            fontSize: fontSizes.poemTitle, letterSpacing: 8,
            marginBottom: 8, fontWeight: 600,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{poem.title}</div>
          <div style={{
            color: colors.textDim, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.body, letterSpacing: 3, marginBottom: 28,
          }}>{poet.name} · 唐</div>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: fontSizes.poemText, lineHeight: 2.6, letterSpacing: 2,
            whiteSpace: 'pre-wrap',
          }}>{poem.content}</div>
        </div>

        <Divider />

        {/* 注释 */}
        {poem.annotations.length > 0 && (
          <>
            <section style={{ padding: '24px 32px' }}>
              <SectionTitle>注 释</SectionTitle>
              <div style={{
                color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                fontSize: fontSizes.body, lineHeight: 1.9,
              }}>
                {poem.annotations.map((a, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <span style={{ color: colors.textPrimary }}>{a.term}：</span>
                    {a.explanation}
                  </div>
                ))}
              </div>
            </section>
            <Divider />
          </>
        )}

        {/* 创作背景 */}
        {poem.background && (
          <>
            <section style={{ padding: '24px 32px' }}>
              <SectionTitle>创 作 背 景</SectionTitle>
              <div style={{
                color: colors.textSecondary, fontFamily: fontFamilies.chinese,
                fontSize: fontSizes.body, lineHeight: 2,
              }}>{poem.background}</div>
            </section>
            <Divider />
          </>
        )}

        {/* 翻页 */}
        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
        }}>
          {prev ? (
            <Link to={`/poem/${prev.id}`} style={navCardStyle}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{prev.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>← 上一首</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是第一首）</div>
            </div>
          )}
          {next ? (
            <Link to={`/poem/${next.id}`} style={{ ...navCardStyle, textAlign: 'right' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>{next.title}</div>
            </Link>
          ) : (
            <div style={{ ...navCardStyle, textAlign: 'right', opacity: 0.3, pointerEvents: 'none' }}>
              <div style={{ color: colors.textDim, fontFamily: fontFamilies.chinese, fontSize: 14, letterSpacing: 2 }}>下一首 →</div>
              <div style={{ color: colors.textSecondary, fontFamily: fontFamilies.chinese, fontSize: 16, marginTop: 6 }}>（已是最后一首）</div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

const navCardStyle: React.CSSProperties = {
  flex: 1, padding: '14px 18px',
  background: 'rgba(216,224,240,0.05)',
  border: '1px solid rgba(216,224,240,0.18)',
  borderRadius: 4,
  textDecoration: 'none',
};

function Divider() {
  return <div style={{ margin: '0 32px', borderTop: '1px dashed rgba(216,224,240,0.18)' }} />;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.sectionTitle, letterSpacing: 4, marginBottom: 14,
    }}>{children}</div>
  );
}
