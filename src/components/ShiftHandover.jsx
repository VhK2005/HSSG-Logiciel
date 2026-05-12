import {
  AlertTriangle,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ClipboardCheck,
  Download,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  TimerReset
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchShiftReadStatus,
  markShiftTaskRead,
  markShiftTasksRead
} from '../api.js';
import { PRIORITIES, STATUSES } from '../constants.js';
import { readStorage, writeStorage } from '../safeStorage.js';
import {
  formatDate,
  getDueSignal,
  isCreatedSince,
  isDueToday,
  isModifiedSince,
  isOverdue,
  sortByOperationalUrgency
} from '../utils.js';

const SHIFT_NOTE_KEY = 'overviewReceptionShiftNote';

function readStoredText(key) {
  return readStorage(key, '');
}

function normalizeShiftTask(task) {
  return {
    ...task,
    title: task?.title || `Consigne ${task?.id || ''}`.trim(),
    description: task?.description || '',
    due_date: task?.due_date || null,
    priority: PRIORITIES.includes(task?.priority) ? task.priority : 'Normale',
    category: task?.category || 'Autre',
    status: STATUSES.includes(task?.status) ? task.status : 'À faire',
    created_at: task?.created_at || task?.updated_at || new Date().toISOString(),
    updated_at: task?.updated_at || task?.created_at || new Date().toISOString()
  };
}

function ShiftTaskRow({
  task,
  tone = 'default',
  isSeen,
  onMarkSeen,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp
}) {
  const safeTask = normalizeShiftTask(task);
  const dueSignal = getDueSignal(safeTask);
  const [isExpanded, setIsExpanded] = useState(false);
  const priorityClass = safeTask.priority.toLowerCase();

  return (
    <article className={`shift-task-row ${tone} ${isExpanded ? 'expanded' : 'collapsed'} ${isSeen ? 'seen' : 'unseen'}`}>
      <div className="shift-task-content">
        <div className="shift-task-title">
          <strong>{safeTask.title}</strong>
          <span className={`shift-priority priority-${priorityClass}`}>
            {safeTask.priority}
          </span>
        </div>
        <div className="shift-task-meta">
          <span>{safeTask.category}</span>
          <span>{safeTask.status}</span>
          <span>
            <CalendarClock size={13} aria-hidden="true" />
            {formatDate(safeTask.due_date)}
          </span>
          {dueSignal && <em className={dueSignal.tone}>{dueSignal.label}</em>}
          <em className={isSeen ? 'seen' : 'unseen'}>{isSeen ? 'Vu' : 'À lire'}</em>
        </div>
        {isExpanded && safeTask.description && <p>{safeTask.description}</p>}
      </div>

      <div className="shift-task-controls">
        <button
          className="icon-only"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          title={isExpanded ? 'Replier' : 'Déplier'}
        >
          {isExpanded ? (
            <ChevronUp size={15} aria-hidden="true" />
          ) : (
            <ChevronDown size={15} aria-hidden="true" />
          )}
        </button>
        <button className="icon-only" type="button" onClick={() => onEdit(safeTask)} title="Modifier">
          <Pencil size={15} aria-hidden="true" />
        </button>
        <button
          className={`icon-only ${isSeen ? 'seen-check' : ''}`}
          type="button"
          onClick={() => onMarkSeen(safeTask)}
          title={isSeen ? 'Déjà vu' : 'Marquer comme vu'}
        >
          <CheckCheck size={15} aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <>
          <div className="shift-task-selects">
            {onStatusChange && (
              <select
                value={safeTask.status}
                onChange={(event) => onStatusChange(safeTask, event.target.value)}
                aria-label={`Statut de ${safeTask.title}`}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            )}
            {onPriorityChange && (
              <select
                value={safeTask.priority}
                onChange={(event) => onPriorityChange(safeTask, event.target.value)}
                aria-label={`Priorité de ${safeTask.title}`}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            )}
          </div>

          <div className="shift-task-actions">
            {onQuickAction && safeTask.status !== 'Fait' && (
              <button type="button" onClick={() => onQuickAction(safeTask, 'done')}>
                <CheckCircle2 size={14} aria-hidden="true" />
                Fait
              </button>
            )}
            {onQuickAction && (
              <button type="button" onClick={() => onQuickAction(safeTask, 'waiting')}>
                <TimerReset size={14} aria-hidden="true" />
                Attente
              </button>
            )}
            {onQuickAction && (
              <button type="button" onClick={() => onQuickAction(safeTask, 'followed')}>
                <Send size={14} aria-hidden="true" />
                Relancé
              </button>
            )}
            {onCreateFollowUp && (
              <button type="button" onClick={() => onCreateFollowUp(safeTask)}>
                <CalendarClock size={14} aria-hidden="true" />
                Relance
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function ShiftSection({
  title,
  subtitle,
  tasks,
  empty,
  tone,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp,
  isTaskSeen,
  onMarkSeen
}) {
  return (
    <section className={`shift-section ${tone || ''}`}>
      <div className="bucket-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span>{tasks.length}</span>
      </div>
      <div className="shift-list">
        {tasks.map((task) => (
          <ShiftTaskRow
            key={task.id}
            task={task}
            tone={tone}
            isSeen={isTaskSeen(task)}
            onMarkSeen={onMarkSeen}
            onEdit={onEdit}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onQuickAction={onQuickAction}
            onCreateFollowUp={onCreateFollowUp}
          />
        ))}
        {tasks.length === 0 && <div className="empty-state compact">{empty}</div>}
      </div>
    </section>
  );
}

function buildShiftText({ focus = [], overdue, today, urgent, modified, created }, note = '') {
  const lines = [
    `Passation de shift - ${new Date().toLocaleString('fr-FR')}`,
    '',
    `À faire maintenant: ${focus.length}`,
    `En retard: ${overdue.length}`,
    `Aujourd’hui: ${today.length}`,
    `Urgentes: ${urgent.length}`,
    `Modifiées récemment: ${modified.length}`,
    `Nouvelles récemment: ${created.length}`,
    ''
  ];

  if (note.trim()) {
    lines.push('Note de passation');
    lines.push(note.trim());
    lines.push('');
  }

  const append = (title, items) => {
    lines.push(title);
    if (items.length === 0) {
      lines.push('- Rien à signaler');
    } else {
      for (const task of items) {
        const safeTask = normalizeShiftTask(task);
        lines.push(`- ${safeTask.title} | ${safeTask.category} | ${safeTask.priority} | ${formatDate(safeTask.due_date)}`);
      }
    }
    lines.push('');
  };

  append('À faire maintenant', focus);
  append('En retard', overdue);
  append('À traiter aujourd’hui', today);
  append('Urgentes', urgent);
  append('Modifiées récemment', modified);
  append('Nouvelles récemment', created);

  return lines.join('\n');
}

function getShiftLabel(date = new Date()) {
  const hour = date.getHours();
  if (hour < 7) return 'Shift nuit';
  if (hour < 14) return 'Shift matin';
  if (hour < 21) return 'Shift après-midi';
  return 'Shift soir';
}

function formatShiftMoment(date = new Date()) {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default function ShiftHandover({
  tasks,
  onEdit,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp,
  onRefresh
}) {
  const [seenTasks, setSeenTasks] = useState({});
  const [shiftNote, setShiftNote] = useState(() => readStoredText(SHIFT_NOTE_KEY));
  const safeTasks = tasks.map(normalizeShiftTask);
  const openTasks = safeTasks.filter((task) => task.status !== 'Fait');
  const allSections = {
    overdue: sortByOperationalUrgency(openTasks.filter(isOverdue)),
    today: sortByOperationalUrgency(openTasks.filter(isDueToday)),
    urgent: sortByOperationalUrgency(openTasks.filter((task) => task.priority === 'Urgente')),
    modified: sortByOperationalUrgency(safeTasks.filter((task) => isModifiedSince(task, 12))),
    created: sortByOperationalUrgency(safeTasks.filter((task) => isCreatedSince(task, 12)))
  };
  const sections = {
    overdue: allSections.overdue.slice(0, 8),
    today: allSections.today.slice(0, 8),
    urgent: allSections.urgent.slice(0, 8),
    modified: allSections.modified.slice(0, 8),
    created: allSections.created.slice(0, 8)
  };
  const visibleShiftTasks = [
    ...new Map(Object.values(sections).flat().map((task) => [task.id, task])).values()
  ];
  const shiftFocusTasks = sortByOperationalUrgency([
    ...new Map(
      [
        ...allSections.overdue,
        ...allSections.today,
        ...allSections.urgent
      ].map((task) => [task.id, task])
    ).values()
  ]).slice(0, 5);
  const unreadCount = visibleShiftTasks.filter((task) => !isTaskSeen(task)).length;
  const waitingCount = openTasks.filter((task) => task.status === 'En attente').length;
  const now = new Date();
  const shiftLabel = getShiftLabel(now);
  const shiftMoment = formatShiftMoment(now);

  useEffect(() => {
    let mounted = true;
    fetchShiftReadStatus()
      .then((rows) => {
        if (!mounted) return;
        setSeenTasks(
          rows.reduce((acc, row) => {
            acc[row.task_id] = row.task_updated_at;
            return acc;
          }, {})
        );
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  function isTaskSeen(task) {
    return seenTasks[task.id] === task.updated_at;
  }

  function applySeenRows(rows) {
    setSeenTasks((current) => {
      const nextSeen = { ...current };
      for (const row of rows) {
        nextSeen[row.task_id] = row.task_updated_at;
      }
      return nextSeen;
    });
  }

  async function markTaskSeen(task) {
    setSeenTasks((current) => ({ ...current, [task.id]: task.updated_at }));
    try {
      applySeenRows([await markShiftTaskRead(task.id)]);
    } catch {
      setSeenTasks((current) => {
        const nextSeen = { ...current };
        delete nextSeen[task.id];
        return nextSeen;
      });
    }
  }

  async function markVisibleAsSeen() {
    const ids = visibleShiftTasks.map((task) => task.id);
    setSeenTasks((current) => {
      const nextSeen = { ...current };
      for (const task of visibleShiftTasks) {
        nextSeen[task.id] = task.updated_at;
      }
      return nextSeen;
    });

    try {
      applySeenRows(await markShiftTasksRead(ids));
    } catch {
      fetchShiftReadStatus()
        .then((rows) => {
          setSeenTasks(
            rows.reduce((acc, row) => {
              acc[row.task_id] = row.task_updated_at;
              return acc;
            }, {})
          );
        })
        .catch(() => {});
    }
  }

  function updateShiftNote(value) {
    setShiftNote(value);
    writeStorage(SHIFT_NOTE_KEY, value);
  }

  function exportShift() {
    const blob = new Blob([buildShiftText({ ...sections, focus: shiftFocusTasks }, shiftNote)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `passation-shift-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shift-page">
      <section className="shift-hero">
        <div>
          <p className="eyebrow">Passation de shift</p>
          <h2>Résumé opérationnel</h2>
          <span>Basé sur les 12 dernières heures pour les nouveautés et modifications.</span>
        </div>
        <div className="shift-actions">
          <button className="ghost-action" type="button" onClick={onRefresh}>
            <RefreshCw size={16} aria-hidden="true" />
            Actualiser
          </button>
          <button className="ghost-action" type="button" onClick={exportShift}>
            <Download size={16} aria-hidden="true" />
            Export TXT
          </button>
          <button className="primary-action" type="button" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Imprimer
          </button>
        </div>
      </section>

      <section className="shift-command-panel">
        <div className="shift-command-summary">
          <div className="shift-command-icon">
            <Clock3 size={22} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow">Shift du jour</p>
            <h2>{shiftLabel}</h2>
            <span>{shiftMoment}</span>
          </div>
        </div>
        <div className="shift-command-metrics">
          <article>
            <span>À transmettre</span>
            <strong>{visibleShiftTasks.length}</strong>
          </article>
          <article>
            <span>Non lues</span>
            <strong>{unreadCount}</strong>
          </article>
          <article>
            <span>En attente</span>
            <strong>{waitingCount}</strong>
          </article>
        </div>
        <div className="shift-now-list">
          <div className="shift-now-head">
            <div>
              <p className="eyebrow">À faire maintenant</p>
              <h3>Priorités opérationnelles</h3>
            </div>
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          {shiftFocusTasks.map((task) => {
            const safeTask = normalizeShiftTask(task);
            return (
              <button type="button" key={safeTask.id} onClick={() => onEdit(safeTask)}>
                <strong>{safeTask.title}</strong>
                <span>
                  {safeTask.category} · {safeTask.priority} · {formatDate(safeTask.due_date)}
                </span>
              </button>
            );
          })}
          {shiftFocusTasks.length === 0 && (
            <div className="empty-state compact">Aucune priorité immédiate.</div>
          )}
        </div>
      </section>

      <section className="shift-note-panel">
        <div className="shift-note-head">
          <div>
            <p className="eyebrow">Note de shift</p>
            <h2>Message général</h2>
          </div>
          <div className="shift-read-status">
            <ClipboardCheck size={16} aria-hidden="true" />
            <span>{unreadCount} à lire</span>
          </div>
        </div>
        <textarea
          value={shiftNote}
          onChange={(event) => updateShiftNote(event.target.value)}
          placeholder="Exemple : attention au groupe de 21h, rappeler la chambre 204 demain matin, vérifier le paiement du dossier Dupont..."
        />
        <div className="shift-note-actions">
          <button className="ghost-action" type="button" onClick={markVisibleAsSeen}>
            <CheckCheck size={16} aria-hidden="true" />
            Tout marquer comme vu
          </button>
        </div>
      </section>

      <section className="shift-kpis">
        <article className="danger"><span>En retard</span><strong>{allSections.overdue.length}</strong></article>
        <article className="warning"><span>Aujourd’hui</span><strong>{allSections.today.length}</strong></article>
        <article className="urgent"><span>Urgentes</span><strong>{allSections.urgent.length}</strong></article>
        <article><span>Modifiées</span><strong>{allSections.modified.length}</strong></article>
        <article><span>Nouvelles</span><strong>{allSections.created.length}</strong></article>
      </section>

      <div className="shift-layout">
        <div className="shift-column">
          <h3>À transmettre en priorité</h3>
          <ShiftSection title="En retard" subtitle="À reprendre en premier." tone="danger" tasks={sections.overdue} empty="Aucun retard." onEdit={onEdit} onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} onQuickAction={onQuickAction} onCreateFollowUp={onCreateFollowUp} isTaskSeen={isTaskSeen} onMarkSeen={markTaskSeen} />
          <ShiftSection title="À traiter aujourd’hui" subtitle="Échéance du jour." tone="warning" tasks={sections.today} empty="Rien à traiter aujourd’hui." onEdit={onEdit} onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} onQuickAction={onQuickAction} onCreateFollowUp={onCreateFollowUp} isTaskSeen={isTaskSeen} onMarkSeen={markTaskSeen} />
          <ShiftSection title="Urgentes" subtitle="Priorité réception." tone="urgent" tasks={sections.urgent} empty="Aucune urgence." onEdit={onEdit} onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} onQuickAction={onQuickAction} onCreateFollowUp={onCreateFollowUp} isTaskSeen={isTaskSeen} onMarkSeen={markTaskSeen} />
        </div>
        <div className="shift-column secondary">
          <h3>Mouvements récents</h3>
          <ShiftSection title="Modifiées récemment" subtitle="Changements des 12 dernières heures." tone="info" tasks={sections.modified} empty="Aucune modification récente." onEdit={onEdit} onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} onQuickAction={onQuickAction} onCreateFollowUp={onCreateFollowUp} isTaskSeen={isTaskSeen} onMarkSeen={markTaskSeen} />
          <ShiftSection title="Nouvelles consignes" subtitle="Créées sur le shift récent." tone="info" tasks={sections.created} empty="Aucune nouvelle consigne récente." onEdit={onEdit} onStatusChange={onStatusChange} onPriorityChange={onPriorityChange} onQuickAction={onQuickAction} onCreateFollowUp={onCreateFollowUp} isTaskSeen={isTaskSeen} onMarkSeen={markTaskSeen} />
        </div>
      </div>
    </div>
  );
}
