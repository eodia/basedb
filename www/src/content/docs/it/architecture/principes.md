---
title: Principi
description: Le decisioni che determinano l’architettura di basedb.
---

basedb è stato progettato a partire da un **documento di architettura** — sedici capitoli, nel repository,
in [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture). Il suo
capitolo 00 fissa venticinque decisioni; eccone lo spirito.

## I dati sono tabelle, non un formato

Un database utente è uno **schema** PostgreSQL, una tabella è una tabella, un campo è una
colonna tipizzata **con un nome leggibile**. Niente EAV (entità-attributo-valore), niente documento JSON
pigliatutto, niente nomi opachi. Il catalogo `_basedb` descrive questi oggetti; non li sostituisce.

Conseguenza voluta: l’SQL diretto è un uso **legittimo**. I vincoli sono definiti nel
database, la cronologia è catturata da trigger — nulla presuppone che la scrittura passi
dall’applicazione.

## Un unico punto di decisione dei permessi

L’interfaccia, l’API REST, il server MCP, i moduli condivisi, i webhook: tutto passa per
lo **stesso punto di applicazione** dei permessi, nel nucleo. L’interfaccia è un
consumatore dell’API come un altro — nessuna route privata, nessun token di servizio. Una
risorsa che non si può vedere risponde esattamente come una risorsa che non esiste.

## Il nucleo decide, gli adattatori traducono

Un monorepo TypeScript: `@basedb/core` contiene tutta la logica (catalogo, motore DDL,
permessi, righe, cronologia); `apps/api` (Hono), `apps/mcp` e `apps/web`
(Next.js) sono adattatori che non si chiamano tra loro. L’interfaccia non dipende mai dal
nucleo: parla HTTP, punto.

## Nulla si perde senza una decisione

Eliminare accantona, senza distruggere: una tabella eliminata conserva le sue righe, leggibili in SQL con
un nome accantonato, e si può ripristinare. Rinominare un nome fisico continua a servire il vecchio tramite un alias. L’eliminazione
definitiva è una decisione di amministrazione, preceduta da un’esportazione verificata.

## PostgreSQL, e nient’altro

PostgreSQL 16 o superiore, e nessuna dipendenza esterna obbligatoria: né code di messaggi, né cache,
né motore di ricerca. La coda dei webhook, lo svuotamento della cronologia, i limiti di frequenza:
tutto sta nel database o nel processo.

## Per approfondire

| Capitolo | Argomento |
|---|---|
| 00 | Decisioni strutturali e registro dei codici di errore |
| 01 | Denominazione e slugificazione |
| 02 | Il catalogo `_basedb`, fonte di verità |
| 03 | Motore DDL e migrazioni |
| 04 | Tipi di campo e proiezione PostgreSQL |
| 05 | Permessi |
| 06 | Ciclo di vita: ridenominazione, eliminazione, eliminazione definitiva |
| 07 | Cronologia |
| 08 | API REST e webhook |
| 09 | Server MCP |
| 10 | Architettura software |
| 11 | Interfaccia |
| 12 | Integrazione IA |
| 13 | Autenticazione |
| 14 | Ambienti |
| 15 | Moduli condivisi |
