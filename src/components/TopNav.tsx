import { Link } from 'react-router-dom';
import { colors, fontFamilies, fontSizes } from '../theme';
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
}

type Props = MainVariantProps | PoetVariantProps | PoemVariantProps;

export function TopNav(props: Props) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #020514 0%, #0a1228 100%)',
      padding: '16px 28px',
      borderBottom: '1px solid rgba(216,224,240,0.18)',
      display: 'flex', alignItems: 'center', gap: 20,
    }}>
      {props.variant === 'main' && (
        <>
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 22, letterSpacing: 6,
            textShadow: '0 0 12px rgba(216,224,240,0.5)',
          }}>诗文长河</div>
          <div style={{
            flex: 1, maxWidth: 440,
            background: 'rgba(216,224,240,0.08)',
            border: '1px solid rgba(216,224,240,0.25)',
            borderRadius: 4, padding: '10px 16px',
            color: colors.textTertiary, fontSize: 15,
          }}>🔍 搜索诗人、诗名、诗句……</div>
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poet' && (
        <>
          <BackLink to="/" label="返回长河" />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 24, letterSpacing: 6,
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
          <DynastyLabel />
        </>
      )}

      {props.variant === 'poem' && (
        <>
          <BackLink to={`/poet/${props.poet.id}`} label={`返回${props.poet.name}`} />
          <div style={{
            fontFamily: fontFamilies.chinese, color: colors.textPrimary,
            fontSize: 20, letterSpacing: 4,
            textShadow: '0 0 10px rgba(216,224,240,0.5)',
          }}>{props.poem.title}</div>
          <div style={{
            color: colors.textTertiary, fontFamily: fontFamilies.chinese,
            fontSize: fontSizes.meta, letterSpacing: 2,
          }}>{props.poem.creationYear != null
            ? `${props.poet.name} · ${props.poem.creationYear}`
            : props.poet.name}</div>
        </>
      )}
    </div>
  );
}

function metaString(poet: Poet): string {
  const parts: string[] = [];
  if (poet.courtesyName) parts.push(`字${poet.courtesyName}`);
  if (poet.pseudonym) parts.push(`号${poet.pseudonym}`);
  return parts.join(' · ');
}

function DynastyLabel() {
  return (
    <div style={{
      marginLeft: 'auto',
      color: colors.textTertiary, fontFamily: fontFamilies.chinese,
      fontSize: fontSizes.meta, letterSpacing: 3,
      padding: '6px 14px',
      border: '1px solid rgba(216,224,240,0.2)',
      borderRadius: 3,
    }}>唐</div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} style={{ color: colors.textTertiary, fontSize: 14, textDecoration: 'none' }}>← {label}</Link>;
}
