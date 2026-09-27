---
title: Permessi e gruppi
description: Account, gruppi, livelli di accesso per progetto, database e tabella, restrizioni per campo, e le tue impostazioni.
---

I permessi si concedono a **gruppi**, mai alle persone una per una. Un livello
impostato su un progetto, un database o una tabella si estende a tutto ciò che sta
sotto, compreso ciò che verrà creato in seguito.

## I quattro livelli

| Livello | Consente |
|---|---|
| **Nessun accesso** | niente: la risorsa è invisibile |
| **Lettura** | vedere le righe, commentarle, crearsi viste personali, consultare la struttura e le dashboard, porre le proprie domande, scrivere SQL in sola lettura e salvare le proprie query personali |
| **Modifica** | in più creare, modificare, eliminare righe |
| **Gestione** | in più modificare la struttura, creare le viste condivise, le dashboard e le domande salvate, condividere una dashboard tramite link, condividere query, creare viste SQL, le automazioni, le integrazioni e i token; il suo SQL ha accesso a tutto il database, scritture comprese |

I permessi **si sommano**: una persona riceve il livello più alto che le dà uno dei
suoi gruppi. Dare a una tabella meno che al suo database la rende «granulare».

Esistono sempre due gruppi: **Amministratori**, che gestiscono tutto, e **Tutti gli
utenti**, di cui fa parte ogni account — ciò che gli si concede, lo hanno tutti.

## Fino al campo

Sotto la griglia dei livelli, **Campi** nasconde una colonna a un gruppo, oppure la rende non modificabile
per quel gruppo. La schermata mostra anche ciò che una determinata persona vede realmente, e tramite quale gruppo.

Un campo nascosto è assente ovunque: dalla griglia, dalle viste, dall’API, da MCP, dalla cronologia,
dall’SQL scritto nell’interfaccia e dalle viste SQL. Filtrare o ordinare su di esso risponde come per un campo
che non esiste.

## E l’SQL?

Nell’interfaccia, l’SQL segue gli stessi permessi, applicati da PostgreSQL stesso: senza il livello
Gestione, una query viene eseguita in sola lettura, su un ruolo proprio della persona, dove una tabella
preclusa non esiste e un campo nascosto viene rifiutato. Una [vista SQL](/basedb/it/fonctionnalites/requetes-et-vues-sql/)
si legge con i permessi di chi la legge, e condividere una query ne condivide solo il testo.

Un accesso **`psql` diretto** al database, invece, non è governato da basedb: legge tutto, campi
nascosti compresi. Le restrizioni proteggono le superfici del prodotto — interfaccia, API, MCP —, mai
da chi dispone di un accesso SQL al database; questi accessi si regolano con dei `GRANT`
PostgreSQL, impostati da chi amministra l’installazione.

## Account e accesso

- Un account si crea con una **password temporanea**, mostrata una volta e da cambiare al
  primo accesso.
- L’accesso avviene con password o tramite un fornitore **OpenID Connect** dichiarato da chi
  amministra l’installazione.
- Le azioni di amministrazione richiedono una **sessione elevata**: una password ridigitata negli
  ultimi cinque minuti.
- Le sessioni si possono revocare; revocare una sessione invalida immediatamente i suoi token di accesso.

## Le tue impostazioni

**Impostazioni**, nel menu del profilo in basso a sinistra, riguarda solo te:

| Tab | Cosa vi si fa |
|---|---|
| **Profilo** | il nome visualizzato; l’indirizzo di accesso; i fornitori di identità collegati all’account, da collegare o scollegare |
| **Sicurezza** | cambiare la password; le sessioni aperte, da chiudere una alla volta o tutte insieme |
| **Aspetto** | la lingua dell’interfaccia; il tema; l’ordine delle date — `25/09/2026` o `2026-09-25` — e il primo giorno della settimana dei calendari |
| **Notifiche** | i tipi di notifica che non vuoi più ricevere |
| **Token** | i token di integrazione che hai creato, su tutti i tuoi database, il loro ultimo utilizzo e la loro revoca |

basedb parla **venti lingue**: francese, inglese, tedesco, spagnolo, italiano, portoghese
(Brasile), olandese, polacco, ceco, svedese, danese, norvegese, finlandese, rumeno, ungherese,
turco, ucraino, giapponese, cinese semplificato e coreano. Per impostazione predefinita, l’interfaccia usa la lingua
del tuo browser; **Lingua**, in **Aspetto**, ne imposta un’altra. I numeri e le date
seguono la lingua scelta.

Il tema resta proprio del browser; la lingua, l’ordine delle date e il primo giorno della
settimana ti seguono da un dispositivo all’altro. Cambiare indirizzo o collegare un fornitore richiede una sessione
elevata; un account senza password, che accede tramite un fornitore, mantiene l’indirizzo di quel
fornitore.

## Il punto di applicazione unico

Tutte le superfici — interfaccia, API, MCP, moduli e viste condivisi, automazioni —
passano per lo stesso punto di decisione dei permessi, nel nucleo. Non esiste una route
privata dell’interfaccia: ciò che lo schermo non mostra è ciò che l’API non ha restituito.

Vale anche il contrario: lo schermo **non propone ciò che verrebbe rifiutato**. Senza il livello
Gestione, la schermata Struttura si consulta senza pulsanti né matite, e l’importazione non propone di
creare una tabella; senza il permesso di creare o eliminare righe, la griglia non offre né la riga
di aggiunta né «Elimina».
