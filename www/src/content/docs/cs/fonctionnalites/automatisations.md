---
title: Automatizace
description: Když se řádek změní, vstoupí do filtru nebo zmizí, když nastane datum, v pevný čas, kliknutím nebo voláním – upravit, vytvořit, vyhledat, počítat, opakovat, větvit, čekat, zkusit, zeptat se AI, vytvořit PDF, upozornit, odeslat e-mail, zavolat službu.
---

Automatizace říká **kdy**, **jestli** a **pak**: když úkol přejde do stavu „Fait“, zaznamenat
čas; když přijde negativní recenze, upozornit odpovědnou osobu a napsat do Slacku; každé
pondělí v 9:00 vytvořit řádek týmové porady. A když jedna akce nestačí, sleduje **tok**:
vyhledat řádek, vydat se jednou či druhou větví podle toho, co obsahuje, opakovat kroky na
každém řádku, který odpovídá filtru, znovu použít v kroku to, co předchozí krok našel nebo
zapsal, **čekat** tři dny před upomínkou, odeslat **PDF** v příloze.

Otevírají se přes **Automatizace** v bloku otevřené databáze dole v postranním panelu
a vyžadují úroveň **Správa**.

![Tok a jedno z jeho spuštění, zobrazené přímo na něm](../../../../assets/screens/cs/automatisations.webp)

## Tok

Tok se kreslí shora dolů: spouštěč, pak jednotlivé kroky. **+** na spojnici otevře seznam
kroků, rozdělený do kategorií — Řádky, Komunikace, Dokumenty, AI, Logika — s vyhledáváním,
a přidá zvolený krok na dané místo; karta otevře své nastavení vpravo. Jednoduchá automatizace
– spouštěč a akce – se vejde do dvou karet a nastavuje se jako dříve.

## Kdy

| Spouštěč | Nastavení |
|---|---|
| **Řádek je vytvořen** | tabulka |
| **Řádek je upraven** | tabulka a případně jen pole, která se mají sledovat |
| **V pevný čas** | každou hodinu, každý den nebo každý týden, ve zvolenou hodinu a ve zvoleném časovém pásmu |
| **Kliknutí na tlačítko** | [pole Tlačítko](/basedb/cs/fonctionnalites/tables-et-champs/#tlačítko) tabulky |
| **Řádek je odstraněn** | tabulka; kroky citují řádek tak, jak vypadal |
| **Řádek vstoupí do filtru** | tabulka a filtr: automatizace se spustí, jakmile do něj řádek vstoupí, a znovu až poté, co z něj vystoupí – „faktura se opozdí“, ne „opožděná faktura je upravena“ |
| **Nastává datum** | pole Datum tabulky, posun – tři dny před, v tentýž den, týden po – a hodina: upomínky splatnosti, výročí smlouvy |
| **Přijat webhook** | nic: automatizace získá svou vlastní adresu, kterou zavolá jiný program ([podrobnosti](#služba-která-volá-basedb)) |

Spouštěč nad řádky vidí **všechny** zápisy: rozhraní, API, agenta, sdílený formulář, a dokonce
i přímé SQL – automatizace vycházejí z historie, která je zachytí všechny.

## Jen pokud

Volitelná podmínka v [jazyce filtrů](/basedb/cs/integrations/api-rest/#čtení) –
`statut eq "fait"`, `montant gte 10000 and payee eq false` – vyhodnocená nad řádkem **v okamžiku
akce**. Spuštění, jehož podmínka není splněna, je „přeskočeno“ a uvede to.

## Pak

Až čtyřicet kroků, v daném pořadí; první, který selže, zastaví ty následující – kromě kroků
v bloku **Zkusit** ([podrobnosti](#zkusit)).

| Krok | Co dělá |
|---|---|
| **Upravit řádek** | zapíše hodnoty do řádku, který automatizaci spustil – nebo do řádku, který nějaký krok našel či vytvořil |
| **Vytvořit řádek** | v této tabulce nebo v jiné tabulce databáze |
| **Vyhledat řádek** | první řádek tabulky, který odpovídá filtru, aby ho následující kroky mohly citovat nebo upravit |
| **Upozornit někoho** | [oznámení](/basedb/cs/fonctionnalites/collaboration/#oznámení) vybraným osobám nebo osobě z pole Osoba |
| **Odeslat e-mail** | osobám z týmu, osobě z pole Osoba, na adresu z pole E-mail — klientovi, dodavateli — nebo na napsané adresy; předmět a text citují řádek a předchozí kroky |
| **Zavolat webhook** | HTTPS požadavek na službu – metoda, adresa, hlavičky a tělo podle vaší volby ([podrobnosti](#zavolat-službu)); jeho odpověď lze pak citovat |
| **Odeslat do Slacku** | zprávu do [připojeného](/basedb/cs/integrations/synchronisation/#slack) kanálu |
| **Zeptat se AI** | odpověď [poskytovatele AI](/basedb/cs/fonctionnalites/ia/) na pokyn, který cituje řádek a předchozí kroky – napsat, shrnout, zařadit –, čtenou jako text, číslo, ano či ne, datum nebo volbu ze seznamu |
| **Podmínka** | několik větví: použije se první, jejíž podmínka je splněna, a „Jinak“, když není splněna žádná; větve se pak opět spojí |
| **Pro každý řádek** | kroky, které obsahuje, jednou pro každý řádek tabulky, který odpovídá filtru ([podrobnosti](#pro-každý-řádek)) |
| **Odstranit řádek** | řádek, který automatizaci spustil, nebo ten, který najde některý krok – přesune se do koše |
| **Počítat a sčítat** | počet řádků filtru, jejich součet, průměr, minimum nebo maximum, k citaci nebo otestování dále |
| **Vygenerovat PDF** | [dokument](/basedb/cs/fonctionnalites/documents/) řádku, uložený do pole Soubor nebo přiložený k e-mailu |
| **Čekat** | dobu, nebo do data pole ([podrobnosti](#čekat)) |
| **Zkusit** | kroky, a další, které se provedou, pokud některý z nich selže ([podrobnosti](#zkusit)) |
| **Spustit automatizaci** | jinou automatizaci databáze, na řádku její tabulky |

Vyhledání, které nic nenajde, tok nezastaví: kroky, které měly upravit nalezený řádek, se
přeskočí. Pro jiný postup v tomto případě **Pokud není nalezen žádný řádek…**, pod vyhledáním,
přidá podmínku, která to testuje.

**Podmínka** testuje řádek filtrem, nebo **hodnotu**: odpověď AI, kód webhooku, celkový
součet – „`{{e2.reponse}}` se rovná Urgent“, „`{{e3.somme.montant}}` je větší nebo rovno 1000“.
Čísla se porovnávají jako čísla, texty bez diakritiky a velkých písmen.

## Pro každý řádek

Krok **Pro každý řádek** čte řádky tabulky, které odpovídají jeho filtru – prázdný: všechny –,
ve zvoleném pořadí, až do svého limitu (50 ve výchozím nastavení, nejvýše 200), a pak jednou
pro každý z nich provede kroky umístěné ve svém rámečku. „Každé pondělí upomenout neuhrazené
faktury“ se zapíše takto: **V pevný čas**, pak **Pro každý řádek** faktur
`payee eq false and relancee eq false`, a ve smyčce e-mail kontaktu faktury a krok **Upravit
řádek**, který zaškrtne „Relancée“.

Ve smyčce pojmenovává identifikátor kroku **řádek aktuálního průchodu**: `{{e1.client}}` ho
cituje, a **Upravit řádek** ho nabízí mezi řádky k úpravě. Po smyčce `{{e1.nombre}}` udává,
kolik řádků prošla – například pro souhrn na Slacku. Filtr může citovat to, co mu předchází:
spuštěná zaplacenou fakturou, `facture eq {{_id}}` prochází jejími řádky podrobností.

Nad rámec limitu čekají zbývající řádky na příští spuštění, které to oznámí: řádky, které jsou
už zpracované, vyřaďte z filtru – zaškrtávací políčko „relancée“, datum –, aby se postupně
zpracovaly všechny při dalších spuštěních. Smyčka neobsahuje jinou smyčku a spuštění se
zastaví po dvou minutách.

## Čekat

Krok **Čekat** uvede spuštění do pauzy — tři hodiny, dva dny — nebo do data pole řádku, s
posunem a hodinou: „den před splatností, v 9:00“. Spuštění se zobrazí jako **Pozastaveno**
v záložce **Spuštění**, s datem svého pokračování.

Pokračuje dalším krokem tak, že **znovu přečte** své řádky: „tři dny po odeslání nabídky,
pokud stále není přijata, upomenout“ se zapíše jako **Čekat** 3 dny, pak podmínka na stav
nabídky tak, jak je ten den. Deaktivace automatizace zastaví pozastavená spuštění; čekání se
neumísťuje ani do smyčky, ani do bloku **Zkusit**, a trvá nejvýše rok.

## Zkusit

Blok **Zkusit** má dvě větve. První se provede; pokud některý z jejích kroků selže, tok
pokračuje druhou, **V případě selhání**, která cituje selhání — `{{e4.erreur}}`, kód,
a `{{e4.etape}}`, krok —, a pak pokračuje za blokem. To umožní někoho upozornit, když služba
neodpovídá, bez zastavení všeho.

Jednodušeji: webhook se může sám **zkusit znovu** až třikrát po výpadku služby, a smyčka může
**pokračovat** i přes řádek, který selhal.

## PDF a e-mail

**Vygenerovat PDF** vytvoří dokument řádku — se [šablonou
dokumentu](/basedb/cs/fonctionnalites/documents/) jeho tabulky, nebo listem všech jeho polí —
a může ho uložit do pole Soubor. **Odeslat e-mail** ho pak může přiložit, se soubory z pole
Soubor nebo Obrázek:

- e-mail **pro každého**, nebo **jeden pro všechny**, s příjemci **v kopii**;
- zpráva ve **formátovaném textu** — tučně, seznamy, odkazy — která cituje řádek;
- adresa pro **odpověď**: vaše ve výchozím nastavení, nebo z pole E-mail;
- nejvýše 50 příjemců, 10 příloh a 15 MB.

„Když nabídka přejde na Přijato, odeslat fakturu klientovi, účetní v kopii“:
**Řádek vstoupí do filtru** `statut eq "accepte"`, **Vygenerovat PDF** se šablonou Faktura,
**Odeslat e-mail** na pole E-mail klienta, s přiloženou fakturou.

## Služba, která volá basedb

Se spouštěčem **Přijat webhook** má automatizace svou vlastní tajnou adresu, kterou dáte
programu, který ji má spustit — internetovému obchodu, externímu formuláři, nástroji pro
automatizaci:

```bash
curl -X POST "https://basedb.example.com/api/v1/hooks/<secret>" \
  -H "content-type: application/json" \
  -d '{"client": {"nom": "Dupont"}, "total": 120}'
```

Kroky citují to, co odeslal: `{{trigger.client.nom}}`, `{{trigger.total}}`; formulář se čte
stejně, text přes `{{trigger.texte}}`. Adresa se kopíruje z nastavení spouštěče; **Změnit
adresu** ji nahradí, a stará okamžitě přestane platit. Volání obdrží `202`, automatizace se
spustí během vteřiny.

## Zavolat službu

Krok **Zavolat webhook** ve výchozím nastavení odešle metodou `POST` data automatizace:
vybraný řádek a to, co našly nebo zapsaly předchozí kroky. Aby bylo možné mluvit se službou
tak, jak to očekává, nastavuje se:

- **metoda**: `POST`, `PUT`, `PATCH`, `GET` nebo `DELETE` – tyto poslední dvě bez těla;
- **adresa**, která může za svým hostitelem citovat – `https://api.exemple.fr/clients/{{e2.numero}}`;
  každá hodnota je v ní zakódována;
- **hlavičky**, jejichž hodnota může citovat: `Idempotency-Key: {{_id}}`;
- **tělo**: data automatizace, **JSON k sestavení**, **formulář** (dvojice `klíč=hodnota` na
  řádek) nebo **text**. V JSON je citace v uvozovkách textem, mimo uvozovky hodnotou – číslo,
  ano nebo ne, seznam:

```json
{ "facture": "{{e1.numero}}", "montant": {{e1.montant}}, "payee": {{e1.payee}} }
```

Klíč API nebo token se vkládá do **tajné** hlavičky (zámek): zašifrovaný klíčem instance se už
nikdy nezobrazí – ani na obrazovce, ani přes API, ani Copilotovi – a odchází jen k hostiteli,
pro kterého jste ho zadali. Změna hostitele adresy vyžaduje ho zadat znovu; **Nahradit** zapíše
nový.

## Zeptat se AI

Stejně jako [pole AI](/basedb/cs/fonctionnalites/ia/#možnost-ai-u-pole) odešle krok
poskytovateli svůj pokyn, v němž je každá citace nahrazena svou hodnotou:

```text
Vyžaduje tato recenze od {{auteur}} nějakou akci z naší strany? {{avis}}
```

Zvolíte **očekávanou odpověď** – volný nebo krátký text, číslo, ano či ne, datum, webovou
adresu nebo volbu ze seznamu, který lze převzít z pole výběru. Model je o tom informován
a odpověď, která ji neobsahuje, způsobí selhání kroku. Následující kroky ji citují pomocí
`{{e1.reponse}}`: v názvu vytvořeného úkolu, ve zprávě nebo v poli výběru, kde se přiřadí
k volbě se stejným popiskem.

To, co pokyn cituje, odchází k poskytovateli: krok vyžaduje váš **souhlas**, který je třeba
udělit znovu, když se pokyn změní. Každé volání se zaznamenává a spolu s poli AI se
započítává do `BASEDB_AI_FIELD_QUOTA` (ve výchozím nastavení 300 za hodinu). AI sama nic
nedělá: zapisují nebo upozorňují až kroky umístěné za ní.

## Citace

Hodnoty, zprávy a filtry citují to, co jim předchází, pomocí tlačítka **{ }** vedle každého
textu:

- `{{Titre}}`, `{{_id}}`: řádek, který automatizaci spustil;
- `{{e2.titre}}`, `{{e2._id}}`: řádek nalezený, vytvořený nebo upravený krokem `e2` – každý
  krok má svůj identifikátor na své kartě;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: co odpověděl webhook `e3`;
- `{{e4.reponse}}`: odpověď kroku AI `e4`;
- `{{e5.client}}` ve smyčce `e5`, řádek aktuálního průchodu; `{{e5.nombre}}` po ní, počet
  řádků, kterými prošla;
- `{{e6.nombre}}`, `{{e6.somme.montant}}`, `{{e6.moyenne.montant}}`, `{{e6.max.echeance}}`: co
  napočítal krok `e6`;
- `{{e7.erreur}}`, `{{e7.etape}}`: selhání, které zachytil blok **Zkusit** `e7`;
- `{{e8.nom}}`: název PDF kroku `e8`;
- `{{trigger.client.nom}}`: co odeslal příchozí webhook;
- `{{_maintenant}}`: okamžik spuštění.

Hodnota tvořená jedinou citací předá samotnou hodnotu: vazbu, osobu, volbu – tak se
vytvořený řádek propojí s řádkem, který našlo vyhledání. Ve filtru je citace vždy
porovnávanou hodnotou, nikdy součástí jazyka filtrů.

Krok může citovat jen to, co před ním s jistotou proběhlo: co našla některá větev, už za
podmínkou citovat nelze. Editor na to upozorní na kartě ještě před uložením.

## Copilot

**Copilot** v záhlaví otevře vpravo konverzaci v přirozeném jazyce o automatizacích
databáze: „když úkol přejde do revize, upozorni přiřazenou osobu“, „přidej do poznámek
shrnutí od AI“, „proč poslední spuštění selhalo?“. Odpoví a **navrhne** celou automatizaci –
tu, kterou máte na obrazovce, upravenou, nebo novou –, se seznamem změn.

Copilot nic neukládá: **Umístit do toku** zobrazí návrh v editoru, kde si ho před uložením
zkontrolujete – a **Zrušit** na kartě vrátí tok do původního stavu. Nová automatizace se
otevře v editoru, připravená k vytvoření. Každý návrh se ověřuje stejně jako uložení; co
neobstojí, je vyřazeno a oznámeno.

Ve výchozím nastavení odchází k poskytovateli AI spolu s konverzací **jen struktura**:
tabulky a jejich pole, automatizace databáze, ta na obrazovce tak, jak ji ukazuje editor,
a její poslední spuštění – jejich stavy a chybové kódy, nikdy žádná hodnota. Osoby a kanály
Slacku odcházejí pod zástupnými značkami (`p1`, `s1`), nikdy pod svým identifikátorem.
Zaškrtávací políčko **Povolit čtení dat** umožní Copilotovi v rámci konverzace číst řádky
(nejvýše 50 při jednom čtení); každé čtení je uvedeno pod jeho odpovědí.

## Testování a sledování

**Otestovat na řádku** spustí uloženou automatizaci na vybraném řádku, a to doopravdy. Záložka
**Spuštění** uchovává posledních 50 po dobu 30 dnů: čekající, probíhající, úspěšná,
přeskočená s důvodem, neúspěšná s kódem. Výběrem jednoho ho zobrazíte na toku – použitá větev
je vyznačena, každý provedený krok uvádí, co udělal a jak dlouho to trvalo, zbytek je
ztlumený. Ve smyčce každý krok navíc uvádí, kolikrát proběhl.

## Jménem koho jedná

Automatizace jedná s **oprávněními osoby, která ji naposledy uložila**, znovu posuzovanými
při každém spuštění: pokud tato osoba o nějaké oprávnění přijde, krok, který ho potřeboval,
selže, místo aby ho obešel, a vyhledání najde jen to, co tato osoba smí číst. Historie to
zobrazuje jako „Automatizace ‚Tâche terminée‘ · jménem …“ a její zápisy lze vracet stejně
jako ostatní.

## Omezení

- Co automatizace zapíše, nespustí žádnou jinou: co má následovat po sobě, patří do jediného
  toku, nebo přes **Spustit automatizaci**, nejvýše tři úrovně.
- Vyhledání vrátí jeden řádek, ten první; smyčka jich za jedno spuštění projde nejvýše 200.
  Spuštění trvá nejvýše dvě minuty, bez započítání čekání.
- Žádný skript. E-mail odchází přes [odesílací server](/basedb/cs/hebergement/variables/#e-maily)
  instance.
- [Šablona databáze](/basedb/cs/fonctionnalites/modeles/) přenáší jen automatizace bez
  vyhledání, smyčky, podmínky a kroku AI, a nikdy webhook.
- Webhook nesleduje přesměrování a čeká nejvýše 10 sekund; odpověď jiná než 2xx způsobí selhání
  kroku, po jeho opakovaných pokusech.
- Nastalé datum se hledá každou minutu; započítávají se jen ta, která nastala po uložení
  automatizace.
- 100 spuštění za hodinu na automatizaci; zmeškaný hodinový termín se dožene jen jednou.
- Prodleva mezi zápisem a akcí je v řádu sekund.
