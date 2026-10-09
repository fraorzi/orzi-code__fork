# Orzi Code

<!-- Hallmark - pre-emit critique: P5 H4 E5 S5 R5 V4. -->

## Źródło i zakres

Wymagania: [redesign](docs/fork/redesign-requirements.md). Referencją jest rzeczywisty pusty widok Cursor Agents na macOS, odczytany 2026-10-09 przez narzędzie UI. Zrzut istniejącej rozmowy został odrzucony przez kontrolę prywatności; do inspekcji otwarto pusty chat. Treści rozmów i projektów nie są materiałem redesignu.

Widoczna referencja ma neutralne ciemne tło, nieco jaśniejszy sidebar, cienkie szare obrysy, jasnoszary tekst i proste ikony liniowe. Composer jest wyraźnie wydzielony, z kontekstem projektu nad polem i wyborem modelu w dolnym pasku. Wizualna identyfikacja fontu ze zrzutu nie jest pewna. Orzi Code zachowuje lokalne Geist i Geist Mono.

## Zasady wspólne

- Istniejące widoki, stan aplikacji i własność komponentów pozostają podstawą. Motyw bazowy używa obecnych zmiennych HeroUI; inne zapisane motywy pozostają dostępne.
- Nazwa publiczna: Orzi Code. Logo ma własny znak oparty na literze O. Identyfikatory aplikacji, profile danych, protokoły lokalne i klucze zapisu zachowują zgodność z poprzednią instalacją.
- Ikony sterujące: Lucide, pojedynczy kolor, bez nowych dekoracyjnych gradientów. Statusy zachowują semantyczne kolory. Ikony dostawców pozostają rozpoznawalne.
- Ulubione modele są w kolumnach według konta uruchamiającego model. Katalog otwiera osobna opcja z plusem. Dodanie ulubionego nie zmienia aktywnego modelu. Nawigacja klawiaturą i zwijanie menu pozostają dostępne.
- Zdjęcia w composerze mają osobne podglądy 96 x 80 px, pełny kadr przez `object-fit: contain` i stale dostępny przycisk usuwania. Kliknięcie podglądu otwiera istniejący lightbox. Pliki i elementy strony zachowują podpisane chipy.

## Tokeny i sprawdzanie

Kolorystyka jest adaptacją obserwowanego widoku, nie deklaracją dokładnie pobranych wartości Cursora. Źródłem wartości dla aplikacji pozostają `src/renderer/styles.css` i `src/renderer/theme/themePresets.ts`; komponenty odwołują się do tych tokenów.

Sprawdzanie obejmuje rzeczywisty Electron, jasny i ciemny wariant, polską lokalizację, keyboard selection, katalog modeli oraz podgląd i usunięcie załącznika. Zmiana nazwy wymaga kontroli wcześniejszego profilu, a ikony kontroli wynikowych PNG/ICNS, nie wyłącznie SVG.
