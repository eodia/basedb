---
title: Konta i logowanie
description: Kto może utworzyć konto i jak logować się przez Google, Microsoft lub firmowe SSO.
---

## Pierwsze logowanie

Na nowej instancji pierwsza strona tworzy **konto administratora**: twoje imię i nazwisko,
adres e-mail, wybrane hasło. Utwórz je, zanim udostępnisz instancję innym – w domenie albo z
portem opublikowanym na wszystkich interfejsach sieciowych.

## Tworzenie kont

Domyślnie każda osoba, która dotrze do instancji, może **utworzyć konto**, a potem własne
projekty. Nie widzi niczego więcej: projekty innych trafiają do niej przez **zaproszenie**.

W **Administracja → Użytkownicy** karta „Tworzenie kont”:

- wyłącza tworzenie kont: mogą je wtedy utworzyć tylko osoby zaproszone;
- albo ogranicza je do domen – `exemple.fr, autre.fr` dopuszcza tylko adresy z tych domen.

## Zapraszanie do projektu lub bazy

Osoba z poziomem **Zarządzanie** na projekcie lub bazie może go udostępnić: menu projektu (lub
bazy) → **Udostępnij…**, adres e-mail, poziom – Odczyt, Edycja lub Zarządzanie. basedb tworzy
**link z zaproszeniem**, ważny 7 dni, który wysyłasz tej osobie w dowolny sposób: otwierając
go, loguje się lub tworzy konto. Ten sam ekran pokazuje, kto ma dostęp, zmienia lub odbiera
poziom i przechowuje oczekujące linki, aby można je było wysłać ponownie.

Osoba zarządzająca nigdy nie daje więcej, niż sama zarządza: osoba zarządzająca bazą może
udostępnić bazę, ale nie jej projekt.

## Logowanie przez Google, Microsoft…

basedb obsługuje **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik,
Okta… Każdy skonfigurowany dostawca dodaje przycisk „Kontynuuj przez …” na ekranach logowania,
tworzenia konta i zaproszenia.

1. Ustaw publiczny adres basedb w `.env`:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. U dostawcy utwórz aplikację webową; jej **adres zwrotny** to
   `https://basedb.example.com/auth/oidc/<nom>/callback`, gdzie `<nom>` to nazwa, którą nadasz
   jej poniżej (`google`, `microsoft`…).

3. Zadeklaruj go w `.env`:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: przy starcie basedb wypisuje przyjętych dostawców i mówi, czego
   brakuje tym, których pominął.

| Zmienna dla dostawcy `<NOM>` | Rola |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | aplikacja zarejestrowana u dostawcy |
| `BASEDB_OIDC_<NOM>_ISSUER` | wystawca; zbędny dla `google` i `gitlab` |
| `BASEDB_OIDC_<NOM>_LABEL` | nazwa na przycisku – domyślnie `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | domyślnie `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: dopuszcza tylko istniejące konta |

**Pierwsze logowanie tworzy konto** w takim zakresie, na jaki pozwala ustawienie tworzenia
kont: gdy jest otwarte – dopuszcza je; gdy jest ograniczone do domen – tylko adresy z tych
domen. Adres, który ma już konto z hasłem, nigdy nie zostaje przejęty: jego właściciel loguje
się swoim hasłem. Sekrety pozostają w środowisku: nic z nich nie jest zapisywane w bazie.

:::note
GitHub nie jest dostawcą OpenID Connect: nie można go tu użyć.
:::
