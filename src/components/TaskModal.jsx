import {
  ArrowLeft,
  BedDouble,
  BriefcaseBusiness,
  CalendarPlus,
  FileText,
  Luggage,
  ReceiptText,
  UserRound,
  Wrench,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchTaskHistory } from '../api.js';
import { DEFAULT_QUICK_TEMPLATES } from '../templateDefaults.js';
import { formatDate, formatDateTime, toDateInputValue } from '../utils.js';
import { TaskFormFields } from './TaskCard.jsx';

const defaultTask = {
  title: '',
  description: '',
  due_date: '',
  priority: 'Normale',
  category: 'Autre',
  status: 'À faire'
};

const TEMPLATE_ICONS = {
  BedDouble,
  BriefcaseBusiness,
  CalendarPlus,
  FileText,
  Luggage,
  ReceiptText,
  UserRound,
  Wrench
};

function suffix(value) {
  const clean = value.trim();
  return clean ? ` - ${clean}` : '';
}

function line(label, value) {
  const clean = String(value || '').trim();
  return clean ? `${label} : ${clean}` : '';
}

function compactLines(lines) {
  return lines.filter(Boolean).join('\n');
}

function createDefaultQuickTask() {
  return {
    reference: '',
    detail: '',
    firstDate: toDateInputValue(new Date()),
    dueDate: ''
  };
}

function getQuestions(template, quickTask) {
  const questions = [
    {
      key: 'reference',
      label: template.referenceLabel,
      question: template.referenceQuestion,
      placeholder: template.referencePlaceholder,
      type: 'text',
      required: true
    }
  ];

  if (template.detailQuestion) {
    questions.push({
      key: 'detail',
      label: template.detailLabel,
      question: template.detailQuestion,
      placeholder: template.detailPlaceholder,
      type: 'textarea',
      required: template.detailRequired !== false
    });
  }

  if (template.firstDateQuestion) {
    questions.push({
      key: 'firstDate',
      label: template.firstDateLabel,
      question: template.firstDateQuestion,
      type: 'date',
      required: true
    });
  }

  questions.push({
    key: 'dueDate',
    label: template.dueDateLabel,
    question: template.dueDateQuestion,
    type: 'date',
    min: template.firstDateQuestion ? quickTask.firstDate : undefined,
    required: true
  });

  return questions;
}

function buildTemplateTitle(template, data) {
  return `${template.titlePrefix || template.label}${suffix(data.reference)}`;
}

function buildTemplateDescription(template, data) {
  return compactLines([
    line(template.referenceLabel || 'Référence', data.reference),
    template.firstDateQuestion && line(template.firstDateLabel || 'Date', formatDate(data.firstDate)),
    template.detailQuestion && line(template.detailLabel || 'Détail', data.detail),
    line(template.dueDateLabel || 'Date limite', formatDate(data.dueDate))
  ]);
}

export default function TaskModal({
  task,
  onClose,
  onSave,
  saving,
  quickTemplates = DEFAULT_QUICK_TEMPLATES
}) {
  const isNewTask = !task.id;
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState('');
  const [creationMode, setCreationMode] = useState(isNewTask ? 'choose' : 'standard');
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [quickTask, setQuickTask] = useState(createDefaultQuickTask);
  const [form, setForm] = useState({
    ...defaultTask,
    ...task,
    due_date: task.due_date || ''
  });

  const availableTemplates = useMemo(
    () => (quickTemplates || DEFAULT_QUICK_TEMPLATES).filter((template) => template.enabled !== false),
    [quickTemplates]
  );
  const selectedTemplate = useMemo(
    () => availableTemplates.find((template) => template.id === selectedTemplateId),
    [availableTemplates, selectedTemplateId]
  );
  const questions = selectedTemplate ? getQuestions(selectedTemplate, quickTask) : [];
  const currentQuestion = questions[stepIndex];
  const isWizard = isNewTask && creationMode === 'wizard' && selectedTemplate;

  useEffect(() => {
    let mounted = true;
    if (!task.id) return undefined;

    fetchTaskHistory(task.id)
      .then((items) => {
        if (mounted) setHistory(items);
      })
      .catch((error) => {
        if (mounted) setHistoryError(error.message);
      });

    return () => {
      mounted = false;
    };
  }, [task.id]);

  function buildQuickTask() {
    return {
      title: buildTemplateTitle(selectedTemplate, quickTask),
      description: buildTemplateDescription(selectedTemplate, quickTask),
      due_date: quickTask.dueDate,
      priority: selectedTemplate.priority,
      category: selectedTemplate.category,
      status: selectedTemplate.status
    };
  }

  function chooseTemplate(template) {
    setSelectedTemplateId(template.id);
    setStepIndex(0);
    setCreationMode('wizard');
  }

  function chooseOther() {
    setSelectedTemplateId(null);
    setCreationMode('standard');
  }

  function back() {
    if (isWizard && stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }

    if (isNewTask) {
      setSelectedTemplateId(null);
      setStepIndex(0);
      setCreationMode('choose');
    }
  }

  function submit(event) {
    event.preventDefault();
    if (isWizard) {
      if (stepIndex < questions.length - 1) {
        setStepIndex((current) => current + 1);
        return;
      }
      onSave(buildQuickTask());
      return;
    }

    if (creationMode === 'standard') {
      onSave(form);
    }
  }

  function updateQuickTask(nextValues) {
    setQuickTask((current) => {
      const next = { ...current, ...nextValues };
      if (nextValues.firstDate && next.dueDate && next.dueDate < nextValues.firstDate) {
        next.dueDate = '';
      }
      return next;
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="task-modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">Consigne</p>
            <h2>{task.id ? 'Modifier la consigne' : 'Nouvelle consigne'}</h2>
          </div>
          <button className="icon-only" type="button" onClick={onClose} title="Fermer">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {isNewTask && creationMode === 'choose' && (
          <div className="quick-create">
            <p className="quick-create-label">Type de consigne</p>
            <div className="quick-create-options">
              {availableTemplates.map((template) => {
                const Icon = TEMPLATE_ICONS[template.icon] || FileText;
                return (
                  <button key={template.id} type="button" onClick={() => chooseTemplate(template)}>
                    <Icon size={17} aria-hidden="true" />
                    {template.label}
                  </button>
                );
              })}
              <button type="button" onClick={chooseOther}>
                <FileText size={17} aria-hidden="true" />
                Autre
              </button>
            </div>
          </div>
        )}

        {isWizard && (
          <div className="question-flow">
            <div className="question-progress">
              <span>{selectedTemplate.label}</span>
              <strong>
                Question {stepIndex + 1}/{questions.length}
              </strong>
            </div>

            <label className="question-card">
              <span>{currentQuestion.question}</span>
              {currentQuestion.type === 'textarea' ? (
                <textarea
                  value={quickTask[currentQuestion.key]}
                  onChange={(event) =>
                    updateQuickTask({ [currentQuestion.key]: event.target.value })
                  }
                  placeholder={currentQuestion.placeholder}
                  rows={4}
                  required={currentQuestion.required}
                  autoFocus
                />
              ) : (
                <input
                  type={currentQuestion.type}
                  value={quickTask[currentQuestion.key]}
                  min={currentQuestion.min}
                  onChange={(event) =>
                    updateQuickTask({ [currentQuestion.key]: event.target.value })
                  }
                  placeholder={currentQuestion.placeholder}
                  required={currentQuestion.required}
                  autoFocus
                />
              )}
            </label>

            <div className="proposal-preview">
              <strong>Création automatique</strong>
              <span>Statut : {selectedTemplate.status}</span>
              <span>Catégorie : {selectedTemplate.category}</span>
              <span>Priorité : {selectedTemplate.priority}</span>
              <span>
                Échéance : {quickTask.dueDate ? formatDate(quickTask.dueDate) : 'à renseigner'}
              </span>
            </div>
          </div>
        )}

        {creationMode === 'standard' && <TaskFormFields form={form} setForm={setForm} />}

        {!isNewTask && (
          <section className="history-panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Historique</p>
                <h2>Modifications récentes</h2>
              </div>
            </div>
            {historyError && <p className="form-error">{historyError}</p>}
            <div className="history-list">
              {history.slice(0, 8).map((item) => (
                <article className="history-row" key={item.id}>
                  <strong>{item.action}</strong>
                  <span>{formatDateTime(item.created_at)}</span>
                  {item.field && (
                    <p>
                      {item.field} : {item.old_value || 'vide'} -&gt; {item.new_value || 'vide'}
                    </p>
                  )}
                </article>
              ))}
              {history.length === 0 && !historyError && (
                <div className="empty-state compact">Aucun historique enregistré.</div>
              )}
            </div>
          </section>
        )}

        <div className="modal-actions">
          {isNewTask && creationMode !== 'choose' && (
            <button className="ghost-action" type="button" onClick={back}>
              <ArrowLeft size={16} aria-hidden="true" />
              Retour
            </button>
          )}
          <button className="ghost-action" type="button" onClick={onClose}>
            Annuler
          </button>
          {creationMode !== 'choose' && (
            <button className="primary-action" type="submit" disabled={saving}>
              {saving
                ? 'Enregistrement...'
                : isWizard && stepIndex < questions.length - 1
                  ? 'Suivant'
                  : 'Enregistrer'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
