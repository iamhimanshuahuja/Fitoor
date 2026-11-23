import CheerToast from './components/CheerToast';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import ErrorBoundary from './components/ErrorBoundary';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Service worker: when a new deploy is found the page reloads once onto it. Besides the check on
// page load, check again whenever the app comes back to the front (home-screen apps stay open for days).
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || Date.now() - last < 60_000) return;
      last = Date.now();
      reg.update().catch(() => {});
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <CheerToast />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
