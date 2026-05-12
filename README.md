# Overview Réception Hôtel

Petite application web professionnelle pour remplacer le carnet de consignes papier d’une réception d’hôtel.

Elle fournit un overview rapide, un Kanban, un calendrier, des archives automatiques et une connexion simple par comptes `Admin` et `Réception`.
Un onglet `Admin` permet aussi d’ajuster les réglages utiles sans modifier le code.

## Installation

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

Créez ensuite un fichier `.env` à partir de `.env.example`.

Sous Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

Sous macOS/Linux :

```bash
cp .env.example .env
```

## Configuration

Variables disponibles dans `.env` :

```env
PORT=3001
DATABASE_PATH=./data/hotel-overview.sqlite
DEFAULT_ADMIN_USERNAME=Admin
DEFAULT_ADMIN_PASSWORD=admin
VITE_BASE_PATH=/
VITE_STATIC_MODE=false
VITE_DATA_MODE=local
VITE_API_BASE=
VITE_SUPABASE_URL=
VITE_SUPABASE_KEY=
VITE_SUPABASE_TABLE=overview_reception_state
VITE_SUPABASE_STATE_ID=main
VITE_SUPABASE_CACHE_MS=2500
```

- `PORT` : port du serveur Express.
- `DATABASE_PATH` : chemin du fichier SQLite.
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD` : identifiants du premier compte administrateur si aucun utilisateur n’existe encore.
- `VITE_BASE_PATH` : chemin public du frontend, utile pour GitHub Pages.
- `VITE_STATIC_MODE` : `true` pour faire tourner l’app sans backend, avec stockage navigateur.
- `VITE_DATA_MODE` : `local` pour stockage navigateur, `supabase` pour stockage partagé sur GitHub Pages.
- `VITE_API_BASE` : URL publique du backend si le frontend est hébergé séparément.
- `VITE_SUPABASE_URL` : URL du projet Supabase, par exemple `https://votre-ref.supabase.co`.
- `VITE_SUPABASE_KEY` : clé publique Supabase, idéalement la clé `sb_publishable_...`.
- `VITE_SUPABASE_TABLE` / `VITE_SUPABASE_STATE_ID` : nom de table et identifiant de stockage, à laisser par défaut sauf besoin particulier.
- `VITE_SUPABASE_CACHE_MS` : cache court côté navigateur pour éviter plusieurs lectures Supabase identiques en rafale.

Par défaut, le premier compte créé est :

- utilisateur : `Admin`
- mot de passe : `admin`

Ce compte doit servir à créer les comptes réception depuis l’onglet `Admin`.

## Lancement en développement

```bash
npm run dev
```

Par défaut :

- Frontend Vite : `http://localhost:5173`
- Backend API : `http://localhost:3001`

## Jeu de démonstration

Pour remplir la base avec des consignes réalistes avant une démo :

```bash
npm run seed:demo
```

La commande ajoute des consignes pour le Kanban, le calendrier, le Registre et les Archives.
Elle remplace uniquement les anciennes consignes de démonstration qui portent les mêmes titres, sans supprimer vos consignes créées manuellement.

## Lancement en production

```bash
npm run build
npm start
```

L’application est alors servie par Express sur `http://localhost:3001` ou sur le port défini par `PORT`.

## Déploiement GitHub Pages

Un workflow GitHub Pages est fourni dans `.github/workflows/pages.yml`.

Important : GitHub Pages héberge uniquement le frontend statique. Le serveur Express et SQLite ne peuvent pas tourner directement sur GitHub Pages.

Le projet contient donc deux modes :

- Mode complet serveur : Express + SQLite, recommandé pour un vrai usage partagé entre réception et direction.
- Mode GitHub Pages : l’application tourne entièrement dans le navigateur avec `localStorage`. Les comptes, consignes, archives, historiques, automatisations, exports et réglages fonctionnent, mais les données restent locales au navigateur utilisé.
- Mode GitHub Pages + Supabase : l’application reste statique, mais sauvegarde les données dans une table Supabase pour les partager entre plusieurs ordinateurs.

Le workflow construit l’interface avec :

```env
VITE_BASE_PATH=/HSSG-Logiciel/
VITE_STATIC_MODE=true
VITE_DATA_MODE=${{ vars.VITE_DATA_MODE }}
VITE_SUPABASE_URL=${{ vars.VITE_SUPABASE_URL }}
VITE_SUPABASE_KEY=${{ vars.VITE_SUPABASE_KEY }}
VITE_SUPABASE_ANON_KEY=${{ vars.VITE_SUPABASE_ANON_KEY }}
VITE_SUPABASE_PUBLISHABLE_KEY=${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
VITE_API_BASE=${{ vars.VITE_API_BASE }}
```

Dans GitHub, activez Pages avec la source `GitHub Actions`.

Limites du mode GitHub Pages :

- les données ne sont pas synchronisées entre plusieurs ordinateurs ou téléphones
- un directeur qui ouvre l’URL depuis chez lui aura sa propre base locale, différente de celle de la réception
- la sécurité est seulement une barrière d’interface, car tout tourne dans le navigateur
- pour un usage réel partagé, il faut garder le backend Express/SQLite hébergé ailleurs

Si vous hébergez l’API ailleurs, désactivez `VITE_STATIC_MODE` et définissez `VITE_API_BASE` avec l’URL publique de l’API, par exemple `https://api-votre-domaine.fr`.

### GitHub Pages avec données partagées Supabase

Cette option permet de garder un hébergement gratuit sur GitHub Pages tout en consultant les mêmes consignes depuis plusieurs appareils.

Dans Supabase, ouvrez `SQL Editor`, créez une nouvelle requête, puis collez le contenu de `scripts/supabase-setup.sql` :

```sql
create table if not exists public.overview_reception_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.overview_reception_state (id, data)
values ('main', '{}'::jsonb)
on conflict (id) do nothing;

alter table public.overview_reception_state enable row level security;

drop policy if exists "overview_reception_state_read" on public.overview_reception_state;
drop policy if exists "overview_reception_state_insert" on public.overview_reception_state;
drop policy if exists "overview_reception_state_update" on public.overview_reception_state;

create policy "overview_reception_state_read"
on public.overview_reception_state
for select
to anon
using (true);

create policy "overview_reception_state_insert"
on public.overview_reception_state
for insert
to anon
with check (true);

create policy "overview_reception_state_update"
on public.overview_reception_state
for update
to anon
using (true)
with check (true);
```

Dans GitHub, allez dans `Settings` > `Secrets and variables` > `Actions` > `Variables`, puis ajoutez :

- `VITE_DATA_MODE` : `supabase`
- `VITE_SUPABASE_URL` : l’URL du projet Supabase, par exemple `https://votre-ref.supabase.co`
- `VITE_SUPABASE_KEY` : la clé publique Supabase `sb_publishable_...` ou la clé legacy `anon`

Vous pouvez aussi utiliser `VITE_SUPABASE_PUBLISHABLE_KEY` ou `VITE_SUPABASE_ANON_KEY` si vous préférez garder le nom exact de Supabase.

Relancez ensuite le workflow `Deploy GitHub Pages`.

Important : cette option est pratique et gratuite pour une démonstration ou un usage interne léger, mais ce n’est pas une sécurité forte. La clé publique est incluse dans le site statique. Ne stockez donc pas de données sensibles, et préférez le mode serveur Express/SQLite avec HTTPS pour une mise en production sérieuse.

### Publication sans Git installé

Si `git` n’est pas disponible sur la machine, le script PowerShell `scripts/publish-github.ps1` peut pousser le projet via l’API GitHub.

Prévisualiser les fichiers envoyés :

```powershell
.\scripts\publish-github.ps1 -DryRun
```

Publier vers `VhK2005/HSSG-Logiciel` :

```powershell
.\scripts\publish-github.ps1
```

Le script demande un token GitHub en saisie masquée. Ne collez jamais ce token dans un chat, un fichier ou une commande enregistrée dans l’historique.

Pour éviter de le retaper à chaque publication, acceptez la sauvegarde proposée par le script ou lancez :

```powershell
.\scripts\publish-github.ps1 -SaveToken
```

Le token est alors stocké via le chiffrement Windows de votre utilisateur dans `%APPDATA%\OverviewReceptionHotel\github-token.xml`.

Pour supprimer ce token enregistré :

```powershell
.\scripts\publish-github.ps1 -ClearSavedToken
```

## Fonctionnement

### Checklists de shift

L’onglet `Checklists` remplace l’ancienne page de passation. Les informations opérationnelles étant déjà visibles en continu dans l’application, cet onglet sert aux routines fixes de réception :

- checklist matin
- checklist après-midi
- checklist nuit

Les cases cochées sont mémorisées par date dans le navigateur, avec recherche, impression et export TXT.
Le contenu détaillé des checklists peut être stocké dans les réglages de l’application plutôt que dans le dépôt GitHub public.

### Kanban

Le Kanban est une vue tactique. Il affiche uniquement les consignes opérationnelles de réception qui sont en retard ou à finir dans le nombre de jours défini dans l’onglet `Admin`, quelle que soit leur priorité.

Les catégories suivantes ne sont jamais affichées dans le Kanban ni dans le calendrier principal :

- Maintenance
- Facturation
- Direction
- Autre

Elles restent accessibles dans la page `Registre`.

La fenêtre d’affichage et les catégories masquées peuvent être modifiées dans `Admin`.

Les colonnes du Kanban sont :

- En cours
- En attente
- À faire
- Fait

Chaque consigne contient un titre, une description courte, une date limite, une priorité, une catégorie, un statut et les dates de création, modification et finalisation.

Les cartes sont repliées par défaut pour garder les colonnes lisibles. Elles peuvent être dépliées, déplacées par drag and drop, et leur statut ou priorité peut être changé directement depuis la carte.

Les actions rapides disponibles sur les cartes permettent de marquer une consigne comme faite, la repousser à demain, la mettre en attente, noter qu’elle a été relancée ou créer une nouvelle relance datée.

### Registre

La page `Registre` affiche toutes les consignes actives qui ne sont pas visibles dans le Kanban :

- Maintenance
- Facturation
- Direction
- Autre
- consignes opérationnelles sans date limite
- consignes opérationnelles dont l’échéance est au-delà de 5 jours

Elles peuvent y être consultées, recherchées, modifiées, supprimées et changées de statut.

Le Registre permet aussi de filtrer par `type de consigne`, par exemple `Maintenance`, `Facturation`, `Relance`, `Direction` ou `Proposition réservation`.

### Création rapide

Le bouton `Nouvelle consigne` affiche d’abord uniquement les types de consigne.

Quand un réceptionniste choisit un type, l’application lance un parcours question-réponse et demande seulement les informations nécessaires.

Types disponibles :

- `Proposition réservation` : client ou référence, date d’envoi, date de relance.
- `Maintenance` : chambre ou lieu, problème constaté, date souhaitée d’intervention.
- `Ménage` : chambre ou zone, action demandée, date limite.
- `Facturation` : client ou dossier, point à vérifier, date limite.
- `Bagagerie` : client ou étiquette, date de dépôt, date de suivi ou récupération.
- `Demande client` : client ou chambre, demande, date de traitement.
- `Direction` : sujet, consigne, date limite.
- `Autre` : ouvre le formulaire classique complet.

Chaque modèle remplit automatiquement la catégorie, la priorité, le statut et la description de la consigne.

Les modèles peuvent être activés, désactivés, ajoutés, supprimés ou modifiés dans l’onglet `Admin`.

### Admin

L’onglet `Admin` regroupe les réglages réservés au responsable ou au directeur :

- création des comptes réception
- statistiques par utilisateur : consignes créées et consignes finalisées
- fenêtre d’affichage du Kanban
- catégories masquées du Kanban et du calendrier principal
- modèles du parcours question-réponse
- export CSV ou JSON des consignes
- téléchargement d’une sauvegarde SQLite
- injection du jeu de démonstration
- suppression du jeu de démonstration

Les réglages sont stockés dans SQLite dans la table `app_settings`.
L’onglet `Admin` est visible uniquement pour les utilisateurs ayant le rôle `admin`.

### Attribution des consignes

Chaque consigne garde maintenant :

- le nom de l’utilisateur qui l’a créée
- le nom de l’utilisateur qui l’a finalisée

Ces informations apparaissent dans les cartes détaillées et dans les archives.
Les statistiques d’équipe sont visibles uniquement dans `Admin`.

### Overview

L’onglet `Overview` affiche :

- les statistiques rapides du jour
- un camembert de répartition par statut
- un graphique des types de consignes les plus publiés
- les priorités à surveiller

La priorité d’une consigne peut être modifiée directement depuis les cartes qui l’affichent.

### Historique

Chaque création, modification, changement de statut, changement de priorité, restauration et automatisation importante est enregistrée dans l’historique de la consigne.

L’historique est visible depuis la fenêtre de modification d’une consigne.

### Calendrier

Le calendrier principal affiche une vraie grille mensuelle, avec navigation par mois, les consignes placées à leur date limite, les retards mis en évidence et un rappel des tâches du jour.

### Automatisation

L’automatisation tourne côté serveur :

- au démarrage du serveur
- toutes les heures
- à chaque appel de `GET /api/tasks`

Règle appliquée :

- Si une consigne est en `En attente` ou `En cours`
- et si elle arrive à `J-1`
- alors elle repasse automatiquement en `À faire`

Les consignes en `J-4`, `J-3`, `J-2`, `Aujourd’hui` ou `En retard` gardent leur statut manuel. Elles peuvent donc rester ou être déplacées librement entre `À faire`, `En cours` et `En attente`.

Les consignes `Fait` et les consignes archivées ne sont pas modifiées par cette règle.

Les badges visibles sont :

- `J-4`, `J-3`, `J-2`, `J-1` quand l’échéance approche
- `Aujourd’hui` le jour de l’échéance
- `En retard` si la date est dépassée

### Archivage automatique

Quand une consigne passe en `Fait`, une date de finalisation est enregistrée automatiquement.

Deux jours après cette finalisation, la consigne est déplacée automatiquement dans les archives. Les archives ont leur propre page avec recherche, filtre par catégorie, filtre par période et restauration.

Une consigne restaurée revient dans le Kanban en statut `À faire`.

## Accès à distance

Le directeur peut consulter l’application depuis l’extérieur via une URL si elle est hébergée ou exposée correctement.

Options recommandées :

- Héberger l’application sur un petit VPS avec Node.js, un reverse proxy HTTPS et un volume persistant pour SQLite.
- Utiliser Render, Railway ou Fly.io, en vérifiant que le fichier SQLite est stocké sur un volume persistant.
- Utiliser Cloudflare Tunnel ou Tailscale pour exposer l’application sans ouvrir directement un port public.

À éviter :

- Ouvrir directement un port de la box internet sans HTTPS, sans mot de passe et sans filtrage.

Pour un accès distant, changez les identifiants par défaut avant la mise en service et créez des comptes nominatifs pour la réception.

## API

- `GET /api/tasks`
- `GET /api/tasks/archived`
- `GET /api/tasks/:id/history`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/restore`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `GET /api/admin/contribution-stats`

## Données sensibles

Cette application est un carnet de consignes opérationnel, pas un coffre-fort de données personnelles.

Ne stockez pas de données sensibles comme numéros de carte bancaire, passeports, données médicales ou informations trop personnelles sur les clients.
# HSSG-Logiciel
