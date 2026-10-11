# Gotowość Orzi Code

Stan na 2026-10-11. Sprawdzony lokalny pakiet Orzi Code jest zainstalowany jako `/Applications/Orzi Code.app` i znajduje się w indeksie Spotlight pod właściwą nazwą.

## Co można używać

Orzi Code obsługuje chat, projekty, historię, trwałą kolejkę, diff pojedynczego promptu, limity i role Crossagents. Historia użytkownika została wcześniej zaimportowana i zachowana. Nie trzeba jej ponownie importować.

Zainstalowany pakiet zawiera nowe ikony i motyw, ulubione modele w kolumnach kont, większe zdjęcia w inpucie, importer historii, odzyskiwanie i sprzątanie worktree, narzędzia obrazów Google oraz zarządzane wersje Codex. Kontrole źródeł, izolowanego Electron i rzeczywistego pakietu opisuje [stan implementacji](implementation.md).

Lokalny DMG macOS ARM64 jest w `.tmp/orzi-ready-20261011/Orzi-Code-1.8.1-arm64.dmg`. Start bez dev servera, pierwsza rozmowa Codex 6.1 Sol na ChatGPT Plus z obrazem, follow-up oraz wznowienie tej samej sesji po restarcie przeszły na osobnym profilu QA. Pakiet zawiera kod `6a18c3f3`, ma podpis ad hoc i nie jest publicznym wydaniem. Stary pakiet i profil sprzed instalacji są w `.tmp/previous-install/spotlight/20261011-162622/`. Kontrola uruchomienia nowego pakietu na produkcyjnym profilu pozostaje do wykonania.

## Co zostało

| Obszar                 | Pozostałe prace                                                                                                                                                                              | Znaczenie dla korzystania                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Wersje agentów         | Pin i rollback Codex dla macOS/Linux są wdrożone. Pozostałe dystrybucje wymagają własnej obsługi i testu procesu używanego przez chat. Nie przypinamy biblioteki SDK samą zmianą wersji CLI. | Rozszerzenie kontroli wersji, podstawowy chat działa bez niego.                                                                                |
| Obrazy Google          | Zalogować `agy` i wykonać rzeczywistą generację oraz edycję na koncie. Aktualna kontrola nadal zgłasza brak logowania.                                                                       | Blokuje potwierdzenie obrazów Google. Ścieżka działa przez narzędzia chatu, bez osobnego edytora graficznego. Nie deklarujemy Nano Banana Pro. |
| Grok                   | Potwierdzić dostęp na subskrypcji i sprawdzić prawdziwą sesję.                                                                                                                               | Blokuje potwierdzenie tego dostawcy, nie pozostałych.                                                                                          |
| Figma                  | Własny OAuth połączenia zarządzanego przez aplikację. Natywne połączenie Codex już działało w testach.                                                                                       | Wymagane do współdzielenia połączenia przez innych agentów. Tokeny Codex nie są kopiowane.                                                     |
| Pakiet do używania     | Aktualny `.app` jest zainstalowany w `/Applications` i indeksowany w Spotlight. Pozostało przypięcie do Docka i kontrola na istniejącym profilu użytkownika.                                 | Nowe funkcje są w zainstalowanym pakiecie. Produkcyjnego importu nie powtarzać.                                                                |
| Aktualizacje aplikacji | Skonfigurować Developer ID i notarizację, przygotować wydanie i sprawdzić aktualizację między dwoma podpisanymi pakietami. Feed i workflow forka są gotowe.                                  | Potrzebne do automatycznego dostarczania pakietów, osobne od lokalnej instalacji i podstawowego korzystania.                                   |

Publiczne wydanie pozostaje osobną decyzją. Mobilne ikony iOS/Android i witryna marketingowa upstreamu nie są częścią odbioru desktopu na Macu. Nie wszystkie pomysły z propozycji ról zostały wybrane do wdrożenia; nie dopisujemy ich automatycznie do wymaganego zakresu.

Przełącznik Claude Lokalnie / Chmura jest [odłożony do decyzji](claude-cloud.md). Konto pozwala tworzyć zadania chmurowe, ale odrzuca podłączenie i strumień potrzebny do chatu w forku. Użytkownik nie zaakceptował jeszcze wariantu otwierającego rozmowę w oficjalnym Claude.

## Korzystanie podczas rozwoju

Agent może edytować checkout aplikacji, gdy korzystasz z zainstalowanego pakietu. Pakiet uruchamia kod zapisany w swoim bundle, więc edycja źródeł i lokalne testy w osobnym profilu nie przeładowują używanej aplikacji. Nowy kod zaczyna działać po zbudowaniu i instalacji nowego pakietu.

Przy podmianie pakietu zamknij aplikację po zakończeniu aktywnych zadań. Kontrole deweloperskie korzystają z oddzielnych profili i katalogów. Nie uruchamiaj dwóch wersji równocześnie na tym samym profilu produkcyjnym. W dev edycja źródeł może przeładować renderer lub proces Electron, więc ten tryb nie służy do nieprzerwanej pracy produkcyjnej.

Zmiana źródeł nie jest równoznaczna ze zmianą globalnego CLI agenta. Zarządzane wersje mają własne kompletne instalacje, a przełączenie jest blokowane podczas aktywnej sesji lub uruchamiania procesu. Uszkodzony kandydat pozostawia aktywną wersję. Historia i logowanie są oddzielne od tych instalacji.
