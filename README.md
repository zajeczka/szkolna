# Szkolny helpdesk

Prosty projekt szkolnego systemu zgłoszeń. Backend jest napisany w Pythonie (Flask), a strona w HTML, CSS i JavaScript. Zgłoszenia zapisują się w pliku `data/tickets.json`.

Nazwy własnych funkcji, zmiennych, klas CSS i identyfikatorów strony są po polsku. Nazwy pól JSON, adresów API i poleceń uruchamiania pozostają takie jak wcześniej, aby zapisane zgłoszenia i uruchamianie projektu działały bez zmian.

## Pliki projektu

- `app.py` — serwer Python i obsługa zgłoszeń.
- `public/index.html` — zawartość strony.
- `public/style.css` — wygląd strony.
- `public/app.js` — działanie formularza, listy i panelu administratora.
- `data/tickets.json` — zapisane zgłoszenia.
- `requirements.txt` — lista potrzebnych dodatków Pythona.

## Uruchomienie na Windows

1. Zainstaluj Pythona.
2. Otwórz terminal w folderze projektu.
3. Zainstaluj potrzebny dodatek:

```powershell
py -m pip install -r requirements.txt
```

4. Uruchom stronę:

```powershell
py app.py
```

5. Otwórz w przeglądarce adres http://127.0.0.1:5000.

Hasło administratora na początek to `admin123`. Własne hasło możesz ustawić w PowerShell:

```powershell
$env:ADMIN_PASSWORD = "moje-haslo"
py app.py
```

## Co potrafi strona?

- Przyjmuje zgłoszenie z tytułem, opisem, salą i priorytetem.
- Pokazuje listę zgłoszeń i pozwala je wyszukiwać.
- Pozwala administratorowi zmienić status, oznaczyć zgłoszenie jako rozwiązane przyciskiem albo je usunąć.
- Pozwala ustawić status „Krytyczne”. Jeśli zgłoszenie krytyczne czeka ponad 24 godziny bez zmiany statusu, zostaje oznaczone na czerwono i przeniesione na początek listy.
