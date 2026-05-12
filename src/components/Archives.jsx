import { RotateCcw, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CATEGORIES } from '../constants.js';
import { formatDate, formatDateTime } from '../utils.js';

const archiveFilters = {
  search: '',
  category: 'Toutes',
  from: '',
  to: ''
};

function inPeriod(task, from, to) {
  const reference = (task.completed_at || task.archived_at || task.due_date || '').slice(0, 10);
  if (!reference) return !from && !to;
  if (from && reference < from) return false;
  if (to && reference > to) return false;
  return true;
}

export default function Archives({ tasks, onRestore, onDelete }) {
  const [filters, setFilters] = useState(archiveFilters);

  const visibleTasks = useMemo(() => {
    const needle = filters.search.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesText =
        !needle ||
        [task.title, task.description, task.category, task.priority]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(needle));
      const matchesCategory =
        filters.category === 'Toutes' || task.category === filters.category;
      return matchesText && matchesCategory && inPeriod(task, filters.from, filters.to);
    });
  }, [tasks, filters]);

  return (
    <div className="archives-page">
      <div className="filter-bar archive-filters">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            placeholder="Rechercher dans les archives"
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
          />
        </label>

        <select
          value={filters.category}
          onChange={(event) => setFilters({ ...filters, category: event.target.value })}
          aria-label="Filtrer par catégorie"
        >
          <option>Toutes</option>
          {CATEGORIES.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.from}
          onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          aria-label="Début de période"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(event) => setFilters({ ...filters, to: event.target.value })}
          aria-label="Fin de période"
        />
      </div>

      <section className="archive-list">
        {visibleTasks.map((task) => (
          <article className="archive-row" key={task.id}>
            <div>
              <div className="archive-row-title">
                <h2>{task.title}</h2>
                <span className={`badge priority-badge ${task.priority.toLowerCase()}`}>
                  {task.priority}
                </span>
                <span className="badge neutral">{task.category}</span>
              </div>
              {task.description && <p>{task.description}</p>}
              <dl className="task-meta archive-meta">
                <div>
                  <dt>Créée par</dt>
                  <dd>{task.created_by_name || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>Finalisée par</dt>
                  <dd>{task.completed_by_name || 'Non renseigné'}</dd>
                </div>
                <div>
                  <dt>Échéance</dt>
                  <dd>{formatDate(task.due_date)}</dd>
                </div>
                <div>
                  <dt>Finalisée</dt>
                  <dd>{formatDateTime(task.completed_at)}</dd>
                </div>
                <div>
                  <dt>Archivée</dt>
                  <dd>{formatDateTime(task.archived_at)}</dd>
                </div>
              </dl>
            </div>
            <div className="archive-actions">
              <button className="ghost-action" type="button" onClick={() => onRestore(task)}>
                <RotateCcw size={16} aria-hidden="true" />
                Restaurer
              </button>
              <button className="ghost-action danger-text" type="button" onClick={() => onDelete(task)}>
                <Trash2 size={16} aria-hidden="true" />
                Supprimer
              </button>
            </div>
          </article>
        ))}

        {visibleTasks.length === 0 && (
          <div className="empty-state">Aucune consigne archivée ne correspond aux filtres.</div>
        )}
      </section>
    </div>
  );
}
