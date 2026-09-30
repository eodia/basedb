---
title: Variabile de mediu
description: Toate variabilele citite de basedb și valoarea lor implicită.
---

Toate se pun în fișierul `.env`, lângă `docker-compose.yml`, pe care îl citește
`docker compose` (șablonul complet și comentat este `.env.example`). Cu `docker run`, transmiteți-le cu `-e`. **O valoare goală înseamnă „nedefinit”.**

## Obligatorii

| Variabilă | Rol |
|---|---|
| `POSTGRES_PASSWORD` | parola containerului PostgreSQL |
| `BASEDB_ENCRYPTION_KEY` | cheia instanței: semnează sesiunile, criptează secretele. `openssl rand -base64 32`, o singură dată |

## Baza de date

| Variabilă | Implicit | Rol |
|---|---|---|
| `POSTGRES_USER` | `basedb` | rolul PostgreSQL |
| `POSTGRES_DB` | `basedb` | baza de date PostgreSQL |
| `POSTGRES_PORT` | `5432` | port publicat pe 127.0.0.1 |
| `DATABASE_URL` | containerul `db` | o bază de date PostgreSQL 16+ proprie |

## Prima pornire

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_MIGRATE` | `1` | aplică catalogul pe o bază de date goală |
| `BASEDB_BOOTSTRAP` | `1` | pregătește primul administrator |
| `BASEDB_TENANT` | `t4z56fq` | referința spațiului de lucru, în URL-urile API-ului |
| `BASEDB_ADMIN_EMAIL` | — | adresa primului administrator, creat la pornire; goală, prima persoană care deschide interfața îl creează |
| `BASEDB_ADMIN_PASSWORD` | generată, afișată o singură dată | împreună cu `BASEDB_ADMIN_EMAIL`, parola acestuia; definită, este reaplicată administratorului la **fiecare** pornire: de eliminat după conectare |

## Conectare cu Google, Microsoft… (OIDC)

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_OIDC_PROVIDERS` | — | furnizorii propuși, separați prin virgule: `google,microsoft` |
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | — | aplicația înregistrată la furnizor |
| `BASEDB_OIDC_<NOM>_ISSUER` | cel al `google`, `gitlab` | emitentul OpenID Connect |
| `BASEDB_OIDC_<NOM>_LABEL`, `_SCOPES` | în funcție de furnizor | numele butonului, domeniile de acces cerute |
| `BASEDB_OIDC_<NOM>_SIGNUP` | — | `off`: o primă conectare nu creează cont |

Consultați [Conturi și conectare](/basedb/ro/hebergement/connexion/).

## Adrese

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_PORT` | `3000` | port publicat pe 127.0.0.1: interfața, `/api` și `/mcp` |
| `BASEDB_VERSION` | `latest` | eticheta imaginii `eodia/basedb` |
| `BASEDB_PUBLIC_URL` | — | adresa publică a basedb, pentru redirecționarea OIDC |
| `BASEDB_DOMAIN` | — | domeniul servit prin HTTPS de proxy-ul Caddy |
| `BASEDB_ORIGINS` | — | alte site-uri ale căror pagini apelează API-ul din browser, separate prin virgule; inutil pentru interfața basedb, servită la aceeași adresă |
| `BASEDB_API`, `BASEDB_MCP` | `/`, `/mcp` | API-ul și MCP-ul văzute din browser; de setat doar pentru mediul de dezvoltare (`pnpm start`) |

## Fișiere

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_FILES_MAX_MB` | `25` | dimensiunea maximă a unui fișier |
| `BASEDB_S3_BUCKET` | — | activează stocarea S3 |
| `BASEDB_S3_ENDPOINT` | — | punctul de acces S3 |
| `BASEDB_S3_REGION` | `us-east-1` | regiunea |
| `BASEDB_S3_ACCESS_KEY_ID`, `BASEDB_S3_SECRET_ACCESS_KEY` | — | datele de autentificare |
| `BASEDB_S3_FORCE_PATH_STYLE` | `1` | `0` pentru adresarea după gazdă |

## E-mailuri

Fără server de trimitere, basedb nu trimite niciun e-mail. Cu el sunt trimise notificările
rămase zece minute necitite (fiecare alege care în **Setări › Notificări**), e-mailurile
pasului **Trimiteți un e-mail** al automatizărilor, și link-ul unei **parole uitate**.
Link-urile trimit către `BASEDB_PUBLIC_URL`; fără ea, un e-mail nu are niciunul.

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_SMTP_HOST` | — | serverul SMTP: cel al mesageriei dumneavoastră sau al unui serviciu de trimitere |
| `BASEDB_SMTP_PORT` | `587` | `465` pentru o conexiune criptată de la început |
| `BASEDB_SMTP_SECURE` | `starttls` (`tls` pe portul 465) | `none` doar pentru un releu pe același calculator: altfel parola ar trece necriptată |
| `BASEDB_SMTP_USER`, `BASEDB_SMTP_PASSWORD` | — | identificatorul contului de trimitere, dacă cere unul |
| `BASEDB_MAIL_FROM` | — | obligatorie cu `BASEDB_SMTP_HOST`: expeditorul, `basedb <no-reply@exemple.fr>` |

La pornire, jurnalul spune cum stau lucrurile: `Courriels : SMTP smtp.exemple.fr:587 (starttls),
expéditeur no-reply@exemple.fr.` Un e-mail refuzat de server este retrimis 1, 5, 30, 120, apoi
360 de minute mai târziu.

## Hărți și adrese

Vizualizarea **Hartă** plasează o adresă cu ajutorul unui serviciu de geocodare: cel al
OpenStreetMap (Nominatim) în mod implicit, interogat o dată pentru fiecare adresă, cel mult o
cerere pe secundă, fiecare răspuns fiind reținut. Fondul de hartă este format din **tile-uri**
pe care browserul fiecărui cititor le încarcă direct.

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_GEOCODER_URL` | `https://nominatim.openstreetmap.org` | un alt serviciu care vorbește același protocol (propriul dumneavoastră Nominatim); `off`: niciunul, adresele nu ies din instanță, iar numai latitudinea și longitudinea plasează rândurile |
| `BASEDB_MAP_TILES` | tile-urile OpenStreetMap | un alt server de tile-uri, model `https://…/{z}/{x}/{y}.png` |
| `BASEDB_MAP_ATTRIBUTION` | `© OpenStreetMap` | mențiunea cerută de acest server, în dreapta jos a hărții |

La pornire, jurnalul spune ce serviciu este folosit: `Géocodage : https://nominatim.openstreetmap.org.`

## Documente PDF

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_PDF_FONTS` | fonturile Noto ale imaginii | un dosar propriu, montat în container, care conține `NotoSans-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`, și pentru chineză, japoneză și coreeană `NotoSansCJK-Regular.ttc` și `-Bold.ttc` |

## Șabloane pentru baze

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_TEMPLATES_URL` | catalogul site-ului public | de unde citește instanța șabloanele din galeria ei; `off` pentru a nu citi niciunul (șabloanele integrate rămân) — consultați [Șabloane](/basedb/ro/fonctionnalites/modeles/) |

## Inteligență artificială

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_AI_PROVIDER` | — | `openai`, `anthropic` sau `mistral` |
| `BASEDB_AI_MODEL` | — | modelul |
| `BASEDB_AI_API_KEY` | — | cheia (altfel `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`) |
| `BASEDB_AI_QUOTA` | `120` | apeluri interactive pe oră și pe spațiu de lucru |
| `BASEDB_AI_FIELD_QUOTA` | `300` | calcule de câmpuri AI pe oră și pe spațiu de lucru |
| `BASEDB_AI_WORKER` | `1` | `0`: fără calcul în fundal în acest proces |

## Demo publică

O instanță deschisă tuturor, precum [demo.basedb.eodia.com](https://demo.basedb.eodia.com):
ecranul de conectare precompletează un cont partajat, vizitatorul citește tot și modifică ce
există, dar nu creează și nu șterge nimic — bază, tabel, rând, fișier, comentariu, cont, token,
link —, iar AI-ul răspunde că nu face parte din demo. Consola SQL doar citește acolo. Repunerea
bazei în starea inițială în fiecare noapte rămâne în sarcina dumneavoastră.

| Variabilă | Implicit | Rol |
|---|---|---|
| `BASEDB_DEMO` | — | `1`: instanța devine o demo publică |
| `BASEDB_DEMO_ACCOUNTS` | — | un cont pe limbă, separate prin virgule: `fr=demo@demo.com,en=demo-en@demo.com`; ecranul de conectare precompletează contul limbii lui, altfel engleza, altfel primul, și le propune pe celelalte. Creați aceste conturi, fiecare cu proiectul lui, înainte de a activa demo: aceasta refuză creările tuturor, administratorul inclusiv |
| `BASEDB_DEMO_PASSWORD` | — | împreună cu `BASEDB_DEMO_ACCOUNTS`, parola lor, aceeași pentru toate, publicată împreună cu ele |

Fără `BASEDB_DEMO_ACCOUNTS`, contul partajat este administratorul numit de `BASEDB_ADMIN_EMAIL`
și `BASEDB_ADMIN_PASSWORD`. O adresă a demo se conectează cu parola publicată, indiferent ce se
tastează: încercările greșite nu o blochează pentru toată lumea.

## Doar pentru dezvoltare

| Variabilă | Rol |
|---|---|
| `BASEDB_DEV_MAIL=1` | afișează e-mailurile în jurnale în loc să le trimită |
| `BASEDB_WEBHOOK_DEV=1` | permite webhook-uri către HTTP și către adrese locale |
