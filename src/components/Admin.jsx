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

  return (
    <section className="admin-page">
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
              <article key={user.id} className={user.is_active ? '' : 'inactive'}>
                <div className="admin-user-head">
                  <div>
                    <strong>{user.username}</strong>
                    <small>
                      Dernière connexion : {user.last_login_at ? formatDateTime(user.last_login_at) : 'jamais'}
                    </small>
                  </div>
                  <span className="admin-user-role">
                    {user.role === 'admin' ? 'Admin' : 'Réception'}
                  </span>
                </div>

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
              </article>
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
