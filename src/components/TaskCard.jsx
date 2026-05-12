import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Pencil,
  Send,
  TimerReset,
  Trash2
} from 'lucide-react';
import { useState } from 'react';
import { CATEGORIES, PRIORITIES, STATUSES } from '../constants.js';
import { formatDate, formatDateTime, getDueSignal } from '../utils.js';

export default function TaskCard({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp,
  compact = false,
  collapsible = false,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd
}) {
  const dueSignal = getDueSignal(task);
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const showDetails = !collapsible || isExpanded;
  const showCompactSummary = compact && collapsible && !isExpanded;

  return (
    <article
      className={`task-card priority-${task.priority.toLowerCase()} ${compact ? 'compact' : ''} ${
        collapsible && !isExpanded ? 'collapsed' : ''
      } ${isDragging ? 'dragging' : ''}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', String(task.id));
        event.dataTransfer.effectAllowed = 'move';
        onDragStart?.(task);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="task-card-head">
        <div className="task-title-group">
          {draggable && (
            <span className="drag-handle" title="Déplacer la consigne">
              <GripVertical size={17} aria-hidden="true" />
            </span>
          )}
          <div>
            <h3>{task.title}</h3>
            {showDetails && task.description && <p>{task.description}</p>}
          </div>
        </div>
        <div className="card-actions">
          {collapsible && (
            <button
              type="button"
              className="icon-only"
              onClick={() => setIsExpanded((current) => !current)}
              title={isExpanded ? 'Replier' : 'Déplier'}
            >
              {isExpanded ? (
                <ChevronUp size={15} aria-hidden="true" />
              ) : (
                <ChevronDown size={15} aria-hidden="true" />
              )}
            </button>
          )}
          <button type="button" className="icon-only" onClick={() => onEdit(task)} title="Modifier">
            <Pencil size={15} aria-hidden="true" />
          </button>
          {onDelete && (
            <button
              type="button"
              className="icon-only danger"
              onClick={() => onDelete(task)}
              title="Supprimer"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {showCompactSummary ? (
        <div className="compact-task-strip">
          <span className="compact-date">
            <CalendarClock size={13} aria-hidden="true" />
            {formatDate(task.due_date)}
          </span>
          <span className={`compact-pill priority-${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
          <span className="compact-pill neutral">{task.category}</span>
          {dueSignal && (
            <span className={`compact-pill ${dueSignal.tone}`}>{dueSignal.label}</span>
          )}
        </div>
      ) : (
        <>
          <div className="badge-row">
            <span className={`badge priority-badge ${task.priority.toLowerCase()}`}>
              {task.priority}
            </span>
            <span className="badge neutral">{task.category}</span>
            {dueSignal && (
              <span className={`badge ${dueSignal.tone}`}>{dueSignal.label}</span>
            )}
          </div>

          <div className="task-date-line">
            <CalendarClock size={15} aria-hidden="true" />
            <span>{formatDate(task.due_date)}</span>
          </div>
        </>
      )}

      {!compact && showDetails && (
        <dl className="task-meta">
          <div>
            <dt>Créée par</dt>
            <dd>{task.created_by_name || 'Non renseigné'}</dd>
          </div>
          <div>
            <dt>Créée</dt>
            <dd>{formatDateTime(task.created_at)}</dd>
          </div>
          <div>
            <dt>Modifiée</dt>
            <dd>{formatDateTime(task.updated_at)}</dd>
          </div>
          {task.completed_at && (
            <>
              <div>
                <dt>Finalisée par</dt>
                <dd>{task.completed_by_name || 'Non renseigné'}</dd>
              </div>
              <div>
                <dt>Finalisée</dt>
                <dd>{formatDateTime(task.completed_at)}</dd>
              </div>
            </>
          )}
        </dl>
      )}

      {showDetails && (onStatusChange || onPriorityChange) && (
        <div className="status-row">
          {onStatusChange && (
            <label className="inline-control">
              <span>Statut</span>
              <select
                value={task.status}
                onChange={(event) => onStatusChange(task, event.target.value)}
                aria-label={`Changer le statut de ${task.title}`}
              >
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          )}
          {onPriorityChange && (
            <label className="inline-control">
              <span>Priorité</span>
              <select
                value={task.priority}
                onChange={(event) => onPriorityChange(task, event.target.value)}
                aria-label={`Changer la priorité de ${task.title}`}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          )}
          {task.status === 'Fait' && (
            <span className="done-mark">
              <CheckCircle2 size={15} aria-hidden="true" />
              Fait
            </span>
          )}
        </div>
      )}

      {showDetails && (onQuickAction || onCreateFollowUp) && (
        <div className="quick-actions">
          {onQuickAction && task.status !== 'Fait' && (
            <button type="button" onClick={() => onQuickAction(task, 'done')}>
              <CheckCircle2 size={14} aria-hidden="true" />
              Fait
            </button>
          )}
          {onQuickAction && (
            <button type="button" onClick={() => onQuickAction(task, 'tomorrow')}>
              <CalendarPlus size={14} aria-hidden="true" />
              Demain
            </button>
          )}
          {onQuickAction && (
            <button type="button" onClick={() => onQuickAction(task, 'waiting')}>
              <TimerReset size={14} aria-hidden="true" />
              En attente
            </button>
          )}
          {onQuickAction && (
            <button type="button" onClick={() => onQuickAction(task, 'followed')}>
              <Send size={14} aria-hidden="true" />
              Relancé
            </button>
          )}
          {onCreateFollowUp && (
            <button type="button" onClick={() => onCreateFollowUp(task)}>
              <CalendarClock size={14} aria-hidden="true" />
              Créer relance
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function TaskFormFields({ form, setForm }) {
  return (
    <>
      <label>
        Titre
        <input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          maxLength={120}
          required
        />
      </label>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          rows={3}
        />
      </label>

      <div className="form-grid">
        <label>
          Date limite
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => setForm({ ...form, due_date: event.target.value })}
          />
        </label>

        <label>
          Priorité
          <select
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: event.target.value })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-grid">
        <label>
          Catégorie
          <select
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
          >
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <label>
          Statut
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {STATUSES.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}
