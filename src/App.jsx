import {
  Archive,
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Columns3,
  Home,
  Lock,
  LogOut,
  Plus,
  Search,
  Settings,
  X
} from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';

import {
  clearAccessToken,
  createTask,
  createAdminUser,
  deleteTask,
  downloadAdminFile,
  fetchAdminUsers,
  fetchContributionStats,
  fetchCurrentUser,
  fetchWorkspaceData,
  getStoredToken,
  loginUser,
  logoutUser,
  removeDemoTasks,
  restoreTask,
  saveAdminSettings,
  seedDemoTasks,
  updateAdminUser,
  updateTask
} from './api.js';
import Admin from './components/Admin.jsx';
import Archives from './components/Archives.jsx';
import CalendarView from './components/CalendarView.jsx';
import Checklists from './components/Checklists.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Kanban from './components/Kanban.jsx';
import Overview from './components/Overview.jsx';
import PersonalStats from './components/PersonalStats.jsx';
import Register from './components/Register.jsx';
import TaskModal from './components/TaskModal.jsx';
import {
  CATEGORIES,
  PRIORITIES,
  STATUS_LABELS
} from './constants.js';
import { DEFAULT_ADMIN_SETTINGS } from './templateDefaults.js';
import { readStorage, writeStorage } from './safeStorage.js';
import {
  isDueInKanbanWindow,
  isHiddenFromKanban,
  isVisibleInKanban,
  matchesTask,
  daysUntil,
  isOverdue,
  tomorrowDateInputValue
} from './utils.js';

const emptyFilters = {
  search: '',
  priority: 'Toutes',
  category: 'Toutes'
};

const PAGE_DESCRIPTIONS = {
  overview: 'Vue rapide des urgences, retards et volumes du jour.',
  personal: 'Mes créations, finalisations et priorités à reprendre.',
  checklists: 'Routines matin, après-midi et nuit à cocher pendant le shift.',
  kanban: 'Suivi court terme des consignes à traiter rapidement.',
  register: 'Toutes les consignes hors Kanban restent accessibles ici.',
  calendar: 'Lecture mensuelle des échéances et relances à venir.',
  archives: 'Historique des consignes terminées et restaurables.',
  admin: 'Comptes, statistiques équipe, réglages et sauvegardes.'
};

const NOTIFICATION_KEY = 'overviewReceptionBrowserNotifications';
const AUTO_REFRESH_MS = 15000;

function AuthGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    if (!getStoredToken()) {
      setChecking(false);
      return undefined;
    }

    fetchCurrentUser()
      .then((data) => {
        if (!mounted) return;
        setCurrentUser(data.user);
      })
      .catch((err) => {
        if (!mounted) return;
        clearAccessToken();
        setError(err.status === 401 ? '' : err.message);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function submitPassword(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await loginUser(username, password);
      setCurrentUser(data.user);
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  function lock() {
    logoutUser().finally(() => {
      clearAccessToken();
      setCurrentUser(null);
      setPassword('');
    });
  }

  if (checking) {
    return (
      <div className="auth-shell">
        <div className="auth-stage">
          <div className="auth-showcase">
            <div className="brand-mark">ORH</div>
            <h1>Overview Réception Hôtel</h1>
            <span>Chargement de l’espace réception...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-shell">
        <div className="auth-stage">
          <section className="auth-showcase" aria-hidden="true">
            <div className="brand-mark">ORH</div>
            <h1>Overview Réception Hôtel</h1>
            <span>Réception · Direction · Checklists</span>
            <div className="auth-board">
              <i>
                <strong>Checklist</strong>
                <span>Shift matin</span>
              </i>
              <i>
                <strong>Relance</strong>
                <span>J-1</span>
              </i>
              <i>
                <strong>Urgent</strong>
                <span>Client VIP</span>
              </i>
              <i>
                <strong>Fait</strong>
                <span>Archivé</span>
              </i>
            </div>
          </section>

          <form className="auth-panel" onSubmit={submitPassword}>
            <div className="auth-panel-head">
              <div className="brand-mark">ORH</div>
              <div>
                <p className="eyebrow">Accès sécurisé</p>
                <h1>Connexion</h1>
              </div>
            </div>
            <p className="auth-intro">Overview Réception Hôtel</p>
            <label htmlFor="access-username">Utilisateur</label>
            <div className="password-row">
              <Lock size={18} aria-hidden="true" />
              <input
                id="access-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Admin"
                autoFocus
              />
            </div>
            <label htmlFor="access-password">Mot de passe</label>
            <div className="password-row">
              <Lock size={18} aria-hidden="true" />
              <input
                id="access-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="admin"
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-action" type="submit">
              Ouvrir
            </button>
          </form>
        </div>
      </div>
    );
  }

  return children({ lock, currentUser });
}

function FilterBar({ filters, onChange, categoryOptions = CATEGORIES }) {
  const hasActiveFilters =
    filters.search.trim() ||
    filters.priority !== 'Toutes' ||
    filters.category !== 'Toutes';

  return (
    <div className={`filter-bar ${hasActiveFilters ? 'has-active-filters' : ''}`}>
      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          placeholder="Rechercher une consigne"
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      </label>

      <select
        value={filters.priority}
        onChange={(event) => onChange({ ...filters, priority: event.target.value })}
        aria-label="Filtrer par priorité"
      >
        <option>Toutes</option>
        {PRIORITIES.map((priority) => (
          <option key={priority}>{priority}</option>
        ))}
      </select>

      <select
        value={filters.category}
        onChange={(event) => onChange({ ...filters, category: event.target.value })}
        aria-label="Filtrer par catégorie"
      >
        <option>Toutes</option>
        {categoryOptions.map((category) => (
          <option key={category}>{category}</option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          className="ghost-action filter-clear"
          type="button"
          onClick={() => onChange(emptyFilters)}
        >
          <X size={15} aria-hidden="true" />
          Effacer
        </button>
      )}
    </div>
  );
}

function SidebarClock() {
  const [now, setNow] = useState(new Date());
  const [mode, setMode] = useState('analog');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;
  const digitalTime = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(now);
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  }).format(now);

  return (
    <button
      className={`sidebar-clock ${mode}`}
      type="button"
      onClick={() => setMode((current) => (current === 'analog' ? 'digital' : 'analog'))}
      aria-label={`Horloge ${digitalTime}`}
    >
      {mode === 'analog' ? (
        <>
          <span
            className="clock-face"
            style={{
              '--hour-angle': `${hourAngle}deg`,
              '--minute-angle': `${minuteAngle}deg`,
              '--second-angle': `${secondAngle}deg`
            }}
          >
            <span className="clock-mark twelve">12</span>
            <span className="clock-mark three">3</span>
            <span className="clock-mark six">6</span>
            <span className="clock-mark nine">9</span>
            <span className="clock-hand hour" />
            <span className="clock-hand minute" />
            <span className="clock-hand second" />
            <span className="clock-pin" />
          </span>
          <span className="clock-caption">{dateLabel}</span>
        </>
      ) : (
        <span className="clock-digital">
          <strong>{digitalTime}</strong>
          <span>{dateLabel}</span>
        </span>
      )}
    </button>
  );
}

function AlertBanner({ alertCounts, onNavigate }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return readStorage(NOTIFICATION_KEY) === '1';
  });
  const [lastSignature, setLastSignature] = useState('');
  const totalAlerts = alertCounts.overdue + alertCounts.j1 + alertCounts.urgent;
  const canUseNotifications =
    typeof window !== 'undefined' && 'Notification' in window;
  const notificationPermission = canUseNotifications ? window.Notification.permission : 'denied';

  useEffect(() => {
    if (!notificationsEnabled || !canUseNotifications || notificationPermission !== 'granted') return;
    if (totalAlerts === 0) return;

    const signature = `${alertCounts.overdue}-${alertCounts.j1}-${alertCounts.urgent}`;
    if (signature === lastSignature) return;

    new window.Notification('Overview Réception Hôtel', {
      body: `${alertCounts.overdue} retard · ${alertCounts.j1} J-1 · ${alertCounts.urgent} urgente(s)`
    });
    setLastSignature(signature);
  }, [alertCounts, canUseNotifications, lastSignature, notificationPermission, notificationsEnabled, totalAlerts]);

  async function enableNotifications() {
    if (!canUseNotifications) return;
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      writeStorage(NOTIFICATION_KEY, '1');
      setNotificationsEnabled(true);
    }
  }

  if (totalAlerts === 0) return null;

  return (
    <section className="alert-banner" aria-label="Alertes opérationnelles">
      <div className="alert-banner-main">
        <AlertTriangle size={18} aria-hidden="true" />
        <div>
          <strong>Attention réception</strong>
          <span>
            {alertCounts.overdue} retard · {alertCounts.j1} à J-1 · {alertCounts.urgent} urgente(s)
          </span>
        </div>
      </div>
      <div className="alert-banner-actions">
        {alertCounts.overdue > 0 && (
          <button type="button" onClick={() => onNavigate('calendar')}>
            Retards
          </button>
        )}
        {alertCounts.j1 > 0 && (
          <button type="button" onClick={() => onNavigate('kanban')}>
            J-1
          </button>
        )}
        {alertCounts.urgent > 0 && (
          <button type="button" onClick={() => onNavigate('overview')}>
            Urgences
          </button>
        )}
        {canUseNotifications && !notificationsEnabled && notificationPermission !== 'granted' && (
          <button type="button" className="notify-action" onClick={enableNotifications}>
            <Bell size={14} aria-hidden="true" />
            Notifications
          </button>
        )}
      </div>
    </section>
  );
}

function Shell({
  page,
  setPage,
  onCreate,
  onLock,
  currentUser,
  registerCount,
  alertCounts,
  children
}) {
  const todayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  }).format(new Date());
  const hasSidebarAlerts = alertCounts.overdue + alertCounts.j1 + alertCounts.urgent > 0;
  const nav = [
    { id: 'overview', icon: Home },
    { id: 'personal', icon: BarChart3 },
    { id: 'checklists', icon: ClipboardCheck },
    { id: 'kanban', icon: Columns3 },
    { id: 'register', icon: ClipboardList },
    { id: 'calendar', icon: CalendarDays },
    { id: 'archives', icon: Archive },
    { id: 'admin', icon: Settings }
  ].filter(
    (item) =>
      (item.id !== 'admin' || currentUser?.role === 'admin') &&
      (item.id !== 'personal' || currentUser?.role === 'reception')
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">ORH</div>
          <div>
            <strong>Overview</strong>
            <span>Réception Hôtel</span>
          </div>
        </div>

        <span className="nav-label">Espace de travail</span>
        <nav className="main-nav" aria-label="Navigation principale">
          {nav.map(({ id, icon: Icon }) => (
            <Fragment key={id}>
              <button
                className={page === id ? 'active' : ''}
                onClick={() => setPage(id)}
                type="button"
                aria-label={STATUS_LABELS[id]}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="nav-text">{STATUS_LABELS[id]}</span>
                {id === 'register' && registerCount > 0 && (
                  <strong className="nav-count">{registerCount}</strong>
                )}
              </button>
              {id === 'archives' && (
                <SidebarClock />
              )}
            </Fragment>
          ))}
        </nav>

        {hasSidebarAlerts && (
          <div className="sidebar-alerts" aria-label="Alertes rapides">
            <span className="nav-label">Alertes</span>
            <div className="sidebar-alert-grid">
              <button
                className="sidebar-alert danger"
                type="button"
                onClick={() => setPage('calendar')}
                aria-label={`${alertCounts.overdue} consignes en retard`}
              >
                <span className="nav-text">Retard</span>
                <strong>{alertCounts.overdue}</strong>
              </button>
              <button
                className="sidebar-alert warning"
                type="button"
                onClick={() => setPage('kanban')}
                aria-label={`${alertCounts.j1} consignes à J-1`}
              >
                <span className="nav-text">J-1</span>
                <strong>{alertCounts.j1}</strong>
              </button>
              <button
                className="sidebar-alert urgent"
                type="button"
                onClick={() => setPage('overview')}
                aria-label={`${alertCounts.urgent} consignes urgentes`}
              >
                <span className="nav-text">Urgent</span>
                <strong>{alertCounts.urgent}</strong>
              </button>
            </div>
          </div>
        )}

        <button
          className="ghost-action sidebar-lock"
          onClick={onLock}
          type="button"
          aria-label="Déconnexion"
        >
          <LogOut size={17} aria-hidden="true" />
          <span className="nav-text">Déconnexion</span>
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">Carnet de consignes numérique</p>
            <h1>{STATUS_LABELS[page]}</h1>
            <span>{PAGE_DESCRIPTIONS[page]}</span>
          </div>
          <div className="topbar-right">
            <div className="topbar-chip">
              <CalendarDays size={16} aria-hidden="true" />
              <span>{todayLabel}</span>
            </div>
            <div className="topbar-chip user-chip">
              <Lock size={16} aria-hidden="true" />
              <span>{currentUser?.username} · {currentUser?.role === 'admin' ? 'Admin' : 'Réception'}</span>
            </div>
            <div className="topbar-actions">
              <button className="primary-action" onClick={onCreate} type="button">
                <Plus size={18} aria-hidden="true" />
                Nouvelle consigne
              </button>
            </div>
          </div>
        </header>

        <AlertBanner alertCounts={alertCounts} onNavigate={setPage} />

        {children}
      </main>
    </div>
  );
}

function HotelApp({ onLock, currentUser }) {
  const [page, setPage] = useState('overview');
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [registerFilters, setRegisterFilters] = useState(emptyFilters);
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingTask, setEditingTask] = useState(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setError('');
    try {
      const data = await fetchWorkspaceData();
      setTasks(data.tasks);
      setArchivedTasks(data.archivedTasks);
      setSettings(data.settings);
    } catch (err) {
      if (err.status === 401) {
        onLock();
        return;
      }
      if (!silent) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onLock]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    function refreshSilently() {
      if (document.visibilityState !== 'visible' || editingTask || saving) return;
      loadData({ silent: true });
    }

    const timer = window.setInterval(refreshSilently, AUTO_REFRESH_MS);
    window.addEventListener('focus', refreshSilently);
    document.addEventListener('visibilitychange', refreshSilently);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshSilently);
      document.removeEventListener('visibilitychange', refreshSilently);
    };
  }, [editingTask, loadData, saving]);

  useEffect(() => {
    if (page === 'admin' && currentUser?.role !== 'admin') {
      setPage('overview');
    }
    if (page === 'personal' && currentUser?.role !== 'reception') {
      setPage('overview');
    }
  }, [page, currentUser]);

  const kanbanExcludedCategories = settings.kanbanExcludedCategories || [];
  const kanbanWindowDays = settings.kanbanWindowDays || 5;
  const kanbanVisibleCategories = useMemo(
    () => CATEGORIES.filter((category) => !kanbanExcludedCategories.includes(category)),
    [kanbanExcludedCategories]
  );
  const operationalTasks = useMemo(
    () => tasks.filter((task) => isVisibleInKanban(task, kanbanExcludedCategories)),
    [tasks, kanbanExcludedCategories]
  );
  const kanbanTasks = useMemo(
    () => operationalTasks.filter((task) => isDueInKanbanWindow(task, kanbanWindowDays)),
    [operationalTasks, kanbanWindowDays]
  );
  const registerTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          isHiddenFromKanban(task, kanbanExcludedCategories) ||
          !isDueInKanbanWindow(task, kanbanWindowDays)
      ),
    [tasks, kanbanExcludedCategories, kanbanWindowDays]
  );

  const filteredKanbanTasks = useMemo(
    () => kanbanTasks.filter((task) => matchesTask(task, filters)),
    [kanbanTasks, filters]
  );

  const filteredCalendarTasks = useMemo(
    () => operationalTasks.filter((task) => matchesTask(task, filters)),
    [operationalTasks, filters]
  );

  const filteredRegisterTasks = useMemo(
    () => registerTasks.filter((task) => matchesTask(task, registerFilters)),
    [registerTasks, registerFilters]
  );

  const registerCategoryOptions = useMemo(
    () =>
      CATEGORIES.filter((category) =>
        registerTasks.some((task) => task.category === category)
      ),
    [registerTasks]
  );

  const visibleRegisterCategories =
    registerCategoryOptions.length > 0 ? registerCategoryOptions : CATEGORIES;

  const alertCounts = useMemo(() => {
    const openTasks = tasks.filter((task) => task.status !== 'Fait');
    return {
      overdue: openTasks.filter(isOverdue).length,
      j1: openTasks.filter((task) => daysUntil(task.due_date) === 1).length,
      urgent: openTasks.filter((task) => task.priority === 'Urgente').length
    };
  }, [tasks]);

  async function saveTask(payload) {
    setSaving(true);
    setError('');
    try {
      if (payload.id) {
        await updateTask(payload.id, payload);
      } else {
        await createTask(payload);
      }
      setEditingTask(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Supprimer la consigne "${task.title}" ?`)) return;
    setError('');
    try {
      await deleteTask(task.id);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeStatus(task, status) {
    if (task.status === status) return;
    setError('');
    try {
      await updateTask(task.id, { status });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function changePriority(task, priority) {
    if (task.priority === priority) return;
    setError('');
    try {
      await updateTask(task.id, { priority });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function quickAction(task, action) {
    const stamp = new Date().toLocaleString('fr-FR');
    const currentDescription = task.description || '';
    const relanceLine = `[${stamp}] Relance effectuée.`;

    const updates = {
      done: { status: 'Fait' },
      tomorrow: { status: 'À faire', due_date: tomorrowDateInputValue() },
      waiting: { status: 'En attente' },
      followed: {
        status: 'En attente',
        description: currentDescription ? `${currentDescription}\n${relanceLine}` : relanceLine
      }
    };

    setError('');
    try {
      await updateTask(task.id, updates[action]);
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createFollowUp(task) {
    const defaultDate = tomorrowDateInputValue();
    const dueDate = window.prompt('Date de relance au format AAAA-MM-JJ', defaultDate);
    if (!dueDate) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('Date de relance invalide. Utilisez le format AAAA-MM-JJ.');
      return;
    }

    setError('');
    try {
      await createTask({
        title: `Relance - ${task.title}`,
        description: `Relance créée depuis la consigne #${task.id}.\n${task.description || ''}`.trim(),
        due_date: dueDate,
        priority: task.priority,
        category: task.category,
        status: 'À faire'
      });
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function restoreArchived(task) {
    setError('');
    try {
      const restored = await restoreTask(task.id);
      await loadData();
      setPage(
        isHiddenFromKanban(restored, kanbanExcludedCategories) ||
          !isDueInKanbanWindow(restored, kanbanWindowDays)
          ? 'register'
          : 'kanban'
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function persistSettings(nextSettings) {
    const savedSettings = await saveAdminSettings(nextSettings);
    setSettings(savedSettings);
    return savedSettings;
  }

  async function seedDemo() {
    const result = await seedDemoTasks();
    await loadData();
    return result;
  }

  async function removeDemo() {
    const result = await removeDemoTasks();
    await loadData();
    return result;
  }

  async function downloadFile(path) {
    const { blob, filename } = await downloadAdminFile(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function downloadExport(scope, format) {
    return downloadFile(`/api/admin/export?scope=${scope}&format=${format}`);
  }

  function downloadBackup() {
    return downloadFile('/api/admin/backup');
  }

  let content = null;
  if (page === 'overview') {
    content = <Overview tasks={tasks} onEdit={setEditingTask} onPriorityChange={changePriority} />;
  }
  if (page === 'personal') {
    content = (
      <PersonalStats
        tasks={tasks}
        archivedTasks={archivedTasks}
        currentUser={currentUser}
        onEdit={setEditingTask}
        onPriorityChange={changePriority}
      />
    );
  }
  if (page === 'checklists') {
    content = <Checklists checklists={settings.shiftChecklists || []} />;
  }
  if (page === 'kanban') {
    content = (
      <>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          categoryOptions={kanbanVisibleCategories}
        />
        <div className="view-note">
          Le Kanban affiche uniquement les consignes en retard ou à finir dans les {kanbanWindowDays} prochains jours.
          Les autres restent disponibles dans le calendrier ou le registre.
        </div>
        <Kanban
          tasks={filteredKanbanTasks}
          onEdit={setEditingTask}
          onDelete={removeTask}
          onStatusChange={changeStatus}
          onPriorityChange={changePriority}
          onQuickAction={quickAction}
          onCreateFollowUp={createFollowUp}
        />
      </>
    );
  }
  if (page === 'register') {
    content = (
      <>
        <FilterBar
          filters={registerFilters}
          onChange={setRegisterFilters}
          categoryOptions={visibleRegisterCategories}
        />
        <Register
          tasks={filteredRegisterTasks}
          onEdit={setEditingTask}
          onDelete={removeTask}
          onStatusChange={changeStatus}
          onPriorityChange={changePriority}
          onQuickAction={quickAction}
          onCreateFollowUp={createFollowUp}
        />
      </>
    );
  }
  if (page === 'calendar') {
    content = (
      <>
        <FilterBar
          filters={filters}
          onChange={setFilters}
          categoryOptions={kanbanVisibleCategories}
        />
        <CalendarView tasks={filteredCalendarTasks} onEdit={setEditingTask} />
      </>
    );
  }
  if (page === 'archives') {
    content = (
      <Archives
        tasks={archivedTasks}
        onRestore={restoreArchived}
        onDelete={removeTask}
      />
    );
  }
  if (page === 'admin') {
    content = (
      <Admin
        settings={settings}
        tasks={tasks}
        archivedTasks={archivedTasks}
        onFetchUsers={fetchAdminUsers}
        onCreateUser={createAdminUser}
        onUpdateUser={updateAdminUser}
        onFetchContributionStats={fetchContributionStats}
        onSaveSettings={persistSettings}
        onSeedDemo={seedDemo}
        onRemoveDemo={removeDemo}
        onDownload={downloadExport}
        onBackup={downloadBackup}
      />
    );
  }

  return (
    <Shell
      page={page}
      setPage={setPage}
      onCreate={() => setEditingTask({})}
      onLock={onLock}
      currentUser={currentUser}
      registerCount={registerTasks.length}
      alertCounts={alertCounts}
    >
      {error && <div className="app-alert">{error}</div>}
      <ErrorBoundary resetKey={page} onReset={() => setPage('overview')}>
        {loading ? <div className="loading-state">Chargement des consignes...</div> : content}
      </ErrorBoundary>
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={saveTask}
          saving={saving}
          quickTemplates={settings.quickTemplates}
        />
      )}
    </Shell>
  );
}

export default function App() {
  return (
    <AuthGate>
      {({ lock, currentUser }) => (
        <HotelApp onLock={lock} currentUser={currentUser} />
      )}
    </AuthGate>
  );
}
