# Plan osobistego forka PoraCode

Stan: pierwsza lokalna implementacja i instalowana wersja testowa. Data: 2026-10-04. Wykonane zmiany, weryfikacja i pozostały zakres: [stan implementacji](docs/fork/implementation.md). Poniższy plan opisuje cel, nie potwierdzenie realizacji wszystkich punktów.

Baza: PoraCode 1.8.1, commit `d71e5a1abb39755909e5d0e20c46b93d6825e114`. Działająca instalacja użytkownika zgłasza 1.8.0, więc ustalenia z pobranego kodu wymagają porównania z tą wersją. Szczegóły i źródła: [research.md](docs/fork/research.md).

## Cel i granice

Jedna aplikacja do pracy na istniejących subskrypcjach Claude, Codex, Grok i Gemini, z własnym interfejsem oraz organizacją wątków według folderów projektów. Wykorzystujemy istniejące adaptery PoraCode i oficjalne procesy agentów. Nie przepisujemy aplikacji od zera.

Obecny etap przygotowuje repozytorium i decyzje wdrożeniowe. Docelowy branding, kolory i dalsze zmiany wizualne pozostają otwarte. Robocza nazwa katalogu nie jest nazwą produktu.

Wymagania doprecyzowane przez użytkownika: docelowo normalna instalowana aplikacja macOS, uruchamiana ikoną, oraz automatyczne aktualizowanie używanych agentów bez każdorazowego klikania zgody na pobranie.

## Ustalenia, które wpływają na plan

- Codex chat już uruchamia `codex app-server`. Claude chat korzysta z `@anthropic-ai/claude-agent-sdk`. Gemini i Grok mają adaptery ACP.
- CLI oznacza rzeczywistą sesję terminalową z interfejsem producenta. Chat oznacza interfejs PoraCode nad ustrukturyzowanym protokołem agenta. To nie są wyłącznie dwa motywy tego samego widoku.
- Chat Codexa może udostępniać ten sam silnik agenta, ale nie gwarantuje wszystkich funkcji aplikacji Codex, jej pluginów, konektorów ani identycznego kontekstu. Claude Agent SDK nie jest odpowiednikiem całego Claude Desktop, zwykłego czatu ani Cowork.
- Model danych ma już projekt przypisany do wątku, archiwizację i przywracanie. Sidebar ma wariant płaski i wariant projektowy. Zakres dotyczy przede wszystkim zachowania i prezentacji istniejących funkcji.
- Kod ma już odczyt limitów Antigravity. Gemini CLI i Gemini w Antigravity wymagają osobno oznaczonych źródeł limitu.
- Linki z wiadomości trafiają do handlera, który najpierw próbuje otworzyć panel przeglądarki. Osobny handler przeglądarki systemowej już istnieje.
- W działającej aplikacji wpis zewnętrznego Figma MCP jest wyłączony i nieuwierzytelniony. To obserwacja konfiguracji, nie rozpoznana przyczyna zgłoszonego problemu.

## Docelowy workflow

### Instalowana aplikacja

Rezultatem jest pakiet `.app` instalowany w `/Applications`, dostarczony w instalatorze `.dmg`. Uruchamianie z Findera, Launchpada i Docka ma działać po restarcie komputera, bez otwierania terminala, uruchamiania skryptu, dev servera czy obecności checkoutu repozytorium.

- Aplikacja sama uruchamia potrzebne procesy i przywraca zapisany stan. Zamknięcie okna i zakończenie aplikacji mają zdefiniowane zachowanie dla aktywnych sesji.
- Pakiet zawiera zależności aplikacji. Wykrywanie lub instalacja runtime agentów odbywa się z GUI. Zewnętrzne narzędzia projektu mogą pozostać zależnościami projektu.
- Start z Docka musi poprawnie znajdować agentów i potrzebne narzędzia, także bez środowiska odziedziczonego z otwartego terminala.
- Zachowujemy osobną tożsamość i katalog danych forka. Przygotowujemy proces pakowania dla architektury Maca użytkownika oraz konfigurację podpisywania i notaryzacji zgodną z wybraną dystrybucją. Dostępność poświadczeń do podpisywania sprawdzamy przed wydaniem.
- Odbiór następuje na zainstalowanym pakiecie: uruchomienie po restarcie, bez procesu deweloperskiego, utworzenie wątku, działanie agenta i ponowne otwarcie historii.

### Automatyczne aktualizacje agentów

Aktualizacje Claude, Codex, Grok, Gemini i używanych adapterów ACP są domyślnie automatyczne. Sprawdzenie, pobranie i instalacja zgodnej stabilnej wersji nie wymagają kolejnego potwierdzenia użytkownika. Ustawienia pozwalają wyłączyć automat dla wybranego agenta lub tymczasowo przypiąć wersję.

- Proponowany harmonogram: przy starcie aplikacji i co 6 godzin podczas jej działania, z ponowieniem po odzyskaniu sieci lub wybudzeniu. Zamknięta aplikacja nie wymaga osobnego demona aktualizacyjnego w pierwszej wersji.
- Pobieranie może odbywać się w tle. Aktywny proces kończy pracę na swojej wersji; nowa wersja jest używana przez nowe procesy po sprawdzeniu zgodności. Jeśli instalator modyfikuje pliki używane przez działający proces, instalacja czeka na zakończenie korzystających z nich sesji.
- Aktualizacje koordynuje supervisor, również dla sesji w tle i subagentów. Jedna blokada na instalację zapobiega konfliktom harmonogramu, ręcznego sprawdzenia i aktualizatora producenta.
- Najpierw wykryć właściciela instalacji i rzeczywistą ścieżkę programu. Zachować zgodność z instalatorem producenta lub menedżerem pakietów; nie tworzyć przypadkiem drugiej globalnej kopii agenta.
- Preferować instalacje w zakresie użytkownika, obsługiwane bez `sudo`. Gdy istniejąca instalacja wymaga uprawnień administratora lub interaktywnego instalatora, zaproponować jednorazowe przygotowanie instalacji zarządzanej przez aplikację. Nie obiecywać bezobsługowości dla instalacji, której aplikacja nie może aktualizować.
- Instalacja zarządzana przez aplikację powinna, gdzie pozwala na to dystrybucja producenta, przechowywać wersje obok siebie, sprawdzać nową wersję przed przełączeniem i zachować poprzednią. Dla instalacji zewnętrznych sprawdzić możliwość przywrócenia osobno.
- Przed aktywacją: sprawdzić pochodzenie pakietu i dostępne mechanizmy integralności, numer wersji, start procesu oraz zgodność protokołu wymaganych funkcji. Wadliwa aktualizacja pozostawia ostatnią działającą wersję i nie uruchamia pętli ciągłych reinstalacji.
- Po aktualizacji odświeżyć wykryte modele, funkcje, polecenia i MCP. Zachować logowanie, historię i konfigurację. Ponownej autoryzacji wymaganej przez dostawcę nie można zastąpić automatycznym pobraniem.
- Stan aktualizacji jest widoczny w ustawieniach: wersja używana, pobrana, oczekiwanie na koniec sesji i ewentualny błąd. Powiadomienie wymagające działania pojawia się tylko wtedy, gdy automat nie potrafi dokończyć aktualizacji.

Rozróżniamy wersję CLI, wersję adaptera/protokołu i bibliotekę SDK dołączoną do aplikacji. Aktualizacja globalnego Claude CLI nie aktualizuje automatycznie spakowanego Agent SDK. Zależności wbudowane aktualizujemy przez nowe wydanie forka; przed włączeniem nowego runtime testujemy zgodność z adapterem. Wymóg aktualizacji agentów obejmuje program rzeczywiście używany przez chat, a nie jedynie numer wersji CLI w ustawieniach.

W kodzie istnieją już polecenia aktualizacji agentów i częściowy automat dla rejestru ACP. Rozszerzamy te mechanizmy o harmonogram, koordynację sesji i weryfikację wersji. Aktualizacja samej aplikacji jest osobnym mechanizmem i może pobierać wyłącznie wydania tego forka.

### Folder projektu i jego wątki

Lewy panel pokazuje dodane foldery projektów. Rozwinięcie folderu odsłania jego wątki, przycisk nowego wątku oraz archiwum tego projektu. Dodanie folderu wskazuje istniejący katalog na dysku; nie kopiuje projektu.

```text
Projekty                         [+ Dodaj folder]
  Projekt A                     [+ Nowy wątek]
    Naprawa formularza          Codex
    Nowy widok                 Claude
    Archiwum (liczba wątków)
  Projekt B                     [+ Nowy wątek]
    Analiza integracji          Gemini
```

- Nowy wątek dziedziczy katalog projektu. Wybór agenta i modelu pozostaje w formularzu tworzenia.
- Archiwizacja ukrywa wątek na liście aktywnych, zachowuje historię i pozwala przywrócić go do tego samego projektu.
- Archiwizacja nie usuwa plików, gałęzi ani worktree. Nie przerywa po cichu działającego agenta; aktywny wątek wymaga jawnego wyboru zakończenia pracy albo pozostawienia go aktywnego.
- Status wykonania, oznaczenie zakończenia i archiwizacja zachowują osobne znaczenie. Projektujemy jasne etykiety nad istniejącym modelem danych.
- Zapamiętujemy rozwinięte foldery i kolejność. Wyszukiwanie obejmuje wątki aktywne oraz opcjonalnie archiwalne.
- Worktree pozostaje kontekstem technicznym wątku. Nie ma dominować nad układem projektów.
- Istniejące wątki bez zwykłego projektu zachowują dostępne miejsce, np. "Pozostałe". Niczego automatycznie nie przenosimy między katalogami.

Założenie pierwszej wersji: folder oznacza rzeczywisty katalog projektu. Zagnieżdżone kolekcje organizacyjne można dodać później, jeśli będą potrzebne.

### Jedna domyślna rozmowa

Użytkownik wybiera agenta, model i projekt. Chat jest domyślny tam, gdzie adapter zapewnia potrzebne funkcje. Wybór technicznego runtime i terminal zostają w opcjach zaawansowanych.

Nie usuwamy backendu terminalowego przed porównaniem funkcji. Nie zmieniamy automatycznie trybu istniejących sesji. Jeśli dany agent nie obsługuje potrzebnej funkcji w chat, pokazujemy konkretną informację i możliwość użycia terminala.

Przed ustawieniem domyślnego chatu sprawdzamy dla każdego używanego agenta: logowanie na subskrypcję, pliki i obrazy, odczyt i zapis plików projektu, polecenia, zgody, MCP, pytania do użytkownika, przerwanie, wznowienie po restarcie i komendy agenta. Brak funkcji ma być widoczny, a nie maskowany wspólnym UI.

Subskrypcja jest preferowanym sposobem dostępu. Aplikacja nie przełącza samoczynnie na płatny klucz API przy wyczerpaniu limitu lub błędzie logowania.

### Linki

Kliknięcie linku HTTP/HTTPS w odpowiedzi agenta otwiera domyślną przeglądarkę systemową. Obejmuje Markdown, automatycznie wykryte URL i linki w terminalu.

Wbudowana przeglądarka pozostaje dostępna przez jawne "Otwórz w PoraCode" oraz do podglądu aplikacji i pracy agenta z przeglądarką. Linki do lokalnych plików zachowują otwieranie pliku i numeru linii. OAuth korzysta z dotychczasowej ścieżki logowania. Zachowujemy walidację adresów URL.

Wdrożenie zaczynamy od wspólnej polityki otwierania linków użytkownika i istniejącego `openExternalNative`. Nie zmieniamy wszystkich wywołań `openExternal` mechanicznie, bo obsługują też inne działania aplikacji.

### Limity i Antigravity

Proponowany kierunek do późniejszego dopracowania wizualnego: kompaktowe, czytelne wiersze z nazwą usługi, pozostałym limitem, paskiem i czasem resetu. Szczegóły pokazują okna limitów oraz czas ostatniego odczytu. Korzystamy z istniejących tokenów i komponentów UI.

- Rozróżniamy "Gemini CLI" oraz "Gemini w Antigravity". Wspólne konto Google nie wystarcza do uznania limitów za wspólną pulę.
- Pierwsza wersja planu zakłada rzeczywiste dane limitu z Antigravity. Jeśli chodzi wyłącznie o wygląd licznika, ograniczymy zakres do UI.
- Wykorzystujemy istniejący skaner Antigravity i parser quota summary. Sprawdzamy odczyt na koncie użytkownika oraz zgodność z widokiem Antigravity.
- Pokazujemy tylko okna zwrócone przez źródło. Obecny parser obsługuje grupy modeli, okno 5h i tygodniowe oraz starszy format danych.
- Brak autoryzacji, niedostępne źródło, nieaktualny odczyt i wyczerpany limit mają różne stany. Brak danych nigdy nie oznacza 0% zużycia.
- Domyślnie pokazujemy pozostały limit. Jeżeli wewnętrzny model przechowuje zużycie, przeliczenie następuje na granicy prezentacji i ma test wartości 0%, 100% oraz wartości pośredniej.
- Nie wyliczamy procentu subskrypcji z liczby tokenów rozmowy. Limit konta, koszt API i zajętość kontekstu to różne informacje.

## Figma MCP: diagnoza przed zmianą architektury

Cel: ten sam plik i węzeł Figma dają agentowi prawidłowy kontekst oraz obraz zarówno w działającym kliencie referencyjnym, jak i w forku.

1. Wybrać jeden dostępny projekt Figma oraz konkretny `fileKey` i `nodeId`. Użyć identycznego zadania w aplikacji Codex i PoraCode.
2. Ustalić rzeczywiste źródło narzędzi: plugin/konektor aplikacji Codex, natywny MCP Codexa, wpis PoraCode czy desktopowy MCP Figma. Identyczna nazwa "Figma" nie dowodzi identycznej integracji.
3. Porównać wersję i ścieżkę procesu Codex, katalog pracy, efektywny `CODEX_HOME`, konfigurację projektu, dostępne pluginy, serwery oraz nazwy narzędzi. Zapisujemy metadane i błędy, bez tokenów i treści poświadczeń.
4. Rozstrzygnąć wyłączony wpis Figma w PoraCode. Włączenie i OAuth mają sens, jeśli wybieramy tę drogę; nie dodawać drugiej kopii już działającego połączenia.
5. Wykonać rzeczywiste wywołania odczytu struktury/kontekstu i zrzutu ekranu. Sprawdzić, czy agent otrzymuje obraz, a nie tylko tekstowy opis wyniku. Sam komunikat "connected" nie jest testem sukcesu.
6. Porównać wynik na granicach serwer MCP, runtime agenta, zdarzenia PoraCode i renderer. Zachować bloki obrazów, MIME, resource links, `structuredContent`, `_meta` i błędy tam, gdzie przewiduje je dany protokół.
7. Jeżeli wynik przechodzi przez proxy, porównać tę samą operację bez niego. Usuwać lub omijać pośrednika dopiero po wykazaniu różnicy.

W kodzie jest proxy filtrujące MCP, ale nie jest używane zawsze. Ta ścieżka uruchamia je dla wyłączonych narzędzi lub obsługi `cwd` stdio. Sama obecność proxy w repozytorium nie wyjaśnia awarii Figma.

PoraCode uruchamia Codexa z prywatnym katalogiem stanu i dowiązuje wybrane pliki globalnego Codexa. Nie można z tego wywnioskować, że wszystkie pluginy i poświadczenia obu aplikacji są identyczne. Porównanie jest obowiązkowe przed usunięciem tej izolacji.

Preferowana architektura: zachować natywne adaptery agentów, a MCP przekazywać bezpośrednio tam, gdzie jest to obsługiwane i nie omija wymaganej polityki narzędzi. Nie dodawać pośredniego modelu tłumaczącego odpowiedzi. Nie przepisywać działającego `app-server` na własną pętlę wywołań API.

Do UI dodać diagnostykę konkretnego połączenia: źródło konfiguracji, stan autoryzacji, lista narzędzi, ostatni błąd i test odczytu. Różnice między serwerem zdalnym, desktopowym i pluginem mają być widoczne.

## Kolejność realizacji i odbiór

| Etap | Zakres                                                                        | Warunek zakończenia                                                                                                                                                                                                                                      |
| ---- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Oddzielna tożsamość aplikacji, środowisko deweloperskie i próbny pakiet macOS | Fork uruchamia się ikoną obok PoraCode, ma własną bazę, ustawienia, logi i kanał aktualizacji. Nie modyfikuje produkcyjnej bazy.                                                                                                                         |
| 1    | Reprodukcja Figma MCP i porównanie runtime                                    | Zapisana różnica między klientami; działają odczyt kontekstu i obraz albo precyzyjnie wskazana zależność, której klient nie udostępnia.                                                                                                                  |
| 2    | Linki w przeglądarce systemowej                                               | Kliknięcia w chat i terminalu trafiają do przeglądarki systemowej; pliki i OAuth nadal działają.                                                                                                                                                         |
| 3    | Foldery projektów i archiwum                                                  | Tworzenie we właściwym katalogu, archiwizacja, przywracanie, wyszukiwanie i odtworzenie po restarcie bez utraty historii.                                                                                                                                |
| 4    | Chat jako domyślny workflow                                                   | Macierz funkcji dla Claude, Codex, Grok i Gemini; działająca subskrypcja, MCP, zgody i wznowienie; terminal dostępny jako fallback.                                                                                                                      |
| 4a   | Automatyczne aktualizacje agentów                                             | Nowa zgodna wersja pobiera się i instaluje bez klikania; aktywna sesja pozostaje sprawna; przetestowane brak sieci, błąd instalacji, restart aplikacji podczas aktualizacji i konflikt instalatorów. Spakowany chat używa zweryfikowanej wersji runtime. |
| 5    | Nowy widok limitów i Gemini w Antigravity                                     | Dane porównane ze źródłem na tym samym koncie; czytelne resety i stany błędów; zatwierdzony wygląd.                                                                                                                                                      |
| 6    | Dalsze zmiany wizualne i instalowane wydanie osobiste                         | Pakiet `.app` z `.dmg` działa z `/Applications` po restarcie, bez terminala i checkoutu. Przetestowana kopia danych, aktualizacje agentów, możliwość powrotu do poprzedniej wersji i brak aktualizacji do upstreamu.                                     |

Etap 1 może rozwiązać się poprawieniem konfiguracji. Wtedy nie dopisujemy niepotrzebnej przebudowy MCP. Problem zależny od zewnętrznego pluginu nie blokuje niezależnych zmian sidebaru, linków i limitów.

## Mapa zmian w repozytorium

| Obszar                                | Punkt startowy                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista projektów i wątków              | `src/renderer/views/MainView/parts/Sidebar/` oraz `src/renderer/state/sidebarUiStore.ts`                                                                                           |
| Trwałość i archiwizacja               | `src/shared/contracts/thread.ts`, `src/main/db/projectsThreads.ts`, `src/renderer/actions/threadActions.ts`                                                                        |
| Wygląd limitów                        | `src/renderer/components/providers/ProviderUsageRail.tsx`, `ProviderUsageCircle.tsx`, `UsageWindowBars.tsx` oraz `src/renderer/views/MainView/parts/RightPanel/parts/UsagePanel/`  |
| Dane limitów                          | `packages/agents-usage/src/collectors/`, `src/supervisor/agents/antigravity/antigravityUsageScanner.ts`, `src/supervisor/runtime/usageService.ts`                                  |
| Linki                                 | `src/renderer/utils/openExternal.ts`, `src/renderer/components/thread/ChatPane/parts/items/`, `src/renderer/components/terminal/XTermSurface.tsx`, `src/main/ipc/localHandlers.ts` |
| Codex i Claude                        | `src/supervisor/agents/codex/`, `src/supervisor/agents/claude/`                                                                                                                    |
| Konfiguracja i proxy MCP              | `src/supervisor/mcp/`, `src/supervisor/agents/codex/plugin/install.ts`                                                                                                             |
| Tożsamość i dane forka                | `src/shared/channel.ts`, `src/shared/poracodePaths.ts`, `scripts/electron-builder.shared.cjs`                                                                                      |
| Pakiet macOS i aktualizacje aplikacji | `scripts/build-desktop-artifact.mjs`, `scripts/electron-builder.shared.cjs`, `src/main/updates/autoUpdater.ts`                                                                     |
| Aktualizacje agentów                  | `src/supervisor/agents/updateAgent.ts`, `src/shared/agents/updateResolver.ts`, `src/shared/contracts/agent.ts`, `src/supervisor/agents/acpRegistry.ts`                             |
| Późniejszy design                     | `src/renderer/theme/themeTokens.ts`, `themePresets.ts`, istniejące komponenty HeroUI                                                                                               |

To punkty rozpoczęcia pracy, nie lista plików przeznaczonych do bezwarunkowego przepisania.

## Utrzymanie forka i weryfikacja

- Gałąź forka: `main`. Remote `origin` wskazuje `git@github.com:fraorzi/orzi-code__fork.git`; `upstream` wskazuje oryginalne repozytorium. Publikację bieżącego kodu zatwierdził użytkownik 2026-10-06.
- Pobrano pełną historię upstreamu. Aktualizacje upstreamu nadal wymagają jawnego scalenia i weryfikacji; samo pobranie historii nie zmienia kodu forka.
- Utrzymywać małe zmiany według powyższych etapów. Zachować strukturę adapterów i istniejącą bazę komponentów.
- Przed pierwszym uruchomieniem ustalić osobne identyfikatory aplikacji, katalog danych, porty/usługi, schematy URL i ustawienia aktualizacji. Sama zmiana nazwy aplikacji nie izoluje wszystkich danych.
- Do testów migracji używać spójnej kopii SQLite wraz z potrzebnymi załącznikami, utworzonej mechanizmem backupu lub po zamknięciu aplikacji. Samo kopiowanie aktywnego pliku bazy może pominąć WAL.
- Kopia historii może odwoływać się do rzeczywistych katalogów pracy. Import historii nie oznacza izolacji plików projektów; pierwsze testy zapisu agenta wykonać w testowym repozytorium.
- Zmiany schematów mają migrację i próbę aktualizacji ze starszymi danymi. Rollback aplikacji korzysta z wcześniejszej kopii danych, jeśli migracja nie jest odwracalna.
- Po zmianach kodu: testy zachowania przy zmienianych modułach, typecheck, lint i format. UI sprawdzić w działającej aplikacji, w tym klawiaturę, kontrast i małą szerokość okna. MCP sprawdzić rzeczywistym wywołaniem, nie samym mockiem.
- Zmiany tekstów UI uwzględniają Lingui i wszystkie katalogi wymagane przez repozytorium. Nie wprowadzać nazw dostawców do wspólnych modułów, jeśli zachowanie można zadeklarować w adapterze.
- Build dopiero na etapie implementacji, z dostępną siecią dla pobieranych zależności. W etapie planowania nie instalowano paczek, nie wykonywano buildu i nie uruchamiano forka.

## Miejsce na dalsze wymagania

Nowe wymagania dopisywać z przykładem obecnego zachowania, oczekiwanym wynikiem i kryterium odbioru. Priorytety, layout limitów i branding można zmieniać bez ruszania adapterów agentów. Docelowy wygląd zostanie opracowany po wskazaniu preferencji lub referencji.
