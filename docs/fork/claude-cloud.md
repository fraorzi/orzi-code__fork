# Claude Cloud - decyzja odłożona

Stan na 2026-10-11. Użytkownik chce przełącznik Lokalnie / Chmura podobny do aplikacji Claude, aby korzystać z odebranych kredytów chmurowych. Po sprawdzeniu ograniczeń konta polecił zapisać temat do decyzji na później i kontynuować pozostałe funkcje. Integracja Cloud nie została wdrożona. Ścieżka otwierająca rozmowę w oficjalnym Claude pozostaje propozycją, nie zaakceptowaną decyzją.

## Potwierdzone zachowanie

Sprawdzono rzeczywiste CLI Claude Code 2.1.296 i Agent SDK 0.3.251 na zalogowanym koncie Claude Pro. Testy poza sandboxem używały osobnego repozytorium z jednym README, z wyłączonym przekazywaniem ustawień domowych. Nie przesłano checkoutu forka. Prompty zakazywały odczytu, edycji i wykonywania komend.

- `claude --cloud "zadanie"` w PTY tworzy sesję Cloud, zwraca URL i kończy lokalny proces kodem 0. Na tym koncie nie udostępnia odpowiedzi ani dalszego interaktywnego chatu.
- Podłączenie przez `claude --cloud <session-id>` zwraca `Error: Attaching to an existing cloud session is not enabled for your account.`
- Próba strumieniowa przez SDK z `extraArgs: { cloud: null }` zwraca `Error: --cloud requires an interactive terminal.` SDK już uruchamia stream-json bez `--print`, więc usuwanie tej flagi nie rozwiązuje ograniczenia.
- `claude -p "wiadomość" --cloud <session-id> --output-format json` działa i zwraca `{ok:true,session_id,url}`. Potwierdza przyjęcie wiadomości, nie zakończenie pracy ani treść odpowiedzi.
- W pierwszej próbie wewnątrz sandboxu `claude auth status` zwrócił brak logowania. Poza sandboxem potwierdzono istniejące logowanie Claude Pro. Nie traktować tego jako potrzeby ponownego logowania użytkownika.

Źródła: [oficjalna dokumentacja Cloud](https://code.claude.com/docs/en/claude-code-on-the-web), rzeczywiste testy CLI/SDK oraz inspekcja dostarczonego binarium. Binarium ma ścieżkę strumieniową zależną od dostępności funkcji na koncie; jej obecność w kodzie nie dowodzi dostępności dla użytkownika.

Pomocnicze materiały lokalne są w ignorowanym `.tmp/claude-cloud-protocol-fixture`. Nie są częścią repozytorium i nie są potrzebne do odczytu tej notatki. Procesy testowe zakończono. Nie zmieniono ustawień konta ani produkcyjnej aplikacji.

## Decyzja do podjęcia

1. Czy zaakceptować przełącznik tworzący prawdziwe zadanie Cloud z forka i otwierający jego rozmowę w oficjalnym Claude?
2. Czy wymagany jest wyłącznie chat Cloud wewnątrz forka? Wtedy najpierw ponownie sprawdzić dostępność strumienia i podłączania na koncie oraz aktualny oficjalny protokół.

Przy wznowieniu oddzielnie zweryfikować tworzenie, odpowiedzi na żywo, follow-up, wznowienie po restarcie, pytania/zgody, Stop oraz pobieranie zmian do projektu. `--teleport` przenosi pracę do lokalnego wykonania; nie jest ponownym podłączeniem do Cloud. Zamknięcie lokalnego procesu nie dowodzi zatrzymania zadania chmurowego. Zachować jawne miejsce wykonania i nigdy nie zastępować niedostępnego Cloud lokalnym zadaniem bez wiedzy użytkownika.
