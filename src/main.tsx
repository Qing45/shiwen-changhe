import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// GitHub Pages SPA fallback：404.html 跳转过来时把原路径存在 sessionStorage 里，
// 这里恢复 URL 后再 mount React，让 BrowserRouter 读到正确路由。
const ghRedirect = sessionStorage.getItem('gh-redirect');
if (ghRedirect) {
  sessionStorage.removeItem('gh-redirect');
  history.replaceState(null, '', ghRedirect);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
