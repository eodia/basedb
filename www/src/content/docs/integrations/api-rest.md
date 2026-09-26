---
title: API REST
description: Lire et écrire les lignes de basedb depuis un programme.
---

L’API REST est la même que celle qu’utilise l’interface : **il n’existe pas de route privée**.
Ses URL portent les noms physiques — ceux que vous lisez aussi en SQL.

```text
/api/v1/<tenant>/data/<base>/<table>
/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites
```

## Un jeton

Dans l’interface, menu **⋯** de la base → **Jetons API et MCP…** : on y crée un **jeton
d’intégration** limité à cette base, en lecture seule par défaut, après avoir confirmé son mot de
passe. Il n’est affiché qu’une fois ; placez-le dans une variable d’environnement.

Un jeton lit, crée et modifie s’il a été créé en écriture, **ne supprime jamais**, et n’a jamais
plus de droits que la personne qui l’a créé.

```bash
export BASEDB_TOKEN=bdb_…
curl "http://localhost:8787/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites?limit=20" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

## Lire

| Paramètre | Rôle |
|---|---|
| `filter` | une expression lisible : `statut eq "gagne" and montant gte 10000` |
| `sort` | `-montant,nom` |
| `fields` | les colonnes à renvoyer |
| `limit`, `cursor` | pagination par curseur chiffré (`next_cursor` dans la réponse) |
| `links=display` | les relations avec leur valeur d’affichage |
| `count=exact` | le total, plafonné à 100 000 |

Les opérateurs : `eq`, `ne`, `eq_ci`, `contains`, `starts_with`, `ends_with`, `in`, `is_null`,
`gt`, `gte`, `lt`, `lte`, `between`, combinés par `and`, `or`, `not` et des parenthèses. Un
filtre traverse une relation : `clients_id.ville eq "Lyon"`.

## Écrire

```bash
curl -X POST "http://localhost:8787/api/v1/t4z56fq/data/b_t4z56fq_ventes/opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN" -H "content-type: application/json" \
  -d '{"values": {"nom": "Audit RGPD", "statut": "nouveau", "montant": 12000}}'
```

`PATCH …/<table>/<_id>` modifie une ligne avec le même corps `{"values": {…}}`. Les
erreurs ont une forme unique : `{ "code": "…", "details": {…}, "request_id": "…" }`, avec un
code stable par cause.

## La documentation générée

Chaque base a sa page **Documentation API et MCP** : pour chaque table, ses points d’accès, ses
colonnes, des exemples en cURL et en JavaScript. Elle est **filtrée par vos droits** — deux
lecteurs en obtiennent deux versions — et existe aussi en OpenAPI 3.1
(`/api/v1/<tenant>/meta/bases/<base>/openapi.json`).

![La documentation générée d’une base](../../../assets/screens/documentation-api.png)
