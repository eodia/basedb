---
title: Collaborazione
description: Commenti e menzioni, notifiche, aggiornamenti in tempo reale e presenza.
---

Più persone lavorano sullo stesso database contemporaneamente: ognuna vede arrivare le scritture
degli altri, sa chi sta guardando cosa, e discute di una riga proprio dove si trova.

## Commenti

I dettagli della riga hanno una tab **Commenti**, tra «Dettagli» e «Cronologia». Digita
`@` per **menzionare** un membro, Ctrl+Invio per inviare. Ognuno modifica o elimina i
propri commenti.

![Una conversazione su un progetto](../../../../assets/screens/commentaires.png)

Poter leggere la riga basta per commentarla. Una persona menzionata che non può leggerla
non viene avvisata — e l’autore ne viene informato invece di credere che il messaggio sia partito.

## Notifiche

La campanella, in alto a destra, conta ciò che non è stato letto. Vi arrivano quattro cose:

- qualcuno ti **menziona** in un commento;
- qualcuno **risponde** in una conversazione in cui hai scritto;
- qualcuno ti **indica** in un campo Persona — dall’interfaccia, dall’API, da un modulo
  o da un’automazione;
- un’[automazione](/basedb/it/fonctionnalites/automatisations/) ti **avvisa**.

Aprire una notifica apre la riga. **Segna tutto come letto** azzera il contatore; le
notifiche vengono conservate 90 giorni.

![Una menzione ricevuta](../../../../assets/screens/notifications.png)

## Tempo reale

Le scritture degli altri compaiono **senza ricaricare**: una cella modificata, una scheda
spostata, una riga aggiunta — che provengano dall’interfaccia, dall’API, da un agente o dall’SQL
diretto. Il server invia solo un **segnale**, mai un dato: è lo schermo che rilegge, con
i tuoi permessi. Una cella che stai modificando non viene mai sostituita sotto le tue
dita.

## Presenza

I volti delle persone che guardano **la stessa tabella** compaiono in cima allo schermo; quelli
di chi ha aperto **la stessa riga**, nell’intestazione dei suoi dettagli. Nella griglia, il puntatore degli
altri compare sulla cella che stanno sorvolando.

## Annullare

Ctrl+Z annulla la tua ultima scrittura — vedi [la cronologia](/basedb/it/fonctionnalites/historique/#annullare-ctrlz).

## Limiti

- Le notifiche restano in basedb: per ora nessuna viene inviata via email.
- Oltre cento righe modificate in una volta, lo schermo ricarica l’intera pagina invece di
  aggiornarla riga per riga.
