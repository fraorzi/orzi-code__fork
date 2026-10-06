# Role agentów i delegowanie między dostawcami

Status: uzgodniono opcjonalny tryb zespołowy i automatyczną integrację zmian bez zatwierdzania wykonawców. Pierwsza implementacja opisana w [stanie wdrożenia](implementation.md). Data: 2026-10-05.

## Cel

Główny agent może zlecać pracę agentom innych dostawców, np. Claude zleca generowanie altów Gemini, a Codex wykonuje recenzję zmian. Każdy używa własnego runtime i autoryzacji. Role określają model, instrukcje, narzędzia i uprawnienia. Wybór roli jest niezależny od marki modelu.

PoraCode już ma Crossagents, delegowanie w tle, reguły wyboru dostawcy/modelu według tagów, podgląd wyników i konfigurację fallbacków. Rozszerzenie powinno wykorzystać te mechanizmy. Wstępny odczyt `spawnPlan.ts` wskazuje wymaganie `full-access` dla subagentów; przed udostępnieniem profili tylko do odczytu trzeba zmienić i przetestować rzeczywiste egzekwowanie uprawnień. Sam prompt nie ogranicza dostępu do plików.

## Proponowana pierwsza wersja

### Uzgodniony sposób pracy

Domyślnie użytkownik wybiera model i wykonuje z nim zadanie bez uruchamiania zespołu. To podstawowy workflow dla krótkich prac. Nie wymaga wybierania profilu specjalisty ani przechodzenia przez koordynatora.

Przy większej pracy użytkownik świadomie włącza pracę zespołową i przekazuje zadanie wybranemu mocnemu agentowi. Główny agent prowadzi rozmowę, utrzymuje plan i decyzje architektoniczne oraz sam implementuje trudniejsze lub silnie powiązane części. Decyduje też, czy delegowanie konkretnej części ma sens.

Delegowanie ma dwa cele: dobranie modelu do zadania oraz rozdzielenie kontekstów niezależnych części implementacji. Nie ogranicza się do przekazywania prostych prac słabszym modelom. Główny agent może przekazać trudny, ale dobrze wydzielony moduł innemu mocnemu agentowi, również innego dostawcy. Koszt przekazania kontekstu i integracji może uzasadniać pozostawienie zadania u głównego agenta.

### Proponowana obsługa w aplikacji

- Zwykły wybór modelu pozostaje podstawowym interfejsem. Opcja "Praca zespołowa" uruchamia dodatkowy workflow dla danego wątku.
- Wybrany model zostaje głównym agentem. Użytkownik konfiguruje dostępną pulę wykonawców i ich mocniejsze/szybsze modele; aplikacja nie zakłada, że istnieje jeden obiektywnie najmądrzejszy model do wszystkich zadań.
- Główny agent może samodzielnie delegować w ramach tej puli. Nie pytamy o zgodę na każde zwykłe zlecenie. Reguły użytkownika i ograniczenia narzędzi nadal obowiązują.
- Rola jest przypisywana do konkretnego zadania. Mocny wykonawca może dostać osobny moduł, a lekki model opisy lub alty. Główny agent może wykonać dowolną z tych prac sam.
- Każdy wykonawca dostaje osobny kontekst: cel, kryteria odbioru, potrzebne pliki, ustalone interfejsy i zakres edycji. Zachowuje własną historię dla poprawek do tego zadania.
- Do głównego wątku wracają zmiany, wynik testów, ważne decyzje, ryzyka i pytania. Pełna rozmowa wykonawcy jest dostępna w podglądzie, ale nie jest automatycznie dopisywana do kontekstu głównego agenta.
- Główny agent odpowiada za sprawdzenie zgodności części i końcowego działania całości. Integracja zmian jest automatyczna, bez zatwierdzania zmian każdego wykonawcy. Główny agent rozwiązuje zwykłe konflikty i uruchamia testy całości.

Poniższe role opisują dostępne zastosowania, nie obowiązkowy zestaw agentów uruchamianych przy każdym zadaniu.

| Rola            | Zakres                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------- |
| Główny agent    | Rozmowa, plan, własna implementacja, podział zadań, integracja i odpowiedź użytkownikowi |
| Szybkie zadania | Alty, metadane, proste transformacje i krótkie opisy                                     |
| Implementacja   | Zmiany kodu i testy                                                                      |
| Trudne problemy | Architektura, niejednoznaczne problemy, złożone debugowanie                              |
| Weryfikacja     | Recenzja zmian i sprawdzenie kryteriów zadania                                           |

- Modele wybierane z rzeczywistego katalogu dostępnego dla konta i adaptera. Nie wpisywać na stałe nazwy modelu tylko na podstawie przykładu w rozmowie.
- Ręczna reguła użytkownika ma pierwszeństwo przed klasyfikacją głównego agenta i rankingiem wyuczonym z użycia.
- Bezpośredni wybór modelu do prostego zadania, bez obowiązkowej roli i bez udziału koordynatora.
- Proponowany start: maksymalnie dwóch wykonawców naraz, jeden poziom delegowania. Limit czasu, liczby prób i fan-out egzekwowany w aplikacji.
- Przekazywać zadanie, kryterium wyniku, potrzebne pliki/obrazy i kontekst. Nie kopiować całej historii do każdego wykonawcy.
- Wynik prostych zadań powinien mieć walidowaną strukturę, np. lista plików i tekstów alternatywnych. Generowanie altów wymaga przekazania rzeczywistych obrazów oraz kontekstu użycia, w tym rozróżnienia obrazów dekoracyjnych.
- Równoległe zmiany kodu wykonywać w oddzielnych worktree. Ich scalenie może mieć konflikty i wymaga weryfikacji; samo utworzenie worktree nie usuwa tego problemu.
- Drzewo zadań w głównym wątku pokazuje rolę, dostawcę, model, powód wyboru, stan, wynik i możliwość zatrzymania lub przekazania korekty.
- Obsłużyć brak modelu, wyczerpanie limitu, błąd logowania i niezgodność narzędzi. Nie zastępować subskrypcji płatnym API bez osobnej decyzji.
- Dokładny budżet pieniężny nie musi być dostępny na subskrypcji. Pokazywać dostępne zużycie, czas i limity zamiast wymyślonej ceny zadania.

## Uzgodniona integracja

Zmiany zakończonego powodzeniem wykonawcy są automatycznie stosowane do kopii roboczej głównego agenta. Główny agent otrzymuje wynik dopiero po próbie integracji. Sprawdza połączony kod, rozwiązuje konflikty i poprawia błędy bez pytania użytkownika o zgodę na każde scalenie.

Wykonawca zaczyna od migawki bieżących plików projektu, także zmian niezapisanych w commitach. Jego poprawka jest różnicą względem tej migawki. Nie zawiera ponownie zmian głównego agenta, które istniały przed delegowaniem. Zastosowanie poprawki nie tworzy commitów ani nie modyfikuje indeksu głównego repozytorium.

Gdy Git nie może zastosować całej poprawki, projekt nie dostaje częściowego wyniku. Główny agent otrzymuje katalog wykonawcy, poprawkę i komunikat błędu. Sam rozwiązuje konflikt, zachowując równoległe zmiany. Nieudane i anulowane zadania nie są automatycznie integrowane. Katalogi wykonawców pozostają do odzyskania pracy.

Zasady commitów, push i publikacji określają aktualne [ustalenia użytkownika](HANDOFF.md#ustalenia-użytkownika). Pierwsza wersja obsługuje lokalne projekty Git z istniejącym HEAD, bez submodułów. Katalog roboczy izoluje zmiany, ale nie jest sandboxem uprawnień.

Nazwane profile ról i wygodniejsza edycja puli modeli mogą rozszerzyć obecne reguły Crossagents. Nie są wymagane do zwykłego ręcznego wyboru modelu ani do delegowania według dostępnych modeli i reguł routingu.

## Inspiracje z oh-my-pi

- [Role i definicje agentów](https://github.com/can1357/oh-my-pi/blob/main/docs/task-agent-discovery.md): profile z modelem i instrukcjami, ustawienia globalne oraz projektowe.
- [Task](https://github.com/can1357/oh-my-pi/blob/main/docs/tools/task.md): delegowanie, izolacja wykonawców i wyniki o określonej strukturze. Do rozważenia wraz z panelem Agent Hub.
- [Advisor](https://github.com/can1357/oh-my-pi/blob/main/docs/advisor-watchdog.md): dodatkowy model recenzujący pracę. Propozycja dla forka: recenzja po większej zmianie lub na żądanie, nie stałe dublowanie każdej tury.
- [Przegląd funkcji](https://github.com/can1357/oh-my-pi): podgląd przed zastosowaniem zmian, pamięć projektu, LSP, debugger, Hashline i narzędzia przeglądarkowe. Najpierw sprawdzić istniejące odpowiedniki w PoraCode. Własne narzędzie edycji lub debugger to osobny projekt integracyjny, a nie element pierwszej wersji ról.

Funkcje oh-my-pi wynikają również z jego własnego silnika agentowego. Nie można obiecać ich identycznego działania po samym dodaniu UI nad Codexem, Claude i ACP.
