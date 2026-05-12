import { CATEGORIES, PRIORITIES, STATUSES } from './constants.js';
import { readStorage, writeStorage } from './safeStorage.js';
import { DEFAULT_ADMIN_SETTINGS } from './templateDefaults.js';

const DB_KEY = 'overviewReceptionStaticDbV1';
const TOKEN_KEY = 'overviewReceptionAccessToken';
const SESSION_HOURS = 16;
const DAY = 24 * 60 * 60 * 1000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function createError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function relativeDate(offsetDays) {
  const date = new Date(startOfToday().getTime() + offsetDays * DAY);
  return date.toISOString().slice(0, 10);
}

function relativeStamp(offsetDays, hour = 10, minute = 0) {
  const date = new Date(startOfToday().getTime() + offsetDays * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function defaultDb() {
  const stamp = nowIso();
  return {
    users: [
      {
        id: 1,
        username: 'Admin',
        password: 'admin',
        role: 'admin',
        is_active: true,
        created_at: stamp,
        updated_at: stamp,
        last_login_at: null
      }
    ],
    sessions: [],
    tasks: [],
    histories: [],
    reads: [],
    settings: clone(DEFAULT_ADMIN_SETTINGS),
    nextUserId: 2,
    nextTaskId: 1,
    nextHistoryId: 1
  };
}

function ensureDbShape(db) {
  const fallback = defaultDb();
  const next = {
    ...fallback,
    ...(db && typeof db === 'object' ? db : {})
  };

  next.users = Array.isArray(next.users) ? next.users : fallback.users;
  next.sessions = Array.isArray(next.sessions) ? next.sessions : [];
  next.tasks = Array.isArray(next.tasks) ? next.tasks : [];
  next.histories = Array.isArray(next.histories) ? next.histories : [];
  next.reads = Array.isArray(next.reads) ? next.reads : [];
  next.settings = sanitizeSettings(next.settings);
  next.tasks = normalizeStoredTasks(next.tasks);
  next.nextUserId = Number(next.nextUserId) || Math.max(1, ...next.users.map((user) => user.id)) + 1;
  next.nextTaskId = Math.max(
    Number(next.nextTaskId) || 1,
    Math.max(0, ...next.tasks.map((task) => task.id)) + 1
  );
  next.nextHistoryId =
    Number(next.nextHistoryId) || Math.max(0, ...next.histories.map((row) => row.id)) + 1;

  if (next.users.length === 0) {
    next.users = fallback.users;
    next.nextUserId = 2;
  }

  return next;
}

function normalizeStoredTasks(tasks) {
  const usedIds = new Set();
  let nextGeneratedId = Math.max(0, ...tasks.map((task) => Number(task?.id) || 0)) + 1;

  return tasks.map((task, index) => {
    let id = Number(task?.id) || nextGeneratedId++;
    if (usedIds.has(id)) {
      id = nextGeneratedId++;
    }
    usedIds.add(id);

    const stamp = nowIso();
    const status = ensureAllowed(task?.status, STATUSES, 'À faire');
    const updatedAt = cleanText(task?.updated_at, stamp);
    const completedAt =
      status === 'Fait'
        ? cleanText(task?.completed_at, updatedAt)
        : task?.completed_at || null;

    return {
      id,
      title: cleanText(task?.title, `Consigne ${index + 1}`),
      description: typeof task?.description === 'string' ? task.description : '',
      due_date: normalizeDate(task?.due_date),
      priority: ensureAllowed(task?.priority, PRIORITIES, 'Normale'),
      category: ensureAllowed(task?.category, CATEGORIES, 'Autre'),
      status,
      created_at: cleanText(task?.created_at, updatedAt),
      updated_at: updatedAt,
      completed_at: completedAt,
      archived_at: task?.archived_at || null,
      is_archived: Boolean(task?.is_archived),
      created_by_user_id: task?.created_by_user_id ?? null,
      created_by_name: cleanText(task?.created_by_name, 'Non renseigné'),
      completed_by_user_id: task?.completed_by_user_id ?? null,
      completed_by_name: completedAt ? cleanText(task?.completed_by_name, 'Non renseigné') : null,
      is_demo: Boolean(task?.is_demo)
    };
  });
}

function loadDb() {
  try {
    const db = ensureDbShape(JSON.parse(readStorage(DB_KEY, 'null') || 'null'));
    saveDb(db);
    return db;
  } catch {
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db) {
  writeStorage(DB_KEY, JSON.stringify(db));
  return db;
}

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return clean || fallback;
}

function normalizeDate(value) {
  if (!value || typeof value !== 'string') return null;
  return value.slice(0, 10);
}

function ensureAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    is_active: Boolean(user.is_active),
    created_at: user.created_at,
    updated_at: user.updated_at,
    last_login_at: user.last_login_at || null
  };
}

function sanitizeSettings(payload = {}) {
  const source = {
    ...clone(DEFAULT_ADMIN_SETTINGS),
    ...(payload && typeof payload === 'object' ? payload : {})
  };

  return {
    defaultsVersion: 2,
    kanbanWindowDays: Math.min(30, Math.max(1, Number(source.kanbanWindowDays) || 5)),
    kanbanExcludedCategories: Array.isArray(source.kanbanExcludedCategories)
      ? source.kanbanExcludedCategories.filter((category) => CATEGORIES.includes(category))
      : clone(DEFAULT_ADMIN_SETTINGS.kanbanExcludedCategories),
    quickTemplates: Array.isArray(source.quickTemplates)
      ? source.quickTemplates.slice(0, 20)
      : clone(DEFAULT_ADMIN_SETTINGS.quickTemplates),
    shiftChecklists: Array.isArray(source.shiftChecklists)
      ? source.shiftChecklists.slice(0, 6).map((checklist, index) => ({
          id: cleanText(checklist?.id, `checklist-${index + 1}`),
          label: cleanText(checklist?.label, `Checklist ${index + 1}`),
          subtitle: typeof checklist?.subtitle === 'string' ? checklist.subtitle.trim() : '',
          items: Array.isArray(checklist?.items)
            ? checklist.items
                .map((item) => cleanText(item))
                .filter(Boolean)
                .slice(0, 80)
            : []
        }))
      : []
  };
}

function currentToken() {
  return readStorage(TOKEN_KEY);
}

function cleanExpiredSessions(db) {
  const stamp = nowIso();
  db.sessions = db.sessions.filter((session) => session.expires_at > stamp);
}

function currentUser(db) {
  cleanExpiredSessions(db);
  const token = currentToken();
  const session = db.sessions.find((item) => item.token === token);
  const user = session ? db.users.find((item) => item.id === session.user_id) : null;

  if (!user || !user.is_active) {
    saveDb(db);
    throw createError('Veuillez vous connecter.', 401);
  }

  saveDb(db);
  return user;
}

function requireAdmin(db) {
  const user = currentUser(db);
  if (user.role !== 'admin') {
    throw createError('Accès réservé à l’administrateur.', 403);
  }
  return user;
}

function mapTask(task) {
  return {
    ...task,
    is_archived: Boolean(task.is_archived)
  };
}

function recordHistory(db, taskId, action, field, oldValue, newValue, stamp = nowIso()) {
  db.histories.push({
    id: db.nextHistoryId++,
    task_id: taskId,
    action,
    field: field || null,
    old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
    new_value: newValue === null || newValue === undefined ? null : String(newValue),
    created_at: stamp
  });
}

function recordFieldChanges(db, taskId, action, before, after, fields, stamp = nowIso()) {
  for (const field of fields) {
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    if (oldValue !== newValue) {
      recordHistory(db, taskId, action, field, oldValue, newValue, stamp);
    }
  }
}

function daysUntilDueDate(dueDate) {
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.floor((due - startOfToday()) / DAY);
}

function runAutomationsInDb(db) {
  const stamp = nowIso();
  const archiveThreshold = new Date(Date.now() - 2 * DAY).toISOString();

  for (const task of db.tasks) {
    if (
      !task.is_archived &&
      task.status === 'Fait' &&
      task.completed_at &&
      task.completed_at <= archiveThreshold
    ) {
      task.is_archived = true;
      task.archived_at = stamp;
      task.updated_at = stamp;
      recordHistory(db, task.id, 'Archivage automatique', 'is_archived', 0, 1, stamp);
      recordHistory(db, task.id, 'Archivage automatique', 'archived_at', null, stamp, stamp);
    }

    if (
      !task.is_archived &&
      ['En attente', 'En cours'].includes(task.status) &&
      task.due_date &&
      daysUntilDueDate(task.due_date) === 1
    ) {
      const oldStatus = task.status;
      task.status = 'À faire';
      task.updated_at = stamp;
      recordHistory(db, task.id, 'Automatisation échéance', 'status', oldStatus, 'À faire', stamp);
    }
  }
}

function sortedActiveTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (!a.due_date && b.due_date) return 1;
    if (a.due_date && !b.due_date) return -1;
    if (a.due_date !== b.due_date) return String(a.due_date || '').localeCompare(String(b.due_date || ''));
    return String(b.updated_at).localeCompare(String(a.updated_at));
  });
}

function sortedArchivedTasks(tasks) {
  return [...tasks].sort((a, b) =>
    String(b.archived_at || b.completed_at || b.updated_at).localeCompare(
      String(a.archived_at || a.completed_at || a.updated_at)
    )
  );
}

function findTask(db, id) {
  const task = db.tasks.find((item) => item.id === Number(id));
  if (!task) throw createError('Consigne introuvable.', 404);
  return task;
}

function taskActor(user) {
  return {
    id: user?.id || null,
    name: user?.username || 'Système'
  };
}

export function loginUser(username, password) {
  const db = loadDb();
  const cleanUsername = cleanText(username);
  const user = db.users.find(
    (item) => item.username.toLowerCase() === cleanUsername.toLowerCase()
  );

  if (!user || !user.is_active || String(user.password) !== String(password || '')) {
    throw createError('Identifiants incorrects.', 401);
  }

  const stamp = nowIso();
  const token = `static-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  user.last_login_at = stamp;
  user.updated_at = stamp;
  db.sessions.push({ token, user_id: user.id, created_at: stamp, expires_at: expiresAt });
  saveDb(db);

  return {
    token,
    expires_at: expiresAt,
    user: sanitizeUser(user)
  };
}

export function fetchCurrentUser() {
  const db = loadDb();
  return { user: sanitizeUser(currentUser(db)) };
}

export function logoutUser() {
  const db = loadDb();
  const token = currentToken();
  db.sessions = db.sessions.filter((session) => session.token !== token);
  saveDb(db);
}

export function fetchTasks() {
  const db = loadDb();
  currentUser(db);
  runAutomationsInDb(db);
  saveDb(db);
  return sortedActiveTasks(db.tasks.filter((task) => !task.is_archived)).map(mapTask);
}

export function fetchArchivedTasks() {
  const db = loadDb();
  currentUser(db);
  runAutomationsInDb(db);
  saveDb(db);
  return sortedArchivedTasks(db.tasks.filter((task) => task.is_archived)).map(mapTask);
}

export function fetchAdminSettings() {
  const db = loadDb();
  currentUser(db);
  return clone(db.settings);
}

export function saveAdminSettings(settings) {
  const db = loadDb();
  requireAdmin(db);
  db.settings = sanitizeSettings(settings);
  saveDb(db);
  return clone(db.settings);
}

export function fetchAdminUsers() {
  const db = loadDb();
  requireAdmin(db);
  return db.users
    .map(sanitizeUser)
    .sort((a, b) => `${a.role}-${a.username}`.localeCompare(`${b.role}-${b.username}`));
}

export function createAdminUser(payload) {
  const db = loadDb();
  requireAdmin(db);
  const username = cleanText(payload.username);
  const password = String(payload.password || '');
  const role = payload.role === 'admin' ? 'admin' : 'reception';

  if (!username) throw createError('Le nom utilisateur est obligatoire.');
  if (password.length < 4) throw createError('Le mot de passe doit contenir au moins 4 caractères.');
  if (db.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    throw createError('Ce nom utilisateur existe déjà.', 409);
  }

  const stamp = nowIso();
  const user = {
    id: db.nextUserId++,
    username,
    password,
    role,
    is_active: true,
    created_at: stamp,
    updated_at: stamp,
    last_login_at: null
  };
  db.users.push(user);
  saveDb(db);
  return sanitizeUser(user);
}

export function updateAdminUser(id, payload) {
  const db = loadDb();
  const admin = requireAdmin(db);
  const user = db.users.find((item) => item.id === Number(id));
  if (!user) throw createError('Compte introuvable.', 404);

  const nextRole = payload.role === 'admin' || payload.role === 'reception' ? payload.role : user.role;
  const nextActive =
    typeof payload.is_active === 'boolean' ? Boolean(payload.is_active) : Boolean(user.is_active);

  if (admin.id === user.id && !nextActive) {
    throw createError('Vous ne pouvez pas désactiver votre propre compte.');
  }

  if (admin.id === user.id && user.role === 'admin' && nextRole !== 'admin') {
    throw createError('Vous ne pouvez pas retirer votre propre rôle administrateur.');
  }

  const wouldLoseAdmin = (user.role === 'admin' || nextRole === 'admin') && (nextRole !== 'admin' || !nextActive);
  const otherAdmins = db.users.filter(
    (item) => item.id !== user.id && item.role === 'admin' && item.is_active
  ).length;
  if (wouldLoseAdmin && otherAdmins === 0) {
    throw createError('Impossible de retirer le dernier administrateur actif.');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'password')) {
    const password = String(payload.password || '');
    if (password.length < 4) {
      throw createError('Le mot de passe doit contenir au moins 4 caractères.');
    }
    user.password = password;
  }

  user.role = nextRole;
  user.is_active = nextActive;
  user.updated_at = nowIso();
  if (!user.is_active) {
    db.sessions = db.sessions.filter((session) => session.user_id !== user.id);
  }
  saveDb(db);
  return sanitizeUser(user);
}

export function createTask(payload) {
  const db = loadDb();
  const user = currentUser(db);
  const title = cleanText(payload.title);
  if (!title) throw createError('Le titre est obligatoire.');

  const stamp = nowIso();
  const actor = taskActor(user);
  const status = ensureAllowed(payload.status, STATUSES, 'À faire');
  const completedAt = status === 'Fait' ? stamp : null;
  const task = {
    id: db.nextTaskId++,
    title,
    description: cleanText(payload.description),
    due_date: normalizeDate(payload.due_date),
    priority: ensureAllowed(payload.priority, PRIORITIES, 'Normale'),
    category: ensureAllowed(payload.category, CATEGORIES, 'Autre'),
    status,
    created_at: stamp,
    updated_at: stamp,
    completed_at: completedAt,
    archived_at: null,
    is_archived: false,
    created_by_user_id: actor.id,
    created_by_name: actor.name,
    completed_by_user_id: completedAt ? actor.id : null,
    completed_by_name: completedAt ? actor.name : null
  };

  db.tasks.push(task);
  recordHistory(db, task.id, `Création par ${actor.name}`, null, null, task.title, stamp);
  saveDb(db);
  return mapTask(task);
}

export function updateTask(id, payload) {
  const db = loadDb();
  const user = currentUser(db);
  const current = findTask(db, id);
  const before = clone(current);
  const actor = taskActor(user);

  const nextStatus =
    payload.status !== undefined ? ensureAllowed(payload.status, STATUSES, current.status) : current.status;

  if (nextStatus === 'Fait' && current.status !== 'Fait') {
    current.completed_at = nowIso();
    current.completed_by_user_id = actor.id;
    current.completed_by_name = actor.name;
  }
  if (nextStatus !== 'Fait' && current.status === 'Fait') {
    current.completed_at = null;
    current.completed_by_user_id = null;
    current.completed_by_name = null;
  }

  current.title = payload.title !== undefined ? cleanText(payload.title, current.title) : current.title;
  current.description =
    payload.description !== undefined ? cleanText(payload.description) : current.description;
  current.due_date = payload.due_date !== undefined ? normalizeDate(payload.due_date) : current.due_date;
  current.priority =
    payload.priority !== undefined
      ? ensureAllowed(payload.priority, PRIORITIES, current.priority)
      : current.priority;
  current.category =
    payload.category !== undefined
      ? ensureAllowed(payload.category, CATEGORIES, current.category)
      : current.category;
  current.status = nextStatus;
  current.updated_at = nowIso();

  if (!current.title) throw createError('Le titre est obligatoire.');

  recordFieldChanges(
    db,
    current.id,
    'Modification',
    before,
    current,
    ['title', 'description', 'due_date', 'priority', 'category', 'status', 'completed_at', 'completed_by_name'],
    current.updated_at
  );
  saveDb(db);
  return mapTask(current);
}

export function deleteTask(id) {
  const db = loadDb();
  currentUser(db);
  const beforeCount = db.tasks.length;
  db.tasks = db.tasks.filter((task) => task.id !== Number(id));
  db.histories = db.histories.filter((history) => history.task_id !== Number(id));
  db.reads = db.reads.filter((read) => read.task_id !== Number(id));
  if (db.tasks.length === beforeCount) throw createError('Consigne introuvable.', 404);
  saveDb(db);
}

export function restoreTask(id) {
  const db = loadDb();
  currentUser(db);
  const task = findTask(db, id);
  if (!task.is_archived) throw createError('Archive introuvable.', 404);

  const stamp = nowIso();
  const oldStatus = task.status;
  task.status = 'À faire';
  task.completed_at = null;
  task.completed_by_user_id = null;
  task.completed_by_name = null;
  task.archived_at = null;
  task.is_archived = false;
  task.updated_at = stamp;
  recordHistory(db, task.id, 'Restauration', 'is_archived', 1, 0, stamp);
  recordHistory(db, task.id, 'Restauration', 'status', oldStatus, task.status, stamp);
  saveDb(db);
  return mapTask(task);
}

export function fetchTaskHistory(id) {
  const db = loadDb();
  currentUser(db);
  findTask(db, id);
  return db.histories
    .filter((history) => history.task_id === Number(id))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
}

export function fetchShiftReadStatus() {
  const db = loadDb();
  const user = currentUser(db);
  return db.reads.filter((read) => read.user_id === user.id).map(clone);
}

export function markShiftTaskRead(id) {
  const db = loadDb();
  const user = currentUser(db);
  const task = findTask(db, id);
  if (task.is_archived) throw createError('Consigne introuvable.', 404);

  const stamp = nowIso();
  const existing = db.reads.find((read) => read.task_id === task.id && read.user_id === user.id);
  const row = {
    task_id: task.id,
    user_id: user.id,
    task_updated_at: task.updated_at,
    read_at: stamp
  };

  if (existing) {
    Object.assign(existing, row);
  } else {
    db.reads.push(row);
  }
  saveDb(db);
  return { task_id: row.task_id, task_updated_at: row.task_updated_at, read_at: row.read_at };
}

export function markShiftTasksRead(ids) {
  const uniqueIds = [...new Set((ids || []).map(Number).filter(Boolean))];
  return uniqueIds.map((id) => markShiftTaskRead(id));
}

export function fetchContributionStats() {
  const db = loadDb();
  requireAdmin(db);

  const creators = groupCounts(db.tasks.map((task) => task.created_by_name || 'Non renseigné'));
  const finishers = groupCounts(
    db.tasks.filter((task) => task.completed_at).map((task) => task.completed_by_name || 'Non renseigné')
  );

  return { creators, finishers };
}

function groupCounts(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count || a.username.localeCompare(b.username))
    .slice(0, 12);
}

const staticDemoTasks = [
  ['Relancer proposition de réservation - Famille Martin', 'Devis envoyé pour 2 chambres communicantes.', -2, 'Urgente', 'Réservation', 'En attente', -9, -3],
  ['Demande client chambre 214 - oreiller ergonomique', 'Préparer un oreiller ergonomique avant retour client.', 0, 'Urgente', 'Client', 'À faire', -1, 0],
  ['Bagagerie à suivre - valise étiquette B-184', 'Vérifier la récupération prévue demain matin.', 1, 'Importante', 'Bagagerie', 'À faire', 0, 0],
  ['Ménage à suivre - chambre 306 lit bébé', 'Installer un lit bébé et deux serviettes supplémentaires.', 1, 'Importante', 'Ménage', 'À faire', -2, -1],
  ['Préparer arrivée groupe Séminaire Atlas', 'Vérifier clés, enveloppes d’accueil et badges.', 2, 'Urgente', 'Réservation', 'À faire', -4, -1],
  ['Relancer proposition de réservation - Société Novalink', 'Relance commerciale pour 6 chambres single.', 3, 'Importante', 'Réservation', 'En attente', -6, -2],
  ['Ménage à suivre - contrôle chambre 512 VIP', 'Contrôle final chambre VIP avec amenities.', 4, 'Urgente', 'Ménage', 'En cours', -3, -1],
  ['Maintenance à traiter - fuite lavabo chambre 109', 'Prévenir maintenance et suivre l’intervention.', 0, 'Urgente', 'Maintenance', 'En cours', -1, 0],
  ['Facturation à vérifier - acompte dossier Durand', 'Acompte reçu mais non rapproché.', -1, 'Urgente', 'Facturation', 'En cours', -5, -2],
  ['Consigne direction - préparer chiffres semaine', 'Préparer occupation, ADR, RevPAR et no-show.', 1, 'Urgente', 'Direction', 'En cours', -3, -1],
  ['Autre - déposer courrier fournisseur', 'Courrier à remettre au responsable achats.', 0, 'Normale', 'Autre', 'À faire', 0, 0],
  ['Demande client - réservation spa chambre 305', 'Proposer deux créneaux disponibles.', 14, 'Normale', 'Client', 'À faire', -1, -1],
  ['Proposition réservation archivée - Famille Nguyen', 'Proposition refusée, dossier clôturé.', -12, 'Normale', 'Réservation', 'Fait', -18, -9, -9, -7],
  ['Maintenance archivée - joint douche chambre 208', 'Intervention terminée et chambre remise en vente.', -10, 'Importante', 'Maintenance', 'Fait', -14, -8, -8, -6],
  ['Facturation archivée - facture société Helios', 'Facture envoyée et validée par le client.', -8, 'Normale', 'Facturation', 'Fait', -12, -6, -6, -4]
];

function removeDemoRows(db) {
  const ids = new Set(db.tasks.filter((task) => task.is_demo).map((task) => task.id));
  if (ids.size === 0) return 0;
  db.tasks = db.tasks.filter((task) => !ids.has(task.id));
  db.histories = db.histories.filter((history) => !ids.has(history.task_id));
  db.reads = db.reads.filter((read) => !ids.has(read.task_id));
  return ids.size;
}

export function seedDemoTasks() {
  const db = loadDb();
  requireAdmin(db);
  const removed = removeDemoRows(db);

  for (const row of staticDemoTasks) {
    const [
      title,
      description,
      dueOffset,
      priority,
      category,
      status,
      createdOffset,
      updatedOffset,
      completedOffset,
      archivedOffset
    ] = row;
    const completedAt = status === 'Fait' ? relativeStamp(completedOffset ?? updatedOffset, 16, 45) : null;
    const archivedAt = archivedOffset !== undefined ? relativeStamp(archivedOffset, 9, 20) : null;
    const task = {
      id: db.nextTaskId++,
      title,
      description,
      due_date: dueOffset === null ? null : relativeDate(dueOffset),
      priority,
      category,
      status,
      created_at: relativeStamp(createdOffset, 8, 30),
      updated_at: relativeStamp(updatedOffset, 15, 15),
      completed_at: completedAt,
      archived_at: archivedAt,
      is_archived: Boolean(archivedAt),
      created_by_user_id: null,
      created_by_name: 'Démo',
      completed_by_user_id: null,
      completed_by_name: completedAt ? 'Démo' : null,
      is_demo: true
    };

    db.tasks.push(task);
    recordHistory(db, task.id, 'Création jeu de démonstration', null, null, task.title, task.created_at);
    if (task.status !== 'À faire') {
      recordHistory(db, task.id, 'Statut initial', 'status', 'À faire', task.status, task.updated_at);
    }
    if (task.is_archived) {
      recordHistory(db, task.id, 'Archive de démonstration', 'is_archived', 0, 1, task.archived_at);
    }
  }

  runAutomationsInDb(db);
  saveDb(db);
  return demoResult(db, removed, staticDemoTasks.length);
}

export function removeDemoTasks() {
  const db = loadDb();
  requireAdmin(db);
  const removed = removeDemoRows(db);
  saveDb(db);
  return demoResult(db, removed, 0);
}

function demoResult(db, removed, inserted) {
  return {
    database: 'localStorage GitHub Pages',
    inserted,
    removed,
    activeCount: db.tasks.filter((task) => !task.is_archived).length,
    archivedCount: db.tasks.filter((task) => task.is_archived).length,
    byStatus: groupCounts(db.tasks.filter((task) => !task.is_archived).map((task) => task.status)).map(
      ({ username, count }) => ({ status: username, count })
    )
  };
}

export function downloadAdminFile(path) {
  const db = loadDb();
  requireAdmin(db);
  const url = new URL(path, 'https://static.local');
  const scope = url.searchParams.get('scope') || 'all';
  const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv';
  const stamp = new Date().toISOString().slice(0, 10);

  if (url.pathname.endsWith('/backup')) {
    return {
      filename: `overview-reception-static-backup-${stamp}.json`,
      blob: new Blob([JSON.stringify(db, null, 2)], { type: 'application/json;charset=utf-8' })
    };
  }

  const tasks = db.tasks.filter((task) => {
    if (scope === 'active') return !task.is_archived;
    if (scope === 'archived') return task.is_archived;
    return true;
  });

  if (format === 'json') {
    return {
      filename: `overview-reception-${scope}-${stamp}.json`,
      blob: new Blob([JSON.stringify(tasks.map(mapTask), null, 2)], {
        type: 'application/json;charset=utf-8'
      })
    };
  }

  return {
    filename: `overview-reception-${scope}-${stamp}.csv`,
    blob: new Blob([toCsv(tasks)], { type: 'text/csv;charset=utf-8' })
  };
}

function toCsv(rows) {
  const fields = [
    'id',
    'title',
    'description',
    'due_date',
    'priority',
    'category',
    'status',
    'created_at',
    'updated_at',
    'completed_at',
    'archived_at',
    'is_archived',
    'created_by_name',
    'completed_by_name'
  ];

  return `\ufeff${[
    fields.join(','),
    ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(','))
  ].join('\n')}`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}
