import { useState } from 'react';
import { KANBAN_STATUSES } from '../constants.js';
import { sortByOperationalUrgency } from '../utils.js';
import TaskCard from './TaskCard.jsx';

export default function Kanban({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp
}) {
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dropTargetStatus, setDropTargetStatus] = useState(null);

  function clearDragState() {
    setDraggedTaskId(null);
    setDropTargetStatus(null);
  }

  function handleDrop(event, status) {
    event.preventDefault();
    const id = Number(event.dataTransfer.getData('text/plain') || draggedTaskId);
    const task = tasks.find((item) => item.id === id);

    if (task && task.status !== status) {
      onStatusChange(task, status);
    }

    clearDragState();
  }

  return (
    <section
      className={`kanban-board ${draggedTaskId ? 'is-dragging' : ''}`}
      aria-label="Tableau Kanban"
    >
      {KANBAN_STATUSES.map((status) => {
        const columnTasks = sortByOperationalUrgency(tasks.filter((task) => task.status === status));
        const isDropTarget = dropTargetStatus === status;

        return (
          <div
            className={`kanban-column ${isDropTarget ? 'drop-target' : ''}`}
            key={status}
            onDragEnter={(event) => {
              event.preventDefault();
              if (draggedTaskId) setDropTargetStatus(status);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (draggedTaskId && dropTargetStatus !== status) {
                setDropTargetStatus(status);
              }
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setDropTargetStatus(null);
              }
            }}
            onDrop={(event) => handleDrop(event, status)}
          >
            <div className="column-head">
              <h2>{status}</h2>
              <span>{columnTasks.length}</span>
            </div>
            {draggedTaskId && (
              <div className="drop-hint">
                {isDropTarget ? 'Relâcher ici' : 'Glisser une carte ici'}
              </div>
            )}

            <div className="column-stack">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onStatusChange={onStatusChange}
                  onPriorityChange={onPriorityChange}
                  onQuickAction={onQuickAction}
                  onCreateFollowUp={onCreateFollowUp}
                  compact
                  collapsible
                  draggable
                  isDragging={draggedTaskId === task.id}
                  onDragStart={() => setDraggedTaskId(task.id)}
                  onDragEnd={clearDragState}
                />
              ))}
              {columnTasks.length === 0 && (
                <div className="empty-column">Aucune consigne</div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
