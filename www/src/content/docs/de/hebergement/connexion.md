---
title: Konten und Anmeldung
description: Wer ein Konto anlegen darf und wie man sich mit Google, Microsoft oder dem SSO des Unternehmens anmeldet.
---

## Erste Anmeldung

Auf einer neuen Instanz legt die erste Seite das **Administratorkonto** an: Ihr Name, Ihre Adresse,
ein Passwort Ihrer Wahl. Legen Sie es an, bevor die Instanz für andere erreichbar wird – über eine
Domain oder über einen Port, der auf allen Schnittstellen veröffentlicht ist.

## Kontoerstellung

Standardmäßig kann jede Person, die die Instanz erreicht, **ihr Konto anlegen** und dann eigene
Projekte. Sie sieht sonst nichts: Die Projekte anderer erreichen sie per **Einladung**.

Unter **Administration → Benutzer** kann die Karte „Kontoerstellung“:

- die Kontoerstellung schließen: Dann können nur eingeladene Personen ein Konto anlegen;
- oder sie auf Domains beschränken – `exemple.fr, autre.fr` lässt nur diese Adressen zu.

## In ein Projekt oder eine Datenbank einladen

Wer die Stufe **Verwalten** auf einem Projekt oder einer Datenbank hat, gibt es frei: Menü des
Projekts (oder der Datenbank) → **Freigeben …**, eine Adresse, eine Stufe – Lesen, Bearbeiten oder
Verwalten. basedb erzeugt einen **Einladungslink**, 7 Tage gültig, den Sie der Person auf beliebigem
Weg schicken: Beim Öffnen meldet sie sich an oder legt ihr Konto an. Derselbe Bildschirm zeigt, wer
Zugriff hat, ändert oder entzieht eine Stufe und bewahrt die ausstehenden Links auf, um sie erneut
zu senden.

Wer verwaltet, gibt nie mehr weiter, als er verwaltet: Wer eine Datenbank verwaltet, gibt diese
frei, nicht ihr Projekt.

## Anmeldung mit Google, Microsoft …

basedb spricht **OpenID Connect**: Google, Microsoft Entra ID, GitLab, Keycloak, Authentik, Okta …
Jeder eingerichtete Anbieter fügt den Bildschirmen für Anmeldung, Kontoerstellung und Einladung
eine Schaltfläche „Weiter mit …“ hinzu.

1. Legen Sie die öffentliche Adresse von basedb in `.env` fest:

   ```bash
   BASEDB_PUBLIC_URL=https://basedb.example.com
   ```

2. Legen Sie beim Anbieter eine Webanwendung an; ihre **Rückleitungsadresse** ist
   `https://basedb.example.com/auth/oidc/<nom>/callback`, wobei `<nom>` der Name ist, den Sie ihr
   unten geben (`google`, `microsoft` …).

3. Richten Sie ihn in `.env` ein:

   ```bash
   BASEDB_OIDC_PROVIDERS=google,microsoft

   BASEDB_OIDC_GOOGLE_CLIENT_ID=…
   BASEDB_OIDC_GOOGLE_CLIENT_SECRET=…

   BASEDB_OIDC_MICROSOFT_ISSUER=https://login.microsoftonline.com/<id-organisation>/v2.0
   BASEDB_OIDC_MICROSOFT_CLIENT_ID=…
   BASEDB_OIDC_MICROSOFT_CLIENT_SECRET=…
   ```

4. `docker compose up -d`: Beim Start listet basedb die übernommenen Anbieter auf und sagt, was
   denen fehlt, die es auslässt.

| Variable, für den Anbieter `<NOM>` | Rolle |
|---|---|
| `BASEDB_OIDC_<NOM>_CLIENT_ID`, `_CLIENT_SECRET` | die beim Anbieter registrierte Anwendung |
| `BASEDB_OIDC_<NOM>_ISSUER` | der Aussteller; für `google` und `gitlab` nicht nötig |
| `BASEDB_OIDC_<NOM>_LABEL` | die Beschriftung der Schaltfläche – standardmäßig `Google`, `Microsoft` |
| `BASEDB_OIDC_<NOM>_SCOPES` | standardmäßig `openid email profile` |
| `BASEDB_OIDC_<NOM>_SIGNUP` | `off`: lässt nur bestehende Konten zu |

Eine **erste Anmeldung legt das Konto an**, soweit die Kontoerstellung es erlaubt: Ist sie offen,
wird es zugelassen; ist sie auf Domains beschränkt, nur deren Adressen. Eine Adresse, die bereits zu
einem Konto mit Passwort gehört, wird nie übernommen: Ihre Inhaberin meldet sich mit ihrem Passwort
an. Die Geheimnisse bleiben in der Umgebung: Nichts davon wird in die Datenbank geschrieben.

:::note
GitHub ist kein OpenID-Connect-Anbieter: Es lässt sich hier nicht verwenden.
:::
