---
title: Tabeller og felter
description: basedbs felttyper, hvordan de afspejles i PostgreSQL, formler og beregnede felter.
---

Hver tabel i basedb er en PostgreSQL-tabel; hvert felt en kolonne med en type. Den etiket, du
indtaster (»Échéance«), bliver et læsbart fysisk navn (`echeance`) gennem en stabil
**slugificering**: uden accenter, med små bogstaver og uden reserverede ord.

## Typerne

| Type | PostgreSQL-kolonne | Bemærkninger |
|---|---|---|
| Kort tekst | `text` | én linje |
| Lang tekst | `text` | Markdown: et uddrag i gitteret, det formaterede resultat ved hover, en dedikeret editor; kan [citere en kolonne](#formateret-tekst-og-variabler) |
| Formateret tekst | `text` + `CHECK` | HTML, der renses ved skrivning, skrevet i en visuel editor — [se nedenfor](#formateret-tekst-og-variabler) |
| Tal | `numeric` | aldrig flydende tal: et beløb glider ikke |
| Valuta, Procent, Varighed, Bedømmelse | `numeric` | et tal og dets [visningsformat](#visningsformater): `12,50 €`, `15 %`, `1:30`, ★★★★☆ |
| Afkrydsningsfelt | `boolean` | |
| Dato | `date` | |
| Dato og klokkeslæt | `timestamptz` | et absolut tidspunkt, vist i læserens tidszone |
| Enkeltvalg | `text` + `CHECK` | farve, ikon eller billede pr. mulighed |
| Flervalg | `text[]` + `CHECK` | kan filtreres med array-operatorerne |
| E-mail | `text` + `CHECK` | en adresse, som databasen kontrollerer, og som åbnes med ét klik |
| Telefon, Stregkode | `text` | en kort tekst og dens format: opkaldslink, fast tegnbredde |
| URL | `text` + `CHECK` | udfyldes ved indtastning (`exemple.fr` → `https://exemple.fr`) |
| Person | `uuid` | et medlem af arbejdsområdet; at udpege personen [giver besked](/basedb/da/fonctionnalites/collaboration/) |
| Autonummer | `bigint` (identity) | nummererer også de eksisterende rækker; ingen indtaster det |
| Relation | `uuid` + `FOREIGN KEY` | en rigtig fremmednøgle til måltabellen |
| Multipel relation | `uuid[]` | flere linkede rækker, hvis integritet sikres af en trigger |
| Formel | genereret kolonne `STORED` | beregnet af PostgreSQL — eller ved læsning, se [Formler](#formler) |
| Opslag, Aggregering, Antal | ingen | beregnes ved læsning, på tværs af en relation |
| Knap | ingen | åbner en adresse eller starter en [automatisering](/basedb/da/fonctionnalites/automatisations/) |
| Fil, Billede | `jsonb` (metadata) | selve bytene lægges i [fillageret](/basedb/da/fonctionnalites/fichiers/) |

Hver tabel har også sine **systemkolonner**: `_id` (UUID v7), `_created_at`,
`_updated_at`, `_created_by`, `_updated_by` — vedligeholdt af en trigger og aldrig skrivbare
via API'et. Gitteret samler dem under **Systemoplysninger** i kolonnemenuen: de findes i hver
tabel, men er kun nyttige i få.

![Gitteret for en tabel med en beregnet varighed, et opslag og et antal](../../../../assets/screens/grille.png)

## Begrænsninger, som databasen håndhæver

Det, brugerfladen lover, garanterer PostgreSQL. Et enkeltvalg er en `CHECK`-begrænsning; en
relation en `FOREIGN KEY`; en URL eller en e-mailadresse et regulært udtryk. En skrivning i
direkte SQL, der bryder dem, afvises, præcis som i brugerfladen:

```text
Check constraints:
  "ck_opportunites__statut__enum" CHECK (statut = ANY (ARRAY['nouveau', 'qualifie', …]))
Foreign-key constraints:
  "fk_opportunites__clients_id" FOREIGN KEY (clients_id) REFERENCES b_t4z56fq_ventes.clients(_id)
```

## Visningsformater

Valuta, Procent, Varighed, Bedømmelse, Telefon og Stregkode vælges som typer, men de er
**formater**: kolonnen forbliver et tal eller en tekst, kun visningen ændres.

| Format | På | Vises og indtastes |
|---|---|---|
| Valuta | et tal | `12 500,00 €` — euro, dollar, pund, schweizerfranc, canadisk dollar, yen |
| Procent | et tal | `15 %` |
| Varighed | et antal sekunder | `1:30`, og indtastes `1h30`, `90 min` |
| Bedømmelse | et tal | fra 1 til 10 stjerner, sættes med ét klik |
| Telefon | en kort tekst | et opkaldslink |
| Stregkode | en kort tekst | med fast tegnbredde |

Et format kan ændres bagefter (**Visningsformat**, når du redigerer feltet) uden at røre de gemte
værdier. Det begrænser ikke værdien: en bedømmelse på 7 på en skala til 5 forbliver 7.

## Formler

En formel skrives på engelsk (de franske navne virker også), med felterne i firkantede parenteser og argumenterne adskilt af `,`:

```text
ROUND([Montant HT] * (1 + [Taux de TVA]), 2)
IF([Payée], FALSE, DAYS(TODAY(), [Échéance]) > 0)
DAYS([Fin], [Début])
```

Editoren foreslår felter, du kan indsætte, og et panel med funktionerne; en fejl nævner det
felt eller tegn, der er årsagen.

| Familie | Funktioner |
|---|---|
| Logik | `IF`, `IFBLANK`, `ISBLANK`, `AND`, `OR`, `NOT`, `TRUE`, `FALSE` |
| Tal | `ROUND`, `ABS`, `CEILING`, `FLOOR`, `MIN`, `MAX` |
| Tekst | `UPPER`, `LOWER`, `TRIM`, `LEFT`, `RIGHT`, `LEN`, `TEXT`, `VALUE` |
| Datoer | `YEAR`, `MONTH`, `DAY`, `WEEKDAY`, `DAYS`, `ADD_DAYS`, `DATE`, `TODAY`, `NOW` |
| Operatorer | `+ - * /`, `&` til at sætte tekst sammen, `= <> < <= > >=` |

En formel bliver en **genereret kolonne** i PostgreSQL: `psql` og dine værktøjer læser den som
alle andre. En formel, der afhænger af dagen (`TODAY()`, `NOW()`) eller citerer et
opslag eller en aggregering, **beregnes ved læsning**: den kan filtreres og sorteres i basedb,
men findes ikke i direkte SQL.

En formel citerer hverken en anden formel eller en relation direkte — det gør et opslag.
Udtræk eller erstatning af en del af en tekst kommer senere.

## Opslag, aggregeringer og antal

Tre felter læser **på tværs af en relation**, i den ene eller den anden retning — »projektets
kunde«, men også »opgaverne, der er linket via Projekt«:

- et **opslag** henter en værdi fra den linkede række eller listen af værdier: byen for et
  projekts kunde;
- en **aggregering** beregner på de linkede rækker: antal værdier, sum, gennemsnit, minimum,
  maksimum — en kundes omsætning, den gennemsnitlige bedømmelse i kundens anmeldelser;
- et **antal** tæller de linkede rækker: antallet af opgaver i et projekt.

De beregnes ved hver læsning, **med læserens tilladelser**: hvis den linkede tabel er lukket
for dig, er feltet det også. De kan filtreres og sorteres. De følger én enkelt relation, kan
ikke skrives, har ingen kolonne — og findes derfor ikke i direkte SQL — og indgår hverken i
import, formularer eller historikken.

## Relationerne

En **relation** forbinder en række med en række i en anden tabel i samme database. Gitteret
viser målrækkens **visningsværdi** — det felt, du udpeger som visningsfelt for dens tabel — og
filtrene går på tværs af relationen (`clients_id.ville eq "Lyon"`). De rækker, der peger på en
række, vises i dens rækkedetaljer.

Markér **Tillad flere rækker**, så bliver relationen **multipel**: en opgave afhænger af flere
opgaver, en artikel hører til flere kategorier. De linkede rækker vises som mærker, vælges via
en søgning og åbnes med ét klik fra rækkedetaljerne. Sletter du en målrække, fjernes den fra de
lister, der citerede den — eller sletningen afvises, hvis du har valgt det. Filtrene `has_any`,
`has_all` og `is_null` kan bruges og går også på tværs af relationen
(`taches_ids.titre contains "logo"`). En multipel relation kan endnu ikke sorteres, grupperes
eller importeres.

## Knap

Et **Knap**-felt har ingen værdi: det handler. Det **åbner en adresse** — `https://` eller
`mailto:`, som kan citere rækken (`mailto:{{E-mail}}`) — eller **starter en automatisering**,
der udløses af en knap i samme tabel. Det vises i cellen, på kortet og i rækkedetaljerne.

## Beskrivelser

En database, en tabel og et felt har en **beskrivelse**, som kan ændres uden migrering. Den
kopieres til den `COMMENT ON`, som `psql` læser, til den genererede dokumentation og til det,
en agent læser via `describe_table`.

## Formateret tekst og variabler

**Formateret tekst** er HTML-varianten af lang tekst, som vælges, når feltet oprettes
(»Formateret tekst (HTML)«): overskrifter, fed, kursiv, understreget, gennemstreget, lister,
citater, kode, links og skillelinjer i en visuel editor. HTML'en **renses ved skrivning**, uanset
om den kommer fra brugerfladen, API'et, MCP-serveren eller en import, og en `CHECK`-begrænsning
afviser desuden de farlige former, der skrives direkte i SQL (`<script>`, `on…`-attributter,
`javascript:`). Hverken billeder, tabeller eller farver: det, databasen ikke ville beholde,
tilbydes ikke.

En lang tekst — almindelig eller formateret — kan **citere en kolonne fra sin række**. Menuen
**Kolonne** i editoren indsætter citatet ved markøren: et mærke i formateret tekst, `{{Ville}}`
i Markdown.

> Levering planlagt den `{{Livraison}}` i `{{Ville}}`.

- Kolonnen gemmer citatet, som det er skrevet — `{{ville}}`, med dets fysiske navn: det er det,
  `psql` læser.
- Alle andre steder — gitteret, rækkedetaljerne, API'et, MCP-serveren, de delte visninger,
  automatiseringerne — læses teksten **med rækkens værdi**: »Levering planlagt den
  02/10/2026 i Lyon.« Ændrer du byen, ændres teksten.
- Et enkeltvalg læses med sin etiket, en person med sit navn, en dato i dit format; en værdi,
  der indsættes i formateret tekst, er aldrig markup.
- En kolonne, som læseren ikke må læse, giver ingenting: hverken dens værdi eller dens navn.

Formateret tekst kan ikke udfyldes af AI: en model skriver tekst, ikke renset HTML.

## Rediger strukturen

Databasens **Struktur**-skærm — i dens **⋯**-menu i sidepanelet — viser tabellerne og deres felter: tilføj, omdøb, gør påkrævet, omarranger,
beskriv, udpeg visningsfeltet.

![Struktur-skærmen for en database](../../../../assets/screens/structure.png)

Ændring af strukturen kræver niveauet **Administrere**. Uden det kan skærmen ses, men den
tilbyder intet: ingen knap, ingen blyant, intet håndtag — om et felt er påkrævet, og hvilket
felt der er visningsfelt, vises, men kan ikke ændres. Serveren afviser under alle
omstændigheder hver ændring; skærmen lader ikke længere, som om den accepterer den.

Tilføjelse, omdøbning og ændring af et felts type går gennem **migreringsmotoren**: en plan i
trin, korte låse og en navngivet afvisning, når en værdi ikke kan konverteres.

**Omdøbning** af en database, en tabel eller et felt sker i én enkelt dialog. Etiketten ændres
altid, uden migrering. En administrator ser nedenunder »Omdøb også i databasen:
`clients` → `comptes`«: når den er markeret, ændres også det fysiske navn, og
konsekvensanalysen vises — de forespørgsler, SQL-views og automatiseringer, der citerer det
gamle navn. Det gamle navn serveres fortsat af et **kompatibilitetsalias** — et view — mens du
opdaterer dine forespørgsler.

Sletning fjerner ikke noget med det samme: tabellen eller databasen flyttes til side
(`zz_supprime_…`) og kan stadig læses i SQL. En slettet database kan gendannes; at hente en
enkelt tabel tilbage fra brugerfladen er [på vej](/basedb/da/feuille-de-route/). Den endelige
**permanente sletning** er forbeholdt administrationen, tredive dage senere, og begynder med en
kontrolleret CSV-eksport.
