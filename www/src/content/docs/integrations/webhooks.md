---
title: Webhooks
description: Prévenir un autre système à chaque création, modification ou suppression.
---

Un webhook envoie à une adresse HTTPS les **événements** d’une ou plusieurs tables :
`record.created`, `record.updated`, `record.deleted`. Ils se gèrent depuis **Webhooks…** dans le
menu de la base, sous **API et agents**.

## La charge utile

Le corps est toujours un **tableau d’événements**, chacun avec la ligne **avant** et **après**,
complètes, et la liste des champs changés :

```json
{ "events": [
  { "id": "0195e…", "type": "record.updated",
    "occurred_at": "2026-09-26T14:03:00.120Z",
    "tenant": "t4z56fq", "base": "b_t4z56fq_ventes", "table": "opportunites",
    "record_id": "0195a…",
    "actor": { "kind": "user" },
    "before": { "statut": "negociation", "montant": "125000", … },
    "after":  { "statut": "gagne", "montant": "125000", … },
    "changed": ["statut"] } ] }
```

Même une écriture faite en SQL direct produit son événement : ils partent de l’historique,
capturé par déclencheur.

## Signature, ordre, réessais

- **Signé** : `X-Basedb-Signature: t=…,v1=…`, un HMAC-SHA256 du corps brut, à vérifier avant de
  désérialiser.
- **Ordonné** par ligne : deux événements d’une même ligne arrivent dans l’ordre.
- **Réessayé** en cas d’échec ; au-delà, le webhook est désactivé et se réactive depuis
  l’interface. La file et chaque livraison se consultent, se rejouent ou s’abandonnent.
- Livraison **au moins une fois** : dédupliquez sur `X-Basedb-Delivery-Id` ou `events[].id`.

## Cibles

Les webhooks ne partent que vers des adresses **HTTPS publiques**. En développement,
`BASEDB_WEBHOOK_DEV=1` accepte HTTP et les adresses locales.

Pour un **serveur de votre réseau**, l’exploitant de l’instance le nomme dans
`BASEDB_WEBHOOK_ALLOW` — un nom, un domaine (`*.intra.example.com`), une adresse ou une plage
(`10.12.0.0/16`) :

```bash
BASEDB_WEBHOOK_ALLOW=chat.intra.example.com,10.12.0.0/16
```

Ces cibles sont acceptées quels que soient leur adresse, leur port et leur schéma, HTTP
compris. La liste vaut aussi pour les requêtes HTTP des automatisations et les sources des
tables synchronisées ; elle se règle dans l’environnement, jamais depuis l’interface.

## Sans webhook : suivre une table

Un serveur qui ne peut pas être joint peut aussi **se connecter** à basedb et suivre une table
par le flux temps réel, avec un jeton d’intégration de la base :

```bash
curl -N "https://basedb.example.com/api/v1/t4z56fq/events?base=b_t4z56fq_ventes&table=opportunites" \
  -H "Authorization: Bearer $BASEDB_TOKEN"
```

Le flux (`text/event-stream`) porte des **signaux** — l’événement `records`, avec les
identifiants des lignes créées, modifiées ou supprimées —, jamais les valeurs : le programme
relit ensuite ces lignes par l’[API REST](/basedb/integrations/api-rest/). Un jeton révoqué
ferme son flux dans les 20 secondes. Pour une table lue rarement, relire de temps en temps les
lignes changées suffit : `filter=_updated_at gt "2026-09-30T08:00:00Z"`.
