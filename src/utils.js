import { KANBAN_EXCLUDED_CATEGORIES, PRIORITY_WEIGHT } from './constants.js';

export function formatDate(value) {
  if (!value) return 'Sans date';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function formatDateTime(value) {
  if (!value) return 'Non défini';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function tomorrowDateInputValue() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
}

export function daysUntil(dueDate) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((due - today) / 86400000);
}

export function getDueSignal(task) {
  if (!task?.due_date || task.status === 'Fait' || task.is_archived) return null;

  const days = daysUntil(task.due_date);
  if (days < 0) {
    return { label: 'En retard', tone: 'danger', days };
  }
  if (days === 0) {
    return { label: "Aujourd’hui", tone: 'warning', days };
  }
  if (days <= 4) {
    return { label: `J-${days}`, tone: 'warning', days };
  }

  return null;
}

export function isOverdue(task) {
  return task.status !== 'Fait' && daysUntil(task.due_date) < 0;
}

export function isDueToday(task) {
  return task.status !== 'Fait' && daysUntil(task.due_date) === 0;
}

export function isRecentlyCompleted(task) {
  if (!task.completed_at || task.is_archived) return false;
  const completed = new Date(task.completed_at);
  return Date.now() - completed.getTime() <= 2 * 24 * 60 * 60 * 1000;
}

export function sortByUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    const priorityDelta =
      (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    if (priorityDelta !== 0) return priorityDelta;

    const aDays = daysUntil(a.due_date);
    const bDays = daysUntil(b.due_date);
    if (aDays === null) return 1;
    if (bDays === null) return -1;
    return aDays - bDays;
  });
}

export function sortByOperationalUrgency(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status === 'Fait' && b.status !== 'Fait') return 1;
    if (a.status !== 'Fait' && b.status === 'Fait') return -1;

    const aDays = daysUntil(a.due_date);
    const bDays = daysUntil(b.due_date);
    if (aDays !== null && bDays !== null && aDays !== bDays) return aDays - bDays;
    if (aDays !== null && bDays === null) return -1;
    if (aDays === null && bDays !== null) return 1;

    const priorityDelta =
      (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9);
    if (priorityDelta !== 0) return priorityDelta;

    return new Date(b.updated_at) - new Date(a.updated_at);
  });
}

export function getTaskFamily(task) {
  if (task.title.startsWith('Relancer proposition de réservation')) return 'Proposition réservation';
  if (task.title.startsWith('Maintenance à traiter')) return 'Maintenance';
  if (task.title.startsWith('Ménage à suivre')) return 'Ménage';
  if (task.title.startsWith('Facturation à vérifier')) return 'Facturation';
  if (task.title.startsWith('Bagagerie à suivre')) return 'Bagagerie';
  if (task.title.startsWith('Demande client')) return 'Demande client';
  if (task.title.startsWith('Consigne direction')) return 'Direction';
  if (task.title.startsWith('Relance -')) return 'Relance';
  return task.category || 'Autre';
}

export function matchesTask(task, filters) {
  const text = filters.search.trim().toLowerCase();
  const matchesText =
    !text ||
    [task.title, task.description, task.category, task.priority, task.status]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(text));

  const matchesPriority =
    filters.priority === 'Toutes' || task.priority === filters.priority;
  const matchesCategory =
    filters.category === 'Toutes' || task.category === filters.category;

  return matchesText && matchesPriority && matchesCategory;
}

export function isHiddenFromKanban(task, excludedCategories = KANBAN_EXCLUDED_CATEGORIES) {
  return excludedCategories.includes(task.category);
}

export function isVisibleInKanban(task, excludedCategories = KANBAN_EXCLUDED_CATEGORIES) {
  return !isHiddenFromKanban(task, excludedCategories);
}

export function isDueInKanbanWindow(task, windowDays = 5) {
  const days = daysUntil(task.due_date);
  return days !== null && days <= windowDays;
}

export function isModifiedSince(task, hours) {
  if (!task.updated_at) return false;
  return Date.now() - new Date(task.updated_at).getTime() <= hours * 60 * 60 * 1000;
}

export function isCreatedSince(task, hours) {
  if (!task.created_at) return false;
  return Date.now() - new Date(task.created_at).getTime() <= hours * 60 * 60 * 1000;
}
