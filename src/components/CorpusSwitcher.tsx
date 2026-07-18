import { useLocation, useNavigate } from 'react-router-dom';
import { useCorpus, useSetCorpus } from '../state/corpus';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { fontFamilies } from '../theme';
import type { Corpus } from '../state/corpus';

const PLAY_SCREEN_RE = /^\/play\/(stage|sentence)\//;

export function CorpusSwitcher() {
  const corpus = useCorpus();
  const setCorpus = useSetCorpus();
  const navigate = useNavigate();
  const location = useLocation();
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const onSwitch = (next: Corpus) => {
    if (next === corpus) return;
    if (PLAY_SCREEN_RE.test(location.pathname)) {
      navigate('/play', { replace: true });
    }
    setCorpus(next);
  };

  const baseStyle: React.CSSProperties = {
    fontFamily: fontFamilies.chinese,
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    padding: isMobile ? '4px 10px' : '6px 14px',
    fontSize: isMobile ? 11 : 13,
    letterSpacing: 2,
    borderRadius: 3,
    transition: 'all 0.15s',
  };
  const activeStyle: React.CSSProperties = {
    ...baseStyle,
    background: '#f5ebd2',
    color: '#1a2855',
    boxShadow: 'inset 0 0 0 1px #d4af6a',
  };
  const inactiveStyle: React.CSSProperties = {
    ...baseStyle,
    color: '#d4af6a',
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid #d4af6a',
        borderRadius: 4,
        overflow: 'hidden',
      }}
      role="tablist"
      aria-label="诗库切换"
    >
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'tang'}
        onClick={() => onSwitch('tang')}
        style={corpus === 'tang' ? activeStyle : inactiveStyle}
        data-testid="corpus-tang"
      >{isMobile ? '唐诗' : '唐诗三百首'}</button>
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'primary'}
        onClick={() => onSwitch('primary')}
        style={corpus === 'primary' ? activeStyle : inactiveStyle}
        data-testid="corpus-primary"
      >{isMobile ? '小学' : '小学必背'}</button>
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'junior'}
        onClick={() => onSwitch('junior')}
        style={corpus === 'junior' ? activeStyle : inactiveStyle}
        data-testid="corpus-junior"
      >{isMobile ? '初中' : '初中必背'}</button>
      <button
        type="button"
        role="tab"
        aria-selected={corpus === 'all'}
        onClick={() => onSwitch('all')}
        style={corpus === 'all' ? activeStyle : inactiveStyle}
        data-testid="corpus-all"
      >总库</button>
    </div>
  );
}
