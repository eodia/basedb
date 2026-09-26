# Modèles de base

Les modèles officiels de basedb — [chapitre 20](../../docs/architecture/20-modeles.md) :
un fichier JSON par modèle dans `catalog/`, nommé d’après sa `key`.

- **Le site public** en fait la galerie (`/basedb/modeles/`) et publie le catalogue entier à
  `/basedb/modeles/catalogue.json`, que chaque instance lit (`BASEDB_TEMPLATES_URL`). Pousser
  une modification de ce dossier sur `main` republie le site.
- **L’application** embarque ces mêmes fichiers, tels qu’ils étaient à sa construction, pour
  quand le site ne répond pas.

## Ajouter ou modifier un modèle

1. Écrire ou modifier `catalog/<key>.json` — le format est décrit au chapitre 20 §2, et la
   page « Modèles de base » de la documentation du site en donne un exemple commenté. Le plus
   simple : construire la base dans basedb, puis « Enregistrer comme modèle ».
2. `npx vitest run` dans ce dossier : chaque fichier doit passer le validateur strict de
   `@basedb/contracts`, sous la clé de son nom de fichier.
3. Le site refuse de se construire si un modèle ne passe pas le même validateur.

Un modèle ne contient jamais de partage, de droit, de webhook, de fichier ni de personne
autre que `"$moi"` ; ses champs IA ne sont calculés par l’IA qu’avec le consentement de qui
l’applique.
