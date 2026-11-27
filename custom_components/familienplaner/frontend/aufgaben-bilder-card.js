/*
 * Familienplaner – Aufgaben als große Bilder („aufgaben-bilder-card“)
 *
 * Zeigt die offenen Aufgaben einer To-do-Liste als große Bild-Kacheln, damit auch Kinder,
 * die noch nicht lesen können, wissen, was zu tun ist. Antippen = erledigt (mit Haken,
 * Konfetti und Ton), erledigte Kachel nochmal antippen = zurücknehmen.
 *
 * Bild pro Aufgabe (in dieser Reihenfolge):
 *   1. Zeile „bild: https://…“ (oder „image: …“) in der Beschreibung -> eigenes Foto
 *   2. Emoji am Anfang des Titels, z. B. „🦷 Zähne putzen“
 *   3. automatisch passend zum Titel (Zähne, Zimmer, Müll, Hund, … – deutsch und englisch)
 *
 *   type: custom:aufgaben-bilder-card
 *   entity: todo.ben
 *   # optional: farbe: "#9B7BC4", ton: true, erledigte: true, titel: "Ben"
 */

(() => {
  const BILDER = [
    [/z(a|ä)hn|teeth|tooth/i, "🪥"],
    [/dusch|\bbad|bath|shower|h(a|ä)nde|wasch(?!masch)/i, "🛁"],
    [/zimmer|aufr(a|ä)um|tidy|room|spielzeug|toys/i, "🧸"],
    [/sp(u|ü)lmaschine|dishwasher/i, "🍽️"],
    [/abwasch|sp(u|ü)l|dishes/i, "🧽"],
    [/tisch|table/i, "🍴"],
    [/m(u|ü)ll|trash|garbage|rubbish|\bbins?\b/i, "🗑️"],
    [/hund|dog|gassi/i, "🐶"],
    [/katze|\bcats?\b/i, "🐱"],
    [/fisch|fish|aquarium/i, "🐠"],
    [/hase|kaninchen|rabbit|bunny|meerschwein|guinea/i, "🐰"],
    [/f(u|ü)ttern|feed/i, "🥕"],
    [/hausaufgabe|homework|schreiben|rechnen|math/i, "📚"],
    [/lesen|\bread|buch|book/i, "📖"],
    [/bett|\bbed\b/i, "🛏️"],
    [/anzieh|dress|kleid|clothes/i, "👕"],
    [/schuh|shoe/i, "👟"],
    [/w(a|ä)sche|waschmasch|laundry|socken|socks/i, "🧺"],
    [/staubsaug|saug|vacuum|fegen|sweep|besen/i, "🧹"],
    [/wisch|putz|clean|mop/i, "🫧"],
    [/haare|hair|k(a|ä)mm/i, "💇"],
    [/schulranzen|schultasche|ranzen|backpack|schoolbag/i, "🎒"],
    [/blume|pflanze|gie(ß|ss)|plant|water the/i, "🪴"],
    [/einkauf|shopping|groceries/i, "🛒"],
    [/kochen|cook|backen|bake/i, "🧑‍🍳"],
    [/essen|\beat\b|fr(u|ü)hst(u|ü)ck|breakfast|dinner|lunch/i, "🥣"],
    [/obst|fruit|apfel|apple/i, "🍎"],
    [/trinken|drink|wasser/i, "🥤"],
    [/(u|ü)ben|instrument|klavier|piano|gitarre|guitar|fl(o|ö)te|flute/i, "🎵"],
    [/sport|training|turnen|fu(ß|ss)ball|football|soccer/i, "⚽"],
    [/schlaf|sleep|pyjama|schlafanzug/i, "😴"],
    [/\bauto\b|\bcar\b|fahrrad|bike/i, "🚲"],
    [/garten|garden|laub|leaves|rasen|lawn/i, "🌳"],
    [/brief|post|mail/i, "✉️"],
    [/oma|opa|grandma|grandpa|anrufen|call/i, "📞"],
    [/medizin|medikament|tablette|medicine/i, "💊"],
    [/brille|glasses/i, "👓"],
  ];
  const EMOJI_START = /^(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*️?)\s*/u;

  const TEXTE = {
    de: {
      fertig: "Alles geschafft! 🎉",
      fertig_sub: "Super gemacht!",
      leer: "Keine Aufgaben",
      liste: "Liste bearbeiten",
      zurueck: "Nochmal antippen zum Zurücknehmen",
      fehlt: "Liste nicht gefunden",
    },
    en: {
      fertig: "All done! 🎉",
      fertig_sub: "Great job!",
      leer: "No tasks",
      liste: "Edit list",
      zurueck: "Tap again to undo",
      fehlt: "List not found",
    },
  };

  function sprache(hass) {
    const l = (hass && ((hass.locale && hass.locale.language) || hass.language)) || "de";
    return String(l).toLowerCase().startsWith("de") ? "de" : "en";
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function bildVon(item) {
    const beschreibung = item.description || "";
    const m = beschreibung.match(/^\s*(?:bild|image|foto|photo)\s*:\s*(https?:\/\/\S+|\/\S+)/im);
    let titel = String(item.summary || "");
    let emoji = null;
    const e = titel.match(EMOJI_START);
    if (e) {
      emoji = e[1];
      titel = titel.slice(e[0].length);
    }
    const pm = titel.match(/[+⭐]\s*(\d+)\s*$/u) || titel.match(/[+⭐]\s*(\d+)/u);
    const punkte = pm ? Number(pm[1]) : null;
    titel = titel.replace(/\s*[+⭐]\s*\d+\s*/gu, " ").trim();
    if (!emoji && !m) {
      const treffer = BILDER.find(([re]) => re.test(titel));
      emoji = treffer ? treffer[1] : "⭐";
    }
    return { url: m ? m[1] : null, emoji, titel, punkte };
  }

  class AufgabenBilderCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._items = null;
      this._unsub = null;
      this._frisch = new Set();
    }

    static getStubConfig(hass) {
      const todo = Object.keys((hass && hass.states) || {}).find((id) => id.startsWith("todo."));
      return { entity: todo || "todo.liste" };
    }

    setConfig(config) {
      const ok = config && (config.person || (config.entity && String(config.entity).startsWith("todo.")));
      if (!ok) throw new Error("aufgaben-bilder-card: Bitte 'entity: todo.…' oder 'person: auto' angeben.");
      this._config = { ton: true, erledigte: true, ...config };
      this._wechsel();
    }

    /** Aktuelle Liste: feste entity, eine Person (Kürzel) oder „auto“ = die am Gerät gewählte Person. */
    get _liste() {
      const c = this._config || {};
      if (c.entity) return c.entity;
      if (!this._hass) return null;
      const wahl = c.person === "auto" ? (window.familienplaner && window.familienplaner.person) || "familie" : c.person;
      for (const st of Object.values(this._hass.states)) {
        const a = st.attributes;
        if (!Array.isArray(a.fahrer) || !a.entitaeten) continue;
        const f = a.fahrer.find((x) => x.slug === wahl);
        return (f && f.liste) || a.familien_liste || null;
      }
      return null;
    }

    _wechsel() {
      if (this._aktiv !== this._liste) {
        this._abmelden();
        if (this._hass && this.isConnected) this._anmelden();
      }
      this._render();
    }

    set hass(hass) {
      const erste = !this._hass;
      this._hass = hass;
      if (erste || this._aktiv !== this._liste) this._wechsel();
      else this._render();
    }

    connectedCallback() {
      // Personenwahl am Wand-Display (familienplaner-cards.js) mitziehen
      this._personHandler = this._personHandler || (() => this._config && this._config.person === "auto" && this._wechsel());
      window.addEventListener("familienplaner-person", this._personHandler);
      if (this._hass && this._config) this._anmelden();
    }

    disconnectedCallback() {
      window.removeEventListener("familienplaner-person", this._personHandler);
      this._abmelden();
    }

    getCardSize() {
      return 4;
    }

    getGridOptions() {
      return { columns: 12, rows: "auto", min_columns: 6 };
    }

    get _t() {
      return TEXTE[sprache(this._hass)];
    }

    async _anmelden() {
      const entity = this._liste;
      if (this._unsub || !this._hass || !this._config || !entity) return;
      this._aktiv = entity;
      try {
        const unsub = await this._hass.connection.subscribeMessage(
          (msg) => {
            if (this._aktiv !== entity) return;
            this._items = msg.items || [];
            this._render();
          },
          { type: "todo/item/subscribe", entity_id: entity }
        );
        if (this._aktiv !== entity) unsub();
        else this._unsub = unsub;
      } catch (e) {
        try {
          const r = await this._hass.callWS({ type: "todo/item/list", entity_id: entity });
          this._items = r.items || [];
        } catch (e2) {
          this._items = [];
        }
        this._render();
      }
    }

    _abmelden() {
      if (this._unsub) {
        Promise.resolve(this._unsub).then((u) => typeof u === "function" && u());
        this._unsub = null;
      }
      this._items = null;
    }

    _farbe() {
      if (this._config.farbe) return this._config.farbe;
      // Personenfarbe aus dem Familien-Rennen übernehmen, falls vorhanden
      for (const st of Object.values(this._hass.states)) {
        const f = Array.isArray(st.attributes.fahrer) && st.attributes.fahrer.find((x) => x.liste === this._liste);
        if (f) return f.farbe_hex || "#5F7F63";
      }
      return "var(--primary-color)";
    }

    _render() {
      if (!this._hass || !this._config) return;
      const t = this._t;
      const st = this._hass.states[this._liste];
      const farbe = this._farbe();
      const items = this._items || [];
      const offen = items.filter((i) => i.status === "needs_action");
      const erledigt = items.filter((i) => i.status === "completed");
      const zeigeErledigt = this._config.erledigte ? erledigt.filter((i) => this._frisch.has(i.uid) || this._heute(i)) : [];

      const kachel = (i, fertig) => {
        const b = bildVon(i);
        const bild = b.url
          ? `<img src="${esc(b.url)}" alt="" loading="lazy">`
          : `<span class="emoji">${esc(b.emoji)}</span>`;
        return `<button class="kachel ${fertig ? "fertig" : ""}" data-uid="${esc(i.uid)}" title="${fertig ? esc(t.zurueck) : esc(b.titel)}">
            <span class="bild">${bild}${fertig ? '<span class="haken">✓</span>' : ""}</span>
            <span class="titel">${esc(b.titel)}</span>
            ${b.punkte ? `<span class="punkte">⭐ ${b.punkte}</span>` : ""}
          </button>`;
      };

      let inhalt;
      if (!st) inhalt = `<div class="leer">${esc(t.fehlt)}: ${esc(this._liste)}</div>`;
      else if (this._items === null) inhalt = `<div class="leer"><span class="lade"></span></div>`;
      else if (!offen.length)
        inhalt = `<div class="geschafft"><span class="pokal">🏆</span><b>${esc(t.fertig)}</b><span>${esc(t.fertig_sub)}</span></div>`;
      else inhalt = `<div class="raster">${offen.map((i) => kachel(i, false)).join("")}</div>`;
      if (zeigeErledigt.length) inhalt += `<div class="raster klein">${zeigeErledigt.map((i) => kachel(i, true)).join("")}</div>`;

      const titel = this._config.titel ?? (st ? st.attributes.friendly_name : "");
      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <ha-card style="--farbe:${farbe}">
          <div class="kopf">
            <span class="name">${esc(titel || "")}</span>
            <span class="zahl">${offen.length ? offen.length : ""}</span>
            <a class="liste" href="/todo?entity_id=${encodeURIComponent(this._liste)}" title="${esc(t.liste)}">✏️</a>
          </div>
          ${inhalt}
          <div class="fx"></div>
        </ha-card>`;
      this.shadowRoot.querySelectorAll(".kachel").forEach((k) =>
        k.addEventListener("click", () => this._tippen(k.dataset.uid, k.classList.contains("fertig"), k))
      );
    }

    _heute(i) {
      if (!i.completed) return false;
      const d = new Date(i.completed);
      const n = new Date();
      return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
    }

    async _tippen(uid, fertig, el) {
      if (!fertig) {
        el.classList.add("pop");
        this._frisch.add(uid);
        this._konfetti(el);
        if (this._config.ton) this._ton();
        if (navigator.vibrate) navigator.vibrate(40);
        await new Promise((r) => setTimeout(r, 450));
      }
      await this._hass.callService("todo", "update_item", {
        entity_id: this._liste,
        item: uid,
        status: fertig ? "needs_action" : "completed",
      });
    }

    _ton() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = (this._ctx = this._ctx || new Ctx());
        const jetzt = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = hz;
          g.gain.setValueAtTime(0.0001, jetzt + i * 0.08);
          g.gain.exponentialRampToValueAtTime(0.18, jetzt + i * 0.08 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, jetzt + i * 0.08 + 0.3);
          o.connect(g).connect(ctx.destination);
          o.start(jetzt + i * 0.08);
          o.stop(jetzt + i * 0.08 + 0.32);
        });
      } catch (e) {
        /* Ton ist nur ein Extra */
      }
    }

    _konfetti(el) {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const fx = this.shadowRoot.querySelector(".fx");
      const card = this.shadowRoot.querySelector("ha-card").getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const farben = ["#E5BE3C", "#D9849B", "#5B8DB8", "#6FA372", "#E39350", "#9B7BC4"];
      for (let k = 0; k < 28; k++) {
        const c = document.createElement("i");
        c.className = "konfetti";
        c.style.left = `${r.left - card.left + r.width / 2}px`;
        c.style.top = `${r.top - card.top + r.height / 3}px`;
        c.style.background = farben[k % farben.length];
        const w = Math.random() * Math.PI * 2;
        const d = 50 + Math.random() * 90;
        c.style.setProperty("--dx", `${Math.cos(w) * d}px`);
        c.style.setProperty("--dy", `${Math.sin(w) * d - 40}px`);
        c.style.setProperty("--rot", `${Math.random() * 540}deg`);
        fx.appendChild(c);
        setTimeout(() => c.remove(), 1100);
      }
    }
  }

  const STYLES = `
    :host { --fp-radius: var(--familienplaner-radius, 22px); --fp-radius-klein: var(--familienplaner-radius-klein, 18px);
      --fp-schatten: var(--familienplaner-schatten, 0 6px 20px rgba(0,0,0,.06)); display:block; }
    ha-card { display:block; position:relative; overflow:hidden; padding: 14px; border-radius: var(--fp-radius);
      box-shadow: var(--fp-schatten); font-family: var(--familienplaner-schrift, inherit); }
    .kopf { display:flex; align-items:center; gap:8px; margin: 2px 4px 12px; }
    .name { font-size: 20px; font-weight: 800; color: var(--primary-text-color); }
    .zahl { min-width: 26px; height: 26px; padding: 0 8px; box-sizing: border-box; border-radius: 13px; display:grid; place-items:center;
      background: var(--farbe); color:#fff; font-weight:800; font-size:14px; }
    .zahl:empty { display:none; }
    .liste { margin-left:auto; text-decoration:none; font-size: 20px; opacity:.6; padding: 4px; }
    .liste:hover { opacity: 1; }
    .raster { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .raster.klein { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; margin-top: 12px; }
    .kachel { all: unset; box-sizing:border-box; cursor:pointer; position:relative; display:flex; flex-direction:column; align-items:center;
      gap: 8px; padding: 14px 10px 12px; border-radius: var(--fp-radius-klein); -webkit-tap-highlight-color: transparent;
      background: color-mix(in srgb, var(--farbe) 12%, var(--card-background-color, #fff));
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--farbe) 22%, transparent); transition: transform .15s ease; }
    .kachel:hover { transform: translateY(-2px); }
    .kachel:active { transform: scale(.96); }
    .kachel:focus-visible { outline: 3px solid var(--farbe); outline-offset: 2px; }
    .bild { position:relative; width: 100%; aspect-ratio: 1; max-width: 140px; border-radius: 50%; display:grid; place-items:center;
      background: color-mix(in srgb, var(--farbe) 20%, var(--card-background-color, #fff)); overflow:hidden; }
    .emoji { font-size: clamp(56px, 12vw, 84px); line-height: 1; filter: drop-shadow(0 3px 3px rgba(0,0,0,.15)); }
    .bild img { width:100%; height:100%; object-fit: cover; }
    .titel { font-size: 16px; font-weight: 700; text-align:center; color: var(--primary-text-color); line-height:1.2;
      display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
    .punkte { position:absolute; top: 8px; right: 8px; background: #E5BE3C; color:#3B2F00; font-size: 13px; font-weight: 800;
      padding: 2px 8px; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
    .kachel.fertig { opacity: .55; padding: 8px 6px; gap: 4px; }
    .kachel.fertig .bild { max-width: 72px; }
    .kachel.fertig .emoji { font-size: 40px; filter: grayscale(.6); }
    .kachel.fertig .titel { font-size: 12px; text-decoration: line-through; }
    .kachel.fertig .punkte { display:none; }
    .haken { position:absolute; inset:0; display:grid; place-items:center; font-size: 44px; font-weight: 900; color:#fff;
      background: color-mix(in srgb, #4CAF50 70%, transparent); }
    .kachel.pop { animation: pop .45s ease; }
    .kachel.pop .bild::after { content:"✓"; position:absolute; inset:0; display:grid; place-items:center; font-size: 80px; font-weight:900;
      color:#fff; background: color-mix(in srgb, #4CAF50 75%, transparent); animation: rein .3s ease; }
    @keyframes pop { 0% { transform: scale(1); } 40% { transform: scale(1.12) rotate(-3deg); } 100% { transform: scale(1); } }
    @keyframes rein { from { opacity:0; transform: scale(.4); } to { opacity:1; transform: scale(1); } }
    .geschafft { display:flex; flex-direction:column; align-items:center; gap: 4px; padding: 18px 8px; text-align:center; color: var(--secondary-text-color); }
    .geschafft b { font-size: 22px; color: var(--primary-text-color); }
    .pokal { font-size: 72px; animation: wackeln 2.4s ease-in-out infinite; }
    @keyframes wackeln { 0%,100% { transform: rotate(0); } 10% { transform: rotate(-10deg); } 20% { transform: rotate(10deg); } 30% { transform: rotate(0); } }
    .leer { padding: 18px; text-align:center; color: var(--secondary-text-color); }
    .lade { display:inline-block; width: 28px; height: 28px; border-radius:50%; border: 3px solid var(--divider-color, #ddd);
      border-top-color: var(--farbe); animation: dreh 1s linear infinite; }
    @keyframes dreh { to { transform: rotate(360deg); } }
    .fx { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
    .konfetti { position:absolute; width: 8px; height: 11px; border-radius: 2px; animation: flieg 1s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes flieg { to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; } }
    @media (max-width: 420px) { .raster { grid-template-columns: repeat(2, 1fr); } }
    @media (prefers-reduced-motion: reduce) { .kachel.pop, .pokal { animation: none; } }
  `;

  if (!customElements.get("aufgaben-bilder-card")) {
    customElements.define("aufgaben-bilder-card", AufgabenBilderCard);
    window.customCards = window.customCards || [];
    window.customCards.push({
      type: "aufgaben-bilder-card",
      name: "Aufgaben als Bilder (Familienplaner)",
      description: "Große Bild-Kacheln für Aufgaben – auch für Kinder, die noch nicht lesen können.",
      preview: true,
    });
  }
  window.familienplanerBildVon = bildVon; // für Tests
})();
