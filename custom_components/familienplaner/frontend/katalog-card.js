/*
 * Familienplaner – Aufgaben-Katalog („katalog-card“)
 *
 * Vorgefertigte Haushaltsaufgaben als große Bild-Kacheln. Antippen = die Aufgabe landet in der
 * eigenen Liste (fällig heute, mit Punkten). Eltern (Admins) können sie auch anderen geben.
 * Deutsch und Englisch.
 *
 *   type: custom:katalog-card
 *   # optional: entity: sensor.familienplaner_familien_rennen, bereich: kueche
 */

(() => {
  const EMOJI_START = /^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*️?)\s*/u;

  const TEXTE = {
    de: {
      titel: "Aufgaben nehmen",
      text: "Person antippen, dann eine oder mehrere Aufgaben auswählen und eintragen.",
      eintragen: (n, wer) => `${n} ${n === 1 ? "Aufgabe" : "Aufgaben"} für ${wer} eintragen`,
      leeren: "Auswahl leeren",
      fertig: (n, wer) => `✓ ${n} ${n === 1 ? "Aufgabe" : "Aufgaben"} bei ${wer} eingetragen`,
      fuer: "Für",
      alle: "Alle",
      genommen: "In der Liste!",
      fehler: "Hat nicht geklappt",
      fehlt: "Familien-Rennen nicht gefunden",
      wer: "Bitte zuerst eine Person wählen",
      bereiche: { kueche: "Küche", putzen: "Putzen", waesche: "Wäsche", ordnung: "Ordnung", draussen: "Draußen", tiere: "Tiere", sonstiges: "Sonstiges" },
    },
    en: {
      titel: "Pick a task",
      text: "Tap a person, pick one or more tasks, then add them.",
      eintragen: (n, wer) => `Add ${n} ${n === 1 ? "task" : "tasks"} for ${wer}`,
      leeren: "Clear selection",
      fertig: (n, wer) => `✓ ${n} ${n === 1 ? "task" : "tasks"} added for ${wer}`,
      fuer: "For",
      alle: "All",
      genommen: "On the list!",
      fehler: "That didn't work",
      fehlt: "Family race not found",
      wer: "Please choose a person first",
      bereiche: { kueche: "Kitchen", putzen: "Cleaning", waesche: "Laundry", ordnung: "Tidying", draussen: "Outside", tiere: "Pets", sonstiges: "Other" },
    },
  };
  const BEREICH_ICON = { kueche: "🍽️", putzen: "🧹", waesche: "🧺", ordnung: "🧸", draussen: "🌳", tiere: "🐾", sonstiges: "⭐" };

  function sprache(hass) {
    const l = (hass && ((hass.locale && hass.locale.language) || hass.language)) || "de";
    return String(l).toLowerCase().startsWith("de") ? "de" : "en";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function zerlegen(titel) {
    const t = String(titel || "");
    const m = t.match(EMOJI_START);
    return m ? { emoji: m[1], text: t.slice(m[0].length) } : { emoji: "⭐", text: t };
  }

  // Gewählte Person bleibt erhalten, auch wenn Home Assistant die Karte neu aufbaut.
  const WAHL_KEY = "familienplaner-katalog-person";
  function wahlLesen() {
    try { return sessionStorage.getItem(WAHL_KEY); } catch (e) { return null; }
  }
  function wahlSpeichern(slug) {
    try { sessionStorage.setItem(WAHL_KEY, slug); } catch (e) { /* privat */ }
  }

  class KatalogCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._sig = "";
      this._bereich = null;
      this._person = wahlLesen();
      this._auswahl = new Set(); // ausgewählte Aufgaben (keys)
      this._meldung = null;
      this._laeuft = false;
    }

    static getStubConfig() {
      return {};
    }

    setConfig(config) {
      this._config = { ...(config || {}) };
      this._bereich = this._config.bereich || null;
      this._sig = "";
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    connectedCallback() {
      // Personenwahl am Wand-Display (familienplaner-cards.js): die gewählte Person vorauswählen
      this._personHandler =
        this._personHandler ||
        ((e) => {
          const slug = (e && e.detail && e.detail.slug) || null;
          this._geraet = slug && slug !== "familie" ? slug : null;
          if (this._geraet) this._personSetzen(this._geraet);
          this._render(true);
        });
      window.addEventListener("familienplaner-person", this._personHandler);
      const jetzt = window.familienplaner && window.familienplaner.person;
      this._geraet = jetzt && jetzt !== "familie" ? jetzt : null;
      // Eine bereits angetippte Person hat Vorrang vor der Gerätewahl.
      if (this._geraet && !wahlLesen()) this._person = this._geraet;
    }

    disconnectedCallback() {
      window.removeEventListener("familienplaner-person", this._personHandler);
    }

    getCardSize() {
      return 8;
    }

    getGridOptions() {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }

    _entity() {
      if (this._config.entity) return this._config.entity;
      return Object.keys(this._hass.states).find((id) => {
        const a = this._hass.states[id].attributes;
        return id.startsWith("sensor.") && Array.isArray(a.katalog) && Array.isArray(a.fahrer);
      });
    }

    _render(erzwingen) {
      if (!this._hass || !this._config) return;
      const t = TEXTE[sprache(this._hass)];
      const id = this._entity();
      const st = id && this._hass.states[id];
      const katalog = st && st.attributes.katalog;
      if (!katalog) {
        this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card><div class="leer">${esc(t.fehlt)}</div></ha-card>`;
        return;
      }
      const fahrer = (st.attributes.fahrer || []).filter((f) => f.liste);
      const user = this._hass.user || {};
      const ich = fahrer.find((f) => f.user_id && f.user_id === user.id);
      const admin = !!user.is_admin;
      if (!this._person || !fahrer.some((f) => f.slug === this._person)) this._person = ich ? ich.slug : null;
      if (ich && !admin && !this._geraet) this._person = ich.slug; // Kinder tragen nur für sich selbst ein
      const auswahl = admin || !ich || this._geraet ? fahrer : [ich];

      const sig = JSON.stringify([katalog, auswahl.map((f) => [f.slug, f.farbe_hex]), this._bereich, this._person,
        [...this._auswahl], this._meldung, this._laeuft, t.titel]);
      if (sig === this._sig && !erzwingen) return;
      this._sig = sig;

      const bereiche = [...new Set(katalog.map((a) => a.bereich || "sonstiges"))];
      const sichtbar = katalog.filter((a) => !this._bereich || (a.bereich || "sonstiges") === this._bereich);
      const person = fahrer.find((f) => f.slug === this._person);
      const farbe = (person && person.farbe_hex) || "var(--primary-color)";

      const personen =
        auswahl.length > 1 || !ich || this._geraet
          ? `<div class="zeile"><span class="label">${esc(t.fuer)}</span>${auswahl
              .map(
                (f) =>
                  `<button class="chip person ${f.slug === this._person ? "an" : ""}" data-person="${esc(f.slug)}" style="--c:${esc(f.farbe_hex || "#888")}">
                    <span class="punkt"></span>${esc(f.name)}</button>`
              )
              .join("")}</div>`
          : "";
      const filter = `<div class="zeile scroll">
          <button class="chip bereich ${!this._bereich ? "an" : ""}" data-bereich="">${esc(t.alle)}</button>
          ${bereiche
            .map(
              (b) =>
                `<button class="chip bereich ${this._bereich === b ? "an" : ""}" data-bereich="${esc(b)}">${BEREICH_ICON[b] || "⭐"} ${esc(t.bereiche[b] || b)}</button>`
            )
            .join("")}
        </div>`;
      const kacheln = sichtbar
        .map((a) => {
          const z = zerlegen(a.titel);
          const an = this._auswahl.has(a.key);
          return `<button class="kachel ${an ? "an" : ""}" data-key="${esc(a.key)}" aria-pressed="${an}">
              <span class="bild"><span class="emoji">${esc(z.emoji)}</span>${an ? `<span class="marke">✓</span>` : ""}</span>
              <span class="titel">${esc(z.text)}</span>
              ${a.punkte ? `<span class="punkte">⭐ ${esc(a.punkte)}</span>` : ""}
            </button>`;
        })
        .join("");
      const n = this._auswahl.size;
      const leiste =
        n && person
          ? `<div class="leiste"><button class="los" ${this._laeuft ? "disabled" : ""}>${esc(t.eintragen(n, person.name))}</button>
              <button class="leeren" ${this._laeuft ? "disabled" : ""}>${esc(t.leeren)}</button></div>`
          : this._meldung
          ? `<div class="leiste"><span class="meldung ${this._meldung.ok ? "" : "rot"}">${esc(this._meldung.text)}</span></div>`
          : "";

      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <ha-card style="--farbe:${esc(farbe)}">
          <div class="kopf"><span class="name">📋 ${esc(this._config.titel || t.titel)}</span></div>
          <div class="hinweis">${esc(!this._person ? t.wer : t.text)}</div>
          ${personen}
          ${filter}
          <div class="raster">${kacheln}</div>
          ${leiste}
        </ha-card>`;

      this.shadowRoot.querySelectorAll(".chip.person").forEach((b) =>
        b.addEventListener("click", () => {
          this._personSetzen(b.dataset.person);
          this._render(true);
        })
      );
      this.shadowRoot.querySelectorAll(".chip.bereich").forEach((b) =>
        b.addEventListener("click", () => {
          this._bereich = b.dataset.bereich || null;
          this._render(true);
        })
      );
      this.shadowRoot.querySelectorAll(".kachel").forEach((k) => k.addEventListener("click", () => this._umschalten(k.dataset.key)));
      const los = this.shadowRoot.querySelector(".los");
      if (los) los.addEventListener("click", () => this._eintragen());
      const leeren = this.shadowRoot.querySelector(".leeren");
      if (leeren) leeren.addEventListener("click", () => { this._auswahl.clear(); this._render(true); });
    }

    _personSetzen(slug) {
      this._person = slug;
      wahlSpeichern(slug);
    }

    _umschalten(key) {
      if (this._laeuft) return;
      if (this._auswahl.has(key)) this._auswahl.delete(key);
      else this._auswahl.add(key);
      this._meldung = null;
      if (navigator.vibrate) navigator.vibrate(15);
      this._render(true);
    }

    async _eintragen() {
      const slug = this._person;
      const keys = [...this._auswahl];
      if (!slug || !keys.length || this._laeuft) return;
      const id = this._entity();
      const f = ((this._hass.states[id] || {}).attributes.fahrer || []).find((x) => x.slug === slug);
      const wer = (f && f.name) || slug;
      const t = TEXTE[sprache(this._hass)];
      this._laeuft = true;
      this._render(true);
      let ok = 0;
      for (const key of keys) {
        try {
          await this._hass.callService("familienplaner", "aufgabe_nehmen", { aufgabe: key, person: slug });
          ok++;
          this._auswahl.delete(key);
        } catch (e) {
          /* bleibt ausgewählt, damit man es nochmal versuchen kann */
        }
      }
      this._laeuft = false;
      this._meldung = ok === keys.length ? { ok: true, text: t.fertig(ok, wer) } : { ok: false, text: t.fehler };
      if (navigator.vibrate) navigator.vibrate(30);
      this._render(true);
      clearTimeout(this._meldungTimer);
      this._meldungTimer = setTimeout(() => { this._meldung = null; this._render(true); }, 3500);
    }
  }

  const STYLES = `
    :host { --fp-radius: var(--familienplaner-radius, 22px); --fp-radius-klein: var(--familienplaner-radius-klein, 18px);
      --fp-schatten: var(--familienplaner-schatten, 0 6px 20px rgba(0,0,0,.06)); display:block; }
    ha-card { display:block; padding: 14px; border-radius: var(--fp-radius); box-shadow: var(--fp-schatten);
      font-family: var(--familienplaner-schrift, inherit); }
    .kopf { margin: 2px 4px 4px; }
    .name { font-size: 20px; font-weight: 800; color: var(--primary-text-color); }
    .hinweis { margin: 0 4px 10px; color: var(--secondary-text-color); font-size: 14px; }
    .zeile { display:flex; align-items:center; gap: 8px; flex-wrap: wrap; margin: 0 2px 10px; }
    .zeile.scroll { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .zeile.scroll::-webkit-scrollbar { display:none; }
    .label { font-size: 13px; font-weight: 700; color: var(--secondary-text-color); margin-right: 2px; }
    .chip { all: unset; cursor: pointer; white-space: nowrap; display:inline-flex; align-items:center; gap: 6px; padding: 7px 13px;
      border-radius: 999px; font-size: 14px; font-weight: 600; color: var(--primary-text-color);
      background: color-mix(in srgb, var(--secondary-text-color) 9%, var(--card-background-color, #fff)); }
    .chip.an { background: var(--farbe); color: #fff; }
    .chip.person .punkt { width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 2px #fff; }
    .chip.person.an { background: var(--c); }
    .chip:focus-visible, .kachel:focus-visible { outline: 3px solid var(--farbe); outline-offset: 2px; }
    .raster { display:grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 10px; }
    .kachel { all: unset; box-sizing: border-box; cursor: pointer; position: relative; display:flex; flex-direction: column;
      align-items: center; gap: 6px; padding: 12px 8px 10px; border-radius: var(--fp-radius-klein); -webkit-tap-highlight-color: transparent;
      background: color-mix(in srgb, var(--farbe) 9%, var(--card-background-color, #fff));
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--farbe) 18%, transparent); transition: transform .15s ease; }
    .kachel:hover { transform: translateY(-2px); }
    .kachel:active { transform: scale(.95); }
    .bild { position: relative; width: 100%; max-width: 96px; aspect-ratio: 1; border-radius: 50%; display:grid; place-items:center;
      background: color-mix(in srgb, var(--farbe) 16%, var(--card-background-color, #fff)); overflow: hidden; }
    .emoji { font-size: clamp(44px, 10vw, 60px); line-height: 1; filter: drop-shadow(0 3px 3px rgba(0,0,0,.15)); }
    .marke { position:absolute; inset:0; display:grid; place-items:center; font-size: 54px; font-weight: 900; color: #fff;
      background: color-mix(in srgb, #4CAF50 78%, transparent); animation: rein .3s ease; }
    .marke.rot { background: color-mix(in srgb, #D9534F 80%, transparent); }
    .kachel.an { box-shadow: inset 0 0 0 3px var(--farbe); background: color-mix(in srgb, var(--farbe) 22%, var(--card-background-color, #fff)); }
    .kachel.an .marke { animation: rein .25s ease; }
    .leiste { position: sticky; bottom: 8px; z-index: 2; display:flex; gap: 8px; align-items:center; flex-wrap: wrap; margin-top: 12px;
      padding: 8px; border-radius: 20px; background: var(--card-background-color, #fff); box-shadow: 0 4px 18px rgba(0,0,0,.16); }
    .los { all: unset; cursor: pointer; flex: 1 1 220px; text-align:center; padding: 14px 18px; border-radius: 16px; font-size: 16px;
      font-weight: 800; color: #fff; background: var(--farbe); box-shadow: 0 6px 16px color-mix(in srgb, var(--farbe) 40%, transparent); }
    .leeren { all: unset; cursor: pointer; padding: 14px 16px; border-radius: 16px; font-weight: 700; color: var(--primary-text-color);
      background: var(--secondary-background-color, #EFEAE1); }
    .los[disabled], .leeren[disabled] { opacity: .6; cursor: progress; }
    .meldung { flex: 1; padding: 12px 16px; border-radius: 14px; font-weight: 700; background: color-mix(in srgb, #4CAF50 18%, transparent); }
    .meldung.rot { background: color-mix(in srgb, #D9534F 18%, transparent); }
    .titel { font-size: 14px; font-weight: 700; text-align: center; line-height: 1.2; color: var(--primary-text-color);
      display:-webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .punkte { position:absolute; top: 6px; right: 6px; background: #E5BE3C; color: #3B2F00; font-size: 12px; font-weight: 800;
      padding: 2px 7px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    @keyframes pop { 40% { transform: scale(1.08) rotate(-2deg); } }
    @keyframes rein { from { opacity: 0; transform: scale(.4); } }
    .leer { padding: 18px; text-align: center; color: var(--secondary-text-color); }
    @media (max-width: 420px) { .raster { grid-template-columns: repeat(2, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .marke { animation: none; } }
  `;

  if (!customElements.get("katalog-card")) {
    customElements.define("katalog-card", KatalogCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "katalog-card",
      name: "Aufgaben-Katalog (Familienplaner)",
      description: "Vorgefertigte Haushaltsaufgaben zum Selbst-Nehmen, mit großen Bildern und Punkten.",
      preview: true,
    });
  }
})();
