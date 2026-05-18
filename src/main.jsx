import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const STARTUP_LOGO_SRC = `${import.meta.env.BASE_URL}logo.svg`;

function renderStartupError(error) {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = `
    <div class="startup-error">
      <div class="brand-mark"><img src="${STARTUP_LOGO_SRC}" alt="" aria-hidden="true" /></div>
      <h1>Overview Réception Hôtel</h1>
      <p>Le chargement de l’application a été interrompu.</p>
      <pre>${String(error?.message || error || 'Erreur inconnue')}</pre>
      <button type="button" onclick="window.location.reload()">Recharger</button>
    </div>
  `;
}

window.addEventListener('error', (event) => {
  renderStartupError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  renderStartupError(event.reason);
});

try {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  renderStartupError(error);
}
