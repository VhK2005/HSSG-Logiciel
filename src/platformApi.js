import { getStoredToken, CLIENT_STORAGE_MODE } from './api.js';

async function request(path) {
  // Browser-managed accounts cannot establish platform ownership.
  if (CLIENT_STORAGE_MODE !== 'server') {
    const error = new Error('La console propriétaire nécessite une session vérifiée par le serveur.');
    error.status = 403;
    throw error;
  }
  const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}${path}`, {
    headers: { 'x-access-token': getStoredToken() || '' },
    cache: 'no-store'
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || 'Accès indisponible.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export function fetchPlatformAccess() {
  if (CLIENT_STORAGE_MODE !== 'server') return Promise.resolve({ allowed: false });
  return request('/api/platform/access');
}
export function fetchPlatformOverview() { return request('/api/platform/overview'); }
