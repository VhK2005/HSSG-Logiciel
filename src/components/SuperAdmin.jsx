import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, ClipboardList, LogOut, ShieldCheck, Users } from 'lucide-react';
import { fetchPlatformOverview } from '../platformApi.js';
import BrandMark from './BrandMark.jsx';

export default function SuperAdmin({ onBack, onLock }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    let active = true;
    fetchPlatformOverview().then((value) => { if (active) setData(value); }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  return <div className="platform-shell">
    <header className="platform-header"><div className="platform-brand"><BrandMark /><div><strong>Carnet de consignes</strong><span>Console propriétaire</span></div></div><div className="platform-header-actions"><button type="button" className="ghost-action" onClick={onBack}><ArrowLeft size={16} />Retour au carnet</button><button type="button" className="icon-only" onClick={onLock} aria-label="Déconnexion"><LogOut size={18} /></button></div></header>
    <main className="platform-main">
      <p className="eyebrow">Super Admin</p><h1>Votre plateforme.</h1><p className="platform-intro">Un espace distinct pour superviser votre solution.</p>
      {error ? <section className="platform-denied" role="alert"><ShieldCheck size={28} /><h2>Accès réservé au propriétaire</h2><p>{error}</p><button className="primary-action" type="button" onClick={onBack}>Revenir à mon hôtel</button></section> : !data ? <div className="loading-state">Vérification de votre accès…</div> : <>
        <div className="platform-tabs" role="group" aria-label="Sections de la console">{[['overview', 'Vue d’ensemble'], ['hotel', 'Établissement'], ['access', 'Accès propriétaire']].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
        {tab === 'overview' && <><section className="platform-metrics"><article><Building2 size={20}/><span>Établissement connecté</span><strong>1</strong></article><article><Users size={20}/><span>Comptes actifs</span><strong>{data.activeUsers}</strong></article><article><ClipboardList size={20}/><span>Consignes actives</span><strong>{data.activeTasks}</strong></article></section><section className="platform-panel"><div className="section-head"><div><p className="eyebrow">Établissement actuel</p><h2>{data.hotel.name}</h2></div><span className="badge success">Connecté</span></div><p>{data.hotel.department} · {data.hotel.timezone}</p><p className="admin-help">Cette première version supervise l’installation existante. L’ajout d’autres hôtels sera activé après la séparation de leurs données.</p></section></>}
        {tab === 'hotel' && <section className="platform-panel"><p className="eyebrow">Configuration actuelle</p><h2>{data.hotel.name}</h2><dl className="platform-definition"><div><dt>Service</dt><dd>{data.hotel.department}</dd></div><div><dt>Fuseau de l’affichage</dt><dd>{data.hotel.timezone}</dd></div><div><dt>Consignes archivées</dt><dd>{data.archivedTasks}</dd></div></dl><button type="button" className="ghost-action" onClick={onBack}>Ouvrir le carnet de cet hôtel</button></section>}
        {tab === 'access' && <section className="platform-panel"><ShieldCheck size={24}/><h2>Un accès qui vous est réservé.</h2><p>Le serveur vérifie l’identité du propriétaire à chaque appel. Le rôle de responsable d’hôtel ne suffit pas à ouvrir cette console.</p><p className="admin-help">Aucune attribution du rôle propriétaire n’est disponible depuis les comptes d’hôtel. La console actuelle est en lecture seule.</p></section>}
      </>}
    </main>
  </div>;
}
