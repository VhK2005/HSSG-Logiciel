import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createUser,
  listUsers,
  login,
  logout,
  me,
  requireAccess,
  requireAdmin,
  updateUser
} from './auth.js';
import { db, getDatabasePath } from './db.js';
import { removeDemoData, seedDemoData } from './seedDemo.js';
import { getAdminSettings, saveAdminSettings } from './settingsService.js';
import {
  createTask,
  deleteTask,
  listActiveTasks,
  listArchivedTasks,
  listWorkspaceTasks,
  listTaskHistory,
  listTaskReadStatus,
  markTaskRead,
  markTasksRead,
  getContributionStats,
  restoreTask,
  runAutomations,
  updateTask
} from './tasksService.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '..', 'dist');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

runAutomations();
setInterval(runAutomations, 60 * 60 * 1000);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: getDatabasePath() });
});

app.post('/api/auth/login', login);
app.post('/api/auth/logout', requireAccess, logout);
app.get('/api/auth/me', requireAccess, me);

app.get('/api/admin/settings', requireAccess, (_req, res, next) => {
  try {
    res.json(getAdminSettings());
  } catch (error) {
    next(error);
  }
});

app.get('/api/bootstrap', requireAccess, (_req, res, next) => {
  try {
    res.json({
      ...listWorkspaceTasks(),
      settings: getAdminSettings()
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/settings', requireAdmin, (req, res, next) => {
  try {
    res.json(saveAdminSettings(req.body));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/users', requireAdmin, (_req, res, next) => {
  try {
    res.json(listUsers());
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/users', requireAdmin, (req, res, next) => {
  try {
    res.status(201).json(createUser(req.body));
  } catch (error) {
    next(error);
  }
});

app.put('/api/admin/users/:id', requireAdmin, (req, res, next) => {
  try {
    res.json(updateUser(Number(req.params.id), req.body, req.user));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/contribution-stats', requireAdmin, (_req, res, next) => {
  try {
    res.json(getContributionStats());
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/seed-demo', requireAdmin, (_req, res, next) => {
  try {
    res.json(seedDemoData());
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/remove-demo', requireAdmin, (_req, res, next) => {
  try {
    res.json(removeDemoData());
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/export', requireAdmin, (req, res, next) => {
  try {
    const scope = ['active', 'archived', 'all'].includes(req.query.scope)
      ? req.query.scope
      : 'all';
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const tasks = getTasksForExport(scope);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="overview-reception-${scope}-${stamp}.json"`
      );
      res.send(JSON.stringify(tasks, null, 2));
      return;
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="overview-reception-${scope}-${stamp}.csv"`
    );
    res.send(toCsv(tasks));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/backup', requireAdmin, async (_req, res, next) => {
  try {
    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `hotel-overview-${stamp}.sqlite`);
    await db.backup(backupPath);
    res.download(backupPath);
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks', requireAccess, (_req, res, next) => {
  try {
    res.json(listActiveTasks());
  } catch (error) {
    next(error);
  }
});

function getTasksForExport(scope) {
  const where =
    scope === 'active'
      ? 'WHERE is_archived = 0'
      : scope === 'archived'
        ? 'WHERE is_archived = 1'
        : '';

  return db
    .prepare(`
      SELECT id, title, description, due_date, priority, category, status,
             created_at, updated_at, completed_at, archived_at, is_archived,
             created_by_name, completed_by_name
      FROM tasks
      ${where}
      ORDER BY is_archived ASC,
               CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
               due_date ASC,
               updated_at DESC
    `)
    .all();
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
  const lines = [fields.join(',')];

  for (const row of rows) {
    lines.push(fields.map((field) => csvCell(row[field])).join(','));
  }

  return `\ufeff${lines.join('\n')}`;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  return `"${String(value).replaceAll('"', '""')}"`;
}

app.get('/api/tasks/archived', requireAccess, (_req, res, next) => {
  try {
    res.json(listArchivedTasks());
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/read-status', requireAccess, (req, res, next) => {
  try {
    res.json(listTaskReadStatus(req.user));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/read-status', requireAccess, (req, res, next) => {
  try {
    res.json(markTasksRead(req.body?.ids, req.user));
  } catch (error) {
    next(error);
  }
});

app.get('/api/tasks/:id/history', requireAccess, (req, res, next) => {
  try {
    res.json(listTaskHistory(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/read', requireAccess, (req, res, next) => {
  try {
    res.json(markTaskRead(Number(req.params.id), req.user));
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks', requireAccess, (req, res, next) => {
  try {
    res.status(201).json(createTask(req.body, req.user));
  } catch (error) {
    next(error);
  }
});

app.put('/api/tasks/:id', requireAccess, (req, res, next) => {
  try {
    res.json(updateTask(Number(req.params.id), req.body, req.user));
  } catch (error) {
    next(error);
  }
});

app.delete('/api/tasks/:id', requireAccess, (req, res, next) => {
  try {
    deleteTask(Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/tasks/:id/restore', requireAccess, (req, res, next) => {
  try {
    res.json(restoreTask(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Erreur serveur.' : error.message
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Overview Réception Hôtel écoute sur http://localhost:${port}`);
});
