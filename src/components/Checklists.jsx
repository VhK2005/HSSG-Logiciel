import {
  CheckCircle2,
  ClipboardCheck,
  CloudSun,
  Download,
  Moon,
  Printer,
  RotateCcw,
  Search,
  Sun,
  ListChecks
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { readStorage, writeStorage } from '../safeStorage.js';

const ICONS = {
  morning: Sun,
  afternoon: CloudSun,
  night: Moon
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeChecklist(checklist, index) {
  const id = normalizeText(checklist?.id, `checklist-${index + 1}`);
  const label = normalizeText(checklist?.label, `Checklist ${index + 1}`);

  return {
    id,
    label,
    subtitle: normalizeText(checklist?.subtitle),
    items: Array.isArray(checklist?.items)
      ? checklist.items
          .map((item, itemIndex) => ({
            id: `${id}-${itemIndex + 1}`,
            text: normalizeText(item)
          }))
          .filter((item) => item.text)
      : []
  };
}

function storageKey() {
  return `overviewReceptionChecklists:${todayKey()}`;
}

function readCompleted() {
  try {
    return JSON.parse(readStorage(storageKey(), '{}') || '{}');
  } catch {
    return {};
  }
}

function progressFor(checklist, completed) {
  if (!checklist.items.length) return 0;
  return checklist.items.filter((item) => completed[checklist.id]?.[item.id]).length;
}

function buildExportText(checklists, completed) {
  const lines = [`Checklists réception - ${new Date().toLocaleString('fr-FR')}`, ''];

  for (const checklist of checklists) {
    lines.push(checklist.label);
    if (checklist.subtitle) lines.push(checklist.subtitle);

    if (!checklist.items.length) {
      lines.push('- Aucune ligne configurée');
    } else {
      for (const item of checklist.items) {
        const mark = completed[checklist.id]?.[item.id] ? 'x' : ' ';
        lines.push(`[${mark}] ${item.text}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export default function Checklists({ checklists = [] }) {
  const normalizedChecklists = useMemo(
    () => checklists.map(normalizeChecklist).filter((checklist) => checklist.items.length > 0),
    [checklists]
  );
  const [activeId, setActiveId] = useState(normalizedChecklists[0]?.id || '');
  const [completed, setCompleted] = useState(readCompleted);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!normalizedChecklists.some((checklist) => checklist.id === activeId)) {
      setActiveId(normalizedChecklists[0]?.id || '');
    }
  }, [activeId, normalizedChecklists]);

  useEffect(() => {
    writeStorage(storageKey(), JSON.stringify(completed));
  }, [completed]);

  const activeChecklist =
    normalizedChecklists.find((checklist) => checklist.id === activeId) || normalizedChecklists[0];
  const activeCompleted = activeChecklist ? progressFor(activeChecklist, completed) : 0;
  const activeTotal = activeChecklist?.items.length || 0;
  const filteredItems = activeChecklist
    ? activeChecklist.items.filter((item) =>
        item.text.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];
  const globalCompleted = normalizedChecklists.reduce(
    (sum, checklist) => sum + progressFor(checklist, completed),
    0
  );
  const globalTotal = normalizedChecklists.reduce((sum, checklist) => sum + checklist.items.length, 0);

  function setItemDone(checklistId, itemId, done) {
    setCompleted((current) => ({
      ...current,
      [checklistId]: {
        ...(current[checklistId] || {}),
        [itemId]: done
      }
    }));
  }

  function completeActive() {
    if (!activeChecklist) return;
    setCompleted((current) => ({
      ...current,
      [activeChecklist.id]: activeChecklist.items.reduce((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {})
    }));
  }

  function resetActive() {
    if (!activeChecklist) return;
    setCompleted((current) => ({
      ...current,
      [activeChecklist.id]: {}
    }));
  }

  function exportChecklists() {
    const blob = new Blob([buildExportText(normalizedChecklists, completed)], {
      type: 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `checklists-reception-${todayKey()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (normalizedChecklists.length === 0) {
    return (
      <div className="checklist-empty">
        <ClipboardCheck size={28} aria-hidden="true" />
        <div>
          <h2>Checklists non configurées</h2>
          <p>Les procédures de shift seront affichées ici dès qu’elles seront chargées dans les réglages.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checklist-page">
      <section className="checklist-hero">
        <div>
          <p className="eyebrow">Checklists réception</p>
          <h2>Routine de shift</h2>
          <span>
            Suivi quotidien des tâches récurrentes. Les cases cochées se réinitialisent naturellement par date.
          </span>
        </div>
        <div className="checklist-score">
          <strong>{globalCompleted}/{globalTotal}</strong>
          <span>validées aujourd’hui</span>
        </div>
      </section>

      <section className="checklist-tabs" aria-label="Choix de la checklist">
        {normalizedChecklists.map((checklist) => {
          const Icon = ICONS[checklist.id] || ListChecks;
          const done = progressFor(checklist, completed);
          const active = checklist.id === activeChecklist?.id;

          return (
            <button
              key={checklist.id}
              className={active ? 'active' : ''}
              type="button"
              onClick={() => setActiveId(checklist.id)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{checklist.label}</span>
              <strong>{done}/{checklist.items.length}</strong>
            </button>
          );
        })}
      </section>

      <section className="checklist-panel">
        <div className="checklist-panel-head">
          <div>
            <p className="eyebrow">À contrôler</p>
            <h2>{activeChecklist.label}</h2>
            {activeChecklist.subtitle && <span>{activeChecklist.subtitle}</span>}
          </div>
          <div className="checklist-progress">
            <strong>{activeCompleted}/{activeTotal}</strong>
            <span>terminées</span>
          </div>
        </div>

        <div className="checklist-toolbar">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Rechercher dans la checklist"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="ghost-action" type="button" onClick={completeActive}>
            <CheckCircle2 size={16} aria-hidden="true" />
            Tout cocher
          </button>
          <button className="ghost-action" type="button" onClick={resetActive}>
            <RotateCcw size={16} aria-hidden="true" />
            Réinitialiser
          </button>
          <button className="ghost-action" type="button" onClick={exportChecklists}>
            <Download size={16} aria-hidden="true" />
            Export TXT
          </button>
          <button className="primary-action" type="button" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Imprimer
          </button>
        </div>

        <div className="checklist-items">
          {filteredItems.map((item, index) => {
            const checked = Boolean(completed[activeChecklist.id]?.[item.id]);
            return (
              <label key={item.id} className={`checklist-item ${checked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    setItemDone(activeChecklist.id, item.id, event.target.checked)
                  }
                />
                <span>{index + 1}</span>
                <p>{item.text}</p>
              </label>
            );
          })}
          {filteredItems.length === 0 && (
            <div className="empty-state compact">Aucune ligne ne correspond à la recherche.</div>
          )}
        </div>
      </section>
    </div>
  );
}
