---
title: Miljøer
description: Produktion, test, udvikling — sammenlign, migrér, synkronisér.
---

En database kan have **miljøer**: produktion, test, udvikling … Hvert miljø er en fuldgyldig
database — sit skema, sine tabeller, sine rækker, sine tilladelser — og alle deler
**afstamningen** for databasen, dens tabeller og dens felter.

## I brugerfladen

Sidepanelet viser **én linje pr. database** med et mærke, der viser det åbne miljø og gør det
muligt at skifte. Mærket vises ikke, så længe der kun er produktion.

Miljøer tilføjes, omdøbes og slettes i **Rediger database…**: et nyt miljø opstår som en
**kopi af strukturen** fra et andet, uden dets rækker.

## Sammenlign miljøerne

Fra databasens menu under **Flere handlinger** åbner **Sammenlign miljøer…** en dialog:

- **Struktur**: miljøerne i kolonner, tabeller og felter i rækker; det, der afviger fra
  produktion, er fremhævet.
- **Anvend migreringer…** forbereder planen for at gå fra ét miljø til et andet, trin for
  trin. Den markerer aldrig på forhånd det, der ville annullere en nyere ændring i målet.
- **Synkronisering af rækker**: tabel for tabel overføres rækker fra ét miljø til et andet ud
  fra deres id.

![Sammenligning af produktion og test](../../../../assets/screens/environnements.png)

## Sådan ved basedb, hvem der har ændret hvad

Sammenligningen bygger på **strukturhistorikken**: hver oprettelse, ændring eller sletning af en
tabel eller et felt fanges af en trigger på kataloget og kan læses under fanen »Struktur« i
historikken. Afstamnings-id'erne forbinder et felt i test med dets modstykke i produktion, også
hvis det er omdøbt.

## I SQL

Hvert miljø er et skema: `b_t4z56fq_ventes` for produktion,
`b_t4z56fq_ventes_recette` for test. Dine forespørgsler skifter miljø ved at skifte skema —
eller `search_path`.
