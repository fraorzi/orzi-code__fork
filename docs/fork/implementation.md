# Stan implementacji

Data: 2026-10-06. Lokalna wersja testowa na bazie PoraCode 1.8.1.

## Import rzeczywistej historii i trwałe archiwum

- Na polecenie użytkownika zaimportowano całą bazę historii z `~/.poracode` do `~/.poracode-personal`: 22 projekty użytkownika i Stronę główną, 216 wątków, w tym 210 archiwalnych, 28 755 elementów historii, 1121 zakończonych tur, notatki i 16 plików załączników. Jest to jednorazowa kopia, bez późniejszej synchronizacji dwóch aplikacji.
- Źródłową bazę otwarto tylko do odczytu i wykonano spójny snapshot przez SQLite online backup API, uwzględniający WAL działającej aplikacji. Źródła i oryginalnej aplikacji nie zatrzymywano ani nie modyfikowano. Poprzedni profil forka zachowano w `~/.poracode-personal.before-history-import-20261006`; snapshot sprzed migracji jest w `.tmp/history-import-20261006-restored/source.sqlite`.
- Zachowano identyfikatory, tytuły, ścieżki projektów, archiwizację, treść rozmów i referencje sesji dostawców. Przeniesiono 15 segmentów załączników i ich adresy `poracode-local://` na katalog forka; wszystkie 16 plików zweryfikowano przez SHA-256. Globalne ustawienia, klucze, tokeny i profil przeglądarki starej aplikacji nie były kopiowane.
- Importowane wątki ustawiono jako nieaktywne, a widok początkowy jako Stronę główną. Kopia historii nie przejmuje procesów działających w oryginale. Nie wysyłano promptów do zaimportowanych sesji. Kontynuowanie tego samego wątku równocześnie w obu aplikacjach nie było testowane.
- Kontrola pierwszego uruchomienia wykryła odziedziczone kasowanie archiwum po 30 dniach: usunęło 68 wątków wyłącznie w kopii importowanej. Usunięto tę operację oraz nieużywaną akcję purge. Pełny import odtworzono ze spójnego snapshotu i ponownie sprawdzono. Archiwum pozostaje zapisane do jawnego usunięcia przez użytkownika.
- Granice zgodności: zachowano format danych. Istniejąca migracja SQLite 41 -> 42 przeszła bez zmiany identyfikatorów projektów i wątków. Usunięcie automatycznej operacji purge nie zmienia schematu bazy, wersji magazynu renderera ani protokołu i nie wymaga ich podbijania. Test regresyjny rozpoczyna od wątku archiwalnego z 2020 roku i wykonuje dwa cykle startu.
- Przeszło 41 testów hydratacji i aplikacji, typecheck, oba etapy lintu i format. Smoke w izolowanym profilu mock: 4 scenariusze oraz 4 bramki deterministyczne, 0 błędów renderera. Raport: `/private/tmp/poracode-history-import-mock/artifacts/smoke-report.json`.
- Zainstalowany pakiet porównał przez rzeczywisty IPC wszystkie 23 identyfikatory projektów, 216 identyfikatorów wątków, 210 identyfikatorów archiwum i cztery próbki historii ze snapshotem. Obraz z przeniesionego załącznika został odczytany i zdekodowany jako 349 x 183. Po pełnym zamknięciu i ponownym uruchomieniu wszystkie kontrole przeszły ponownie. Integralność bazy: `ok`, liczba elementów historii nadal 28 755. Dowody: `/private/tmp/poracode-history-import/first-start-verification.json`, `restart-verification.json` i `imported-projects.png`; raport transferu w `.tmp/history-import-20261006-restored/report.json`.
- Build i DMG z zachowaniem archiwum przeszły. Nowy pakiet jest w `/Applications/Poracode Personal.app`; poprzedni pakiet w `.tmp/previous-install/history-import/Poracode Personal.app`. Weryfikacja podpisu przeszła. Import nie jest jeszcze osobnym ekranem ani importerem scalającym dwie używane bazy.
- Katalog `/Users/franciszek/WebstormProjects/mail-studio` nie istnieje już w źródle. Projekt i jego historia zostały zachowane; uruchomienie nowej pracy wymaga wskazania istniejącego katalogu.

## Domyślna kolejka wiadomości

- Wykorzystano istniejącą kolejkę supervisora i zmieniono domyślne zachowanie z `steer` na `queue`. Wiadomości wysyłane w trakcie pracy są widoczne nad polem wpisywania i automatycznie trafiają do tego samego wątku po zakończeniu bieżącej tury. Nie przerywają aktywnej pracy.
- Podgląd pozwala edytować, usuwać i przestawiać wiadomości. Cmd+Enter na macOS uruchamia działanie przeciwne do ustawionego domyślnie, czyli przy kolejce przekazuje pilną instrukcję przez `steer`.
- Granica zgodności: format ustawień i protokół zdalny pozostają poprawne. Starsze dane bez pola otrzymują `queue`, a jawne `steer` jest zachowane. Zdalny parser korzysta teraz z tego samego domyślnego ustawienia co desktop. Testy obejmują starsze lokalne ustawienia i odpowiedzi hosta v9. Nie zmieniono wersji bazy, cache ani protokołu.
- Kolejka dotyczy chatu. Jest przechowywana w pamięci supervisora; nie należy traktować nieprzekazanych wiadomości jako zapisanych na pełny restart aplikacji.
- Przeszło 220 testów w 13 zestawach, typecheck, oba etapy lintu i formatowanie zmienionych plików. Poprawiono brakującą migawkę MCP w istniejącym fixture testowym kolejki. Nie dodawano tekstów renderera, więc nie powstały nowe wpisy tłumaczeń.
- Rzeczywisty test Codex 6.1 Sol: podczas `sleep 120` dodano dwie wiadomości przez kontrolki chatu. UI i supervisor pokazały obie w kolejności. Agent zakończył oryginalną turę i automatycznie odpowiedział `QUEUE_SECOND_APRICOT`, potem `QUEUE_THIRD_OK`; zachował słowo z wcześniejszego promptu. Końcowy stan to `idle` i pusta kolejka. Nie zmieniono plików projektu.
- Dowody: `/private/tmp/poracode-queue-live2/artifacts/queue-verification.json`, `queue-result.json`, `queue-visible.png` i `queue-completed.png`. Test Claude dla tej zmiany był deterministyczny, nie na żywym koncie.
- Smoke w osobnym profilu mock: 6 scenariuszy i 4 bramki deterministyczne przeszły; błędów renderera: 0. Raport: `/private/tmp/poracode-queue-mock/artifacts/smoke-report.json`. Wcześniejszy ogólny przebieg real przerwał kontrolę ustawień przez polską nazwę kontrolki skilla; nie jest raportowany jako PASS. Test rzeczywistej kolejki ma osobny wynik PASS.
- Build renderera, Electron, DMG i weryfikacja podpisu przeszły. Nowy pakiet zainstalowano w `/Applications/Poracode Personal.app`, a poprzedni zachowano w `.tmp/previous-install/follow-up-queue/Poracode Personal.app`. DMG: `release/Poracode Personal-1.8.1-arm64.dmg`.
- Zainstalowany pakiet uruchomiony przez Launch Services bez dev servera, w osobnym profilu QA, odczytał przez IPC `followUpBehavior: "queue"` i zamontował interfejs. Dowody: `/private/tmp/poracode-queue-installed/installed-check.json` i `installed.png`.

## Figma i aktualizacje osobno dla agentów

- W rzeczywistym chacie Codex odczytano wskazany przez użytkownika węzeł Figma `Usługi_1920`, 1920 x 9780. `get_metadata` i `get_screenshot` zakończyły się sukcesem. Zweryfikowano blok `image/png` w rzeczywistej odpowiedzi MCP i zapisano go jako obraz. Sam komunikat agenta nie był podstawą wyniku.
- Codex korzysta z natywnego serwera `figma` skonfigurowanego w globalnym `config.toml` i jego istniejącego OAuth. W tej konfiguracji problem nie wystąpił. Osobna próba przez MCP zarządzany przez fork zwróciła `auth-required`, ponieważ fork nie ma własnej sesji OAuth tego serwera. Nie zmieniano poświadczeń ani pliku Figma.
- Dowody: `/private/tmp/poracode-figma-smoke/artifacts/figma-report.json`, `figma-metadata.xml`, `figma-mcp-image.png` i `figma-live.png`. Konkretny plik i węzeł są w lokalnym raporcie.
- Ustawienia każdego lokalnego agenta mają przełącznik automatycznych aktualizacji. Wspólne instalacje profili respektują ustawienie dostawcy, a oddzielne instancje ACP zachowują własne ustawienia. Globalne wyłączenie ma pierwszeństwo; ponowne włączenie zachowuje wybory poszczególnych agentów. Ręczna aktualizacja pozostaje dostępna.
- Supervisor sprawdza preferencję przed odczytem wersji i przed rozpoczęciem aktualizacji. Dodatkowa ścieżka aktualizacji rejestru ACP sprawdza ją przed każdą instalacją i nie raportuje pominiętej instalacji jako wykonanej.
- Granica zgodności: nowe `automaticAgentUpdatesDisabled` w `settings.json` i cache renderera ma domyślną pustą listę. Starsze dane są poprawne; test zaczyna od ustawień sprzed zmiany. Nie zmieniono schematu bazy, danych cache statusu, protokołów helperów ani pluginów, więc nie wymagają zmiany wersji.
- Przeszły typecheck, oba etapy lintu, 119 testów ustawień i runtime w 6 zestawach oraz 77 testów widoku agenta i ustawień współdzielonych w 2 zestawach. Jeden wcześniejszy test pozostał pominięty. Lingui: 0 brakujących tłumaczeń we wszystkich 12 katalogach.
- Powtarzalny smoke `scripts/smoke-agent-update-preferences.mjs` weryfikuje przełącznik przez rzeczywisty renderer, zapis i odczyt IPC, zachowanie wyboru innego agenta, ponowne otwarcie ustawień, ponowne włączenie oraz nadrzędność ustawienia globalnego. Test używa fikcyjnego dostawcy i nie aktualizuje rzeczywistych programów. Raport: `/private/tmp/poracode-agent-updates-smoke/artifacts/smoke-report.json`; 6 scenariuszy i 4 deterministyczne bramki przeszły, błędów renderera: 0.
- Nowy build i DMG z tym ustawieniem są zainstalowane w `/Applications/Poracode Personal.app`. Po restarcie pakiet odczytał zapisaną preferencję Codex; włączenie i ponowne wyłączenie przez rzeczywisty przełącznik zmieniło `settings.json` zgodnie z UI. Globalny automat pozostał wyłączony w profilu QA. W tej samej zainstalowanej aplikacji ponowiono odczyt Figma, otrzymano kolejny blok PNG i odpowiedź `FIGMA_INSTALLED_OK`. Dowody: `/private/tmp/poracode-figma-smoke/artifacts/agent-updates-installed.png`, `figma-installed.png` i `figma-installed-report.json`. Poprzedni pakiet zachowano w `.tmp/previous-install/agent-updates/Poracode Personal.app`.

## Edytor ról i puli modeli - bieżący kod

Zmiana z 2026-10-06 jest sprawdzona w izolowanej aplikacji deweloperskiej oraz przepakowana do `/Applications/Poracode Personal.app` i `release/Poracode Personal-1.8.1-arm64.dmg`.

- Wejście: Ustawienia > Serwery MCP > Crossagents > ustawienia routingu.
- Pula modeli korzysta z dotychczasowego filtra Crossagents. Wykluczeni dostawcy i modele nie pojawiają się jako dostępne wybory roli, a niedostępny model podstawowy lub zapasowy blokuje zapis edytora.
- Można tworzyć, edytować i usuwać role z nazwą, maksymalnie pięcioma tagami, modelem, rozumowaniem, Fast, instrukcjami i maksymalnie trzema modelami zapasowymi.
- Role rozszerzają istniejące zapisane reguły routingu. Wybór odbywa się przez wszystkie tagi roli, nie przez osobny obowiązkowy etap w zwykłym czacie. Jawny wybór dostawcy i modelu zachowuje pierwszeństwo.
- MCP `list_routing_preferences` pokazuje także nazwy i instrukcje ról. Główny agent dostaje wskazówkę, jak ich używać. Instrukcje trafiają do promptu wykonawcy, gdy używana jest odpowiadająca im reguła. Modele zapasowe otrzymują ten sam prompt. Instrukcje nie zmieniają uprawnień wykonawcy.
- Nowe role zachowują domyślną politykę ponowienia tylko przed rozpoczęciem zadania. Edycja starej reguły zachowuje jej `retryMode`; dla `any-failure` formularz wyświetla istniejące ryzyko powtórzenia pracy.
- Zapis przez osobny handler main `saveCrossagentRole` atomowo zastępuje stare tagi i odrzuca kolizje, nie usuwając innej roli. Odczyt po restarcie oraz zwykłe zapisy renderera zachowują metadane.
- Granice zgodności: `name` i `instructions` są opcjonalne w `crossagentRoutingOverrideSchema`; stare reguły pozostają poprawne. Nowy handler IPC jest dodatkową metodą lokalną. Baza, istniejące cache i protokoły helperów nie wymagają zmiany wersji. Test zaczyna od formatu sprzed dodania ról.
- Sprawdzono 160 testów w 6 zestawach, typecheck, oba etapy lintu na zmienionych plikach i brak brakujących tłumaczeń w 12 katalogach.
- Powtarzalny test Electron: `scripts/smoke-crossagent-roles.mjs`, wywoływany przez istniejący runner. Weryfikuje rzeczywisty IPC zapis/odczyt, ochronę przed starym zapisem ustawień, kolizje, zmianę tagów, usuwanie i otwarcie edytora z niedostępną konfiguracją. Używa izolowanego profilu, bez uruchamiania płatnej tury dostawcy.
- Raport i zrzut: `/private/tmp/poracode-roles-smoke/roles-20261006/artifacts/smoke-report.json` oraz `smoke-worker-role-editor.png`. Skrypt sprawdza też ustawienia, wyszukiwanie wątków, geometrię kontrolek i 9 deterministycznych bramek. Liczba błędów renderera: 0.
- Test rzeczywistych modeli: Codex `gpt-6.1-sol` wybrał po tagu zapisaną rolę Claude Haiku bez jawnego wskazania dostawcy/modelu. Wykonawca otrzymał instrukcje roli, utworzył `role-proof.txt`, a integracja zwróciła `applied`. Plik w projekcie głównym zawierał dokładnie `ROLE_INSTRUCTIONS_OK` z końcowym znakiem nowej linii. Główny agent zakończył odpowiedzią `ROLE_LIVE_OK`. Edytor odczytał zapisane instrukcje i model Haiku.
- Ponownie przeszły typecheck, 136 testów w 6 zestawach dotyczących ról i 75 testów routingu/integracji worktree w 3 zestawach. Kontrola renderera: 0 błędów. Build, pakowanie i `codesign --verify --deep --strict` zainstalowanego pakietu przeszły. Poprzedni pakiet zachowano w `.tmp/previous-install/Poracode Personal.app`.
- Dowody: `/private/tmp/poracode-sol61-smoke/artifacts/role-live-items.json`, `role-live.png`, `role-editor-live.png` i `smoke-report.json`. Test używał oddzielnego profilu oraz jednorazowego projektu.
- Kontrola zainstalowanego pakietu po pełnym restarcie: odtworzono historię testowego wątku, Codex 6.1 sol odpowiedział `SOL61_INSTALLED_OK`, a edytor poprawnie odczytał nazwę, Haiku i instrukcje zapisanej roli. Zrzuty: `sol61-installed.png` i `role-editor-installed.png` w tym samym katalogu dowodów. Pakiet uruchomiono przez Launch Services w tle, bez serwera deweloperskiego.

## Codex 6.1 sol i błąd 400

- Na koncie ChatGPT Plus `gpt-6.1-sol` działa przez Codex CLI 0.160.1. Rzeczywisty chat forka potwierdził pierwszą odpowiedź, follow-up oraz zamknięcie i wznowienie procesu z tym samym identyfikatorem sesji. Ustawienia: `high`, `400k`, Fast włączony.
- Oryginalny `/Applications/Poracode.app` nadal miał uruchomiony proces Codex 0.158.0, chociaż symlink CLI na dysku wskazywał już 0.160.1. Potwierdzono stary proces przez ścieżkę jego działającego `codex-code-mode-host`.
- Porównanie w osobnych procesach app-server, na tym samym koncie, z `high` i Fast: 0.158.0 zwraca HTTP 400 z komunikatem `The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.`, a 0.160.1 kończy turę poprawnie. Nie było potrzeby zmieniać identyfikatora modelu ani używać płatnego klucza API.
- Aktualizacja pliku CLI nie zastępuje już uruchomionego procesu. Pełne zamknięcie i ponowne uruchomienie oryginalnego PoraCode powinno uruchomić nowe CLI. Oryginalna aplikacja i jej wątki nie były zatrzymywane ani modyfikowane podczas testu.
- Dowody: `/private/tmp/poracode-sol61-smoke/artifacts/codex-0.158.0-turn.json`, `codex-0.160.1-turn.json` i `sol61-resume.png`. Historyczny zapis błędu użytkownika miał tę samą treść.

## Dostępna aplikacja

- Zainstalowana w `/Applications/Poracode Personal.app`.
- Instalator: `release/Poracode Personal-1.8.1-arm64.dmg`.
- Wersja dla Apple Silicon. Do uruchomienia aplikacji nie potrzeba terminala, skryptu, serwera deweloperskiego ani checkoutu.
- Osobny identyfikator `com.franciszek.poracode.personal`, dane w `~/.poracode-personal`, osobny profil Electron i tożsamość magazynu systemowego.
- Historia użytkownika została jednorazowo zaimportowana i sprawdzona po restarcie. Brak osobnego ekranu importu i synchronizacji ze starą aplikacją.
- Aktualizacje samej aplikacji nie korzystają z repozytorium upstreamu. Osobny kanał publikacji forka nie został skonfigurowany.
- Pakiet podpisany lokalnie ad hoc, bez notaryzacji Apple. Zweryfikowano podpis zainstalowanej aplikacji przez `codesign --verify --deep --strict`.

## Wdrożone zachowanie

- Domyślny sidebar grupuje wątki według projektów. Pod projektem jest rozwijane archiwum z przywracaniem. Rozwinięcie archiwum korzysta z istniejącego trwałego stanu sidebaru.
- Archiwizacja w trakcie aktywnej tury jest blokowana z komunikatem. Nie zatrzymuje wtedy agenta po cichu.
- Wybór Chat/CLI przeniesiony do menu zaawansowanego. Istniejący resolver preferuje chat, jeśli agent go obsługuje, i zachowuje zapisany wybór użytkownika.
- Linki obsługiwane przez wspólny helper wiadomości otwierają domyślną przeglądarkę systemową. Terminal również domyślnie korzysta z tej ścieżki. Panel wbudowanej przeglądarki pozostaje dostępny osobno.
- W rozwiniętym sidebarze limity są wierszami z pozostałym procentem, paskiem i czasem resetu. Nieaktualny odczyt ma oznaczenie. Zwijany sidebar zachowuje kompaktowe wskaźniki.
- Odczyt Antigravity wykorzystuje istniejący skaner. W zainstalowanej aplikacji otrzymano rzeczywiste okna Gemini i Claude: 5h oraz tygodniowe.
- Domyślnie włączone automatyczne aktualizacje agentów, z przełącznikiem w ustawieniach ogólnych. Wykorzystują istniejące aktualizatory CLI oraz instalacje ACP, także first-class.
- Sprawdzanie wersji co 6 godzin; harmonogram co minutę ponawia odroczone zadania. Niepowodzenie pojedynczej aktualizacji ma 15-minutową przerwę przed kolejną próbą.
- Instalacje wstrzymują się, gdy fork ma sesje agentów, i są koordynowane z uruchamianiem nowych sesji. Aktualizacja jednego programu nie może nakładać się na drugi instalator sterowany tym koordynatorem.
- Wbudowany Agent SDK nadal aktualizuje się wraz z pakietem aplikacji. Automat CLI nie zmienia bibliotek spakowanych w aplikacji.

## Praca zespołowa

- Nowy przełącznik przy tworzeniu wątku, domyślnie wyłączony. Wybrany model jest głównym agentem i nadal sam implementuje oraz prowadzi rozmowę.
- Crossagents działa także bez opcjonalnego skilla pluginu. Usunięto warunek, który zatrzymywał rzeczywistą sesję mimo dostępnych narzędzi MCP.
- Instrukcje głównego agenta dopuszczają delegowanie zarówno prostych zadań słabszemu modelowi, jak i trudnych, niezależnych części mocnemu modelowi innego dostawcy. Używane są istniejące adaptery, katalog modeli i reguły Crossagents.
- Maksymalnie dwóch wykonawców naraz. Brak dziedziczenia Crossagents przez wykonawcę, czyli bez kolejnego poziomu delegowania tym mechanizmem.
- Każdy wykonawca otrzymuje osobny Git worktree z migawką bieżących plików. Migawka zawiera zmiany staged, unstaged i untracked, z wyłączeniem ignorowanych plików.
- Po pomyślnym zakończeniu i zamknięciu sesji wykonawcy aplikacja stosuje jego różnicę względem migawki. Integracje do tego samego katalogu są wykonywane kolejno. Nie powstają commity i nie zmienia się indeks głównego repozytorium.
- Konflikt nie uruchamia okna zatwierdzania. Główny agent dostaje status `needs_resolution`, ścieżkę worktree i poprawki, rozwiązuje problem i testuje połączone zmiany. Status `completed` opisuje zakończenie wykonawcy; powodzenie integracji jest osobnym polem.
- Błąd lub anulowanie wykonawcy nie powoduje automatycznej integracji. Nie ma automatycznego ponawiania po awarii procesu aplikacji.
- Pierwsza wersja wymaga lokalnego projektu POSIX z istniejącym HEAD, chatu i obsługi Crossagents. Submoduły, WSL i projekty zdalne nie są jeszcze objęte tym mechanizmem.
- Ignorowane pliki, np. zależności i lokalne `.env`, nie są kopiowane. Wykonawca może potrzebować przygotowania zależności do testów. Worktree nie ogranicza systemowych uprawnień procesu.
- Migawki i katalogi są zachowywane pod `~/.poracode-personal/team-worktrees`. Manifest `workspace.json` ma wersję 1. Nie ma jeszcze ekranu sprzątania ani automatycznego usuwania zachowanych katalogów.
- Pole `teamMode` jest opcjonalne w istniejącym schemacie konfiguracji. Starsze wątki pozostają poprawne i nie włączają trybu zespołowego. Testy obejmują tę zgodność; migracja bazy ani zmiana wersji protokołu nie jest potrzebna.

## Diff pojedynczego promptu

- Przycisk "Zmiany w tym prompcie" pod zakończoną odpowiedzią pokazuje zapisany diff tej pracy. Dotyczy zarówno ostatniej odpowiedzi, jak i wcześniejszych odpowiedzi w wątku.
- Porównanie zaczyna się od plików sprzed wysłania promptu, więc pomija wcześniejsze lokalne zmiany. Zakończony diff jest niezmienny mimo kolejnych promptów i edycji.
- Końcowa migawka jest zapisywana z obsługi zdarzenia zakończenia tury, także dla niewidocznego wątku. Otwarcie historycznej rozmowy nie tworzy pozornego diffu na podstawie aktualnych plików.
- Migawka następnego promptu czeka na dokończenie zapisu poprzedniego wyniku.
- Obejmuje zmiany wykonawców włączone przed zakończeniem głównej tury. Migawka jest porównaniem plików w czasie, nie detektorem autorstwa: równoległe ręczne zmiany lub zmiany innego wątku w tym samym katalogu mogą również wejść do diffu.
- Starsze prompty bez zapisanych dwóch stanów nie mają odtwarzanego diffu. Obsługa tego widoku dotyczy lokalnych wątków; nie rozszerzono zdalnego protokołu klienta.
- Nowy format natywnych migawek ma `storageVersion: 2`. Przechowuje drzewa Git i osobne metadane w obiektach blob, bez tworzenia commitów. HEAD i indeks pozostają bez zmian. Odczyt wcześniejszych migawek zapisanych jako commity jest zachowany i przetestowany.
- `commit` w istniejącym rekordzie jest zachowanym dla zgodności polem identyfikatora obiektu. Dla v2 jest identyfikatorem drzewa. Starsze wydania forka nie odczytają nowych migawek v2; dane starszego formatu nie są usuwane.

## Dodatkowe resety limitów

- Sidebar i panel zużycia pokazują liczbę zapisanych resetów oraz dokładną datę wygaśnięcia w lokalnej strefie czasowej. Każdy grant może mieć własny termin; brak daty jest oznaczony.
- Odczyt Codex używa osobnego endpointu z tym samym kontem OAuth co odczyt limitów. Uwzględnia status kredytu, obsługę przez plan, datę przyznania i datę wygaśnięcia. Odczyt nie zużywa resetu.
- Odczyt Claude pyta o programy resetów w odpowiedzi zużycia. Odpowiedź `ineligible_reason: "surface"` oznacza ograniczenie do strony/aplikacji dostawcy. UI pokazuje ten stan i link do strony zużycia, bez zgadywania liczby lub terminu.
- W odczycie konta użytkownika Codex zwrócił 1 dostępny reset do 2026-10-29 16:33 UTC. Claude zwrócił ograniczenie `surface`, więc nie potwierdzono jego liczby resetów.
- Wykorzystane, wygasłe, przyszłe, wstrzymane lub niedostępne w planie granty nie zwiększają licznika. Błąd odczytu nie jest zamieniany na zero. Parser odrzuca nieznany format i nieprawidłowe daty.
- Błąd dodatkowego odczytu Codex nie usuwa poprawnie pobranych zwykłych limitów. Odpowiedź 429 zachowuje przerwę podaną przez serwer.
- `resetCredits` jest opcjonalnym rozszerzeniem `UsageSnapshot`. Starszy cache nadal zawiera poprawne limity i zostaje uzupełniony podczas odświeżenia. Test obejmuje odczyt starego formatu; wersja cache pozostaje 5. Renderer porównuje także nową część danych.

## Sprawdzone

- Pierwszy etap: 164 testy w 11 zestawach dotyczących aktualizacji, ustawień, tożsamości aplikacji, sidebaru i akcji wątków.
- Tryb zespołowy: 288 testów w 13 zestawach, w tym rzeczywiste repozytoria Git oraz przebieg uruchomienia, anulowania i integracji.
- Resety i powiązane zapisy migawek: 76 testów w 6 zestawach.
- Diff promptu: 113 testów w 7 zestawach, w tym rozdzielenie dwóch promptów, trwałość historycznego diffu i odczyt starszych migawek.
- Po poprawce finalizacji na zdarzeniu zakończenia sesji: 37 testów aplikacji i akcji migawek oraz 5 testów widoku diffu przeszło.
- Typecheck i oba etapy lintu przeszły.
- Build renderera i procesów Electron przeszedł; utworzono DMG.
- Lingui: brak brakujących tłumaczeń we wszystkich 12 katalogach poza źródłowym angielskim.
- Zainstalowany pakiet uruchomiony przez macOS Launch Services w oddzielnym profilu testowym, bez dev servera.
- Sprawdzono rzeczywisty renderer: widok limitów, domyślny chat, menu trybów, projekt, archiwum i przywrócenie wątku. Po pełnym ponownym uruchomieniu aplikacji przywrócony wątek nadal należy do tego projektu.
- Test z rzeczywistymi dostawcami w zainstalowanej aplikacji: Codex 6 Luna zlecił Claude Haiku zmianę `task.txt`, aplikacja zwróciła integrację `applied`, a plik w projekcie głównym zawierał wynik wykonawcy. Nie było zatwierdzania scalenia. Dowód: `.tmp/installed-smoke/team-live-result.json`.
- Rzeczywisty prompt Claude Haiku w zainstalowanej aplikacji zapisał diff tylko `task.txt`, mimo wcześniejszych zmian w innych plikach. Późniejsze ręczne zmiany `task.txt` i `unrelated.txt` nie zmieniły zapisanego diffu. HEAD i indeks Git pozostały bez zmian. Po pełnym restarcie aplikacji diff był identyczny; końcowy widok pokazuje także nazwę pliku (`prompt-diff-final.png`). Dowody: `.tmp/installed-smoke/prompt-checkpoints-final.json` i `prompt-frozen-diff.json`.
- Sidebar i panel użycia pokazały rzeczywisty dodatkowy reset Codex z datą 29 października 2026, 17:33 czasu lokalnego. Claude pokazał informację o sprawdzeniu strony dostawcy, zgodnie z odpowiedzią API `surface`. Nie zużyto żadnego resetu. Zrzut: `.tmp/installed-smoke/reset-panel.png`.
- Materiały testowe i zrzuty są w `.tmp/installed-smoke/`. Dane produkcyjnego PoraCode nie były migrowane ani modyfikowane.

## Pozostały zakres i ograniczenia

- Figma: na podanym przykładzie działa natywne połączenie Codex. Połączenie zarządzane przez aplikację dla pozostałych dostawców nadal wymaga własnego OAuth.
- Nie wykonano rzeczywistej aktualizacji zainstalowanych CLI podczas testów. Harmonogram, koordynacja i obsługa błędów mają testy; próby instalacji w profilu testowym były wyłączone.
- Osobne włączanie automatycznych aktualizacji dla każdego agenta jest dodane. Przypinanie konkretnej wersji z planu nie jest jeszcze wdrożone.
- Aktualizatory zewnętrznych instalacji nadal zależą od uprawnień i zachowania instalatora producenta. Nie wdrożono uniwersalnego rollbacku programów ani osobnego magazynu ich wersji.
- Koordynator nie stanowi blokady instalatorów uruchomionych poza forkiem. Nie należy traktować go jako ochrony wszystkich procesów agentów z innych aplikacji.
- Nie przeprowadzono pełnych sesji generowania dla wszystkich dostawców ani testu zgodności każdej nowej wersji agenta ze wszystkimi funkcjami adaptera.
- Historia użytkownika jest zaimportowana. Brak nowego brandingu graficznego; dalszy kierunek wizualny pozostaje otwarty.
- Edytor nazwanych ról i puli modeli jest w zainstalowanym pakiecie. Sprawdzono jedną rzeczywistą rolę Haiku sterowaną przez Codex 6.1 sol; nie jest to test wszystkich dostawców ani wszystkich wariantów modeli zapasowych.

## Odtworzenie buildu

Repo wymaga Node >= 24.10.0 i pnpm 12.3.4. Lokalny toolchain przygotowano pod `.tmp/toolchain`, bez zmiany domyślnego Node użytkownika.

Komputer nie miał Rust. Do tego wydania skopiowano niezmieniony moduł sterowania komputerem z zainstalowanego PoraCode: helper 0.4.3, protokół 3, commit źródłowy w jego manifeście `ce33db772f0e3a95bcae48874d919c923523e82a`. Przeszedł `node scripts/prepare-computer-use-helper.mjs --check --platform mac` i kontrolę pakowania. Pełny build tego modułu ze źródeł wymaga Rust 1.98 i narzędzi Apple.

Pakowanie gotowych artefaktów aplikacji i przygotowanych zasobów:

```sh
node scripts/build-desktop-artifact.mjs --platform mac --target dmg --arch arm64 --skip-build
```

`--skip-build` wymaga uprzedniego buildu bieżącego kodu, przygotowania zasobów oraz zweryfikowanego modułu sterowania komputerem. Nie służy do uruchamiania aplikacji przez użytkownika.

Publikację bieżących źródeł w `fraorzi/orzi-code__fork` zatwierdził użytkownik 2026-10-06. Instalator i dane lokalnych kont pozostają poza repozytorium.
