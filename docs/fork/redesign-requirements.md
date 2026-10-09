# Wymagania redesignu Orzi Code

Zapisane na polecenie użytkownika 2026-10-09. To zaakceptowane wymagania do przyszłego redesignu, nie opis obecnego interfejsu.

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
