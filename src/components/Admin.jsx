import {
  AlertTriangle,
  Blocks,
  Cloud,
  ClipboardCheck,
  DatabaseBackup,
  Download,
  EyeOff,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  LockKeyhole,
  Plus,
  Power,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  SlidersHorizontal,
  Server,
  Trash2,
  UserPlus,
  Users,
  WandSparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CLIENT_STORAGE_MODE } from '../api.js';
import { CATEGORIES, PRIORITIES, STATUSES } from '../constants.js';
import { DEFAULT_QUICK_TEMPLATES } from '../templateDefaults.js';
import { formatDateTime } from '../utils.js';

function createTemplate() {
  return {
    id: `custom-${Date.now()}`,
    label: 'Nouveau modèle',
    icon: 'FileText',
    enabled: true,
    titlePrefix: 'Nouvelle consigne',
    referenceLabel: 'Référence',
    referenceQuestion: 'Quelle référence faut-il noter ?',
    referencePlaceholder: 'Client, chambre, dossier...',
    detailLabel: 'Détail',
    detailQuestion: 'Quelle information faut-il ajouter ?',
    detailPlaceholder: 'Information utile pour le prochain shift...',
    detailRequired: true,
    firstDateLabel: '',
    firstDateQuestion: '',
    dueDateLabel: 'Date limite',
    dueDateQuestion: 'Quelle est la date limite ?',
    category: 'Autre',
    priority: 'Normale',
    status: 'À faire'
  };
}

function AdminDisclosure({ eyebrow, title, meta, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className="admin-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <div className="admin-disclosure-title">
          {Icon && <Icon size={19} aria-hidden="true" />}
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
        </div>
        {meta && <strong>{meta}</strong>}
      </summary>
      <div className="admin-disclosure-body">{children}</div>
    </details>
  );
}

export default function Admin({
  settings,
  tasks,
  archivedTasks,
  onFetchUsers,
  onCreateUser,
  onUpdateUser,
  onFetchContributionStats,
  onSaveSettings,
  onSeedDemo,
  onRemoveDemo,
  onDownload,
  onBackup
}) {
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [contributionStats, setContributionStats] = useState({ creators: [], finishers: [] });
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [userBusyId, setUserBusyId] = useState(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'reception'
  });
  const storageLabel =
    CLIENT_STORAGE_MODE === 'supabase'
      ? 'GitHub Pages + Supabase'
      : CLIENT_STORAGE_MODE === 'local'
        ? 'Navigateur local'
        : 'Express + SQLite';
  const protectionLabel =
    CLIENT_STORAGE_MODE === 'supabase'
      ? 'RLS à contrôler'
      : CLIENT_STORAGE_MODE === 'local'
        ? 'Local uniquement'
        : 'Serveur privé';
  const directionSecuritySummary = [
    `Overview Réception Hôtel est conçu comme un outil interne de consignes, avec comptes nominatifs, rôles Admin/Réception et sessions limitées à 16 h.`,
    `Construction actuelle : front React/Vite, stockage ${storageLabel}, configuration par variables d’environnement et exports réservés à l’administrateur.`,
    `Niveau à retenir : adapté aux consignes opérationnelles internes si les données restent minimisées. Ne pas saisir carte bancaire, passeport, document médical ou données client trop personnelles.`,
    `Pour une mise en production plus sensible : HTTPS obligatoire, mots de passe forts, comptes individuels, sauvegardes protégées et idéalement backend privé ou Supabase Auth/RLS strictes.`
  ].join('\n');

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    refreshAdminData();
  }, []);

  async function refreshAdminData() {
    try {
      const [nextUsers, nextStats] = await Promise.all([
        onFetchUsers(),
        onFetchContributionStats()
      ]);
      setUsers(nextUsers);
      setContributionStats(nextStats);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function toggleExcludedCategory(category) {
    const current = new Set(draft.kanbanExcludedCategories || []);
    if (current.has(category)) {
      current.delete(category);
    } else {
      current.add(category);
    }
    updateDraft({ kanbanExcludedCategories: [...current] });
  }

  function updateTemplate(id, patch) {
    updateDraft({
      quickTemplates: draft.quickTemplates.map((template) =>
        template.id === id ? { ...template, ...patch } : template
      )
    });
  }

  function removeTemplate(id) {
    updateDraft({
      quickTemplates: draft.quickTemplates.filter((template) => template.id !== id)
    });
  }

  function updateChecklists(updater) {
    const current = Array.isArray(draft.shiftChecklists) ? draft.shiftChecklists : [];
    updateDraft({ shiftChecklists: updater(current) });
  }

  function addChecklist() {
    const index = (draft.shiftChecklists || []).length + 1;
    updateChecklists((current) => [
      ...current,
      {
        id: `custom-checklist-${Date.now()}`,
        label: `Nouvelle checklist ${index}`,
        subtitle: '',
        items: []
      }
    ]);
  }

  function updateChecklist(id, patch) {
    updateChecklists((current) =>
      current.map((checklist) =>
        checklist.id === id ? { ...checklist, ...patch } : checklist
      )
    );
  }

  function removeChecklist(id) {
    updateChecklists((current) => current.filter((checklist) => checklist.id !== id));
  }

  function moveChecklist(id, direction) {
    updateChecklists((current) => {
      const index = current.findIndex((checklist) => checklist.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function addChecklistItem(checklistId) {
    updateChecklists((current) =>
      current.map((checklist) =>
        checklist.id === checklistId
          ? { ...checklist, items: [...(checklist.items || []), ''] }
          : checklist
      )
    );
  }

  function updateChecklistItem(checklistId, itemIndex, value) {
    updateChecklists((current) =>
      current.map((checklist) => {
        if (checklist.id !== checklistId) return checklist;
        const items = [...(checklist.items || [])];
        items[itemIndex] = value;
        return { ...checklist, items };
      })
    );
  }

  function removeChecklistItem(checklistId, itemIndex) {
    updateChecklists((current) =>
      current.map((checklist) => {
        if (checklist.id !== checklistId) return checklist;
        return {
          ...checklist,
          items: (checklist.items || []).filter((_, index) => index !== itemIndex)
        };
      })
    );
  }

  function moveChecklistItem(checklistId, itemIndex, direction) {
    updateChecklists((current) =>
      current.map((checklist) => {
        if (checklist.id !== checklistId) return checklist;
        const items = [...(checklist.items || [])];
        const nextIndex = itemIndex + direction;
        if (nextIndex < 0 || nextIndex >= items.length) return checklist;
        [items[itemIndex], items[nextIndex]] = [items[nextIndex], items[itemIndex]];
        return { ...checklist, items };
      })
    );
  }

  async function saveSettings() {
    setBusy('settings');
    setMessage('');
    try {
      await onSaveSettings(draft);
      setMessage('Réglages administrateur enregistrés.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function submitUser(event) {
    event.preventDefault();
    setBusy('user');
    setMessage('');
    try {
      const created = await onCreateUser(userForm);
      setUserForm({ username: '', password: '', role: 'reception' });
      await refreshAdminData();
      setMessage(`Compte ${created.username} créé.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function updateUserAccount(user, patch, successMessage) {
    setUserBusyId(user.id);
    setMessage('');
    try {
      await onUpdateUser(user.id, patch);
      await refreshAdminData();
      setMessage(successMessage);
      return true;
    } catch (error) {
      setMessage(error.message);
      return false;
    } finally {
      setUserBusyId(null);
    }
  }

  async function resetUserPassword(user) {
    const password = passwordDrafts[user.id] || '';
    if (password.length < 4) {
      setMessage('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }

    const updated = await updateUserAccount(
      user,
      { password },
      `Mot de passe de ${user.username} modifié.`
    );
    if (updated) {
      setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
    }
  }

  async function copySecuritySummary() {
    try {
      await navigator.clipboard.writeText(directionSecuritySummary);
      setMessage('Résumé sécurité copié.');
    } catch {
      setMessage('Résumé sécurité prêt à présenter : usage interne, données minimisées, accès protégé, production à durcir si données sensibles.');
    }
  }

  function maxStat(items) {
    return Math.max(1, ...items.map((item) => item.count));
  }

  async function seedDemo() {
    if (!window.confirm('Remplacer les anciennes consignes de démonstration ?')) return;
    setBusy('seed');
    setMessage('');
    try {
      const result = await onSeedDemo();
      setMessage(
        `${result.inserted} consignes de démo ajoutées. ${result.activeCount} actives, ${result.archivedCount} archivées.`
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function removeDemo() {
    if (
      !window.confirm(
        'Supprimer toutes les consignes de démonstration ? Les consignes créées manuellement seront conservées.'
      )
    ) {
      return;
    }

    setBusy('remove-demo');
    setMessage('');
    try {
      const result = await onRemoveDemo();
      setMessage(
        `${result.removed} consigne${result.removed > 1 ? 's' : ''} de démo supprimée${result.removed > 1 ? 's' : ''}.`
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function runDownload(scope, format) {
    setBusy(`${scope}-${format}`);
    setMessage('');
    try {
      await onDownload(scope, format);
      setMessage('Export téléchargé.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  async function backup() {
    setBusy('backup');
    setMessage('');
    try {
      await onBackup();
      setMessage('Sauvegarde SQLite téléchargée.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy('');
    }
  }

  const activeUsers = users.filter((user) => user.is_active).length;
  const adminUsers = users.filter((user) => user.role === 'admin' && user.is_active).length;
  const receptionUsers = users.filter((user) => user.role === 'reception' && user.is_active).length;
  const checklistDrafts = Array.isArray(draft.shiftChecklists) ? draft.shiftChecklists : [];
  const checklistPointCount = checklistDrafts.reduce(
    (sum, checklist) => sum + (Array.isArray(checklist.items) ? checklist.items.length : 0),
    0
  );

  return (
    <section className="admin-page">
      <AdminDisclosure
        eyebrow="Administration"
        title="Comptes et activité"
        meta={`${activeUsers} actif${activeUsers > 1 ? 's' : ''}`}
        icon={Users}
        defaultOpen
      >
        <div className="admin-grid">
        <article className="admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Comptes</p>
              <h2>Réception</h2>
            </div>
            <Users size={20} aria-hidden="true" />
          </div>

          <form className="admin-user-form" onSubmit={submitUser}>
            <label>
              Utilisateur
              <input
                value={userForm.username}
                onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                placeholder="Reception matin"
                required
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                minLength={4}
                required
              />
            </label>
            <label>
              Rôle
              <select
                value={userForm.role}
                onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
              >
                <option value="reception">Réception</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button className="primary-action" type="submit" disabled={busy === 'user'}>
              <UserPlus size={16} aria-hidden="true" />
              {busy === 'user' ? 'Création...' : 'Créer le compte'}
            </button>
          </form>

          <div className="admin-users-list">
            {users.map((user) => (
              <details key={user.id} className={`admin-user-card ${user.is_active ? '' : 'inactive'}`}>
                <summary className="admin-user-head">
                  <div>
                    <strong>{user.username}</strong>
                    <small>
                      Dernière connexion : {user.last_login_at ? formatDateTime(user.last_login_at) : 'jamais'}
                    </small>
                  </div>
                  <span className="admin-user-role">
                    {user.role === 'admin' ? 'Admin' : 'Réception'}
                  </span>
                </summary>

                <div className="admin-user-controls">
                  <label>
                    Rôle
                    <select
                      value={user.role}
                      disabled={userBusyId === user.id}
                      onChange={(event) =>
                        updateUserAccount(
                          user,
                          { role: event.target.value },
                          `Rôle de ${user.username} modifié.`
                        )
                      }
                    >
                      <option value="reception">Réception</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <label>
                    Nouveau mot de passe
                    <input
                      type="password"
                      minLength={4}
                      value={passwordDrafts[user.id] || ''}
                      disabled={userBusyId === user.id}
                      onChange={(event) =>
                        setPasswordDrafts((current) => ({
                          ...current,
                          [user.id]: event.target.value
                        }))
                      }
                      placeholder="4 caractères min."
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-action"
                    disabled={userBusyId === user.id || !(passwordDrafts[user.id] || '').trim()}
                    onClick={() => resetUserPassword(user)}
                  >
                    <KeyRound size={15} aria-hidden="true" />
                    Changer MDP
                  </button>
                  <button
                    type="button"
                    className={`ghost-action ${user.is_active ? 'danger-action' : ''}`}
                    disabled={userBusyId === user.id}
                    onClick={() =>
                      updateUserAccount(
                        user,
                        { is_active: !user.is_active },
                        user.is_active
                          ? `Compte ${user.username} désactivé.`
                          : `Compte ${user.username} réactivé.`
                      )
                    }
                  >
                    <Power size={15} aria-hidden="true" />
                    {user.is_active ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              </details>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Équipe</p>
              <h2>Activité</h2>
            </div>
            <Users size={20} aria-hidden="true" />
          </div>

          <div className="admin-contribution">
            <div>
              <h3>Créations</h3>
              {contributionStats.creators.map((item) => (
                <div className="contribution-row" key={`creator-${item.username}`}>
                  <span>{item.username}</span>
                  <div><i style={{ width: `${(item.count / maxStat(contributionStats.creators)) * 100}%` }} /></div>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {contributionStats.creators.length === 0 && (
                <p className="admin-help">Aucune création enregistrée.</p>
              )}
            </div>
            <div>
              <h3>Finalisations</h3>
              {contributionStats.finishers.map((item) => (
                <div className="contribution-row" key={`finisher-${item.username}`}>
                  <span>{item.username}</span>
                  <div><i style={{ width: `${(item.count / maxStat(contributionStats.finishers)) * 100}%` }} /></div>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {contributionStats.finishers.length === 0 && (
                <p className="admin-help">Aucune finalisation enregistrée.</p>
              )}
            </div>
          </div>
        </article>
        </div>
      </AdminDisclosure>

      <AdminDisclosure
        eyebrow="Gouvernance"
        title="Sécurité et bons réflexes"
        meta={storageLabel}
        icon={ShieldCheck}
        defaultOpen
      >
      <article className="admin-panel security-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Sécurité</p>
            <h2>Lecture sécurité de l’application</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </div>

        <div className="security-status-grid">
          <article>
            <LockKeyhole size={18} aria-hidden="true" />
            <span>Accès</span>
            <strong>Comptes internes</strong>
          </article>
          <article>
            <KeyRound size={18} aria-hidden="true" />
            <span>Sessions</span>
            <strong>16 h</strong>
          </article>
          <article>
            <Users size={18} aria-hidden="true" />
            <span>Comptes actifs</span>
            <strong>{activeUsers}</strong>
          </article>
          <article>
            <DatabaseBackup size={18} aria-hidden="true" />
            <span>Stockage</span>
            <strong>{storageLabel}</strong>
          </article>
        </div>

        <div className="security-verdict">
          <div>
            <p className="eyebrow">Ce qu’il faut retenir</p>
            <h3>Correct pour un usage interne, à condition de rester sur des consignes opérationnelles.</h3>
            <p>
              L’application évite le carnet papier, limite les accès par rôle et garde une trace des
              créations, finalisations et modifications. Ce n’est pas un coffre-fort documentaire :
              les informations saisies doivent rester utiles au service, courtes et non sensibles.
            </p>
          </div>
          <span>
            <ShieldAlert size={17} aria-hidden="true" />
            Niveau interne
          </span>
        </div>

        <div className="security-deck">
          <article>
            <div>
              <ShieldCheck size={18} aria-hidden="true" />
              <h3>Ce qui protège déjà</h3>
            </div>
            <ul>
              <li>Comptes nominatifs, rôle Admin séparé du rôle Réception.</li>
              <li>Onglet Admin masqué aux réceptionnistes.</li>
              <li>Sessions limitées à 16 h et révocation lors de la désactivation d’un compte.</li>
              <li>Variables d’environnement hors dépôt public.</li>
              <li>Historique des changements et exports réservés à l’administrateur.</li>
            </ul>
          </article>

          <article>
            <div>
              <AlertTriangle size={18} aria-hidden="true" />
              <h3>Limites à expliquer</h3>
            </div>
            <ul>
              <li>GitHub Pages publie le front : le code de l’interface est public par nature.</li>
              <li>La clé Supabase côté navigateur est publique : la protection forte doit venir de règles RLS strictes ou d’un backend.</li>
              <li>L’outil ne doit pas recevoir de documents d’identité, paiement, santé ou données client trop personnelles.</li>
              <li>Pour une production sensible, préférer un serveur privé HTTPS ou Supabase Auth avec politiques par utilisateur.</li>
            </ul>
          </article>
        </div>

        <div className="security-build">
          <div className="security-build-title">
            <Blocks size={18} aria-hidden="true" />
            <div>
              <p className="eyebrow">Construction</p>
              <h3>Architecture lisible et maintenable</h3>
            </div>
          </div>
          <div className="security-flow">
            <article>
              <Cloud size={18} aria-hidden="true" />
              <span>Interface</span>
              <strong>React + Vite</strong>
              <small>Déployable sur GitHub Pages.</small>
            </article>
            <article>
              <DatabaseBackup size={18} aria-hidden="true" />
              <span>Données</span>
              <strong>{storageLabel}</strong>
              <small>Consignes, comptes, historiques et checklists.</small>
            </article>
            <article>
              <Server size={18} aria-hidden="true" />
              <span>Protection</span>
              <strong>{protectionLabel}</strong>
              <small>À renforcer si données sensibles ou usage multi-site.</small>
            </article>
          </div>
        </div>

        <div className="security-brief">
          <div>
            <p className="eyebrow">Présentation direction</p>
            <h3>Phrase prête à dire</h3>
            <p>
              L’application est adaptée à un usage interne de réception : elle centralise les consignes,
              limite l’accès par comptes et rôles, garde une trace des actions, et doit rester limitée
              aux informations opérationnelles non sensibles. Pour un déploiement plus critique, on
              durcit l’hébergement, les règles Supabase ou on passe par un backend privé.
            </p>
          </div>
          <button type="button" className="ghost-action" onClick={copySecuritySummary}>
            <ClipboardCheck size={16} aria-hidden="true" />
            Copier le résumé
          </button>
        </div>

        <div className="security-habits">
          <div>
            <EyeOff size={18} aria-hidden="true" />
            <h3>Bons réflexes réception</h3>
          </div>
          <div className="security-checklist">
            <span>Admin actif : {adminUsers}</span>
            <span>Réception actifs : {receptionUsers}</span>
            <span>Changer Admin/admin avant démonstration réelle</span>
            <span>Un compte par personne, pas de compte partagé</span>
            <span>Supprimer ou désactiver les anciens accès</span>
            <span>Ne saisir que le strict nécessaire</span>
            <span>Pas de carte bancaire, passeport, santé, pièce jointe sensible</span>
            <span>Accès distant : HTTPS, tunnel sécurisé, VPS ou plateforme hébergée</span>
          </div>
        </div>
      </article>
      </AdminDisclosure>

      <AdminDisclosure
        eyebrow="Pilotage"
        title="Kanban, exports et données"
        meta={`${tasks.length} actives · ${archivedTasks.length} archives`}
        icon={DatabaseBackup}
        defaultOpen
      >
      <div className="admin-grid">
        <article className="admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Réglages</p>
              <h2>Kanban</h2>
            </div>
            <SlidersHorizontal size={20} aria-hidden="true" />
          </div>

          <label>
            Fenêtre d’affichage Kanban
            <input
              type="number"
              min="1"
              max="30"
              value={draft.kanbanWindowDays}
              onChange={(event) =>
                updateDraft({ kanbanWindowDays: Number(event.target.value) })
              }
            />
          </label>
          <p className="admin-help">
            Le Kanban affiche les consignes dont l’échéance est dans ce nombre de jours ou déjà
            dépassée.
          </p>

          <div className="admin-check-grid">
            {CATEGORIES.map((category) => (
              <label key={category} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={(draft.kanbanExcludedCategories || []).includes(category)}
                  onChange={() => toggleExcludedCategory(category)}
                />
                <span>Masquer {category}</span>
              </label>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Données</p>
              <h2>Exports et démo</h2>
            </div>
            <DatabaseBackup size={20} aria-hidden="true" />
          </div>

          <div className="admin-stats">
            <article>
              <span>Actives</span>
              <strong>{tasks.length}</strong>
            </article>
            <article>
              <span>Archives</span>
              <strong>{archivedTasks.length}</strong>
            </article>
          </div>

          <div className="admin-actions">
            <button type="button" className="ghost-action" onClick={() => runDownload('all', 'csv')}>
              <FileSpreadsheet size={16} aria-hidden="true" />
              Export CSV
            </button>
            <button type="button" className="ghost-action" onClick={() => runDownload('all', 'json')}>
              <FileJson size={16} aria-hidden="true" />
              Export JSON
            </button>
            <button type="button" className="ghost-action" onClick={backup}>
              <Download size={16} aria-hidden="true" />
              Sauvegarde SQLite
            </button>
            <button type="button" className="ghost-action" onClick={seedDemo}>
              <WandSparkles size={16} aria-hidden="true" />
              Données de démo
            </button>
            <button type="button" className="ghost-action danger-action" onClick={removeDemo}>
              <Trash2 size={16} aria-hidden="true" />
              Retirer la démo
            </button>
          </div>
        </article>
      </div>
      </AdminDisclosure>

      <AdminDisclosure
        eyebrow="Procédures"
        title="Checklists de shift"
        meta={`${checklistDrafts.length} checklists · ${checklistPointCount} points`}
        icon={ClipboardCheck}
      >
        <article className="admin-panel checklist-admin-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Checklists</p>
              <h2>Points de contrôle réception</h2>
            </div>
            <ClipboardCheck size={20} aria-hidden="true" />
          </div>

          <p className="admin-help">
            Ajoutez, modifiez ou réordonnez les points affichés dans l’onglet Checklists. Les
            changements seront appliqués après enregistrement des réglages.
          </p>

          <div className="admin-template-actions">
            <button type="button" className="ghost-action" onClick={addChecklist}>
              <Plus size={16} aria-hidden="true" />
              Ajouter une checklist
            </button>
          </div>

          <div className="admin-checklist-editor">
            {checklistDrafts.map((checklist, checklistIndex) => {
              const items = Array.isArray(checklist.items) ? checklist.items : [];
              const checklistId = checklist.id || `checklist-${checklistIndex + 1}`;

              return (
                <details className="checklist-editor" key={checklistId} open={checklistIndex === 0}>
                  <summary>
                    <span>
                      <strong>{checklist.label || `Checklist ${checklistIndex + 1}`}</strong>
                      <small>{items.length} point{items.length > 1 ? 's' : ''}</small>
                    </span>
                    <em>{checklist.subtitle || 'Sans sous-titre'}</em>
                  </summary>

                  <div className="checklist-editor-body">
                    <div className="checklist-editor-meta">
                      <label>
                        Nom affiché
                        <input
                          value={checklist.label || ''}
                          onChange={(event) =>
                            updateChecklist(checklistId, { label: event.target.value })
                          }
                          placeholder="Matin, Après-midi, Nuit..."
                        />
                      </label>
                      <label>
                        Sous-titre
                        <input
                          value={checklist.subtitle || ''}
                          onChange={(event) =>
                            updateChecklist(checklistId, { subtitle: event.target.value })
                          }
                          placeholder="Objectif ou contexte du shift"
                        />
                      </label>
                    </div>

                    <div className="checklist-editor-actions">
                      <button
                        type="button"
                        className="ghost-action"
                        disabled={checklistIndex === 0}
                        onClick={() => moveChecklist(checklistId, -1)}
                      >
                        Monter la checklist
                      </button>
                      <button
                        type="button"
                        className="ghost-action"
                        disabled={checklistIndex === checklistDrafts.length - 1}
                        onClick={() => moveChecklist(checklistId, 1)}
                      >
                        Descendre la checklist
                      </button>
                      <button
                        type="button"
                        className="ghost-action danger-action"
                        onClick={() => removeChecklist(checklistId)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                        Supprimer
                      </button>
                    </div>

                    <div className="checklist-point-list">
                      {items.map((item, itemIndex) => (
                        <div className="checklist-point-editor" key={`${checklistId}-${itemIndex}`}>
                          <span>{itemIndex + 1}</span>
                          <input
                            value={item || ''}
                            onChange={(event) =>
                              updateChecklistItem(checklistId, itemIndex, event.target.value)
                            }
                            placeholder="Point à contrôler..."
                          />
                          <div>
                            <button
                              type="button"
                              className="icon-only"
                              disabled={itemIndex === 0}
                              onClick={() => moveChecklistItem(checklistId, itemIndex, -1)}
                              aria-label="Monter ce point"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="icon-only"
                              disabled={itemIndex === items.length - 1}
                              onClick={() => moveChecklistItem(checklistId, itemIndex, 1)}
                              aria-label="Descendre ce point"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="icon-only danger"
                              onClick={() => removeChecklistItem(checklistId, itemIndex)}
                              aria-label="Supprimer ce point"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {items.length === 0 && (
                        <div className="empty-state compact">Aucun point configuré pour cette checklist.</div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => addChecklistItem(checklistId)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Ajouter un point
                    </button>
                  </div>
                </details>
              );
            })}

            {checklistDrafts.length === 0 && (
              <div className="empty-state compact">
                Aucune checklist configurée. Ajoutez une checklist puis ses points de contrôle.
              </div>
            )}
          </div>
        </article>
      </AdminDisclosure>

      <AdminDisclosure
        eyebrow="Création rapide"
        title="Modèles de consignes"
        meta={`${(draft.quickTemplates || []).length} modèles`}
        icon={Settings2}
      >
      <article className="admin-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">Création rapide</p>
            <h2>Modèles de consignes</h2>
          </div>
          <Settings2 size={20} aria-hidden="true" />
        </div>

        <div className="admin-template-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() =>
              updateDraft({ quickTemplates: [...draft.quickTemplates, createTemplate()] })
            }
          >
            <Plus size={16} aria-hidden="true" />
            Ajouter un modèle
          </button>
          <button
            type="button"
            className="ghost-action"
            onClick={() => updateDraft({ quickTemplates: DEFAULT_QUICK_TEMPLATES })}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Restaurer les modèles
          </button>
        </div>

        <div className="template-list">
          {draft.quickTemplates.map((template) => (
            <details className="template-editor" key={template.id}>
              <summary>
                <label className="checkbox-row" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={template.enabled !== false}
                    onChange={(event) =>
                      updateTemplate(template.id, { enabled: event.target.checked })
                    }
                  />
                  <span>{template.label}</span>
                </label>
                <span>{template.category}</span>
              </summary>

              <div className="template-editor-grid">
                <label>
                  Nom affiché
                  <input
                    value={template.label}
                    onChange={(event) => updateTemplate(template.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  Préfixe du titre
                  <input
                    value={template.titlePrefix}
                    onChange={(event) =>
                      updateTemplate(template.id, { titlePrefix: event.target.value })
                    }
                  />
                </label>
                <label>
                  Catégorie
                  <select
                    value={template.category}
                    onChange={(event) =>
                      updateTemplate(template.id, { category: event.target.value })
                    }
                  >
                    {CATEGORIES.map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Priorité
                  <select
                    value={template.priority}
                    onChange={(event) =>
                      updateTemplate(template.id, { priority: event.target.value })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority}>{priority}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Statut par défaut
                  <select
                    value={template.status}
                    onChange={(event) =>
                      updateTemplate(template.id, { status: event.target.value })
                    }
                  >
                    {STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Question référence
                  <input
                    value={template.referenceQuestion}
                    onChange={(event) =>
                      updateTemplate(template.id, { referenceQuestion: event.target.value })
                    }
                  />
                </label>
                <label>
                  Libellé référence
                  <input
                    value={template.referenceLabel}
                    onChange={(event) =>
                      updateTemplate(template.id, { referenceLabel: event.target.value })
                    }
                  />
                </label>
                <label>
                  Question détail
                  <input
                    value={template.detailQuestion || ''}
                    onChange={(event) =>
                      updateTemplate(template.id, { detailQuestion: event.target.value })
                    }
                  />
                </label>
                <label>
                  Libellé détail
                  <input
                    value={template.detailLabel || ''}
                    onChange={(event) =>
                      updateTemplate(template.id, { detailLabel: event.target.value })
                    }
                  />
                </label>
                <label>
                  Question date intermédiaire
                  <input
                    value={template.firstDateQuestion || ''}
                    onChange={(event) =>
                      updateTemplate(template.id, { firstDateQuestion: event.target.value })
                    }
                  />
                </label>
                <label>
                  Libellé date intermédiaire
                  <input
                    value={template.firstDateLabel || ''}
                    onChange={(event) =>
                      updateTemplate(template.id, { firstDateLabel: event.target.value })
                    }
                  />
                </label>
                <label>
                  Question échéance
                  <input
                    value={template.dueDateQuestion}
                    onChange={(event) =>
                      updateTemplate(template.id, { dueDateQuestion: event.target.value })
                    }
                  />
                </label>
                <label>
                  Libellé échéance
                  <input
                    value={template.dueDateLabel}
                    onChange={(event) =>
                      updateTemplate(template.id, { dueDateLabel: event.target.value })
                    }
                  />
                </label>
              </div>

              <button
                type="button"
                className="ghost-action danger-inline"
                onClick={() => removeTemplate(template.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Supprimer ce modèle
              </button>
            </details>
          ))}
        </div>
      </article>
      </AdminDisclosure>

      <div className="admin-footer">
        {message && <span>{message}</span>}
        <button type="button" className="primary-action" onClick={saveSettings} disabled={Boolean(busy)}>
          <Save size={17} aria-hidden="true" />
          {busy === 'settings' ? 'Enregistrement...' : 'Enregistrer les réglages'}
        </button>
      </div>
    </section>
  );
}
