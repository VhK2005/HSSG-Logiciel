import { Archive, AlertTriangle, BarChart3, Bell, CalendarDays, ClipboardCheck, ClipboardList, Columns3, Home, Lock, LogOut, Plus, Settings, ShieldCheck } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import BrandMark from './BrandMark.jsx';
import { STATUS_LABELS } from '../constants.js';
import { readStorage, writeStorage } from '../safeStorage.js';
import { PAGE_DESCRIPTIONS } from '../navigation.js';
const NOTIFICATION_KEY = 'overviewReceptionBrowserNotifications';

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

    new window.Notification('Carnet de consignes', {
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
          <button type="button" onClick={() => onNavigate('overdue')}>
            Retards
          </button>
        )}
        {alertCounts.j1 > 0 && (
          <button type="button" onClick={() => onNavigate('j1')}>
            J-1
          </button>
        )}
        {alertCounts.urgent > 0 && (
          <button type="button" onClick={() => onNavigate('urgent')}>
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

export default function AppShell({
  page,
  setPage,
  onCreate,
  onLock,
  currentUser,
  registerCount,
  alertCounts,
  hotelProfile,
  canOpenPlatform,
  onOpenPlatform,
  children
}) {
  const todayLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: hotelProfile.timezone
  }).format(new Date());
  const hasSidebarAlerts = alertCounts.overdue + alertCounts.j1 + alertCounts.urgent > 0;
  const nav = [
    { id: 'overview', icon: Home },
        { id: 'register', icon: ClipboardList },
    { id: 'kanban', icon: Columns3 },
    { id: 'calendar', icon: CalendarDays },
    { id: 'checklists', icon: ClipboardCheck },
    { id: 'archives', icon: Archive },
    { id: 'personal', icon: BarChart3 },
    { id: 'admin', icon: Settings }
  ].filter(
    (item) =>
      (item.id !== 'admin' || currentUser?.role === 'admin') &&
      (item.id !== 'personal' || currentUser?.role === 'reception')
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Aller au contenu</a>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <strong>{hotelProfile.name}</strong>
            <span>{hotelProfile.department}</span>
          </div>
        </div>

        <span className="nav-label">Espace de travail</span>
        <nav className="main-nav" aria-label="Navigation principale">
          {nav.map(({ id, icon: Icon }) => (
            <Fragment key={id}>
              <button
                className={page === id ? 'active' : ''}
                aria-current={page === id ? 'page' : undefined}
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
                onClick={() => setPage('overdue')}
                aria-label={`${alertCounts.overdue} consignes en retard`}
              >
                <span className="nav-text">Retard</span>
                <strong>{alertCounts.overdue}</strong>
              </button>
              <button
                className="sidebar-alert warning"
                type="button"
                onClick={() => setPage('j1')}
                aria-label={`${alertCounts.j1} consignes à J-1`}
              >
                <span className="nav-text">J-1</span>
                <strong>{alertCounts.j1}</strong>
              </button>
              <button
                className="sidebar-alert urgent"
                type="button"
                onClick={() => setPage('urgent')}
                aria-label={`${alertCounts.urgent} consignes urgentes`}
              >
                <span className="nav-text">Urgent</span>
                <strong>{alertCounts.urgent}</strong>
              </button>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <SidebarClock />
          {canOpenPlatform && <button type="button" className="platform-entry" onClick={onOpenPlatform}>
            <ShieldCheck size={16} aria-hidden="true" /> Console propriétaire
          </button>}
        </div>
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

      <main id="main-content" className="main-content" tabIndex={-1}>
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
              <span>{currentUser?.username} · {currentUser?.role === 'admin' ? 'Responsable hôtel' : 'Réception'}</span>
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

