---
title: Query e viste SQL
description: SQL per tutti, ognuno con i propri permessi; query salvate sotto le tabelle, personali o condivise; vere viste PostgreSQL disposte tra le tabelle.
---

Le tue tabelle sono vere tabelle PostgreSQL, e l’interfaccia le interroga in SQL, con il loro vero
nome. Ogni membro del database può scrivere una query, **salvarla** sotto le tabelle — solo per
sé, per tutto il database o per alcuni gruppi —, e chi gestisce il database può farne una
**vista SQL**: una vera vista PostgreSQL, disposta tra le tabelle, che leggono anche `psql` e i tuoi strumenti.

![Una query salvata, aperta dalla sezione «Query»; sopra, due viste SQL disposte tra le tabelle](../../../../assets/screens/requete-sql.png)

## Ognuno con i propri permessi

Il **+** della barra delle tab, oppure menu **⋯** del database → **Query SQL**, apre una
tab SQL: un editor con evidenziazione della sintassi e completamento, **Ctrl+Invio** per eseguire, e il
risultato nella stessa griglia delle tue tabelle. Ciò che la query può leggere dipende da chi la esegue:

- con il livello **Gestione** sul database, tutto il database, scritture comprese;
- con i livelli **Lettura** o **Modifica**, la query viene eseguita **in sola lettura, con i tuoi
  permessi**. Una tabella che ti è preclusa per lei non esiste; un campo che ti è
  nascosto scompare da `SELECT *` e viene rifiutato se lo nomini, anche qualificando la tabella;
  una scrittura viene rifiutata. Il risultato porta il badge **I tuoi permessi**.

![Il badge «I tuoi permessi»: la query vede solo le tabelle e i campi accessibili alla persona](../../../../assets/screens/sql-vos-droits.png)

Non è lo schermo a filtrare: è PostgreSQL stesso ad applicare i tuoi permessi, colonna per colonna, su
un ruolo che ti è proprio. Una query non può quindi mostrarti nulla che la griglia, l’API o il
server MCP non ti mostrerebbero.

## Salvare una query

**Salva**, nella barra della tab, dispone la query sotto le tabelle del database, nella
sezione **Query**. Si riapre con un clic; **⋯** → **Salva con nome…** ne crea una
copia, **Nome e condivisione…** (nella tab o nel suo menu della barra laterale) la rinomina, cambia
chi la vede o la elimina — **Elimina** è anche nel suo menu, con un clic destro. Una tab che la
mostrava conserva il suo testo.

![Salvare una query: il suo nome, cosa mostra e chi la vede](../../../../assets/screens/requete-enregistrer.png)

| Ambito | Chi la vede | Chi può crearla e modificarla |
|---|---|---|
| **Personale** — un lucchetto | solo tu | chiunque veda il database, per sé |
| **Tutto il database** | chiunque veda il database | il livello **Gestione** sul database |
| **Alcuni gruppi** | i membri dei gruppi scelti | il livello **Gestione** sul database |

**Condividere una query ne condivide il testo, mai ciò che il suo autore può leggere.** Ognuno la esegue
con i propri permessi: la stessa query, aperta da due persone, mostra a ciascuna ciò che
ha il permesso di vedere — oppure le dice che una colonna per lei non esiste.

Una query aperta dalla barra laterale **viene eseguita subito, in sola lettura**: vedi
il suo risultato senza aver deciso nulla. **Esegui** la rilancia poi così com’è. Un punto
accanto al suo nome segnala che hai cambiato il testo dopo il salvataggio; **Salva**
lo registra se puoi modificarla, altrimenti propone di crearne una nuova.

## Le viste SQL

Una **vista SQL** è una vera vista PostgreSQL dello schema del database. Si colloca **tra le
tabelle**, con il suo colore e la sua icona come una tabella, e un piccolo **occhio** a destra che indica
che è una vista. Un clic la apre in una tab: le sue righe nella griglia, **Aggiorna** per
rileggerle.

![La vista «Factures à encaisser», aperta dalla barra laterale](../../../../assets/screens/vue-sql.png)

Si crea dal menu **⋯** del database → **Nuova vista SQL…**, oppure da una tab SQL:
**⋯** → **Crea vista SQL…**, e la query della tab diventa la sua definizione. La finestra di dialogo
chiede:

- la sua **etichetta** e il suo **aspetto** — colore, icona o immagine, scelti come per una
  tabella;
- il suo **nome tecnico**, ricavato dall’etichetta se non ne indichi uno — quello che si scrive dopo
  `FROM`;
- la sua **query**: un solo `SELECT`, sulle tabelle e sulle altre viste del database. PostgreSQL
  rifiuta ciò che rifiuta, e l’editor indica il punto esatto.

![La finestra di dialogo di una vista SQL: etichetta e aspetto, nome tecnico, query, descrizione](../../../../assets/screens/vue-sql-dialogue.png)

La vista si legge poi con il suo nome, dall’interfaccia come da `psql` o dal tuo strumento di BI:

```sql
SELECT * FROM b_t4z56fq_demo_atelier_lumen.factures_a_encaisser;
```

**Una vista non mostra mai un campo che non si vede.** Ognuno la legge con i propri permessi,
su ogni tabella e ogni colonna che essa legge; la barra laterale la elenca solo a chi può leggere
tutto ciò che essa legge. Legge solo il **suo** database: un altro database, o il catalogo di basedb,
vengono rifiutati fin dalla creazione. Crearla, modificarla o eliminarla richiede il livello **Gestione**
sul database. **Elimina**, nel suo menu della barra laterale, la rimuove per tutti, script e
strumenti compresi; le tabelle che legge non vengono toccate.

### Quando la struttura cambia

- **Rinominare** una tabella o un campo non rompe una vista: PostgreSQL la segue.
- **Cambiare la formula** di un campo calcolato che essa legge la rimuove per un istante, poi la ricrea sulla
  nuova colonna. Se non regge più, resta **da correggere** — lo indica un triangolo nella
  barra laterale — con la sua definizione conservata: **Modifica vista…**, correggi, salva.
- Una tabella non viene eliminata definitivamente finché una vista la legge, e una vista non viene eliminata finché un’altra
  vista la legge: il rifiuto indica la vista in questione.

## Query, vista SQL o domanda?

| | Cos’è | Dove si trova | Per |
|---|---|---|---|
| **Query salvata** | un testo SQL | sotto le tabelle, sezione «Query» | ritrovare una query, condividerla come testo |
| **Vista SQL** | una vera vista PostgreSQL | tra le tabelle | dare un nome a una lettura, per l’interfaccia **e** per `psql`, i tuoi script, i tuoi strumenti |
| **Domanda** | una lettura costruita con il mouse o in SQL, e la sua visualizzazione | nelle [dashboard](/basedb/it/fonctionnalites/tableaux-de-bord/) | un numero, un grafico, una tabella pivot, sotto dei filtri |

## Limiti

- La griglia mostra al massimo il numero di **righe per pagina** scelto in fondo allo schermo; «troncato»
  lo segnala. Una query si interrompe dopo 15 secondi.
- Una vista SQL si legge in SQL e nell’interfaccia; l’API REST e il server MCP non la espongono.
- Una vista SQL resta nell’ambiente in cui è stata creata: creare un ambiente, confrontare
  la struttura o salvare un modello non la includono ancora.
