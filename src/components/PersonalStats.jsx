import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Flame,
  FolderArchive,
  Hourglass
} from 'lucide-react';
import { CATEGORIES, STATUSES } from '../constants.js';
import {
  formatDate,
  formatDateTime,
  getTaskFamily,
  isDueToday,
  isOverdue,
  sortByOperationalUrgency
} from '../utils.js';
import TaskCard from './TaskCard.jsx';

const STATUS_COLORS = {
  'À faire': '#53bfff',
  'En cours': '#d8b86a',
  'En attente': '#f2a23a',
  Fait: '#55d18f'
};

const CATEGORY_COLORS = ['#53bfff', '#d8b86a', '#f2a23a', '#55d18f', '#ff6f6a', '#8aa4c2', '#b087f5', '#69d6c5'];

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

function belongsToUser(task, user, fieldId, fieldName) {
  if (!task || !user) return false;
  if (task[fieldId] && user.id) return Number(task[fieldId]) === Number(user.id);
  return task[fieldName] === user.username;
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function BarChart({ title, eyebrow, data }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="chart-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
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
        {data.length === 0 && <div className="empty-state compact">Aucune donnée personnelle.</div>}
      </div>
    </section>
  );
}

function ActivityList({ title, items }) {
  return (
    <section className="chart-panel personal-activity-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Historique perso</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="personal-activity-list">
        {items.map((task) => (
          <article key={`${title}-${task.id}`}>
            <div>
              <strong>{task.title}</strong>
              <span>{getTaskFamily(task)} · {task.priority} · {task.status}</span>
            </div>
            <time>{formatDate(task.completed_at || task.created_at || task.due_date)}</time>
          </article>
        ))}
        {items.length === 0 && <div className="empty-state compact">Rien à afficher pour le moment.</div>}
      </div>
    </section>
  );
}

export default function PersonalStats({
  tasks,
  archivedTasks,
  currentUser,
  onEdit,
  onPriorityChange
}) {
  const allTasks = [...tasks, ...archivedTasks];
  const createdByMe = allTasks.filter((task) =>
    belongsToUser(task, currentUser, 'created_by_user_id', 'created_by_name')
  );
  const completedByMe = allTasks.filter((task) =>
    belongsToUser(task, currentUser, 'completed_by_user_id', 'completed_by_name')
  );
  const activeCreatedByMe = createdByMe.filter((task) => !task.is_archived && task.status !== 'Fait');
  const doneCreatedByMe = createdByMe.filter((task) => task.status === 'Fait');
  const overdueCreatedByMe = activeCreatedByMe.filter(isOverdue);
  const urgentCreatedByMe = activeCreatedByMe.filter((task) => task.priority === 'Urgente');
  const todayCreatedByMe = activeCreatedByMe.filter(isDueToday);
  const archivedCreatedByMe = createdByMe.filter((task) => task.is_archived);

  const statusCounts = countBy(createdByMe, (task) => task.status);
  const statusData = STATUSES.map((status) => ({
    label: status,
    value: statusCounts[status] || 0,
    color: STATUS_COLORS[status]
  }));

  const categoryCounts = countBy(createdByMe, getTaskFamily);
  const categoryData = Object.entries(categoryCounts)
    .map(([label, value], index) => ({
      label,
      value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    }))
    .sort((a, b) => b.value - a.value);

  const priorityTasks = sortByOperationalUrgency(
    activeCreatedByMe.filter(
      (task) => task.priority === 'Urgente' || isOverdue(task) || isDueToday(task)
    )
  ).slice(0, 6);

  const recentCreated = [...createdByMe]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 6);

  const recentCompleted = [...completedByMe]
    .sort((a, b) => new Date(b.completed_at || b.updated_at) - new Date(a.completed_at || a.updated_at))
    .slice(0, 6);

  return (
    <div className="personal-page">
      <section className="personal-hero">
        <div>
          <p className="eyebrow">Compte réception</p>
          <h2>{currentUser?.username}</h2>
          <span>
            Dernière mise à jour : {formatDateTime(new Date().toISOString())}
          </span>
        </div>
        <div className="personal-score">
          <span>Taux créations faites</span>
          <strong>
            {createdByMe.length === 0
              ? '0%'
              : `${Math.round((doneCreatedByMe.length / createdByMe.length) * 100)}%`}
          </strong>
        </div>
      </section>

      <section className="stats-grid" aria-label="Statistiques personnelles">
        <StatCard icon={ClipboardList} label="Créées par moi" value={createdByMe.length} />
        <StatCard icon={Hourglass} label="Encore actives" value={activeCreatedByMe.length} />
        <StatCard icon={AlertTriangle} label="En retard" value={overdueCreatedByMe.length} tone="danger" />
        <StatCard icon={Flame} label="Urgentes ouvertes" value={urgentCreatedByMe.length} tone="urgent" />
        <StatCard icon={CheckCircle2} label="Finalisées par moi" value={completedByMe.length} />
        <StatCard icon={FolderArchive} label="Archivées" value={archivedCreatedByMe.length} />
      </section>

      <section className="personal-focus-grid">
        <article className="chart-panel personal-focus-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Mes priorités</p>
              <h2>À reprendre</h2>
            </div>
            <span className="personal-today-pill">{todayCreatedByMe.length} aujourd’hui</span>
          </div>
          <div className="priority-list">
            {priorityTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={onEdit}
                onPriorityChange={onPriorityChange}
                compact
              />
            ))}
            {priorityTasks.length === 0 && (
              <div className="empty-state compact">Aucune priorité personnelle immédiate.</div>
            )}
          </div>
        </article>

        <BarChart title="Mes consignes par statut" eyebrow="Répartition" data={statusData} />
      </section>

      <section className="charts-grid" aria-label="Analyse personnelle">
        <BarChart title="Types que je crée le plus" eyebrow="Graphique" data={categoryData} />
        <BarChart
          title="Catégories opérationnelles"
          eyebrow="Détail"
          data={CATEGORIES.map((category, index) => ({
            label: category,
            value: createdByMe.filter((task) => task.category === category).length,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
          })).filter((item) => item.value > 0)}
        />
      </section>

      <section className="personal-activity-grid">
        <ActivityList title="Dernières créations" items={recentCreated} />
        <ActivityList title="Dernières finalisations" items={recentCompleted} />
      </section>
    </div>
  );
}
