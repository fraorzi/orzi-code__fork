# Przekazanie Orzi Code

Stan na 2026-10-12. Kontynuuj w `/Users/franciszek/WebstormProjects/orzi-code__fork`.

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

## Figma MCP - natywne połączenia agentów, 2026-10-12

Użytkownik wybrał sprawdzenie połączeń Claude, Codex i Cursor przed instalacją Figma Desktop. Natywne połączenia działają bez dodatkowej aplikacji. MCP należy do runtime agenta: Grok uruchamiany przez Cursor korzysta z MCP Cursor, natomiast model Claude uruchamiany przez Antigravity nie dziedziczy połączeń Claude Code.

- Claude Desktop jest zalogowany na konto Pro; Claude Code 2.1.296 również ma aktywne konto subskrypcyjne. Istniejący plugin `plugin:figma:figma` wymagał autoryzacji. Oficjalne `claude mcp login plugin:figma:figma --no-browser` zakończyło się po zgodzie w przeglądarce. `claude mcp list` potwierdziło `Connected`. Osobny test Claude Agent SDK, z `settingSources: ["user", "project", "local"]` i identyfikatorem klienta używanym przez Orzi, potwierdził `connected` i 41 narzędzi bez wysyłania promptu. Dowód: `.tmp/figma-claude-native-status.json`. [Claude Code obsługuje też konektory konta claude.ai w sesjach CLI i SDK](https://code.claude.com/docs/en/mcp#use-mcp-servers-from-claudeai); lokalny plugin może mieć pierwszeństwo przed konektorem wskazującym ten sam URL.
- Codex zachował swoje dotychczasowe połączenie. Ponowny rzeczywisty odczyt `get_metadata` wskazanego węzła zwrócił ramkę projektu. Wcześniejszy test pełnego chatu Orzi i obrazu pozostaje opisany niżej.
- Cursor ma globalny wpis `figma` w `~/.cursor/mcp.json`. Oficjalne `agent mcp login figma` zakończyło się zgodą w przeglądarce, a `agent mcp list-tools figma` zwróciło 42 narzędzia. [CLI używa konfiguracji MCP edytora](https://cursor.com/docs/cli/mcp). Kod Orzi deklaruje dla SDK `local.settingSources: ["all"]`; [dokumentacja SDK opisuje wczytywanie MCP użytkownika i ponowne użycie istniejącego logowania](https://cursor.com/docs/sdk/typescript). Nie uruchamiano osobnej rozmowy Grok ani odczytu projektu przez Cursor SDK, więc nie raportować takiego testu jako PASS.

Globalny, zarządzany przez Orzi wpis `figma` jest teraz **wyłączony**, co potwierdzono ponownym odczytem ustawień. Jego własny OAuth zwraca `Dynamic Client Registration rejected (HTTP 403): Forbidden`, ponieważ [Figma dopuszcza zdalne MCP tylko dla klientów z zatwierdzonego katalogu](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/). Natywne połączenia zachowują poświadczenia we własnych klientach; nie kopiowano tokenów między aplikacjami. Uruchomione wątki zachowują poprzedni zestaw MCP do następnego launchu. Nie instalowano Figma Desktop i nie przebudowywano aplikacji.

Dla runtime bez działającego natywnego klienta pozostaje opcjonalny [oficjalny serwer Figma Desktop](https://developers.figma.com/docs/figma-mcp-server/local-server-installation/) pod `http://127.0.0.1:3845/mcp`. To osobna ścieżka wspólnego MCP, nie warunek korzystania z powyższych połączeń.

## Aktualizacja z 2026-10-12

Wdrożono bieżącą listę: szybsze limity, przekazywanie zgody wbudowanego Computer Use, współdzielone i szyfrowane poświadczenia Gemini ACP, stały lokalny podpis, pointer na akcjach, okrągłe przyciski oraz lokalny updater z trwałym toastem, backupem i rollbackiem. Użytkownik wykluczył Fast / Szybki dla wszystkich modeli, także w starych zapisach; ta decyzja zastępuje wcześniejszą. Szczegóły, granice zgodności i dowody są na początku [stanu implementacji](implementation.md).

Aktualizacja z toastu przeszła na pełnej paczce Electron w izolowanym profilu: kliknięcie, backup, podmiana paczki z tą samą wersją 1.8.1, ponowny start i zachowanie profilu. Produkcyjna aplikacja nadal działa ze starszego bundle. Pierwsze przejście: użytkownik kończy zadania, zamyka Orzi Code i otwiera `.tmp/local-update-launcher/Zaktualizuj Orzi Code.app`. Agent już przygotowuje zweryfikowaną paczkę w profilu. Kolejne zmiany: po testach agent uruchamia `pnpm run update:local`; użytkownik otrzymuje toast. Nie podmieniać bundle podczas aktywnych sesji. Zachować prywatny `.tmp/local-signing/`, ponieważ utrata certyfikatu zmienia tożsamość Keychain.

Pełny smoke ma trzy wcześniejsze porażki, identyczne na bazie `eb7bca5b`; nie deklarować pełnego PASS. Nie testowano produkcyjnych dialogów Keychain ani osobnej rzeczywistej rozmowy Codex z Computer Use. Oryginalny Poracode nie jest zależnością forka i nie został odinstalowany. Szczegóły są w stanie implementacji oraz [workflow aktualizacji](desktop-updates.md).

## Aktualizacja z 2026-10-11

Naprawiono niewidoczne modele Claude z Antigravity po logowaniu CLI. Dropdown nowego wątku obejmuje dostępne tryby dostawcy i automatycznie przełącza na właściwy runtime. Sonnet 5.5 odpowiedział w realnym PTY uruchomionym z menu Electron; gotowy pakiet zachował wybór po restarcie QA. Aktualny pakiet jest w `/Applications/Orzi Code.app`, a obie pozycje Claude z Antigravity dodano do dotychczasowych ulubionych użytkownika. Poprzedni bundle i profil są w `.tmp/previous-install/antigravity-picker/20261011-194125/`. Chat ACP ma osobny katalog Gemini. Testy, build i końcowy smoke przeszły; szczegóły są na początku [stanu implementacji](implementation.md). [Wymagania redesignu](redesign-requirements.md) uzupełniono o rozdzielenie obszarów UI, ikony Cursora, wspólne archiwum z podfolderami projektów, sidebar tylko z niearchiwizowanymi chatami, firmowe kolory logotypów i zwijanie limitów. Te zmiany wizualne są zapisane do późniejszego wdrożenia.

Wieczorem 2026-10-11 przygotowano [podgląd HTML redesignu](design-preview/index.html). Użytkownik wybrał czystą czerń z wyraźniejszymi obrysami, wyłączenie vibrancy, wysiłek High i Fast w dropdownie modelu oraz rezygnację z jasnego motywu. Decyzje są w [wymaganiach redesignu](redesign-requirements.md#podgląd-html-i-decyzje-z-2026-10-11). Drugi podgląd, [chat GUI i zmiany promptu](design-preview/chat.html) (2026-10-12), pokazuje warianty composera i stylu odpowiedzi oraz cofanie zmian jednego promptu. Użytkownik wybrał composer B i odpowiedź A, domyślny Chat i High; wdrożenie opisuje początek [stanu implementacji](implementation.md). Instalacja pakietu wymaga zamknięcia Orzi Code przez użytkownika i uruchomienia `python3 .tmp/install-redesign.py` w zwykłym Terminalu, bo sesja agenta działa wewnątrz aplikacji. Pierwszy podgląd wdrożono tego samego wieczoru w sześciu commitach; szczegóły, pominięte elementy i stan testów są na początku [stanu implementacji](implementation.md). Zainstalowany pakiet nie zawiera jeszcze redesignu.

Naprawiono brak Orzi Code w Spotlight przez instalację sprawdzonego pakietu `6a18c3f3` jako `/Applications/Orzi Code.app`. Poprzedni `/Applications/Poracode Personal.app` oraz kopia profilu są w `.tmp/previous-install/spotlight/20261011-162622/`. Fork był zamknięty; oryginalny `/Applications/Poracode.app` i jego procesy pozostały bez zmian. Podpis i SHA-256 `app.asar` sprawdzono przed podmianą. Po rejestracji Launch Services i `mdimport` metadane oraz `mdfind` zwróciły właściwą nazwę i ścieżkę. Próba kontroli okna Spotlight przez Computer Use zakończyła się timeoutem; nie deklarować testu UI ani uruchomienia nowego pakietu na produkcyjnym profilu. Docelowa ścieżka forka jest teraz `/Applications/Orzi Code.app`; wcześniejsze wpisy o instalacji Poracode Personal opisują historię.

Claude Cloud jest odłożone do decyzji użytkownika. Przed implementacją przełącznika Lokalnie / Chmura przeczytać [ograniczenia konta i otwartą decyzję](claude-cloud.md). Rzeczywisty test potwierdził tworzenie zadania i wysyłanie wiadomości, ale konto odrzuca podłączanie i strumień chatu. Użytkownik polecił kontynuować pozostałe funkcje; fallback otwierający oficjalny Claude nie został zaakceptowany.

Użytkownik polecił kontynuować, poprosił o listę prac przed pełną gotowością oraz wyjaśnienie korzystania z aplikacji podczas edycji jej źródeł. [Gotowość desktopu](readiness.md) rozróżnia źródła, starszą instalację i zależności od kont/podpisywania. Edycja checkoutu nie przeładowuje zainstalowanego pakietu. Podmiana pakietu wymaga zamknięcia aplikacji; QA używa osobnych profili.

Wdrożono zarządzane kompletne instalacje npm, pin i rollback dla deklarującego tę możliwość Codex na macOS/Linux. Zmiana wersji jest blokowana przez istniejący koordynator aktywnych sesji i launchów. GUI/PTY oraz wykrywanie używają wspólnej ścieżki. Test realnych pakietów 0.160.1 i 0.160.0, rollback i ponowny start tego samego profilu QA przeszły. Naprawiono ujawnioną kolejność inicjalizacji oraz cache po przerwanej aktywacji. Nie mylić tego z obsługą wszystkich dostawców, SDK ani WSL/Windows. Szczegóły i wersje magazynów są na początku [stanu implementacji](implementation.md).

Nowy lokalny DMG macOS ARM64 z kodem `6a18c3f3` jest w `.tmp/orzi-ready-20261011/Orzi-Code-1.8.1-arm64.dmg`. Rzeczywisty pakiet przeszedł start bez dev servera, rozmowę Codex 6.1 Sol na ChatGPT Plus z obrazem, follow-up oraz wznowienie tej samej sesji po restarcie. Pin 0.160.1, ulubiony model i historia przetrwały restart. Procesy QA są zamknięte. Szczegóły podpisu ad hoc, helpera i dowodów są na początku [stanu implementacji](implementation.md). Nie podmieniano `/Applications/Poracode Personal.app` ani jego profilu. Przed podmianą zakończyć aktywne zadania; nie uruchamiać dwóch pakietów równocześnie na profilu produkcyjnym.

`agy models` ponownie sprawdzono 2026-10-11. Nadal wymaga logowania. Produkcyjnego konta/CLI ani profilu użytkownika nie zmieniano. Kontynuować deklaracje i weryfikację zarządzanych wersji pozostałych dostawców, testy kont oraz instalację nowego pakietu desktopu. Publikacja podpisanego wydania pozostaje osobną decyzją.

## Aktualizacja z 2026-10-09

Użytkownik zlecił kontynuację całej pozostałej listy oraz generowanie i edycję obrazów Google na istniejącej subskrypcji Gemini. Płatne API jest wykluczone. Oficjalna ścieżka Antigravity ma natywne `generate_image`; bieżąca dokumentacja deklaruje Nano Banana 2 bez wyboru modelu obrazu, więc nie obiecuj Nano Banana Pro przez CLI. `agy models` zgłasza brak logowania. Użytkownik otrzymał prośbę o zalogowanie przez `agy`; nie kopiuj ani nie drukuj tokenów. Pytanie o Groka nie otrzymało odpowiedzi.

Użytkownik ustalił docelową nazwę Orzi Code i polecił zapisać [wymagania redesignu](redesign-requirements.md): pełny branding z ikoną/logo, kolorystyka, ikony i flow na podstawie rzeczywistych widoków Cursora, większe zdjęcia w inpucie oraz dropdown tylko z ulubionymi w kolumnach według subskrypcji. Pozostałe modele mają być dostępne przez opcję z plusem. Większe obrazy w inpucie oraz dropdown ulubionych z kolumnami kont i katalogiem pod plusem są już wdrożone i sprawdzone w Electron. Branding Orzi Code, własne ikony i neutralny motyw bazowy są także wdrożone. Zachowano stare identyfikatory danych i nazwę techniczną Electron dla Keychain. Referencję pustego widoku Cursor Agents obejrzano przez narzędzie UI; zasady zapisano w [DESIGN.md](../../DESIGN.md).

W bieżącym kodzie są trwałe zadania zespołu, jawne wznowienie zachowanego worktree, odzyskiwanie integracji i ekran sprzątania w ustawieniach Crossagents. Deterministyczne testy Git i smoke Electron przeszły. Naprawiono też ujawnione przez testy zamykanie paneli podczas pracy w tle. Szczegóły i granice zgodności opisuje początek [stanu implementacji](implementation.md). Te zmiany nie są jeszcze w zainstalowanym pakiecie.

Pozostały zakres obejmuje rzeczywiste obrazy na subskrypcji, publikację i test podpisanych aktualizacji forka, wersje agentów/rollback oraz rzeczywiste testy kont Google/Grok i własnego OAuth Figma. Implementacja OAuth MCP już istnieje; wymagane jest własne logowanie, nie przebudowa ani przejęcie poświadczeń Codex.

Podstawowa obsługa obrazów jest teraz w kodzie: narzędzia MCP Crossagents, native image capability Antigravity, blokowanie API, walidacja plików i preview inline. Ścieżka supervisora z procesem testowym oraz renderer Electron przeszły kontrolę. Rzeczywisty Google nadal wymaga logowania użytkownika. Ograniczenia, wersję magazynu zespołu 2 i dowody opisuje początek [stanu implementacji](implementation.md). Nie utożsamiać tego z działającym Pro ani ze zmianą zainstalowanego pakietu.

Branding i pełny smoke są opisane na początku [stanu implementacji](implementation.md). Pełny smoke mock oraz osobna kontrola po polsku w jasnym/ciemnym motywie przeszły. Zainstalowany pakiet nadal jest starszy. Aktualny kod został sprawdzony bez publikacji wydania. `agy models` na prawdziwym profilu nadal wymaga logowania, z CLI 1.3.2. Kanał GitHub forka oraz ręczne workflow wydań są przygotowane, bez uruchomienia publikacji. Brakuje podpisanego wydania macOS i jego rzeczywistej aktualizacji. Zasady i sekrety opisuje [kanał desktopu](desktop-updates.md). Następny niezależny moduł to wersje agentów/rollback.

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
- Figma: aktualny stan natywnych połączeń i opcjonalnej wspólnej ścieżki jest w sekcji na początku tego dokumentu.
- Nazwane role i edytor puli modeli są wdrożone, sprawdzone także z rzeczywistymi modelami i przepakowane do zainstalowanej aplikacji. Szczegóły, testy i pozostały zakres podaje początek stanu implementacji.
- Dalsze pomysły oh-my-pi są opisane w propozycji ról. Nie wszystkie zostały wybrane do implementacji.
- Import historii użytkownika jest wykonany. Wykryte przy imporcie automatyczne kasowanie archiwum po 30 dniach zostało usunięte; pełną historię odtworzono ze snapshotu i sprawdzono po restarcie. Nie przywracaj tego kasowania. Ekran importu/scalania, porządki w zachowanych worktree oraz jawne odzyskiwanie zespołu po restarcie są już w kodzie. Kanał publikacji forka jest przygotowany, ale podpisane wydanie i test jego instalacji pozostają do wykonania. Pełne ograniczenia aktualizatorów i wspieranych platform są w stanie implementacji.
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
