---
title: Principii
description: Deciziile care determină arhitectura basedb.
---

basedb a fost conceput pornind de la un **document de arhitectură** — șaisprezece capitole, în
depozit, sub [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture).
Capitolul 00 stabilește douăzeci și cinci de decizii; iată spiritul lor.

## Datele sunt tabele, nu un format

O bază a utilizatorului este o **schemă** PostgreSQL, un tabel este un tabel, un câmp este o
coloană tipizată **cu nume clar**. Fără EAV (entitate-atribut-valoare), fără documente JSON în
care încape orice, fără nume opace. Catalogul `_basedb` descrie aceste obiecte; nu le
înlocuiește.

Consecință voită: SQL-ul direct este o utilizare **legitimă**. Constrângerile sunt setate în
baza de date, istoricul este captat de triggere — nimic nu presupune că scrierea trece prin
aplicație.

## Un singur punct de decizie asupra permisiunilor

Interfața, API-ul REST, serverul MCP, formularele partajate, webhook-urile: totul trece prin
**același punct de aplicare** a permisiunilor, în nucleu. Interfața este un consumator al
API-ului ca oricare altul — fără rută privată, fără token de serviciu. O resursă pe care nu o
puteți vedea răspunde exact ca o resursă care nu există.

## Nucleul decide, adaptoarele traduc

Un monorepo TypeScript: `@basedb/core` conține toată logica (catalog, motor DDL, permisiuni,
înregistrări, istoric); `apps/api` (Hono), `apps/mcp` și `apps/web` (Next.js) sunt adaptoare
care nu se apelează între ele. Interfața nu depinde niciodată de nucleu: vorbește HTTP, atât.

## Nimic nu se pierde fără o decizie

Ștergerea retrogradează, fără a distruge: un tabel șters își păstrează rândurile, lizibile în
SQL sub un nume retrogradat, și se poate restaura. Redenumirea unui nume fizic păstrează numele
vechi servit printr-un alias. Purjarea este o decizie de administrare, precedată de un export
verificat.

## PostgreSQL și nimic altceva

PostgreSQL 16 sau mai nou și nicio dependență externă obligatorie: nici coadă de mesaje, nici
cache, nici motor de căutare. Coada webhook-urilor, golirea istoricului, limitele de debit —
totul încape în baza de date sau în proces.

## Pentru a merge mai departe

| Capitol | Subiect |
|---|---|
| 00 | Decizii structurante și registrul codurilor de eroare |
| 01 | Denumire și slugificare |
| 02 | Catalogul `_basedb`, sursa de adevăr |
| 03 | Motorul DDL și migrările |
| 04 | Tipuri de câmpuri și corespondența în PostgreSQL |
| 05 | Permisiuni |
| 06 | Ciclul de viață: redenumire, ștergere, purjare |
| 07 | Istoric |
| 08 | API REST și webhook-uri |
| 09 | Server MCP |
| 10 | Arhitectura software |
| 11 | Interfață |
| 12 | Integrarea AI |
| 13 | Autentificare |
| 14 | Medii |
| 15 | Formulare partajate |
