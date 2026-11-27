/*
 * Familienplaner – Wand-Tablet-Modus
 *   custom:familienplaner-wand
 *
 * Unsichtbare Karte. Auf dem Wand-Tablet einmal das Dashboard mit ?wand=1 öffnen
 * (mit ?wand=0 wieder ausschalten). Dann gilt auf diesem Gerät:
 *   - nach X Minuten ohne Berührung: Bildschirmschoner mit Fotos, großer Uhr und den nächsten Terminen
 *   - nachts: Bildschirm dunkel, nur eine gedimmte Uhr (optional Helligkeit des Tablets herunterregeln)
 *   - Bewegungsmelder oder Berührung weckt das Tablet sofort
 * Handys und andere Geräte bleiben unberührt.
 *
 * Optionen:
 *   leerlauf: 5            Minuten bis zum Bildschirmschoner
 *   wechsel: 20            Sekunden pro Foto
 *   fotos:                 "media-source://media_source/local/fotos" oder Liste von Bild-URLs
 *   bewegung:              binary_sensor.… (weckt das Tablet)
 *   helligkeit:            number.… (z. B. Fully Kiosk „Screen brightness“) oder light.…
 *   hell_tag: 200, hell_nacht: 5   Werte für number.* (bei light.* Prozent)
 *   nacht_von: "22:00", nacht_bis: "06:00"
 *   immer: false           true = auf jedem Gerät aktiv (nicht empfohlen)
 *   personen: [{sensor, name, farbe}]  (füllt die Strategie automatisch)
 */

const WAND_KEY = "familienplaner-wand";
const WT = {
  de: { tage: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
        monate: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
        frei: "Heute ist alles frei 🌿", tippen: "Zum Aufwecken antippen" },
  en: { tage: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        monate: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        frei: "Nothing planned 🌿", tippen: "Tap to wake" },
};
const wesc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function wandAktivierenAusUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.get("wand") === "1") localStorage.setItem(WAND_KEY, "1");
    if (p.get("wand") === "0") localStorage.removeItem(WAND_KEY);
    return localStorage.getItem(WAND_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function minuten(hhmm) {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Ein Bildschirmschoner pro Browser-Fenster, unabhängig davon, welche Ansicht gerade offen ist. */
class WandSteuerung {
  constructor() {
    this.config = {};
    this.hass = null;
    this.letzteAktivitaet = Date.now();
    this.sichtbar = false;
    this.fotos = [];
    this.fotoIndex = 0;
    this.fotoZeit = 0;
    this.helligkeitSoll = null;
    this._bauen();
    const wach = () => this.wecken();
    for (const ev of ["pointerdown", "touchstart", "keydown", "wheel"]) window.addEventListener(ev, wach, { passive: true, capture: true });
    setInterval(() => this._takt(), 1000);
  }

  _bauen() {
    const el = document.createElement("div");
    el.id = "familienplaner-wand";
    el.innerHTML = `
      <style>
        #familienplaner-wand { position: fixed; inset: 0; z-index: 2147483000; display: none; cursor: none; color: #fff;
          font-family: var(--familienplaner-schrift, var(--primary-font-family, system-ui, sans-serif)); background: #111;
          opacity: 0; transition: opacity 1.2s ease; -webkit-user-select: none; user-select: none; }
        #familienplaner-wand.an { opacity: 1; }
        #familienplaner-wand .bild { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0; transition: opacity 2.5s ease; transform: scale(1.04); }
        #familienplaner-wand .bild.zeigen { opacity: 1; animation: fp-zoom 30s ease-out forwards; }
        @keyframes fp-zoom { from { transform: scale(1.04); } to { transform: scale(1.12); } }
        #familienplaner-wand .verlauf { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.05) 35%, rgba(0,0,0,.65)); }
        #familienplaner-wand .ohnefoto { position: absolute; inset: 0; background: radial-gradient(circle at 20% 20%, #3b5b4a, transparent 55%), radial-gradient(circle at 80% 70%, #5b4a6b, transparent 55%), #1d2326; }
        #familienplaner-wand .inhalt { position: absolute; left: 5vw; right: 5vw; bottom: 6vh; display: flex; justify-content: space-between; align-items: flex-end; gap: 4vw; flex-wrap: wrap; text-shadow: 0 2px 18px rgba(0,0,0,.45); }
        #familienplaner-wand .uhr { font-size: clamp(80px, 16vw, 220px); font-weight: 200; letter-spacing: -.04em; line-height: .9; }
        #familienplaner-wand .datum { font-size: clamp(22px, 3.2vw, 44px); font-weight: 500; margin-top: 1vh; opacity: .95; }
        #familienplaner-wand .termine { display: flex; flex-direction: column; gap: 10px; min-width: min(420px, 90vw); }
        #familienplaner-wand .termin { display: flex; align-items: center; gap: 14px; padding: 12px 18px; border-radius: 18px;
          background: rgba(20,20,20,.38); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); font-size: clamp(16px, 1.9vw, 24px); }
        #familienplaner-wand .punkt { width: 14px; height: 14px; border-radius: 50%; flex: none; background: var(--f); box-shadow: 0 0 0 4px color-mix(in srgb, var(--f) 35%, transparent); }
        #familienplaner-wand .wann { margin-left: auto; opacity: .8; font-size: .85em; white-space: nowrap; }
        #familienplaner-wand .hinweis { position: absolute; top: 3vh; right: 4vw; font-size: 14px; opacity: .55; }
        #familienplaner-wand.nacht { background: #000; }
        #familienplaner-wand.nacht .bild, #familienplaner-wand.nacht .verlauf, #familienplaner-wand.nacht .ohnefoto,
        #familienplaner-wand.nacht .termine, #familienplaner-wand.nacht .hinweis { display: none; }
        #familienplaner-wand.nacht .inhalt { inset: 0; justify-content: center; align-items: center; text-align: center; }
        #familienplaner-wand.nacht .uhr, #familienplaner-wand.nacht .datum { color: #9a8f86; opacity: .35; text-shadow: none; }
      </style>
      <div class="ohnefoto"></div><div class="bild"></div><div class="bild"></div><div class="verlauf"></div>
      <div class="hinweis"></div>
      <div class="inhalt"><div><div class="uhr"></div><div class="datum"></div></div><div class="termine"></div></div>`;
    document.body.appendChild(el);
    this.el = el;
    this.bilder = el.querySelectorAll(".bild");
    // Tippen auf den Schoner weckt nur – es löst keinen Klick im Dashboard darunter aus
    el.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); }, true);
  }

  aktualisieren(config, hass) {
    const neueFotos = JSON.stringify(config.fotos) !== JSON.stringify(this.config.fotos);
    const alteBewegung = this.config.bewegung && this.hass && this.hass.states[this.config.bewegung];
    this.config = { leerlauf: 5, wechsel: 20, nacht_von: "22:00", nacht_bis: "06:00", hell_tag: 200, hell_nacht: 5, ...config };
    const erstesMal = !this.hass;
    this.hass = hass;
    if (neueFotos || erstesMal) this._fotosLaden();
    const b = this.config.bewegung && hass.states[this.config.bewegung];
    if (b && b.state === "on" && (!alteBewegung || alteBewegung.state !== "on")) this.wecken();
  }

  istNacht() {
    const d = new Date();
    const jetzt = d.getHours() * 60 + d.getMinutes();
    const von = minuten(this.config.nacht_von);
    const bis = minuten(this.config.nacht_bis);
    return von <= bis ? jetzt >= von && jetzt < bis : jetzt >= von || jetzt < bis;
  }

  wecken() {
    this.letzteAktivitaet = Date.now();
    if (this.sichtbar) this._verstecken();
    this._helligkeit(true);
  }

  _takt() {
    if (!this.hass) return;
    const leerlaufMs = Number(this.config.leerlauf || 5) * 60000;
    const nacht = this.istNacht();
    if (!this.sichtbar && Date.now() - this.letzteAktivitaet >= leerlaufMs) this._zeigen();
    if (this.sichtbar) {
      this.el.classList.toggle("nacht", nacht);
      this._helligkeit(!nacht);
      this._uhr();
      if (!nacht && Date.now() - this.fotoZeit >= Number(this.config.wechsel || 20) * 1000) this._naechstesFoto();
      if (Date.now() % 30000 < 1000) this._termine();
    }
  }

  _zeigen() {
    this.sichtbar = true;
    this.el.style.display = "block";
    requestAnimationFrame(() => this.el.classList.add("an"));
    this._uhr();
    this._termine();
    this.fotoZeit = 0;
  }

  _verstecken() {
    this.sichtbar = false;
    this.el.classList.remove("an");
    setTimeout(() => { if (!this.sichtbar) this.el.style.display = "none"; }, 1200);
  }

  _text() {
    return WT[(this.hass && this.hass.language || "de").startsWith("de") ? "de" : "en"];
  }

  _uhr() {
    const d = new Date();
    const tx = this._text();
    this.el.querySelector(".uhr").textContent = d.toLocaleTimeString(this.hass.language || "de", { hour: "2-digit", minute: "2-digit" });
    this.el.querySelector(".datum").textContent = `${tx.tage[d.getDay()]}, ${d.getDate()}. ${tx.monate[d.getMonth()]}`;
    this.el.querySelector(".hinweis").textContent = tx.tippen;
  }

  _termine() {
    const tx = this._text();
    const zeilen = (this.config.personen || [])
      .map((p) => ({ p, s: this.hass.states[p.sensor] }))
      .filter(({ s }) => s && s.attributes.start && !["unknown", "unavailable"].includes(s.state))
      .sort((a, b) => String(a.s.attributes.start).localeCompare(String(b.s.attributes.start)))
      .slice(0, 4)
      .map(({ p, s }) => `<div class="termin" style="--f:${wesc(p.farbe || "#8C7B6B")}"><span class="punkt"></span>
          <span><b>${wesc(p.name)}</b> · ${wesc(s.state)}</span><span class="wann">${wesc(s.attributes.wann || "")}</span></div>`);
    this.el.querySelector(".termine").innerHTML = zeilen.length ? zeilen.join("") : `<div class="termin">${tx.frei}</div>`;
  }

  async _fotosLaden() {
    const f = this.config.fotos;
    if (Array.isArray(f)) {
      this.fotos = f.map((url) => ({ url }));
    } else if (typeof f === "string" && f.startsWith("media-source://")) {
      try {
        const antwort = await this.hass.callWS({ type: "media_source/browse_media", media_content_id: f });
        this.fotos = (antwort.children || [])
          .filter((c) => c.media_class === "image" || (c.media_content_type || "").startsWith("image"))
          .map((c) => ({ id: c.media_content_id }));
      } catch (e) {
        console.warn("Familienplaner Wand: Fotos konnten nicht geladen werden", e);
        this.fotos = [];
      }
    } else {
      this.fotos = [];
    }
    // zufällige Reihenfolge
    for (let i = this.fotos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.fotos[i], this.fotos[j]] = [this.fotos[j], this.fotos[i]]; }
  }

  async _naechstesFoto() {
    this.fotoZeit = Date.now();
    if (!this.fotos.length) return;
    const foto = this.fotos[this.fotoIndex++ % this.fotos.length];
    let url = foto.url;
    if (!url && foto.id) {
      try {
        url = (await this.hass.callWS({ type: "media_source/resolve_media", media_content_id: foto.id })).url;
      } catch (e) {
        return;
      }
    }
    const vorlader = new Image();
    vorlader.onload = () => {
      const [alt, neu] = this.bilder[0].classList.contains("zeigen") ? [this.bilder[0], this.bilder[1]] : [this.bilder[1], this.bilder[0]];
      neu.style.backgroundImage = `url("${url.replace(/"/g, "%22")}")`;
      neu.classList.remove("zeigen");
      void neu.offsetWidth; // Animation neu starten
      neu.classList.add("zeigen");
      alt.classList.remove("zeigen");
    };
    vorlader.src = url;
  }

  _helligkeit(tag) {
    const e = this.config.helligkeit;
    if (!e || !this.hass || !this.hass.states[e]) return;
    const soll = tag ? "tag" : "nacht";
    if (this.helligkeitSoll === soll) return;
    this.helligkeitSoll = soll;
    const wert = Number(tag ? this.config.hell_tag : this.config.hell_nacht);
    const [domain] = e.split(".");
    if (domain === "light") this.hass.callService("light", "turn_on", { entity_id: e, brightness_pct: Math.min(100, wert) });
    else this.hass.callService(domain === "input_number" ? "input_number" : "number", "set_value", { entity_id: e, value: wert });
  }
}

class FamilienplanerWand extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
  }
  set hass(hass) {
    this._hass = hass;
    if (!this._aktiv) return;
    window.__familienplanerWand.aktualisieren(this._config, hass);
  }
  connectedCallback() {
    this.style.display = "none";
    this._aktiv = wandAktivierenAusUrl() || this._config.immer === true;
    if (this._aktiv && !window.__familienplanerWand) window.__familienplanerWand = new WandSteuerung();
    if (this._aktiv && this._hass) window.__familienplanerWand.aktualisieren(this._config, this._hass);
  }
  getCardSize() { return 0; }
  getGridOptions() { return { rows: 0, columns: 12 }; }
}

if (!customElements.get("familienplaner-wand")) customElements.define("familienplaner-wand", FamilienplanerWand);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "familienplaner-wand")) {
  window.customCards.push({ type: "familienplaner-wand", name: "Familienplaner: Wand-Tablet-Modus", description: "Bildschirmschoner mit Fotos, Nachtdimmung und Aufwecken per Bewegung (mit ?wand=1 aktivieren)" });
}
