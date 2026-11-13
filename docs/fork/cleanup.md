# Cleanup forka - 2026-11-11

Zakres wybrany przez użytkownika: desktop Electron, języki polski i angielski. Przegląd objął źródła, konfigurację, zależności, skrypty, natywne moduły, workflow GitHub, dokumentację i instrukcje agentów.

## Usunięte

- Aplikacja `src/mobile`, projekty iOS/Android, konfiguracja Capacitor oraz natywne mobilne mostki SSH i Live Activity. Desktopowe SSH pozostaje.
- Mobilne skrypty dev/build/pakowania, PWA/Vercel, trzy workflow publikacji mobilnej i publiczne zasoby PWA. Dźwięk powiadomień desktopu pozostaje.
- Serwowanie mobilnej aplikacji, manifestu i service workera przez desktop. API HTTP/WebSocket, headless host, relay i przekazywanie portów pozostają. CORS nie ma już wyjątków dla Capacitor/Ionic.
- Mobilne szuflady we wspólnych menu, gesty ich uchwytów, blokada viewportu i mobilna geometria listy modeli. Desktop używa wspólnego `MenuPopover`.
- 11 katalogów tłumaczeń. Języki UI i generowanych tekstów to `en`/`pl`; Lingui skanuje tylko renderer. Usunięte teksty są czyszczone z obu katalogów.
- Powielone instrukcje CODEX.md, upstreamowy CODEOWNERS oraz śledzony lokalny plik uprawnień Claude z cudzymi ścieżkami.

## Mniejszy kontekst i zakres kontroli

- AGENTS.md i obowiązkowy HANDOFF.md skrócono łącznie z 59 476 do około 6 700 bajtów. Historia pozostaje w `docs/fork/archive/` i jest czytana na żądanie.
- Stare plany z katalogu głównego i historyczna architektura PWA są w archiwum. Aktualny `docs/REMOTE_ARCHITECTURE.md` opisuje desktop.
- README opisuje fork i jego uruchamianie, bez skopiowanej strony promocyjnej upstreamu.
- Strona `website/` pozostaje osobnym projektem z własnym workspace i lockfile. Główna instalacja, lint i formatowanie desktopu jej nie obejmują. Formatowanie pomija też archiwalne dokumenty.
- Główny lockfile ma 1380 rekordów pakietów zamiast 1487. Wersje pozostałych bezpośrednich zależności nie zmieniły się.
- Plan smoke nie zleca mobilnego QA. Bramka połączeń zdalnych dotyczy desktopowego klienta.

## Zachowane świadomie

| Obszar                                                 | Powód                                                                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Wszyscy providerzy AI                                  | Brak wskazania, których użytkownik nie używa; ich usunięcie zmieniłoby funkcje desktopu.                                      |
| SSH, WSL, API zdalne, relay i serwer headless          | Są używane do pracy desktopowej i połączeń z innymi maszynami.                                                                |
| Mechanizmy zdalnego push i zgodność starych URL        | Współdzielona infrastruktura istniejących klientów; usunięcie frontendu nie wymaga zmiany protokołu lub kasowania ich danych. |
| Wspólne gesty dotykowe i responsywny CSS desktopu      | Obsługują również małe panele, dzielone okna i urządzenia wejściowe desktopu.                                                 |
| Strona marketingowa, branding, rozszerzenie Chrome     | Osobne zasoby lub funkcje desktopu. Strona jest odłączona od codziennych kontroli desktopu.                                   |
| macOS, Windows i Linux                                 | Użytkownik wybrał desktop, nie ograniczył go do jednego systemu.                                                              |
| LICENSE, NOTICE i licencje fontów/zależności           | Muszą pozostać z kodem i zasobami upstreamu.                                                                                  |
| Historia implementacji i dowody wcześniejszych decyzji | Archiwizacja ogranicza kontekst bez utraty informacji.                                                                        |

## Zgodność i stan roboczy

Normalizacja ustawień działa per pole. Test ze starymi `locale: "ja"` i `gitTextLanguage: "de"` potwierdza fallback do `system` i `en` oraz zachowanie pozostałych preferencji. PL/EN pozostają bez zmian. Schemat danych i payloady HTTP/WebSocket/SSH nie zmieniły się, więc nie podnoszono ich wersji. Wycofane endpointy PWA zwracają 404.

Indeks Git pozostaje niezmieniony. Istniejące zmiany robocze zachowano. Kopia śledzonych źródeł sprzed cleanupu, w tym zmodyfikowanych usuniętych katalogów tłumaczeń, jest w `.tmp/repo-cleanup/source-before.tar.gz`; osobno zapisano diff indeksu i worktree. Produkcyjnej aplikacji, profilu użytkownika i stagingu aktualizacji nie zmieniano.

## Weryfikacja

- Typecheck, oba linty zmienionych plików, format i build desktopu.
- 283 testy lokalizacji, menu, ustawień i composera oraz 114 testów serwera HTTP/WebSocket i kontrolera połączeń.
- Lingui PL/EN: 0 brakujących polskich tłumaczeń.
- Izolowany smoke Electron: 10/10 scenariuszy automatycznych i 11/11 bramek mock, 0 błędów console/runtime. Raport w `/private/tmp/orzi-repo-cleanup-final-20261111/artifacts/`. Przebieg nie testuje rzeczywistych kont providerów, urządzeń ani pełnej regresji repozytorium.

Logi i dokładne liczniki: `.tmp/repo-cleanup/`. Nie tworzono commitu, nie wykonywano push ani instalacji paczki w produkcyjnej aplikacji.
