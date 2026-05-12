import crypto from 'node:crypto';

import { db } from './db.js';
import { CATEGORIES, PRIORITIES, STATUSES } from './tasksService.js';

const SETTINGS_KEY = 'admin';
const DEFAULTS_VERSION = 2;

export const DEFAULT_QUICK_TEMPLATES = [
  {
    id: 'reservation-proposal',
    label: 'Proposition réservation',
    icon: 'CalendarPlus',
    enabled: true,
    titlePrefix: 'Relancer proposition de réservation',
    referenceLabel: 'Client ou référence',
    referenceQuestion: 'Pour quel client ou quelle référence ?',
    referencePlaceholder: 'Nom du client, numéro de dossier...',
    firstDateLabel: 'Date d’envoi',
    firstDateQuestion: 'À quelle date la proposition a-t-elle été envoyée ?',
    dueDateLabel: 'Date de relance',
    dueDateQuestion: 'Quand faut-il relancer si aucune réponse n’arrive ?',
    category: 'Réservation',
    priority: 'Normale',
    status: 'En attente'
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    icon: 'Wrench',
    enabled: true,
    titlePrefix: 'Maintenance à traiter',
    referenceLabel: 'Chambre ou lieu',
    referenceQuestion: 'Quelle chambre ou quel lieu est concerné ?',
    referencePlaceholder: 'Chambre 204, lobby, ascenseur...',
    detailLabel: 'Problème',
    detailQuestion: 'Quel problème a été constaté ?',
    detailPlaceholder: 'Ampoule, fuite, climatisation, serrure...',
    dueDateLabel: 'Date souhaitée',
    dueDateQuestion: 'Pour quelle date l’intervention est-elle souhaitée ?',
    category: 'Maintenance',
    priority: 'Normale',
    status: 'À faire'
  },
  {
    id: 'housekeeping',
    label: 'Ménage',
    icon: 'BedDouble',
    enabled: true,
    titlePrefix: 'Ménage à suivre',
    referenceLabel: 'Chambre ou zone',
    referenceQuestion: 'Quelle chambre ou zone est concernée ?',
    referencePlaceholder: 'Chambre 118, salle petit-déjeuner...',
    detailLabel: 'Action demandée',
    detailQuestion: 'Quelle action faut-il demander au ménage ?',
    detailPlaceholder: 'Préparer lit bébé, serviettes, recouche...',
    dueDateLabel: 'À faire avant',
    dueDateQuestion: 'Pour quand faut-il le faire ?',
    category: 'Ménage',
    priority: 'Normale',
    status: 'À faire'
  },
  {
    id: 'billing',
    label: 'Facturation',
    icon: 'ReceiptText',
    enabled: true,
    titlePrefix: 'Facturation à vérifier',
    referenceLabel: 'Client ou dossier',
    referenceQuestion: 'Quel client ou dossier est concerné ?',
    referencePlaceholder: 'Nom client, société, numéro facture...',
    detailLabel: 'Point à vérifier',
    detailQuestion: 'Quel point de facturation faut-il vérifier ?',
    detailPlaceholder: 'Avoir, taxe de séjour, paiement, facture société...',
    dueDateLabel: 'Date limite',
    dueDateQuestion: 'Quelle est la date limite de traitement ?',
    category: 'Facturation',
    priority: 'Normale',
    status: 'À faire'
  },
  {
    id: 'luggage',
    label: 'Bagagerie',
    icon: 'Luggage',
    enabled: true,
    titlePrefix: 'Bagagerie à suivre',
    referenceLabel: 'Client ou étiquette',
    referenceQuestion: 'Quel client ou numéro d’étiquette ?',
    referencePlaceholder: 'Nom client, numéro étiquette...',
    firstDateLabel: 'Date de dépôt',
    firstDateQuestion: 'À quelle date les bagages ont-ils été déposés ?',
    detailLabel: 'Information utile',
    detailQuestion: 'Y a-t-il une information utile à noter ?',
    detailPlaceholder: 'Nombre de bagages, consigne spéciale...',
    detailRequired: false,
    dueDateLabel: 'Date de suivi',
    dueDateQuestion: 'Quand faut-il suivre ou récupérer les bagages ?',
    category: 'Bagagerie',
    priority: 'Normale',
    status: 'En attente'
  },
  {
    id: 'client-request',
    label: 'Demande client',
    icon: 'UserRound',
    enabled: true,
    titlePrefix: 'Demande client',
    referenceLabel: 'Client ou chambre',
    referenceQuestion: 'Quel client ou quelle chambre ?',
    referencePlaceholder: 'Nom client, chambre 305...',
    detailLabel: 'Demande',
    detailQuestion: 'Quelle est la demande du client ?',
    detailPlaceholder: 'Taxi, oreiller, late check-out, information...',
    dueDateLabel: 'À traiter le',
    dueDateQuestion: 'Quand faut-il traiter cette demande ?',
    category: 'Client',
    priority: 'Normale',
    status: 'À faire'
  },
  {
    id: 'direction',
    label: 'Direction',
    icon: 'BriefcaseBusiness',
    enabled: true,
    titlePrefix: 'Consigne direction',
    referenceLabel: 'Sujet',
    referenceQuestion: 'Quel est le sujet ?',
    referencePlaceholder: 'Contrat, incident, retour client...',
    detailLabel: 'Consigne',
    detailQuestion: 'Quelle est la consigne de direction ?',
    detailPlaceholder: 'Information ou action demandée par la direction...',
    dueDateLabel: 'Date limite',
    dueDateQuestion: 'Quelle est la date limite ?',
    category: 'Direction',
    priority: 'Normale',
    status: 'À faire'
  }
];

export const DEFAULT_ADMIN_SETTINGS = {
  defaultsVersion: DEFAULTS_VERSION,
  kanbanWindowDays: 5,
  kanbanExcludedCategories: ['Maintenance', 'Facturation', 'Direction', 'Autre'],
  quickTemplates: DEFAULT_QUICK_TEMPLATES
};

const LEGACY_DEFAULT_PRIORITIES = {
  'reservation-proposal': 'Importante',
  maintenance: 'Importante',
  billing: 'Importante',
  direction: 'Importante'
};

const selectSettings = db.prepare('SELECT value FROM app_settings WHERE key = ?');
const upsertSettings = db.prepare(`
  INSERT INTO app_settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

function cleanText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  return clean || fallback;
}

function cleanOptionalText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function ensureAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeTemplate(template, index) {
  const fallback = DEFAULT_QUICK_TEMPLATES[index] || DEFAULT_QUICK_TEMPLATES[0];
  const id = cleanText(template?.id, crypto.randomUUID());
  const label = cleanText(template?.label, fallback.label);
  const titlePrefix = cleanText(template?.titlePrefix, label);

  return {
    id,
    label,
    icon: cleanText(template?.icon, fallback.icon || 'FileText'),
    enabled: template?.enabled !== false,
    titlePrefix,
    referenceLabel: cleanText(template?.referenceLabel, fallback.referenceLabel || 'Référence'),
    referenceQuestion: cleanText(
      template?.referenceQuestion,
      fallback.referenceQuestion || 'Quelle référence faut-il noter ?'
    ),
    referencePlaceholder: cleanOptionalText(template?.referencePlaceholder),
    detailLabel: cleanOptionalText(template?.detailLabel),
    detailQuestion: cleanOptionalText(template?.detailQuestion),
    detailPlaceholder: cleanOptionalText(template?.detailPlaceholder),
    detailRequired: template?.detailRequired === false ? false : Boolean(template?.detailQuestion),
    firstDateLabel: cleanOptionalText(template?.firstDateLabel),
    firstDateQuestion: cleanOptionalText(template?.firstDateQuestion),
    dueDateLabel: cleanText(template?.dueDateLabel, fallback.dueDateLabel || 'Date limite'),
    dueDateQuestion: cleanText(
      template?.dueDateQuestion,
      fallback.dueDateQuestion || 'Quelle est la date limite ?'
    ),
    category: ensureAllowed(template?.category, CATEGORIES, fallback.category || 'Autre'),
    priority: ensureAllowed(template?.priority, PRIORITIES, fallback.priority || 'Normale'),
    status: ensureAllowed(template?.status, STATUSES, fallback.status || 'À faire')
  };
}

export function sanitizeSettings(payload = {}) {
  const source = {
    ...DEFAULT_ADMIN_SETTINGS,
    ...(payload && typeof payload === 'object' ? payload : {})
  };

  const templateSource = Array.isArray(source.quickTemplates)
    ? source.quickTemplates
    : DEFAULT_QUICK_TEMPLATES;

  return {
    defaultsVersion: DEFAULTS_VERSION,
    kanbanWindowDays: clampInteger(source.kanbanWindowDays, 5, 1, 30),
    kanbanExcludedCategories: Array.isArray(source.kanbanExcludedCategories)
      ? source.kanbanExcludedCategories.filter((category) => CATEGORIES.includes(category))
      : DEFAULT_ADMIN_SETTINGS.kanbanExcludedCategories,
    quickTemplates: templateSource.slice(0, 20).map(sanitizeTemplate)
  };
}

function migrateLegacyDefaultPriorities(settings, rawSettings = {}) {
  if (rawSettings.defaultsVersion >= DEFAULTS_VERSION) return settings;

  return {
    ...settings,
    quickTemplates: settings.quickTemplates.map((template) =>
      LEGACY_DEFAULT_PRIORITIES[template.id] === template.priority
        ? { ...template, priority: 'Normale' }
        : template
    )
  };
}

export function getAdminSettings() {
  const row = selectSettings.get(SETTINGS_KEY);
  if (!row) return DEFAULT_ADMIN_SETTINGS;

  try {
    const rawSettings = JSON.parse(row.value);
    const settings = migrateLegacyDefaultPriorities(sanitizeSettings(rawSettings), rawSettings);
    if (rawSettings.defaultsVersion !== DEFAULTS_VERSION) {
      upsertSettings.run(SETTINGS_KEY, JSON.stringify(settings), new Date().toISOString());
    }
    return settings;
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function saveAdminSettings(payload) {
  const settings = sanitizeSettings(payload);
  upsertSettings.run(SETTINGS_KEY, JSON.stringify(settings), new Date().toISOString());
  return settings;
}
