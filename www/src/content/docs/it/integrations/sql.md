---
title: SQL diretto
description: Leggere e scrivere le tabelle di basedb con psql, uno strumento di BI o uno script.
---

È la ragion d’essere di basedb: **le tue tabelle sono vere tabelle**. Qualsiasi client PostgreSQL
le legge con il loro nome.

## I nomi

| Oggetto | Nome fisico | Esempio |
|---|---|---|
| Database | uno schema `b_<tenant>_<nom>` | `b_t4z56fq_ventes` |
| Ambiente di collaudo | lo schema con un suffisso | `b_t4z56fq_ventes_recette` |
| Tabella | il suo nome slugificato | `opportunites` |
| Campo | il suo nome slugificato | `echeance` |
| Relazione | `<table cible>_id` | `clients_id` |
| [Vista SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/) | il suo nome tecnico, nello schema del database | `factures_a_encaisser` |

La pagina **Documentazione API e MCP** di ogni database li indica tutti, e `\d` in `psql` mostra
le descrizioni (`COMMENT ON`).

## Nell’interfaccia

Il **+** della barra delle tab, oppure menu **⋯** del database → **Query SQL**: un editor
con evidenziazione della sintassi e completamento, il cui risultato compare nella stessa griglia delle tue tabelle.

![Una query salvata, e due viste SQL disposte tra le tabelle](../../../../assets/screens/requete-sql.png)

- **Ognuno vi legge con i propri permessi**: il livello Gestione ha tutto il database, scritture comprese; gli
  altri membri scrivono SQL in sola lettura, dove una tabella preclusa non esiste e un campo
  nascosto scompare.
- Una query **si salva** sotto le tabelle — per sé, per tutto il database o per alcuni
  gruppi —, e diventa, se lo si desidera, una **vista SQL**: una vera vista PostgreSQL, disposta tra
  le tabelle e leggibile da `psql`.

Tutto è descritto in dettaglio in [Query e viste SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/).

## Da psql

Con il `docker-compose.yml` fornito, PostgreSQL è pubblicato su `127.0.0.1:5432`:

```bash
psql "postgres://basedb:<POSTGRES_PASSWORD>@localhost:5432/basedb"
```

```sql
SET search_path = b_t4z56fq_ventes;

SELECT o.nom, o.montant, c.nom AS client
FROM opportunites o
JOIN clients c ON c._id = o.clients_id
WHERE o.statut = 'gagne';
```

## Scrivere in SQL

È consentito. I vincoli (selezioni singole, relazioni, URL, obbligatorietà) sono garantiti
da PostgreSQL e rifiutano un valore non valido, come nell’interfaccia. E la scrittura viene
**registrata nella cronologia**: la cronologia la mostra come «Sessione SQL diretta», con la sessione che l’ha
eseguita, e si annulla come le altre.

:::caution
Modificare la **struttura** in SQL (`ALTER TABLE`) aggira il catalogo di basedb, che non ne
saprebbe nulla. Passa dall’interfaccia, dall’API o da una proposta di un agente: il motore di
migrazione pianifica, blocca per poco tempo e mantiene esatto il catalogo.
:::
