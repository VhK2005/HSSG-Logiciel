import { AlertTriangle, Clock3, Flame, Hourglass, ListChecks, PauseCircle } from 'lucide-react';
import { STATUSES } from '../constants.js';
import {
  getTaskFamily,
  isDueToday,
  isOverdue,
  isRecentlyCompleted,
  sortByUrgency
} from '../utils.js';
import TaskCard from './TaskCard.jsx';

const STATUS_COLORS = {
  'À faire': '#25788a',
  'En cours': '#b7873f',
  'En attente': '#d97706',
  Fait: '#2e7d56'
};

const TYPE_COLORS = ['#25788a', '#b7873f', '#d97706', '#2e7d56', '#c43d3a', '#5f6f89', '#8b5e3c'];

function StatCard({ icon: Icon, label, value, tone = '' }) {
  return (
    <article className={`stat-card ${tone}`}>
      <Icon size={21} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildPieBackground(data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return '#eef2f6';

  let cursor = 0;
  const parts = data.map((item) => {
    const start = cursor;
    const size = (item.value / total) * 100;
    cursor += size;
    return `${item.color} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${parts.join(', ')})`;
}

function PieChart({ title, data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="chart-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Camembert</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="pie-layout">
        <div className="pie-chart" style={{ background: buildPieBackground(data) }}>
          <span>{total}</span>
        </div>
        <div className="chart-legend">
          {data.map((item) => (
            <div className="legend-row" key={item.label}>
              <span style={{ background: item.color }} />
              <strong>{item.label}</strong>
              <em>{item.value}</em>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BarChart({ title, data }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="chart-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Graphique</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <span>{item.label}</span>
            <div>
              <i style={{ width: `${(item.value / max) * 100}%`, background: item.color }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
        {data.length === 0 && <div className="empty-state compact">Aucune consigne à analyser.</div>}
      </div>
    </section>
  );
}

export default function Overview({ tasks, onEdit, onPriorityChange }) {
  const openTasks = tasks.filter((task) => task.status !== 'Fait');
  const stats = {
    today: openTasks.filter(isDueToday).length,
    overdue: openTasks.filter(isOverdue).length,
    urgent: openTasks.filter((task) => task.priority === 'Urgente').length,
    waiting: tasks.filter((task) => task.status === 'En attente').length,
    progress: tasks.filter((task) => task.status === 'En cours').length,
    recentDone: tasks.filter(isRecentlyCompleted).length
  };

  const statusCounts = countBy(tasks, (task) => task.status);
  const statusData = STATUSES.map((status) => ({
    label: status,
    value: statusCounts[status] || 0,
    color: STATUS_COLORS[status]
  }));

  const typeCounts = countBy(tasks, getTaskFamily);
  const typeData = Object.entries(typeCounts)
    .map(([label, value], index) => ({
      label,
      value,
      color: TYPE_COLORS[index % TYPE_COLORS.length]
    }))
    .sort((a, b) => b.value - a.value);

  const priorities = sortByUrgency(
    openTasks.filter(
      (task) => task.priority === 'Urgente' || isOverdue(task) || isDueToday(task)
    )
  ).slice(0, 8);

  return (
    <div className="overview-page">
      <section className="stats-grid" aria-label="Statistiques rapides">
        <StatCard icon={Clock3} label="À traiter aujourd’hui" value={stats.today} />
        <StatCard icon={AlertTriangle} label="En retard" value={stats.overdue} tone="danger" />
        <StatCard icon={Flame} label="Urgentes" value={stats.urgent} tone="urgent" />
        <StatCard icon={PauseCircle} label="En attente" value={stats.waiting} />
        <StatCard icon={Hourglass} label="En cours" value={stats.progress} />
        <StatCard icon={ListChecks} label="Terminées récemment" value={stats.recentDone} />
      </section>

      <section className="charts-grid" aria-label="Graphiques overview">
        <PieChart title="Répartition par statut" data={statusData} />
        <BarChart title="Types de consignes les plus publiés" data={typeData} />
      </section>

      <section className="priority-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Priorités du jour</p>
            <h2>À surveiller maintenant</h2>
          </div>
        </div>

        <div className="priority-list">
          {priorities.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onPriorityChange={onPriorityChange}
              compact
            />
          ))}
          {priorities.length === 0 && (
            <div className="empty-state">Aucune priorité immédiate.</div>
          )}
        </div>
      </section>
    </div>
  );
}
