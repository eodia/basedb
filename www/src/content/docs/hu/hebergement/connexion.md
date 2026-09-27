---
title: Fiókok és bejelentkezés
description: Ki hozhat létre fiókot, és bejelentkezés Google-lel, Microsofttal vagy a vállalati SSO-val.
---

## Első bejelentkezés

Egy új példányon az első oldal hozza létre az **adminisztrátori fiókot**: a nevével, az
e-mail-címével és egy tetszőleges jelszóval. Hozza létre, mielőtt a példányt mások számára
elérhetővé tenné – egy domainen, vagy minden interfészen közzétett porttal.

## Fióklétrehozás

Alapértelmezés szerint bárki, aki eléri a példányt, **létrehozhatja a fiókját**, majd a saját
projektjeit. Semmi mást nem lát: mások projektjeihez **meghívással** jut hozzá.

Az **Adminisztráció → Felhasználók** menüpontban a „Fióklétrehozás” kártya:

- lezárja a fióklétrehozást: ekkor csak a meghívott személyek hozhatnak létre fiókot;
- vagy bizonyos domainekre korlátozza – az `exemple.fr, autre.fr` csak ezeket a címeket engedi.

## Meghívás egy projektbe vagy adatbázisba

Akinek **Kezelés** szintje van egy projekten vagy adatbázison, megoszthatja azt: a projekt (vagy
az adatbázis) menüje → **Megosztás…**, egy e-mail-cím, egy szint – Olvasás, Szerkesztés vagy
Kezelés. A basedb egy 7 napig érvényes **meghívási hivatkozást** készít, amelyet tetszése
szerint juttathat el a személyhez: a megnyitásával bejelentkezik, vagy létrehozza a fiókját.
Ugyanez a képernyő mutatja, kinek van hozzáférése, itt módosíthatja vagy vonhatja vissza a
szinteket, és itt maradnak a függőben lévő hivatkozások is, hogy újra elküldhesse őket.

Egy kezelő soha nem adhat többet annál, amit kezel: egy adatbázis kezelője az adatbázist
oszthatja meg, a projektjét nem.

## Bejelentkezés Google-lel, Microsofttal…

A basedb támogatja az **OpenID Connect** szabványt: Google, Microsoft Entra ID, GitLab,
Keycloak, Authentik, Okta… Minden megadott szolgáltató egy „Folytatás ezzel: …” gombot ad a
bejelentkezési, fióklétrehozási és meghívási képernyőkhöz.

1. Adja meg a basedb nyilvános címét a `.env` fájlban:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. A szolgáltatónál hozzon létre egy webalkalmazást; a **visszatérési címe**
   `https://basedb.example.com/auth/oidc/<nom>/callback`, ahol a `<nom>` az a név, amelyet
   alább ad neki (`google`, `microsoft`…).

3. Adja meg a `.env` fájlban:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: indításkor a basedb felsorolja az elfogadott szolgáltatókat, és
   megmondja, mi hiányzik azoknál, amelyeket kihagy.

| Változó a `<NOM>` szolgáltatóhoz | Szerep |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | a szolgáltatónál regisztrált alkalmazás |
| `BASEDB_OIDC_<NOM>_ISSUER` | a kibocsátó; a `google` és a `gitlab` esetén szükségtelen |
| `BASEDB_OIDC_<NOM>_LABEL` | a gombon szereplő név – alapértelmezés szerint `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | alapértelmezés szerint `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: csak a meglévő fiókokat engedi be |

Az **első bejelentkezés létrehozza a fiókot**, ahogyan a fióklétrehozási beállítás engedi: ha
nyitott, beengedi; ha domainekre korlátozott, csak azok címeit. Egy jelszavas fiókhoz már
tartozó címet a rendszer soha nem vesz át: a tulajdonosa a jelszavával jelentkezik be. A titkok
a környezetben maradnak: semmi nem kerül belőlük az adatbázisba.

:::note
A GitHub nem OpenID Connect-szolgáltató: itt nem használható.
:::
