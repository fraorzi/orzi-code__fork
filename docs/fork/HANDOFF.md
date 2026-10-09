# Przekazanie osobistego forka PoraCode

Stan na 2026-10-09. Kontynuuj w `/Users/franciszek/WebstormProjects/orzi-code__fork`.

## Zacznij tutaj

1. Przeczytaj instrukcje nadrzędnego i lokalnego `AGENTS.md`, potem [stan implementacji](implementation.md). Ten dokument określa, co działa, co sprawdzono i jakie są ograniczenia.
2. Sprawdź `git status` i aktualny diff. Implementacja forka jest publikowana na gałęzi `main` w `git@github.com:fraorzi/orzi-code__fork.git`. Remote `upstream` zachowuje oryginalne repozytorium i pełną historię. Zachowaj ewentualne zmodyfikowane i nieśledzone pliki. Świeży clone upstreamu nie zawiera zmian forka.
3. Kontynuuj aktualne polecenie użytkownika. [Plan](../../FORK_PLAN.md) opisuje cel, a [propozycja ról](agent-roles-proposal.md) także funkcje przyszłe. Nie traktuj wszystkich ich punktów jako już wdrożonych. Źródła wcześniejszych ustaleń są w [research.md](research.md).

## Ustalenia użytkownika

- Aplikacja macOS uruchamiana ikoną, praca na istniejących subskrypcjach, automatyczne aktualizacje agentów.
- Projekty i ich wątki oraz archiwum po lewej, czytelne pozostałe limity, Antigravity, dodatkowe resety i ich ważność. Linki od agentów otwierają domyślną przeglądarkę systemową.
- Podstawowy workflow: ręczny wybór modelu i krótkie zadanie. Praca zespołowa jest opcjonalna dla większych zadań.
- Wybrany mocny agent sam implementuje i deleguje niezależne proste lub trudne zadania modelom różnych dostawców. Oddzielne konteksty są równie ważne jak dobór mocy modelu.
- Integracja zmian wykonawców jest automatyczna. Użytkownik wyraźnie wykluczył zatwierdzanie każdego scalenia. Nie należy ponownie otwierać tej decyzji.
- Diff ma pokazywać wynik pojedynczego promptu. Dalszy kierunek wyglądu pozostaje otwarty.
- Użytkownik polecił 2026-10-06: "pushuj na biezaco". Commituj i pushuj zakończone, zweryfikowane zmiany forka do `origin/main` bez ponownego pytania. Publikacja wydań i DMG pozostaje osobną decyzją. Odpowiedzi po polsku, zwięzłe, wyłącznie ASCII hyphen-minus zamiast długich myślników.

## Aktualizacja z 2026-10-09

Użytkownik zlecił kontynuację całej pozostałej listy oraz generowanie i edycję obrazów Google na istniejącej subskrypcji Gemini. Płatne API jest wykluczone. Oficjalna ścieżka Antigravity ma natywne `generate_image`; bieżąca dokumentacja deklaruje Nano Banana 2 bez wyboru modelu obrazu, więc nie obiecuj Nano Banana Pro przez CLI. `agy models` zgłasza brak logowania. Użytkownik otrzymał prośbę o zalogowanie przez `agy`; nie kopiuj ani nie drukuj tokenów. Pytanie o Groka nie otrzymało odpowiedzi.

Użytkownik ustalił docelową nazwę Orzi Code i polecił zapisać [wymagania redesignu](redesign-requirements.md): pełny branding z ikoną/logo, kolorystyka, ikony i flow na podstawie rzeczywistych widoków Cursora, większe zdjęcia w inpucie oraz dropdown tylko z ulubionymi w kolumnach według subskrypcji. Pozostałe modele mają być dostępne przez opcję z plusem. Te wymagania nie są jeszcze zaimplementowane.

W bieżącym kodzie są trwałe zadania zespołu, jawne wznowienie zachowanego worktree, odzyskiwanie integracji i ekran sprzątania w ustawieniach Crossagents. Deterministyczne testy Git i smoke Electron przeszły. Naprawiono też ujawnione przez testy zamykanie paneli podczas pracy w tle. Szczegóły i granice zgodności opisuje początek [stanu implementacji](implementation.md). Te zmiany nie są jeszcze w zainstalowanym pakiecie.

Pozostały zakres nadal obejmuje obrazy na subskrypcji, importer/scalanie historii, kanał aktualizacji forka, wersje agentów/rollback oraz rzeczywiste testy kont Google/Grok i własnego OAuth Figma. Implementacja OAuth MCP już istnieje; wymagane jest własne logowanie, nie przebudowa ani przejęcie poświadczeń Codex.

Podstawowa obsługa obrazów jest teraz w kodzie: narzędzia MCP Crossagents, native image capability Antigravity, blokowanie API, walidacja plików i preview inline. Ścieżka supervisora z procesem testowym oraz renderer Electron przeszły kontrolę. Rzeczywisty Google nadal wymaga logowania użytkownika. Ograniczenia, wersję magazynu zespołu 2 i dowody opisuje początek [stanu implementacji](implementation.md). Nie utożsamiać tego z działającym Pro ani ze zmianą zainstalowanego pakietu.

## Aktualizacja z 2026-10-07

Importer historii jest teraz wdrożony w ustawieniach wątków, z podglądem, addytywnym scalaniem, backupem i kopiowaniem załączników. Testy rzeczywistej SQLite i Electron przeszły. Obsługuje v41/v42, nie przejmuje ustawień kont ani nie nadpisuje istniejących wątków. Szczegóły i dowody są na początku [stanu implementacji](implementation.md). Zainstalowany pakiet pozostaje bez tej zmiany. Produkcyjnego importu użytkownika nie powtarzano.

Kolejka follow-upów jest zapisywana atomowo w profilu supervisora i odzyskiwana po restarcie jako wstrzymana. Rzeczywisty pakiet z Codex 0.160.1 zachował dwie wiadomości po SIGKILL aplikacji, a kliknięcie wznowienia przekazało obie w kolejności, bez duplikatów. Nowa aplikacja jest w `/Applications/Poracode Personal.app`, poprzednia w `.tmp/previous-install/queue-persistence/Poracode Personal.app`. Szczegóły, testy i granicę ponownego dostarczenia opisuje początek [stanu implementacji](implementation.md).

Na polecenie użytkownika poprawiono tożsamość Git: GitHub używa prywatnego e-maila, Bitbucket firmowego. Reguły `includeIf` wybierają ją według URL remote, a repozytorium ma dodatkowe lokalne ustawienie prywatnej tożsamości. Przepisano autora i commitera w pięciu opublikowanych commitach oraz jedenastu lokalnych checkpointach; drzewa plików i upstream pozostały identyczne. Zdalne `origin/main` i lokalne reflogi zostały sprawdzone. SSH uwierzytelnia GitHub jako `fraorzi`.

## Aktualizacja z 2026-10-06

Dodano edytor ról i puli modeli w ustawieniach Crossagents. Jest już w zainstalowanym pakiecie i DMG. Rzeczywisty test Codex 6.1 sol -> zapisana rola Claude Haiku potwierdził przekazanie instrukcji i automatyczną integrację. Szczegóły i dowody są na początku [stanu implementacji](implementation.md). Użytkownik zatwierdził zapis wcześniejszego kodu w repozytorium `fraorzi/orzi-code__fork` i zmianę nazwy folderu na `orzi-code__fork`.

Sprawdzono również zgłoszony HTTP 400 dla 6.1 sol. Oryginalny PoraCode nadal używał uruchomionego Codex 0.158.0 mimo aktualizacji symlinka do 0.160.1. Porównanie osobnych procesów odtworzyło błąd na 0.158.0 i poprawną odpowiedź na 0.160.1 z tym samym kontem ChatGPT Plus, `high` i Fast. W forku przeszły pierwsza tura, follow-up i wznowienie. Pełny restart oryginalnego PoraCode powinien uruchomić nowe CLI; nie zatrzymywano tej aplikacji ani jej wątków.

Sprawdzenie licencji źródeł i zależności opisuje [research](research.md#publiczne-repozytorium-i-licencje). Sam PoraCode pozwala na publiczny fork pod warunkami Apache-2.0. Nie utożsamiać tego z pełnym audytem dystrybucji DMG. Do źródeł dołączono OFL fontów Geist.

## Punkt zakończenia pracy

Zainstalowany końcowy pakiet: `/Applications/Poracode Personal.app`. DMG jest w `release/`. Aplikacja ma osobny profil `~/.poracode-personal`. Na polecenie użytkownika zaimportowano całą historię: 22 projekty i Stronę główną, 216 wątków, w tym 210 archiwalnych, oraz 16 plików załączników. Import sprawdzono w rzeczywistym pakiecie przed i po restarcie. Jest jednorazowy, bez synchronizacji późniejszych zmian starej aplikacji. Szczegóły są na początku stanu implementacji.

Nie ma modelowego zadania implementacyjnego do wznowienia. Sesje QA są zamykane po kontroli pakietu. Nowe dowody testu ról i Codex 6.1 sol są w `/private/tmp/poracode-sol61-smoke/`; poprzednie dowody pozostają w `.tmp/installed-smoke/`. Build, typecheck, lint, testy opisane w stanie implementacji i kontrola zainstalowanego pakietu przeszły. Nie uruchomiono całego test suite repozytorium.

Ostatnia kontrola rzeczywistej aplikacji potwierdziła:

- Codex deleguje do Claude Haiku, a wynik wykonawcy trafia automatycznie do projektu.
- Prompt Claude zapisuje diff jednego pliku z jego nazwą. Późniejsze edycje oraz pełny restart aplikacji nie zmieniają tego diffu. HEAD i indeks Git pozostają bez zmian.
- Codex pokazał 1 dodatkowy reset z ważnością 29.10.2026, 17:33 czasu Warszawy. To odczyt z czasu testu, nie stała wartość. Claude zwrócił ograniczenie `surface`, więc UI odsyła do strony dostawcy. Żadnego resetu nie zużyto.

Dowody i logi znajdują się w ignorowanym `.tmp/installed-smoke/` oraz `.tmp/final-*.log`. Szczegóły i nazwy plików podaje stan implementacji.

## Figma i ustawienia aktualizacji - 2026-10-06

Użytkownik podał plik i węzeł do porównania Figma. Rzeczywisty test chatu Codex w forku przeszedł: `get_metadata` i `get_screenshot` odczytały wskazany węzeł, a odpowiedź MCP zawierała blok `image/png`. W aktualnej konfiguracji wcześniejszy problem nie wystąpił. Działa natywne połączenie Figma z globalnego Codex, uwierzytelnione przez OAuth. Osobny, zarządzany przez aplikację MCP nie ma własnego OAuth i w próbie połączenia zwraca `auth-required`; nie jest to ta sama konfiguracja. Metadane testu i obraz są w `/private/tmp/poracode-figma-smoke/artifacts/figma-report.json` oraz `figma-mcp-image.png`. Nie modyfikowano projektu Figma ani produkcyjnych poświadczeń.

Dodano osobne ustawienie automatycznych aktualizacji na stronie każdego agenta. Wyłączenie jest wspólne dla profili danego dostawcy, ale niezależne dla osobnych serwerów ACP. Globalny przełącznik nadal ma pierwszeństwo. Zmiana jest w zainstalowanej aplikacji i DMG; kontrola odczytu po restarcie oraz rzeczywistego przełącznika przeszła. Szczegóły testów są w [stanie implementacji](implementation.md).

## Dalszy zakres

- Domyślne wysyłanie podczas pracy chatu używa widocznej, trwałej kolejki. Odzyskiwanie po awarii i wznowienie sprawdzono na rzeczywistym Codex. Szczegóły i granica ponownego dostarczenia są na początku stanu implementacji.
- Figma działa w chacie Codex na podanym przykładzie. Współdzielenie połączenia zarządzanego przez aplikację z pozostałymi dostawcami wymaga osobnego OAuth. Nie kopiuj tokenów z Codex do forka.
- Nazwane role i edytor puli modeli są wdrożone, sprawdzone także z rzeczywistymi modelami i przepakowane do zainstalowanej aplikacji. Szczegóły, testy i pozostały zakres podaje początek stanu implementacji.
- Dalsze pomysły oh-my-pi są opisane w propozycji ról. Nie wszystkie zostały wybrane do implementacji.
- Import historii użytkownika jest wykonany. Wykryte przy imporcie automatyczne kasowanie archiwum po 30 dniach zostało usunięte; pełną historię odtworzono ze snapshotu i sprawdzono po restarcie. Nie przywracaj tego kasowania. Brakuje ekranu importu/scalania, kanału publikacji aktualizacji samego forka, porządków w zachowanych worktree oraz odporności zespołu na restart. Pełne ograniczenia aktualizatorów i wspieranych platform są w stanie implementacji.
- Osobne ustawienia automatycznych aktualizacji są dodane. Przypięcie konkretnej wersji i rollback z planu nie są wdrożone. Brakuje pełnej kontroli rzeczywistych aktualizacji oraz sesji Gemini/Grok na subskrypcjach. Użytkownik otrzymał pytanie o dostęp do Groka; import całej historii został już zlecony i wykonany.

## Miejsca w kodzie

| Obszar                   | Punkt wejścia                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Delegowanie i integracja | `src/supervisor/crossagentMcp/TeamWorktreeService.ts`, `SubagentRunManager.ts`, `teamInstructions.ts`                           |
| Przełącznik zespołu      | `src/renderer/components/thread/ThreadDraftView.tsx`                                                                            |
| Diff promptu             | `src/renderer/state/fileCheckpointActions.ts`, `src/renderer/app.tsx`, `src/supervisor/git/checkpointService.ts`                |
| Widok diffu              | `src/renderer/components/thread/ChatPane/parts/PromptChanges.tsx`, `items/InlineDiffView.tsx`                                   |
| Dodatkowe resety         | `packages/agents-usage/src/collectors/{codex,claude}ResetCredits.ts`, `src/renderer/components/providers/UsageResetCredits.tsx` |
| Aktualizacje agentów     | `src/supervisor/runtime/agentUpdateCoordinator.ts`                                                                              |

Istotna poprawka diffu: końcowy rekord tury może powstać dopiero przy `thread-state`, nie tylko przy `turn.completed`. Zachowaj obsługę obu ścieżek i ochronę przed tworzeniem pozornych migawek przy otwieraniu historii. Natywne migawki mają `storageVersion: 2`; odczyt starszego formatu pozostaje obsługiwany.

## Lokalny build i QA

Systemowy Node był za stary. Lokalny toolchain jest ignorowany przez Git:

```sh
export PATH="$PWD/.tmp/toolchain/node-v24.10.0-darwin-arm64/bin:$PATH"
```

Skrypty sprawdzaj w `package.json`. Pakowanie i ograniczenia modułu computer-use opisuje sekcja odtwarzania buildu w stanie implementacji. Nie deklaruj pełnego buildu helpera ze źródeł: poprzedni pakiet używa zweryfikowanego, niezmienionego helpera z oryginalnej instalacji, ponieważ brakowało Rust.

Środowisko ustawia `ELECTRON_RUN_AS_NODE=1`; przy uruchamianiu aplikacji usuń tę zmienną. QA korzystało z macOS Launch Services w tle, własnego `PORACODE_BASE_DIR=$PWD/.tmp/installed-smoke` i lokalnego `PORACODE_CDP_PORT=54281`. `.tmp/installed-smoke/cdp.mjs` odczytuje renderer zainstalowanej aplikacji. Po restarcie odśwież `targets.json` z lokalnego `/json/list`. Nie przejmuj fokusu ani nie zatrzymuj oryginalnej aplikacji użytkownika.

Przy przekazaniu na inny komputer trzeba przenieść bieżące pliki robocze, także nieśledzone. Toolchain, materiały QA, pakiety i dane lokalnych kont nie są częścią Git; nowy agent powinien odtworzyć środowisko bez kopiowania tokenów do dokumentacji.
