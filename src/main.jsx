import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './workspace.css';

import { renderStartupError } from './startupError.js';

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
