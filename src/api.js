import * as staticApi from './staticApi.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'overviewReceptionAccessToken';
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE === 'true';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function storeAccessToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

async function readResponse(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

export async function loginUser(username, password) {
  if (STATIC_MODE) {
    const data = await staticApi.loginUser(username, password);
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
  if (STATIC_MODE) return staticApi.fetchCurrentUser();
  return apiRequest('/api/auth/me');
}

export async function logoutUser() {
  if (STATIC_MODE) {
    try {
      await staticApi.logoutUser();
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
  if (STATIC_MODE) return staticApi.fetchTasks();
  return apiRequest('/api/tasks');
}

export function fetchArchivedTasks() {
  if (STATIC_MODE) return staticApi.fetchArchivedTasks();
  return apiRequest('/api/tasks/archived');
}

export function fetchAdminSettings() {
  if (STATIC_MODE) return staticApi.fetchAdminSettings();
  return apiRequest('/api/admin/settings');
}

export function fetchAdminUsers() {
  if (STATIC_MODE) return staticApi.fetchAdminUsers();
  return apiRequest('/api/admin/users');
}

export function createAdminUser(user) {
  if (STATIC_MODE) return staticApi.createAdminUser(user);
  return apiRequest('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(user)
  });
}

export function updateAdminUser(id, user) {
  if (STATIC_MODE) return staticApi.updateAdminUser(id, user);
  return apiRequest(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(user)
  });
}

export function fetchContributionStats() {
  if (STATIC_MODE) return staticApi.fetchContributionStats();
  return apiRequest('/api/admin/contribution-stats');
}

export function saveAdminSettings(settings) {
  if (STATIC_MODE) return staticApi.saveAdminSettings(settings);
  return apiRequest('/api/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

export function seedDemoTasks() {
  if (STATIC_MODE) return staticApi.seedDemoTasks();
  return apiRequest('/api/admin/seed-demo', {
    method: 'POST'
  });
}

export function removeDemoTasks() {
  if (STATIC_MODE) return staticApi.removeDemoTasks();
  return apiRequest('/api/admin/remove-demo', {
    method: 'POST'
  });
}

export function fetchTaskHistory(id) {
  if (STATIC_MODE) return staticApi.fetchTaskHistory(id);
  return apiRequest(`/api/tasks/${id}/history`);
}

export function fetchShiftReadStatus() {
  if (STATIC_MODE) return staticApi.fetchShiftReadStatus();
  return apiRequest('/api/tasks/read-status');
}

export function markShiftTaskRead(id) {
  if (STATIC_MODE) return staticApi.markShiftTaskRead(id);
  return apiRequest(`/api/tasks/${id}/read`, {
    method: 'POST'
  });
}

export function markShiftTasksRead(ids) {
  if (STATIC_MODE) return staticApi.markShiftTasksRead(ids);
  return apiRequest('/api/tasks/read-status', {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
}

export function createTask(task) {
  if (STATIC_MODE) return staticApi.createTask(task);
  return apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task)
  });
}

export function updateTask(id, task) {
  if (STATIC_MODE) return staticApi.updateTask(id, task);
  return apiRequest(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(task)
  });
}

export function deleteTask(id) {
  if (STATIC_MODE) return staticApi.deleteTask(id);
  return apiRequest(`/api/tasks/${id}`, {
    method: 'DELETE'
  });
}

export function restoreTask(id) {
  if (STATIC_MODE) return staticApi.restoreTask(id);
  return apiRequest(`/api/tasks/${id}/restore`, {
    method: 'POST'
  });
}

export async function downloadAdminFile(path) {
  if (STATIC_MODE) return staticApi.downloadAdminFile(path);

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
