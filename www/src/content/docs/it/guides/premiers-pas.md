---
title: Primi passi
description: Creare un database, una tabella, dei campi, una vista e un modulo.
---

Questo percorso richiede dieci minuti e copre l’essenziale: alla fine avrai una tabella, una
vista kanban e un modulo pubblico che vi scrive.

:::tip[Per vedere tutto in una volta]
Un progetto vuoto propone il **database di dimostrazione**: una piccola agenzia, i suoi clienti,
progetti, attività, fatture e recensioni, con formule, viste di ogni tipo, una dashboard e
automazioni. **Nuovo database** apre anche la [galleria dei modelli](/basedb/it/fonctionnalites/modeles/),
dove puoi descrivere il tuo database all’IA.
:::

## 1. Creare un database

Tutto si organizza per **progetto**: il selettore in cima alla barra laterale cambia progetto o
ne crea uno. Nella barra, il **+** a destra del filtro crea un database. Dagli un’etichetta
— «Ventes» — e, se vuoi, una descrizione, un colore, un’icona.

Il database diventa uno **schema PostgreSQL**: il suo nome fisico (`b_t4z56fq_ventes`) compare
nella finestra di creazione e nella documentazione generata.

## 2. Creare una tabella e i suoi campi

Dal menu **⋯** del database: **Nuova tabella**. Aggiungi poi i suoi campi da
**Struttura** — nello stesso menu — con il suo pulsante
**Campo**:

| Campo | Tipo |
|---|---|
| Nom | Testo breve |
| Statut | Selezione singola — Nouveau, Qualifié, Gagné, Perdu |
| Montant | Valuta |
| Échéance | Data |
| Client | Relazione → Clients |
| Notes | Testo lungo (Markdown) |

Più avanti, una formula (`JOURS([Échéance]; AUJOURDHUI())`), una ricerca (la città del cliente)
o un’aggregazione (l’importo totale per cliente) si aggiungono allo stesso modo — vedi
[Tabelle e campi](/basedb/it/fonctionnalites/tables-et-champs/).

Puoi anche **importare un file** CSV o JSON: l’importazione riconosce i tipi, ti lascia
correggerli, crea la tabella o completa una tabella esistente, e indica riga per riga cosa
rifiuta.

![Menu di un database](../../../../assets/screens/menu-base.png)

## 3. Inserire e filtrare

La griglia si modifica come un foglio di calcolo: doppio clic o Invio per modificare una cella,
Esc per annullare. **Filtra** combina condizioni per campo; l’ordinamento si fa dall’intestazione
della colonna; **Cerca…**, a destra della barra, cerca in tutte le colonne. Ogni
modifica viene salvata subito — e [registrata nella cronologia](/basedb/it/fonctionnalites/historique/):
**Ctrl+Z** annulla l’ultima.

## 4. Aggiungere una vista

Il selettore delle viste, a sinistra di «Filtra», propone «Tutte le righe» e poi le tue viste.
Crea un **kanban** raggruppato per «Statut»: trascinare una scheda da una colonna all’altra
modifica la riga.

![Un kanban per stato](../../../../assets/screens/kanban.png)

## 5. Condividere un modulo

Crea una vista **Modulo**, spunta le domande, poi **Condividi**: scegli «Pubblico» e
copia il link. Ogni risposta aggiunge una riga alla tabella, senza dare alcun permesso a chi
risponde. Dettagli in [Moduli condivisi](/basedb/it/fonctionnalites/formulaires-partages/).

## 6. Leggere in SQL

Menu **⋯** del database → **Nuova query SQL**: le tue tabelle sono lì, con il loro vero nome.

```sql
SELECT nom, statut, montant
FROM b_t4z56fq_ventes.opportunites
WHERE statut = 'gagne'
ORDER BY montant DESC;
```

**Salva** la dispone sotto le tabelle, nella sezione «Query» — per te o per tutto il
database — e **⋯** → **Crea vista SQL…** ne fa una vera vista PostgreSQL, disposta tra le
tabelle. Ognuno le legge con i propri permessi. Vedi
[Query e viste SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/).

È lo stesso da `psql` o dal tuo strumento di BI. Vedi [SQL diretto](/basedb/it/integrations/sql/).
