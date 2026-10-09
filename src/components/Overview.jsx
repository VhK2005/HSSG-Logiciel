import { useState } from 'react';
import { ArrowUpRight, Clock3, CheckCircle2, RotateCcw } from 'lucide-react';
import LegacyOverview from './LegacyOverview.jsx';
import { sortByUrgency, formatDate, getDueSignal } from '../utils.js';
import '../biomorphic.css';

export default function Overview(props) {
  const [classic, setClassic] = useState(() => localStorage.getItem('viceVersaAppearance') === 'classic');
  const [expanded, setExpanded] = useState(false);
  function switchAppearance() {
    const next = !classic;
    setClassic(next);
    localStorage.setItem('viceVersaAppearance', next ? 'classic' : 'biomorphic');
  }
  if (classic) return <><button className="appearance-switch" onClick={switchAppearance}>Essayer l’apparence organique</button><LegacyOverview {...props} /></>;
  const pending = sortByUrgency(props.tasks.filter(task => task.status !== 'Fait'));
  const current = pending[0];
  const next = pending.slice(1);
  const signal = current && getDueSignal(current);
  const inProgress = pending.filter(task => task.status === 'En cours').length;
  const waiting = pending.filter(task => task.status === 'En attente').length;
  const completed = props.tasks.filter(task => task.status === 'Fait').length;
  return <div className="bio-overview">
    <div className="bio-intro"><div><p className="eyebrow">Vice Versa · Le fil du service</p><h2>Une chose en entraîne une autre.</h2></div><button className="appearance-switch" onClick={switchAppearance}><RotateCcw size={14} /> Ancienne apparence</button></div>
    <div className="bio-landscape">
      <svg className="bio-ribs" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><path d="M-30 270C140 90 240 110 350 70S620 -30 850 80S1030 210 1240 120M-20 570C160 490 240 660 430 570S700 360 850 460S1060 720 1230 610M690 -20C560 170 850 300 740 490S560 610 630 830M-10 610C280 680 390 470 690 580S1010 880 1210 740"/><path d="M-20 290C140 110 240 130 350 90S620 -10 850 100S1030 230 1240 140M670 -20C540 170 830 300 720 490S540 610 610 830" /></svg>
      <section className="bio-focus bio-cell" aria-labelledby="bio-now">
        <p className="bio-section-label"><span className="bio-dot" /> 01 · Maintenant</p>
        <h2 id="bio-now">{current ? 'Le point d’attention.' : 'Le service respire.'}</h2>
        {current ? <>
          <div className="bio-task-signal">{current.priority} · {signal?.label || formatDate(current.due_date)}</div>
          <h3>{current.title}</h3>
          {current.description && <p className="bio-description">{current.description}</p>}
          <div className="bio-context"><span>{current.category}</span><span>{current.status}</span><span>{current.created_by_name || 'Réception'}</span></div>
          <button className="bio-action" onClick={() => props.onEdit(current)}>Ouvrir la consigne <ArrowUpRight size={20} /></button>
        </> : <><p className="bio-description">Aucune consigne à traiter. Les informations du service restent disponibles dans le registre.</p><CheckCircle2 size={36} /></>}
      </section>
      <aside className="bio-pulse bio-cell" aria-label="Situation du carnet"><p className="bio-section-label">Le pouls du service</p><div className="bio-big-number">{pending.length}<span>à suivre</span></div><div className="bio-pulse-details"><span><b>{inProgress}</b> en cours</span><span><b>{waiting}</b> en attente</span><span><b>{completed}</b> terminées</span></div></aside>
      <section className="bio-next bio-cell" aria-labelledby="bio-next-title"><p className="bio-section-label">02 · Dans le prolongement</p><h2 id="bio-next-title">Ensuite.</h2><div className="bio-next-list">{next.slice(0, 3).map(task => <button key={task.id} className="bio-next-task" onClick={() => props.onEdit(task)}><Clock3 size={17} /><span><strong>{task.title}</strong><small>{formatDate(task.due_date)} · {task.status}</small></span><ArrowUpRight size={17} /></button>)}{!next.length && <p>Pas d’autre consigne en attente.</p>}</div></section>
      <section className="bio-continuity bio-cell"><p className="bio-section-label">03 · Garder le fil</p><h2>Tout reste relié.</h2><p>{next.length > 3 ? `${next.length - 3} autres consignes restent à suivre.` : 'Retrouvez toutes les consignes ouvertes, dans leur ordre de priorité.'}</p><button className="bio-action secondary" aria-expanded={expanded} aria-controls="bio-all" onClick={() => setExpanded(value => !value)}>{expanded ? 'Replier le carnet' : 'Déployer le carnet'} <ArrowUpRight size={18} /></button></section>
    </div>
    {expanded && <section id="bio-all" className="bio-all"><h2>Le carnet ouvert · {pending.length}</h2>{pending.map(task => <button className="bio-register-row" key={task.id} onClick={() => props.onEdit(task)}><span>{task.priority}</span><strong>{task.title}</strong><small>{formatDate(task.due_date)} · {task.status}</small><ArrowUpRight size={18} /></button>)}{!pending.length && <p>Aucune consigne ouverte.</p>}</section>}
  </div>;
}
