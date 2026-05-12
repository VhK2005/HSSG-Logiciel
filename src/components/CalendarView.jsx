import { CalendarDays, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  formatDate,
  getDueSignal,
  isDueToday,
  isOverdue,
  sortByUrgency,
  toDateInputValue
} from '../utils.js';

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarDays(monthDate) {
  const start = firstDayOfMonth(monthDate);
  const mondayOffset = (start.getDay() + 6) % 7;
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function CalendarTaskChip({ task, onEdit }) {
  const signal = getDueSignal(task);

  return (
    <button
      className={`month-task priority-${task.priority.toLowerCase()} ${
        signal?.tone === 'danger' ? 'overdue' : ''
      }`}
      type="button"
      onClick={() => onEdit(task)}
      title={`${task.title} - ${task.priority}`}
    >
      <span>{task.title}</span>
      {signal && <em>{signal.label}</em>}
    </button>
  );
}

function SideList({ title, tasks, onEdit, tone = '' }) {
  return (
    <section className={`calendar-side-section ${tone}`}>
      <div className="bucket-head">
        <h2>{title}</h2>
        <span>{tasks.length}</span>
      </div>
      <div className="calendar-list">
        {tasks.map((task) => (
          <button className="calendar-task" type="button" onClick={() => onEdit(task)} key={task.id}>
            <span className={`status-dot priority-${task.priority.toLowerCase()}`} />
            <span>
              <strong>{task.title}</strong>
              <small>{task.category} - {formatDate(task.due_date)}</small>
            </span>
            {getDueSignal(task) && <em className={getDueSignal(task).tone}>{getDueSignal(task).label}</em>}
          </button>
        ))}
        {tasks.length === 0 && <div className="empty-state compact">Aucune consigne</div>}
      </div>
    </section>
  );
}

export default function CalendarView({ tasks, onEdit }) {
  const [monthDate, setMonthDate] = useState(firstDayOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState('');
  const openDatedTasks = useMemo(
    () => tasks.filter((task) => task.due_date && task.status !== 'Fait'),
    [tasks]
  );

  const calendarDays = useMemo(() => getCalendarDays(monthDate), [monthDate]);
  const monthLabel = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric'
  }).format(monthDate);

  const todayIso = toDateInputValue(new Date());
  const overdueAll = sortByUrgency(openDatedTasks.filter(isOverdue));
  const todayAll = sortByUrgency(openDatedTasks.filter(isDueToday));
  const overdue = overdueAll.slice(0, 8);
  const today = todayAll.slice(0, 8);
  const selectedDateTasks = useMemo(
    () =>
      selectedDate
        ? sortByUrgency(openDatedTasks.filter((task) => task.due_date === selectedDate))
        : [],
    [openDatedTasks, selectedDate]
  );
  const monthTasks = openDatedTasks.filter((task) => {
    const due = new Date(`${task.due_date}T12:00:00`);
    return due.getMonth() === monthDate.getMonth() && due.getFullYear() === monthDate.getFullYear();
  });

  function goToDate(value) {
    setSelectedDate(value);
    if (!value) return;
    setMonthDate(firstDayOfMonth(new Date(`${value}T12:00:00`)));
  }

  function changeMonth(amount) {
    setSelectedDate('');
    setMonthDate(addMonths(monthDate, amount));
  }

  return (
    <div className="calendar-page">
      <section className="calendar-month-panel">
        <div className="calendar-toolbar">
          <div>
            <p className="eyebrow">Vue calendrier</p>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-actions">
            <label className="calendar-date-jump">
              <Search size={16} aria-hidden="true" />
              <span>Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => goToDate(event.target.value)}
                aria-label="Rechercher une date précise"
              />
            </label>
            {selectedDate && (
              <button
                className="ghost-action icon-only"
                type="button"
                onClick={() => setSelectedDate('')}
                title="Effacer la date recherchée"
              >
                <X size={17} aria-hidden="true" />
              </button>
            )}
            <button className="ghost-action icon-only" type="button" onClick={() => changeMonth(-1)} title="Mois précédent">
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button className="ghost-action" type="button" onClick={() => goToDate(todayIso)}>
              <CalendarDays size={17} aria-hidden="true" />
              Aujourd’hui
            </button>
            <button className="ghost-action icon-only" type="button" onClick={() => changeMonth(1)} title="Mois suivant">
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="calendar-kpis">
          <span>{monthTasks.length} consigne{monthTasks.length > 1 ? 's' : ''} ce mois</span>
          <span>{todayAll.length} aujourd’hui</span>
          <span>{overdueAll.length} en retard</span>
        </div>

        <div className="month-calendar" aria-label={`Calendrier ${monthLabel}`}>
          {WEEK_DAYS.map((day) => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}

          {calendarDays.map((day) => {
            const iso = toDateInputValue(day);
            const dayTasks = sortByUrgency(openDatedTasks.filter((task) => task.due_date === iso));
            const isCurrentMonth = day.getMonth() === monthDate.getMonth();
            const isToday = iso === todayIso;
            const isSelected = iso === selectedDate;

            return (
              <article
                className={`month-day ${isCurrentMonth ? '' : 'muted'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                key={iso}
              >
                <div className="month-day-head">
                  <strong>{day.getDate()}</strong>
                  {dayTasks.length > 0 && <span>{dayTasks.length}</span>}
                </div>
                <div className="month-day-tasks">
                  {dayTasks.slice(0, 3).map((task) => (
                    <CalendarTaskChip key={task.id} task={task} onEdit={onEdit} />
                  ))}
                  {dayTasks.length > 3 && (
                    <button className="month-more" type="button" onClick={() => onEdit(dayTasks[3])}>
                      +{dayTasks.length - 3} autre{dayTasks.length - 3 > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="calendar-side">
        {selectedDate && (
          <SideList
            title={`Date recherchée - ${formatDate(selectedDate)}`}
            tasks={selectedDateTasks}
            onEdit={onEdit}
            tone="selected"
          />
        )}
        <SideList title="En retard" tasks={overdue} onEdit={onEdit} tone="danger" />
        <SideList title="Aujourd’hui" tasks={today} onEdit={onEdit} />
      </aside>
    </div>
  );
}
