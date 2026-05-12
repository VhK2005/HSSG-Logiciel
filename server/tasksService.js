import { db } from './db.js';

export const STATUSES = ['À faire', 'En cours', 'En attente', 'Fait'];
export const PRIORITIES = ['Normale', 'Importante', 'Urgente'];
export const CATEGORIES = [
  'Client',
  'Maintenance',
  'Facturation',
  'Ménage',
  'Réservation',
  'Bagagerie',
  'Direction',
  'Autre'
];

const selectTaskById = db.prepare('SELECT * FROM tasks WHERE id = ?');
const insertHistory = db.prepare(`
  INSERT INTO task_history (task_id, action, field, old_value, new_value, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const upsertTaskRead = db.prepare(`
  INSERT INTO task_reads (task_id, user_id, task_updated_at, read_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(task_id, user_id) DO UPDATE SET
    task_updated_at = excluded.task_updated_at,
    read_at = excluded.read_at
`);

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function normalizeDate(value) {
  if (!value) return null;
  if (typeof value !== 'string') return null;
  return value.slice(0, 10);
}

function ensureAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function mapTask(row) {
  return {
    ...row,
    is_archived: Boolean(row.is_archived)
  };
}

function taskActor(user) {
  return {
    id: user?.id || null,
    name: user?.username || 'Système'
  };
}

function stringifyHistoryValue(value) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function recordHistory(taskId, action, field, oldValue, newValue, stamp = nowIso()) {
  insertHistory.run(
    taskId,
    action,
    field || null,
    stringifyHistoryValue(oldValue),
    stringifyHistoryValue(newValue),
    stamp
  );
}

function recordFieldChanges(taskId, action, before, after, fields, stamp = nowIso()) {
  for (const field of fields) {
    const oldValue = before?.[field] ?? null;
    const newValue = after?.[field] ?? null;
    if (oldValue !== newValue) {
      recordHistory(taskId, action, field, oldValue, newValue, stamp);
    }
  }
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntilDueDate(dueDate) {
  const due = new Date(`${dueDate}T00:00:00`);
  const today = startOfLocalDay();
  return Math.floor((due - today) / 86400000);
}

export function runAutomations() {
  const stamp = nowIso();
  const archiveThreshold = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const completedToArchive = db.prepare(`
    SELECT * FROM tasks
    WHERE is_archived = 0
      AND status = 'Fait'
      AND completed_at IS NOT NULL
      AND completed_at <= ?
  `);

  const archiveCompleted = db.prepare(`
    UPDATE tasks
    SET is_archived = 1,
        archived_at = ?,
        updated_at = ?
    WHERE is_archived = 0
      AND status = 'Fait'
      AND completed_at IS NOT NULL
      AND completed_at <= ?
  `);

  const candidates = db.prepare(`
    SELECT id, due_date, status
    FROM tasks
    WHERE is_archived = 0
      AND status IN ('En attente', 'En cours')
      AND due_date IS NOT NULL
  `);

  const moveToTodo = db.prepare(`
    UPDATE tasks
    SET status = 'À faire',
        updated_at = ?
    WHERE id = ?
  `);

  const tx = db.transaction(() => {
    const archivableTasks = completedToArchive.all(archiveThreshold);
    archiveCompleted.run(stamp, stamp, archiveThreshold);
    for (const task of archivableTasks) {
      recordHistory(task.id, 'Archivage automatique', 'is_archived', 0, 1, stamp);
      recordHistory(task.id, 'Archivage automatique', 'archived_at', null, stamp, stamp);
    }

    for (const task of candidates.all()) {
      const days = daysUntilDueDate(task.due_date);
      if (days === 1) {
        moveToTodo.run(stamp, task.id);
        recordHistory(task.id, 'Automatisation échéance', 'status', task.status, 'À faire', stamp);
      }
    }
  });

  tx();
}

export function listActiveTasks({ runAutomation = true } = {}) {
  if (runAutomation) runAutomations();
  return db
    .prepare(`
      SELECT * FROM tasks
      WHERE is_archived = 0
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        updated_at DESC
    `)
    .all()
    .map(mapTask);
}

export function listArchivedTasks({ runAutomation = true } = {}) {
  if (runAutomation) runAutomations();
  return db
    .prepare(`
      SELECT * FROM tasks
      WHERE is_archived = 1
      ORDER BY archived_at DESC, completed_at DESC, updated_at DESC
    `)
    .all()
    .map(mapTask);
}

export function listWorkspaceTasks() {
  runAutomations();
  return {
    tasks: listActiveTasks({ runAutomation: false }),
    archivedTasks: listArchivedTasks({ runAutomation: false })
  };
}

export function createTask(payload, user) {
  const title = cleanText(payload.title);
  if (!title) {
    const error = new Error('Le titre est obligatoire.');
    error.status = 400;
    throw error;
  }

  const stamp = nowIso();
  const actor = taskActor(user);
  const status = ensureAllowed(payload.status, STATUSES, 'À faire');
  const completedAt = status === 'Fait' ? stamp : null;
  const completedById = status === 'Fait' ? actor.id : null;
  const completedByName = status === 'Fait' ? actor.name : null;

  const result = db
    .prepare(`
      INSERT INTO tasks (
        title, description, due_date, priority, category, status,
        created_at, updated_at, completed_at, archived_at, is_archived,
        created_by_user_id, created_by_name, completed_by_user_id, completed_by_name
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)
    `)
    .run(
      title,
      cleanText(payload.description),
      normalizeDate(payload.due_date),
      ensureAllowed(payload.priority, PRIORITIES, 'Normale'),
      ensureAllowed(payload.category, CATEGORIES, 'Autre'),
      status,
      stamp,
      stamp,
      completedAt,
      actor.id,
      actor.name,
      completedById,
      completedByName
    );

  const created = mapTask(selectTaskById.get(result.lastInsertRowid));
  recordHistory(created.id, `Création par ${actor.name}`, null, null, created.title, stamp);
  return created;
}

export function updateTask(id, payload, user) {
  const current = selectTaskById.get(id);
  if (!current) {
    const error = new Error('Consigne introuvable.');
    error.status = 404;
    throw error;
  }

  const nextStatus = payload.status !== undefined
    ? ensureAllowed(payload.status, STATUSES, current.status)
    : current.status;

  const actor = taskActor(user);
  let completedAt = current.completed_at;
  let completedByUserId = current.completed_by_user_id;
  let completedByName = current.completed_by_name;
  if (nextStatus === 'Fait' && current.status !== 'Fait') {
    completedAt = nowIso();
    completedByUserId = actor.id;
    completedByName = actor.name;
  }
  if (nextStatus !== 'Fait' && current.status === 'Fait') {
    completedAt = null;
    completedByUserId = null;
    completedByName = null;
  }

  const stamp = nowIso();
  const next = {
    title: payload.title !== undefined ? cleanText(payload.title, current.title) : current.title,
    description:
      payload.description !== undefined ? cleanText(payload.description) : current.description,
    due_date: payload.due_date !== undefined ? normalizeDate(payload.due_date) : current.due_date,
    priority:
      payload.priority !== undefined
        ? ensureAllowed(payload.priority, PRIORITIES, current.priority)
        : current.priority,
    category:
      payload.category !== undefined
        ? ensureAllowed(payload.category, CATEGORIES, current.category)
        : current.category,
    status: nextStatus
  };

  if (!next.title) {
    const error = new Error('Le titre est obligatoire.');
    error.status = 400;
    throw error;
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?,
        description = ?,
        due_date = ?,
        priority = ?,
        category = ?,
        status = ?,
        updated_at = ?,
        completed_at = ?,
        completed_by_user_id = ?,
        completed_by_name = ?
    WHERE id = ?
  `).run(
    next.title,
    next.description,
    next.due_date,
    next.priority,
    next.category,
    next.status,
    stamp,
    completedAt,
    completedByUserId,
    completedByName,
    id
  );

  const updated = mapTask(selectTaskById.get(id));
  recordFieldChanges(
    id,
    'Modification',
    current,
    updated,
    [
      'title',
      'description',
      'due_date',
      'priority',
      'category',
      'status',
      'completed_at',
      'completed_by_name'
    ],
    stamp
  );
  return updated;
}

export function deleteTask(id) {
  const result = db.transaction(() => {
    db.prepare('DELETE FROM task_reads WHERE task_id = ?').run(id);
    return db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  })();
  if (result.changes === 0) {
    const error = new Error('Consigne introuvable.');
    error.status = 404;
    throw error;
  }
}

export function restoreTask(id) {
  const current = selectTaskById.get(id);
  if (!current || !current.is_archived) {
    const error = new Error('Archive introuvable.');
    error.status = 404;
    throw error;
  }

  const stamp = nowIso();
  db.prepare(`
    UPDATE tasks
    SET status = 'À faire',
        completed_at = NULL,
        completed_by_user_id = NULL,
        completed_by_name = NULL,
        archived_at = NULL,
        is_archived = 0,
        updated_at = ?
    WHERE id = ?
  `).run(stamp, id);

  const restored = mapTask(selectTaskById.get(id));
  recordHistory(id, 'Restauration', 'is_archived', 1, 0, stamp);
  recordHistory(id, 'Restauration', 'status', current.status, restored.status, stamp);
  return restored;
}

export function listTaskHistory(id) {
  const current = selectTaskById.get(id);
  if (!current) {
    const error = new Error('Consigne introuvable.');
    error.status = 404;
    throw error;
  }

  return db
    .prepare(`
      SELECT * FROM task_history
      WHERE task_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(id);
}

export function listTaskReadStatus(user) {
  if (!user?.id) return [];

  return db
    .prepare(
      `
      SELECT task_id, task_updated_at, read_at
      FROM task_reads
      WHERE user_id = ?
    `
    )
    .all(user.id);
}

export function markTaskRead(id, user) {
  const current = selectTaskById.get(id);
  if (!current || current.is_archived) {
    const error = new Error('Consigne introuvable.');
    error.status = 404;
    throw error;
  }

  const stamp = nowIso();
  upsertTaskRead.run(id, user.id, current.updated_at, stamp);
  return {
    task_id: id,
    task_updated_at: current.updated_at,
    read_at: stamp
  };
}

export function markTasksRead(ids, user) {
  const uniqueIds = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const tx = db.transaction(() => uniqueIds.map((id) => markTaskRead(id, user)));
  return tx();
}

export function getContributionStats() {
  const creators = db
    .prepare(
      `
      SELECT COALESCE(created_by_name, 'Non renseigné') AS username, COUNT(*) AS count
      FROM tasks
      GROUP BY COALESCE(created_by_name, 'Non renseigné')
      ORDER BY count DESC, username ASC
      LIMIT 12
    `
    )
    .all();

  const finishers = db
    .prepare(
      `
      SELECT COALESCE(completed_by_name, 'Non renseigné') AS username, COUNT(*) AS count
      FROM tasks
      WHERE completed_at IS NOT NULL
      GROUP BY COALESCE(completed_by_name, 'Non renseigné')
      ORDER BY count DESC, username ASC
      LIMIT 12
    `
    )
    .all();

  return { creators, finishers };
}
