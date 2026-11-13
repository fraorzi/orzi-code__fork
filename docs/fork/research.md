# Ustalenia techniczne

Data sprawdzenia: 2026-10-04. Kod analizowany statycznie, bez uruchamiania pobranej aplikacji.

## Widoczność i aktywacja dodatkowych resetów, 2026-11-11

- Zalogowana strona Claude pokazała 2 resety: Full do 2026-12-10 23:00 i Fable do 2026-11-17 08:59 Europe/Warsaw. To odczyt strony, nie stan wpisany na sztywno do kolektora. Nie wykorzystano żadnego resetu. [Instrukcja Anthropic](https://support.claude.com/en/articles/17007452-what-is-a-limit-reset) wymaga potwierdzenia i opisuje nieodwracalność; Fable jest resetem częściowym.
- Po odpowiedzi użytkownika "okej" ponowiono zatwierdzoną diagnostykę tokenu CLI i GET usage. Warianty `?cedar_ember=1&skip_spend=1` i `?at_wall=1&skip_spend=1` zwróciły HTTP 200, `ineligible_reason: surface`, bez ofert. Dowód bez credentials `.tmp/reset-activation-20261111/claude-oauth-probe.json`. Samo dodanie parametrów nie usuwa blokady tej powierzchni produktu.
- Osobne `GET https://api.anthropic.com/api/oauth/profile` najpierw odrzucił automatyczny przegląd uprawnień. Po wyraźnej zgodzie użytkownika wykonano odczyt: wyszukiwanie Keychain bez `-a` znalazło wygasły wpis, HTTP 401. Następnie standardowy `get_usage` Orzi zwrócił aktualny odczyt `ok` i `web-only`; sprawdzenie kodu wykazało, że produkcyjny resolver jawnie wybiera konto bieżącego użytkownika. Odczyt profilu z tego samego service i właściwego konta zwrócił HTTP 200 i poprawne `organization.uuid`. Dowód `.tmp/reset-activation-20261111/claude-profile-current-user.json` zapisuje tylko status, walidację oraz skrócony hash organizacji. Bez pełnego profilu, tokenów i zużycia resetu. Schemat profilu potwierdzono na żywo, porównanie z kontem web nadal wymaga zalogowanej sesji cookie.
- [Oficjalny App Server Codex](https://learn.chatgpt.com/docs/app-server#8-earned-rate-limit-resets-chatgpt) ma consume, a [źródło klienta OpenAI](https://github.com/openai/codex/blob/main/codex-rs/backend-client/src/client/rate_limit_resets.rs) potwierdza bezpośredni POST `/backend-api/wham/rate-limit-reset-credits/consume`, `redeem_request_id`, `credit_id`. Implementacja kolektora Orzi używa tego samego backendu co istniejący odczyt, bez uruchamiania sesji chatu. Rzeczywisty `get_usage` pokazał 2 kredyty; prawdziwego POST nie wywoływano.
- Referencja [oh-my-pi](https://github.com/can1357/oh-my-pi/blob/main/packages/ai/src/usage/claude-reset.ts) opisuje programy Cedar/Juniper, `organization.uuid` i webowy endpoint `reset_rate_limits`. Orzi ma niezależny parser Zod, consented cookie z istniejącego loginu oraz kontrolę identycznej organizacji przed mutacją. To obejście ograniczenia powierzchni OAuth, bez udawania innego klienta CLI. Dostęp przez Node do zalogowanego web API, ewentualna ochrona antybotowa i realna mutacja pozostają niepotwierdzone. W razie braku danych można otworzyć oficjalny ekran w przeglądarce wewnętrznej Orzi.
- Wdrożono kompaktowy sidebar i natywną aktywację, zamiast wcześniejszego wyłącznie linkowego widoku. Zakres testów, cache v6, ostatnie ograniczenie smoke live voice i podpisana lokalna paczka są na początku [stanu implementacji](implementation.md). Nie utożsamiać PASS fixture/IPC z potwierdzonym wykorzystaniem resetu na żywym koncie.

## Uzupełnienie: limit 5h Claude i poprawka T3 Code, 2026-11-06

To osobny wątek od `agent_summary` analizowanego 2026-11-01. W [zgłoszeniu T3 Code #24649](https://github.com/pingdotgg/t3code/issues/24649) porównano ten sam workload przez interaktywny CLI, SDK i `claude -p`. Autor zmierzył około 1,6-1,7 razy większy przyrost zużycia okna 5h przez SDK/headless, mimo podobnej liczby tokenów i działającego cache. To wynik określonego konta/modelu, a nie stały mnożnik dla wszystkich użytkowników. [Zgłoszenie upstream #97074](https://github.com/anthropics/claude-code/issues/97074) pozostaje otwarte; komentarze opisują również odmienne wyniki dla innych kont i sposobów pracy.

T3 Code scaliło 2026-11-02 [PR #28410](https://github.com/pingdotgg/t3code/pull/28410), commit [4d75fb8](https://github.com/pingdotgg/t3code/commit/4d75fb8). `mergeClaudeProcessEnvironment` domyślnie ustawia `CLAUDE_CODE_ENTRYPOINT=t3-code`, zastępując etykietę SDK lub odziedziczoną po aplikacji nadrzędnej. Jawne ustawienie instancji, a następnie `env` z `settings.json`, mają pierwszeństwo. Zmiana obejmuje tury, wykrywanie wersji/możliwości i generowanie tekstu. Zwykłe terminale zachowują własną identyfikację. PR zweryfikował lokalnym serwerem nagłówki i `cc_entrypoint` wysyłane przez CLI 2.1.316. Późniejszy komentarz w #24649 zgłasza porównywalne zużycie do TUI po zmianie, ale nie zastępuje pomiaru na koncie użytkownika. Wcześniejszy [PR #25597](https://github.com/pingdotgg/t3code/pull/25597) był zamknięty bez scalenia; nie należy go wskazywać jako wdrożonej poprawki.

W Orzi `src/supervisor/agents/claude/sdkSession.ts` ustawia `CLAUDE_AGENT_SDK_CLIENT_APP=poracode`, ale nie ustawia `CLAUDE_CODE_ENTRYPOINT`. Są to dwa różne parametry. Zainstalowany SDK 0.3.251 domyślnie wpisuje `sdk-ts`, jeśli entrypoint nie został przekazany. Odczyt źródeł i supervisora z `/Applications/Orzi Code.app` potwierdził brak jawnego entrypoint. Rekomendacja: analogiczna, jawna identyfikacja `orzi-code` w providerze Claude, dla GUI launch/resume, one-shotów oraz probe'ów. Uwzględnić nadpisania profili i WSL/Windows. Nie dopisywać tej wartości bezpośrednio do obecnego `CLAUDE_SESSION_ENV`, bo wspólna polityka obejmuje również interaktywny PTY. Nie używać etykiety `t3-code`, `cli` ani nazwy innego klienta.

Przed ogłoszeniem oszczędności trzeba porównać rzeczywisty przyrost limitu 5h przy stałym modelu/wysiłku i wyłączonym innym ruchu konta, zapisując liczbę tokenów oraz cache i faktyczny entrypoint. Odbiornik `scripts/claude-usage-audit.mjs` zapisuje liczniki API, ale sam nie mierzy wykorzystania limitu subskrypcji. Potrzebna jest dodatkowa obserwacja okna 5h, preferencyjnie z przypisanych do żądania `rate_limit_event`, z uwzględnieniem opóźnień odświeżania `/usage`. Testów zużywających limit w tym uzupełnieniu nie wykonywano.

Osobny problem cache po Stop opisuje [T3 Code #10955](https://github.com/pingdotgg/t3code/issues/10955). Orzi ma już `queryRuntime.interrupt()` w `interruptTurn()`, bez zamykania sesji w tej metodzie, więc nie należy kopiować naprawy zamykającej inny problem. Zmiana entrypoint nie rozwiązuje kosztów `agent_summary` i nie dotyczy automatycznie Claude uruchamianego przez Cursor/Antigravity ani pozostałych providerów.

Stan: zbadano i dodano do audytu; nie wdrożono zmiany runtime. Dowód lokalny: `.tmp/claude-usage-audit-20261106/entrypoint-evidence.json`. Wcześniejszy nierozstrzygający pomiar z 2026-11-01 pozostaje bez zmian.

## Baza i zakres sprawdzenia

- Oficjalne repozytorium: [Porabuild/Poracode](https://github.com/Porabuild/Poracode).
- Commit: `d71e5a1abb39755909e5d0e20c46b93d6825e114`, 2026-09-30, `fix(claude): send skills as literal slash commands (#790)`.
- `package.json`: wersja 1.8.1, Electron, React, TypeScript, pnpm 12.3.4, Node >= 24.10.0.
- Odczyt `poracode.get_app_info`: uruchomiona wersja 1.8.0 na macOS.
- Plan nie zakłada, że kod 1.8.1 i działająca wersja 1.8.0 zachowują się identycznie.

## Fakty wynikające z kodu

| Ustalenie                                                                             | Źródło w repozytorium                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Chat Codexa jest oparty na `app-server`                                               | `src/supervisor/agents/codex/argv.ts`, funkcja `buildCodexAppServerCommand`; `index.ts`, opis trybu GUI               |
| Claude używa Agent SDK                                                                | `src/supervisor/agents/claude/sdkSession.ts`, import `query` i konfiguracja sesji                                     |
| Gemini chat używa ACP                                                                 | `src/supervisor/agents/gemini/index.ts`, `createAcpStructuredSession` i argument `--acp`                              |
| Grok chat używa ACP                                                                   | `src/supervisor/agents/grok/index.ts`, `createAcpStructuredSession` i `agent stdio`                                   |
| Wątek ma projekt, stan archiwizacji i tryb prezentacji                                | `src/shared/contracts/thread.ts`, `threadSchema`                                                                      |
| Sidebar ma istniejący widok projektów                                                 | `src/renderer/views/MainView/parts/Sidebar/Sidebar.tsx`, `SidebarProjectThreadList` oraz wariant `flat`               |
| Linki preferują panel wewnętrzny                                                      | `src/main/ipc/localHandlers.ts`, handler `openExternal`                                                               |
| Jest otwieranie przeglądarki systemowej                                               | Ten sam plik, `openExternalNative`, wywołanie `shell.openExternal` po walidacji                                       |
| Markdown i terminal mają punkty podłączenia polityki linków                           | `src/renderer/utils/openExternal.ts`, `ItemMarkdownInner.tsx`, `ItemMarkdown.tsx`, `XTermSurface.tsx`                 |
| Antigravity ma odczyt quota summary i starszy fallback                                | `packages/agents-usage/src/collectors/antigravity.ts`, `antigravityQuotaSummaryWindows`, `antigravityPoolWindows`     |
| Antigravity próbuje lokalnego language servera i cloud fallback z poświadczeniami ACP | `src/supervisor/agents/antigravity/antigravityUsageScanner.ts`, `scanAntigravityUsage`                                |
| Proxy MCP nie jest bezwarunkowe                                                       | `src/supervisor/mcp/McpToolFilterService.ts`, `needsProxy`                                                            |
| Proxy obsługuje listowanie i wywołania narzędzi                                       | `src/supervisor/mcp/mcpToolFilterProxy.ts`; wynik wywołania jest przekazywany, lista narzędzi agregowana i filtrowana |
| Prywatny katalog Codexa dowiązuje wybrane pliki globalne                              | `src/supervisor/agents/codex/plugin/install.ts`, `CODEX_LINK_TARGETS`: sesje, indeks sesji, auth i config             |
| Wykrywanie pluginów korzysta z efektywnego katalogu Codexa                            | `src/supervisor/agents/codex/nativePlugins.ts`, `listNativeCodexPlugins`                                              |

## Figma: obserwacja i hipotezy

Odczyt konfiguracji przez `poracode.list_mcp_servers` pokazał wpis `figma`, transport HTTP, adres `https://mcp.figma.com/mcp`, `enabled: false`, `authenticated: false`. Nie zmieniano tego wpisu.

Jednocześnie w bieżącej sesji dostępne są narzędzia Figma pochodzące z integracji aplikacji. Lista narzędzi oraz lista ręcznie skonfigurowanych serwerów MCP nie są tym samym rejestrem. Nie wykonano testu konkretnego pliku Figma, więc nie potwierdzono pełnej sprawności ani awarii tych narzędzi.

Hipotezy do sprawdzenia, w kolejności:

1. Klienci korzystają z różnych integracji Figma lub innego stanu autoryzacji.
2. Różni się efektywna konfiguracja Codexa, pluginy, wersja runtime albo zaufanie do projektu.
3. Różni się plik/węzeł wejściowy, endpoint zdalny/desktopowy lub kontekst zaznaczenia.
4. Wynik obrazu lub zasobu jest zmieniany albo nieobsługiwany na jednej z granic integracji.
5. W konkretnej sesji działa proxy, które zmienia potrzebną funkcjonalność protokołu.

Nie ma jeszcze dowodu, że problem rozwiąże usunięcie warstwy PoraCode. Natywne połączenie Codexa z jego silnikiem już istnieje.

## Dokumentacja producentów

- [Codex App Server](https://learn.chatgpt.com/docs/app-server) opisuje integrację klienta z uwierzytelnianiem, historią, zgodami i strumieniem zdarzeń. Uzasadnia zachowanie `app-server`, ale nie dowodzi zgodności wszystkich funkcji z aplikacją Codex.
- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) opisuje globalną i projektową konfigurację MCP oraz serwery dostarczane przez pluginy. Przy porównaniu należy uwzględnić efektywny katalog konfiguracji uruchomionego procesu.
- [Claude Agent SDK a subskrypcja](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) zawiera aktualizację z 15 czerwca wstrzymującą opisaną niżej zmianę rozliczania. Według aktualizacji SDK i `claude -p` nadal korzystają z limitów subskrypcji. Nie należy czytać starszej części artykułu jako obowiązującego wdrożenia. Przed implementacją ponownie sprawdzić aktualny stan dla używanego konta.
- [Zdalny serwer Figma MCP](https://developers.figma.com/docs/figma-mcp-server/remote-server-installation/) dokumentuje endpoint oraz konfigurację klienta.
- [Narzędzia Figma MCP](https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts/) opisują odczyt kontekstu, screenshoty oraz różnice w kontekście zaznaczenia i parametrach klienta. Test musi używać konkretnego pliku/węzła i sprawdzać wynik narzędzia.

## Instalowana aplikacja i aktualizacje agentów

- `package.json` ma polecenia pakowania macOS `dist:mac` i `dist:mac:arm`. Wynik docelowy ma być testowany jako zainstalowana aplikacja, nie tylko przez `pnpm dev`.
- `src/supervisor/agents/updateAgent.ts` zawiera `runUpdateCommandWithFallback`; `src/shared/agents/updateResolver.ts` wybiera strategię aktualizacji. Kontrakt w `src/shared/contracts/agent.ts` uwzględnia aktualizatory wbudowane, npm, Homebrew, winget i instalatory producentów.
- `autoUpdateAcpRegistryAgents` w `src/supervisor/agents/acpRegistry.ts` pomija wpisy `first-class`. Samo istnienie tej funkcji nie dowodzi automatycznych aktualizacji wszystkich używanych agentów.
- `src/main/updates/autoUpdater.ts` dotyczy aplikacji Electron. Ustawia `autoDownload = false`, ale ma własną ścieżkę pobierania i ponawiania, opisaną jako automatyczna z perspektywy użytkownika. Sama ta flaga nie oznacza ręcznych aktualizacji. Tego mechanizmu nie należy utożsamiać z aktualizowaniem agentów.
- `src/supervisor/agents/claude/sdkSession.ts` importuje spakowany Agent SDK i przekazuje wykrytą ścieżkę programu Claude. Weryfikacja aktualizacji musi objąć obie wersje i działający chat.
- Nie sprawdzono jeszcze instalatorów używanych na komputerze użytkownika, ich uprawnień, dostępności rollbacku ani podpisywania pakietu. To zadania etapu implementacji.

## Czego jeszcze nie sprawdzono

- Rzeczywistej zgodności limitów Antigravity z kontem użytkownika.
- Odtworzenia zgłoszonego problemu Figma na jednym pliku i obu klientach.
- Pełnej macierzy funkcji chatu oraz terminala dla czterech agentów.
- Instalacji zależności, kompilacji, testów aplikacji i zachowania UI pobranego commita.
- Migracji istniejącej bazy użytkownika do osobnego katalogu forka.

Brak testu jest oznaczony jako brak testu, nie jako potwierdzenie działania.

## Dodatkowe resety, 2026-10-05

- [Anthropic: What is a limit reset?](https://support.claude.com/en/articles/17007452-what-is-a-limit-reset) opisuje dodatkowe resety oraz datę ważności pokazywaną na stronie zużycia.
- [oh-my-pi: odczyt resetów Claude](https://github.com/can1357/oh-my-pi/blob/main/packages/ai/src/usage/claude-reset.ts) dokumentuje pola `cedar_ember` i `juniper_tide` oraz odczyty z parametrami zapytania. Fork ma własny parser Zod i wyłącznie odczyt, bez ścieżki wykorzystania resetu.
- [CodexBar: źródła zużycia Claude](https://github.com/steipete/CodexBar/blob/main/docs/claude.md) rozróżnia dostęp przez stronę i OAuth.
- [QuotaRadar: opis dostawców](https://github.com/Asklear/QuotaRadar/blob/main/docs/providers.md) wskazuje osobny odczyt szczegółów resetów Codex.
- Kształt odpowiedzi `GET https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` i ograniczenie `surface` Claude zostały sprawdzone bezpośrednio na koncie użytkownika. Do logów nie zapisano tokenów uwierzytelnienia. Nie wywołano żadnego endpointu wykorzystującego reset.

## Publiczne repozytorium i licencje

Sprawdzono 2026-10-06 na lokalnym checkoutcie.

- `LICENSE` oraz główny `package.json` deklarują Apache-2.0. [Oficjalne warunki](https://www.apache.org/licenses/LICENSE-2.0) dopuszczają publiczny fork i redystrybucję. Wymagają zachowania licencji i informacji autorów, oznaczenia zmodyfikowanych plików oraz zachowania właściwych informacji `NOTICE`, jeżeli są częścią dystrybuowanego źródła. Licencja nie daje ogólnego prawa do znaków towarowych.
- Dołączone fonty Geist podlegają OFL-1.1. Dodano oficjalny tekst do `src/renderer/fonts/OFL.txt`, z [repozytorium fontu](https://github.com/vercel/geist-font/blob/main/OFL.txt). Fonty zachowują swoją licencję, niezależnie od Apache-2.0 kodu aplikacji.
- Metadane 528 zainstalowanych pakietów osiągalnych z zależności produkcyjnych odczytano lokalnie. Większość deklaruje MIT, Apache-2.0, ISC lub BSD. Surowe metadane są w ignorowanym `.tmp/production-license-metadata.json`. To inwentaryzacja, nie pełny audyt prawny wszystkich treści paczek. Nie obejmuje kompletnej analizy 35 niedostępnych zależności, głównie opcjonalnych pakietów innych platform, ani wszystkich transytywnych warunków bibliotek natywnych i zasobów pobieranych w czasie pracy.
- Claude Agent SDK 0.3.251 ma `SEE LICENSE IN README.md`; natywny pakiet ma `SEE LICENSE IN LICENSE.md`. [Licencja SDK](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/LICENSE.md) odsyła do warunków Anthropic, a natywny pakiet do umów opisanych w dokumentacji Claude Code. Nie traktować SDK ani dołączonego programu jako kodu Apache-2.0. Publiczny kod integracji oraz dystrybucja programu dostawcy to oddzielne przypadki.
- `@img/sharp-libvips-darwin-arm64` 1.3.2 deklaruje LGPL-3.0-or-later. Przy publikowaniu gotowego pakietu należy uwzględnić obowiązki dotyczące bibliotek natywnych i dołączonych informacji licencyjnych. Sama obecność tej zależności nie wymaga przeniesienia całego forka na LGPL.
- Lokalny `@poracode/codex-protocol` nie ma pola `license` w swoim `package.json`; jest częścią checkoutu objętego głównym `LICENSE`. Nie jest to osobny znaleziony pakiet bez znanego pochodzenia.
- Źródła można opublikować po spełnieniu warunków i kontroli zawartości. Nie publikować `.tmp`, danych kont, `node_modules`, gotowych programów dostawców ani DMG w ramach samego przenoszenia źródeł do kontroli wersji. Osobny audyt pakietu jest potrzebny przed publiczną dystrybucją wydania.
- Użytkownik zatwierdził publikację źródeł w `git@github.com:fraorzi/orzi-code__fork.git` 2026-10-06. Remote `origin` wskazuje własne repozytorium, a `upstream` zachowuje projekt oryginalny. Do kontroli wersji wystarczy także prywatne repozytorium.
