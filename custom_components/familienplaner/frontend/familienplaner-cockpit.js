/*
 * Familienplaner – Cockpit
 *
 *   type: custom:familienplaner-cockpit
 *
 * Ein lebendiger Himmel als Hintergrund (Sonnenstand, Wolken, Regen, Schnee, Gewitter, Nebel,
 * Sterne, Sternschnuppen, Polarlicht, Mond mit echter Phase) über einer Landschaft mit Haus, in dem
 * so viele Fenster leuchten, wie Personen zu Hause sind. Davor ein 24-Stunden-Tagesring: ein Ring je
 * Person in ihrer Farbe, jeder Termin ein Bogen, der Zeiger zeigt „jetzt“. Person antippen = nur ihr
 * Tag (gleiche Auswahl wie die übrigen Familienplaner-Karten am Wand-Display).
 *
 * Ohne Angaben liest die Karte alles aus der Familienplaner-Einrichtung. Optional:
 *   hoehe: "calc(100vh - 56px)"    Höhe der Karte (Standard: ganze Ansicht)
 *   polarlicht: true               Polarlicht in klaren Nächten
 *   leistung: auto | voll | sparsam   sparsam = weniger Bilder pro Sekunde (z. B. Raspberry Pi)
 *   animation: true                false = Standbild, jede Minute neu gezeichnet
 *   szene: { wetter: snowy, sonne: -12, temperatur: -3 }   zum Ausprobieren
 */
(() => {
  if (customElements.get("familienplaner-cockpit")) return;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const FAMILIE_FARBE = "#B8A07E";
  const symbol = (t) => (window.familienplaner && window.familienplaner.symbol ? window.familienplaner.symbol(t) : "");
  const hhmm = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const startTag = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  // ------------------------------------------------------------- Farben
  const hex = (h) => {
    if (Array.isArray(h)) return h;
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(h));
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    const s = String(h || "").replace("#", "");
    const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    const n = parseInt(v || "888888", 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const farbeMix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], t))).join(",")})`; };
  const rgbMix = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
  const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const NAMENSFARBEN = { blue: "#3B82F6", pink: "#EC4899", orange: "#F97316", green: "#22C55E", red: "#EF4444", purple: "#A855F7", yellow: "#EAB308", teal: "#14B8A6", cyan: "#06B6D4", brown: "#8B5E3C", grey: "#9CA3AF", "deep-purple": "#7C3AED", indigo: "#6366F1", "light-blue": "#38BDF8", lime: "#84CC16", amber: "#F59E0B", "deep-orange": "#EA580C", "blue-grey": "#64748B" };
  const farbe = (f) => (f && f.startsWith("#") ? f : NAMENSFARBEN[f] || f || "#8C7B6B");

  // Himmel nach Sonnenhöhe (Grad): [Höhe, oben, unten]
  const HIMMEL = [
    [-90, "#02040c", "#070b22"], [-18, "#040820", "#0f1640"], [-9, "#111a48", "#33295e"],
    [-4, "#25336f", "#a5577a"], [0, "#3a58a0", "#ee8a5f"], [5, "#4a7fc8", "#f5bd7c"],
    [14, "#3a8ae0", "#a6d6f6"], [90, "#2b7fdc", "#8fd0f8"],
  ];
  function himmel(elev) {
    for (let i = 1; i < HIMMEL.length; i++) {
      if (elev <= HIMMEL[i][0]) {
        const [e0, o0, u0] = HIMMEL[i - 1], [e1, o1, u1] = HIMMEL[i];
        const t = (elev - e0) / (e1 - e0);
        return [rgbMix(hex(o0), hex(o1), t), rgbMix(hex(u0), hex(u1), t)];
      }
    }
    return [hex(HIMMEL[HIMMEL.length - 1][1]), hex(HIMMEL[HIMMEL.length - 1][2])];
  }

  // ------------------------------------------------------------- Wetter
  const WETTER = {
    "clear-night": ["🌙", "Klar", 0.05], sunny: ["☀️", "Sonnig", 0.05], partlycloudy: ["⛅", "Teils bewölkt", 0.45],
    cloudy: ["☁️", "Bewölkt", 0.9], fog: ["🌫️", "Nebel", 0.6], rainy: ["🌧️", "Regen", 0.85], pouring: ["🌧️", "Starkregen", 1],
    lightning: ["🌩️", "Gewitter", 0.9], "lightning-rainy": ["⛈️", "Gewitter", 1], snowy: ["🌨️", "Schnee", 0.85],
    "snowy-rainy": ["🌨️", "Schneeregen", 0.9], hail: ["🌨️", "Hagel", 0.9], windy: ["🌬️", "Windig", 0.3],
    "windy-variant": ["🌬️", "Windig", 0.6], exceptional: ["⚠️", "Unwetter", 0.9],
  };
  const wetterInfo = (z) => WETTER[z] || ["🌡️", z || "", 0.3];

  // ------------------------------------------------------------- Mond
  function mondPhase(d) {
    const neu = Date.UTC(2000, 0, 6, 18, 14);
    const p = (((d.getTime() - neu) / 86400000) % 29.530588853) / 29.530588853;
    return p < 0 ? p + 1 : p;
  }
  function mondName(p) {
    if (p < 0.03 || p > 0.97) return ["🌑", "Neumond"];
    if (p < 0.22) return ["🌒", "zunehmende Sichel"];
    if (p < 0.28) return ["🌓", "erstes Viertel"];
    if (p < 0.47) return ["🌔", "zunehmend"];
    if (p < 0.53) return ["🌕", "Vollmond"];
    if (p < 0.72) return ["🌖", "abnehmend"];
    if (p < 0.78) return ["🌗", "letztes Viertel"];
    return ["🌘", "abnehmende Sichel"];
  }

  // Zufallszahlen mit festem Startwert, damit Landschaft und Sterne stillhalten
  function zufall(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function wannText(t, jetzt) {
    if (t.start <= jetzt && t.ende > jetzt) {
      const rest = Math.round((t.ende - jetzt) / 60000);
      return rest >= 60 ? `läuft · noch ${Math.floor(rest / 60)} Std ${rest % 60 ? (rest % 60) + " Min" : ""}`.trim() : `läuft · noch ${rest} Min`;
    }
    const min = Math.round((t.start - jetzt) / 60000);
    if (min < 1) return "jetzt";
    if (min < 60) return `in ${min} Min`;
    if (min < 6 * 60) return `in ${Math.floor(min / 60)} Std${min % 60 ? " " + (min % 60) + " Min" : ""}`;
    const heute = startTag(jetzt), tag = startTag(t.start);
    const diff = Math.round((tag - heute) / 86400000);
    if (diff === 0) return `heute ${hhmm(t.start)}`;
    if (diff === 1) return `morgen ${hhmm(t.start)}`;
    return `${TAGE[t.start.getDay()].slice(0, 2)} ${hhmm(t.start)}`;
  }

  const CSS = `
    :host { display: block; --fp-radius: var(--familienplaner-radius, 22px); font-family: var(--familienplaner-schrift, var(--primary-font-family, inherit)); }
    ha-card { position: relative; overflow: hidden; border-radius: var(--fp-radius); background: #070b22; color: #fff;
      height: var(--cockpit-hoehe, calc(100vh - 56px)); min-height: 640px; border: none; isolation: isolate; }
    canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; }
    .ui { position: absolute; inset: 0; z-index: 1; display: grid; gap: 22px; padding: 24px 26px 18px;
      grid-template-columns: minmax(230px, 0.95fr) minmax(0, 1.7fr) minmax(270px, 1fr); grid-template-rows: minmax(0, 1fr) auto; }
    .glas { background: rgba(12, 18, 40, var(--glas-alpha, .34)); border: 1px solid rgba(255,255,255,.14); border-radius: 22px;
      backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%);
      box-shadow: 0 10px 40px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.08); }
    .links, .rechts { display: flex; flex-direction: column; gap: 14px; min-height: 0; }
    .gruss { padding: 6px 4px 4px; text-shadow: 0 2px 18px rgba(0,0,0,.45); }
    .gruss .hallo { font-size: 30px; font-weight: 700; letter-spacing: -.5px; line-height: 1.1; }
    .gruss .unter { font-size: 14px; opacity: .78; margin-top: 4px; letter-spacing: .3px; }
    .personen { display: flex; flex-direction: column; gap: 10px; overflow-y: auto; scrollbar-width: none; padding: 2px; min-height: 0; }
    .personen::-webkit-scrollbar { display: none; }
    .planet { appearance: none; font: inherit; color: inherit; text-align: left; margin: 0; outline: none; cursor: pointer; display: flex; align-items: center; gap: 14px; padding: 10px 14px 10px 10px; border-radius: 20px;
      position: relative; transition: transform .25s cubic-bezier(.2,.9,.3,1.3), background .25s, border-color .25s, opacity .25s; -webkit-tap-highlight-color: transparent; }
    .planet:active { transform: scale(.96); }
    .planet.an { background: color-mix(in srgb, var(--c) 34%, rgba(12,18,40,.45)); border-color: color-mix(in srgb, var(--c) 80%, white); transform: translateX(6px);
      box-shadow: 0 0 0 1px color-mix(in srgb, var(--c) 60%, transparent), 0 12px 40px color-mix(in srgb, var(--c) 35%, transparent); }
    .planet.aus { opacity: .55; }
    .ava { position: relative; width: 54px; height: 54px; flex: none; border-radius: 50%; display: grid; place-items: center;
      background: radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--c) 55%, white), var(--c) 60%, color-mix(in srgb, var(--c) 55%, black));
      font-size: 22px; font-weight: 800; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.35); box-shadow: 0 0 0 3px rgba(255,255,255,.18); }
    .ava img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
    .zuhause .ava::before { content: ""; position: absolute; inset: -5px; border-radius: 50%; border: 2px solid var(--c); animation: puls 2.6s ease-out infinite; }
    @keyframes puls { 0% { transform: scale(.92); opacity: .95; } 100% { transform: scale(1.35); opacity: 0; } }
    .ort { position: absolute; right: -4px; bottom: -4px; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
      font-size: 12px; background: rgba(10,14,32,.85); box-shadow: 0 0 0 2px rgba(255,255,255,.25); }
    .monde { position: absolute; inset: -9px; animation: kreisen var(--dauer, 14s) linear infinite; pointer-events: none; }
    .monde i { position: absolute; left: 50%; top: 0; width: 7px; height: 7px; margin-left: -3.5px; border-radius: 50%; background: #fff;
      box-shadow: 0 0 8px var(--c), 0 0 2px #fff; transform-origin: 3.5px 36px; }
    @keyframes kreisen { to { transform: rotate(360deg); } }
    .txt { display: flex; flex-direction: column; min-width: 0; }
    .txt b { font-size: 18px; font-weight: 700; }
    .txt small { font-size: 13px; opacity: .82; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .alle .ava { background: conic-gradient(from 0deg, var(--farben)); font-size: 24px; }
    .mitte { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; min-width: 0; }
    .ringbox { position: relative; width: 600px; height: 600px; flex: none; }
    svg.ring { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 10px 40px rgba(0,0,0,.35)); }
    svg .bogen { cursor: pointer; transition: opacity .35s, stroke-width .35s; }
    svg .ringgruppe { transition: opacity .4s; }
    svg .ringgruppe.gedimmt { opacity: .14; }
    svg .laeuft { animation: glimmen 2.2s ease-in-out infinite; }
    @keyframes glimmen { 50% { filter: brightness(1.35) drop-shadow(0 0 14px currentColor); } }
    svg .zeiger { transition: transform 1s cubic-bezier(.3,.7,.4,1); transform-origin: 500px 500px; }
    svg .knopf { animation: knopf 2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes knopf { 50% { transform: scale(1.35); } }
    .zentrum { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; padding: 6%; box-sizing: border-box; overflow: hidden; }
    .zentrum.still > * { animation: none; }
    .zentrum > * { animation: rein .45s cubic-bezier(.2,.9,.3,1.2) both; }
    @keyframes rein { from { opacity: 0; transform: translateY(8px) scale(.97); } }
    .uhr { font-size: var(--uhr, 76px); font-weight: 200; letter-spacing: -3px; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 4px 30px rgba(0,0,0,.4); }
    .datum { font-size: max(9px, calc(var(--uhr, 76px) * .24)); font-weight: 600; margin-top: 8px; opacity: .92; }
    .wetter { font-size: max(9px, calc(var(--uhr, 76px) * .22)); margin-top: 10px; opacity: .85; }
    .wetter b { font-weight: 700; }
    .rest { margin-top: 12px; font-size: max(9px, calc(var(--uhr, 76px) * .19)); padding: 6px 14px; border-radius: 99px; background: rgba(255,255,255,.12); }
    .zname { font-size: max(10px, calc(var(--uhr, 76px) * .46)); font-weight: 800; color: var(--c); filter: brightness(1.35); letter-spacing: -.5px; }
    .zsym { font-size: max(10px, calc(var(--uhr, 76px) * .62)); line-height: 1.1; }
    .ztitel { font-size: max(10px, calc(var(--uhr, 76px) * .3)); font-weight: 700; margin-top: 4px; line-height: 1.15; max-width: 100%; overflow-wrap: anywhere; }
    .zzeit { font-size: max(9px, calc(var(--uhr, 76px) * .21)); opacity: .85; margin-top: 6px; }
    .zchip { margin-top: 10px; font-size: max(9px, calc(var(--uhr, 76px) * .2)); padding: 6px 14px; border-radius: 99px; background: color-mix(in srgb, var(--c) 45%, transparent); font-weight: 700; }
    .naechstes { padding: 18px 16px 12px; display: flex; flex-direction: column; min-height: 0; flex: 1; }
    .naechstes h3 { margin: 0 0 12px 4px; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; opacity: .7; font-weight: 700; }
    .liste { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; scrollbar-width: none; min-height: 0; }
    .liste::-webkit-scrollbar { display: none; }
    .tag { font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; opacity: .55; margin: 8px 4px 0; font-weight: 700; }
    .termin { all: unset; cursor: pointer; display: grid; grid-template-columns: 6px 34px 1fr; gap: 10px; align-items: center; padding: 10px 12px 10px 0;
      border-radius: 16px; background: rgba(255,255,255,.06); position: relative; overflow: hidden; transition: background .2s, transform .2s; }
    .termin:hover { background: rgba(255,255,255,.11); }
    .termin:active { transform: scale(.98); }
    .termin .balken { height: 100%; min-height: 40px; background: var(--c); border-radius: 0 6px 6px 0; box-shadow: 0 0 14px var(--c); }
    .termin .sym { font-size: 24px; text-align: center; }
    .termin .t { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .termin .z { font-size: 12.5px; opacity: .78; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .termin .cd { display: inline-block; margin-top: 4px; font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 99px; background: color-mix(in srgb, var(--c) 40%, transparent); }
    .termin .fort { position: absolute; left: 0; bottom: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--c)); box-shadow: 0 0 10px var(--c); }
    .ganztag { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .ganztag span { font-size: 12.5px; padding: 5px 11px; border-radius: 99px; background: color-mix(in srgb, var(--c) 35%, rgba(255,255,255,.08)); border: 1px solid color-mix(in srgb, var(--c) 60%, transparent); }
    .leer { opacity: .7; font-size: 14px; padding: 8px 4px; line-height: 1.5; }
    .leiste { grid-column: 1 / -1; display: flex; gap: 10px; align-items: stretch; overflow-x: auto; scrollbar-width: none; padding: 2px; }
    .leiste::-webkit-scrollbar { display: none; }
    .stunde, .info { flex: none; padding: 9px 14px; border-radius: 16px; text-align: center; min-width: 62px; }
    .stunde .h { font-size: 12px; opacity: .7; }
    .stunde .e { font-size: 22px; line-height: 1.3; }
    .stunde .g { font-size: 15px; font-weight: 700; }
    .stunde .n { font-size: 11px; color: #9fd6ff; }
    .info { display: flex; flex-direction: column; justify-content: center; text-align: left; min-width: 0; }
    .info b { font-size: 15px; } .info small { font-size: 12px; opacity: .72; }
    .luecke { flex: 1; }
    /* schmal: Handy / Hochformat */
    ha-card.schmal { height: auto; min-height: 0; }
    .schmal .ui { position: relative; display: flex; flex-direction: column; padding: 16px; gap: 14px; }
    .schmal .gruss .hallo { font-size: 24px; }
    .schmal .personen { flex-direction: row; overflow-x: auto; }
    .schmal .planet { flex-direction: column; gap: 6px; padding: 8px; min-width: 76px; text-align: center; }
    .schmal .planet.an { transform: translateY(-3px); }
    .schmal .txt small { display: none; }
    .schmal .txt b { font-size: 14px; }
    .schmal .mitte { display: block; }
    .schmal .ringbox { margin: 0 auto; }
    .schmal .naechstes { max-height: none; }
    .schmal .zentrum .wetter, .schmal .zentrum .rest, .schmal .zentrum .zchip ~ .zzeit, .schmal .zentrum .ztitel ~ .zzeit:last-child { display: none; }
    .schmal .zentrum .zsym { display: none; }
    @media (prefers-reduced-motion: reduce) { .monde, .zuhause .ava::before, svg .laeuft, svg .knopf { animation: none; } }
  `;

  class FamilienplanerCockpit extends HTMLElement {
    static getStubConfig() { return {}; }
    getCardSize() { return 12; }
    getGridOptions() { return { columns: "full", rows: 12 }; }

    setConfig(config) {
      this._config = { polarlicht: true, leistung: "auto", animation: true, ...(config || {}) };
      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
        this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card><canvas></canvas><div class="ui">
          <aside class="links"><div class="gruss"><div class="hallo"></div><div class="unter"></div></div><div class="personen"></div></aside>
          <div class="mitte"><div class="ringbox"><svg class="ring" viewBox="0 0 1000 1000"></svg><div class="zentrum"></div></div></div>
          <aside class="rechts"><div class="glas naechstes"><h3>Als Nächstes</h3><div class="ganztag"></div><div class="liste"></div></div></aside>
          <footer class="leiste"></footer></div></ha-card>`;
        const r = this.shadowRoot;
        this._el = { card: r.querySelector("ha-card"), canvas: r.querySelector("canvas"), hallo: r.querySelector(".hallo"), unter: r.querySelector(".unter"),
          personen: r.querySelector(".personen"), mitte: r.querySelector(".mitte"), ringbox: r.querySelector(".ringbox"), svg: r.querySelector("svg"),
          zentrum: r.querySelector(".zentrum"), liste: r.querySelector(".liste"), ganztag: r.querySelector(".ganztag"), leiste: r.querySelector(".leiste") };
        this._el.personen.addEventListener("click", (e) => { const b = e.target.closest(".planet"); if (b) this._waehlen(b.dataset.slug); });
        this._el.svg.addEventListener("click", (e) => { const b = e.target.closest(".bogen"); if (b) this._zeigeTermin(Number(b.dataset.i)); });
        this._el.liste.addEventListener("click", (e) => { const b = e.target.closest(".termin"); if (b) this._zeigeTermin(Number(b.dataset.i)); });
        this._el.zentrum.addEventListener("click", () => { if (this._fokusTermin != null) { this._fokusTermin = null; this._zentrum(); } });
      }
      if (this._config.hoehe) this.style.setProperty("--cockpit-hoehe", this._config.hoehe);
      this._termine = this._termine || [];
      this._szeneNeu = true;
    }

    set hass(hass) {
      const alt = this._hass;
      this._hass = hass;
      if (!this._config) return;
      const ids = this._relevant();
      if (!alt || ids.some((id) => alt.states[id] !== hass.states[id])) {
        this._daten();
        this._szeneAktualisieren();
        this._alles();
        const neu = ids.filter((id) => id.startsWith("sensor.")).map((id) => (hass.states[id] && hass.states[id].attributes.start) || "").join("|");
        if (neu !== this._sensorStand) { this._sensorStand = neu; this._laden(); }
      }
    }

    connectedCallback() {
      this._personWechsel = () => this._alles();
      window.addEventListener("familienplaner-person", this._personWechsel);
      this._sichtWechsel = () => this._schleifeStarten();
      document.addEventListener("visibilitychange", this._sichtWechsel);
      this._ro = new ResizeObserver(() => this._groesse());
      this._ro.observe(this);
      this._io = new IntersectionObserver((e) => { this._sichtbar = e.some((x) => x.isIntersecting); this._schleifeStarten(); });
      this._io.observe(this);
      this._takt = setInterval(() => this._tick(), 15000);
      this._ladeTakt = setInterval(() => this._laden(), 5 * 60000);
      this._wetterTakt = setInterval(() => this._vorhersage(), 30 * 60000);
      this._sichtbar = true;
      if (this._hass) { this._laden(); this._vorhersage(); }
      requestAnimationFrame(() => { this._groesse(); this._schleifeStarten(); });
    }

    disconnectedCallback() {
      window.removeEventListener("familienplaner-person", this._personWechsel);
      document.removeEventListener("visibilitychange", this._sichtWechsel);
      if (this._ro) this._ro.disconnect();
      if (this._io) this._io.disconnect();
      clearInterval(this._takt); clearInterval(this._ladeTakt); clearInterval(this._wetterTakt); clearTimeout(this._fokusTimer);
      cancelAnimationFrame(this._raf); this._raf = null;
    }

    // ----------------------------------------------------------- Daten
    _uebersicht() {
      const h = this._hass;
      if (!h) return null;
      const reg = h.entities || {};
      const ids = Object.keys(h.states).filter((id) => id.startsWith("sensor.") && h.states[id].attributes.personen && h.states[id].attributes.familie);
      const id = ids.find((x) => reg[x] && reg[x].platform === "familienplaner") || ids[0];
      return id ? h.states[id].attributes : null;
    }

    _daten() {
      const c = this._config, u = this._uebersicht() || {};
      this._personen = (c.personen || u.personen || []).map((p) => ({ ...p, farbe: farbe(p.farbe) }));
      const fam = c.familie || u.familie || {};
      this._familie = { name: fam.name || c.titel || "", kalender: fam.kalender, farbe: farbe(fam.farbe || FAMILIE_FARBE) };
      this._wetterId = c.wetter || u.wetter || Object.keys(this._hass.states).find((id) => id.startsWith("weather."));
      this._sonneId = c.sonne || "sun.sun";
    }

    _relevant() {
      if (!this._personen) this._daten();
      return [this._wetterId, this._sonneId, ...this._personen.flatMap((p) => [p.person, p.sensor])].filter(Boolean);
    }

    _auswahl() {
      const s = window.familienplaner && window.familienplaner.person;
      return s && s !== "familie" && this._personen.some((p) => p.slug === s) ? s : "familie";
    }

    _waehlen(slug) {
      this._fokusTermin = null;
      const aktuell = this._auswahl();
      const neu = !slug || slug === "familie" || slug === aktuell ? "familie" : slug;
      if (window.familienplaner && window.familienplaner.personSetzen) window.familienplaner.personSetzen(neu);
      else { window.familienplaner = window.familienplaner || {}; window.familienplaner.person = neu; this._alles(); }
    }

    async _laden() {
      const h = this._hass;
      if (!h || !this._personen) return;
      const heute = startTag(new Date());
      const start = heute, ende = new Date(heute.getTime() + 3 * 86400000);
      const quellen = [];
      for (const p of this._personen) if (p.kalender && h.states[p.kalender]) quellen.push({ kal: p.kalender, slug: p.slug, farbe: p.farbe, name: p.name });
      if (this._familie.kalender && h.states[this._familie.kalender]) quellen.push({ kal: this._familie.kalender, slug: "familie", farbe: this._familie.farbe, name: "Familie" });
      const nummer = (this._ladeNr = (this._ladeNr || 0) + 1);
      let termine;
      if (quellen.length) {
        const listen = await Promise.all(quellen.map((q) => h
          .callApi("GET", `calendars/${q.kal}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`)
          .then((ev) => ev.map((e) => {
            const ganz = !e.start.dateTime;
            return { ...q, titel: e.summary || "", ort: e.location || "", ganz,
              start: ganz ? new Date(e.start.date + "T00:00:00") : new Date(e.start.dateTime),
              ende: ganz ? new Date(e.end.date + "T00:00:00") : new Date(e.end.dateTime) };
          }))
          .catch(() => [])));
        termine = listen.flat();
      } else {
        // Ohne Kalender: die heutigen Termine aus den Personen-Sensoren
        termine = this._personen.flatMap((p) => (((h.states[p.sensor] || {}).attributes || {}).heute || []).map((e) => ({
          slug: p.slug, farbe: p.farbe, name: p.name, titel: e.summary || e.titel || "", ort: e.location || e.ort || "",
          ganz: !!(e.all_day || e.ganztag), start: new Date(e.start), ende: new Date(e.end || e.ende || e.start) })));
      }
      if (nummer !== this._ladeNr) return;
      this._termine = termine.filter((t) => !isNaN(t.start)).sort((a, b) => a.start - b.start || b.ende - a.ende);
      this._alles();
    }

    async _vorhersage() {
      const h = this._hass;
      if (!h || !this._wetterId || !h.states[this._wetterId] || this._config.szene) return;
      for (const typ of ["hourly", "daily"]) {
        try {
          const r = await h.callWS({ type: "call_service", domain: "weather", service: "get_forecasts", service_data: { type: typ },
            target: { entity_id: this._wetterId }, return_response: true });
          const f = r && r.response && r.response[this._wetterId] && r.response[this._wetterId].forecast;
          if (f && f.length) { this._prognose = { typ, liste: f.slice(0, typ === "hourly" ? 9 : 6) }; this._leiste(); return; }
        } catch (e) { /* Wetterdienst kann den Typ nicht */ }
      }
    }

    // ----------------------------------------------------------- Szene
    _sonne(jetzt) {
      const h = this._hass, s = h && h.states[this._sonneId];
      const sz = this._config.szene || {};
      const heute = startTag(jetzt);
      let auf = new Date(heute.getTime() + 7.5 * 3600000), unter = new Date(heute.getTime() + 17 * 3600000);
      if (s) {
        const nr = new Date(s.attributes.next_rising), ns = new Date(s.attributes.next_setting);
        if (!isNaN(nr)) auf = startTag(nr) > heute ? new Date(nr.getTime() - 86400000) : nr;
        if (!isNaN(ns)) unter = startTag(ns) > heute ? new Date(ns.getTime() - 86400000) : ns;
      }
      let elev;
      if (sz.sonne != null) elev = Number(sz.sonne);
      else if (s && s.attributes.elevation != null) elev = Number(s.attributes.elevation);
      else {
        const mitte = (auf.getTime() + unter.getTime()) / 2, halb = (unter - auf) / 2;
        elev = Math.cos(((jetzt - mitte) / halb) * (Math.PI / 2)) * 40 - (Math.abs(jetzt - mitte) > halb ? 20 : 0);
      }
      return { auf, unter, elev };
    }

    _szeneAktualisieren() {
      const h = this._hass, sz = this._config.szene || {};
      const w = h && this._wetterId && h.states[this._wetterId];
      const zustand = sz.wetter || (w ? w.state : "sunny");
      const a = (w && w.attributes) || {};
      const info = wetterInfo(zustand);
      const wolken = a.cloud_coverage != null && !sz.wetter ? clamp(Number(a.cloud_coverage) / 100, 0, 1) : info[2];
      const regen = { rainy: 0.5, pouring: 1, "lightning-rainy": 0.85, "snowy-rainy": 0.4, hail: 0.6 }[zustand] || 0;
      const schnee = { snowy: 0.75, "snowy-rainy": 0.45 }[zustand] || 0;
      const wind = sz.wind != null ? sz.wind : clamp((Number(a.wind_speed) || (zustand.startsWith("windy") ? 35 : 8)) / 45, 0, 1);
      const temp = sz.temperatur != null ? Number(sz.temperatur) : a.temperature != null ? Number(a.temperature) : 12;
      const zuHause = this._personen.filter((p) => p.person && h.states[p.person] && h.states[p.person].state === "home").length;
      this._sz = { zustand, info, wolken, regen, schnee, wind, temp, gewitter: zustand.startsWith("lightning"), nebel: zustand === "fog" ? 1 : 0,
        zuHause, einheit: a.temperature_unit || "°C", feuchte: a.humidity };
      this._szeneNeu = true;
    }

    _groesse() {
      if (!this._el) return;
      const b = this.getBoundingClientRect();
      const schmal = b.width < 900;
      this._el.card.classList.toggle("schmal", schmal);
      const m = this._el.mitte.getBoundingClientRect();
      const groesse = schmal ? Math.min(b.width - 32, 520) : Math.max(260, Math.min(m.width, m.height));
      this._el.ringbox.style.width = this._el.ringbox.style.height = `${Math.floor(groesse)}px`;
      this._ringPx = groesse;
      this._zentrumGroesse();
      const c = this._el.canvas, cb = this._el.card.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, this._sparsam ? 1 : 1.5);
      if (cb.width && (c.width !== Math.round(cb.width * dpr) || c.height !== Math.round(cb.height * dpr))) {
        c.width = Math.round(cb.width * dpr); c.height = Math.round(cb.height * dpr);
        this._dpr = dpr; this._szeneNeu = true;
        if (!this._laeuft()) this._bild(performance.now());
      }
    }

    _laeuft() { return this._config.animation !== false && this._sichtbar && !document.hidden && this.isConnected; }

    _schleifeStarten() {
      if (this._laeuft()) {
        if (!this._raf) { this._letzt = 0; this._raf = requestAnimationFrame((t) => this._frame(t)); }
      } else {
        cancelAnimationFrame(this._raf); this._raf = null;
        if (this.isConnected) this._bild(performance.now());
      }
    }

    _frame(t) {
      if (!this._laeuft()) { this._raf = null; return; }
      this._raf = requestAnimationFrame((x) => this._frame(x));
      const ziel = this._sparsam ? 66 : 33;
      if (this._letzt && t - this._letzt < ziel - 2) return;
      // Automatisch sparsamer werden, wenn das Gerät nicht hinterherkommt
      if (this._config.leistung === "auto" && this._letzt) {
        this._mittel = this._mittel ? this._mittel * 0.95 + (t - this._letzt) * 0.05 : t - this._letzt;
        if (!this._sparsam && this._mittel > 70 && t > 8000) { this._sparsam = true; this._szeneNeu = true; this._groesse(); }
      }
      this._letzt = t;
      this._bild(t);
    }

    _aufbauen(W, H) {
      const z = zufall(20241127);
      const sp = this._sparsam || this._config.leistung === "sparsam";
      this._sterne = Array.from({ length: sp ? 90 : 190 }, () => ({ x: z() * W, y: z() * H * 0.72, r: 0.4 + z() * 1.5, p: z() * 6.28, s: 0.6 + z() * 2 }));
      this._huegel = [0, 1, 2].map((i) => {
        const pts = [], basis = H * (0.8 + i * 0.055), amp = H * (0.05 - i * 0.012);
        const f = [z() * 3 + 1.5, z() * 5 + 3, z() * 9 + 6], ph = [z() * 6, z() * 6, z() * 6];
        for (let x = 0; x <= W + 20; x += 16) {
          const u = x / W;
          pts.push([x, basis - amp * (Math.sin(u * f[0] + ph[0]) * 0.6 + Math.sin(u * f[1] + ph[1]) * 0.3 + Math.sin(u * f[2] + ph[2]) * 0.1)]);
        }
        return pts;
      });
      const hoehe = (i, x) => { const p = this._huegel[i], k = clamp(Math.round(x / 16), 0, p.length - 1); return p[k][1]; };
      this._hausX = W * 0.66; this._hausY = hoehe(1, this._hausX);
      this._baeume = Array.from({ length: sp ? 10 : 18 }, () => { const x = z() * W; return { x, y: hoehe(2, x) + 4, h: H * (0.035 + z() * 0.045) }; })
        .filter((b) => Math.abs(b.x - this._hausX) > W * 0.06);
      const n = Math.ceil(this._sz.wolken * (sp ? 8 : 14)) + 1;
      this._wolken = Array.from({ length: n }, (_, i) => this._wolke(z, W, H, i / n));
      const tropfen = Math.round((this._sz.regen * (sp ? 160 : 360)));
      this._regen = Array.from({ length: tropfen }, () => ({ x: z() * W, y: z() * H, l: 10 + z() * 16, v: 0.9 + z() * 0.6 }));
      const flocken = Math.round(this._sz.schnee * (sp ? 110 : 240));
      this._flocken = Array.from({ length: flocken }, () => ({ x: z() * W, y: z() * H, r: 1 + z() * 2.6, v: 0.25 + z() * 0.5, p: z() * 6.28 }));
      this._rauch = [];
      this._schnuppe = null;
      this._blitz = { naechst: performance.now() + 3000, t: -1e9, pfad: null };
      this._mond = null;
      this._szeneNeu = false;
    }

    _wolke(z, W, H, anteil) {
      const b = 160 + z() * 260, h = b * 0.42;
      const mk = (farbe1, farbe2) => {
        const c = document.createElement("canvas");
        c.width = b; c.height = h;
        const g = c.getContext("2d");
        for (let k = 0; k < 9; k++) {
          const x = b * (0.18 + z() * 0.64), y = h * (0.45 + z() * 0.3), r = h * (0.25 + z() * 0.3);
          const rg = g.createRadialGradient(x, y, 0, x, y, r);
          rg.addColorStop(0, farbe1); rg.addColorStop(0.6, farbe2); rg.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill();
        }
        return c;
      };
      const hell = mk("rgba(255,255,255,.95)", "rgba(250,250,255,.55)");
      const dunkel = mk("rgba(80,88,120,.9)", "rgba(60,66,96,.5)");
      return { hell, dunkel, x: z() * (W + b) - b, y: H * (0.04 + z() * 0.5), tiefe: 0.4 + anteil * 0.6, a: 0.55 + z() * 0.45, b };
    }

    _mondBild(r, phase) {
      const c = document.createElement("canvas");
      c.width = c.height = r * 2 + 4;
      const g = c.getContext("2d"), m = r + 2;
      const rg = g.createRadialGradient(m - r * 0.3, m - r * 0.3, r * 0.1, m, m, r);
      rg.addColorStop(0, "#fffbea"); rg.addColorStop(1, "#d9d3bd");
      g.fillStyle = rg; g.beginPath(); g.arc(m, m, r, 0, 6.29); g.fill();
      g.fillStyle = "rgba(160,150,130,.35)";
      for (const [x, y, s] of [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.1]]) { g.beginPath(); g.arc(m + x * r, m + y * r, s * r, 0, 6.29); g.fill(); }
      // Schatten der Phase
      g.globalCompositeOperation = "destination-out";
      const hell = 1 - Math.abs(phase - 0.5) * 2; // 0 Neumond, 1 Vollmond
      const versatz = (phase < 0.5 ? -1 : 1) * r * 2 * hell;
      if (hell < 0.97) { g.beginPath(); g.arc(m + versatz, m, r * 1.02, 0, 6.29); g.fill(); }
      return c;
    }

    _bild(t) {
      const c = this._el && this._el.canvas;
      if (!c || !c.width || !this._sz) return;
      const g = c.getContext("2d");
      const dpr = this._dpr || 1, W = c.width / dpr, H = c.height / dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (this._szeneNeu || !this._huegel) this._aufbauen(W, H);
      const sz = this._sz, jetzt = new Date();
      const sonne = this._sonne(jetzt);
      const elev = sonne.elev;
      const nacht = clamp((-elev - 1) / 11, 0, 1);
      const tag = 1 - nacht;
      const sp = this._sparsam || this._config.leistung === "sparsam";

      // Himmel
      let [oben, unten] = himmel(elev);
      const grau = sz.wolken * 0.65;
      oben = rgbMix(oben, rgbMix([138, 150, 168], [22, 26, 38], nacht), grau);
      unten = rgbMix(unten, rgbMix([170, 178, 190], [30, 34, 48], nacht), grau);
      const hg = g.createLinearGradient(0, 0, 0, H * 0.85);
      hg.addColorStop(0, rgb(oben)); hg.addColorStop(1, rgb(unten));
      g.fillStyle = hg; g.fillRect(0, 0, W, H);

      // Sterne
      const sternA = nacht * (1 - sz.wolken * 0.85);
      if (sternA > 0.02) {
        for (const s of this._sterne) {
          const a = sternA * (0.55 + 0.45 * Math.sin(t * 0.001 * s.s + s.p));
          g.fillStyle = `rgba(255,255,255,${a})`;
          g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.29); g.fill();
        }
      }

      // Polarlicht
      if (this._config.polarlicht !== false && !sp && nacht > 0.6 && sz.wolken < 0.45) {
        const staerke = (nacht - 0.6) / 0.4 * (1 - sz.wolken * 2);
        g.save(); g.globalCompositeOperation = "lighter";
        const farben = [[60, 255, 170], [80, 200, 255], [170, 110, 255]];
        for (let i = 0; i < 3; i++) {
          const y0 = H * (0.14 + i * 0.07);
          const lg = g.createLinearGradient(0, y0 - 40, 0, y0 + 160);
          lg.addColorStop(0, rgb(farben[i], 0)); lg.addColorStop(0.25, rgb(farben[i], 0.16 * staerke)); lg.addColorStop(1, rgb(farben[i], 0));
          g.fillStyle = lg; g.beginPath();
          const oberkante = [];
          for (let x = -20; x <= W + 20; x += 24) oberkante.push([x, y0 + Math.sin(x * 0.0035 + t * 0.00018 * (i + 1) + i * 2) * 46 + Math.sin(x * 0.011 + t * 0.0004) * 14]);
          g.moveTo(oberkante[0][0], oberkante[0][1]);
          for (const [x, y] of oberkante) g.lineTo(x, y);
          for (let k = oberkante.length - 1; k >= 0; k--) g.lineTo(oberkante[k][0], oberkante[k][1] + 150 + Math.sin(oberkante[k][0] * 0.006 + t * 0.0003) * 30);
          g.closePath(); g.fill();
        }
        g.restore();
      }

      // Sternschnuppe
      if (nacht > 0.7 && sz.wolken < 0.6 && !sp) {
        if (!this._schnuppe && Math.random() < 0.004) this._schnuppe = { x: W * (0.1 + Math.random() * 0.6), y: H * (0.05 + Math.random() * 0.25), t0: t, dx: 0.9 + Math.random() * 0.5, dy: 0.35 + Math.random() * 0.2 };
        const s = this._schnuppe;
        if (s) {
          const d = (t - s.t0) / 900;
          if (d > 1) this._schnuppe = null;
          else {
            const x = s.x + s.dx * d * 420, y = s.y + s.dy * d * 420;
            const lg = g.createLinearGradient(x, y, x - s.dx * 140, y - s.dy * 140);
            lg.addColorStop(0, `rgba(255,255,255,${1 - d})`); lg.addColorStop(1, "rgba(255,255,255,0)");
            g.strokeStyle = lg; g.lineWidth = 2; g.lineCap = "round";
            g.beginPath(); g.moveTo(x, y); g.lineTo(x - s.dx * 140, y - s.dy * 140); g.stroke();
          }
        }
      }

      const horizont = H * 0.8;
      // Sonne oder Mond
      const lauf = (sonne.unter - sonne.auf) || 1;
      const p = (jetzt - sonne.auf) / lauf;
      const bahn = (q) => [W * (0.08 + 0.84 * q), horizont - Math.sin(clamp(q, 0, 1) * Math.PI) * H * 0.62 + H * 0.04];
      if (elev > -6 && p > -0.08 && p < 1.08) {
        const [x, y] = bahn(p);
        const sicht = 1 - sz.wolken * 0.75;
        const warm = clamp(1 - elev / 12, 0, 1);
        const kern = rgbMix([255, 250, 225], [255, 170, 90], warm);
        const rg = g.createRadialGradient(x, y, 0, x, y, 220);
        rg.addColorStop(0, rgb(kern, 0.9 * sicht)); rg.addColorStop(0.12, rgb(kern, 0.55 * sicht)); rg.addColorStop(1, rgb(kern, 0));
        g.fillStyle = rg; g.fillRect(x - 220, y - 220, 440, 440);
        g.fillStyle = rgb(kern, 0.95 * sicht + 0.05); g.beginPath(); g.arc(x, y, 30, 0, 6.29); g.fill();
      } else if (nacht > 0.2) {
        const nachtLauf = 86400000 - lauf;
        let q = (jetzt - sonne.unter) / nachtLauf; if (q < 0) q += 86400000 / nachtLauf;
        const [x, y] = bahn(clamp(q, 0.05, 0.95));
        const phase = mondPhase(jetzt);
        if (!this._mond || Math.abs(this._mond.phase - phase) > 0.01) this._mond = { phase, bild: this._mondBild(26, phase) };
        const sicht = (1 - sz.wolken * 0.7) * nacht;
        const rg = g.createRadialGradient(x, y, 0, x, y, 140);
        rg.addColorStop(0, `rgba(220,230,255,${0.35 * sicht})`); rg.addColorStop(1, "rgba(220,230,255,0)");
        g.fillStyle = rg; g.fillRect(x - 140, y - 140, 280, 280);
        g.globalAlpha = clamp(sicht + 0.15, 0, 1); g.drawImage(this._mond.bild, x - 28, y - 28); g.globalAlpha = 1;
      }

      // Wolken
      const windPx = 0.006 + sz.wind * 0.035;
      for (const w of this._wolken) {
        w.x += windPx * w.tiefe * 33;
        if (w.x > W + 20) w.x = -w.b - 20;
        const a = w.a * (0.35 + sz.wolken * 0.65);
        g.globalAlpha = a * tag; g.drawImage(w.hell, w.x, w.y, w.b * (0.7 + w.tiefe * 0.6), w.b * 0.42 * (0.7 + w.tiefe * 0.6));
        g.globalAlpha = a * nacht * 0.8; g.drawImage(w.dunkel, w.x, w.y, w.b * (0.7 + w.tiefe * 0.6), w.b * 0.42 * (0.7 + w.tiefe * 0.6));
      }
      g.globalAlpha = 1;

      // Blitz
      if (sz.gewitter) {
        if (t > this._blitz.naechst) {
          this._blitz.t = t; this._blitz.naechst = t + 3500 + Math.random() * 7000;
          let x = W * (0.15 + Math.random() * 0.7), y = 0; const pfad = [[x, y]];
          while (y < horizont - 20) { y += 20 + Math.random() * 40; x += (Math.random() - 0.5) * 60; pfad.push([x, y]); }
          this._blitz.pfad = pfad;
        }
        const d = (t - this._blitz.t) / 380;
        if (d >= 0 && d < 1) {
          const flacker = d < 0.25 ? 1 : d < 0.4 ? 0.3 : d < 0.55 ? 0.9 : 1 - d;
          g.fillStyle = `rgba(220,230,255,${0.35 * flacker})`; g.fillRect(0, 0, W, H);
          g.strokeStyle = `rgba(255,255,255,${flacker})`; g.lineWidth = 2.5; g.shadowColor = "#b9c8ff"; g.shadowBlur = 18;
          g.beginPath(); this._blitz.pfad.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
          g.shadowBlur = 0;
        }
      }

      // Hügel
      const schneeDecke = sz.schnee > 0.3 || sz.temp <= -1 ? 0.55 : 0;
      const HUEGEL = [["#7fa0c2", "#161d3a"], ["#55805f", "#0f1628"], ["#3c6648", "#080c18"]];
      this._huegel.forEach((pts, i) => {
        let f = farbeMix(HUEGEL[i][0], HUEGEL[i][1], nacht);
        if (schneeDecke) f = farbeMix(f, nacht > 0.5 ? "#4a5578" : "#e9eef5", schneeDecke * (i === 0 ? 0.6 : 0.85));
        g.fillStyle = f; g.beginPath(); g.moveTo(0, H);
        for (const [x, y] of pts) g.lineTo(x, y);
        g.lineTo(W, H); g.closePath(); g.fill();
        if (i === 0 && sz.nebel) { g.fillStyle = `rgba(200,205,215,${0.35 * sz.nebel})`; g.fillRect(0, pts[0][1] - 60, W, H); }
      });

      // Haus
      this._haus(g, W, H, t, nacht, schneeDecke);

      // Bäume (vorne)
      const baumF = schneeDecke ? farbeMix("#2c5a3b", "#0a1020", nacht) : farbeMix("#2a5236", "#060a14", nacht);
      for (const b of this._baeume) {
        g.fillStyle = baumF;
        g.beginPath(); g.moveTo(b.x, b.y - b.h); g.lineTo(b.x + b.h * 0.32, b.y); g.lineTo(b.x - b.h * 0.32, b.y); g.closePath(); g.fill();
        if (schneeDecke) { g.fillStyle = nacht > 0.5 ? "rgba(170,185,220,.7)" : "rgba(255,255,255,.92)"; g.beginPath(); g.moveTo(b.x, b.y - b.h); g.lineTo(b.x + b.h * 0.12, b.y - b.h * 0.62); g.lineTo(b.x - b.h * 0.12, b.y - b.h * 0.62); g.closePath(); g.fill(); }
      }

      // Nebelbänke
      if (sz.nebel) {
        for (let i = 0; i < 3; i++) {
          const y = horizont - 40 + i * 45, x = ((t * 0.01 * (i + 1)) % (W * 2)) - W;
          const lg = g.createLinearGradient(0, y - 40, 0, y + 40);
          lg.addColorStop(0, "rgba(210,215,225,0)"); lg.addColorStop(0.5, `rgba(210,215,225,${0.28 * sz.nebel})`); lg.addColorStop(1, "rgba(210,215,225,0)");
          g.fillStyle = lg; g.fillRect(x, y - 40, W * 2, 80);
        }
      }

      // Regen
      if (this._regen.length) {
        const schraeg = sz.wind * 6;
        g.strokeStyle = nacht > 0.5 ? "rgba(170,190,230,.38)" : "rgba(230,240,255,.5)"; g.lineWidth = 1.2; g.beginPath();
        for (const r of this._regen) {
          r.y += 22 * r.v; r.x += schraeg * r.v;
          if (r.y > H) { r.y = -r.l; r.x = Math.random() * (W + 100) - 50; }
          g.moveTo(r.x, r.y); g.lineTo(r.x - schraeg * 1.4, r.y - r.l);
        }
        g.stroke();
      }
      // Schnee
      if (this._flocken.length) {
        g.fillStyle = "rgba(255,255,255,.85)";
        for (const f of this._flocken) {
          f.y += 1.6 * f.v; f.x += Math.sin(t * 0.0012 + f.p) * 0.6 + sz.wind * 1.4;
          if (f.y > H) { f.y = -5; f.x = Math.random() * W; }
          if (f.x > W) f.x = 0;
          g.beginPath(); g.arc(f.x, f.y, f.r, 0, 6.29); g.fill();
        }
      }

      // Abdunklung unten links/rechts für bessere Lesbarkeit
      const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,10,${0.25 + tag * 0.1})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }

    _haus(g, W, H, t, nacht, schneeDecke) {
      const x = this._hausX, y = this._hausY + 6, s = clamp(H / 900, 0.6, 1.4);
      const b = 120 * s, h = 72 * s, dach = 58 * s;
      const wand = farbeMix("#d7c6ae", "#141a2c", nacht), dachF = farbeMix("#9b4a3c", "#0b0f1c", nacht);
      // Kamin + Rauch
      const kx = x + b * 0.22, ky = y - h - dach * 0.55;
      g.fillStyle = farbeMix("#7a3d33", "#0a0d18", nacht); g.fillRect(kx, ky - 20 * s, 16 * s, 34 * s);
      if (this._sz.temp < 10 && !this._sparsam) {
        if (Math.random() < 0.25) this._rauch.push({ x: kx + 8 * s, y: ky - 20 * s, r: 5 * s, a: 0.45, t0: t });
        this._rauch = this._rauch.filter((r) => r.a > 0.02);
        for (const r of this._rauch) {
          r.y -= 0.7; r.x += 0.3 + this._sz.wind * 1.5; r.r += 0.14; r.a *= 0.985;
          g.fillStyle = nacht > 0.5 ? `rgba(120,130,160,${r.a * 0.6})` : `rgba(235,235,240,${r.a})`;
          g.beginPath(); g.arc(r.x, r.y, r.r, 0, 6.29); g.fill();
        }
      }
      g.fillStyle = wand; g.fillRect(x - b / 2, y - h, b, h);
      g.fillStyle = dachF; g.beginPath(); g.moveTo(x - b / 2 - 12 * s, y - h + 2); g.lineTo(x, y - h - dach); g.lineTo(x + b / 2 + 12 * s, y - h + 2); g.closePath(); g.fill();
      if (schneeDecke) { g.fillStyle = nacht > 0.5 ? "rgba(160,175,215,.85)" : "#f4f7fb"; g.beginPath(); g.moveTo(x - b / 2 - 12 * s, y - h + 2); g.lineTo(x, y - h - dach); g.lineTo(x + b / 2 + 12 * s, y - h + 2); g.lineTo(x + b / 2, y - h + 6 * s); g.lineTo(x, y - h - dach + 10 * s); g.lineTo(x - b / 2, y - h + 6 * s); g.closePath(); g.fill(); }
      // Fenster: so viele leuchten, wie Personen zu Hause sind
      const fenster = [[-0.32, -0.62], [0.08, -0.62], [-0.32, -0.25], [0.32, -0.62], [0, -h - dach * 0.45]];
      const n = this._personen.length || 4, an = this._sz.zuHause;
      const anzahl = Math.max(4, Math.min(n, 5));
      for (let i = 0; i < anzahl; i++) {
        const [fx, fy] = fenster[i];
        const px = x + fx * b, py = i === 4 ? y + fy * 1 : y + fy * h;
        const fw = 22 * s, fh = 20 * s;
        const leuchtet = i < an || (n > 5 && an >= 5);
        if (leuchtet) {
          const fl = 0.85 + Math.sin(t * 0.004 + i * 1.7) * 0.05 + (Math.random() < 0.02 ? -0.1 : 0);
          if (nacht > 0.15) {
            const rg = g.createRadialGradient(px + fw / 2, py + fh / 2, 0, px + fw / 2, py + fh / 2, 70 * s);
            rg.addColorStop(0, `rgba(255,200,110,${0.45 * nacht * fl})`); rg.addColorStop(1, "rgba(255,200,110,0)");
            g.fillStyle = rg; g.fillRect(px - 60 * s, py - 60 * s, fw + 120 * s, fh + 120 * s);
          }
          g.fillStyle = farbeMix("#ffe8a8", "#ffc46b", nacht); g.globalAlpha = 0.7 + nacht * 0.3 * fl;
        } else {
          g.fillStyle = farbeMix("#9fc7e8", "#1b2238", nacht);
        }
        g.fillRect(px, py, fw, fh); g.globalAlpha = 1;
        g.fillStyle = farbeMix("#ffffff", "#0a0d18", nacht * 0.9); g.fillRect(px + fw / 2 - 1, py, 2, fh); g.fillRect(px, py + fh / 2 - 1, fw, 2);
      }
      // Tür
      g.fillStyle = farbeMix("#6b4a34", "#0c0f1a", nacht); g.fillRect(x + b * 0.2, y - 36 * s, 20 * s, 36 * s);
    }

    // ----------------------------------------------------------- Oberfläche
    _tick() {
      this._zentrum(); this._zeiger(); this._liste(); this._gruss();
      if (this._config.animation === false) this._bild(performance.now());
      const tag = new Date().toDateString();
      if (tag !== this._tagStand) { this._tagStand = tag; this._laden(); }
    }

    _alles() {
      if (!this._el || !this._hass || !this._personen) return;
      if (!this._sz) this._szeneAktualisieren();
      this._gruss(); this._planeten(); this._ring(); this._zentrum(); this._liste(); this._leiste();
      if (!this._laeuft()) this._bild(performance.now());
    }

    _sichtbareTermine() {
      const a = this._auswahl();
      return a === "familie" ? this._termine : this._termine.filter((t) => t.slug === a || t.slug === "familie");
    }

    _gruss() {
      const j = new Date(), h = j.getHours();
      const hallo = h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 14 ? "Mahlzeit" : h < 18 ? "Schönen Nachmittag" : h < 22 ? "Guten Abend" : "Gute Nacht";
      const kw = (() => { const d = new Date(Date.UTC(j.getFullYear(), j.getMonth(), j.getDate())); const n = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - n); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1)); return Math.ceil(((d - y) / 86400000 + 1) / 7); })();
      this._el.hallo.textContent = hallo;
      this._el.unter.textContent = `${this._familie.name ? this._familie.name + " · " : ""}KW ${kw}`;
    }

    _naechster(slug, jetzt) {
      return this._termine.find((t) => !t.ganz && t.ende > jetzt && (t.slug === slug || t.slug === "familie"));
    }

    _planeten() {
      const h = this._hass, jetzt = new Date(), a = this._auswahl();
      const ende = new Date(startTag(jetzt).getTime() + 86400000);
      const farben = this._personen.map((p) => p.farbe).join(",") || "#888,#888";
      let html = `<button class="planet alle glas ${a === "familie" ? "an" : ""}" data-slug="familie" style="--c:#fff;--farben:${farben},${this._personen[0] ? this._personen[0].farbe : "#888"}">
        <span class="ava">👨‍👩‍👧‍👦</span><span class="txt"><b>Alle</b><small>${this._sz.zuHause} von ${this._personen.length} zu Hause</small></span></button>`;
      for (const p of this._personen) {
        const st = p.person && h.states[p.person];
        const zuHause = st && st.state === "home";
        const bild = st && st.attributes.entity_picture;
        const n = this._naechster(p.slug, jetzt);
        const offen = this._termine.filter((t) => !t.ganz && t.ende > jetzt && t.start < ende && t.slug === p.slug).length;
        const monde = Array.from({ length: Math.min(offen, 6) }, (_, i) => `<i style="transform: rotate(${(360 / Math.min(offen, 6)) * i}deg)"></i>`).join("");
        const unter = n ? `${symbol(n.titel) || "•"} ${esc(n.titel)} · ${wannText(n, jetzt)}` : "Heute frei";
        html += `<button class="planet glas ${zuHause ? "zuhause" : ""} ${a === p.slug ? "an" : a !== "familie" ? "aus" : ""}" data-slug="${esc(p.slug)}" style="--c:${p.farbe}">
          <span class="ava">${bild ? `<img src="${esc(bild)}" alt="">` : esc((p.name || "?").slice(0, 1).toUpperCase())}
            ${offen ? `<span class="monde" style="--dauer:${10 + offen * 2}s">${monde}</span>` : ""}
            ${st ? `<span class="ort">${zuHause ? "🏠" : "🚗"}</span>` : ""}</span>
          <span class="txt"><b>${esc(p.name)}</b><small>${unter}</small></span></button>`;
      }
      this._el.personen.innerHTML = html;
    }

    _ringe() {
      const ringe = this._personen.map((p) => ({ slug: p.slug, farbe: p.farbe, name: p.name }));
      if (this._termine.some((t) => t.slug === "familie")) ringe.push({ slug: "familie", farbe: this._familie.farbe, name: "Familie" });
      return ringe;
    }

    _ring() {
      const jetzt = new Date(), heute = startTag(jetzt), morgen = new Date(heute.getTime() + 86400000);
      const winkel = (std) => 90 + std * 15;
      const polar = (r, w) => { const a = (w * Math.PI) / 180; return [500 + r * Math.cos(a), 500 + r * Math.sin(a)]; };
      const bogen = (r, w0, w1) => {
        const [x0, y0] = polar(r, w0), [x1, y1] = polar(r, w1);
        return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 ${w1 - w0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      };
      const std = (d) => (d - heute) / 3600000;
      const sonne = this._sonne(jetzt);
      const ringe = this._ringe();
      const n = Math.max(ringe.length, 1);
      const aussen = 405, innenMin = 175;
      const breite = clamp((aussen - innenMin) / n - 9, 14, 46);
      const a = this._auswahl();
      let s = `<defs>
        <linearGradient id="tagverlauf" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb36b"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#ff8f6b"/></linearGradient>
        <radialGradient id="kern" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="rgba(30,40,80,.55)"/><stop offset="1" stop-color="rgba(8,12,30,.72)"/></radialGradient>
        <filter id="leuchten" filterUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>`;
      s += `<circle cx="500" cy="500" r="492" fill="rgba(8,12,30,.30)" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>`;
      // Nacht + Tag (Sonnenbogen)
      s += `<circle cx="500" cy="500" r="440" fill="none" stroke="rgba(70,90,170,.45)" stroke-width="8"/>`;
      const sa = clamp(std(sonne.auf), 0, 24), su = clamp(std(sonne.unter), 0, 24);
      if (su > sa) s += `<path d="${bogen(440, winkel(sa), winkel(su))}" fill="none" stroke="url(#tagverlauf)" stroke-width="8" stroke-linecap="round" filter="url(#leuchten)"/>`;
      for (const [stunde, zeichen] of [[sa, "☀"], [su, "☾"]]) { const [x, y] = polar(440, winkel(stunde)); s += `<text x="${x}" y="${y + 7}" font-size="22" text-anchor="middle" fill="#ffe7a3">${zeichen}</text>`; }
      // Stundenstriche
      for (let i = 0; i < 24; i++) {
        const gross = i % 3 === 0;
        const [x0, y0] = polar(gross ? 452 : 458, winkel(i)), [x1, y1] = polar(468, winkel(i));
        s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="rgba(255,255,255,${gross ? 0.75 : 0.32})" stroke-width="${gross ? 3 : 1.5}" stroke-linecap="round"/>`;
        if (gross) { const [x, y] = polar(484, winkel(i)); s += `<text x="${x}" y="${y + 7}" font-size="21" font-weight="700" text-anchor="middle" fill="rgba(255,255,255,.8)">${i}</text>`; }
      }
      // Ringe je Person
      this._bogenTermine = [];
      ringe.forEach((ring, i) => {
        const r = aussen - breite / 2 - i * (breite + 9);
        const gedimmt = a !== "familie" && ring.slug !== a && ring.slug !== "familie";
        s += `<g class="ringgruppe ${gedimmt ? "gedimmt" : ""}" style="color:${ring.farbe}">`;
        s += `<circle cx="500" cy="500" r="${r}" fill="none" stroke="${ring.farbe}" stroke-opacity=".16" stroke-width="${breite}"/>`;
        const vergangen = clamp(std(jetzt), 0, 24);
        if (vergangen > 0.05) s += `<path d="${bogen(r, winkel(0), winkel(vergangen))}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="${breite}"/>`;
        for (const t of this._termine) {
          if (t.slug !== ring.slug || t.ende <= heute || t.start >= morgen) continue;
          const idx = this._termine.indexOf(t);
          if (t.ganz) {
            s += `<circle class="bogen" data-i="${idx}" cx="500" cy="500" r="${r + breite / 2 - 2}" fill="none" stroke="${ring.farbe}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`;
            continue;
          }
          let von = clamp(std(t.start), 0, 24), bis = clamp(std(t.ende), 0, 24);
          if (bis - von < 0.3) bis = Math.min(24, von + 0.3);
          const kappe = Math.min(breite / 2, 12) / r * (180 / Math.PI) / 15; // Stunden für runde Enden
          const w0 = winkel(Math.min(von + kappe, (von + bis) / 2)), w1 = winkel(Math.max(bis - kappe, (von + bis) / 2));
          const vorbei = t.ende <= jetzt, laeuft = t.start <= jetzt && t.ende > jetzt;
          s += `<path class="bogen ${laeuft ? "laeuft" : ""}" data-i="${idx}" d="${bogen(r, w0, w1 + 0.01)}" fill="none" stroke="${ring.farbe}" stroke-width="${breite - 4}" stroke-linecap="round" opacity="${vorbei ? 0.45 : 1}"/>`;
          const sym = symbol(t.titel);
          if (sym && bis - von >= 0.7 && breite >= 20) { const [x, y] = polar(r, winkel((von + bis) / 2)); s += `<text x="${x}" y="${y + breite * 0.22}" font-size="${breite * 0.6}" text-anchor="middle" pointer-events="none">${sym}</text>`; }
        }
        s += `</g>`;
      });
      const innen = aussen - n * (breite + 9) + 2;
      this._innenRadius = Math.max(150, innen - 12);
      s += `<circle cx="500" cy="500" r="${this._innenRadius}" fill="url(#kern)" stroke="rgba(255,255,255,.18)" stroke-width="2"/>`;
      // Zeiger
      s += `<g class="zeiger" style="transform: rotate(${winkel(std(jetzt))}deg)">
        <line x1="${500 + this._innenRadius + 4}" y1="500" x2="970" y2="500" stroke="rgba(255,255,255,.9)" stroke-width="3" stroke-linecap="round" filter="url(#leuchten)"/>
        <circle class="knopf" cx="970" cy="500" r="9" fill="#fff" filter="url(#leuchten)"/></g>`;
      this._el.svg.innerHTML = s;
      this._zeigerEl = this._el.svg.querySelector(".zeiger");
      this._zentrumGroesse();
    }

    _zeiger() {
      if (!this._zeigerEl) return;
      const j = new Date();
      const std = (j - startTag(j)) / 3600000;
      this._zeigerEl.style.transform = `rotate(${90 + std * 15}deg)`;
      if (this._ringTag !== j.getHours()) { this._ringTag = j.getHours(); this._ring(); }
    }

    _zentrumGroesse() {
      if (!this._ringPx || !this._innenRadius) return;
      const d = (this._innenRadius * 2 * this._ringPx) / 1000;
      Object.assign(this._el.zentrum.style, { width: `${d}px`, height: `${d}px` });
      this._el.zentrum.style.setProperty("--uhr", `${Math.round(d * 0.24)}px`);
    }

    _zeigeTermin(i) {
      if (!this._termine[i]) return;
      this._fokusTermin = i;
      clearTimeout(this._fokusTimer);
      this._fokusTimer = setTimeout(() => { this._fokusTermin = null; this._zentrum(); }, 9000);
      this._zentrum();
    }

    _zentrum() {
      if (!this._el || !this._sz) return;
      const j = new Date(), a = this._auswahl();
      let html;
      const ft = this._fokusTermin != null ? this._termine[this._fokusTermin] : null;
      if (ft) {
        const zeit = ft.ganz ? "ganztägig" : `${hhmm(ft.start)} – ${hhmm(ft.ende)}`;
        html = `<div class="zsym">${symbol(ft.titel) || "📅"}</div><div class="ztitel">${esc(ft.titel)}</div>
          <div class="zzeit">${zeit}${ft.ort ? " · 📍 " + esc(ft.ort) : ""}</div><div class="zchip" style="--c:${ft.farbe}">${esc(ft.name)}${ft.ganz ? "" : " · " + wannText(ft, j)}</div>`;
        this._el.zentrum.style.setProperty("--c", ft.farbe);
      } else if (a !== "familie") {
        const p = this._personen.find((x) => x.slug === a);
        const n = this._naechster(a, j);
        const heute = this._termine.filter((t) => !t.ganz && t.slug === a && t.ende > j && t.start < new Date(startTag(j).getTime() + 86400000)).length;
        html = `<div class="zname" style="--c:${p.farbe}">${esc(p.name)}</div>` + (n
          ? `<div class="zsym">${symbol(n.titel) || "📅"}</div><div class="ztitel">${esc(n.titel)}</div><div class="zzeit">${hhmm(n.start)} Uhr${n.ort ? " · " + esc(n.ort) : ""}</div>
             <div class="zchip" style="--c:${p.farbe}">${wannText(n, j)}</div>`
          : `<div class="zsym">🌿</div><div class="ztitel">Nichts geplant</div>`) +
          `<div class="zzeit">${heute ? `heute noch ${heute} Termin${heute > 1 ? "e" : ""}` : "Rest des Tages frei"}</div>`;
      } else {
        const [e, text] = this._sz.info;
        const rest = this._termine.filter((t) => !t.ganz && t.ende > j && t.start < new Date(startTag(j).getTime() + 86400000)).length;
        html = `<div class="uhr">${hhmm(j)}</div><div class="datum">${TAGE[j.getDay()]}, ${j.getDate()}. ${MONATE[j.getMonth()]}</div>
          <div class="wetter">${e} <b>${Math.round(this._sz.temp)}${esc(this._sz.einheit)}</b> · ${esc(text)}</div>
          <div class="rest">${rest ? `heute noch ${rest} Termin${rest > 1 ? "e" : ""}` : "Heute nichts mehr geplant ✨"}</div>`;
      }
      const schluessel = html.replace(/\d+ Min|\d\d:\d\d/g, "");
      // Nur bei neuem Inhalt einblenden, sonst (Minutentakt) still austauschen
      this._el.zentrum.classList.toggle("still", schluessel === this._zentrumSchluessel);
      this._zentrumSchluessel = schluessel;
      this._el.zentrum.innerHTML = html;
    }

    _liste() {
      if (!this._el) return;
      const j = new Date(), heute = startTag(j), morgen = new Date(heute.getTime() + 86400000);
      const termine = this._sichtbareTermine();
      const ganz = termine.filter((t) => t.ganz && t.start < morgen && t.ende > heute);
      this._el.ganztag.innerHTML = ganz.map((t) => `<span style="--c:${t.farbe}">${symbol(t.titel) || "📌"} ${esc(t.titel)}</span>`).join("");
      const kommend = termine.filter((t) => !t.ganz && t.ende > j).slice(0, 7);
      if (!kommend.length) { this._el.liste.innerHTML = `<div class="leer">Keine weiteren Termine in den nächsten Tagen. Zeit für etwas Schönes! 🌈</div>`; return; }
      let html = "", tagAlt = "";
      for (const t of kommend) {
        const diff = Math.round((startTag(t.start) - heute) / 86400000);
        const tag = diff <= 0 ? "Heute" : diff === 1 ? "Morgen" : `${TAGE[t.start.getDay()]}, ${t.start.getDate()}.${t.start.getMonth() + 1}.`;
        if (tag !== tagAlt) { html += `<div class="tag">${tag}</div>`; tagAlt = tag; }
        const laeuft = t.start <= j;
        const anteil = laeuft ? clamp((j - t.start) / (t.ende - t.start), 0, 1) : 0;
        html += `<button class="termin" data-i="${this._termine.indexOf(t)}" style="--c:${t.farbe}"><span class="balken"></span><span class="sym">${symbol(t.titel) || "📅"}</span>
          <span style="min-width:0"><div class="t">${esc(t.titel)}</div><div class="z">${hhmm(t.start)}–${hhmm(t.ende)} · ${esc(t.name)}${t.ort ? " · " + esc(t.ort) : ""}</div>
          <span class="cd">${wannText(t, j)}</span></span>${laeuft ? `<span class="fort" style="width:${(anteil * 100).toFixed(1)}%"></span>` : ""}</button>`;
      }
      this._el.liste.innerHTML = html;
    }

    _leiste() {
      if (!this._el || !this._sz) return;
      const j = new Date(), sonne = this._sonne(j), [me, mn] = mondName(mondPhase(j));
      let html = "";
      const f = this._prognose;
      if (f) {
        for (const x of f.liste) {
          const d = new Date(x.datetime);
          const zeit = f.typ === "hourly" ? `${d.getHours()} Uhr` : TAGE[d.getDay()].slice(0, 2);
          const regen = x.precipitation_probability != null && x.precipitation_probability >= 20 ? `<div class="n">💧 ${Math.round(x.precipitation_probability)} %</div>` : "";
          html += `<div class="stunde glas"><div class="h">${zeit}</div><div class="e">${wetterInfo(x.condition)[0]}</div><div class="g">${Math.round(x.temperature)}°</div>${regen}</div>`;
        }
      } else {
        html += `<div class="info glas"><b>${this._sz.info[0]} ${Math.round(this._sz.temp)}${esc(this._sz.einheit)}</b><small>${esc(this._sz.info[1])}${this._sz.feuchte != null ? ` · 💧 ${Math.round(this._sz.feuchte)} %` : ""}</small></div>`;
      }
      html += `<div class="luecke"></div>`;
      html += `<div class="info glas"><b>🌅 ${hhmm(sonne.auf)} · 🌇 ${hhmm(sonne.unter)}</b><small>Tageslicht ${Math.floor((sonne.unter - sonne.auf) / 3600000)} Std ${Math.round(((sonne.unter - sonne.auf) % 3600000) / 60000)} Min</small></div>`;
      html += `<div class="info glas"><b>${me} Mond</b><small>${mn}</small></div>`;
      html += `<div class="info glas"><b>🏠 ${this._sz.zuHause} zu Hause</b><small>${this._personen.length - this._sz.zuHause} unterwegs</small></div>`;
      this._el.leiste.innerHTML = html;
    }
  }

  customElements.define("familienplaner-cockpit", FamilienplanerCockpit);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === "familienplaner-cockpit")) {
    window.customCards.push({ type: "familienplaner-cockpit", name: "Familienplaner: Cockpit", description: "Lebendiger Himmel nach Sonne und Wetter mit 24-Stunden-Tagesring für die ganze Familie", preview: false });
  }
})();
