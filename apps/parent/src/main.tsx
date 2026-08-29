import React from 'react';
import ReactDOM from 'react-dom/client';
import '@casillego/ui/styles.css';
import { App } from './App';
import { setupServiceWorker } from './update/service-worker';

// ADR-095: register the SW once at startup and keep its `updateSW` handle for
// the ADR-094 banner. 'prompt' mode — nothing activates without a user click.
setupServiceWorker();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
