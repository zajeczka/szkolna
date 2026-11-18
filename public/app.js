// Skrót do pobierania elementów strony po ich identyfikatorze.
const pobierzElement = (identyfikator) =>
  document.getElementById(identyfikator);

let zgloszenia = [];
let tokenAdmina = sessionStorage.getItem("helpdeskAdmin") || "";

const STANY = ["Oczekujące", "W trakcie", "Rozwiązane", "Krytyczne"];


// Zabezpiecza tekst przed wstawieniem go jako kod HTML.
function zabezpieczHtml(tekst) {
  const znakiSpecjalne = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(tekst).replace(/[&<>"']/g, (znak) => znakiSpecjalne[znak]);
}


// Wysyła zapytanie do serwera i zwraca jego odpowiedź.
async function wyslijZapytanie(adres, opcje = {}) {
  const naglowki = { ...opcje.headers };

  if (opcje.body) {
    naglowki["Content-Type"] = "application/json";
  }

  if (tokenAdmina) {
    naglowki.Authorization = `Bearer ${tokenAdmina}`;
  }

  const odpowiedz = await fetch(adres, { ...opcje, headers: naglowki });
  const typZawartosci = odpowiedz.headers.get("content-type") || "";

  if (!typZawartosci.includes("application/json")) {
    throw new Error(
      "Serwer zwrócił stronę HTML zamiast danych. Zatrzymaj go przez Ctrl+C i uruchom ponownie poleceniem: python app.py",
    );
  }

  const wynik = await odpowiedz.json();
  if (!odpowiedz.ok) {
    throw new Error(wynik.error || "Wystąpił błąd.");
  }

  return wynik;
}


function pobierzKlaseStanu(stan) {
  if (stan === "W trakcie") return "wtrakcie";
  if (stan === "Rozwiązane") return "rozwiazane";
  if (stan === "Krytyczne") return "krytyczne";
  return "oczekujace";
}


// Pokazuje zgłoszenia i aktualizuje liczniki.
function pokazZgloszenia() {
  const szukanyTekst = pobierzElement("szukaj").value.toLowerCase();
  const wybranyStan = pobierzElement("filtrStatusu").value;

  const widoczneZgloszenia = zgloszenia.filter((zgloszenie) => {
    const pasujeStan =
      wybranyStan === "Aktywne"
        ? zgloszenie.status !== "Rozwiązane"
        : wybranyStan === "Wszystkie" || zgloszenie.status === wybranyStan;
    const tekstZgloszenia =
      `${zgloszenie.title} ${zgloszenie.description} ${zgloszenie.room}`.toLowerCase();

    return pasujeStan && tekstZgloszenia.includes(szukanyTekst);
  });

  const liczbaAktywnych = zgloszenia.filter(
    (zgloszenie) => zgloszenie.status !== "Rozwiązane",
  ).length;

  pobierzElement("licznikWszystkich").textContent = liczbaAktywnych;
  pobierzElement("licznikOczekujacych").textContent = zgloszenia.filter(
    (zgloszenie) => zgloszenie.status === "Oczekujące",
  ).length;
  pobierzElement("licznikRozwiazanych").textContent = zgloszenia.filter(
    (zgloszenie) => zgloszenie.status === "Rozwiązane",
  ).length;
  pobierzElement("licznikListy").textContent = widoczneZgloszenia.length;

  if (widoczneZgloszenia.length === 0) {
    const komunikat = zgloszenia.length
      ? "Brak zgłoszeń dla tych filtrów"
      : "Brak zgłoszeń — dodaj pierwsze!";

    pobierzElement("listaZgloszen").innerHTML = `
      <div class="pusty-wynik">
        <span>▤</span>
        <strong>${komunikat}</strong>
      </div>`;
    return;
  }

  pobierzElement("listaZgloszen").innerHTML = widoczneZgloszenia
    .map((zgloszenie) => utworzHtmlZgloszenia(zgloszenie))
    .join("");
}


function utworzHtmlZgloszenia(zgloszenie) {
  const dataUtworzenia = new Date(zgloszenie.createdAt).toLocaleDateString("pl-PL");
  const klasaStanu = pobierzKlaseStanu(zgloszenie.status);
  const klasaZaleglosci = zgloszenie.slaOverdue ? " zgloszenie-zalegle" : "";
  const komunikatSla = zgloszenie.slaOverdue
    ? '<span class="ostrzezenie-sla">SLA przekroczone · ponad 24 godz.</span>'
    : "";

  const przyciskiAdmina = tokenAdmina
    ? `
      <div class="sterowanie-zgloszeniem">
        <select aria-label="Status zgłoszenia" data-stan="${zgloszenie.id}">
          ${STANY.map(
            (stan) => `
              <option ${stan === zgloszenie.status ? "selected" : ""}>
                ${stan}
              </option>`,
          ).join("")}
        </select>
        ${
          zgloszenie.status !== "Rozwiązane"
            ? `<button class="przycisk-rozwiazania" data-rozwiaz="${zgloszenie.id}">
                Oznacz jako rozwiązane
              </button>`
            : ""
        }
        <button data-usun="${zgloszenie.id}">Usuń</button>
      </div>`
    : "";

  return `
    <article class="zgloszenie${klasaZaleglosci}">
      <div class="naglowek-zgloszenia">
        <div class="tytul-zgloszenia">${zabezpieczHtml(zgloszenie.title)}</div>
        <div class="etykiety-zgloszenia">
          <span class="stan stan-${klasaStanu}">
            ${zabezpieczHtml(zgloszenie.status)}
          </span>
          ${komunikatSla}
        </div>
      </div>
      <p class="opis-zgloszenia">${zabezpieczHtml(zgloszenie.description)}</p>
      <div class="szczegoly-zgloszenia">
        <span>⌖ ${zabezpieczHtml(zgloszenie.room)}</span>
        <span class="priorytet priorytet-${zabezpieczHtml(zgloszenie.priority)}">
          ● ${zabezpieczHtml(zgloszenie.priority)}
        </span>
        <span>${dataUtworzenia}</span>
      </div>
      ${przyciskiAdmina}
    </article>`;
}


async function wczytajZgloszenia() {
  try {
    zgloszenia = await wyslijZapytanie("/api/tickets");
    pokazZgloszenia();
  } catch (blad) {
    pobierzElement("listaZgloszen").innerHTML = `
      <div class="pusty-wynik">
        <strong>${zabezpieczHtml(blad.message)}</strong>
      </div>`;
  }
}


function pokazPrzyciskiAdmina(czyZalogowany) {
  pobierzElement("otworzPanelAdmina").classList.toggle("ukryty", czyZalogowany);
  pobierzElement("wyloguj").classList.toggle("ukryty", !czyZalogowany);
}


// Wysyłanie nowego zgłoszenia.
pobierzElement("formularzZgloszenia").addEventListener(
  "submit",
  async (zdarzenie) => {
    zdarzenie.preventDefault();

    const formularz = zdarzenie.currentTarget;
    const komunikat = pobierzElement("komunikatFormularza");
    const przycisk = formularz.querySelector('button[type="submit"]');
    const daneFormularza = Object.fromEntries(new FormData(formularz));

    komunikat.style.color = "";
    komunikat.textContent = "Wysyłanie…";
    przycisk.disabled = true;

    try {
      await wyslijZapytanie("/api/tickets", {
        method: "POST",
        body: JSON.stringify(daneFormularza),
      });

      formularz.reset();
      pobierzElement("priorytet").value = "Średni";
      komunikat.textContent = "Zgłoszenie wysłane. Dziękujemy!";
      await wczytajZgloszenia();
    } catch (blad) {
      komunikat.style.color = "#b45252";
      komunikat.textContent = blad.message;
    } finally {
      przycisk.disabled = false;
    }
  },
);


// Wyszukiwanie, filtrowanie i odświeżanie listy.
pobierzElement("szukaj").addEventListener("input", pokazZgloszenia);
pobierzElement("filtrStatusu").addEventListener("change", pokazZgloszenia);
pobierzElement("odswiezListe").addEventListener("click", wczytajZgloszenia);


// Otwieranie i zamykanie okna administratora.
pobierzElement("otworzPanelAdmina").addEventListener("click", () => {
  pobierzElement("oknoAdmina").showModal();
});

pobierzElement("zamknijOkno").addEventListener("click", () => {
  pobierzElement("oknoAdmina").close();
});

pobierzElement("oknoAdmina").addEventListener("click", (zdarzenie) => {
  if (zdarzenie.target === pobierzElement("oknoAdmina")) {
    pobierzElement("oknoAdmina").close();
  }
});


// Logowanie administratora.
pobierzElement("formularzAdmina").addEventListener(
  "submit",
  async (zdarzenie) => {
    zdarzenie.preventDefault();

    const komunikat = pobierzElement("komunikatLogowania");
    komunikat.style.color = "";
    komunikat.textContent = "";

    try {
      const wynik = await wyslijZapytanie("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: pobierzElement("hasloAdmina").value }),
      });

      tokenAdmina = wynik.token;
      sessionStorage.setItem("helpdeskAdmin", tokenAdmina);
      pobierzElement("oknoAdmina").close();
      pobierzElement("formularzAdmina").reset();
      pokazPrzyciskiAdmina(true);
      await wczytajZgloszenia();
    } catch (blad) {
      komunikat.style.color = "#b45252";
      komunikat.textContent = blad.message;
    }
  },
);


// Wylogowanie administratora.
pobierzElement("wyloguj").addEventListener("click", () => {
  tokenAdmina = "";
  sessionStorage.removeItem("helpdeskAdmin");
  pokazPrzyciskiAdmina(false);
  pokazZgloszenia();
});


// Zmiana statusu zgłoszenia.
pobierzElement("listaZgloszen").addEventListener("change", async (zdarzenie) => {
  const idZgloszenia = zdarzenie.target.dataset.stan;
  if (!idZgloszenia) return;

  try {
    await wyslijZapytanie(`/api/tickets/${idZgloszenia}`, {
      method: "PATCH",
      body: JSON.stringify({ status: zdarzenie.target.value }),
    });
    await wczytajZgloszenia();
  } catch (blad) {
    alert(blad.message);
  }
});


// Usuwanie zgłoszenia.
pobierzElement("listaZgloszen").addEventListener("click", async (zdarzenie) => {
  const idDoRozwiazania = zdarzenie.target.dataset.rozwiaz;
  const idDoUsuniecia = zdarzenie.target.dataset.usun;

  try {
    if (idDoRozwiazania) {
      await wyslijZapytanie(`/api/tickets/${idDoRozwiazania}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Rozwiązane" }),
      });
    } else if (idDoUsuniecia) {
      await wyslijZapytanie(`/api/tickets/${idDoUsuniecia}`, {
        method: "DELETE",
      });
    } else {
      return;
    }

    await wczytajZgloszenia();
  } catch (blad) {
    alert(blad.message);
  }
});


pokazPrzyciskiAdmina(Boolean(tokenAdmina));
wczytajZgloszenia();
setInterval(wczytajZgloszenia, 30000);
