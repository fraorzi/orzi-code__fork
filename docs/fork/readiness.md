# Gotowość Orzi Code

Stan na 2026-10-11. Źródła na `origin/main` i pakiet zainstalowany na komputerze nie są jeszcze tą samą wersją.

## Co można używać

Zainstalowany `Poracode Personal.app` już obsługuje chat, projekty, historię, trwałą kolejkę, diff pojedynczego promptu, limity i role Crossagents. Historia użytkownika została wcześniej zaimportowana i zachowana. Nie trzeba jej ponownie importować.

W aktualnych źródłach dodatkowo są Orzi Code z nowymi ikonami i motywem, ulubione modele w kolumnach kont, większe zdjęcia w inpucie, importer historii, odzyskiwanie i sprzątanie worktree, narzędzia obrazów Google oraz zarządzane wersje Codex. Kontrole źródeł i izolowanego Electron opisuje [stan implementacji](implementation.md). Te zmiany wymagają nowego pakietu, żeby działały po uruchomieniu z Docka.

## Co zostało

| Obszar                 | Pozostałe prace                                                                                                                                                                              | Znaczenie dla korzystania                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Wersje agentów         | Pin i rollback Codex dla macOS/Linux są wdrożone. Pozostałe dystrybucje wymagają własnej obsługi i testu procesu używanego przez chat. Nie przypinamy biblioteki SDK samą zmianą wersji CLI. | Rozszerzenie kontroli wersji, podstawowy chat działa bez niego.                                                                                |
| Obrazy Google          | Zalogować `agy` i wykonać rzeczywistą generację oraz edycję na koncie. Aktualna kontrola nadal zgłasza brak logowania.                                                                       | Blokuje potwierdzenie obrazów Google. Ścieżka działa przez narzędzia chatu, bez osobnego edytora graficznego. Nie deklarujemy Nano Banana Pro. |
| Grok                   | Potwierdzić dostęp na subskrypcji i sprawdzić prawdziwą sesję.                                                                                                                               | Blokuje potwierdzenie tego dostawcy, nie pozostałych.                                                                                          |
| Figma                  | Własny OAuth połączenia zarządzanego przez aplikację. Natywne połączenie Codex już działało w testach.                                                                                       | Wymagane do współdzielenia połączenia przez innych agentów. Tokeny Codex nie są kopiowane.                                                     |
| Pakiet do używania     | Zbudować aktualny `.app`, sprawdzić start z Docka bez dev servera, rzeczywisty chat, załączniki, historię oraz restart i zachowanie profilu.                                                 | Konieczne do otrzymania nowych funkcji na komputerze. Podmiana wymaga zamknięcia aplikacji.                                                    |
| Aktualizacje aplikacji | Skonfigurować Developer ID i notarizację, przygotować wydanie i sprawdzić aktualizację między dwoma podpisanymi pakietami. Feed i workflow forka są gotowe.                                  | Potrzebne do automatycznego dostarczania pakietów, osobne od lokalnej instalacji i podstawowego korzystania.                                   |

Publiczne wydanie pozostaje osobną decyzją. Mobilne ikony iOS/Android i witryna marketingowa upstreamu nie są częścią odbioru desktopu na Macu. Nie wszystkie pomysły z propozycji ról zostały wybrane do wdrożenia; nie dopisujemy ich automatycznie do wymaganego zakresu.

## Korzystanie podczas rozwoju

Agent może edytować checkout aplikacji, gdy korzystasz z zainstalowanego pakietu. Pakiet uruchamia kod zapisany w swoim bundle, więc edycja źródeł i lokalne testy w osobnym profilu nie przeładowują używanej aplikacji. Nowy kod zaczyna działać po zbudowaniu i instalacji nowego pakietu.

Przy podmianie pakietu zamknij aplikację po zakończeniu aktywnych zadań. Kontrole deweloperskie korzystają z oddzielnych profili i katalogów. Nie uruchamiaj dwóch wersji równocześnie na tym samym profilu produkcyjnym. W dev edycja źródeł może przeładować renderer lub proces Electron, więc ten tryb nie służy do nieprzerwanej pracy produkcyjnej.

Zmiana źródeł nie jest równoznaczna ze zmianą globalnego CLI agenta. Zarządzane wersje mają własne kompletne instalacje, a przełączenie jest blokowane podczas aktywnej sesji lub uruchamiania procesu. Uszkodzony kandydat pozostawia aktywną wersję. Historia i logowanie są oddzielne od tych instalacji.
