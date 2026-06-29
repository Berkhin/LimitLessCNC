import { lazy, Suspense } from 'react';

// Lazy so only the selected implementation's module is ever evaluated. This
// matters because each module boots its own store/WebSocket at import time;
// importing both would spin up two clients and two sockets.
const AppQuery = lazy(() =>
  import('./components/impl1/AppQuery').then((m) => ({ default: m.AppQuery })),
);
const AppSaga = lazy(() =>
  import('./components/impl2/AppSaga').then((m) => ({ default: m.AppSaga })),
);

function App() {
  const mode = import.meta.env.VITE_STATE_MODE;
  return (
    <Suspense fallback={<p style={{ padding: '2rem' }}>Loading…</p>}>
      {mode === 'query' ? <AppQuery /> : <AppSaga />}
    </Suspense>
  );
}

export default App;
