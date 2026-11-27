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
  _relevant() { return [this._config.wetter, this._config.muell, this._config.ferien].filter(Boolean); }
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
  _relevant() { return (this._config.personen || []).flatMap((p) => [p.sensor, p.person]).filter(Boolean); }
  getCardSize() { return 2; }
  _render() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = t(this._hass);
    const personen = this._config.personen || [];
    const karten = personen.map((p) => {
      const s = p.sensor && this._hass.states[p.sensor];
      const pe = p.person && this._hass.states[p.person];
      const bild = pe && pe.attributes.entity_picture;
      const zuhause = pe ? pe.state === "home" : null;
      const titel = s && !["unknown", "unavailable", ""].includes(s.state) ? s.state : tx.frei;
      const wann = s ? s.attributes.wann || "" : "";
      const bald = /Min|min|läuft|running/.test(wann);
      const fahrer = s && s.attributes.fahrer ? `<span class="fahrer"><ha-icon icon="mdi:car"></ha-icon>${esc(s.attributes.fahrer)}</span>` : "";
      return `
        <div class="person" style="--farbe:${esc(p.farbe || "#5B8DB8")}" data-id="${esc(p.sensor || "")}">
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
      </style>
      <div class="gitter">${karten.join("")}</div>`;
    this.shadowRoot.querySelectorAll("[data-id]").forEach((el) => el.addEventListener("click", () => mehrInfo(this, el.dataset.id)));
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

const KARTEN = [
  ["familienplaner-kopf", FamilienplanerKopf, "Familienplaner: Kopfzeile", "Uhr, Datum, Wetter, Müll & Ferien"],
  ["familienplaner-personen", FamilienplanerPersonen, "Familienplaner: Personen", "Nächster Termin, Countdown, Anwesenheit"],
  ["familienplaner-pinnwand", FamilienplanerPinnwand, "Familienplaner: Pinnwand", "Notizen als Klebezettel"],
  ["familienplaner-countdowns", FamilienplanerCountdowns, "Familienplaner: Countdowns", "Geburtstage, Urlaub, Feiertage"],
];
window.customCards = window.customCards || [];
for (const [tag, klasse, name, beschreibung] of KARTEN) {
  if (!customElements.get(tag)) customElements.define(tag, klasse);
  if (!window.customCards.some((c) => c.type === tag)) window.customCards.push({ type: tag, name, description: beschreibung });
}
