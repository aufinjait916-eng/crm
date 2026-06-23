import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA Service Worker for offline capabilities and app installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Field Dynamics PWA Service Worker registered with scope: ', registration.scope);
      })
      .catch((err) => {
        console.error('Field Dynamics PWA Service Worker registration failed: ', err);
      });
  });
}

