---
title: Zasady
description: Decyzje, które kształtują architekturę basedb.
---

basedb zaprojektowano na podstawie **dokumentu architektury** – szesnaście rozdziałów, w
repozytorium, w [`docs/architecture`](https://github.com/eodia/basedb/tree/main/docs/architecture).
Jego rozdział 00 ustala dwadzieścia pięć decyzji; oto ich duch.

## Dane są tabelami, a nie formatem

Baza użytkownika jest **schematem** PostgreSQL, tabela jest tabelą, pole jest typowaną kolumną
**nazwaną czytelnie**. Bez EAV (encja-atrybut-wartość), bez dokumentu JSON na wszystko, bez
nieprzejrzystych nazw. Katalog `_basedb` opisuje te obiekty; nie zastępuje ich.

Zamierzona konsekwencja: bezpośredni SQL jest **uprawnionym** sposobem użycia. Ograniczenia są
nakładane w bazie, historia jest rejestrowana przez wyzwalacz – nic nie zakłada, że zapis
przechodzi przez aplikację.

## Jeden punkt decyzji o uprawnieniach

Interfejs, API REST, serwer MCP, formularze udostępnione, webhooki: wszystko przechodzi przez
**ten sam punkt egzekwowania** uprawnień, w rdzeniu. Interfejs jest konsumentem API jak każdy
inny – bez prywatnej ścieżki, bez tokena usługowego. Zasób, którego nie możesz zobaczyć,
odpowiada dokładnie tak samo jak zasób, który nie istnieje.

## Rdzeń decyduje, adaptery tłumaczą

Monorepo w TypeScripcie: `@basedb/core` zawiera całą logikę (katalog, silnik DDL, uprawnienia,
rekordy, historia); `apps/api` (Hono), `apps/mcp` i `apps/web` (Next.js) to adaptery, które nie
wywołują się nawzajem. Interfejs nigdy nie zależy od rdzenia: mówi HTTP i tyle.

## Nic nie ginie bez decyzji

Usunięcie odsuwa na bok, nie niszcząc: usunięta tabela zachowuje swoje wiersze, czytelne w SQL
pod odsuniętą nazwą, i można ją przywrócić. Zmiana nazwy fizycznej zachowuje obsługę starej
nazwy przez alias. Trwałe usunięcie to decyzja administracyjna, poprzedzona sprawdzonym
eksportem.

## PostgreSQL i nic więcej

PostgreSQL 16 lub nowszy i żadnej obowiązkowej zależności zewnętrznej: ani kolejki komunikatów,
ani pamięci podręcznej, ani wyszukiwarki. Kolejka webhooków, opróżnianie historii, limity
częstotliwości – wszystko mieści się w bazie lub w procesie.

## Dalsza lektura

| Rozdział | Temat |
|---|---|
| 00 | Decyzje strukturalne i rejestr kodów błędów |
| 01 | Nazewnictwo i slugifikacja |
| 02 | Katalog `_basedb`, źródło prawdy |
| 03 | Silnik DDL i migracje |
| 04 | Typy pól i odwzorowanie w PostgreSQL |
| 05 | Uprawnienia |
| 06 | Cykl życia: zmiana nazwy, usunięcie, trwałe usunięcie |
| 07 | Historia |
| 08 | API REST i webhooki |
| 09 | Serwer MCP |
| 10 | Architektura oprogramowania |
| 11 | Interfejs |
| 12 | Integracja AI |
| 13 | Uwierzytelnianie |
| 14 | Środowiska |
| 15 | Formularze udostępnione |
