import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// ?collect opens the stroke test-case collector (docs/02 §4) instead of the world.
const Collector = lazy(() => import('./collect/Collector').then((m) => ({ default: m.Collector })));
const collect = new URLSearchParams(location.search).has('collect');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {collect ? (
      <Suspense>
        <Collector />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
