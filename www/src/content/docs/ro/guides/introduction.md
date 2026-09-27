---
title: Introducere
description: Ce este basedb și ce îl deosebește de foile de calcul colaborative.
---

**basedb** este o bază de date colaborativă, în spiritul foilor de calcul colaborative,
pe care o găzduiți chiar dumneavoastră — cu o diferență care determină tot restul: **datele
dumneavoastră se află în tabele PostgreSQL reale**, tipizate și cu nume clare.

![Grila unui tabel în basedb](../../../../assets/screens/grille.png)

## O promisiune simplă

Niciun model generic, niciun `JSONB` în care încape orice, niciun `field_1837`:

| În basedb | În PostgreSQL |
|---|---|
| O bază „Ventes” | o schemă `b_t4z56fq_ventes` |
| Un tabel „Opportunités” | un tabel `opportunites` |
| Un câmp „Échéance” (Dată) | o coloană `echeance date` |
| O selecție unică „Statut” | o coloană `text` și constrângerea ei `CHECK` |
| O relație „Client” | o coloană `clients_id uuid` și cheia ei `FOREIGN KEY` |

Puteți deci deschide `psql`, un instrument de BI sau un script Python și vă puteți citi datele
fără a trece prin produs — ba chiar puteți scrie în ele: constrângerile rămân valabile, iar
istoricul înregistrează scrierea.

## Pentru cine?

- **Echipele operaționale** care vor o grilă, vizualizări și formulare fără să aștepte un
  proiect de dezvoltare.
- **Echipele tehnice** care refuză să-și vadă datele închise într-un format proprietar și vor
  să-și conecteze instrumentele obișnuite.
- **Agenții AI**, care găsesc un server MCP, permisiuni clare și propuneri supuse aprobării
  unei persoane.

## Ce veți găsi

- [Tabele și câmpuri](/basedb/ro/fonctionnalites/tables-et-champs/) tipizate, relații care
  sunt chei străine reale — sau multiple —, formule calculate de PostgreSQL, căutări și
  agregări prin relații.
- Opt [vizualizări](/basedb/ro/fonctionnalites/vues/): grilă, kanban, calendar, cronologie,
  galerie, listă, formular, chestionar — colaborative sau personale.
- [Formulare](/basedb/ro/fonctionnalites/formulaires-partages/) și
  [vizualizări](/basedb/ro/fonctionnalites/vues-partagees/) partajate printr-un link și
  calendare la care vă puteți abona dintr-o aplicație de calendar.
- [Colaborarea](/basedb/ro/fonctionnalites/collaboration/): comentarii și mențiuni,
  notificări, actualizări în timp real.
- [Automatizări](/basedb/ro/fonctionnalites/automatisations/) și
  [tablouri de bord](/basedb/ro/fonctionnalites/tableaux-de-bord/) cu întrebările lor, construite cu mouse-ul sau în SQL.
- [SQL pentru fiecare](/basedb/ro/fonctionnalites/requetes-et-vues-sql/), cu propriile sale
  permisiuni: interogări salvate sub tabele și vizualizări PostgreSQL reale așezate printre ele.
- [Șabloane pentru baze](/basedb/ro/fonctionnalites/modeles/), alese dintr-o galerie sau cerute
  AI-ului.
- [Medii](/basedb/ro/fonctionnalites/environnements/) — producție, testare — pe care le
  comparați și le migrați.
- Un [istoric](/basedb/ro/fonctionnalites/historique/) al fiecărei scrieri, inclusiv SQL
  direct, și Ctrl+Z pentru anulare.
- [Permisiuni](/basedb/ro/fonctionnalites/droits/) pe grup, până la nivel de câmp.
- Un [API REST](/basedb/ro/integrations/api-rest/), un [server MCP](/basedb/ro/integrations/mcp/),
  [webhook-uri](/basedb/ro/integrations/webhooks/), Slack și
  [tabele sincronizate](/basedb/ro/integrations/synchronisation/).
- Funcții [AI](/basedb/ro/fonctionnalites/ia/) opționale: câmpuri calculate de un model, Copilot.

## Starea proiectului

basedb este software liber (AGPL-3.0) dezvoltat de [Eodia](https://eodia.com/fr/), un studio
de software AI-nativ, și se află în dezvoltare activă. Nucleul, API-ul, serverul MCP și
interfața funcționează și sunt acoperite de peste o mie de teste;
[foaia de parcurs](/basedb/ro/feuille-de-route/) spune ce urmează. Documentul său de
[arhitectură](https://github.com/eodia/basedb/tree/main/docs/architecture), de vreo douăzeci
de capitole, stabilește fiecare decizie.

:::tip[Încercați]
După ce ați clonat depozitul, o singură comandă este suficientă: `docker compose up -d`.
Consultați [instalarea](/basedb/ro/guides/installation/).
:::
