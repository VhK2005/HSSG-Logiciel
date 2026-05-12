export const STATUSES = ['À faire', 'En cours', 'En attente', 'Fait'];

export const KANBAN_STATUSES = ['En cours', 'En attente', 'À faire', 'Fait'];

export const PRIORITIES = ['Normale', 'Importante', 'Urgente'];

export const CATEGORIES = [
  'Client',
  'Maintenance',
  'Facturation',
  'Ménage',
  'Réservation',
  'Bagagerie',
  'Direction',
  'Autre'
];

export const KANBAN_EXCLUDED_CATEGORIES = ['Maintenance', 'Facturation', 'Direction', 'Autre'];

export const KANBAN_VISIBLE_CATEGORIES = CATEGORIES.filter(
  (category) => !KANBAN_EXCLUDED_CATEGORIES.includes(category)
);

export const PRIORITY_WEIGHT = {
  Urgente: 0,
  Importante: 1,
  Normale: 2
};

export const STATUS_LABELS = {
  overview: 'Overview',
  personal: 'Stats perso',
  shift: 'Passation',
  kanban: 'Kanban',
  register: 'Registre',
  calendar: 'Calendrier',
  archives: 'Archives',
  admin: 'Admin'
};
