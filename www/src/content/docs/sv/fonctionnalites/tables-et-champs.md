---
title: Tabeller och fält
description: Fälttyperna i basedb, hur de avbildas i PostgreSQL, formler och beräknade fält.
---

Varje tabell i basedb är en PostgreSQL-tabell, och varje fält en typad kolumn. Etiketten du
skriver in (”Échéance”) blir ett läsbart fysiskt namn (`echeance`) genom en stabil
**slugifiering**: utan accenter, med gemener och utan reserverade ord.

## Typerna

| Typ | PostgreSQL-kolumn | Kommentarer |
|---|---|---|
| Kort text | `text` | en rad |
| Lång text | `text` | Markdown: ett utdrag i rutnätet, renderad text när du hovrar, en egen redigerare; kan [citera en kolumn](#formaterad-text-och-variabler) |
| Formaterad text | `text` + `CHECK` | HTML som saneras vid skrivning, skriven i en visuell redigerare – [se nedan](#formaterad-text-och-variabler) |
| Tal | `numeric` | aldrig flyttal: ett belopp glider inte |
| Valuta, Procent, Varaktighet, Betyg | `numeric` | ett tal och dess [visningsformat](#visningsformat): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Kryssruta | `boolean` | |
| Datum | `date` | |
| Datum och tid | `timestamptz` | en absolut tidpunkt, visad i läsarens tidszon |
| Enkelval | `text` + `CHECK` | färg, ikon eller bild per alternativ |
| Flerval | `text[]` + `CHECK` | kan filtreras med array-operatorerna |
| E-post | `text` + `CHECK` | en adress som databasen kontrollerar, öppnas med ett klick |
| Telefon, Streckkod | `text` | en kort text och dess format: samtalslänk, fast teckenbredd |
| URL | `text` + `CHECK` | kompletteras när du skriver (`exemple.fr` → `https://exemple.fr`) |
| Person | `uuid` | en medlem i arbetsytan; den som anges får en [avisering](/basedb/sv/fonctionnalites/collaboration/) |
| Autonummer | `bigint` (identity) | numrerar även rader som redan finns; ingen skriver in det |
| Relation | `uuid` + `FOREIGN KEY` | en riktig främmande nyckel till måltabellen |
| Multipel relation | `uuid[]` | flera länkade rader, vars integritet upprätthålls av en trigger |
| Formel | genererad kolumn `STORED` | beräknas av PostgreSQL – eller vid läsning, se [Formler](#formler) |
| Uppslag, Aggregering, Antal | ingen | beräknas vid läsning, genom en relation |
| Knapp | ingen | öppnar en adress eller startar en [automatisering](/basedb/sv/fonctionnalites/automatisations/) |
| Fil, Bild | `jsonb` (metadata) | själva filinnehållet hamnar i [fillagringen](/basedb/sv/fonctionnalites/fichiers/) |

Varje tabell har också sina **systemkolumner**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` – de underhålls av en trigger och kan aldrig
skrivas via API:et. Rutnätet samlar dem under **Systeminformation** i kolumnmenyn: de finns i
varje tabell men är användbara i få.

![Rutnätet för en tabell, med en beräknad varaktighet, ett uppslag och ett antal](../../../../assets/screens/grille.png)

## Villkor som databasen upprätthåller

Det gränssnittet lovar, garanterar PostgreSQL. Ett enkelval är ett `CHECK`-villkor, en relation
en `FOREIGN KEY`, en URL eller en e-postadress ett reguljärt uttryck. En skrivning med direkt
SQL som bryter mot dem avvisas, precis som i gränssnittet:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Visningsformat

Valuta, Procent, Varaktighet, Betyg, Telefon och Streckkod väljs som typer, men de är
**format**: kolumnen förblir ett tal eller en text, det är bara visningen som ändras.

| Format | För | Visas och skrivs in som |
|---|---|---|
| Valuta | ett tal | `12 500,00 €` – euro, dollar, pund, schweizerfranc, kanadensisk dollar, yen |
| Procent | ett tal | `15 %` |
| Varaktighet | ett antal sekunder | `1:30`, och skrivs in som `1h30`, `90 min` |
| Betyg | ett tal | 1 till 10 stjärnor, ställs in med ett klick |
| Telefon | en kort text | en samtalslänk |
| Streckkod | en kort text | med fast teckenbredd |

Ett format kan ändras i efterhand (**Visning**, när du redigerar fältet) utan att de sparade
värdena påverkas. Det begränsar inte värdet: betyget 7 på en skala till 5 förblir 7.

## Formler

En formel skrivs på franska, med fälten inom hakparenteser och argumenten åtskilda med `;`:

```text
ARRONDI([Montant HT] * (1 + [Taux de TVA]); 2)
SI([Payée]; FAUX; JOURS(AUJOURDHUI(); [Échéance]) > 0)
JOURS([Fin]; [Début])
```

Redigeraren föreslår fält att infoga och har en panel med funktionerna; ett fel pekar ut fältet
eller tecknet som orsakar det.

| Grupp | Funktioner |
|---|---|
| Logik | `SI`, `SIVIDE`, `ESTVIDE`, `ET`, `OU`, `NON`, `VRAI`, `FAUX` |
| Tal | `ARRONDI`, `ABS`, `PLAFOND`, `PLANCHER`, `MIN`, `MAX` |
| Text | `MAJUSCULE`, `MINUSCULE`, `SANSESPACES`, `GAUCHE`, `DROITE`, `LONGUEUR`, `TEXTE`, `NOMBRE` |
| Datum | `ANNEE`, `MOIS`, `JOUR`, `JOURSEMAINE`, `JOURS`, `AJOUTER_JOURS`, `DATE`, `AUJOURDHUI`, `MAINTENANT` |
| Operatorer | `+ - * /`, `&` för att sammanfoga text, `= <> < <= > >=` |

En formel blir en **genererad kolumn** i PostgreSQL: `psql` och dina verktyg läser den som
vilken kolumn som helst. En formel som beror på dagens datum (`AUJOURDHUI()`, `MAINTENANT()`)
eller som citerar ett uppslag eller en aggregering **beräknas vid läsning**: den kan filtreras
och sorteras i basedb, men finns inte i direkt SQL.

En formel citerar varken en annan formel eller en relation direkt – det gör ett uppslag.
Att extrahera eller ersätta en del av en text kommer senare.

## Uppslag, aggregeringar och antal

Tre fält läser **genom en relation**, åt ena eller andra hållet – ”projektets kund”, men också
”uppgifterna som är länkade via Projekt”:

- ett **uppslag** hämtar ett värde från den länkade raden, eller listan med värden: stad för
  ett projekts kund;
- en **aggregering** räknar på de länkade raderna: antal värden, summa, medelvärde, minimum,
  maximum – en kunds omsättning, medelbetyget i kundens omdömen;
- ett **antal** räknar de länkade raderna: antalet uppgifter i ett projekt.

De beräknas vid varje läsning, **med läsarens behörigheter**: är den länkade tabellen stängd
för dig är fältet det också. De kan filtreras och sorteras. De följer en enda relation, kan inte
skrivas och har ingen kolumn – och finns därför inte i direkt SQL – och de ingår varken i
importen, i formulären eller i historiken.

## Relationer

En **relation** kopplar en rad till en rad i en annan tabell i samma databas. Rutnätet visar
målradens **visningsvärde** – den kolumn du har angett som visningsfält för dess tabell – och
filtren går genom relationen (`clients_id.ville eq "Lyon"`). Raderna som pekar på en rad visas
i dess raddetaljer.

Kryssa i **Flera rader per post** så blir relationen **multipel**: en uppgift beror på flera
uppgifter, en artikel hör till flera kategorier. De länkade raderna visas som etiketter, väljs
genom en sökning och öppnas med ett klick från raddetaljerna. Tar du bort en målrad försvinner
den ur listorna som citerade den – eller så avvisas borttagningen, om du har valt det. Filtren
`has_any`, `has_all` och `is_null` fungerar, och även de går genom relationen
(`taches_ids.titre contains "logo"`). En multipel relation kan ännu inte sorteras, grupperas
eller importeras.

## Knapp

Ett **Knapp**-fält har inget värde: det gör något. Det **öppnar en adress** – `https://` eller
`mailto:`, som kan citera raden (`mailto:{{E-mail}}`) – eller **startar en automatisering**
som utlöses av en knapp i samma tabell. Det visas i cellen, på kortet och i raddetaljerna.

## Beskrivningar

En databas, en tabell och ett fält har en **beskrivning**, som kan ändras utan migrering. Den
kopieras till den `COMMENT ON` som `psql` läser, till den genererade dokumentationen och till
det en agent läser via `describe_table`.

## Formaterad text och variabler

**Formaterad text** är HTML-varianten av lång text, som väljs när fältet skapas
(”Formaterad text (HTML)”): rubriker, fetstil, kursiv, understrykning, genomstrykning, listor,
citat, kod, länkar och avdelare, i en visuell redigerare. HTML-koden **saneras vid skrivning**,
oavsett om den kommer från gränssnittet, API:et, MCP-servern eller en import, och ett
`CHECK`-villkor avvisar dessutom farliga konstruktioner som skrivs direkt i SQL (`<script>`,
`on…`-attribut, `javascript:`). Inga bilder, tabeller eller färger: det som databasen inte
skulle behålla erbjuds inte.

En lång text – vanlig eller formaterad – kan **citera en kolumn i sin rad**. Redigerarens meny
**Kolumn** infogar citatet vid markören: en etikett i formaterad text, `{{Ville}}` i Markdown.

> Leverans planerad den `{{Livraison}}` till `{{Ville}}`.

- Kolumnen sparar citatet som det skrevs – `{{ville}}`, med sitt fysiska namn: det är det som
  `psql` läser.
- Överallt annars – rutnätet, raddetaljerna, API:et, MCP-servern, de delade vyerna,
  automatiseringarna – läses texten **med radens värde**: ”Leverans planerad den 2026-10-02 till
  Lyon.” Ändrar du staden ändras texten.
- Ett enkelval läses via sin etikett, en person via sitt namn, ett datum i ditt format; ett
  värde som infogas i formaterad text blir aldrig till märkning.
- En kolumn som läsaren inte får läsa ger ingenting: varken värdet eller namnet.

Formaterad text kan inte fyllas i av AI: en modell skriver text, inte sanerad HTML.

## Ändra strukturen

Databasens **Struktur**-skärm – i dess **⋯**-meny i sidofältet – listar tabellerna och deras
fält: lägg till, byt namn, gör obligatoriskt, ändra ordning, beskriv, ange visningsfältet.

![Struktur-skärmen för en databas](../../../../assets/screens/structure.png)

Att ändra strukturen kräver nivån **Hantera**. Utan den kan skärmen bara visas och erbjuder
ingenting: ingen knapp, ingen penna, inget handtag – att ett fält är obligatoriskt och vilket
som är visningsfältet visas, men kan inte ändras. Servern avvisar ändå varje ändring; skärmen
låtsas inte längre att den accepteras.

Att lägga till, byta namn på eller ändra typ för ett fält går via **migreringsmotorn**: en plan i
steg, korta lås och ett namngivet avslag när ett värde inte kan konverteras.

**Byt namn** på en databas, en tabell eller ett fält görs i en och samma dialog. Etiketten
ändras alltid, utan migrering. En administratör ser under den ”Byt namn även i databasen:
`clients` → `comptes`”: är den ikryssad ändras även det fysiska namnet, och konsekvensanalysen
visas – de frågor, SQL-vyer och automatiseringar som citerar det gamla namnet. Det gamla namnet
fortsätter att fungera via ett **kompatibilitetsalias** – en vy – medan du uppdaterar dina
frågor.

Att ta bort raderar ingenting direkt: tabellen eller databasen flyttas undan
(`zz_supprime_…`) och går fortfarande att läsa i SQL. En borttagen databas kan återställas; att
återställa en enskild tabell från gränssnittet [kommer senare](/basedb/sv/feuille-de-route/).
Den slutgiltiga **rensningen** är förbehållen administrationen, trettio dagar senare, och börjar
med en kontrollerad CSV-export.
