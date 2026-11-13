# Orzi Code - przekazanie

Osobisty fork Poracode. Zakres: desktop Electron, interfejs i generowany tekst PL/EN. Aplikacja mobilna, PWA, iOS/Android i ich publikacja zostały usunięte na polecenie użytkownika 2026-11-11. Nowe zmiany nie wymagają mobilnego QA ani tłumaczeń na inne języki.

## Zasady kontynuacji

- Zachowaj istniejące zmiany robocze i indeks. Commit/push wymagają osobnego polecenia użytkownika.
- Zachowaj historię użytkownika. Import historii jest wykonany; nie przywracaj automatycznego kasowania archiwum po 30 dniach.
- Zachowaj wszystkich providerów i funkcje desktopu, w tym SSH, WSL, przeglądarkę, computer-use, zespoły, zdalne połączenia desktopu i lokalne aktualizacje.
- Produkcyjna aplikacja i jej profil nie służą do QA. Używaj izolowanego profilu i portów. Instalacja przygotowanych paczek odbywa się zielonym przyciskiem po zakończeniu zadań.
- Nie deklaruj pełnego PASS: poprzednia pełna regresja miała błędy, a live voice i niektóre bramki composera pozostają niepotwierdzone. Żywa aktywacja resetu Claude przez konto web również wymaga weryfikacji.
- Start czatu: naprawiono spóźniony odczyt stanu Codex i kolejkę ACP podczas przygotowania prompta. Codex, Claude i Cursor: 10 promptów live, także po wznowieniu procesu, bez zawieszeń i błędów renderera. Pozostali providerzy mają tylko pokrycie automatyczne lub nie udostępniają Chat. Bieżąca podpisana paczka jest w stagingu, hash `27b11623d9cf5df1b6d421e29dee7fdeee2f9c33af0834032d7a51d12366d6ae`. Przycisk "Zaktualizuj i uruchom ponownie" potwierdzono w działającej aplikacji. Raport `.tmp/chat-start-update-package-report.json`.
- Claude dodatkowe resety: wcześniejszy odczyt IPC przez Chromium potwierdził 2 oferty. Najnowsza poprawka zmienia stary endpoint odnowienia OAuth na `platform.claude.com` i dodaje przerwę po 429. Ustawienia mają auto-refresh co 2 minuty, ale rzeczywisty wygasły token zwraca 401, a próba odnowienia nadal 429. Nie deklarować świeżego odczytu ani aktywacji resetu. Poprawka jest również w bieżącej paczce opisanej wyżej. Szczegóły i ograniczenia w implementation.md.

## Odczyt na żądanie

- Bieżąca funkcja lub paczka: wyszukaj odpowiednią sekcję w [implementation.md](implementation.md). Początek opisuje ostatnie prace nad resetami i portami lokalnymi.
- Decyzje i zewnętrzne ograniczenia: [research.md](research.md).
- Budowanie, staging i aktualizacje: [desktop-updates.md](desktop-updates.md) oraz sekcja odtwarzania buildu w implementation.md.
- Historia poprzednich sesji i dowody QA: [archiwalny handoff](archive/HANDOFF-2026-11-11.md). Czytaj tylko dla zadania, które tego wymaga.

## Środowisko lokalne

Systemowy Node może być za stary. Lokalny Node 24 jest w `.tmp/toolchain/node-v24.10.0-darwin-arm64/bin`. Używaj pnpm z wersji podanej w package.json. W tym środowisku pnpm 12 ma plik wykonywalny `pnpm-native`, a corepack może błędnie szukać `bin/pnpm.cjs`.

`ELECTRON_RUN_AS_NODE=1` trzeba usunąć ze środowiska uruchamianej aplikacji. Skrypty z `.agents/skills/interactive-testing` zarządzają izolowanym QA. Materiały tymczasowe i kopia stanu sprzed cleanupu są pod `.tmp/`.
