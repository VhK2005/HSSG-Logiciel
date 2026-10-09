# Migration HSSG — accès à Supabase requis

Les changements locaux ne sécurisent pas encore la base de production.

Avant publication :
1. Vérifier projet sortoyinaobgsoapnbbu, règles RLS réelles et rôle de la clé publique. Ne pas extraire les mots de passe ou sessions dans les journaux.
2. Préserver les données métier et vérifier une sauvegarde restaurable, protégée et limitée aux personnes autorisées.
3. Migrer les comptes vers Supabase Auth avec invitations/réinitialisation. Ne pas réutiliser les mots de passe en clair.
4. Séparer profils, consignes, historiques, lectures et validations de checklist. Autorisations imposées côté base ; création des comptes réservée à une fonction serveur.
5. Migrer les données sans supprimer la source, contrôler les volumes et les droits anon/réception/admin.
6. Basculer le client sur les sessions Auth et écritures transactionnelles avec détection des conflits.
7. Fermer les accès anonymes à l’ancien état, révoquer les sessions et purger les caches. Vérifier le nouveau parcours avant retrait définitif de la source.

RGPD à compléter avec la direction : responsable/contact, finalités et bases légales, information salariés/clients, durées de conservation par type de consigne, prestataires/région/transferts et procédure de droits/incidents. Aucune durée ni identité juridique n’a été inventée.

Les coches restent locales dans cette première correction ; l’interface le précise. La synchronisation de checklist dépend de la migration.
