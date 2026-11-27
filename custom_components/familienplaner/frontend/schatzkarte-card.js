/*
 * Familienplaner – Familien-Schatzkarte („schatzkarte-card“)
 *
 * Die ganze Familie läuft gemeinsam über eine Schatzinsel. Jeder erledigte Punkt aller
 * Familienmitglieder bringt die Familie weiter. An jeder Station wartet eine Familien-
 * Belohnung, am Ende die Schatzkiste. Deutsch und Englisch.
 *
 *   type: custom:schatzkarte-card
 *   # optional: entity: sensor.familienplaner_familien_rennen
 */

(() => {
  const TEXTE = {
    de: {
      titel: "Schatzkarte",
      insel: "Insel",
      punkte: "Familienpunkte",
      noch: (n, s) => `Noch <b>${n}</b> Punkte bis <b>${s}</b>`,
      geschafft: "Schatz gefunden! Die ganze Insel ist geschafft 🎉",
      start: "Start",
      fehlt: "Familien-Rennen nicht gefunden",
    },
    en: {
      titel: "Treasure map",
      insel: "Island",
      punkte: "family points",
      noch: (n, s) => `<b>${n}</b> points to go until <b>${s}</b>`,
      geschafft: "Treasure found! The whole island is done 🎉",
      start: "Start",
      fehlt: "Family race not found",
    },
  };

  // Gewundener Weg über die Insel (viewBox 400 x 250)
  const WEG = "M 52 196 C 92 214, 128 190, 140 162 S 120 104, 160 92 S 238 120, 258 150 S 320 196, 344 156 S 330 86, 300 70 S 252 60, 288 56";
  const INSEL =
    "M 30 170 C 10 120, 50 60, 110 52 C 150 20, 230 14, 290 18 C 360 22, 392 70, 384 120 C 380 170, 370 214, 310 226 " +
    "C 250 240, 170 236, 110 230 C 60 226, 40 206, 30 170 Z";

  function sprache(hass) {
    const l = (hass && ((hass.locale && hass.locale.language) || hass.language)) || "de";
    return String(l).toLowerCase().startsWith("de") ? "de" : "en";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /** Anteil des Weges (0..1) für einen Punktestand: Stationen liegen gleichmäßig verteilt. */
  function wegAnteil(punkte, stationen) {
    const n = stationen.length;
    if (!n) return 0;
    let vorher = 0;
    for (let i = 0; i < n; i++) {
      const ziel = Number(stationen[i].punkte) || 0;
      if (punkte < ziel) {
        const teil = ziel > vorher ? (punkte - vorher) / (ziel - vorher) : 1;
        return (i + Math.max(0, Math.min(1, teil))) / n;
      }
      vorher = ziel;
    }
    return 1;
  }

  class SchatzkarteCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._sig = "";
    }

    static getStubConfig() {
      return {};
    }

    setConfig(config) {
      this._config = { ...(config || {}) };
      this._sig = "";
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._render();
    }

    getCardSize() {
      return 6;
    }

    getGridOptions() {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }

    _entity() {
      if (this._config.entity) return this._config.entity;
      return Object.keys(this._hass.states).find((id) => {
        const a = this._hass.states[id].attributes;
        return id.startsWith("sensor.") && a.schatzkarte && Array.isArray(a.schatzkarte.stationen);
      });
    }

    _render() {
      if (!this._hass || !this._config) return;
      const t = TEXTE[sprache(this._hass)];
      const id = this._entity();
      const st = id && this._hass.states[id];
      const sk = st && st.attributes.schatzkarte;
      if (!sk) {
        this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card><div class="leer">${esc(t.fehlt)}</div></ha-card>`;
        return;
      }
      const fahrer = st.attributes.fahrer || [];
      const sig = JSON.stringify([sk, fahrer.map((f) => f.farbe_hex), t.titel]);
      if (sig === this._sig) return;
      const erstes = !this._sig;
      this._sig = sig;

      const stationen = sk.stationen || [];
      const anteil = wegAnteil(sk.punkte, stationen);
      const naechste = stationen.find((s) => !s.erreicht);
      const fertig = !naechste && stationen.length > 0;
      const prozent = sk.ziel ? Math.min(100, Math.round((sk.punkte / sk.ziel) * 100)) : 0;

      const liste = stationen
        .map(
          (s) => `<li class="${s.erreicht ? "ok" : ""} ${s === naechste ? "jetzt" : ""}">
            <span class="em">${esc(s.emoji)}</span>
            <span class="txt"><b>${esc(s.name)}</b><small>${esc(s.belohnung)}</small></span>
            <span class="pt">${s.erreicht ? "✓" : esc(s.punkte)}</span>
          </li>`
        )
        .join("");

      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <ha-card>
          <div class="kopf">
            <span class="name">🗺️ ${esc(this._config.titel || t.titel)}</span>
            <span class="insel">${esc(t.insel)} ${esc(sk.insel)}</span>
            <span class="stand"><b>${esc(sk.punkte)}</b> / ${esc(sk.ziel)} ${esc(t.punkte)}</span>
          </div>
          <div class="karte">
            <svg viewBox="0 0 400 250" role="img" aria-label="${esc(t.titel)}">
              <defs>
                <radialGradient id="meer" cx="50%" cy="45%" r="75%">
                  <stop offset="0" stop-color="var(--sk-meer-hell)"/><stop offset="1" stop-color="var(--sk-meer)"/>
                </radialGradient>
                <radialGradient id="sand" cx="45%" cy="40%" r="70%">
                  <stop offset="0" stop-color="#F6E2B0"/><stop offset="1" stop-color="#E7C77E"/>
                </radialGradient>
              </defs>
              <rect width="400" height="250" fill="url(#meer)"/>
              <g class="wellen" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none" stroke-linecap="round">
                <path d="M 14 30 q 8 -6 16 0 t 16 0"/><path d="M 340 236 q 8 -6 16 0 t 16 0"/>
                <path d="M 8 228 q 8 -6 16 0 t 16 0"/><path d="M 350 14 q 8 -6 16 0 t 16 0"/>
              </g>
              <path d="${INSEL}" fill="#F6E9C6" opacity=".55" transform="translate(-6 6) scale(1.02)"/>
              <path d="${INSEL}" fill="url(#sand)"/>
              <path d="M 70 120 C 90 80, 150 70, 180 60 C 220 50, 300 40, 340 70 C 360 100, 350 140, 330 150 C 280 120, 220 110, 180 120 C 140 130, 100 150, 70 120 Z"
                fill="#9CC48A" opacity=".55"/>
              <text x="78" y="88" class="deko">🌴</text><text x="352" y="214" class="deko">🌴</text>
              <text x="200" y="214" class="deko klein">🦀</text><text x="372" y="40" class="deko">🧭</text>
              <path id="weg" d="${WEG}" fill="none" stroke="#B07A3B" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>
              <path class="gelaufen" d="${WEG}" fill="none" stroke="var(--sk-akzent)" stroke-width="5" stroke-linecap="round"/>
              <g class="stationen"></g>
              <g class="familie"></g>
            </svg>
          </div>
          <div class="info">${
            fertig
              ? `<span class="fertig">${esc(t.geschafft)}</span>`
              : naechste
              ? `${t.noch(esc(sk.fehlt), `${esc(naechste.emoji)} ${esc(naechste.name)}`)} · 🎁 ${esc(naechste.belohnung)}`
              : ""
          }</div>
          <div class="balken"><span style="width:${prozent}%"></span></div>
          <ol class="liste">${liste}</ol>
        </ha-card>`;

      // Stationen, Fortschritt und Familien-Figur auf den Weg legen
      const weg = this.shadowRoot.getElementById("weg");
      let laenge = 0;
      try {
        laenge = weg.getTotalLength();
      } catch (e) {
        laenge = 0;
      }
      if (!laenge) return;
      const svgNS = "http://www.w3.org/2000/svg";
      const gelaufen = this.shadowRoot.querySelector(".gelaufen");
      gelaufen.style.strokeDasharray = `${laenge}`;
      gelaufen.style.strokeDashoffset = `${laenge * (1 - anteil)}`;

      const gS = this.shadowRoot.querySelector(".stationen");
      const punkt = (f) => weg.getPointAtLength(laenge * f);
      const start = punkt(0);
      gS.insertAdjacentHTML(
        "beforeend",
        `<g transform="translate(${start.x} ${start.y})"><circle r="11" class="start"/><text class="st-em klein">⛵</text></g>`
      );
      stationen.forEach((s, i) => {
        const letzte = i === stationen.length - 1;
        const p = punkt((i + 1) / stationen.length);
        const g = document.createElementNS(svgNS, "g");
        g.setAttribute("transform", `translate(${p.x} ${p.y})`);
        g.setAttribute("class", `station ${s.erreicht ? "ok" : ""} ${letzte ? "schatz" : ""}`);
        g.innerHTML =
          `<title>${esc(s.name)}: ${esc(s.belohnung)} (${esc(s.punkte)})</title>` +
          `<circle r="${letzte ? 19 : 15}"/>` +
          `<text class="st-em">${esc(letzte && !s.erreicht ? "🧰" : s.emoji)}</text>` +
          (letzte ? `<text class="kreuz" y="-18">✖</text>` : "") +
          (s.erreicht ? `<g transform="translate(11 -11)"><circle r="7" class="haken"/><text class="h">✓</text></g>` : "");
        gS.appendChild(g);
      });

      // Familie: ein Fähnchen mit einem Punkt pro Person in deren Farbe
      const pos = punkt(anteil);
      const gF = this.shadowRoot.querySelector(".familie");
      const farben = fahrer.map((f) => f.farbe_hex).filter(Boolean);
      const breite = Math.max(1, farben.length) * 10 + 6;
      gF.setAttribute("transform", `translate(${pos.x} ${pos.y})`);
      gF.innerHTML =
        `<g class="huepf">` +
        `<line x1="0" y1="0" x2="0" y2="-34" stroke="#5A3B1C" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M 0 -34 L 22 -28 L 0 -21 Z" fill="var(--sk-akzent)"/>` +
        `<rect x="${-breite / 2}" y="-6" width="${breite}" height="14" rx="7" fill="#fff" stroke="rgba(0,0,0,.15)"/>` +
        farben.map((c, i) => `<circle cx="${-breite / 2 + 8 + i * 10}" cy="1" r="4.2" fill="${esc(c)}"/>`).join("") +
        `</g>`;
      if (erstes) gF.classList.add("rein");
    }
  }

  const STYLES = `
    :host { --fp-radius: var(--familienplaner-radius, 22px); --fp-radius-klein: var(--familienplaner-radius-klein, 18px);
      --fp-schatten: var(--familienplaner-schatten, 0 6px 20px rgba(0,0,0,.06));
      --sk-meer: #5BA4C9; --sk-meer-hell: #9ED3E8; --sk-akzent: #D9534F; display:block; }
    ha-card { display:block; padding: 14px; border-radius: var(--fp-radius); box-shadow: var(--fp-schatten);
      font-family: var(--familienplaner-schrift, inherit); overflow:hidden; }
    .kopf { display:flex; flex-wrap:wrap; align-items:baseline; gap: 6px 10px; margin: 2px 4px 10px; }
    .name { font-size: 20px; font-weight: 800; color: var(--primary-text-color); }
    .insel { font-size: 13px; font-weight: 700; padding: 2px 9px; border-radius: 10px; background: color-mix(in srgb, var(--sk-meer) 18%, transparent);
      color: color-mix(in srgb, var(--sk-meer) 70%, var(--primary-text-color)); }
    .stand { margin-left:auto; color: var(--secondary-text-color); font-size: 14px; }
    .stand b { color: var(--primary-text-color); font-size: 17px; }
    .karte { border-radius: var(--fp-radius-klein); overflow:hidden; line-height:0; }
    svg { width: 100%; height: auto; display:block; }
    .deko { font-size: 26px; text-anchor: middle; dominant-baseline: central; }
    .deko.klein { font-size: 16px; }
    .wellen path { animation: welle 4s ease-in-out infinite; }
    @keyframes welle { 50% { transform: translateX(4px); } }
    .gelaufen { transition: stroke-dashoffset 1.2s ease; opacity: .85; }
    .start { fill: #fff; stroke: #B07A3B; stroke-width: 2; }
    .station > circle { fill: #fff; stroke: #B07A3B; stroke-width: 2.5; filter: drop-shadow(0 2px 2px rgba(0,0,0,.18)); }
    .station:not(.ok) .st-em { filter: grayscale(.85); opacity: .7; }
    .station.ok > circle { stroke: #4CAF50; stroke-width: 3; }
    .station.schatz > circle { fill: #FFF4CF; stroke: #E5BE3C; stroke-width: 3; }
    .st-em { font-size: 17px; text-anchor: middle; dominant-baseline: central; }
    .st-em.klein { font-size: 12px; }
    .schatz .st-em { font-size: 22px; }
    .kreuz { fill: var(--sk-akzent); font-size: 12px; font-weight: 900; text-anchor: middle; dominant-baseline: central; }
    .station .haken { fill: #4CAF50; stroke: #fff; stroke-width: 1.5; }
    .h { fill:#fff; font-size: 9px; font-weight: 900; text-anchor: middle; dominant-baseline: central; }
    .familie { transition: transform 1.2s ease; }
    .huepf { animation: huepf 1.6s ease-in-out infinite; filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)); }
    @keyframes huepf { 50% { transform: translateY(-3px); } }
    .info { margin: 12px 4px 8px; font-size: 15px; color: var(--primary-text-color); line-height: 1.4; }
    .fertig { font-weight: 800; }
    .balken { height: 10px; border-radius: 5px; background: color-mix(in srgb, var(--sk-meer) 15%, var(--card-background-color, #fff)); overflow:hidden; margin: 0 4px; }
    .balken span { display:block; height:100%; border-radius: 5px; background: linear-gradient(90deg, #E5BE3C, var(--sk-akzent)); transition: width 1.2s ease; }
    .liste { list-style: none; margin: 12px 0 0; padding: 0; display:grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
    .liste li { display:flex; align-items:center; gap: 10px; padding: 8px 10px; border-radius: 14px;
      background: color-mix(in srgb, var(--secondary-text-color) 7%, var(--card-background-color, #fff)); }
    .liste li.ok { background: color-mix(in srgb, #4CAF50 13%, var(--card-background-color, #fff)); }
    .liste li.jetzt { box-shadow: inset 0 0 0 2px #E5BE3C; }
    .liste .em { font-size: 26px; line-height: 1; }
    .liste li:not(.ok) .em { filter: grayscale(.6); }
    .liste .txt { display:flex; flex-direction:column; min-width:0; flex:1; }
    .liste b { font-size: 14px; color: var(--primary-text-color); }
    .liste small { font-size: 12px; color: var(--secondary-text-color); overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
    .liste .pt { font-weight: 800; font-size: 13px; color: var(--secondary-text-color); }
    .liste li.ok .pt { color: #4CAF50; font-size: 16px; }
    .leer { padding: 18px; text-align:center; color: var(--secondary-text-color); }
    @media (prefers-reduced-motion: reduce) { .wellen path, .huepf { animation: none; } }
  `;

  if (!customElements.get("schatzkarte-card")) {
    customElements.define("schatzkarte-card", SchatzkarteCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "schatzkarte-card",
      name: "Schatzkarte (Familienplaner)",
      description: "Die Familie läuft gemeinsam über eine Schatzinsel. Stationen mit Familien-Belohnungen.",
      preview: true,
    });
  }
  window.familienplanerWegAnteil = wegAnteil; // für Tests
})();
