import { db, getDatabasePath } from './db.js';
import { runAutomations } from './tasksService.js';
import { fileURLToPath } from 'node:url';

const DAY = 24 * 60 * 60 * 1000;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function relativeDate(offsetDays) {
  const date = new Date(startOfToday().getTime() + offsetDays * DAY);
  return date.toISOString().slice(0, 10);
}

function relativeStamp(offsetDays, hour = 10, minute = 0) {
  const date = new Date(startOfToday().getTime() + offsetDays * DAY);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const demoTasks = [
  {
    title: 'Relancer proposition de réservation - Famille Martin',
    description:
      'Devis envoyé pour 2 chambres communicantes. Relancer le client et noter la réponse dans le dossier.',
    due_date: relativeDate(-2),
    priority: 'Urgente',
    category: 'Réservation',
    status: 'En attente',
    createdOffset: -9,
    updatedOffset: -3
  },
  {
    title: 'Demande client chambre 214 - oreiller ergonomique',
    description: 'Préparer un oreiller ergonomique et confirmer au client avant son retour.',
    due_date: relativeDate(0),
    priority: 'Urgente',
    category: 'Client',
    status: 'À faire',
    createdOffset: -1,
    updatedOffset: 0
  },
  {
    title: 'Bagagerie à suivre - valise étiquette B-184',
    description: 'Valise déposée par M. Klein. Vérifier la récupération prévue demain matin.',
    due_date: relativeDate(1),
    priority: 'Importante',
    category: 'Bagagerie',
    status: 'À faire',
    createdOffset: 0,
    updatedOffset: 0
  },
  {
    title: 'Ménage à suivre - chambre 306 lit bébé',
    description: 'Installer un lit bébé et deux serviettes supplémentaires avant l’arrivée.',
    due_date: relativeDate(1),
    priority: 'Importante',
    category: 'Ménage',
    status: 'À faire',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Préparer arrivée groupe Séminaire Atlas',
    description: 'Vérifier clés, enveloppes d’accueil, badges et coordonnées du responsable groupe.',
    due_date: relativeDate(2),
    priority: 'Urgente',
    category: 'Réservation',
    status: 'À faire',
    createdOffset: -4,
    updatedOffset: -1
  },
  {
    title: 'Demande client chambre 118 - late checkout',
    description: 'Confirmer la disponibilité housekeeping et rappeler le client.',
    due_date: relativeDate(2),
    priority: 'Normale',
    category: 'Client',
    status: 'À faire',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Relancer proposition de réservation - Société Novalink',
    description: 'Proposition envoyée lundi pour 6 chambres single. Relance commerciale à effectuer.',
    due_date: relativeDate(3),
    priority: 'Importante',
    category: 'Réservation',
    status: 'En attente',
    createdOffset: -6,
    updatedOffset: -2
  },
  {
    title: 'Ménage à suivre - contrôle chambre 512 VIP',
    description: 'Contrôle final chambre VIP avec amenities, plateau courtoisie et peignoirs.',
    due_date: relativeDate(4),
    priority: 'Urgente',
    category: 'Ménage',
    status: 'En cours',
    createdOffset: -3,
    updatedOffset: -1
  },
  {
    title: 'Bagagerie à suivre - récupération sac M. Rossi',
    description: 'Sac noir conservé en bagagerie. Le client repasse après le déjeuner.',
    due_date: relativeDate(5),
    priority: 'Normale',
    category: 'Bagagerie',
    status: 'En cours',
    createdOffset: -1,
    updatedOffset: 0
  },
  {
    title: 'Demande client chambre 402 - transfert aéroport',
    description: 'Confirmer l’horaire exact du taxi et imprimer la confirmation.',
    due_date: relativeDate(5),
    priority: 'Importante',
    category: 'Client',
    status: 'En attente',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Ménage à suivre - linge supplémentaire étage 4',
    description: 'Linge livré et vérifié. Garder visible jusqu’au prochain shift.',
    due_date: relativeDate(5),
    priority: 'Normale',
    category: 'Ménage',
    status: 'Fait',
    createdOffset: -2,
    updatedOffset: -1,
    completedOffset: -1
  },
  {
    title: 'Proposition réservation - Couple Lefèvre',
    description: 'Option week-end confirmée par téléphone. Attente retour écrit du client.',
    due_date: relativeDate(5),
    priority: 'Normale',
    category: 'Réservation',
    status: 'Fait',
    createdOffset: -4,
    updatedOffset: -1,
    completedOffset: -1
  },
  {
    title: 'Proposition réservation - Groupe mariage Caron',
    description: 'Préparer une offre groupe avec petits-déjeuners inclus et conditions d’annulation.',
    due_date: relativeDate(6),
    priority: 'Importante',
    category: 'Réservation',
    status: 'En cours',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Demande client - fleurs anniversaire chambre 221',
    description: 'Commander bouquet sobre et déposer une carte avant 17h.',
    due_date: relativeDate(7),
    priority: 'Normale',
    category: 'Client',
    status: 'En attente',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Bagagerie à suivre - stockage longue durée Famille Ortega',
    description: 'Valises en local sécurisé jusqu’au retour de la famille la semaine prochaine.',
    due_date: relativeDate(10),
    priority: 'Normale',
    category: 'Bagagerie',
    status: 'À faire',
    createdOffset: 0,
    updatedOffset: 0
  },
  {
    title: 'Demande client - réservation spa chambre 305',
    description: 'Proposer deux créneaux disponibles et confirmer le choix au spa partenaire.',
    due_date: relativeDate(14),
    priority: 'Normale',
    category: 'Client',
    status: 'À faire',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Proposition réservation - Séjour août Société Lumière',
    description: 'Préparer proposition longue durée avec tarif corporate et parking inclus.',
    due_date: relativeDate(21),
    priority: 'Importante',
    category: 'Réservation',
    status: 'En attente',
    createdOffset: -5,
    updatedOffset: -2
  },
  {
    title: 'Demande client - préparer note d’accueil fidélité',
    description: 'Client régulier arrivant prochainement. Préparer une attention simple en chambre.',
    due_date: null,
    priority: 'Normale',
    category: 'Client',
    status: 'En cours',
    createdOffset: -3,
    updatedOffset: -1
  },
  {
    title: 'Ménage à suivre - inventaire couvertures étage 2',
    description: 'Inventaire terminé, à garder en visibilité jusqu’à validation gouvernante.',
    due_date: relativeDate(9),
    priority: 'Normale',
    category: 'Ménage',
    status: 'Fait',
    createdOffset: -2,
    updatedOffset: -1,
    completedOffset: -1
  },
  {
    title: 'Maintenance à traiter - fuite lavabo chambre 109',
    description: 'Client signale une fuite légère sous le lavabo. Prévenir maintenance et suivre l’intervention.',
    due_date: relativeDate(0),
    priority: 'Urgente',
    category: 'Maintenance',
    status: 'En cours',
    createdOffset: -1,
    updatedOffset: 0
  },
  {
    title: 'Maintenance à traiter - serrure entrée parking',
    description: 'La serrure accroche. Vérifier avec l’équipe technique avant le week-end.',
    due_date: relativeDate(3),
    priority: 'Importante',
    category: 'Maintenance',
    status: 'En attente',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Maintenance à traiter - climatisation salon',
    description: 'Température irrégulière en salon petit-déjeuner. Suivi prestataire demandé.',
    due_date: relativeDate(8),
    priority: 'Importante',
    category: 'Maintenance',
    status: 'En cours',
    createdOffset: -4,
    updatedOffset: -1
  },
  {
    title: 'Facturation à vérifier - acompte dossier Durand',
    description: 'Acompte reçu mais non rapproché. Vérifier le règlement et mettre à jour le dossier.',
    due_date: relativeDate(-1),
    priority: 'Urgente',
    category: 'Facturation',
    status: 'En cours',
    createdOffset: -5,
    updatedOffset: -2
  },
  {
    title: 'Facturation à vérifier - facture agence SunTrip',
    description: 'Contrôler commission, taxe de séjour et adresse de facturation avant envoi.',
    due_date: relativeDate(2),
    priority: 'Importante',
    category: 'Facturation',
    status: 'En attente',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Facturation à vérifier - avoir minibar chambre 227',
    description: 'Client conteste une ligne minibar. Vérifier main courante et stock avant réponse.',
    due_date: relativeDate(9),
    priority: 'Normale',
    category: 'Facturation',
    status: 'À faire',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Consigne direction - préparer chiffres semaine',
    description: 'Préparer taux d’occupation, ADR, RevPAR et nombre de no-show pour le point direction.',
    due_date: relativeDate(1),
    priority: 'Urgente',
    category: 'Direction',
    status: 'En cours',
    createdOffset: -3,
    updatedOffset: -1
  },
  {
    title: 'Consigne direction - contrôle avis clients',
    description: 'Lister les avis récents sous 4 étoiles avec cause principale et action proposée.',
    due_date: relativeDate(6),
    priority: 'Importante',
    category: 'Direction',
    status: 'En attente',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Consigne direction - organiser accueil audit',
    description: 'Prévoir dossier accueil, planning managers et accès parking pour l’auditeur.',
    due_date: relativeDate(12),
    priority: 'Importante',
    category: 'Direction',
    status: 'À faire',
    createdOffset: 0,
    updatedOffset: 0
  },
  {
    title: 'Autre - déposer courrier fournisseur',
    description: 'Courrier fournisseur à remettre au responsable achats avant fermeture administrative.',
    due_date: relativeDate(0),
    priority: 'Normale',
    category: 'Autre',
    status: 'À faire',
    createdOffset: 0,
    updatedOffset: 0
  },
  {
    title: 'Autre - vérifier stock cartes clés',
    description: 'Compter les cartes clés vierges et prévenir si le seuil minimum est atteint.',
    due_date: relativeDate(4),
    priority: 'Importante',
    category: 'Autre',
    status: 'En cours',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Autre - mise à jour affichage navette',
    description: 'Mettre à jour les horaires navette dans le présentoir réception.',
    due_date: relativeDate(15),
    priority: 'Normale',
    category: 'Autre',
    status: 'En attente',
    createdOffset: -2,
    updatedOffset: -1
  },
  {
    title: 'Maintenance à traiter - contrôle détecteur couloir 2',
    description: 'Contrôle préventif demandé par la direction technique.',
    due_date: null,
    priority: 'Normale',
    category: 'Maintenance',
    status: 'À faire',
    createdOffset: -1,
    updatedOffset: -1
  },
  {
    title: 'Demande client chambre 105 - adaptateur remis',
    description: 'Adaptateur remis au client. À vérifier au départ.',
    due_date: relativeDate(-1),
    priority: 'Normale',
    category: 'Client',
    status: 'Fait',
    createdOffset: -2,
    updatedOffset: 0,
    completedOffset: 0
  },
  {
    title: 'Facturation à vérifier - taxe séjour groupe Alto',
    description: 'Correction validée avec la comptabilité. Garder visible pour le shift du soir.',
    due_date: relativeDate(-1),
    priority: 'Importante',
    category: 'Facturation',
    status: 'Fait',
    createdOffset: -3,
    updatedOffset: -1,
    completedOffset: -1
  },
  {
    title: 'Maintenance à traiter - ampoule couloir 3e',
    description: 'Ampoule remplacée. Vérifier que le couloir reste bien éclairé ce soir.',
    due_date: relativeDate(-1),
    priority: 'Normale',
    category: 'Maintenance',
    status: 'Fait',
    createdOffset: -3,
    updatedOffset: -1,
    completedOffset: -1
  },
  {
    title: 'Bagagerie à suivre - sac rouge Mme Abadie',
    description: 'Sac rendu et étiquette récupérée. Garder en récent pour contrôle.',
    due_date: relativeDate(0),
    priority: 'Normale',
    category: 'Bagagerie',
    status: 'Fait',
    createdOffset: -1,
    updatedOffset: 0,
    completedOffset: 0
  },
  {
    title: 'Proposition réservation archivée - Famille Nguyen',
    description: 'Proposition refusée, dossier clôturé.',
    due_date: relativeDate(-12),
    priority: 'Normale',
    category: 'Réservation',
    status: 'Fait',
    createdOffset: -18,
    updatedOffset: -9,
    completedOffset: -9,
    archivedOffset: -7,
    archived: true
  },
  {
    title: 'Maintenance archivée - joint douche chambre 208',
    description: 'Intervention terminée et chambre remise en vente.',
    due_date: relativeDate(-10),
    priority: 'Importante',
    category: 'Maintenance',
    status: 'Fait',
    createdOffset: -14,
    updatedOffset: -8,
    completedOffset: -8,
    archivedOffset: -6,
    archived: true
  },
  {
    title: 'Facturation archivée - facture société Helios',
    description: 'Facture envoyée et validée par le client.',
    due_date: relativeDate(-8),
    priority: 'Normale',
    category: 'Facturation',
    status: 'Fait',
    createdOffset: -12,
    updatedOffset: -6,
    completedOffset: -6,
    archivedOffset: -4,
    archived: true
  },
  {
    title: 'Ménage archivé - chambre 410 départ tardif',
    description: 'Chambre nettoyée après départ tardif, contrôle terminé.',
    due_date: relativeDate(-7),
    priority: 'Normale',
    category: 'Ménage',
    status: 'Fait',
    createdOffset: -9,
    updatedOffset: -5,
    completedOffset: -5,
    archivedOffset: -3,
    archived: true
  },
  {
    title: 'Bagagerie archivée - colis reçu M. Bernard',
    description: 'Colis remis au client contre signature.',
    due_date: relativeDate(-6),
    priority: 'Normale',
    category: 'Bagagerie',
    status: 'Fait',
    createdOffset: -8,
    updatedOffset: -5,
    completedOffset: -5,
    archivedOffset: -3,
    archived: true
  },
  {
    title: 'Consigne direction archivée - réunion hebdomadaire',
    description: 'Compte rendu transmis à la direction.',
    due_date: relativeDate(-5),
    priority: 'Importante',
    category: 'Direction',
    status: 'Fait',
    createdOffset: -7,
    updatedOffset: -4,
    completedOffset: -4,
    archivedOffset: -2,
    archived: true
  }
];

const insertTask = db.prepare(`
  INSERT INTO tasks (
    title, description, due_date, priority, category, status,
    created_at, updated_at, completed_at, archived_at, is_archived,
    created_by_user_id, created_by_name, completed_by_user_id, completed_by_name
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)
`);

const insertHistory = db.prepare(`
  INSERT INTO task_history (task_id, action, field, old_value, new_value, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function findDemoTaskIds(titles) {
  const placeholders = titles.map(() => '?').join(', ');
  const ids = new Set();

  if (titles.length > 0) {
    const titleRows = db
      .prepare(`SELECT id FROM tasks WHERE title IN (${placeholders})`)
      .all(...titles);

    for (const row of titleRows) {
      ids.add(row.id);
    }
  }

  const historyRows = db
    .prepare(`
      SELECT DISTINCT task_id AS id
      FROM task_history
      WHERE action IN ('Création jeu de démonstration', 'Archive de démonstration')
    `)
    .all();

  for (const row of historyRows) {
    ids.add(row.id);
  }

  return [...ids];
}

function removeDemoRows(titles) {
  const existingIds = findDemoTaskIds(titles);

  if (existingIds.length === 0) return 0;

  const idPlaceholders = existingIds.map(() => '?').join(', ');
  db.prepare(`DELETE FROM task_reads WHERE task_id IN (${idPlaceholders})`).run(...existingIds);
  db.prepare(`DELETE FROM task_history WHERE task_id IN (${idPlaceholders})`).run(...existingIds);
  db.prepare(`DELETE FROM tasks WHERE id IN (${idPlaceholders})`).run(...existingIds);
  return existingIds.length;
}

export function removeDemoData() {
  const titles = demoTasks.map((task) => task.title);
  const removed = db.transaction(() => removeDemoRows(titles))();
  runAutomations();

  const activeCount = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE is_archived = 0').get().count;
  const archivedCount = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE is_archived = 1').get().count;

  return {
    database: getDatabasePath(),
    removed,
    activeCount,
    archivedCount
  };
}

export function seedDemoData() {
  const titles = demoTasks.map((task) => task.title);

  const transaction = db.transaction(() => {
    const removed = removeDemoRows(titles);

    for (const task of demoTasks) {
      const createdAt = relativeStamp(task.createdOffset, 8, 30);
      const updatedAt = relativeStamp(task.updatedOffset, 15, 15);
      const completedAt =
        task.status === 'Fait' ? relativeStamp(task.completedOffset ?? task.updatedOffset, 16, 45) : null;
      const archivedAt = task.archived ? relativeStamp(task.archivedOffset, 9, 20) : null;

      const result = insertTask.run(
        task.title,
        task.description,
        task.due_date,
        task.priority,
        task.category,
        task.status,
        createdAt,
        updatedAt,
        completedAt,
        archivedAt,
        task.archived ? 1 : 0,
        'Démo',
        task.status === 'Fait' ? 'Démo' : null
      );

      insertHistory.run(
        result.lastInsertRowid,
        'Création jeu de démonstration',
        null,
        null,
        task.title,
        createdAt
      );

      if (task.status !== 'À faire') {
        insertHistory.run(
          result.lastInsertRowid,
          'Statut initial',
          'status',
          'À faire',
          task.status,
          updatedAt
        );
      }

      if (task.archived) {
        insertHistory.run(
          result.lastInsertRowid,
          'Archive de démonstration',
          'is_archived',
          0,
          1,
          archivedAt
        );
      }
    }

    return removed;
  });

  const removed = transaction();
  runAutomations();

  const activeCount = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE is_archived = 0').get().count;
  const archivedCount = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE is_archived = 1').get().count;
  const byStatus = db
    .prepare('SELECT status, COUNT(*) AS count FROM tasks WHERE is_archived = 0 GROUP BY status ORDER BY status')
    .all();

  return {
    database: getDatabasePath(),
    inserted: demoTasks.length,
    removed,
    activeCount,
    archivedCount,
    byStatus
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = seedDemoData();
  console.log(`Base SQLite : ${result.database}`);
  console.log(`${result.inserted} consignes de démonstration ajoutées.`);
  if (result.removed > 0) {
    console.log(`${result.removed} anciennes consignes de démonstration remplacées.`);
  }
  console.log(`${result.activeCount} consignes actives, ${result.archivedCount} consignes archivées.`);
  console.table(result.byStatus);
}
