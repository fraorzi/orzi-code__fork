# Aktualizacje aplikacji Orzi Code

Pakiet wskazuje jawnie publiczne wydania GitHub `fraorzi/orzi-code__fork`. Nie wyprowadza adresu z remote upstream ani z metadanych oryginalnego projektu. Stable używa `latest`, Nightly używa `nightly`, a updater nie dopuszcza downgrade. Wydania nie są publikowane podczas zwykłego pushowania kodu.

## Przygotowanie wydania

1. Dodaj wpis wybranej wersji do `docs/fork/changelog.json`. Changelog forka jest osobny od upstreamu. Aplikacja odczytuje go z gałęzi `main`; wcześniejsze cache upstreamu są ignorowane, a preferencje przeczytania i ukrywania pozostają zachowane.
2. Skonfiguruj sekrety repozytorium `MAC_CSC_LINK` (certyfikat Developer ID Application w P12), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` i `APPLE_TEAM_ID`. Nie zapisuj ich w kodzie, changelogu ani raportach QA.
3. Po osobnej decyzji o wydaniu uruchom workflow `Release (stable)` z jawną wersją lub `Release (nightly)`. Oba biorą źródło z `main`. `dry_run` nie buduje ani nie publikuje. Stable wymaga wpisu changelogu i nie przyjmuje istniejącego taga.
4. Workflow buduje wszystkie platformy. macOS używa `--release-signing`, wymaga certyfikatu i notarizacji, potem weryfikuje podpisy aplikacji, helpera i zawartości ZIP. Brak sekretów zatrzymuje ten runner przed instalacją zależności. Lokalne pakowanie bez flagi używa stałego certyfikatu osobistego, gdy jest skonfigurowany; bez niego pozostaje ad hoc.
5. Artefakty i manifesty są najpierw przesyłane do draftu z nie-semverowym tagiem. Dopiero kompletny draft jest atomowo przemianowany i opublikowany. Sprzątanie nie usuwa finalnego, opublikowanego taga.

macOS potrzebuje podpisu dla aktualizacji przez Squirrel.Mac, a ZIP i DMG są wymagane przez [electron-builder 26](https://www.electron.build/v26/docs/features/auto-update/). Pierwszy podpisany Orzi Code należy zainstalować ręcznie i sprawdzić aktualizację do kolejnego pakietu z tym samym Developer ID. Nie zakładaj automatycznego przejścia ze starego ad-hoc `Poracode Personal.app`, ani poprawnej migracji nazwy zewnętrznego bundle. Profil `.poracode-personal`, bundle ID oraz techniczna nazwa Electron dla Keychain pozostają zachowane.

## Lokalna kontrola

W dev updater pozostaje wyłączony. `UPDATE_SERVER_URL` jawnie przełącza go na serwer lokalnego QA. W zwykłym pakiecie updater czyta `app-update.yml` generowane z konfiguracji GitHub, bez wymaganego adresu w środowisku.

Nie ma jeszcze opublikowanego podpisanego wydania forka ani potwierdzonej aktualizacji macOS od początku do końca. Changelog forka pozostaje pusty do przygotowania rzeczywistego wydania. Testy lokalnego HTTP potwierdzają algorytm wykrywania kanałów, checksum i odmowę downgrade, ale nie zastępują instalacji przez Squirrel.Mac, podpisywania, notarizacji lub uruchomienia workflow GitHub.

## Lokalne buildy i przycisk aktualizacji

To osobna ścieżka od publikacji wydań GitHub. Nie wymaga podnoszenia semver ani DMG. Użytkownik nie uruchamia komend w Terminalu: agent przygotowuje zweryfikowany build, a aplikacja pokazuje zielony przycisk aktualizacji na górze panelu bocznego z tooltipem "Zaktualizuj i uruchom ponownie". Przy zwiniętym panelu jest na górze raila. Jest widoczny tylko dla gotowej aktualizacji. Ustawienia > O aplikacji pozostają drugą ścieżką instalacji. Toast informuje tylko o błędach.

1. Na tym komputerze stały certyfikat jest już skonfigurowany przez `scripts/setup-local-signing.py`. Zachowaj `.tmp/local-signing/` w prywatnej kopii bezpieczeństwa; nie commituj ani nie drukuj klucza i hasła. Nowy komputer wymaga świadomego odtworzenia tożsamości lub jednorazowej nowej zgody Keychain. Certyfikat jest osobisty, nie Developer ID i nie notarizacja.
2. Po zmianach agent wykonuje odpowiednie testy, typecheck, lint, lokalizację i kontrolę UI. Dopiero zweryfikowany kod przygotowuje przez `pnpm run update:local` z lokalnym Node 24.10.0. Ten skrypt buduje macOS ARM64, podpisuje, weryfikuje helpery i staginguje bundle do `~/.poracode-personal/local-updates/`. Build wymaga internetu do zależności i fontów. Nie kończ zadania samym wklejeniem użytkownikowi komendy.
3. Gdy pakiet jest już zbudowany i sprawdzony, `node scripts/stage-local-update.mjs "<Orzi Code.app>" [profil]` przygotowuje go bez ponownego buildu. Manifest v1 zawiera tożsamość, hash i ścieżkę stagingu. Ścieżkę instalacji bierze wyłącznie działająca aplikacja, nie manifest. `app.asar` czyta przez `original-fs`, aby Electron nie interpretował go jako katalogu.
4. Nowy updater wykrywa build co 3 s. Kliknięcie odmawia instalacji przy aktywnych zadaniach lub uszkodzonej paczce. Native installer czeka na zamknięcie procesów, kopiuje profil oraz poprzedni bundle do `local-updates/backups/`, podmienia bundle i uruchamia nową aplikację. Potwierdzeniem jest pasujący hash w `started.json`; bez niego po 60 s przywraca bundle i profil. Wynik i log są w `result.json` i `install.log`. Nie czyść backupów automatycznie.
5. Stara instalacja nie ma tego kodu. Pierwsza aktualizacja używa przygotowanego `Zaktualizuj Orzi Code.app` z `.tmp/local-update-launcher/`. Użytkownik zamyka aplikację i otwiera ten launcher w Finderze, potem klika „Instaluj”. Launcher jest tworzony przez `scripts/create-local-update-launcher.mjs` dla konkretnego sprawdzonego manifestu. Nie wymaga terminalowej komendy ani zgody Apple Events na zamykanie innej aplikacji. Po tej pierwszej aktualizacji kolejne działają przez zielony przycisk u góry. Wcześniejszy build z updaterem może jeszcze pokazywać toast; ten pakiet można zainstalować przez niego albo przez O aplikacji.

Sprawdzenie końcowe na izolowanej pełnej paczce Electron: `/private/tmp/orzi-local-update-electron/report.json` potwierdza kliknięcie toastu, podmianę różnych buildów 1.8.1, backup, restart i zachowanie profilu. Testy Python obejmują odmowę błędnego hasha i rollback profilu po nieudanym starcie. Produkcyjna instalacja nie jest zamykana przez agenta. Pierwszy start z nowym certyfikatem może jeszcze wymagać jednorazowej zgody Keychain; dialogów użytkownika nie automatyzowano.
