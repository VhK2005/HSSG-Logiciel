import * as staticApi from './staticApi.js';
import { readStorage, writeStorage } from './safeStorage.js';

const DB_KEY = 'overviewReceptionStaticDbV1';
const STATE_TABLE = import.meta.env.VITE_SUPABASE_TABLE || 'overview_reception_state';
const STATE_ID = import.meta.env.VITE_SUPABASE_STATE_ID || 'main';
const RAW_URL = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const RAW_KEY = String(
  import.meta.env.VITE_SUPABASE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
).trim();

const SUPABASE_KEY = RAW_KEY || (RAW_URL.startsWith('sb_') ? RAW_URL : '');
const SUPABASE_URL = normalizeSupabaseUrl(RAW_URL, SUPABASE_KEY);
let operationQueue = Promise.resolve();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readLocalDb() {
  try {
    return JSON.parse(readStorage(DB_KEY, 'null') || 'null');
  } catch {
    return null;
  }
}

function writeLocalDb(db) {
  if (db) {
    writeStorage(DB_KEY, JSON.stringify(db));
  }
}

function base64UrlDecode(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return atob(padded);
  } catch {
    return '';
  }
}

function readProjectRefFromJwt(key) {
  const [, payload] = String(key || '').split('.');
  if (!payload) return '';

  try {
    const decoded = JSON.parse(base64UrlDecode(payload));
    return typeof decoded.ref === 'string' ? decoded.ref : '';
  } catch {
    return '';
  }
}

function normalizeSupabaseUrl(rawUrl, key) {
  if (!rawUrl || rawUrl.startsWith('sb_')) {
    const ref = readProjectRefFromJwt(key);
    return ref ? `https://${ref}.supabase.co` : '';
  }

  const trimmed = rawUrl.replace(/\/$/, '');
  if (/^https?:\/\//.test(trimmed)) return trimmed;
  if (/^[a-z0-9-]+$/i.test(trimmed)) return `https://${trimmed}.supabase.co`;
  return '';
}

function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function configError() {
  return new Error(
    'Supabase n’est pas configuré. Définissez VITE_SUPABASE_URL et VITE_SUPABASE_KEY dans les variables GitHub Actions.'
  );
}

function tableEndpoint() {
  return `${SUPABASE_URL}/rest/v1/${STATE_TABLE}`;
}

async function supabaseRequest(url, options = {}) {
  if (!isConfigured()) throw configError();

  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || data?.hint || 'Erreur Supabase.';
    const error = new Error(
      message.includes(STATE_TABLE)
        ? `Table Supabase "${STATE_TABLE}" introuvable ou inaccessible. Lancez le script SQL du README.`
        : message
    );
    error.status = res.status;
    error.details = data;
    throw error;
  }

  return data;
}

async function fetchRemoteDb() {
  const rows = await supabaseRequest(
    `${tableEndpoint()}?id=eq.${encodeURIComponent(STATE_ID)}&select=data,updated_at`
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.data && typeof row.data === 'object' ? row.data : null;
}

async function saveRemoteDb(db) {
  await supabaseRequest(`${tableEndpoint()}?on_conflict=id`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      id: STATE_ID,
      data: db,
      updated_at: new Date().toISOString()
    })
  });
}

function queue(operation) {
  const run = operationQueue.then(operation, operation);
  operationQueue = run.catch(() => {});
  return run;
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function byKey(rows = [], keyGetter) {
  const map = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    map.set(String(keyGetter(row)), clone(row));
  }
  return map;
}

function mergeCollection(beforeRows, afterRows, latestRows, keyGetter) {
  const before = byKey(beforeRows, keyGetter);
  const after = byKey(afterRows, keyGetter);
  const latest = byKey(latestRows, keyGetter);

  for (const [key, beforeRow] of before.entries()) {
    const afterRow = after.get(key);
    if (!afterRow) {
      latest.delete(key);
      continue;
    }
    if (!sameJson(beforeRow, afterRow)) {
      latest.set(key, clone(afterRow));
    }
  }

  for (const [key, afterRow] of after.entries()) {
    if (!before.has(key)) {
      latest.set(key, clone(afterRow));
    }
  }

  return [...latest.values()];
}

function recomputeSequences(db) {
  const userIds = (db.users || []).map((user) => Number(user.id) || 0);
  const taskIds = (db.tasks || []).map((task) => Number(task.id) || 0);
  const historyIds = (db.histories || []).map((history) => Number(history.id) || 0);

  db.nextUserId = Math.max(Number(db.nextUserId) || 1, Math.max(0, ...userIds) + 1);
  db.nextTaskId = Math.max(Number(db.nextTaskId) || 1, Math.max(0, ...taskIds) + 1);
  db.nextHistoryId = Math.max(Number(db.nextHistoryId) || 1, Math.max(0, ...historyIds) + 1);
  return db;
}

function mergeDbChanges(beforeDb, afterDb, latestDb) {
  if (!afterDb) return latestDb || null;
  if (!beforeDb || !latestDb) return recomputeSequences(clone(afterDb));

  const merged = clone(latestDb);
  merged.users = mergeCollection(beforeDb.users, afterDb.users, latestDb.users, (row) => row.id);
  merged.sessions = mergeCollection(
    beforeDb.sessions,
    afterDb.sessions,
    latestDb.sessions,
    (row) => row.token
  );
  merged.tasks = mergeCollection(beforeDb.tasks, afterDb.tasks, latestDb.tasks, (row) => row.id);
  merged.histories = mergeCollection(
    beforeDb.histories,
    afterDb.histories,
    latestDb.histories,
    (row) => row.id
  );
  merged.reads = mergeCollection(
    beforeDb.reads,
    afterDb.reads,
    latestDb.reads,
    (row) => `${row.task_id}:${row.user_id}`
  );

  if (!sameJson(beforeDb.settings, afterDb.settings)) {
    merged.settings = clone(afterDb.settings);
  }

  return recomputeSequences(merged);
}

function reserveCloudSequences({ task = false, user = false, history = true } = {}) {
  const db = readLocalDb();
  if (!db) return;

  const entropy = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  if (task) db.nextTaskId = Math.max(Number(db.nextTaskId) || 1, entropy);
  if (user) db.nextUserId = Math.max(Number(db.nextUserId) || 1, entropy);
  if (history) db.nextHistoryId = Math.max(Number(db.nextHistoryId) || 1, entropy);
  writeLocalDb(db);
}

function changedSince(before, after) {
  return !sameJson(before, after);
}

function withSync(callback, options = {}) {
  return queue(async () => {
    const remoteDb = await fetchRemoteDb();
    if (remoteDb) {
      writeLocalDb(remoteDb);
    }

    const before = readLocalDb();
    if (options.reserve) {
      reserveCloudSequences(options.reserve);
    }

    const result = callback();
    const after = readLocalDb();
    const shouldSave = options.write || !remoteDb || changedSince(before, after);

    if (shouldSave && after) {
      const latest = await fetchRemoteDb();
      const merged = mergeDbChanges(before, after, latest);
      writeLocalDb(merged);
      await saveRemoteDb(merged);
    }

    return result;
  });
}

export function loginUser(username, password) {
  return withSync(() => staticApi.loginUser(username, password), { write: true });
}

export function fetchCurrentUser() {
  return withSync(() => staticApi.fetchCurrentUser());
}

export function logoutUser() {
  return withSync(() => staticApi.logoutUser(), { write: true });
}

export function fetchTasks() {
  return withSync(() => staticApi.fetchTasks());
}

export function fetchArchivedTasks() {
  return withSync(() => staticApi.fetchArchivedTasks());
}

export function fetchAdminSettings() {
  return withSync(() => staticApi.fetchAdminSettings());
}

export function saveAdminSettings(settings) {
  return withSync(() => staticApi.saveAdminSettings(settings), { write: true });
}

export function fetchAdminUsers() {
  return withSync(() => staticApi.fetchAdminUsers());
}

export function createAdminUser(payload) {
  return withSync(() => staticApi.createAdminUser(payload), {
    write: true,
    reserve: { user: true, history: false }
  });
}

export function updateAdminUser(id, payload) {
  return withSync(() => staticApi.updateAdminUser(id, payload), { write: true });
}

export function createTask(payload) {
  return withSync(() => staticApi.createTask(payload), {
    write: true,
    reserve: { task: true, history: true }
  });
}

export function updateTask(id, payload) {
  return withSync(() => staticApi.updateTask(id, payload), { write: true });
}

export function deleteTask(id) {
  return withSync(() => staticApi.deleteTask(id), { write: true });
}

export function restoreTask(id) {
  return withSync(() => staticApi.restoreTask(id), { write: true });
}

export function fetchTaskHistory(id) {
  return withSync(() => staticApi.fetchTaskHistory(id));
}

export function fetchShiftReadStatus() {
  return withSync(() => staticApi.fetchShiftReadStatus());
}

export function markShiftTaskRead(id) {
  return withSync(() => staticApi.markShiftTaskRead(id), { write: true });
}

export function markShiftTasksRead(ids) {
  return withSync(() => staticApi.markShiftTasksRead(ids), { write: true });
}

export function fetchContributionStats() {
  return withSync(() => staticApi.fetchContributionStats());
}

export function seedDemoTasks() {
  return withSync(
    () => ({
      ...staticApi.seedDemoTasks(),
      database: 'Supabase GitHub Pages'
    }),
    {
      write: true,
      reserve: { task: true, history: true }
    }
  );
}

export function removeDemoTasks() {
  return withSync(() => staticApi.removeDemoTasks(), { write: true });
}

export function downloadAdminFile(path) {
  return withSync(() => staticApi.downloadAdminFile(path));
}
