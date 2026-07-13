import { Link } from 'react-router-dom';
import { colors, fontFamilies } from '../theme';

export function NotFound() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        background: colors.bgGradient,
        color: colors.textPrimary,
        fontFamily: fontFamilies.chinese,
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div style={{ fontSize: 64, letterSpacing: 12, color: colors.textTertiary }}>
        404
      </div>
      <div style={{ fontSize: 20, letterSpacing: 8 }}>页面未找到</div>
      <div style={{ fontSize: 14, color: colors.textDim, letterSpacing: 4 }}>
        所寻之路，不在此河
      </div>
      <Link
        to="/"
        style={{
          marginTop: 16,
          padding: '8px 20px',
          border: `1px solid ${colors.textPrimary}`,
          borderRadius: 3,
          color: colors.textPrimary,
          textDecoration: 'none',
          fontSize: 14,
          letterSpacing: 4,
        }}
      >
        返回首页
      </Link>
    </div>
  );
}