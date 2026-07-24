import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { getDynastyName } from '../data/dynasties';
import { getPoem, getPoet, getNeighbors, getGlobalPoemNeighbors, poemInCorpus } from '../data/load';
import { TopNav } from '../components/TopNav';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useCorpus, useSetCorpus, type Corpus } from '../state/corpus';
import { colors, fontFamilies, fontSizes, paperTheme } from '../theme';
import { extractVariants, getPoemMode, splitIntoLines } from '../utils/poemText';

const SIZE_MODE_KEY = 'shiwen-size-mode';
type SizeMode = 'small' | 'medium' | 'large';

function readSizeMode(): SizeMode {
  try {
    const v = window.localStorage.getItem(SIZE_MODE_KEY);
    if (v === 'small' || v === 'medium' || v === 'large') return v;
  } catch { /* localStorage unavailable */ }
  return 'medium';
}

const { bg: PAPER_BG, text: PAPER_TEXT, textSoft: PAPER_TEXT_SOFT, textDim: PAPER_TEXT_DIM } = paperTheme;

export function PoemPage() {
  const [sizeMode, setSizeMode] = useState<SizeMode>(readSizeMode);
  const { poemId } = useParams<{ poemId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const corpus = useCorpus();
  const setCorpus = useSetCorpus();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const poem = poemId ? getPoem(poemId) : undefined;
  // 默认右栏视图：有配图显配图，否则注释。配图优先——视觉冲击强、用户多为此而来。
  const [rightTab, setRightTab] = useState<'notes' | 'illustration'>(
    poem?.illustration ? 'illustration' : 'notes'
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  if (!poem) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>诗未找到</div>;
  }
  const poet = getPoet(poem.poetId);
  if (!poet) {
    return <div style={{ padding: 40, color: colors.textPrimary }}>作者未找到</div>;
  }
  // inScope: poem 是否在当前 corpus 下可见。poemInCorpus 走 gradeBands 判定 —— 跨库诗
  // （如 corpus='tang' 的《竹里馆》同时是初中必背）不能仅靠 poem.corpus === corpus，
  // 否则初中库下点跨库诗会误报"不在当前诗库"。
  const inScope = corpus === 'all' ? true : poemInCorpus(poem, corpus);
  // 切换建议：找一个包含这首诗的其它 corpus；都没有时为 undefined（不显示按钮）。
  const switchTarget: Corpus | undefined = corpus === 'all'
    ? undefined
    : ((['tang', 'primary', 'junior', 'senior'] as const).find((c) => c !== corpus && poemInCorpus(poem, c)));
  const switchLabelMap: Record<Exclude<Corpus, 'all'>, string> = {
    tang: '唐诗三百首',
    primary: '小学必背',
    junior: '初中必背',
    senior: '高中必背',
  };
  const switchLabel = switchTarget ? switchLabelMap[switchTarget] : '';
  const { prev, next } = fromPath === '/poems'
    ? getGlobalPoemNeighbors(poem.id)
    : getNeighbors(poem.id);
  const isFromFeihua =
    typeof fromPath === 'string' &&
    (fromPath.startsWith('/play/stage/') || fromPath.startsWith('/play/sentence/'));
  const backTo = fromPath ?? `/poet/${poet.id}`;
  const backLabel = fromPath === '/poems'
    ? '返回诗文'
    : isFromFeihua
      ? '返回飞花令'
      : `返回${poet.name}`;
  const linkState = { from: fromPath };

  // 持久化字号选择
  useEffect(() => {
    try { window.localStorage.setItem(SIZE_MODE_KEY, sizeMode); } catch { /* noop */ }
  }, [sizeMode]);

  // 切换诗时复位右栏 tab：默认配图（如果有），否则注释。同时关掉 lightbox。
  useEffect(() => {
    setRightTab(poem.illustration ? 'illustration' : 'notes');
    setLightboxOpen(false);
  }, [poem.id]);

  // 切换诗文时复位内部滚动容器到顶部
  const paperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (paperRef.current) {
      const el = paperRef.current as HTMLDivElement & { scrollTo?: (opts: { top: number; behavior?: ScrollBehavior }) => void };
      if (typeof el.scrollTo === 'function') {
        el.scrollTo({ top: 0, behavior: 'auto' });
      } else {
        el.scrollTop = 0;
      }
    }
  }, [poem.id]);

  // 键盘快捷键：← / → 翻诗，Esc 返回上一级
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t as HTMLElement)?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        navigate(`/poem/${prev.id}`, { state: linkState });
      } else if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        navigate(`/poem/${next.id}`, { state: linkState });
      } else if (e.key === 'Escape') {
        // lightbox 打开时优先关 lightbox，没开才返回上一级
        if (lightboxOpen) {
          setLightboxOpen(false);
        } else {
          navigate(backTo);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, navigate, fromPath, backTo, lightboxOpen]);

  // Strip inline variants, pick layout mode, split into display lines.
  const { cleanText, variants } = extractVariants(poem.content);
  const mode = getPoemMode(cleanText);
  const lines = splitIntoLines(cleanText, mode);
  const sizeOffset = sizeMode === 'small' ? 0 : sizeMode === 'large' ? 6 : 3;
  const poemFontSize = (mode === 'short' ? fontSizes.poemTextShort : fontSizes.poemTextLong) + sizeOffset;
  const metaFontSize = fontSizes.body + sizeOffset;
  const titleFontSize = fontSizes.poemTitle + sizeOffset;
  const sectionTitleFontSize = fontSizes.sectionTitle + sizeOffset;
  const buttonFontSize = 13 + sizeOffset;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const hasAnnotations = poem.annotations.length > 0;
  const hasVariants = variants.length > 0;
  const hasBackground = Boolean(poem.background);
  const hasIllustration = Boolean(poem.illustration);
  const hasRightContent = hasAnnotations || hasVariants || hasBackground || hasIllustration;
  // 仅当「图 + 注释类内容」并存时才显示切换 tab；只有图或只有注释时直接渲染对应内容
  const showRightTabs = hasIllustration && (hasAnnotations || hasVariants || hasBackground);
  // 当前右栏实际显示哪个视图：
  // - 有切换器：跟 rightTab
  // - 无切换器：有图显图，没图显注释
  const showIllustration = hasIllustration && (!showRightTabs || rightTab === 'illustration');
  const showNotes = !showIllustration && (hasAnnotations || hasVariants || hasBackground);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopNav variant="poem" poet={poet} poem={poem} backTo={backTo} backLabel={backLabel} />
      <div ref={paperRef} style={{ flex: 1, overflowY: 'auto', background: colors.bgGradient }}>
        {/* 月夜氛围带（夜空主题保留） */}
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

        {/* 不在当前诗库提示：仍展示诗文，但提示可切库（若有其它库包含此诗） */}
        {!inScope && (
          <div style={{
            maxWidth: 1400, margin: '0 auto', padding: '12px 32px 0',
            textAlign: 'center', color: '#8b7355',
            fontFamily: fontFamilies.chinese, fontSize: 13, letterSpacing: 2,
          }}>
            这首诗不在当前诗库。
            {switchTarget && (
              <button
                onClick={() => setCorpus(switchTarget)}
                style={{
                  marginLeft: 8, padding: '4px 14px',
                  background: 'transparent', color: colors.textPrimary,
                  border: `1px solid ${colors.textPrimary}`, borderRadius: 3,
                  fontFamily: fontFamilies.chinese, fontSize: 13, letterSpacing: 2,
                  cursor: 'pointer',
                }}
              >切到{switchLabel}</button>
            )}
          </div>
        )}

        {/* 纸张阅读面板（标题 + 正文 + 注释） — 卷轴形制：左右木轴 + 双金线 + 朱印 */}
        <div style={{ padding: isMobile ? '0 12px 24px' : '0 32px 28px' }}>
          <div style={{
            maxWidth: 1400,
            margin: '0 auto',
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            boxShadow: '0 4px 32px rgba(0, 0, 0, 0.25)',
          }}>
            {/* 左木轴 */}
            <div style={{
              width: 10,
              background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
              boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.3)',
            }} />
            {/* 纸面（含金线 + 印 + 字号 + 标题 + grid） */}
            <div style={{
              position: 'relative',
              flex: 1,
              background: PAPER_BG,
              padding: isMobile ? '20px 16px' : '32px 40px',
            }}>
              {/* 双金线（内 1px 暗金，外 1px 亮金，4px 间距） */}
              <div style={{ position: 'absolute', inset: 4, border: '1px solid #b08a4a', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', inset: 8, border: '1px solid #d4af6a', pointerEvents: 'none' }} />

              {/* 朱印（标题左上角，篆体「诗」） */}
              <div style={{ position: 'absolute', top: 14, left: 22, zIndex: 2 }}>
                <svg width="32" height="32" viewBox="0 0 32 32" style={{
                  transform: 'rotate(-3deg)',
                  filter: 'drop-shadow(0.5px 0.5px 1.2px rgba(60,20,15,0.45))',
                }}>
                  <rect x="2" y="2" width="28" height="28" rx="1.5"
                    fill="#a8302a" stroke="#7a1f15" strokeWidth="0.6" />
                  <text x="16" y="23" textAnchor="middle"
                    fontFamily="'STKaiti', 'KaiTi', serif" fontSize="18"
                    fill="#f5ebd2" fontWeight="700">诗</text>
                </svg>
              </div>

              {/* 字号调节器（仅影响正文） */}
              <div style={{ position: 'absolute', top: 14, right: 18, display: 'flex', gap: 4, zIndex: 2 }}>
                {(['small', 'medium', 'large'] as const).map((s) => {
                  const label = s === 'small' ? '小' : s === 'medium' ? '中' : '大';
                  const active = sizeMode === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setSizeMode(s)}
                      style={{
                        padding: '3px 10px',
                        background: active ? PAPER_TEXT : 'transparent',
                        color: active ? '#f5ebd2' : PAPER_TEXT_DIM,
                        border: `1px solid ${PAPER_TEXT_DIM}`,
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontFamily: fontFamilies.chinese,
                        fontSize: buttonFontSize,
                        letterSpacing: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {/* 标题区（跨栏） */}
              <div key={`title-${poem.id}`} style={{ textAlign: 'center', marginBottom: 28, paddingTop: 16, animation: 'fade-in 0.3s ease-out' }}>
                <div style={{
                  fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                  fontSize: titleFontSize, letterSpacing: 12,
                  marginBottom: 8, fontWeight: 600,
                }}>{poem.title}</div>
                <div style={{
                  color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                  fontSize: metaFontSize, letterSpacing: 3,
                }}>{poet.name} · {getDynastyName(poet.dynastyId)}</div>
                {/* 标题下微细金线 */}
                <div style={{
                  marginTop: 14,
                  height: 1,
                  background: 'linear-gradient(90deg, transparent, rgba(176,138,74,0.55), transparent)',
                }} />
              </div>

            {/* 主体 grid */}
            <div key={`body-${poem.id}`} style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : (hasRightContent ? '60fr 40fr' : '1fr'),
              gap: isMobile ? 24 : 48,
              animation: 'fade-in 0.3s ease-out',
            }}>
              {/* 正文 */}
              <div style={{
                fontFamily: fontFamilies.chinese, color: PAPER_TEXT,
                fontSize: poemFontSize,
                lineHeight: mode === 'short' ? 2.4 : 2.0,
                letterSpacing: mode === 'short' ? 4 : 2,
                textAlign: 'center',
              }}>
                {lines.map((line, i) => <div key={i}>{line}</div>)}
              </div>

              {/* 右：注释/异文/背景（可切换到配图） */}
              {hasRightContent && (
                <div style={{ textAlign: 'left' }}>
                  {/* 视图切换器（图 + 注释类内容并存时显示） */}
                  {showRightTabs && (
                    <div style={{
                      display: 'flex',
                      marginBottom: 22,
                      borderBottom: '1px solid rgba(176, 138, 74, 0.3)',
                }}>
                  {(['notes', 'illustration'] as const).map((t) => {
                    const label = t === 'notes' ? '注 释' : '配 图';
                    const active = rightTab === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setRightTab(t)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'transparent',
                          color: active ? PAPER_TEXT : PAPER_TEXT_DIM,
                          border: 'none',
                          borderBottom: active ? `2px solid #b08a4a` : '2px solid transparent',
                          fontFamily: fontFamilies.chinese,
                          fontSize: buttonFontSize,
                          letterSpacing: 6,
                          cursor: 'pointer',
                          marginBottom: '-1px',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                    </div>
                  )}

                  {/* 配图视图 */}
                  {showIllustration && (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={`${import.meta.env.BASE_URL}illustrations/${poem.illustration}`}
                        alt={`${poem.title} 配图`}
                        loading="lazy"
                        onClick={() => setLightboxOpen(true)}
                        style={{
                          maxWidth: '100%',
                          maxHeight: isMobile ? 360 : 520,
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain',
                          borderRadius: 4,
                          border: '1px solid rgba(176, 138, 74, 0.35)',
                          boxShadow: '0 2px 16px rgba(0, 0, 0, 0.18)',
                          cursor: 'zoom-in',
                        }}
                      />
                      <div style={{
                        marginTop: 10,
                        color: PAPER_TEXT_DIM,
                        fontFamily: fontFamilies.chinese,
                        fontSize: 12,
                        letterSpacing: 3,
                      }}>点 击 放 大</div>
                    </div>
                  )}

                  {/* 注释 / 异文 / 背景视图 */}
                  {showNotes && (
                    <>
                      {hasAnnotations && (
                        <section>
                          <SectionTitle fontSize={sectionTitleFontSize} bold>注 释</SectionTitle>
                          <div style={{
                            color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                            fontSize: metaFontSize, lineHeight: 1.9,
                          }}>
                            {poem.annotations.map((a, i) => (
                              <div key={i} style={{ marginBottom: 12, textIndent: '2em' }}>
                                <span style={{ color: PAPER_TEXT }}>{a.term}：</span>
                                {a.explanation}
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {hasAnnotations && hasVariants && (
                        <div style={{ height: 24 }} />
                      )}

                      {hasVariants && (
                        <section>
                          <SectionTitle fontSize={sectionTitleFontSize}>异 文</SectionTitle>
                          <div style={{
                            color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                            fontSize: metaFontSize, lineHeight: 1.9,
                          }}>
                            {variants.map((v, i) => (
                              <div key={i} style={{ marginBottom: 12, textIndent: '2em' }}>
                                <span style={{ color: PAPER_TEXT }}>{v.original}：</span>
                                {v.kind}「{v.variant}」
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {(hasAnnotations || hasVariants) && hasBackground && (
                        <div style={{ height: 24 }} />
                      )}

                      {hasBackground && (
                        <section>
                          <SectionTitle fontSize={sectionTitleFontSize} bold>创 作 背 景</SectionTitle>
                          <div style={{
                            color: PAPER_TEXT_SOFT, fontFamily: fontFamilies.chinese,
                            fontSize: metaFontSize, lineHeight: 2, textIndent: '2em',
                          }}>{poem.background}</div>
                        </section>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* 右木轴 */}
          <div style={{
            width: 10,
            background: 'linear-gradient(180deg, #4a2f16 0%, #6b4a2b 50%, #4a2f16 100%)',
            boxShadow: 'inset 1px 0 0 rgba(0,0,0,0.3)',
          }} />
          </div>
        </div>

        {/* 从飞花令跳来时显示返回按钮 */}
        {isFromFeihua && (
          <div style={{ padding: '20px 32px 0', maxWidth: 1400, margin: '0 auto', textAlign: 'center' }}>
            <button
              onClick={() => navigate(fromPath!)}
              style={{
                padding: '8px 22px',
                background: 'transparent',
                color: colors.textPrimary,
                border: `1px solid ${colors.textPrimary}`,
                borderRadius: 3,
                fontFamily: fontFamilies.chinese,
                fontSize: 14,
                letterSpacing: 4,
                cursor: 'pointer',
              }}
            >← 返 回 飞 花 令</button>
          </div>
        )}

        {/* 翻页（夜空主题保留） */}
        <nav style={{
          padding: '20px 32px',
          display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 14,
          maxWidth: 1400,
          margin: '0 auto',
        }}>
          {prev ? (
            <Link to={`/poem/${prev.id}`} state={linkState} style={navCardStyle}>
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
            <Link to={`/poem/${next.id}`} state={linkState} style={{ ...navCardStyle, textAlign: 'right' }}>
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

      {/* 配图放大层：全屏黑底 + 居中大图，点击空白 / × / ESC 关闭 */}
      {lightboxOpen && poem.illustration && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(8, 6, 4, 0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 16 : 48,
            animation: 'fade-in 0.18s ease-out',
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}illustrations/${poem.illustration}`}
            alt={`${poem.title} 配图`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: 4,
              boxShadow: '0 8px 48px rgba(0, 0, 0, 0.6)',
            }}
          />
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="关闭"
            style={{
              position: 'absolute',
              top: isMobile ? 12 : 20,
              right: isMobile ? 16 : 24,
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'rgba(245, 235, 210, 0.08)',
              color: '#f5ebd2',
              border: '1px solid rgba(245, 235, 210, 0.35)',
              fontSize: 24,
              lineHeight: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'serif',
            }}
          >×</button>
        </div>
      )}
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

function SectionTitle({ children, fontSize, bold }: { children: React.ReactNode; fontSize: number; bold?: boolean }) {
  return (
    <div style={{
      color: PAPER_TEXT, fontFamily: fontFamilies.chinese,
      fontSize, letterSpacing: 4, marginBottom: 14,
      fontWeight: bold ? 700 : undefined,
      textAlign: 'center',
    }}>{children}</div>
  );
}
