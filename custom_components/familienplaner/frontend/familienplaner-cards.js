/*
 * Familienplaner – eigene Karten
 *   custom:familienplaner-kopf       Uhr, Datum, Begrüßung, Wetter, Müll/Ferien-Hinweise
 *   custom:familienplaner-personen   Personen mit Avatar, Anwesenheit, nächstem Termin, Countdown
 *   custom:familienplaner-pinnwand   Notizen als Klebezettel
 *   custom:familienplaner-countdowns Geburtstage, Urlaub, Feiertage als Kacheln
 * Alle Karten bringen ihr eigenes Design mit (kein card-mod nötig) und folgen hell/dunkel.
 */

const TEXTE = {
  de: {
    tage: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    monate: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    gruss: ["Gute Nacht", "Guten Morgen", "Schönen Tag", "Guten Abend"],
    kw: "KW",
    frei: "Nichts geplant",
    pinnwand: "Pinnwand",
    pinnLeer: "Noch keine Notizen – einfach in die Liste „Pinnwand“ schreiben.",
    countdowns: "Countdowns",
    cdLeer: "Geburtstage und Urlaube im Kalender „Besondere Tage“ eintragen.",
    heute: "Heute",
    morgen: "Morgen",
    tageWort: "Tage",
    muell: "Müll",
    konflikte: "Terminkonflikte",
    familie: "Familie",
    alle: "Alle",
    hallo: "Hallo",
    deineTermine: "Deine nächsten Termine",
    deineAufgaben: "Deine Aufgaben",
    keineAufgaben: "Alles erledigt 🎉",
    keineTermine: "Die nächsten 7 Tage sind frei 😎",
    heuteTitel: "Heute bei uns",
    heuteFrei: "Heute steht nichts an – genießt den Tag! 🌿",
    ganztags: "Ganztägig",
    jetzt: "Jetzt",
    eintragen: "Eintragen",
    schnellTitel: "Schnell eintragen",
    schnellHinweis: "z. B. „Ben hat Dienstag um 4 Fußball, Anna fährt“",
    schnellFuer: "Neuer Termin für",
    aufgabeNeu: "Neue Aufgabe …",
    zurueck: "Zur Familie",
    fertig: "Erledigt",
  },
  en: {
    tage: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    monate: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    gruss: ["Good night", "Good morning", "Have a nice day", "Good evening"],
    kw: "Week",
    frei: "Nothing planned",
    pinnwand: "Pinboard",
    pinnLeer: "No notes yet – just add them to the “Pinboard” list.",
    countdowns: "Countdowns",
    cdLeer: "Add birthdays and holidays to the “Special days” calendar.",
    heute: "Today",
    morgen: "Tomorrow",
    tageWort: "days",
    muell: "Waste",
    konflikte: "event conflicts",
    familie: "Family",
    alle: "All",
    hallo: "Hi",
    deineTermine: "Your next events",
    deineAufgaben: "Your tasks",
    keineAufgaben: "All done 🎉",
    keineTermine: "Nothing in the next 7 days 😎",
    heuteTitel: "Today",
    heuteFrei: "Nothing planned today – enjoy! 🌿",
    ganztags: "All day",
    jetzt: "Now",
    eintragen: "Add",
    schnellTitel: "Quick add",
    schnellHinweis: "e.g. “Ben has football on Tuesday at 4, Anna drives”",
    schnellFuer: "New event for",
    aufgabeNeu: "New task …",
    zurueck: "Back to family",
    fertig: "Done",
  },
};
const t = (hass) => TEXTE[(hass && hass.language || "de").startsWith("de") ? "de" : "en"];

const WETTER_ICON = {
  "clear-night": "mdi:weather-night", cloudy: "mdi:weather-cloudy", exceptional: "mdi:alert-circle-outline",
  fog: "mdi:weather-fog", hail: "mdi:weather-hail", lightning: "mdi:weather-lightning",
  "lightning-rainy": "mdi:weather-lightning-rainy", partlycloudy: "mdi:weather-partly-cloudy",
  pouring: "mdi:weather-pouring", rainy: "mdi:weather-rainy", snowy: "mdi:weather-snowy",
  "snowy-rainy": "mdi:weather-snowy-rainy", sunny: "mdi:weather-sunny", windy: "mdi:weather-windy",
  "windy-variant": "mdi:weather-windy-variant",
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------ gewählte Person (pro Gerät)
 * window.familienplaner.person            aktueller Slug oder "familie"
 * window.familienplaner.personSetzen(s)   wechseln
 * window-Event "familienplaner-person"    detail: { slug }
 * Ohne Berührung springt die Auswahl nach `zurueckMinuten` zurück auf "familie".
 */
const PERSON_KEY = "familienplaner-person";
window.familienplaner = window.familienplaner || {};
if (!window.familienplaner.personSetzen) {
  const fp = window.familienplaner;
  let timer;
  try { fp.person = localStorage.getItem(PERSON_KEY) || "familie"; } catch (e) { fp.person = "familie"; }
  fp.zurueckMinuten = 3;
  fp._aktivitaet = () => {
    clearTimeout(timer);
    if (fp.person !== "familie" && fp.zurueckMinuten > 0) timer = setTimeout(() => fp.personSetzen("familie"), fp.zurueckMinuten * 60000);
  };
  fp.personSetzen = (slug) => {
    fp.person = slug || "familie";
    try { localStorage.setItem(PERSON_KEY, fp.person); } catch (e) { /* privat */ }
    window.dispatchEvent(new CustomEvent("familienplaner-person", { detail: { slug: fp.person } }));
    fp._aktivitaet();
  };
  for (const ev of ["pointerdown", "keydown"]) window.addEventListener(ev, () => fp._aktivitaet(), { passive: true, capture: true });
  fp._aktivitaet();
}

const BASIS_CSS = `
  :host { display: block;
    --fp-radius: var(--familienplaner-radius, 22px);
    --fp-radius-klein: var(--familienplaner-radius-klein, 18px);
    --fp-schatten: var(--familienplaner-schatten, 0 6px 20px rgba(0,0,0,.06));
    --fp-schrift: var(--familienplaner-schrift, var(--primary-font-family, inherit));
    font-family: var(--fp-schrift); }
  ha-card { border-radius: var(--fp-radius); box-shadow: var(--fp-schatten); overflow: hidden; }
  .titel { display: flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; margin: 0 0 12px; color: var(--primary-text-color); }
  .titel ha-icon { --mdc-icon-size: 22px; color: var(--secondary-text-color); }
  .leer { color: var(--secondary-text-color); font-size: 14px; line-height: 1.5; }
`;

function mehrInfo(el, entityId) {
  if (!entityId) return;
  el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

class FpBasis extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._render();
  }
  set hass(hass) {
    const alt = this._hass;
    this._hass = hass;
    if (!alt || this._relevant().some((id) => alt.states[id] !== hass.states[id]) || alt.language !== hass.language) this._render();
  }
  _relevant() { return []; }
  getCardSize() { return 3; }
}

/* ------------------------------------------------------------------ Kopf */
class FamilienplanerKopf extends FpBasis {
  connectedCallback() { this._timer = setInterval(() => this._render(), 20000); }
  disconnectedCallback() { clearInterval(this._timer); }
  _relevant() { return [this._config.wetter, this._config.muell, this._config.ferien, this._config.konflikte].filter(Boolean); }
  getCardSize() { return 4; }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = t(this._hass);
    const jetzt = new Date();
    const h = jetzt.getHours();
    const gruss = tx.gruss[h < 5 ? 0 : h < 11 ? 1 : h < 18 ? 2 : h < 22 ? 3 : 0];
    const kw = (() => { const d = new Date(Date.UTC(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate())); const tag = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - tag); const j = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - j) / 86400000 + 1) / 7); })();
    const uhr = jetzt.toLocaleTimeString(this._hass.language || "de", { hour: "2-digit", minute: "2-digit" });
    const datum = `${tx.tage[jetzt.getDay()]}, ${jetzt.getDate()}. ${tx.monate[jetzt.getMonth()]}`;

    const w = this._config.wetter && this._hass.states[this._config.wetter];
    const wetter = w ? `
      <div class="wetter" data-id="${esc(this._config.wetter)}">
        <ha-icon icon="${WETTER_ICON[w.state] || "mdi:weather-partly-cloudy"}"></ha-icon>
        <div><div class="temp">${Math.round(Number(w.attributes.temperature))}°</div>
        <div class="klein">${esc(this._hass.formatEntityState ? this._hass.formatEntityState(w) : w.state)}</div></div>
      </div>` : "";

    const chips = [];
    const m = this._config.muell && this._hass.states[this._config.muell];
    if (m && m.state && m.state !== "unknown" && m.state !== "unbekannt") chips.push(`<span class="chip" data-id="${esc(this._config.muell)}"><ha-icon icon="mdi:trash-can-outline"></ha-icon>${esc(m.state)}</span>`);
    const f = this._config.ferien && this._hass.states[this._config.ferien];
    if (f && f.state && f.state !== "unknown" && f.state !== "unbekannt") chips.push(`<span class="chip ferien" data-id="${esc(this._config.ferien)}"><ha-icon icon="mdi:beach"></ha-icon>${esc(f.state)}</span>`);

    const k = this._config.konflikte && this._hass.states[this._config.konflikte];
    const anzahl = k ? Number(k.state) || 0 : 0;
    if (anzahl) {
      const erster = (k.attributes.liste || [])[0];
      const text = anzahl === 1 && erster ? erster.text : `${anzahl} ${tx.konflikte}`;
      chips.unshift(`<span class="chip warnung" data-id="${esc(this._config.konflikte)}"><ha-icon icon="mdi:calendar-alert"></ha-icon>${esc(text)}</span>`);
    }

    this.shadowRoot.innerHTML = `
      <style>${BASIS_CSS}
        ha-card { padding: 22px 26px; background: linear-gradient(135deg, color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color, #fff)), var(--card-background-color, #fff) 70%); }
        .zeile { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
        .uhr { font-size: clamp(56px, 9vw, 96px); font-weight: 250; letter-spacing: -3px; line-height: .95; color: var(--primary-text-color); }
        .datum { font-size: clamp(18px, 2.4vw, 26px); font-weight: 650; margin-top: 6px; color: var(--primary-text-color); }
        .klein { font-size: 14px; color: var(--secondary-text-color); margin-top: 2px; }
        .wetter { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 10px 16px; border-radius: var(--fp-radius-klein); background: color-mix(in srgb, var(--card-background-color, #fff) 70%, transparent); }
        .wetter ha-icon { --mdc-icon-size: 52px; color: var(--accent-color, #E0A050); }
        .temp { font-size: 38px; font-weight: 300; line-height: 1; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
        .chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; cursor: pointer;
                background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); color: var(--primary-text-color); }
        .chip.warnung { background: color-mix(in srgb, var(--error-color, #DB4437) 18%, transparent); color: var(--error-color, #B3261E); }
        .chip.ferien { background: color-mix(in srgb, #4FB3BF 20%, transparent); }
        .chip ha-icon { --mdc-icon-size: 18px; }
      </style>
      <ha-card>
        <div class="zeile">
          <div><div class="uhr">${uhr}</div><div class="datum">${datum}</div><div class="klein">${gruss} · ${tx.kw} ${kw}</div></div>
          ${wetter}
        </div>
        ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
      </ha-card>`;
    this.shadowRoot.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => mehrInfo(this, el.dataset.id)));
  }
}

/* -------------------------------------------------------------- Personen */
class FamilienplanerPersonen extends FpBasis {
  connectedCallback() {
    this._wechsel = () => this._render();
    window.addEventListener("familienplaner-person", this._wechsel);
  }
  disconnectedCallback() { window.removeEventListener("familienplaner-person", this._wechsel); }
  _relevant() { return (this._config.personen || []).flatMap((p) => [p.sensor, p.person]).filter(Boolean); }
  getCardSize() { return 2; }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = t(this._hass);
    const personen = this._config.personen || [];
    const auswahl = this._config.auswahl === true;
    const aktiv = auswahl && window.familienplaner.person !== "familie";
    const karten = personen.map((p) => {
      const s = p.sensor && this._hass.states[p.sensor];
      const pe = p.person && this._hass.states[p.person];
      const bild = pe && pe.attributes.entity_picture;
      const zuhause = pe ? pe.state === "home" : null;
      const titel = s && !["unknown", "unavailable", ""].includes(s.state) ? s.state : tx.frei;
      const wann = s ? s.attributes.wann || "" : "";
      const bald = /Min|min|läuft|running/.test(wann);
      const fahrer = s && s.attributes.fahrer ? `<span class="fahrer"><ha-icon icon="mdi:car"></ha-icon>${esc(s.attributes.fahrer)}</span>` : "";
      const gewaehlt = auswahl && window.familienplaner.person === p.slug;
      return `
        <div class="person ${gewaehlt ? "gewaehlt" : ""} ${auswahl && aktiv && !gewaehlt ? "gedimmt" : ""}" style="--farbe:${esc(p.farbe || "#5B8DB8")}" data-id="${esc(p.sensor || "")}" data-slug="${esc(p.slug || "")}">
          <div class="avatar">${bild ? `<img src="${esc(bild)}" alt="">` : esc((p.name || "?").charAt(0).toUpperCase())}
            ${zuhause === null ? "" : `<span class="punkt ${zuhause ? "da" : "weg"}"></span>`}</div>
          <div class="text">
            <div class="name">${esc(p.name)}</div>
            <div class="termin">${esc(titel)}</div>
            <div class="meta">${wann ? `<span class="wann ${bald ? "bald" : ""}">${esc(wann)}</span>` : ""}${fahrer}</div>
          </div>
        </div>`;
    });
    this.shadowRoot.innerHTML = `
      <style>${BASIS_CSS}
        .gitter { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
        .person { display: flex; gap: 14px; align-items: center; padding: 14px 16px; border-radius: 20px; cursor: pointer;
                  background: color-mix(in srgb, var(--farbe) 12%, var(--card-background-color, #fff));
                  border: 1px solid color-mix(in srgb, var(--farbe) 30%, transparent); transition: transform .15s ease; }
        .person:hover { transform: translateY(-2px); }
        .avatar { position: relative; flex: 0 0 52px; height: 52px; border-radius: 50%; display: grid; place-items: center;
                  background: var(--farbe); color: #fff; font-size: 22px; font-weight: 700; box-shadow: 0 4px 12px color-mix(in srgb, var(--farbe) 40%, transparent); }
        .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
        .punkt { position: absolute; right: -1px; bottom: -1px; width: 14px; height: 14px; border-radius: 50%; border: 3px solid var(--card-background-color, #fff); }
        .punkt.da { background: #4CAF50; } .punkt.weg { background: #B0B0B0; }
        .text { min-width: 0; }
        .name { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: color-mix(in srgb, var(--farbe) 75%, var(--primary-text-color)); }
        .termin { font-size: 17px; font-weight: 650; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta { display: flex; gap: 8px; align-items: center; margin-top: 4px; flex-wrap: wrap; }
        .wann, .fahrer { font-size: 12.5px; font-weight: 600; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, var(--farbe) 20%, transparent); color: var(--primary-text-color); display: inline-flex; gap: 4px; align-items: center; }
        .wann.bald { background: var(--farbe); color: #fff; }
        .fahrer ha-icon { --mdc-icon-size: 14px; }
        .person.gewaehlt { background: var(--farbe); border-color: var(--farbe); box-shadow: 0 8px 24px color-mix(in srgb, var(--farbe) 45%, transparent); }
        .person.gewaehlt .name, .person.gewaehlt .termin { color: #fff; }
        .person.gewaehlt .avatar { box-shadow: 0 0 0 3px #fff; }
        .person.gewaehlt .wann, .person.gewaehlt .fahrer { background: rgba(255,255,255,.25); color: #fff; }
        .person.gedimmt { opacity: .55; }
        .familie { display: flex; gap: 12px; align-items: center; justify-content: center; padding: 14px 16px; border-radius: 20px; cursor: pointer;
                   font-weight: 700; font-size: 16px; color: var(--primary-text-color);
                   background: color-mix(in srgb, var(--secondary-text-color) 10%, var(--card-background-color, #fff)); border: 1px solid transparent; }
        .familie.gewaehlt { background: var(--primary-text-color); color: var(--card-background-color, #fff); }
        .familie ha-icon { --mdc-icon-size: 28px; }
      </style>
      <div class="gitter" style="${auswahl ? "grid-template-columns: 104px repeat(auto-fit, minmax(200px, 1fr))" : ""}">${auswahl ? `<div class="familie ${aktiv ? "" : "gewaehlt"}" data-slug="familie"><ha-icon icon="mdi:home-heart"></ha-icon>${esc(tx.alle)}</div>` : ""}${karten.join("")}</div>`;
    this.shadowRoot.querySelectorAll(".person, .familie").forEach((el) => el.addEventListener("click", () => {
      if (!auswahl) return mehrInfo(this, el.dataset.id);
      const slug = el.dataset.slug;
      window.familienplaner.personSetzen(window.familienplaner.person === slug ? "familie" : slug);
    }));
  }
}

/* -------------------------------------------------------------- Pinnwand */
const ZETTEL = ["#FFF1B8", "#FFD9E1", "#D7F0FF", "#DFF5D8", "#FFE3C7"];
class FamilienplanerPinnwand extends FpBasis {
  _relevant() { return [this._config.entity, this._config.liste].filter(Boolean); }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = t(this._hass);
    const s = this._config.entity && this._hass.states[this._config.entity];
    const notizen = (s && s.attributes.notizen) || [];
    const zettel = notizen.map((n, i) => `<div class="zettel" style="--z:${ZETTEL[i % ZETTEL.length]};--r:${((i * 37) % 7) - 3}deg">${esc(n)}</div>`).join("");
    this.shadowRoot.innerHTML = `
      <style>${BASIS_CSS}
        ha-card { padding: 18px 20px; }
        .wand { display: flex; flex-wrap: wrap; gap: 14px; }
        .zettel { flex: 1 1 140px; max-width: 220px; min-height: 70px; padding: 14px 14px 18px; background: var(--z); color: #3D3524; font-size: 16px; line-height: 1.35;
                  border-radius: 4px 4px 14px 4px; box-shadow: 0 6px 14px rgba(0,0,0,.10); transform: rotate(var(--r)); position: relative; font-family: "Comic Neue", "Segoe Print", var(--primary-font-family, sans-serif); }
        .zettel::before { content: ""; position: absolute; top: -7px; left: 50%; width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #E0645A; box-shadow: 0 2px 3px rgba(0,0,0,.25); }
      </style>
      <ha-card>
        <div class="titel" data-id="${esc(this._config.liste || "")}"><ha-icon icon="mdi:pin"></ha-icon>${tx.pinnwand}</div>
        ${zettel ? `<div class="wand">${zettel}</div>` : `<div class="leer">${tx.pinnLeer}</div>`}
      </ha-card>`;
    const t1 = this.shadowRoot.querySelector(".titel");
    if (this._config.liste) t1.addEventListener("click", () => mehrInfo(this, this._config.liste));
  }
}

/* ------------------------------------------------------------ Countdowns */
class FamilienplanerCountdowns extends FpBasis {
  _relevant() { return [this._config.entity].filter(Boolean); }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = t(this._hass);
    const s = this._config.entity && this._hass.states[this._config.entity];
    const liste = (s && s.attributes.liste) || [];
    const kacheln = liste.map((c) => {
      const zahl = c.tage === 0 ? "🎉" : c.tage;
      const unter = c.tage === 0 ? tx.heute : c.tage === 1 ? tx.morgen : tx.tageWort;
      const icon = c.geburtstag ? "mdi:cake-variant" : /ferien|urlaub|holiday|vacation/i.test(c.titel) ? "mdi:beach" : "mdi:star-four-points";
      return `<div class="cd ${c.tage <= 1 ? "bald" : ""}"><div class="zahl">${zahl}</div><div class="unter">${esc(c.tage === 1 ? "" : unter)}${c.tage === 1 ? tx.morgen : ""}</div>
              <div class="was"><ha-icon icon="${icon}"></ha-icon>${esc(c.titel)}</div></div>`;
    }).join("");
    this.shadowRoot.innerHTML = `
      <style>${BASIS_CSS}
        ha-card { padding: 18px 20px; }
        .reihe { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
        .cd { padding: 14px 12px; border-radius: var(--fp-radius-klein); text-align: center; background: color-mix(in srgb, var(--primary-color) 10%, var(--card-background-color, #fff)); }
        .cd.bald { background: color-mix(in srgb, var(--accent-color, #D98E73) 22%, var(--card-background-color, #fff)); }
        .zahl { font-size: 38px; font-weight: 300; line-height: 1; color: var(--primary-text-color); }
        .unter { font-size: 12px; text-transform: uppercase; letter-spacing: .6px; color: var(--secondary-text-color); margin-top: 4px; min-height: 14px; }
        .was { font-size: 14px; font-weight: 600; margin-top: 8px; display: flex; gap: 4px; justify-content: center; align-items: center; color: var(--primary-text-color); }
        .was ha-icon { --mdc-icon-size: 16px; color: var(--secondary-text-color); flex: 0 0 auto; }
      </style>
      <ha-card>
        <div class="titel"><ha-icon icon="mdi:timer-sand"></ha-icon>${tx.countdowns}</div>
        ${kacheln ? `<div class="reihe">${kacheln}</div>` : `<div class="leer">${tx.cdLeer}</div>`}
      </ha-card>`;
  }
}


/* ------------------------------------------------------- Schnell eintragen */
async function terminAusSatz(hass, text) {
  const antwort = await hass.callWS({
    type: "call_service", domain: "familienplaner", service: "termin_aus_satz",
    service_data: { text }, return_response: true,
  });
  return (antwort && antwort.response) || {};
}

function schnellHtml(tx, platzhalter) {
  return `<form class="schnell"><input type="text" enterkeyhint="send" placeholder="${esc(platzhalter)}" aria-label="${esc(platzhalter)}">
    <button type="submit"><ha-icon icon="mdi:calendar-plus"></ha-icon><span>${esc(tx.eintragen)}</span></button></form>
    <div class="rueckmeldung"></div>`;
}
const SCHNELL_CSS = `
  .schnell { display: flex; gap: 8px; }
  .schnell input { flex: 1; min-width: 0; font: inherit; font-size: 17px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--divider-color, #ddd);
                   background: var(--card-background-color, #fff); color: var(--primary-text-color); outline: none; }
  .schnell input:focus { border-color: var(--fp-akzent, var(--primary-color)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--fp-akzent, var(--primary-color)) 25%, transparent); }
  .schnell button { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 14px; padding: 0 18px; font: inherit; font-weight: 700; font-size: 16px;
                    cursor: pointer; color: #fff; background: var(--fp-akzent, var(--primary-color)); }
  .schnell button ha-icon { --mdc-icon-size: 20px; }
  .rueckmeldung { min-height: 20px; margin-top: 8px; font-size: 14px; color: var(--secondary-text-color); }
  .rueckmeldung.ok { color: var(--success-color, #2E7D32); font-weight: 600; }
  .rueckmeldung.fehler { color: var(--error-color, #B3261E); font-weight: 600; }
  @media (max-width: 420px) { .schnell button span { display: none; } }
`;

function schnellVerbinden(root, hass, praefix = "") {
  const form = root.querySelector(".schnell");
  const meldung = root.querySelector(".rueckmeldung");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    form.querySelector("button").disabled = true;
    try {
      const nameDrin = praefix && text.toLowerCase().includes(praefix.toLowerCase());
      const r = await terminAusSatz(hass(), praefix && !nameDrin ? `${praefix} ${text}` : text);
      meldung.className = "rueckmeldung " + (r.verstanden ? "ok" : "fehler");
      meldung.textContent = (r.verstanden ? "✓ " : "") + (r.antwort || "");
      if (r.verstanden) input.value = "";
    } catch (err) {
      meldung.className = "rueckmeldung fehler";
      meldung.textContent = err && err.message ? err.message : String(err);
    }
    form.querySelector("button").disabled = false;
    setTimeout(() => { meldung.textContent = ""; meldung.className = "rueckmeldung"; }, 8000);
  });
}

class FamilienplanerSchnell extends FpBasis {
  getCardSize() { return 2; }
  _render() {
    if (!this.shadowRoot || !this._hass || this.shadowRoot.querySelector(".schnell")) return;
    const tx = t(this._hass);
    this.shadowRoot.innerHTML = `<style>${BASIS_CSS}${SCHNELL_CSS} ha-card { padding: 18px 20px; }</style>
      <ha-card><div class="titel"><ha-icon icon="mdi:lightning-bolt"></ha-icon>${esc(this._config.titel || tx.schnellTitel)}</div>
      ${schnellHtml(tx, tx.schnellHinweis)}</ha-card>`;
    schnellVerbinden(this.shadowRoot, () => this._hass);
  }
}

/* ------------------------------------------------- Heute / persönlicher Bereich
 * custom:familienplaner-fokus
 *   personen: [{slug, name, farbe, person, sensor, kalender, liste}]
 *   familie:  {kalender, liste}
 * „Alle“ gewählt  -> Zeitleiste für heute (alle Personen, Jetzt-Linie)
 * Person gewählt  -> deren nächste 7 Tage, Aufgaben zum Abhaken, Schnell-Eintrag
 */
function zeitVon(iso, sprache) {
  return new Date(iso).toLocaleTimeString(sprache || "de", { hour: "2-digit", minute: "2-digit" });
}

class FamilienplanerFokus extends FpBasis {
  connectedCallback() {
    this._wechsel = () => { this._daten = null; this._render(true); };
    window.addEventListener("familienplaner-person", this._wechsel);
    this._uhr = setInterval(() => this._render(true), 60000);
  }
  disconnectedCallback() {
    window.removeEventListener("familienplaner-person", this._wechsel);
    clearInterval(this._uhr);
  }
  getCardSize() { return 6; }
  _relevant() {
    const p = this._person();
    if (!p) return (this._config.personen || []).map((x) => x.sensor).filter(Boolean);
    return [p.sensor, p.liste, p.kalender].filter(Boolean);
  }
  _person() {
    const slug = window.familienplaner.person;
    return (this._config.personen || []).find((p) => p.slug === slug) || null;
  }

  _render(neuLaden = false) {
    if (!this.shadowRoot || !this._hass) return;
    const p = this._person();
    if (!p) return this._heute();
    if (neuLaden || !this._daten || this._daten.slug !== p.slug || Date.now() - this._daten.zeit > 60000) this._laden(p);
    this._persoenlich(p);
  }

  // ---------------------------------------------------------------- Alle: heute
  _heute() {
    const tx = t(this._hass);
    const sprache = this._hass.language;
    const farbe = {};
    const namen = {};
    for (const p of this._config.personen || []) { farbe[p.slug] = p.farbe; namen[p.slug] = p.name; }
    const gesehen = new Map();
    for (const p of this._config.personen || []) {
      const s = p.sensor && this._hass.states[p.sensor];
      for (const e of (s && s.attributes.heute) || []) {
        const key = `${e.titel}|${e.start}`;
        const wer = e.person === "familie" ? "familie" : p.slug;
        if (!gesehen.has(key)) gesehen.set(key, { ...e, wer: new Set() });
        gesehen.get(key).wer.add(wer);
      }
    }
    const liste = [...gesehen.values()].sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const ganz = liste.filter((e) => e.ganztag);
    const zeit = liste.filter((e) => !e.ganztag);
    const jetzt = new Date();
    let linieGesetzt = false;
    const zeilen = [];
    for (const e of zeit) {
      const start = new Date(e.start);
      const ende = new Date(e.ende);
      if (!linieGesetzt && start > jetzt) {
        zeilen.push(`<div class="jetzt"><span>${esc(tx.jetzt)} ${esc(jetzt.toLocaleTimeString(sprache || "de", { hour: "2-digit", minute: "2-digit" }))}</span></div>`);
        linieGesetzt = true;
      }
      const vorbei = ende <= jetzt;
      const laeuft = start <= jetzt && jetzt < ende;
      const punkte = [...e.wer].map((w) => `<span class="avatar-klein" style="--farbe:${esc(w === "familie" ? "#8C7B6B" : farbe[w] || "#888")}" title="${esc(w === "familie" ? tx.familie : namen[w] || w)}">${w === "familie" ? "♥" : esc((namen[w] || w).charAt(0).toUpperCase())}</span>`).join("");
      const balken = [...e.wer].map((w) => (w === "familie" ? "#8C7B6B" : farbe[w] || "#888"))[0];
      zeilen.push(`<div class="eintrag ${vorbei ? "vorbei" : ""} ${laeuft ? "laeuft" : ""}" style="--farbe:${esc(balken)}">
        <div class="uhrzeit">${esc(zeitVon(e.start, sprache))}<small>${esc(zeitVon(e.ende, sprache))}</small></div>
        <div class="inhalt"><div class="was">${esc(e.titel)}</div>
          <div class="details">${e.ort ? `<span><ha-icon icon="mdi:map-marker-outline"></ha-icon>${esc(e.ort)}</span>` : ""}${e.fahrer ? `<span><ha-icon icon="mdi:car"></ha-icon>${esc(e.fahrer)}</span>` : ""}</div></div>
        <div class="wer">${punkte}</div></div>`);
    }
    if (!linieGesetzt && zeit.length) zeilen.push(`<div class="jetzt"><span>${esc(tx.jetzt)}</span></div>`);
    const chips = ganz.map((e) => `<span class="ganz">${esc(e.titel)}</span>`).join("");
    this.shadowRoot.innerHTML = `<style>${BASIS_CSS}${FOKUS_CSS}</style>
      <ha-card><div class="titel"><ha-icon icon="mdi:timeline-clock-outline"></ha-icon>${esc(tx.heuteTitel)}</div>
        ${chips ? `<div class="ganzzeile"><span class="ganzlabel">${esc(tx.ganztags)}</span>${chips}</div>` : ""}
        ${zeit.length ? `<div class="zeitleiste">${zeilen.join("")}</div>` : (chips ? "" : `<div class="leer gross">${esc(tx.heuteFrei)}</div>`)}
      </ha-card>`;
  }

  // ------------------------------------------------------- Person: persönlich
  async _laden(p) {
    const hass = this._hass;
    const start = new Date();
    const ende = new Date(start.getTime() + 7 * 86400000);
    const kalender = [p.kalender, this._config.familie && this._config.familie.kalender].filter(Boolean);
    const daten = { slug: p.slug, zeit: Date.now(), termine: [], aufgaben: [] };
    this._daten = daten;
    try {
      const listen = await Promise.all(kalender.map((k) => hass.callApi("GET", `calendars/${k}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`).catch(() => [])));
      daten.termine = listen.flat().map((e) => ({
        titel: e.summary, ort: e.location || "", beschreibung: e.description || "",
        start: e.start.dateTime || e.start.date, ende: e.end.dateTime || e.end.date, ganztag: !e.start.dateTime,
      })).sort((a, b) => String(a.start).localeCompare(String(b.start)));
    } catch (e) { /* ohne Kalender */ }
    if (p.liste) {
      try {
        const r = await hass.callWS({ type: "todo/item/list", entity_id: p.liste });
        daten.aufgaben = (r.items || []).filter((i) => i.status === "needs_action");
      } catch (e) { /* ohne Liste */ }
    }
    if (this._daten === daten) this._persoenlich(p);
  }

  _persoenlich(p) {
    // nicht neu zeichnen, während jemand tippt
    const fokus = this.shadowRoot.activeElement;
    if (fokus && fokus.tagName === "INPUT" && this._gezeichnet === p.slug) return;
    this._gezeichnet = p.slug;
    const tx = t(this._hass);
    const sprache = this._hass.language || "de";
    const d = this._daten && this._daten.slug === p.slug ? this._daten : { termine: [], aufgaben: [] };
    const pe = p.person && this._hass.states[p.person];
    const bild = pe && pe.attributes.entity_picture;
    const tage = new Map();
    for (const e of d.termine.slice(0, 14)) {
      const tag = new Date(e.ganztag ? e.start + "T00:00" : e.start);
      const key = tag.toDateString();
      if (!tage.has(key)) tage.set(key, { tag, liste: [] });
      tage.get(key).liste.push(e);
    }
    const heute = new Date().toDateString();
    const morgen = new Date(Date.now() + 86400000).toDateString();
    const termine = [...tage.values()].map(({ tag, liste }) => {
      const k = tag.toDateString();
      const label = k === heute ? tx.heute : k === morgen ? tx.morgen : `${tx.tage[tag.getDay()]}, ${tag.getDate()}.${tag.getMonth() + 1}.`;
      return `<div class="tag"><div class="taglabel">${esc(label)}</div>${liste.map((e) => {
        const fahrer = (/fahrer:\s*([^\s,]+)/i.exec(e.beschreibung) || [])[1];
        return `<div class="ptermin"><span class="pzeit">${e.ganztag ? "●" : esc(zeitVon(e.start, sprache))}</span><span class="ptitel">${esc(e.titel)}</span>
          ${e.ort ? `<span class="pmeta"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${esc(e.ort)}</span>` : ""}${fahrer ? `<span class="pmeta"><ha-icon icon="mdi:car"></ha-icon>${esc(fahrer)}</span>` : ""}</div>`;
      }).join("")}</div>`;
    }).join("");
    const aufgaben = d.aufgaben.map((a) => `<button class="aufgabe" data-uid="${esc(a.uid)}"><span class="kreis"></span><span>${esc(a.summary)}</span></button>`).join("");
    this.shadowRoot.innerHTML = `<style>${BASIS_CSS}${FOKUS_CSS}${SCHNELL_CSS}</style>
      <ha-card class="persoenlich" style="--farbe:${esc(p.farbe || "#5B8DB8")};--fp-akzent:${esc(p.farbe || "#5B8DB8")}">
        <div class="kopf">
          <div class="pavatar">${bild ? `<img src="${esc(bild)}" alt="">` : esc((p.name || "?").charAt(0).toUpperCase())}</div>
          <div class="gruss">${esc(tx.hallo)} ${esc(p.name)} 👋</div>
          <button class="zurueck" title="${esc(tx.zurueck)}"><ha-icon icon="mdi:close"></ha-icon><span>${esc(tx.zurueck)}</span></button>
        </div>
        ${schnellHtml(tx, `${tx.schnellFuer} ${p.name} …`)}
        <div class="spalten">
          <div><div class="titel"><ha-icon icon="mdi:calendar-account"></ha-icon>${esc(tx.deineTermine)}</div>
            ${termine || `<div class="leer gross">${esc(tx.keineTermine)}</div>`}</div>
          ${p.liste ? `<div><div class="titel"><ha-icon icon="mdi:checkbox-marked-circle-outline"></ha-icon>${esc(tx.deineAufgaben)}</div>
            <div class="aufgaben">${aufgaben || `<div class="leer gross">${esc(tx.keineAufgaben)}</div>`}</div>
            <form class="neu"><input type="text" placeholder="${esc(tx.aufgabeNeu)}" enterkeyhint="done"></form></div>` : ""}
        </div>
      </ha-card>`;
    const root = this.shadowRoot;
    root.querySelector(".zurueck").addEventListener("click", () => window.familienplaner.personSetzen("familie"));
    schnellVerbinden(root, () => this._hass, p.name);
    root.querySelectorAll(".aufgabe").forEach((el) => el.addEventListener("click", async () => {
      el.classList.add("erledigt");
      await this._hass.callService("todo", "update_item", { entity_id: p.liste, item: el.dataset.uid, status: "completed" });
      setTimeout(() => this._laden(p), 600);
    }));
    const neu = root.querySelector(".neu");
    if (neu) neu.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = neu.querySelector("input");
      if (!input.value.trim()) return;
      await this._hass.callService("todo", "add_item", { entity_id: p.liste, item: input.value.trim() });
      input.value = "";
      this._laden(p);
    });
  }
}

const FOKUS_CSS = `
  ha-card { padding: 20px 22px; }
  .leer.gross { font-size: 16px; padding: 12px 0; }
  .ganzzeile { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
  .ganzlabel { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--secondary-text-color); }
  .ganz { padding: 5px 12px; border-radius: 999px; font-weight: 600; font-size: 14px; background: color-mix(in srgb, var(--primary-color) 14%, transparent); }
  .zeitleiste { display: flex; flex-direction: column; gap: 8px; }
  .eintrag { display: grid; grid-template-columns: 64px 1fr auto; gap: 14px; align-items: center; padding: 10px 14px; border-radius: 16px;
             background: color-mix(in srgb, var(--farbe) 9%, var(--card-background-color, #fff)); border-left: 6px solid var(--farbe); }
  .eintrag.vorbei { opacity: .45; }
  .eintrag.laeuft { background: color-mix(in srgb, var(--farbe) 22%, var(--card-background-color, #fff)); box-shadow: 0 4px 14px color-mix(in srgb, var(--farbe) 30%, transparent); }
  .uhrzeit { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.1; }
  .uhrzeit small { display: block; font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
  .was { font-size: 18px; font-weight: 650; }
  .details { display: flex; gap: 12px; flex-wrap: wrap; font-size: 13.5px; color: var(--secondary-text-color); margin-top: 2px; }
  .details span, .pmeta { display: inline-flex; gap: 3px; align-items: center; }
  .details ha-icon, .pmeta ha-icon { --mdc-icon-size: 15px; }
  .wer { display: flex; }
  .avatar-klein { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 700; font-size: 14px;
                  background: var(--farbe); border: 2px solid var(--card-background-color, #fff); margin-left: -8px; }
  .jetzt { display: flex; align-items: center; gap: 8px; color: var(--error-color, #DB4437); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; }
  .jetzt::after { content: ""; flex: 1; height: 2px; background: currentColor; border-radius: 2px; }
  .persoenlich { background: linear-gradient(160deg, color-mix(in srgb, var(--farbe) 16%, var(--card-background-color, #fff)), var(--card-background-color, #fff) 55%); }
  .kopf { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; }
  .pavatar { width: 64px; height: 64px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--farbe); color: #fff; font-size: 28px; font-weight: 700;
             box-shadow: 0 6px 18px color-mix(in srgb, var(--farbe) 45%, transparent); }
  .pavatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
  .gruss { font-size: clamp(22px, 3vw, 32px); font-weight: 750; flex: 1; }
  .zurueck { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; font: inherit; font-weight: 700; padding: 10px 16px; border-radius: 999px;
             background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); color: var(--primary-text-color); }
  .zurueck ha-icon { --mdc-icon-size: 20px; }
  .spalten { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; margin-top: 10px; }
  .tag { margin-bottom: 12px; }
  .taglabel { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .7px; color: color-mix(in srgb, var(--farbe) 70%, var(--primary-text-color)); margin-bottom: 4px; }
  .ptermin { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; padding: 8px 0; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.08)); }
  .pzeit { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 48px; color: var(--farbe); }
  .ptitel { font-size: 17px; font-weight: 600; }
  .pmeta { font-size: 13px; color: var(--secondary-text-color); }
  .aufgaben { display: flex; flex-direction: column; gap: 8px; }
  .aufgabe { display: flex; align-items: center; gap: 14px; width: 100%; text-align: left; border: 0; cursor: pointer; font: inherit; font-size: 17px; font-weight: 600;
             padding: 14px 16px; border-radius: 16px; color: var(--primary-text-color); background: color-mix(in srgb, var(--farbe) 10%, var(--card-background-color, #fff)); transition: all .3s ease; }
  .kreis { width: 26px; height: 26px; flex: none; border-radius: 50%; border: 3px solid var(--farbe); transition: all .3s ease; }
  .aufgabe.erledigt { opacity: .4; text-decoration: line-through; }
  .aufgabe.erledigt .kreis { background: var(--farbe); }
  .neu input { width: 100%; box-sizing: border-box; margin-top: 8px; font: inherit; font-size: 16px; padding: 12px 14px; border-radius: 14px;
               border: 1px dashed var(--divider-color, #ccc); background: transparent; color: var(--primary-text-color); outline: none; }
`;

const KARTEN = [
  ["familienplaner-kopf", FamilienplanerKopf, "Familienplaner: Kopfzeile", "Uhr, Datum, Wetter, Müll & Ferien"],
  ["familienplaner-personen", FamilienplanerPersonen, "Familienplaner: Personen", "Nächster Termin, Countdown, Anwesenheit"],
  ["familienplaner-pinnwand", FamilienplanerPinnwand, "Familienplaner: Pinnwand", "Notizen als Klebezettel"],
  ["familienplaner-countdowns", FamilienplanerCountdowns, "Familienplaner: Countdowns", "Geburtstage, Urlaub, Feiertage"],
  ["familienplaner-fokus", FamilienplanerFokus, "Familienplaner: Heute / Mein Bereich", "Zeitleiste für alle oder persönlicher Bereich der gewählten Person"],
  ["familienplaner-schnell", FamilienplanerSchnell, "Familienplaner: Schnell eintragen", "Termin in einem Satz eintragen"],
];
window.customCards = window.customCards || [];
for (const [tag, klasse, name, beschreibung] of KARTEN) {
  if (!customElements.get(tag)) customElements.define(tag, klasse);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description: beschreibung });
}
