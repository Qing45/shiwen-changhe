import { Link, useLocation } from 'react-router-dom';
import { colors, fontFamilies, fontSizes } from '../theme';
import { SearchBox } from './SearchBox';
import { CorpusSwitcher } from './CorpusSwitcher';
import { getPoets, getPoems } from '../data/load';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { getDynastyName } from '../data/dynasties';
import type { Poet, Poem } from '../types';

interface BaseProps {
  variant: 'main' | 'poet' | 'poem';
}

interface MainVariantProps extends BaseProps {
  variant: 'main';
}
interface PoetVariantProps extends BaseProps {
  variant: 'poet';
  poet: Poet;
}
interface PoemVariantProps extends BaseProps {
  variant: 'poem';
  poet: Poet;
  poem: Poem;
  backTo?: string;
  backLabel?: string;
}

type Props = MainVariantProps | PoetVariantProps | PoemVariantProps;

export function TopNav(props: Props) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  return (
    <div style={{
      background: 'linear-gradient(180deg, #020514 0%, #0a1228 100%)',
      padding: isMobile ? '12px 14px' : '16px 28px',
      borderBottom: '1px solid rgba(216,224,240,0.18)',
      display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20,
    }}>
      {props.variant === 'main' && (
        <>
          {!isMobile && (
            <div style={{
              fontFamily: fontFamilies.chinese, color: colors.textPrimary,
              fontSize: 22, letterSpacing: 6,
              textShadow: '0 0 12px rgba(216,224,240,0.5)',
            }}>诗文长河</div>
          )}
          <RiverToggle compact={isMobile} />
          <SearchBox />
          <CorpusSwitcher />
        </>
      )}

      {props.variant === 'poet' && (
        <>
          <BackLink to="/" label="返回长河" />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: isMobile ? 18 : 24, letterSpacing: isMobile ? 3 : 6,
            textShadow: '0 0 14px rgba(216,224,240,0.6)',
          }}>{props.poet.name}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>
            {(() => {
              const meta = metaString(props.poet);
              const years = `${props.poet.birthYear}—${props.poet.deathYear}`;
              return meta ? `${meta} · ${years}` : years;
            })()}
          </div>
          <DynastyLabel dynastyId={props.poet.dynastyId} />
          <CorpusSwitcher />
        </>
      )}

      {props.variant === 'poem' && (
        <>
          <BackLink
            to={props.backTo ?? `/poet/${props.poet.id}`}
            label={props.backLabel ?? `返回${props.poet.name}`}
          />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: isMobile ? 16 : 20, letterSpacing: isMobile ? 2 : 4,
            textShadow: '0 0 10px rgba(216,224,240,0.5)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            maxWidth: isMobile ? '40vw' : undefined,
          }}>{props.poem.title}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
            display: isMobile ? 'none' : undefined,
          }}>{props.poem.creationYear != null
            ? `${props.poet.name} · ${props.poem.creationYear}`
            : props.poet.name}</div>
          <DynastyLabel dynastyId={props.poet.dynastyId} />
          <div style={{ marginLeft: 'auto' }}><CorpusSwitcher /></div>
        </>
      )}
    </div>
  );
}

function RiverToggle({ compact }: { compact: boolean }) {
  const loc = useLocation();
  const btn = (to: string, label: string, count: number) => {
    const on = loc.pathname === to;
    const showCount = count > 0;
    const text = on && showCount ? `${label}·${count}` : label;
    return (
      <Link to={to} style={{
        color: on ? '#fff' : colors.textTertiary,
        fontFamily: fontFamilies.chinese,
        fontSize: compact ? 14 : 16,
        letterSpacing: compact ? 1 : 3,
        padding: compact ? '4px 8px' : '6px 14px',
        textDecoration: 'none',
        borderBottom: on ? '2px solid #fff' : '2px solid transparent',
        textShadow: on ? '0 0 10px rgba(216,224,240,0.6)' : 'none',
        boxShadow: on ? '0 2px 8px -2px rgba(212,175,106,0.55)' : 'none',
        transition: 'color 0.15s, border-color 0.15s, box-shadow 0.15s',
        whiteSpace: 'nowrap',
      }}>{text}</Link>
    );
  };
  return (
    <div style={{ display: 'flex', gap: compact ? 0 : 4 }}>
      {btn('/', '诗人', getPoets().length)}
      {btn('/poems', '诗文', getPoems().length)}
      {btn('/play', '飞花令', 0)}
    </div>
  );
}

function metaString(poet: Poet): string {
  const parts: string[] = [];
  if (poet.courtesyName) parts.push(`字${poet.courtesyName}`);
  if (poet.pseudonym) parts.push(`号${poet.pseudonym}`);
  return parts.join(' · ');
}

function DynastyLabel({ dynastyId }: { dynastyId?: string }) {
  if (!dynastyId) return null;
  return (
    <div style={{
      marginLeft: 'auto',
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.meta, letterSpacing: 3,
      padding: '6px 14px',
      border: '1px solid rgba(216,224,240,0.2)',
      borderRadius: 3,
    }}>{getDynastyName(dynastyId)}</div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>← {label}</Link>;
}
