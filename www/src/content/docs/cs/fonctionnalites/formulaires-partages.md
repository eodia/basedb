---
title: Sdílené formuláře
description: Sdílení formuláře odkazem, veřejně nebo jen pro přihlášené členy.
---

Formulář, dotazník nebo kvíz se **sdílí odkazem** `/f/<jeton>`. Respondent nepotřebuje **žádná
oprávnění k tabulce**: každá odpověď přidá řádek a nic dalšího z tabulky se mu nezobrazí.
Chcete-li řádky ukazovat, a ne je přijímat, sdílí se zobrazení
[jen pro čtení](/basedb/cs/fonctionnalites/vues-partagees/).

![Dialog sdílení](../../../../assets/screens/cs/partage-formulaire.webp)

## Kdo může odpovídat

| Přístup | Kdo odpovídá | Co se zobrazí |
|---|---|---|
| **Veřejný** | kdokoli, kdo má odkaz, bez účtu | samotný formulář |
| **Přihlášení členové** | člen pracovního prostoru – případně jen z některých skupin | přihlášení, pak formulář a „Odpovídáte jako …“ |

Stránka odkazu je mimo aplikaci: žádný postranní panel, žádný název databáze, žádné jiné
řádky. Nese vzhled formuláře — jeho motiv, barvu, písmo —, a klade jen otázky, které
vyžadují dřívější odpovědi.

![Veřejný formulář](../../../../assets/screens/cs/formulaire-public.webp)

## Jménem koho se odpověď zapisuje

Řádek se zapisuje s **oprávněním osoby, která sdílení zveřejnila** – té, která ho naposledy
uložila. Její oprávnění vytvářet řádky se ověřuje **při každé odpovědi**, omezené na otázky
formuláře: pokud o ně přijde, formulář je pozastaven, dokud ho znovu neuloží někdo, kdo ho
má.

Historie uvádí, kdo odpověděl, nikoli kdo formulář zveřejnil:

- odpověď **člena** se připíše dané osobě;
- **veřejná** odpověď se připíše samotnému formuláři: „Formulář ‚Demande de devis‘ · veřejná
  odpověď · zveřejnila Camille“.

## Otevření a uzavření

Dialog nastavuje:

- přepínač **Odkaz aktivní**;
- **datum uzavření**;
- **maximální počet odpovědí** – přesný i při souběžných odpovědích;
- **Znovu vygenerovat odkaz**: starý okamžitě přestane fungovat;
- **Ukončit sdílení**: odkaz zmizí, odpovědi v tabulce zůstanou.

Uzavřený formulář to oznámí jedinou větou, ještě než požádá o přihlášení.

## Sdílený kvíz

Stránka kvízu nedostává **žádnou správnou odpověď**: jen to, kolik bodů je která otázka
hodna. Opravuje server.

- Při opravě **po každé otázce** posílá stránka serveru každou hodnocenou odpověď ve chvíli,
  kdy je zadána, a hned se dozví, zda je správná — a která odpověď správná byla.
- Při odeslání server spočítá skóre **z přijatých odpovědí** a zapíše je do pole, které je
  pro ně zvolené, pokud nějaké existuje a osoba, která sdílení zveřejnila, do něj smí
  zapisovat. Stránka zobrazí skóre, které jí server vrátí, a správné odpovědi, pokud kvíz
  neříká „nikdy“.

Skóre se tedy v tabulce čte tak, jak je spočítal server, ne tak, jak by je oznámila stránka.

## Omezení

- Otázky typu **vazba**, **soubor** a **obrázek** se přes sdílený odkaz nekladou; dialog na
  ně upozorní.
- Odesílání je omezeno na 20 odpovědí za minutu na adresu a odkaz. Za dodávanou proxy
  (Caddy) jde o adresu návštěvníka.

Podrobnosti najdete v [kapitole 15](https://github.com/eodia/basedb/blob/main/docs/architecture/15-formulaires-partages.md)
architektonického dokumentu.
