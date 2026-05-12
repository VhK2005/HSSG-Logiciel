import crypto from 'node:crypto';

import { db } from './db.js';

const SESSION_HOURS = 16;
const DEFAULT_ADMIN_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'Admin';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
const ROLES = ['admin', 'reception'];

const selectUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const insertUser = db.prepare(`
  INSERT INTO users (username, password_hash, role, is_active, created_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?)
`);
const insertSession = db.prepare(`
  INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);
const deleteSession = db.prepare('DELETE FROM user_sessions WHERE token_hash = ?');
const deleteSessionsByUser = db.prepare('DELETE FROM user_sessions WHERE user_id = ?');
const deleteExpiredSessions = db.prepare('DELETE FROM user_sessions WHERE expires_at <= ?');
const updateLastLogin = db.prepare(`
  UPDATE users
  SET last_login_at = ?, updated_at = ?
  WHERE id = ?
`);
const updateUserAccount = db.prepare(`
  UPDATE users
  SET role = ?, is_active = ?, updated_at = ?
  WHERE id = ?
`);
const updateUserPassword = db.prepare(`
  UPDATE users
  SET password_hash = ?, updated_at = ?
  WHERE id = ?
`);
const countOtherActiveAdmins = db.prepare(`
  SELECT COUNT(*) AS count
  FROM users
  WHERE role = 'admin'
    AND is_active = 1
    AND id != ?
`);

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [method, salt, hash] = String(storedHash || '').split(':');
  if (method !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
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

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const stamp = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  insertSession.run(hashToken(token), user.id, stamp, expiresAt);
  return { token, expires_at: expiresAt };
}

function ensureDefaultAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (count > 0) return;

  const stamp = nowIso();
  insertUser.run(
    DEFAULT_ADMIN_USERNAME,
    hashPassword(DEFAULT_ADMIN_PASSWORD),
    'admin',
    stamp,
    stamp
  );
}

ensureDefaultAdmin();

export function login(req, res) {
  const username = cleanText(req.body?.username);
  const password = String(req.body?.password || '');
  const user = username ? selectUserByUsername.get(username) : null;

  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: 'Identifiants incorrects.' });
  }

  deleteExpiredSessions.run(nowIso());
  const stamp = nowIso();
  updateLastLogin.run(stamp, stamp, user.id);
  const freshUser = selectUserById.get(user.id);
  const session = createSession(freshUser);
  return res.json({
    token: session.token,
    expires_at: session.expires_at,
    user: sanitizeUser(freshUser)
  });
}

export function logout(req, res) {
  const token = readToken(req);
  if (token) {
    deleteSession.run(hashToken(token));
  }
  res.status(204).end();
}

function readToken(req) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  return req.headers['x-access-token'] || bearer || null;
}

export function requireAccess(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Veuillez vous connecter.' });
  }

  deleteExpiredSessions.run(nowIso());
  const session = db
    .prepare(
      `
      SELECT user_sessions.*, users.username, users.role, users.is_active,
             users.created_at, users.updated_at, users.last_login_at
      FROM user_sessions
      JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.token_hash = ?
        AND user_sessions.expires_at > ?
        AND users.is_active = 1
    `
    )
    .get(hashToken(token), nowIso());

  if (!session) {
    return res.status(401).json({ message: 'Session expirée. Veuillez vous reconnecter.' });
  }

  req.user = sanitizeUser({
    id: session.user_id,
    username: session.username,
    role: session.role,
    is_active: session.is_active,
    created_at: session.created_at,
    updated_at: session.updated_at,
    last_login_at: session.last_login_at
  });
  return next();
}

export function requireAdmin(req, res, next) {
  return requireAccess(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé à l’administrateur.' });
    }
    return next();
  });
}

export function me(req, res) {
  res.json({ user: req.user });
}

export function listUsers() {
  return db
    .prepare(
      `
      SELECT id, username, role, is_active, created_at, updated_at, last_login_at
      FROM users
      ORDER BY role ASC, username COLLATE NOCASE ASC
    `
    )
    .all()
    .map(sanitizeUser);
}

export function createUser(payload) {
  const username = cleanText(payload.username);
  const password = String(payload.password || '');
  const role = ROLES.includes(payload.role) ? payload.role : 'reception';

  if (!username) {
    const error = new Error('Le nom utilisateur est obligatoire.');
    error.status = 400;
    throw error;
  }

  if (password.length < 4) {
    const error = new Error('Le mot de passe doit contenir au moins 4 caractères.');
    error.status = 400;
    throw error;
  }

  if (selectUserByUsername.get(username)) {
    const error = new Error('Ce nom utilisateur existe déjà.');
    error.status = 409;
    throw error;
  }

  const stamp = nowIso();
  const result = insertUser.run(username, hashPassword(password), role, stamp, stamp);
  return sanitizeUser(selectUserById.get(result.lastInsertRowid));
}

export function updateUser(id, payload, currentUser) {
  const user = selectUserById.get(id);
  if (!user) {
    const error = new Error('Compte introuvable.');
    error.status = 404;
    throw error;
  }

  const nextRole = ROLES.includes(payload.role) ? payload.role : user.role;
  const hasActiveFlag = typeof payload.is_active === 'boolean';
  const nextActive = hasActiveFlag ? (payload.is_active ? 1 : 0) : user.is_active ? 1 : 0;
  const wantsPassword = Object.prototype.hasOwnProperty.call(payload, 'password');
  const password = String(payload.password || '');

  if (wantsPassword && password.length < 4) {
    const error = new Error('Le mot de passe doit contenir au moins 4 caractères.');
    error.status = 400;
    throw error;
  }

  if (currentUser?.id === id && !nextActive) {
    const error = new Error('Vous ne pouvez pas désactiver votre propre compte.');
    error.status = 400;
    throw error;
  }

  if (currentUser?.id === id && user.role === 'admin' && nextRole !== 'admin') {
    const error = new Error('Vous ne pouvez pas retirer votre propre rôle administrateur.');
    error.status = 400;
    throw error;
  }

  if ((user.role === 'admin' || nextRole === 'admin') && (nextRole !== 'admin' || !nextActive)) {
    const otherAdmins = countOtherActiveAdmins.get(id).count;
    if (otherAdmins === 0) {
      const error = new Error('Impossible de retirer le dernier administrateur actif.');
      error.status = 400;
      throw error;
    }
  }

  const stamp = nowIso();
  const transaction = db.transaction(() => {
    updateUserAccount.run(nextRole, nextActive, stamp, id);
    if (wantsPassword) {
      updateUserPassword.run(hashPassword(password), stamp, id);
    }
    if (!nextActive) {
      deleteSessionsByUser.run(id);
    }
  });

  transaction();
  return sanitizeUser(selectUserById.get(id));
}
