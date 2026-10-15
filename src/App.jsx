import { CalendarDays, ClipboardCheck, Lock, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

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
import AppShell from './components/AppShell.jsx';
import BrandMark from './components/BrandMark.jsx';
import SuperAdmin from './components/SuperAdmin.jsx';
import { fetchPlatformAccess } from './platformApi.js';
import { sanitizeHotelProfile } from '../shared/hotelProfile.js';
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
  PRIORITIES
} from './constants.js';
import { DEFAULT_ADMIN_SETTINGS } from './templateDefaults.js';
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

const AUTO_REFRESH_MS = 15000;

function AuthGate({ children }) {
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
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
    if (connecting) return;
    setConnecting(true);
    setError('');
    try {
      const data = await loginUser(username, password);
      setCurrentUser(data.user);
      setPassword('');
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'Connexion au service impossible. Vérifiez votre réseau puis réessayez.' : err.message);
    } finally { setConnecting(false); }
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
            <BrandMark />
            <h1>Carnet de consignes</h1>
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
          <section className="auth-showcase">
            <BrandMark />
            <p className="eyebrow">Carnet de consignes</p>
            <h1>Le relais de votre équipe.</h1>
            <p>Consignes, échéances et routines : un espace clair pour assurer la continuité du service.</p>
            <div className="auth-feature"><ClipboardCheck size={18} aria-hidden="true" /> Une information partagée</div>
            <div className="auth-feature"><CalendarDays size={18} aria-hidden="true" /> Des priorités lisibles</div>
          </section>

          <form className="auth-panel" onSubmit={submitPassword}>
            <div className="auth-panel-head">
              <BrandMark />
              <div>
                <p className="eyebrow">Espace de réception</p>
                <h1>Bienvenue.</h1>
              </div>
            </div>
            <p className="auth-intro">Retrouvez les consignes et les attentions du jour.</p>
            <label htmlFor="access-username">Utilisateur</label>
            <div className="password-row">
              <Lock size={18} aria-hidden="true" />
              <input
                id="access-username" autoComplete="username" required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Votre identifiant"
                autoFocus
              />
            </div>
            <label htmlFor="access-password">Mot de passe</label>
            <div className="password-row">
              <Lock size={18} aria-hidden="true" />
              <input
                id="access-password" autoComplete="current-password" required
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
              />
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-action" type="submit" disabled={connecting}>
              {connecting ? 'Connexion…' : 'Se connecter'}
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
          aria-label="Rechercher une consigne"
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

function HotelApp({ onLock, currentUser }) {
  const [page, setPage] = useState('overview');
  const [platformOpen, setPlatformOpen] = useState(() => window.location.hash === '#platform');
  const [canOpenPlatform, setCanOpenPlatform] = useState(false);
  useEffect(() => {
    let active = true;
    fetchPlatformAccess().then((data) => { if (active) setCanOpenPlatform(data.allowed); }).catch(() => {});
    const onHash = () => setPlatformOpen(window.location.hash === '#platform');
    window.addEventListener('hashchange', onHash);
    return () => { active = false; window.removeEventListener('hashchange', onHash); };
  }, []);
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
      setError(err.message === 'Failed to fetch' ? 'Connexion interrompue. Vérifiez le réseau puis réessayez.' : err.message);
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
  const [operationalFilter, setOperationalFilter] = useState('all');
  const registerTasks = tasks;
  function navigate(next) {
    if (['overdue', 'j1', 'urgent'].includes(next)) {
      setOperationalFilter(next); setRegisterFilters(emptyFilters); setPage('register');
    } else { setOperationalFilter('all'); setPage(next); }
  }

  const filteredKanbanTasks = useMemo(
    () => kanbanTasks.filter((task) => matchesTask(task, filters)),
    [kanbanTasks, filters]
  );

  const filteredCalendarTasks = useMemo(
    () => operationalTasks.filter((task) => matchesTask(task, filters)),
    [operationalTasks, filters]
  );

  const filteredRegisterTasks = useMemo(
    () => registerTasks.filter((task) => matchesTask(task, registerFilters) && (operationalFilter === 'all' || (task.status !== 'Fait' && (operationalFilter === 'overdue' ? isOverdue(task) : operationalFilter === 'j1' ? daysUntil(task.due_date) === 1 : task.priority === 'Urgente')))),
    [registerTasks, registerFilters, operationalFilter]
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
        {operationalFilter !== 'all' && <div className="view-note">Filtre : {{overdue: 'En retard', j1: 'À J-1', urgent: 'Urgentes'}[operationalFilter]} <button type="button" onClick={() => setOperationalFilter('all')}>Voir toutes les consignes</button></div>}
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

  if (platformOpen) return <SuperAdmin onBack={() => { window.location.hash = ''; setPlatformOpen(false); }} onLock={onLock} />;

  return (
    <AppShell
      page={page}
      setPage={navigate}
      onCreate={() => setEditingTask({})}
      onLock={onLock}
      currentUser={currentUser}
      hotelProfile={sanitizeHotelProfile(settings.hotelProfile)}
      canOpenPlatform={canOpenPlatform}
      onOpenPlatform={() => { window.location.hash = 'platform'; setPlatformOpen(true); }}
      registerCount={registerTasks.length}
      alertCounts={alertCounts}
    >
      {error && <div className="app-alert" role="alert">{error} <button type="button" onClick={() => loadData()}>Réessayer</button></div>}
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
    </AppShell>
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
