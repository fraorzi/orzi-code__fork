# Aktualizacje aplikacji Orzi Code

Pakiet wskazuje jawnie publiczne wydania GitHub `fraorzi/orzi-code__fork`. Nie wyprowadza adresu z remote upstream ani z metadanych oryginalnego projektu. Stable używa `latest`, Nightly używa `nightly`, a updater nie dopuszcza downgrade. Wydania nie są publikowane podczas zwykłego pushowania kodu.

## Przygotowanie wydania

1. Dodaj wpis wybranej wersji do `docs/fork/changelog.json`. Changelog forka jest osobny od upstreamu. Aplikacja odczytuje go z gałęzi `main`; wcześniejsze cache upstreamu są ignorowane, a preferencje przeczytania i ukrywania pozostają zachowane.
2. Skonfiguruj sekrety repozytorium `MAC_CSC_LINK` (certyfikat Developer ID Application w P12), `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` i `APPLE_TEAM_ID`. Nie zapisuj ich w kodzie, changelogu ani raportach QA.
3. Po osobnej decyzji o wydaniu uruchom workflow `Release (stable)` z jawną wersją lub `Release (nightly)`. Oba biorą źródło z `main`. `dry_run` nie buduje ani nie publikuje. Stable wymaga wpisu changelogu i nie przyjmuje istniejącego taga.
4. Workflow buduje wszystkie platformy. macOS używa `--release-signing`, wymaga certyfikatu i notarizacji, potem weryfikuje podpisy aplikacji, helpera i zawartości ZIP. Brak sekretów zatrzymuje ten runner przed instalacją zależności. Lokalne pakowanie bez flagi nadal używa podpisu ad-hoc.
5. Artefakty i manifesty są najpierw przesyłane do draftu z nie-semverowym tagiem. Dopiero kompletny draft jest atomowo przemianowany i opublikowany. Sprzątanie nie usuwa finalnego, opublikowanego taga.

macOS potrzebuje podpisu dla aktualizacji przez Squirrel.Mac, a ZIP i DMG są wymagane przez [electron-builder 26](https://www.electron.build/v26/docs/features/auto-update/). Pierwszy podpisany Orzi Code należy zainstalować ręcznie i sprawdzić aktualizację do kolejnego pakietu z tym samym Developer ID. Nie zakładaj automatycznego przejścia ze starego ad-hoc `Poracode Personal.app`, ani poprawnej migracji nazwy zewnętrznego bundle. Profil `.poracode-personal`, bundle ID oraz techniczna nazwa Electron dla Keychain pozostają zachowane.

## Lokalna kontrola

W dev updater pozostaje wyłączony. `UPDATE_SERVER_URL` jawnie przełącza go na serwer lokalnego QA. W zwykłym pakiecie updater czyta `app-update.yml` generowane z konfiguracji GitHub, bez wymaganego adresu w środowisku.

Nie ma jeszcze opublikowanego podpisanego wydania forka ani potwierdzonej aktualizacji macOS od początku do końca. Changelog forka pozostaje pusty do przygotowania rzeczywistego wydania. Testy lokalnego HTTP potwierdzają algorytm wykrywania kanałów, checksum i odmowę downgrade, ale nie zastępują instalacji przez Squirrel.Mac, podpisywania, notarizacji lub uruchomienia workflow GitHub.
