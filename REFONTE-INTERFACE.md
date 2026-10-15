# Refonte de l’interface — première étape

Cette branche prépare une interface générique pour le carnet de consignes. Elle conserve les parcours métier et les adaptateurs existants ; aucune donnée de production n’est migrée.

## Changements

- Habillage clair commun à la connexion, au tableau du jour, aux consignes, au Kanban, au calendrier, aux archives et aux réglages. Retrait du chargement des thèmes Vice Versa et minéral, et de la couche décorative redondante. Les anciens fichiers restent disponibles dans Git.
- Navigation principale extraite dans `AppShell.jsx`, marque générique réutilisable et textes de navigation séparés.
- Profil d’établissement (`hotelProfile`) avec nom, service et fuseau de l’affichage, validé par un module partagé entre navigateur et serveur. Les anciennes configurations restent lisibles. Le fuseau concerne la date d’en-tête ; les règles métier de dates ne sont pas modifiées dans cette étape.
- Ancien onglet Admin renommé « Réglages hôtel ». Les rôles internes restent inchangés pour préserver les comptes existants.
- Console propriétaire séparée, accessible par `#platform`, avec indicateurs réels de l’installation actuelle. Vérification côté serveur à chaque appel ; le rôle admin d’hôtel ne donne aucun accès plateforme par défaut.

## Console propriétaire

Dans le mode serveur seulement, renseigner `PLATFORM_OWNER_USER_ID` dans l’environnement serveur avec l’ID numérique du compte propriétaire existant. Ce compte doit être actif et avoir le rôle admin. Sans configuration explicite, la console est fermée. Cette variable ne doit pas porter le préfixe VITE_. Il n’existe aucun bouton dans l’application pour s’attribuer ce droit.

Le mode navigateur et le mode Supabase actuel ne peuvent pas établir cette identité propriétaire : la console y reste inaccessible. Il n’y a aucun mot de passe propriétaire livré dans le frontend.

Cette console est une première version en lecture seule : état de l’installation, établissement, comptes actifs et volumes. Elle ne crée pas d’hôtels et ne donne aucune illusion d’isolation entre établissements.

## Limites de cette étape

Le profil configurable n’est pas un tenant. Le stockage reste mono-établissement : ne pas connecter plusieurs hôtels à la même base actuelle. La séparation des données, Supabase Auth/RLS et la migration multi-tenant décrites dans l’audit restent à implémenter avant cette ouverture. Aucun changement d’hébergement n’est inclus.

Les protections des anciens modes demeurent celles de la branche de départ. Cette refonte ne résout pas le modèle global Supabase ni les permissions anonymes du SQL existant. L’accès propriétaire nouvellement ajouté est limité au mode serveur et n’est pas annoncé comme une refonte complète de l’authentification.

## Vérifications

`npm ci`, `npm test`, `npm run build`.

Les tests couvrent les protections existantes, la validation du profil et le contrôle propriétaire. Le test HTTP utilise une base SQLite temporaire et vérifie qu’un autre administrateur d’hôtel ne peut pas appeler l’API plateforme et qu’un changement de profil conserve les modèles existants.

La recette visuelle s’effectue avec une base de démonstration isolée : connexion, aperçu, Kanban, formulaire, réglages, console propriétaire et affichage mobile. Aucune base réelle n’est utilisée.

## Suite technique

1. Valider ce langage visuel avec la réception, puis affiner les formulaires et les réglages selon les retours.
2. Extraire les contrats métier des différents adaptateurs pour réduire les divergences sans changer les règles en cours de service.
3. Introduire le modèle hôtel/membres et les autorisations serveur en environnement de test, avec deux hôtels fictifs et des tests d’isolation.
4. Reprendre les données à blanc et comparer fonctions et volumes avant toute bascule.

La branche principale et son déploiement restent inchangés tant que la refonte n’est pas fusionnée.

## Résultat de la recette du 15 octobre 2026

- 8 tests réussis, dont un test HTTP du contrôle propriétaire.
- Build de production réussi.
- Parcours navigateur : connexion, tableau du jour, Kanban, ouverture/fermeture du formulaire, réglages et console propriétaire ; aucune erreur JavaScript observée.
- À 390 px : absence de débordement horizontal de page sur Consignes, Kanban (défilement interne), Calendrier, Checklists, Archives et Réglages.
- Aperçus issus exclusivement du jeu de démonstration : [tableau du jour](docs/previews/overview.png) et [console propriétaire](docs/previews/platform.png).
