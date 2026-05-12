import * as staticApi from './staticApi.js';
import * as supabaseApi from './supabaseApi.js';
import { readStorage, removeStorage, writeStorage } from './safeStorage.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'overviewReceptionAccessToken';
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';
const DATA_MODE = import.meta.env.VITE_DATA_MODE || (STATIC_MODE ? 'local' : 'server');
const BROWSER_API = STATIC_MODE && DATA_MODE === 'supabase' ? supabaseApi : staticApi;

export const CLIENT_STORAGE_MODE = STATIC_MODE ? DATA_MODE : 'server';

export function getStoredToken() {
  return readStorage(TOKEN_KEY);
}

export function clearAccessToken() {
  removeStorage(TOKEN_KEY);
}

function storeAccessToken(token) {
  if (token) {
    writeStorage(TOKEN_KEY, token);
  }
}

function staticRequest(callback) {
  return Promise.resolve().then(callback);
}

async function readResponse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function loginUser(username, password) {
  if (STATIC_MODE) {
    const data = await BROWSER_API.loginUser(username, password);
    storeAccessToken(data.token);
    return data;
  }

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await readResponse(res);

  if (!res.ok) {
    const error = new Error(data?.message || 'Identifiants incorrects.');
    error.status = res.status;
    throw error;
  }

  storeAccessToken(data.token);
  return data;
}

export function fetchCurrentUser() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchCurrentUser());
  return apiRequest('/api/auth/me');
}

export async function logoutUser() {
  if (STATIC_MODE) {
    try {
      await BROWSER_API.logoutUser();
    } finally {
      clearAccessToken();
    }
    return;
  }

  try {
    await apiRequest('/api/auth/logout', { method: 'POST' });
  } finally {
    clearAccessToken();
  }
}

async function apiRequest(path, options = {}) {
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };
  const token = getStoredToken();

  if (token) {
    headers['x-access-token'] = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });
  const data = await readResponse(res);

  if (!res.ok) {
    const error = new Error(data?.message || 'Erreur API.');
    error.status = res.status;
    throw error;
  }

  return data;
}

export function fetchTasks() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchTasks());
  return apiRequest('/api/tasks');
}

export function fetchArchivedTasks() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchArchivedTasks());
  return apiRequest('/api/tasks/archived');
}

export function fetchAdminSettings() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchAdminSettings());
  return apiRequest('/api/admin/settings');
}

export function fetchWorkspaceData() {
  if (STATIC_MODE && BROWSER_API.fetchWorkspaceData) {
    return staticRequest(() => BROWSER_API.fetchWorkspaceData());
  }

  if (STATIC_MODE) {
    return staticRequest(async () => ({
      tasks: await BROWSER_API.fetchTasks(),
      archivedTasks: await BROWSER_API.fetchArchivedTasks(),
      settings: await BROWSER_API.fetchAdminSettings()
    }));
  }

  return apiRequest('/api/bootstrap');
}

export function fetchAdminUsers() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchAdminUsers());
  return apiRequest('/api/admin/users');
}

export function createAdminUser(user) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.createAdminUser(user));
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function updateAdminUser(id, user) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.updateAdminUser(id, user));
  return apiRequest(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user)
  });
}

export function fetchContributionStats() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchContributionStats());
  return apiRequest('/api/admin/contribution-stats');
}

export function saveAdminSettings(settings) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.saveAdminSettings(settings));
  return apiRequest('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

export function seedDemoTasks() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.seedDemoTasks());
  return apiRequest('/api/admin/seed-demo', {
    method: 'POST'
  });
}

export function removeDemoTasks() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.removeDemoTasks());
  return apiRequest('/api/admin/remove-demo', {
    method: 'POST'
  });
}

export function fetchTaskHistory(id) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchTaskHistory(id));
  return apiRequest(`/api/tasks/${id}/history`);
}

export function fetchShiftReadStatus() {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.fetchShiftReadStatus());
  return apiRequest('/api/tasks/read-status');
}

export function markShiftTaskRead(id) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.markShiftTaskRead(id));
  return apiRequest(`/api/tasks/${id}/read`, {
    method: 'POST'
  });
}

export function markShiftTasksRead(ids) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.markShiftTasksRead(ids));
  return apiRequest('/api/tasks/read-status', {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
}

export function createTask(task) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.createTask(task));
  return apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  });
}

export function updateTask(id, task) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.updateTask(id, task));
  return apiRequest(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(task)
  });
}

export function deleteTask(id) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.deleteTask(id));
  return apiRequest(`/api/tasks/${id}`, {
    method: 'DELETE'
  });
}

export function restoreTask(id) {
  if (STATIC_MODE) return staticRequest(() => BROWSER_API.restoreTask(id));
  return apiRequest(`/api/tasks/${id}/restore`, {
    method: 'POST'
  });
}

export async function downloadAdminFile(path) {
  if (STATIC_MODE) return BROWSER_API.downloadAdminFile(path);

  const token = getStoredToken();
  const headers = token ? { 'x-access-token': token } : {};
  const res = await fetch(`${API_BASE}${path}`, { headers });

  if (!res.ok) {
    const data = await readResponse(res);
    const error = new Error(data?.message || 'Téléchargement impossible.');
    error.status = res.status;
    throw error;
  }

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] || 'overview-reception-export';

  return {
    filename,
    blob: await res.blob()
  };
}
