# Wymagania redesignu Orzi Code

Zapisane na polecenie użytkownika 2026-10-09. To zaakceptowane wymagania do przyszłego redesignu, nie opis obecnego interfejsu.

Uzupełnione 2026-10-11. Poniższe zmiany układu, archiwum, projektów i limitów użytkownik polecił zapisać do późniejszego wdrożenia. Bieżąca naprawa widoczności modeli Antigravity jest osobnym zadaniem.

## Branding

- Docelowa nazwa aplikacji: Orzi Code, zamiast PoraCode / Poracode Personal.
- Zmienić cały branding, w tym ikonę aplikacji, logo i widoczne nazwy.
- Przy zmianie identyfikatorów lub ścieżek profilu zachować historię, ustawienia i poświadczenia istniejącej instalacji forka. Nie tworzyć pozornie pustego profilu bez migracji.

## Cursor jako wzorzec interfejsu

- Kolorystykę, styl ikon i flow zaczerpnąć z Cursora.
- Przed implementacją obejrzeć rzeczywiste widoki aplikacji Cursor, aby wiernie odwzorować aktualny interfejs. Nie opierać projektu wyłącznie na pamięci, opisach ani przypadkowych screenshotach z internetu.
- Zapisać obserwacje i odniesienia do obejrzanych widoków, następnie dostosować je do funkcji Orzi Code.

## Zdjęcia w polu wiadomości

- Powiększyć podgląd załączonych zdjęć w inpucie, aby były lepiej widoczne przed wysłaniem.
- Zachować czytelne kontrolki usuwania załącznika i dotychczasowe działanie wysyłania zdjęć.

## Układ i nawigacja

- Rozłożyć UI na czytelniejsze obszary. Obecny sidebar łączy zbyt wiele funkcji i jest chaotyczny; projekty, archiwum i limity nie powinny konkurować w jednej długiej liście.
- Ikony folderów/projektów, rozwijania i zwijania dopasować do rzeczywistej aplikacji Cursor. Przy wdrożeniu obejrzeć odpowiednie widoki i odnotować wybrane ikony; szczegóły nie są jeszcze ustalone.

## Projekty i archiwum

- Lewa lista ma pokazywać tylko projekty zawierające niearchiwizowane chaty. Samo dodanie projektu do aplikacji nie powinno tworzyć pustego folderu w sidebarze.
- Docelowy workflow: pusty sidebar, wybór projektu w obszarze chatu, wysłanie pierwszego promptu, pojawienie się chatu w folderze projektu po lewej.
- Projekt pozostaje widoczny, dopóki ma przynajmniej jeden niearchiwizowany chat. Po zarchiwizowaniu ostatniego chatu jego folder znika z listy aktywnych projektów.
- Zachować wszystkie projekty w selektorze projektu, niezależnie od ich widoczności w sidebarze. Ukrycie folderu nie usuwa projektu, plików ani historii.
- Zastąpić archiwum pod każdym projektem jednym ogólnym folderem Archiwum. W nim mają być podfoldery projektów z ich zarchiwizowanymi chatami.
- Zachować istniejącą historię i możliwość otwarcia/przywrócenia zarchiwizowanego chatu. Archiwum jest używane rzadko i nie powinno zajmować miejsca w każdym aktywnym projekcie.

## Limity

- Logotypy subskrypcji/dostawców w limitach, np. Claude i Antigravity, mają mieć właściwe firmowe kolory zamiast jednolitej szarości.
- Dodać możliwość zwinięcia i rozwinięcia całej listy limitów.
- Firmowe kolory logotypów nie zastępują semantycznych kolorów pasków limitów i statusów.

## Dropdown modeli

- W głównym widoku dropdownu wyświetlać wyłącznie ulubione modele.
- Grupować je według subskrypcji, z której korzystają, w osobnych kolumnach. Oczekiwany układ przykładowy: Claude, Codex, Cursor, Gemini.
- Nie wyświetlać modeli niepolubionych pod ulubionymi.
- Pozostałe modele udostępnić w dodatkowej opcji z ikoną plusa, służącej do dodania nowego ulubionego modelu.
- Celem jest ograniczenie wizualnego chaosu i szybki wybór spośród modeli faktycznie używanych.
- Przy implementacji zachować rozróżnienie subskrypcji i dostawcy modelu. Model dostępny przez Cursor należy do kolumny subskrypcji Cursor, nawet jeśli jego producentem jest inny dostawca.

## Warunki sprawdzenia

- Przejrzeć branding w uruchomionej aplikacji i rzeczywistej ikonie pakietu macOS.
- Porównać zmienione widoki z obejrzanym Cursorem.
- Sprawdzić większe miniatury na jednym i kilku załącznikach.
- Sprawdzić dropdown z ulubionymi z kilku subskrypcji, dodawanie przez plus oraz trwałość wyborów po restarcie.
- Wszystkie nowe i zmienione teksty interfejsu przetłumaczyć we wszystkich katalogach aplikacji.
- Sprawdzić pustą listę projektów, pierwszy prompt w projekcie, kilka aktywnych chatów, archiwizację ostatniego chatu, ogólne archiwum z kilkoma projektami oraz przywrócenie chatu.
- Sprawdzić kolory logotypów i zwijanie limitów w jasnym i ciemnym motywie.
