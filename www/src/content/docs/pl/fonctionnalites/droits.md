---
title: Uprawnienia i grupy
description: Konta, grupy, poziomy dostępu do projektu, bazy i tabeli, ograniczenia na poziomie pól oraz twoje ustawienia.
---

Uprawnienia nadaje się **grupom**, nigdy pojedynczym osobom. Poziom ustawiony na projekcie,
bazie lub tabeli przechodzi na wszystko, co jest poniżej, łącznie z tym, co zostanie utworzone
później.

## Cztery poziomy

| Poziom | Co pozwala robić |
|---|---|
| **Brak dostępu** | nic: zasób jest niewidoczny |
| **Odczyt** | oglądać wiersze, komentować je, tworzyć sobie widoki osobiste, przeglądać strukturę i pulpity, zadawać i zapisywać własne pytania, pisać SQL tylko do odczytu i zapisywać osobiste zapytania |
| **Edycja** | a do tego tworzyć, zmieniać i usuwać wiersze |
| **Zarządzanie** | a do tego zmieniać strukturę, tworzyć widoki udostępnione i pulpity, udostępniać pulpit przez link, udostępniać pytania i zapytania, tworzyć widoki SQL, automatyzacje, integracje i tokeny; jego SQL obejmuje całą bazę, łącznie z zapisami |

Uprawnienia **się sumują**: osoba otrzymuje najwyższy poziom, jaki daje jej którakolwiek z jej
grup. Nadanie tabeli mniej niż jej bazie czyni ją „szczegółową”.

Zawsze istnieją dwie grupy: **Administratorzy**, którzy zarządzają wszystkim, oraz **Wszyscy
użytkownicy**, do której należy każde konto – to, co się jej przyzna, mają wszyscy.

## Aż do pola

Pod siatką poziomów **Pola** ukrywa kolumnę przed grupą lub czyni ją dla niej
niemodyfikowalną. Ekran pokazuje też, co dana osoba faktycznie widzi i dzięki której grupie.

Ukryte pole nie występuje nigdzie: ani w siatce, ani w widokach, API, MCP, historii, SQL pisanym
w interfejsie czy widokach SQL. Filtrowanie lub sortowanie po nim daje taką samą odpowiedź jak
dla pola, które nie istnieje.

## Aż do wiersza

Obok **Pól**, **Wiersze** pokazuje grupie tylko niektóre wiersze tabeli: te, które wybiera
filtr, zapisany jak filtr widoku. `@me` oznacza osobę zalogowaną:

- `commercial eq @me` — każdy sprzedawca widzi tylko swoich klientów;
- `region in ["nord", "est"]` — zespół widzi tylko swoje regiony;
- `_created_by eq @me` — każdy widzi tylko to, co sam utworzył.

Uprawnienia się sumują: osoba widzi wiersze wszystkich swoich grup, a grupa bez reguły widzi
wszystkie. Kto zarządza strukturą tabeli — poziom Zarządzanie — widzi zawsze wszystko. Ekran
podaje, ile wierszy widzi dana osoba i przez którą grupę.

Wiersz poza jej regułą nie istnieje dla tej osoby: ani w widokach, pulpitach, wyszukiwaniu,
API, MCP czy historii, ani do zmiany, usunięcia czy powiązania. Wiersz, który tworzy, musi
należeć do jej zakresu; zmieniając wiersz, może natomiast sprawić, że wyjdzie on z jej zakresu —
zadanie powierzone koledze. Odpowiedzi na
[formularze udostępnione](/basedb/pl/fonctionnalites/formulaires-partages/) docierają zawsze.

## A SQL?

W interfejsie SQL podlega tym samym uprawnieniom, egzekwowanym przez sam PostgreSQL: bez
poziomu Zarządzanie zapytanie wykonuje się tylko do odczytu, na roli właściwej danej osobie,
gdzie zamknięta tabela nie istnieje, ukryte pole jest odrzucane, a czytane są tylko jej wiersze,
niezależnie od tego, czy tabela jest nazwana samodzielnie czy ze swoim schematem.
[Widok SQL](/basedb/pl/fonctionnalites/requetes-et-vues-sql/)
czyta się z uprawnieniami osoby czytającej, a udostępnienie zapytania udostępnia tylko jego
tekst.

Natomiast **bezpośredni dostęp przez `psql`** do bazy nie jest kontrolowany przez basedb: czyta
wszystko, łącznie z ukrytymi polami. Ograniczenia chronią powierzchnie produktu – interfejs,
API, MCP –, nigdy przed kimś, kto ma dostęp SQL do bazy; takie dostępy reguluje się
poleceniami `GRANT` PostgreSQL, nadawanymi przez administratora serwera. Tabela, która ma
regułę wierszy, ma włączone bezpieczeństwo na poziomie wiersza PostgreSQL: rola utworzona dla
zewnętrznego narzędzia nie widzi w niej żadnego wiersza, jeśli nie ma atrybutu `BYPASSRLS` ani
własnej polityki.

## Konta i logowanie

- Konto tworzy się z **hasłem tymczasowym**, pokazywanym raz i do zmiany przy pierwszym
  logowaniu.
- Logowanie odbywa się hasłem lub przez dostawcę **OpenID Connect** skonfigurowanego przez
  administratora serwera.
- Działania administracyjne wymagają **sesji uprzywilejowanej**: hasła wpisanego ponownie w
  ciągu ostatnich pięciu minut.
- Sesje można unieważniać; unieważnienie sesji natychmiast unieważnia jej tokeny dostępu.

## Twoje ustawienia

**Ustawienia**, w menu profilu w lewym dolnym rogu, dotyczą tylko ciebie:

| Zakładka | Co się tam robi |
|---|---|
| **Profil** | wyświetlane imię i nazwisko; adres do logowania; dostawcy tożsamości powiązani z kontem, do powiązania lub odłączenia |
| **Bezpieczeństwo** | zmiana hasła; otwarte sesje, do zamknięcia pojedynczo lub wszystkie |
| **Wygląd** | język interfejsu; motyw; kolejność elementów daty – `25/09/2026` lub `2026-09-25` – i pierwszy dzień tygodnia w kalendarzach |
| **Powiadomienia** | rodzaje powiadomień, których już nie chcesz |
| **Tokeny** | utworzone przez ciebie tokeny integracji we wszystkich twoich bazach, ich ostatnie użycie i unieważnianie |

basedb mówi w **dwudziestu językach**: francuskim, angielskim, niemieckim, hiszpańskim,
włoskim, portugalskim (Brazylia), niderlandzkim, polskim, czeskim, szwedzkim, duńskim,
norweskim, fińskim, rumuńskim, węgierskim, tureckim, ukraińskim, japońskim, chińskim
uproszczonym i koreańskim. Domyślnie interfejs przyjmuje język twojej przeglądarki; **Język**,
w zakładce **Wygląd**, ustawia inny. Liczby i daty są zgodne z wybranym językiem.

Link może też żądać języka: `?lang=de` na końcu adresu basedb pokazuje po niemiecku ekran
logowania, formularz, udostępniony widok lub udostępniony pulpit. W ten sposób witryna prowadzi
do demo w języku strony. Po zalogowaniu basedb podąża za twoim kontem: językiem wybranym w
**Wygląd**, w przeciwnym razie językiem przeglądarki.

Motyw jest zapamiętywany w przeglądarce; język, kolejność elementów daty i pierwszy dzień
tygodnia towarzyszą ci na każdym komputerze. Zmiana adresu lub powiązanie dostawcy wymaga sesji
uprzywilejowanej; konto bez hasła, logujące się przez dostawcę, zachowuje adres tego dostawcy.

## Jeden punkt egzekwowania

Wszystkie powierzchnie – interfejs, API, MCP, formularze i widoki udostępnione,
automatyzacje – przechodzą przez ten sam punkt decyzji o uprawnieniach, w rdzeniu. Nie istnieje
żadna prywatna ścieżka interfejsu: jeśli ekran czegoś nie wyświetla, to dlatego, że API tego
nie zwróciło.

Działa to też w drugą stronę: ekran **nie proponuje tego, co zostałoby odrzucone**. Bez poziomu
Zarządzanie ekran Struktura można przeglądać bez przycisków i ołówka, a import nie proponuje
utworzenia tabeli; bez uprawnienia do tworzenia lub usuwania wierszy siatka nie oferuje ani
wiersza dodawania, ani „Usuń”.
