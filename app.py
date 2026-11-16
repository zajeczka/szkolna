"""Serwer szkolnego helpdesku."""

import json
import os
import secrets
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException


# Ustawienia aplikacji.
aplikacja = Flask(__name__)
PLIK_ZGLOSZEN = Path(__file__).parent / "data" / "tickets.json"
HASLO_ADMINA = os.environ.get("ADMIN_PASSWORD", "admin123")
SESJE_ADMINA = set()
DOZWOLONE_STATUSY = ["Oczekujące", "W trakcie", "Rozwiązane", "Krytyczne"]
LIMIT_GODZIN_SLA = 24


def wczytaj_zgloszenia():
    """Wczytaj zgłoszenia z pliku JSON."""
    PLIK_ZGLOSZEN.parent.mkdir(exist_ok=True)

    if not PLIK_ZGLOSZEN.exists():
        PLIK_ZGLOSZEN.write_text("[]", encoding="utf-8")

    # utf-8-sig odczyta także plik z BOM dodanym przez PowerShell.
    return json.loads(PLIK_ZGLOSZEN.read_text(encoding="utf-8-sig"))


def zapisz_zgloszenia(zgloszenia):
    """Zapisz zgłoszenia do pliku JSON."""
    PLIK_ZGLOSZEN.write_text(
        json.dumps(zgloszenia, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def czy_admin_zalogowany():
    """Sprawdź, czy żądanie zawiera token administratora."""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    return token in SESJE_ADMINA


@aplikacja.get("/")
def strona_glowna():
    return send_from_directory("public", "index.html")


@aplikacja.get("/<path:nazwa_pliku>")
def wyswietl_plik_strony(nazwa_pliku):
    return send_from_directory("public", nazwa_pliku)


@aplikacja.errorhandler(Exception)
def obsluz_blad(blad):
    """Zwróć błędy API w formacie JSON."""
    if not request.path.startswith("/api/"):
        if isinstance(blad, HTTPException):
            return blad

        aplikacja.logger.exception("Błąd podczas wyświetlania strony")
        return "Wystąpił błąd serwera.", 500

    if isinstance(blad, HTTPException):
        return jsonify({"error": blad.description}), blad.code

    aplikacja.logger.exception("Błąd podczas obsługi API")
    return jsonify(
        {"error": "Nie udało się odczytać zgłoszeń. Sprawdź plik data/tickets.json."}
    ), 500


@aplikacja.get("/api/tickets")
def pokaz_liste_zgloszen():
    zgloszenia = wczytaj_zgloszenia()
    teraz = datetime.now().astimezone()

    # Sprawdź, czy zgłoszenie krytyczne czeka bez zmiany statusu ponad dobę.
    for zgloszenie in zgloszenia:
        data_zmiany = zgloszenie.get("statusChangedAt") or zgloszenie.get(
            "createdAt"
        )

        try:
            czas_zmiany = datetime.fromisoformat(data_zmiany)
            if czas_zmiany.tzinfo is None:
                czas_zmiany = czas_zmiany.astimezone()
            liczba_godzin = (teraz - czas_zmiany).total_seconds() / 3600
        except (TypeError, ValueError):
            liczba_godzin = 0

        zgloszenie["slaOverdue"] = (
            zgloszenie["status"] == "Krytyczne"
            and liczba_godzin >= LIMIT_GODZIN_SLA
        )

    # Zgłoszenia krytyczne po terminie trafiają na górę listy.
    zgloszenia.sort(
        key=lambda zgloszenie: (
            zgloszenie["slaOverdue"],
            zgloszenie.get("statusChangedAt")
            or zgloszenie.get("createdAt", ""),
        ),
        reverse=True,
    )
    return jsonify(zgloszenia)


@aplikacja.post("/api/tickets")
def dodaj_zgloszenie():
    dane = request.get_json(silent=True) or {}
    tytul = str(dane.get("title", "")).strip()[:100]
    opis = str(dane.get("description", "")).strip()[:1000]
    sala = str(dane.get("room", "")).strip()[:40]
    priorytet = dane.get("priority")

    if (
        not tytul
        or not opis
        or not sala
        or priorytet not in ["Niski", "Średni", "Wysoki"]
    ):
        return jsonify({"error": "Uzupełnij tytuł, opis, salę i priorytet."}), 400

    teraz = datetime.now().astimezone().isoformat()
    zgloszenie = {
        "id": secrets.token_hex(8),
        "title": tytul,
        "description": opis,
        "room": sala,
        "priority": priorytet,
        "status": "Oczekujące",
        "createdAt": teraz,
        "statusChangedAt": teraz,
    }

    zgloszenia = wczytaj_zgloszenia()
    zgloszenia.append(zgloszenie)
    zapisz_zgloszenia(zgloszenia)
    return jsonify(zgloszenie), 201


@aplikacja.post("/api/admin/login")
def zaloguj_admina():
    dane = request.get_json(silent=True) or {}

    if dane.get("password") != HASLO_ADMINA:
        return jsonify({"error": "Nieprawidłowe hasło."}), 401

    token = secrets.token_hex(24)
    SESJE_ADMINA.add(token)
    return jsonify({"token": token})


@aplikacja.route("/api/tickets/<id_zgloszenia>", methods=["PATCH", "DELETE"])
def edytuj_zgloszenie(id_zgloszenia):
    if not czy_admin_zalogowany():
        return jsonify({"error": "Zaloguj się jako administrator."}), 401

    zgloszenia = wczytaj_zgloszenia()
    zgloszenie = next(
        (element for element in zgloszenia if element["id"] == id_zgloszenia),
        None,
    )

    if zgloszenie is None:
        return jsonify({"error": "Nie znaleziono zgłoszenia."}), 404

    if request.method == "DELETE":
        zgloszenia.remove(zgloszenie)
        zapisz_zgloszenia(zgloszenia)
        return jsonify({"ok": True})

    dane = request.get_json(silent=True) or {}
    if dane.get("status") not in DOZWOLONE_STATUSY:
        return jsonify({"error": "Nieprawidłowy status."}), 400

    zgloszenie["status"] = dane["status"]
    zgloszenie["statusChangedAt"] = datetime.now().astimezone().isoformat()
    zapisz_zgloszenia(zgloszenia)
    return jsonify(zgloszenie)


if __name__ == "__main__":
    print("Helpdesk działa pod adresem http://127.0.0.1:5000")
    aplikacja.run(debug=True, port=int(os.environ.get("PORT", "5000")))
