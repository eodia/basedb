---
title: Automatyzacje
description: Gdy wiersz się zmienia, o stałej porze lub jednym kliknięciem – edytuj, utwórz, znajdź, rozgałęź, zapytaj AI, powiadom, wyślij e-mail, wywołaj webhook, napisz na Slacku.
---

Automatyzacja mówi **kiedy**, **jeśli** i **wtedy**: gdy zadanie przechodzi do stanu „Fait”,
zanotuj godzinę; gdy przychodzi negatywna opinia, powiadom osobę odpowiedzialną i napisz na
Slacku; w każdy poniedziałek o 9:00 utwórz wiersz cotygodniowego spotkania zespołu. A gdy jedna
akcja nie wystarcza, automatyzacja podąża za **przepływem**: znajduje wiersz, wybiera tę lub
inną gałąź w zależności od tego, co w nim jest, wykorzystuje w kroku to, co poprzedni krok
znalazł lub zapisał.

Otwiera się je z **Automatyzacje**, w bloku otwartej bazy na dole paska bocznego; wymagają
poziomu **Zarządzanie**.

![Przepływ i jedno z jego uruchomień, nałożone na niego](../../../../assets/screens/pl/automatisations.webp)

## Przepływ

Przepływ rysuje się z góry na dół: wyzwalacz, a potem każdy krok. **+** na linii dodaje krok w
tym miejscu; karta otwiera swoje ustawienia po prawej. Prosta automatyzacja – wyzwalacz i jedna
akcja – mieści się na dwóch kartach i konfiguruje się ją jak dawniej.

## Kiedy

| Wyzwalacz | Ustawienia |
|---|---|
| **Wiersz został utworzony** | tabela |
| **Wiersz został zmieniony** | tabela oraz, w razie potrzeby, tylko obserwowane pola |
| **O stałej porze** | co godzinę, codziennie lub co tydzień, o wybranej godzinie i w wybranej strefie czasowej |
| **Kliknięto przycisk** | [pole Przycisk](/basedb/pl/fonctionnalites/tables-et-champs/#przycisk) tabeli |

Wyzwalacz na wierszach widzi **wszystkie** zapisy: z interfejsu, API, agenta, formularza
udostępnionego, a nawet z bezpośredniego SQL – automatyzacje startują z historii, która
rejestruje je wszystkie.

## Tylko jeśli

Opcjonalny warunek w [języku filtrów](/basedb/pl/integrations/api-rest/#odczyt) –
`statut eq "fait"`, `montant gte 10000 and payee eq false` – sprawdzany na wierszu **w chwili
działania**. Uruchomienie, którego warunek nie jest spełniony, jest „pominięte” i tak jest
oznaczone.

## Wtedy

Do trzydziestu kroków, po kolei; pierwszy, który się nie powiedzie, zatrzymuje kolejne.

| Krok | Co robi |
|---|---|
| **Edytuj wiersz** | zapisuje wartości w wierszu, który wyzwolił automatyzację – lub w tym, który krok znalazł albo utworzył |
| **Utwórz wiersz** | w tej lub innej tabeli bazy |
| **Znajdź wiersz** | pierwszy wiersz tabeli spełniający filtr, aby kolejne kroki mogły go przytoczyć lub zmienić |
| **Powiadom kogoś** | [powiadomienie](/basedb/pl/fonctionnalites/collaboration/#powiadomienia) do wybranych osób lub do osoby z pola Osoba |
| **Wyślij e-mail** | do osób z zespołu, do osoby z pola Osoba, na adres z pola E-mail – klienta, dostawcy – albo na wpisane adresy; temat i treść przytaczają wiersz i poprzednie kroki |
| **Wywołaj webhook** | `POST` przez HTTPS na wybrany adres; jego odpowiedź można potem przytoczyć |
| **Wyślij na Slack** | wiadomość na [połączony](/basedb/pl/integrations/synchronisation/#slack) kanał |
| **Zapytaj AI** | odpowiedź [dostawcy AI](/basedb/pl/fonctionnalites/ia/) na polecenie, które przytacza wiersz i poprzednie kroki – napisz, streść, sklasyfikuj –, odczytaną jako tekst, liczba, tak lub nie, data albo wybór z listy |
| **Warunek** | kilka gałęzi: wybierana jest pierwsza, której warunek jest spełniony, a „W przeciwnym razie”, gdy żaden nie jest; gałęzie potem się łączą |

Wyszukiwanie, które niczego nie znajduje, nie zatrzymuje przepływu: kroki, które miały zmienić
znaleziony wiersz, są pomijane. Aby w takim przypadku zrobić coś innego, sprawdza to warunek –
gałąź z pustym filtrem jest wybierana, gdy tylko wyszukiwanie coś znalazło.

## Zapytaj AI

Podobnie jak [pole AI](/basedb/pl/fonctionnalites/ia/#opcja-ai-pola), krok wysyła do dostawcy
swoje polecenie, w którym każde odwołanie jest zastąpione swoją wartością:

```text
Cet avis de {{auteur}} demande-t-il une action de notre part ? {{avis}}
```

Wybiera się **oczekiwaną odpowiedź** – tekst dowolny lub krótki, liczbę, tak lub nie, datę,
adres internetowy albo wybór z listy, którą można przejąć z pola wyboru. Model zostaje o tym
poinformowany, a odpowiedź, która jej nie zawiera, powoduje niepowodzenie kroku. Kolejne kroki
przytaczają ją przez `{{e1.reponse}}`: w tytule utworzonego zadania, w wiadomości albo w polu
wyboru, gdzie trafia do opcji o tej samej etykiecie.

To, co przytacza polecenie, trafia do dostawcy: krok wymaga twojej **zgody**, udzielanej
ponownie, gdy polecenie się zmienia. Każde wywołanie jest rejestrowane i liczone, razem z polami
AI, w `BASEDB_AI_FIELD_QUOTA` (domyślnie 300 na godzinę). AI niczego nie robi sama z siebie:
zapisują lub powiadamiają kroki umieszczone po niej.

## Przytaczanie

Wartości, wiadomości i filtry przytaczają to, co było wcześniej, za pomocą przycisku **{ }**
obok każdego tekstu:

- `{{Titre}}`, `{{_id}}`: wiersz, który wyzwolił automatyzację;
- `{{e2.titre}}`, `{{e2._id}}`: wiersz znaleziony, utworzony lub zmieniony przez krok `e2` –
  każdy krok ma swój identyfikator na swojej karcie;
- `{{e3.statut}}`, `{{e3.reponse.numero}}`: to, co odpowiedział webhook `e3`;
- `{{e4.reponse}}`: odpowiedź kroku AI `e4`;
- `{{_maintenant}}`: chwila uruchomienia.

Wartość złożona z jednego odwołania przekazuje samą wartość: relację, osobę, wybór – w ten
sposób utworzony wiersz łączy się z tym, który znalazło wyszukiwanie. W filtrze odwołanie jest
zawsze porównywaną wartością, nigdy częścią języka filtrów.

Krok może przytaczać tylko to, co na pewno wydarzyło się przed nim: tego, co znalazła gałąź,
nie można przytoczyć po warunku. Edytor sygnalizuje to na karcie przed zapisaniem.

## Copilot

**Copilot**, w nagłówku, otwiera po prawej rozmowę w języku naturalnym o automatyzacjach
bazy: „gdy zadanie przechodzi do przeglądu, powiadom przypisaną osobę”, „dodaj podsumowanie AI
w notatkach”, „dlaczego ostatnie uruchomienie się nie powiodło?”. Odpowiada i **proponuje**
całą automatyzację – tę, którą masz na ekranie, zmienioną, albo nową – z listą zmian.

Copilot niczego nie zapisuje: **Nałóż na przepływ** pokazuje propozycję w edytorze, gdzie
przeglądasz ją przed zapisaniem – a **Anuluj** na karcie przywraca przepływ do poprzedniego
stanu. Nowa automatyzacja otwiera się w edytorze, gotowa do utworzenia. Każda propozycja jest
sprawdzana tak jak zapis; to, co się nie trzyma, jest odrzucane z informacją o tym.

Domyślnie do dostawcy AI trafia **tylko struktura**, razem z rozmową: tabele i ich pola,
automatyzacje bazy, ta na ekranie w postaci, jaką pokazuje edytor, i jej ostatnie
uruchomienia – ich statusy i kody błędów, nigdy wartości. Osoby i kanały Slacka są wysyłane
pod oznaczeniami (`p1`, `s1`), nigdy przez swój identyfikator. Pole wyboru **Zezwól na odczyt danych**
pozwala Copilotowi, na czas rozmowy, czytać wiersze (najwyżej 50 na odczyt), a każdy odczyt jest
wymieniony pod jego odpowiedzią.

## Testowanie i śledzenie

**Testuj na wierszu** uruchamia zapisaną automatyzację na wybranym wierszu, naprawdę. Zakładka
**Uruchomienia** przechowuje 50 ostatnich przez 30 dni: oczekujące, w toku, udane, pominięte
z powodem, nieudane z kodem. Wybranie jednego nakłada je na przepływ – wybrana ścieżka jest
wyrysowana, każdy wykonany krok mówi, co zrobił i ile to trwało, reszta jest wyszarzona.

## W czyim imieniu działa

Automatyzacja działa z **uprawnieniami osoby, która zapisała ją jako ostatnia**, ustalanymi
na nowo przy każdym uruchomieniu: jeśli ta osoba straci uprawnienie, krok, który go
potrzebował, kończy się niepowodzeniem zamiast je obejść, a wyszukiwanie znajduje tylko to, co
ta osoba może czytać. Historia pokazuje to jako „Automatyzacja «Tâche terminée» · w imieniu …”,
a jej zapisy można cofać jak wszystkie inne.

## Ograniczenia

- To, co zapisuje automatyzacja, nie wyzwala żadnej innej: to, co ma następować po sobie,
  zapisuje się w jednym przepływie.
- Wyszukiwanie zwraca jeden wiersz, pierwszy; nie ma jeszcze „dla każdego wiersza” ani
  oczekiwania („trzy dni później”).
- Bez skryptów. E-mail wychodzi jako zwykły tekst, jeden na odbiorcę – co najwyżej dwadzieścia
  na krok –, przez [serwer wysyłki](/basedb/pl/hebergement/variables/#e-maile) instancji;
  odpowiedź trafia do osoby, która ostatnio zapisała automatyzację.
- Warunek sprawdza wiersz: aby wybrać gałąź w zależności od odpowiedzi AI, najpierw zapisz ją
  w polu wiersza.
- [Szablon bazy](/basedb/pl/fonctionnalites/modeles/) zabiera tylko automatyzacje bez
  wyszukiwania, warunku i kroku AI.
- 100 uruchomień na godzinę na automatyzację; pominięty termin godzinowy jest nadrabiany tylko
  raz.
- Opóźnienie między zapisem a akcją jest rzędu sekundy.
