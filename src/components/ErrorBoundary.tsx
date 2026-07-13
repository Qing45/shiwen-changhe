import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { colors, fontFamilies } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// 兜底渲染错误：之前 Android 蓝屏根因是路由 basename 错位导致整个页面渲染失败，
// 加一层 boundary 后即便业务代码抛错也能展示降级 UI 而不是白屏/蓝屏。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // 真实接入时可上报 Sentry / 自家日志；此处仅 console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.assign('/');
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          background: colors.bgGradient,
          color: colors.textPrimary,
          fontFamily: fontFamilies.chinese,
        }}
      >
        <div style={{ fontSize: 24, letterSpacing: 8, marginBottom: 16 }}>
          出了点问题
        </div>
        <div
          style={{
            fontSize: 14,
            color: colors.textTertiary,
            lineHeight: 1.8,
            maxWidth: 480,
            marginBottom: 32,
            wordBreak: 'break-word',
          }}
        >
          {this.state.error.message}
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link
            to="/"
            onClick={this.handleReload}
            style={{
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
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              background: 'transparent',
              border: `1px solid ${colors.textTertiary}`,
              borderRadius: 3,
              color: colors.textTertiary,
              fontFamily: fontFamilies.chinese,
              fontSize: 14,
              letterSpacing: 4,
              cursor: 'pointer',
            }}
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }
}