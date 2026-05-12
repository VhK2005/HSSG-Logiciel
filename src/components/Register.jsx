import { ClipboardList } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getTaskFamily, sortByOperationalUrgency } from '../utils.js';
import TaskCard from './TaskCard.jsx';

export default function Register({
  tasks,
  onEdit,
  onDelete,
  onStatusChange,
  onPriorityChange,
  onQuickAction,
  onCreateFollowUp
}) {
  const [typeFilter, setTypeFilter] = useState('Tous');
  const typeOptions = useMemo(
    () => [...new Set(tasks.map(getTaskFamily))].sort((a, b) => a.localeCompare(b, 'fr')),
    [tasks]
  );
  const typedTasks = useMemo(
    () =>
      typeFilter === 'Tous'
        ? tasks
        : tasks.filter((task) => getTaskFamily(task) === typeFilter),
    [tasks, typeFilter]
  );
  const openCount = typedTasks.filter((task) => task.status !== 'Fait').length;
  const sortedTasks = sortByOperationalUrgency(typedTasks);

  return (
    <section className="register-page">
      <div className="register-tools">
        <label>
          Type de consigne
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            aria-label="Filtrer par type de consigne"
          >
            <option>Tous</option>
            {typeOptions.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="register-summary">
        <ClipboardList size={20} aria-hidden="true" />
        <div>
          <strong>{typedTasks.length}</strong>
          <span>
            {openCount} consigne{openCount > 1 ? 's' : ''} active{openCount > 1 ? 's' : ''} hors Kanban
          </span>
        </div>
      </div>

      <div className="register-grid">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onPriorityChange={onPriorityChange}
            onQuickAction={onQuickAction}
            onCreateFollowUp={onCreateFollowUp}
          />
        ))}

        {typedTasks.length === 0 && (
          <div className="empty-state">Aucune consigne hors Kanban ne correspond aux filtres.</div>
        )}
      </div>
    </section>
  );
}
