# Ustalenia techniczne

Data sprawdzenia: 2026-10-04. Kod analizowany statycznie, bez uruchamiania pobranej aplikacji.

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
