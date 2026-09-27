---
title: Tableaux de bord
description: Des questions posées à la souris ou en SQL, quinze façons de les montrer et de les régler, des tableaux de bord en grille, en onglets, sous des filtres communs — lus avec les droits de chacun, et partagés par un lien.
---

Un **tableau de bord** rassemble sur une page ce qu’une équipe regarde tous les jours : les
chiffres qui comptent, leur évolution mois après mois, la répartition d’un statut, les
prochaines échéances. Chaque carte y montre une **question** — une lecture de la base,
construite à la souris ou écrite en SQL — et des **filtres** en haut de la page pilotent les
cartes qu’on leur relie.

![Le tableau de bord « Pilotage de l’agence » : tendance du mois, objectif, chiffre d’affaires empilé, sentiment des avis](../../../assets/screens/tableaux-de-bord.png)

Tout s’ouvre depuis **Tableaux de bord**, dans le bloc de la base ouverte en bas de la barre
latérale. À gauche, les tableaux de bord et les questions enregistrées de la base, et
**Explorer les données** pour poser une question sans rien enregistrer. Tout lecteur de la base
les consulte, les explore et enregistre ses propres questions ; construire un tableau de bord et
partager une question demandent le niveau **Gestion**.

Une question enregistrée est **personnelle** — vous seul la voyez —, à **toute la base** ou à
**des groupes**. Son menu, d’un clic droit ou par **⋯**, l’ouvre dans un onglet à côté des
tables, change son nom et son partage, ou la supprime. Le **+** de la barre d’onglets propose
aussi **Nouvelle question** et **Nouvelle question SQL**.

**Enregistrer**, dans l’en-tête d’une question, la garde ; une question que vous ne pouvez pas
modifier propose à la place **Enregistrer une copie**, qui devient la vôtre. **⋯** (Plus
d’actions) offre aussi **Nom et partage…**, **Enregistrer une copie…** et **Supprimer la
question** ; un onglet qui la montrait garde son contenu, redevenu non enregistré.

## Poser une question à la souris

Une question se construit par étapes, l’une sous l’autre :

![L’éditeur d’une question : les données, les filtres, le résumé par mois](../../../assets/screens/question-editeur.png)

| Étape | Ce qu’on y choisit |
|---|---|
| **Données** | la table de départ, et les colonnes montrées quand rien n’est résumé |
| **Joindre des données** | une autre table de la base, reliée par une relation — proposée d’elle-même — ou par deux colonnes de même nature ; jointure à gauche, interne, à droite ou complète |
| **Filtre** | par colonne, avec ce que son type propose : est / n’est pas, contient, entre, vide… ; pour une date, une **période** : aujourd’hui, les 30 derniers jours, ce mois-ci, le trimestre dernier, du … au … ; ou une expression écrite comme dans la barre des vues |
| **Résumer** | des mesures — nombre de lignes, somme, moyenne, médiane, minimum, maximum, valeurs distinctes, écart type, cumuls — **par** une à trois colonnes |
| **Trier**, **Limiter** | l’ordre des lignes, et combien au plus |

Une date se regroupe **par jour, semaine, mois, trimestre ou année**, ou par rang — jour de la
semaine, mois de l’année, heure du jour ; un nombre, en tranches. Une liste de choix multiples
compte chaque ligne dans chacun de ses choix. Les périodes se lisent dans votre fuseau et la
semaine commence le jour de vos paramètres.

**Visualiser** lance la question. Le résultat se montre de la façon qui lui convient — un
chiffre, une courbe, des barres, un tableau — et se change en bas de l’écran :

| Visualisation | Pour montrer |
|---|---|
| **Chiffre**, **Tendance**, **Progression**, **Jauge** | une valeur ; la dernière période face à la précédente et à la même l’an dernier ; l’avancée vers un objectif |
| **Histogramme**, **Barres**, **Courbe**, **Aires**, **Combiné** | des mesures le long d’une dimension, en séries côte à côte, empilées ou à 100 % |
| **Secteurs**, **Entonnoir** | des parts, des étapes |
| **Nuage de points** | deux mesures l’une contre l’autre, une troisième en taille |
| **Tableau**, **Tableau croisé** | les lignes, triables ; les lignes par une dimension, les colonnes par une autre, avec leurs totaux |
| **Carte** | les régions ou départements de France, ou les pays, colorés par une valeur ; ou des points par latitude et longitude |

**Réglages** règle ce qui se montre, et le résultat se télécharge en **CSV**.

### Personnaliser un graphique

| Visualisation | Ce que **Réglages** propose |
|---|---|
| **Barres, courbes, aires, combiné** | la couleur et le nom de chaque série ; l’empilement, avec le total au-dessus des piles ; la largeur des barres ; des courbes lissées ou en escalier, avec ou sans points ; l’ordre des catégories ; les titres des axes, les graduations, l’inclinaison des étiquettes, les bornes, une échelle logarithmique ; les valeurs sur le graphique ; un objectif |
| **Secteurs** | un anneau et son épaisseur, un demi-cercle, une rose ; le total au centre ; le nombre de parts avant « Autres » ; la couleur et le nom de chaque part ; les étiquettes sur les parts ou à côté ; la place de la légende |
| **Entonnoir** | la couleur et le nom de chaque étape, leur ordre |
| **Chiffre, tendance, progression, jauge** | la couleur, des couleurs selon la valeur, une légende sous le chiffre, la comparaison — et si une baisse est une bonne nouvelle |
| **Tableau, tableau croisé** | renommer et réordonner les colonnes, des barres dans les cellules, des couleurs selon la valeur — par cellule ou par ligne —, la densité, les lignes par page, les numéros de ligne, les totaux |
| **Carte** | la teinte, les noms des régions |

Pour tous, le format des nombres : décimales, préfixe et suffixe, abrégé en `1,2 k`.

## Explorer d’un clic

Un clic sur une barre, un point ou une part ouvre ce qu’il représente :

- **Voir ces lignes** : les lignes derrière le point, filtrées par ce qu’il représente ;
- **Détailler par semaine** : une période ouverte sur une plus fine — une année sur ses
  trimestres, un mois sur ses semaines ;
- **Répartir par…** : la même mesure, pour ce point, par une autre colonne ;
- **Seulement cette valeur**, **Exclure cette valeur**.

Chaque pas est une question à part, qui s’enregistre si l’on veut ; la flèche de retour revient
au pas précédent. Une ligne d’un tableau ouvre sa fiche.

Sur un tableau de bord, le même clic propose aussi **Filtrer le tableau : « Lyon »**, avec le
nombre de cartes concernées : un filtre **temporaire**, jamais enregistré, affiché en pointillés
dans la barre des filtres et retirable d’un clic, qui s’applique à chaque carte dont la question
lit la même colonne — par sa table ou par une jointure. Il n’est proposé que si aucun filtre du
tableau n’est déjà relié à cette colonne sur la carte, et reste grisé (« seule carte ») quand
aucune autre carte ne la lit. Les questions SQL n’en tiennent pas compte.

## Écrire une question en SQL

Une **question SQL** est un `SELECT` sur les tables de la base, sous leur vrai nom. Elle
s’exécute **en lecture seule, avec vos propres droits** — pour tout le monde, gestionnaires
compris : une table qui vous est fermée n’existe pas, un champ masqué est refusé, et une
écriture est impossible. Pour ranger simplement une requête sous les tables, sans graphique, ou
en faire une vraie vue PostgreSQL, voir [Requêtes et vues SQL](/basedb/fonctionnalites/requetes-et-vues-sql/).

Une **variable** s’écrit `{{nom}}` ; une partie à retirer quand elle n’a pas de valeur, entre
`[[` et `]]` :

```sql
SELECT statut, count(*) AS taches
  FROM taches
 WHERE {{periode}} [[AND priorite = {{priorite}}]]
 GROUP BY statut
```

Une variable est un texte, un nombre, une date — ou un **filtre de colonne** : `{{periode}}`
devient alors toute une condition sur la colonne choisie, `echeance` ici, ou `TRUE` quand rien
n’est choisi. C’est ce qui permet à un filtre du tableau de bord de piloter une question SQL
comme les autres.

## Arranger un tableau de bord

**Modifier** passe le tableau en édition :

- **Question** place une question enregistrée — une question personnelle y est recopiée —, ou
  en crée une propre à la carte ;
- **Titre** ajoute un titre de section, **Texte** un texte mis en forme — titres, listes,
  liens — qui peut citer des chiffres (voir plus bas) ;
- **Page intégrée** affiche une adresse `https://` dans un cadre isolé, qui ne reçoit ni
  session ni donnée ;
- **Onglet** répartit les cartes sur plusieurs pages ; un double clic renomme un onglet.

Les cartes se déplacent par leur poignée et se redimensionnent par leur coin, sur une grille de
24 colonnes. **Enregistrer** garde le tout ; **Annuler** revient à la version d’avant. Un titre
de carte, en lecture, ouvre sa question pour l’explorer, filtres du tableau compris.

### Des chiffres dans le texte

Un texte cite une valeur par un nom entre doubles accolades : « Ce mois-ci,
`{{chiffre_affaires}}` de chiffre d’affaires sur `{{commandes}}` commandes. » Chaque nom devient
une pastille, à relier d’un clic — ou par **Variable** dans la barre de l’éditeur — à :

| Source | Ce que le texte montre |
|---|---|
| **une carte** du tableau | ce qu’elle montre, sous ses propres filtres |
| **une question enregistrée** de toute la base | sa valeur, et les filtres du tableau s’y relient comme à une carte |
| **une question gardée dans le texte** | sa valeur ; c’est ainsi qu’on cite une question personnelle |
| **un filtre** du tableau | la valeur choisie, comme sa commande la dit |

La valeur d’une question est celle que montrerait son **Chiffre** : sa première mesure, sur la
dernière ligne. Elle se calcule avec les droits du lecteur, et s’affiche toujours comme du texte.
Un texte cite 20 valeurs au plus ; un nom s’écrit en minuscules, chiffres et `_`. Les textes
écrits en Markdown avant l’éditeur se lisent comme avant, et deviennent riches dès qu’on les
réécrit. Le Copilot, lui, écrit ses textes en Markdown.

## Les filtres

**Filtre** ajoute un contrôle en haut du tableau : une **date** (une période), une
**catégorie** (des valeurs à cocher), un **texte**, un **nombre**, ou un **regroupement de
date** qui fait passer les courbes du mois à la semaine ou à l’année.

Un filtre pilote les cartes qu’on lui relie — une, plusieurs ou toutes. À sa création il se
relie de lui-même aux colonnes qui lui conviennent ; sélectionné, il montre sur chaque carte la
colonne qu’il filtre, à changer ou à retirer, et **Relier à toutes les cartes compatibles**
complète le reste. Il peut avoir une **valeur par défaut** — « Cette année », par exemple.

En lecture, un clic sur un point peut aussi régler un filtre : **Filtrer par « Lyon »** sur une
carte dont la colonne des villes est reliée au filtre « Ville ».

![L’onglet « Activité » : tâches par échéance empilées par statut, entonnoir des projets, heures estimées en tableau croisé](../../../assets/screens/tableaux-de-bord-activite.png)

## Le Copilot

**Copilot**, dans l’en-tête de la section Tableaux de bord, ouvre à droite une conversation en
langage naturel sur la base : « le chiffre d’affaires par mois », « ajoute un filtre par client »,
« pourquoi août baisse ? ». Chaque proposition arrive comme une carte, qui s’applique d’un clic :

| Proposition | Ce qu’elle fait |
|---|---|
| **Une question** | exécutée et dessinée dans la conversation ; elle s’ouvre dans l’éditeur ou s’ajoute au tableau |
| **Des modifications du tableau**, ou un tableau neuf | cartes ajoutées, modifiées ou retirées, textes, filtres reliés d’eux-mêmes aux cartes qui ont la colonne, onglets, nom — un seul enregistrement, **annulable** depuis la carte |
| **Des valeurs pour les filtres affichés** | « montre-moi le mois dernier » : les filtres se règlent, rien n’est enregistré |

Poser une question ou régler les filtres est ouvert à tout lecteur de la base ; modifier ou créer
un tableau demande le niveau **Gestion**.

Par défaut, **seule la structure** part chez le fournisseur d’IA, avec la conversation : les
tables et leurs champs, les tableaux et les questions enregistrées de la base, et le tableau
affiché — ses onglets, ses filtres, la définition de ses cartes (leurs questions, leurs textes).
Ni les lignes, ni les résultats des cartes, ni les **valeurs choisies dans les filtres**, qui
peuvent être des données : d’un filtre ne part que le fait qu’il en a une. Un champ marqué
invisible pour les agents ne part pas, ni la question d’une carte qui le cite.

La case **Autoriser la lecture des données** ajoute, pour la conversation, les valeurs des
filtres affichés et les résultats des cartes sous ces filtres (50 lignes au plus par lecture,
listées sous la réponse), pour commenter les chiffres à l’appui. Voir
[Intelligence artificielle](/basedb/fonctionnalites/ia/).

## Partager un tableau de bord

**Partager**, dans l’en-tête d’un tableau de bord, s’offre à qui a le niveau **Gestion** sur la
base. Deux voies :

- **Partager la base…** invite des personnes à la base : elles ouvrent le tableau dans basedb, et
  chaque carte lit avec leurs propres droits ;
- **Créer le lien** donne un lien vers ce **seul** tableau, qui ne demande aucun droit sur la base.

| Accès du lien | Qui lit |
|---|---|
| **Public** | quiconque a le lien, sans compte |
| **Membres connectés** | un membre de l’espace, après connexion — au besoin, de certains groupes seulement |

La page du lien montre les onglets, les filtres et les cartes du tableau, **en lecture seule** :
ni exploration, ni accès aux lignes, ni question à soi. Ses cartes lisent avec les **droits de la
personne qui a publié le lien**, redécidés à chaque lecture : si elle perd l’accès à la base, le
lien est **suspendu**. L’interrupteur **Lien actif** le coupe sans le perdre, **Régénérer**
invalide l’ancien.

Cochez **Autoriser l’intégration à un autre site** : le dialogue donne un **code d’intégration**
`<iframe>`, pour afficher le tableau dans un intranet ou un wiki. C’est le même mécanisme que les
[vues partagées](/basedb/fonctionnalites/vues-partagees/).

## Chacun ses droits

Chaque carte lit **avec les droits de qui regarde** : le même tableau montre à chacun ce qu’il a
le droit de voir — sauf par un lien de partage, qui lit avec ceux de la personne qui l’a publié. Une carte qui porte sur une table ou un champ qui vous est fermé affiche
« Donnée inaccessible », plutôt qu’un chiffre qui mentirait par omission. Enregistrer une
question ne partage que la question, jamais ce que son auteur peut lire.

## Limites

- Une question rend 2 000 lignes au plus ; un résumé s’en contente presque toujours.
- Chaque carte fait sa requête à l’ouverture et à chaque filtre, sans cache.
- Les fonds de carte couvrent la France métropolitaine (régions, départements) et les pays du
  monde. Source : IGN, Admin Express (Licence ouverte) ; Natural Earth.
