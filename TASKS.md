# Tâches

Idées et travaux à reprendre plus tard. Une ligne par idée ; cochez ou supprimez quand c'est fait.

## À faire

- **Vues SQL entre environnements et dans les modèles** : une vue SQL reste dans la base où elle a été créée. Créer un environnement, comparer ou promouvoir la structure, enregistrer un modèle l'ignorent (chapitre 11 §1.8). Les recopier comme les tables, dans l'ordre de leurs dépendances.
- **Vue SQL sur une table supprimée** : une vue qui lit une table mise à la corbeille continue de la lire pour qui gère la base (les autres ne la voient plus). La marquer « à corriger » à la suppression, et la remettre à la restauration.

- **Tableaux de bord dans les modèles** : un modèle de base ne porte encore que les blocs des premiers tableaux de bord (chapitre 18 §2.4, chapitre 20) ; l'export d'une base en modèle laisse de côté onglets, filtres, questions SQL, jointures et filtres construits, en le disant. Étendre le format des modèles aux cartes, aux filtres et aux questions enregistrées.

## Idées

- **Boucles et attentes dans les flux d'automatisation** : une recherche ne donne que la première ligne, et un flux s'exécute d'une traite (chapitre 17, risques). Ajouter une étape « pour chaque ligne » (bornée, chaque passage suivi dans l'exécution) et une attente (« trois jours après »), qui demande de reprendre une exécution plus tard.
- **Tester une valeur dans une condition d'automatisation** : un chemin ne teste qu'une ligne, par un filtre (chapitre 17 §1.5) ; pour bifurquer sur la réponse d'une étape IA ou d'un webhook, il faut l'écrire d'abord dans un champ. Ajouter un test sur une valeur citée (`{{e3.reponse}}` égale, contient, est vide, plus grand que…).
- **Flux d'automatisation dans les modèles** : un modèle de base ne porte que des actions les unes après les autres sur la ligne déclencheuse (chapitre 20 §2.7) ; l'export laisse de côté, en le disant, une automatisation qui cherche, bifurque ou cite une étape. Étendre le format aux étapes `find_record`, `branch` et `ai`, aux identifiants d'étape et aux citations `{{e2.Libellé}}`.
- **Colonnes calculées et métriques partagées dans les questions** : une question construite ne compose que des champs existants (chapitre 18 §1.2). Y ajouter des colonnes calculées par formule, des agrégats conditionnels (« nombre si… »), et des métriques nommées qu'on réutilise d'une question à l'autre.
- **Explorer une question SQL** : un clic sur un point d'une question SQL ne mène nulle part, son résultat ne dit pas d'où viennent ses colonnes (chapitre 18 §1.7). Laisser l'auteur relier une colonne à un champ, ou en déduire la source quand elle est simple.
