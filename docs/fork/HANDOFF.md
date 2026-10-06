# Przekazanie osobistego forka PoraCode

Stan na 2026-10-06. Kontynuuj w `/Users/franciszek/WebstormProjects/orzi-code__fork`.

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
- Commity i push wymagają polecenia użytkownika. Polecenie z 2026-10-06 upoważnia do publikacji bieżącego kodu w podanym repozytorium. Odpowiedzi po polsku, zwięzłe, wyłącznie ASCII hyphen-minus zamiast długich myślników.

## Aktualizacja z 2026-10-06

Dodano edytor ról i puli modeli w ustawieniach Crossagents. Przeczytaj pierwszą sekcję [stanu implementacji](implementation.md): bieżący kod ma więcej funkcji niż zainstalowany pakiet. Sesja QA ról została zamknięta po testach. Użytkownik zatwierdził zapis bieżącego kodu w repozytorium `fraorzi/orzi-code__fork` i zmianę nazwy folderu na `orzi-code__fork`.

Sprawdzenie licencji źródeł i zależności opisuje [research](research.md#publiczne-repozytorium-i-licencje). Sam PoraCode pozwala na publiczny fork pod warunkami Apache-2.0. Nie utożsamiać tego z pełnym audytem dystrybucji DMG. Do źródeł dołączono OFL fontów Geist.

## Punkt zakończenia pracy

Zainstalowany końcowy pakiet: `/Applications/Poracode Personal.app`. DMG jest w `release/`. Aplikacja ma osobny profil `~/.poracode-personal`; historia oryginalnego PoraCode nie została zaimportowana.

Nie ma uruchomionego przez poprzedniego agenta zadania implementacyjnego ani modelowego testu do wznowienia. Testowy fork został zamknięty. Build, typecheck, lint, testy opisane w stanie implementacji i kontrola zainstalowanego pakietu przeszły. Nie uruchomiono całego test suite repozytorium.

Ostatnia kontrola rzeczywistej aplikacji potwierdziła:

- Codex deleguje do Claude Haiku, a wynik wykonawcy trafia automatycznie do projektu.
- Prompt Claude zapisuje diff jednego pliku z jego nazwą. Późniejsze edycje oraz pełny restart aplikacji nie zmieniają tego diffu. HEAD i indeks Git pozostają bez zmian.
- Codex pokazał 1 dodatkowy reset z ważnością 29.10.2026, 17:33 czasu Warszawy. To odczyt z czasu testu, nie stała wartość. Claude zwrócił ograniczenie `surface`, więc UI odsyła do strony dostawcy. Żadnego resetu nie zużyto.

Dowody i logi znajdują się w ignorowanym `.tmp/installed-smoke/` oraz `.tmp/final-*.log`. Szczegóły i nazwy plików podaje stan implementacji.

## Dalszy zakres

- Figma MCP: nadal potrzebny konkretny plik lub węzeł, który działa w aplikacji Codex, a nie działa w forku. Porównaj konfigurację, autoryzację i rzeczywiste odpowiedzi narzędzi. Nie potwierdzono jeszcze przyczyny ani naprawy.
- Nazwane role i edytor puli modeli są wdrożone w bieżącym kodzie i sprawdzone w izolowanym Electronie. Jeszcze nie przepakowano zainstalowanej aplikacji. Szczegóły, testy i pozostały zakres podaje początek stanu implementacji.
- Dalsze pomysły oh-my-pi są opisane w propozycji ról. Nie wszystkie zostały wybrane do implementacji.
- Import historii, kanał publikacji aktualizacji samego forka, porządki w zachowanych worktree oraz odporność zespołu na restart pozostają do zrobienia. Pełne ograniczenia aktualizatorów i wspieranych platform są w stanie implementacji.

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
