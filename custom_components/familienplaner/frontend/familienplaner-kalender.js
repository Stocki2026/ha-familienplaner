/*
 * Familienplaner – Kalender
 *   custom:familienplaner-kalender
 *
 * Eigene Kalenderansicht ohne Zusatzkarten:
 *   - Tag / Woche / Monat / Liste, Wischen oder ‹ › zum Blättern, „Heute“
 *   - Personen-Filter (Farbchips), folgt optional der am Wand-Display gewählten Person
 *   - Jetzt-Linie, ganztägige Termine oben, überlappende Termine nebeneinander
 *   - Termin antippen: Details, ändern, löschen (bei Serien: nur diesen / alle folgenden)
 *   - Leere Stelle antippen: neuer Termin in einem Satz, Tag und Uhrzeit schon vorausgefüllt
 *   - „Wer hat Zeit?“: zeigt freie Zeiten, in denen niemand aus dem Filter einen Termin hat
 *
 * Optionen:
 *   kalender: [{entity, name, farbe, slug}]   (füllt die Strategie automatisch)
 *   ansicht: woche | tag | monat | liste     (Start-Ansicht, Standard woche)
 *   von: 6, bis: 22                          (sichtbare Stunden)
 *   tage_liste: 14                           (Tage in der Liste)
 *   folge_person: true                       (Filter folgt der gewählten Person)
 *   titel: "Kalender"
 */

const KT = {
  de: {
    tage: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
    tageKurz: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    monate: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    heute: "Heute", morgen: "Morgen", tag: "Tag", woche: "Woche", monat: "Monat", liste: "Liste", kw: "KW",
    ganztags: "ganztägig", weitere: "weitere", frei: "Wer hat Zeit?", neu: "Termin", keine: "Keine Termine in diesem Zeitraum 🌿",
    bearbeiten: "Ändern", loeschen: "Löschen", schliessen: "Schließen", speichern: "Speichern", abbrechen: "Abbrechen",
    nurDieser: "Nur diesen", alleFolgenden: "Diesen und alle folgenden", wirklich: "Termin wirklich löschen?",
    titel: "Was?", datum: "Datum", von: "Von", bis: "Bis", ort: "Wo?", notiz: "Notiz", ganztaegig: "Ganztägig",
    serie: "Wiederholt sich", karte: "Karte", eintragen: "Eintragen", neuTitel: "Neuer Termin",
    neuHinweis: "Einfach schreiben, z. B. „Ben Fußball um 16 Uhr im Sportpark, Anna fährt“ oder „jeden Dienstag 17–18 Uhr Schwimmen“.",
    uhr: "Uhr", fehler: "Das hat nicht geklappt", freiHinweis: "Grün = alle aus dem Filter haben Zeit",
  },
  en: {
    tage: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    tageKurz: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monate: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    heute: "Today", morgen: "Tomorrow", tag: "Day", woche: "Week", monat: "Month", liste: "List", kw: "Week",
    ganztags: "all day", weitere: "more", frei: "Who's free?", neu: "Event", keine: "No events in this period 🌿",
    bearbeiten: "Edit", loeschen: "Delete", schliessen: "Close", speichern: "Save", abbrechen: "Cancel",
    nurDieser: "Only this one", alleFolgenden: "This and all following", wirklich: "Really delete this event?",
    titel: "What?", datum: "Date", von: "From", bis: "Until", ort: "Where?", notiz: "Note", ganztaegig: "All day",
    serie: "Repeats", karte: "Map", eintragen: "Add", neuTitel: "New event",
    neuHinweis: "Just type, e.g. “Ben football at 4pm, Anna drives” or “every Tuesday 5–6pm swimming”.",
    uhr: "", fehler: "That didn't work", freiHinweis: "Green = everyone in the filter is free",
  },
};
const kesc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const p2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
const tagAnfang = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const plusTage = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const gleicherTag = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isoLokal = (d) => {
  const o = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:00${o >= 0 ? "+" : "-"}${p2(o / 60)}:${p2(o % 60)}`;
};
const datumIso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hhmm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
const montag = (d) => plusTage(tagAnfang(d), -((d.getDay() + 6) % 7));
const kalenderwoche = (d) => {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const t = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - t);
  return Math.ceil(((x - new Date(Date.UTC(x.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7);
};
const sym = (titel) => (window.familienplaner && window.familienplaner.symbol ? window.familienplaner.symbol(titel) : "");

class FamilienplanerKalender extends HTMLElement {
  setConfig(config) {
    this._config = { ansicht: "woche", von: 6, bis: 22, tage_liste: 14, folge_person: true, ...(config || {}) };
    this._ansicht = this._gespeichert("ansicht") || this._config.ansicht;
    this._datum = tagAnfang(new Date());
    this._versteckt = new Set(JSON.parse(this._gespeichert("filter") || "[]"));
    this._termine = [];
    this._frei = false;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
  }

  set hass(hass) {
    const alt = this._hass;
    this._hass = hass;
    const ents = (this._config.kalender || []).map((k) => k.entity);
    if (!alt) return this._laden();
    // Kalender-Entitäten ändern ihren Zustand, wenn Termine angelegt/geändert werden
    if (ents.some((e) => alt.states[e] !== hass.states[e])) this._laden();
  }

  connectedCallback() {
    this._personWechsel = (e) => {
      if (!this._config.folge_person) return;
      const slug = e.detail && e.detail.slug;
      const alle = this._config.kalender || [];
      this._versteckt = new Set(slug && slug !== "familie" ? alle.filter((k) => k.slug && k.slug !== slug).map((k) => k.entity) : []);
      this._zeichnen();
    };
    window.addEventListener("familienplaner-person", this._personWechsel);
    this._takt = setInterval(() => this._laden(), 5 * 60000);
    this._minute = setInterval(() => { if (!this._dialog) this._zeichnen(); }, 60000);
  }

  disconnectedCallback() {
    window.removeEventListener("familienplaner-person", this._personWechsel);
    clearInterval(this._takt);
    clearInterval(this._minute);
  }

  getCardSize() { return 10; }
  getGridOptions() { return { columns: 12, rows: "auto" }; }

  _tx() { return KT[(this._hass && this._hass.language || "de").startsWith("de") ? "de" : "en"]; }
  _schmal() { return (this.clientWidth || window.innerWidth) < 640; }
  _schluessel(k) { return `familienplaner-kalender-${k}-${this._config.ansicht}-${(this._config.kalender || []).map((x) => x.entity).join(",").length}`; }
  _gespeichert(k) { try { return localStorage.getItem(this._schluessel(k)); } catch (e) { return null; } }
  _merken(k, v) { try { localStorage.setItem(this._schluessel(k), v); } catch (e) { /* privat */ } }

  // ------------------------------------------------------------- Zeitraum
  _bereich() {
    const d = this._datum;
    if (this._ansicht === "tag") return [tagAnfang(d), plusTage(tagAnfang(d), 1)];
    if (this._ansicht === "woche") {
      if (this._schmal()) return [tagAnfang(d), plusTage(tagAnfang(d), 3)];
      const m = montag(d);
      return [m, plusTage(m, 7)];
    }
    if (this._ansicht === "monat") {
      const erster = new Date(d.getFullYear(), d.getMonth(), 1);
      const start = montag(erster);
      return [start, plusTage(start, 42)];
    }
    return [tagAnfang(d), plusTage(tagAnfang(d), this._config.tage_liste)];
  }

  _blaettern(richtung) {
    const d = this._datum;
    if (richtung === 0) this._datum = tagAnfang(new Date());
    else if (this._ansicht === "tag") this._datum = plusTage(d, richtung);
    else if (this._ansicht === "woche") this._datum = plusTage(d, richtung * (this._schmal() ? 3 : 7));
    else if (this._ansicht === "monat") this._datum = new Date(d.getFullYear(), d.getMonth() + richtung, 1);
    else this._datum = plusTage(d, richtung * this._config.tage_liste);
    this._laden();
  }

  // ---------------------------------------------------------------- Daten
  async _laden() {
    if (!this._hass) return;
    const [start, ende] = this._bereich();
    const nummer = (this._ladeNummer = (this._ladeNummer || 0) + 1);
    const kalender = (this._config.kalender || []).filter((k) => this._hass.states[k.entity]);
    const listen = await Promise.all(kalender.map((k) => this._hass
      .callApi("GET", `calendars/${k.entity}?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(ende.toISOString())}`)
      .then((ev) => ev.map((e) => this._normal(e, k)))
      .catch(() => [])));
    if (nummer !== this._ladeNummer) return; // veraltete Antwort
    this._termine = listen.flat().sort((a, b) => a.start - b.start || b.ende - a.ende);
    if (!this._dialog) this._zeichnen();
  }

  _normal(e, k) {
    const ganz = !e.start.dateTime;
    const start = ganz ? new Date(e.start.date + "T00:00:00") : new Date(e.start.dateTime);
    const ende = ganz ? new Date(e.end.date + "T00:00:00") : new Date(e.end.dateTime);
    const fahrer = (/fahrer:\s*([^\s,]+)/i.exec(e.description || "") || [])[1] || "";
    return {
      kal: k.entity, farbe: k.farbe || "#8C7B6B", name: k.name || k.entity, titel: e.summary || "", ort: e.location || "",
      beschr: e.description || "", start, ende, ganz, uid: e.uid, rid: e.recurrence_id, rrule: e.rrule, fahrer,
    };
  }

  _sichtbar() { return this._termine.filter((t) => !this._versteckt.has(t.kal)); }

  // -------------------------------------------------------------- Zeichnen
  _zeichnen() {
    if (!this.shadowRoot || !this._hass) return;
    const tx = this._tx();
    const [start] = this._bereich();
    let inhalt = "";
    if (this._ansicht === "monat") inhalt = this._monat(start);
    else if (this._ansicht === "liste") inhalt = this._liste(start);
    else inhalt = this._raster(start, this._ansicht === "tag" ? 1 : (this._schmal() ? 3 : 7));

    const chips = (this._config.kalender || []).filter((k) => this._hass.states[k.entity]).map((k) =>
      `<button class="chip ${this._versteckt.has(k.entity) ? "aus" : ""}" data-kal="${kesc(k.entity)}" style="--f:${kesc(k.farbe || "#8C7B6B")}"><span class="punkt"></span>${kesc(k.name)}</button>`).join("");
    const ansichten = ["tag", "woche", "monat", "liste"].map((a) => `<button class="seg ${this._ansicht === a ? "an" : ""}" data-ansicht="${a}">${kesc(tx[a])}</button>`).join("");

    this.shadowRoot.innerHTML = `<style>${KALENDER_CSS}</style>
      <ha-card>
        <div class="kopf">
          <div class="nav">
            <button class="rund" data-blaettern="-1" aria-label="zurück">‹</button>
            <button class="heutebtn" data-blaettern="0">${kesc(tx.heute)}</button>
            <button class="rund" data-blaettern="1" aria-label="vor">›</button>
            <div class="titel">${kesc(this._titel())}</div>
          </div>
          <div class="werkzeuge">
            ${this._ansicht === "woche" || this._ansicht === "tag" ? `<button class="frei ${this._frei ? "an" : ""}" title="${kesc(tx.freiHinweis)}">🟢 ${kesc(tx.frei)}</button>` : ""}
            <div class="segmente">${ansichten}</div>
            <button class="neu">＋ ${kesc(tx.neu)}</button>
          </div>
        </div>
        <div class="chips">${chips}</div>
        <div class="inhalt">${inhalt}</div>
      </ha-card>
      ${this._dialog ? this._dialogHtml() : ""}`;
    this._verbinden();
  }

  _titel() {
    const tx = this._tx();
    const [start, ende] = this._bereich();
    const d = this._datum;
    if (this._ansicht === "tag") return `${tx.tage[d.getDay()]}, ${d.getDate()}. ${tx.monate[d.getMonth()]}`;
    if (this._ansicht === "monat") return `${tx.monate[d.getMonth()]} ${d.getFullYear()}`;
    const letzter = plusTage(ende, -1);
    const spanne = start.getMonth() === letzter.getMonth()
      ? `${start.getDate()}.–${letzter.getDate()}. ${tx.monate[start.getMonth()]}`
      : `${start.getDate()}. ${tx.monate[start.getMonth()].slice(0, 3)} – ${letzter.getDate()}. ${tx.monate[letzter.getMonth()].slice(0, 3)}`;
    return this._ansicht === "woche" ? `${tx.kw} ${kalenderwoche(start)} · ${spanne}` : spanne;
  }

  _block(t, extra = "") {
    const s = sym(t.titel);
    return `<div class="termin ${extra}" data-id="${kesc(this._id(t))}" style="--f:${kesc(t.farbe)}" title="${kesc(t.titel)}">`;
  }
  _id(t) { return `${t.kal}|${t.uid}|${t.rid || ""}|${t.start.getTime()}`; }

  // Tag/Woche: Zeitraster
  _raster(start, anzahl) {
    const tx = this._tx();
    const { von, bis } = this._config;
    const stunden = bis - von;
    const jetzt = new Date();
    const termine = this._sichtbar();
    const tage = [...Array(anzahl)].map((_, i) => plusTage(start, i));

    const kopf = tage.map((d) => `<div class="tagkopf ${gleicherTag(d, jetzt) ? "heute" : ""}" data-tag="${datumIso(d)}">
      <span class="wt">${kesc(tx.tageKurz[d.getDay()])}</span><span class="nr">${d.getDate()}</span></div>`).join("");

    const ganz = tage.map((d) => {
      const liste = termine.filter((t) => t.ganz && t.start <= d && t.ende > d);
      return `<div class="ganzzelle">${liste.map((t) => `${this._block(t, "ganz")}${sym(t.titel)} ${kesc(t.titel)}</div>`).join("")}</div>`;
    }).join("");
    const hatGanz = tage.some((d) => termine.some((t) => t.ganz && t.start <= d && t.ende > d));

    const linien = [...Array(stunden)].map((_, i) => `<div class="stunde"><span>${p2(von + i)}:00</span></div>`).join("");
    const spalten = tage.map((d) => {
      const tagStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), von);
      const tagEnde = new Date(d.getFullYear(), d.getMonth(), d.getDate(), bis);
      const liste = termine.filter((t) => !t.ganz && t.start < tagEnde && t.ende > tagStart);
      const platziert = this._spalten(liste);
      const bloecke = platziert.map(({ t, spalte, breite }) => {
        const s = Math.max(t.start, tagStart);
        const e = Math.min(t.ende, tagEnde);
        const oben = ((s - tagStart) / 3600000 / stunden) * 100;
        const hoehe = Math.max(((e - s) / 3600000 / stunden) * 100, 2.2);
        const vorbei = t.ende < jetzt ? "vorbei" : "";
        const kurz = (e - s) < 45 * 60000 ? "kurz" : "";
        return `${this._block(t, `zeit ${vorbei} ${kurz}`).replace('style="', `style="top:${oben}%;height:${hoehe}%;left:${(spalte / breite) * 100}%;width:calc(${100 / breite}% - 3px);`)}
          <div class="tt">${sym(t.titel)} ${kesc(t.titel)}</div>
          <div class="tz">${hhmm(t.start)}–${hhmm(t.ende)}${t.ort ? ` · ${kesc(t.ort)}` : ""}${t.fahrer ? ` · 🚗 ${kesc(t.fahrer)}` : ""}</div></div>`;
      }).join("");
      let jetztLinie = "";
      if (gleicherTag(d, jetzt) && jetzt >= tagStart && jetzt < tagEnde) jetztLinie = `<div class="jetzt" style="top:${((jetzt - tagStart) / 3600000 / stunden) * 100}%"></div>`;
      const frei = this._frei ? this._freiBloecke(liste, tagStart, tagEnde, stunden, jetzt) : "";
      const klick = [...Array(stunden)].map((_, i) => `<div class="slot" data-slot="${datumIso(d)}T${p2(von + i)}"></div>`).join("");
      return `<div class="spalte ${gleicherTag(d, jetzt) ? "heute" : ""}">${klick}${frei}${bloecke}${jetztLinie}</div>`;
    }).join("");

    return `<div class="raster" style="--n:${anzahl};--h:${stunden}">
      <div class="ecke"></div>${kopf}
      ${hatGanz ? `<div class="ecke klein">${kesc(tx.ganztags)}</div>${ganz}` : ""}
      <div class="zeiten">${linien}</div>${spalten}
    </div>`;
  }

  _spalten(liste) {
    // überlappende Termine nebeneinander
    const ergebnis = [];
    let gruppe = [];
    let gruppeEnde = 0;
    const abschliessen = () => {
      const breite = Math.max(1, ...gruppe.map((g) => g.spalte + 1));
      gruppe.forEach((g) => ergebnis.push({ ...g, breite }));
      gruppe = [];
    };
    for (const t of liste) {
      if (gruppe.length && t.start >= gruppeEnde) abschliessen();
      const belegt = new Set(gruppe.filter((g) => g.t.ende > t.start).map((g) => g.spalte));
      let spalte = 0;
      while (belegt.has(spalte)) spalte++;
      gruppe.push({ t, spalte });
      gruppeEnde = Math.max(gruppeEnde, t.ende);
    }
    if (gruppe.length) abschliessen();
    return ergebnis;
  }

  _freiBloecke(liste, tagStart, tagEnde, stunden, jetzt) {
    let cursor = Math.max(tagStart, jetzt > tagStart ? new Date(Math.ceil(jetzt / 900000) * 900000) : tagStart);
    const html = [];
    const frei = (a, b) => {
      if (b - a < 30 * 60000) return;
      html.push(`<div class="freiblock" style="top:${((a - tagStart) / 3600000 / stunden) * 100}%;height:${((b - a) / 3600000 / stunden) * 100}%"><span>${hhmm(new Date(a))}–${hhmm(new Date(b))}</span></div>`);
    };
    for (const t of [...liste].sort((a, b) => a.start - b.start)) {
      if (t.ende <= cursor) continue;
      if (t.start > cursor) frei(cursor, Math.min(t.start, tagEnde));
      cursor = Math.max(cursor, t.ende);
    }
    if (cursor < tagEnde) frei(cursor, tagEnde);
    return html.join("");
  }

  // Monat
  _monat(start) {
    const tx = this._tx();
    const jetzt = new Date();
    const termine = this._sichtbar();
    const max = this._schmal() ? 2 : 3;
    const kopf = [1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="mkopf">${kesc(tx.tageKurz[i])}</div>`).join("");
    const zellen = [...Array(42)].map((_, i) => {
      const d = plusTage(start, i);
      const naechster = plusTage(d, 1);
      const liste = termine.filter((t) => t.start < naechster && t.ende > d && !(t.ganz && t.ende <= d));
      const sichtbar = liste.slice(0, max).map((t) => `${this._block(t, "mini")}<span class="mp"></span>${t.ganz ? "" : `<b>${hhmm(t.start)}</b>`}<span class="mt">${sym(t.titel)} ${kesc(t.titel)}</span></div>`).join("");
      const mehr = liste.length > max ? `<div class="mehr">+${liste.length - max} ${kesc(tx.weitere)}</div>` : "";
      const fremd = d.getMonth() !== this._datum.getMonth() ? "fremd" : "";
      return `<div class="mzelle ${fremd} ${gleicherTag(d, jetzt) ? "heute" : ""}" data-tag="${datumIso(d)}"><div class="mnr">${d.getDate()}</div>${sichtbar}${mehr}</div>`;
    }).join("");
    return `<div class="monat">${kopf}${zellen}</div>`;
  }

  // Liste
  _liste(start) {
    const tx = this._tx();
    const termine = this._sichtbar();
    const jetzt = new Date();
    const tage = [];
    for (let i = 0; i < this._config.tage_liste; i++) {
      const d = plusTage(start, i);
      const n = plusTage(d, 1);
      const liste = termine.filter((t) => t.start < n && t.ende > d);
      if (!liste.length) continue;
      const label = gleicherTag(d, jetzt) ? tx.heute : gleicherTag(d, plusTage(jetzt, 1)) ? tx.morgen : `${tx.tage[d.getDay()]}, ${d.getDate()}. ${tx.monate[d.getMonth()]}`;
      tage.push(`<div class="ltag" data-tag="${datumIso(d)}"><div class="llabel">${kesc(label)}</div>${liste.map((t) => `${this._block(t, `lzeile ${t.ende < jetzt ? "vorbei" : ""}`)}
        <span class="lzeit">${t.ganz ? kesc(tx.ganztags) : `${hhmm(t.start)}<small>${hhmm(t.ende)}</small>`}</span>
        <span class="lbalken"></span>
        <span class="ltext"><span class="lt">${sym(t.titel)} ${kesc(t.titel)}</span>
          <span class="lm">${kesc(t.name)}${t.ort ? ` · 📍 ${kesc(t.ort)}` : ""}${t.fahrer ? ` · 🚗 ${kesc(t.fahrer)}` : ""}${t.rrule ? " · 🔁" : ""}</span></span></div>`).join("")}</div>`);
    }
    return tage.length ? `<div class="liste">${tage.join("")}</div>` : `<div class="leer">${kesc(tx.keine)}</div>`;
  }

  // ---------------------------------------------------------------- Dialog
  _dialogHtml() {
    const tx = this._tx();
    const d = this._dialog;
    let inhalt = "";
    if (d.art === "neu") {
      inhalt = `<h2>${kesc(tx.neuTitel)}</h2>
        <form class="satz"><input name="satz" value="${kesc(d.text || "")}" autocomplete="off" enterkeyhint="send">
        <button type="submit" class="primaer">${kesc(tx.eintragen)}</button></form>
        <p class="hinweis">${kesc(tx.neuHinweis)}</p><div class="meldung ${d.ok ? "ok" : d.fehler ? "fehler" : ""}">${kesc(d.meldung || "")}</div>`;
    } else if (d.art === "zeigen" || d.art === "loeschen") {
      const t = d.t;
      const wann = t.ganz
        ? `${this._datumText(t.start)}${t.ende - t.start > 86400000 ? ` – ${this._datumText(plusTage(t.ende, -1))}` : ""} · ${tx.ganztags}`
        : `${this._datumText(t.start)} · ${hhmm(t.start)}–${hhmm(t.ende)} ${tx.uhr}`;
      inhalt = `<div class="dfarbe" style="--f:${kesc(t.farbe)}"></div>
        <h2>${sym(t.titel)} ${kesc(t.titel)}</h2>
        <div class="dzeile">🕒 ${kesc(wann)}</div>
        <div class="dzeile"><span class="punkt" style="--f:${kesc(t.farbe)}"></span>${kesc(t.name)}</div>
        ${t.ort ? `<div class="dzeile">📍 ${kesc(t.ort)} <a href="https://www.openstreetmap.org/search?query=${encodeURIComponent(t.ort)}" target="_blank" rel="noopener">${kesc(tx.karte)} ↗</a></div>` : ""}
        ${t.rrule || t.rid ? `<div class="dzeile">🔁 ${kesc(tx.serie)}</div>` : ""}
        ${t.beschr ? `<div class="dnotiz">${kesc(t.beschr)}</div>` : ""}
        ${d.art === "loeschen"
          ? `<div class="frage">${kesc(tx.wirklich)}</div><div class="knoepfe">
              <button class="gefahr" data-weg="nur">${kesc(t.rrule || t.rid ? tx.nurDieser : tx.loeschen)}</button>
              ${t.rrule || t.rid ? `<button class="gefahr" data-weg="folgende">${kesc(tx.alleFolgenden)}</button>` : ""}
              <button data-aktion="zeigen">${kesc(tx.abbrechen)}</button></div>`
          : `<div class="knoepfe"><button class="primaer" data-aktion="bearbeiten">✏️ ${kesc(tx.bearbeiten)}</button>
              <button data-aktion="loeschen">🗑️ ${kesc(tx.loeschen)}</button></div>`}`;
    } else if (d.art === "bearbeiten") {
      const t = d.t;
      inhalt = `<h2>✏️ ${kesc(tx.bearbeiten)}</h2>
        <form class="formular">
          <label>${kesc(tx.titel)}<input name="titel" value="${kesc(t.titel)}" required></label>
          <label class="zeile2">${kesc(tx.datum)}<input type="date" name="datum" value="${datumIso(t.start)}" required></label>
          <label class="check"><input type="checkbox" name="ganz" ${t.ganz ? "checked" : ""}> ${kesc(tx.ganztaegig)}</label>
          <div class="zeiten2 ${t.ganz ? "versteckt" : ""}">
            <label>${kesc(tx.von)}<input type="time" name="von" value="${hhmm(t.start)}"></label>
            <label>${kesc(tx.bis)}<input type="time" name="bis" value="${hhmm(t.ende)}"></label>
          </div>
          <label>${kesc(tx.ort)}<input name="ort" value="${kesc(t.ort)}"></label>
          <label>${kesc(tx.notiz)}<textarea name="notiz" rows="2">${kesc(t.beschr)}</textarea></label>
          <div class="meldung fehler">${kesc(d.meldung || "")}</div>
          <div class="knoepfe"><button type="submit" class="primaer">${kesc(tx.speichern)}</button><button type="button" data-aktion="zeigen">${kesc(tx.abbrechen)}</button></div>
        </form>`;
    }
    return `<div class="hintergrund"><div class="dialog" role="dialog">
      <button class="zu" aria-label="${kesc(tx.schliessen)}">✕</button>${inhalt}</div></div>`;
  }

  _datumText(d) {
    const tx = this._tx();
    const jetzt = new Date();
    if (gleicherTag(d, jetzt)) return tx.heute;
    if (gleicherTag(d, plusTage(jetzt, 1))) return tx.morgen;
    return `${tx.tage[d.getDay()]}, ${d.getDate()}. ${tx.monate[d.getMonth()]}`;
  }

  _oeffnen(dialog) {
    this._dialog = dialog;
    this._zeichnen();
    const feld = this.shadowRoot.querySelector(".dialog input[name=satz], .dialog input[name=titel]");
    if (feld) { feld.focus(); feld.setSelectionRange(feld.value.length, feld.value.length); }
  }

  _schliessen() {
    this._dialog = null;
    this._zeichnen();
  }

  async _ws(nachricht) {
    return this._hass.callWS(nachricht);
  }

  async _speichern(form) {
    const t = this._dialog.t;
    const f = new FormData(form);
    const ganz = f.get("ganz") === "on";
    const datum = f.get("datum");
    let dtstart; let dtend;
    if (ganz) {
      const tage = Math.max(1, Math.round((t.ende - t.start) / 86400000));
      const s = new Date(datum + "T00:00:00");
      dtstart = datumIso(s);
      dtend = datumIso(plusTage(s, t.ganz ? tage : 1));
    } else {
      const s = new Date(`${datum}T${f.get("von") || "09:00"}:00`);
      let e = new Date(`${datum}T${f.get("bis") || "10:00"}:00`);
      if (e <= s) e = new Date(s.getTime() + 60 * 60000);
      dtstart = isoLokal(s);
      dtend = isoLokal(e);
    }
    const event = { summary: String(f.get("titel") || "").trim() || t.titel, dtstart, dtend };
    if (f.get("ort")) event.location = String(f.get("ort"));
    if (f.get("notiz")) event.description = String(f.get("notiz"));
    try {
      await this._ws({ type: "calendar/event/update", entity_id: t.kal, uid: t.uid, ...(t.rid ? { recurrence_id: t.rid } : {}), event });
      this._dialog = null;
      await this._laden();
    } catch (err) {
      this._dialog = { ...this._dialog, meldung: `${this._tx().fehler}: ${err.message || err}` };
      this._zeichnen();
    }
  }

  async _loeschen(art) {
    const t = this._dialog.t;
    try {
      await this._ws({
        type: "calendar/event/delete", entity_id: t.kal, uid: t.uid,
        ...(t.rid ? { recurrence_id: t.rid } : {}),
        ...(art === "folgende" && t.rid ? { recurrence_range: "THISANDFUTURE" } : {}),
      });
      this._dialog = null;
      await this._laden();
    } catch (err) {
      this._dialog = { ...this._dialog, art: "zeigen" };
      this._zeichnen();
    }
  }

  async _satzEintragen(text) {
    try {
      const antwort = await this._ws({
        type: "call_service", domain: "familienplaner", service: "termin_aus_satz",
        service_data: { text }, return_response: true,
      });
      const r = (antwort && antwort.response) || {};
      this._dialog = { art: "neu", text: r.verstanden ? "" : text, meldung: r.antwort || "", ok: !!r.verstanden, fehler: !r.verstanden };
      this._zeichnen();
      if (r.verstanden) {
        this._laden();
        setTimeout(() => { if (this._dialog && this._dialog.ok) this._schliessen(); }, 2500);
      }
    } catch (err) {
      this._dialog = { art: "neu", text, meldung: `${this._tx().fehler}: ${err.message || err}`, fehler: true };
      this._zeichnen();
    }
  }

  _vorbelegung(tag, stunde) {
    const tx = this._tx();
    const d = new Date(`${tag}T00:00:00`);
    const jetzt = new Date();
    const deutsch = tx === KT.de;
    let text = gleicherTag(d, jetzt) ? (deutsch ? "heute" : "today") : gleicherTag(d, plusTage(jetzt, 1)) ? (deutsch ? "morgen" : "tomorrow") : (deutsch ? `am ${d.getDate()}.${d.getMonth() + 1}.` : `on ${d.getMonth() + 1}/${d.getDate()}`);
    if (stunde !== undefined) text += deutsch ? ` um ${stunde} Uhr` : ` at ${stunde}:00`;
    const person = window.familienplaner && window.familienplaner.person;
    const p = (this._config.kalender || []).find((k) => k.slug && k.slug === person);
    return `${p ? p.name + " " : ""}${text} `;
  }

  // -------------------------------------------------------------- Ereignisse
  _verbinden() {
    const root = this.shadowRoot;
    const finde = (id) => this._termine.find((t) => this._id(t) === id);
    root.querySelectorAll("[data-blaettern]").forEach((b) => b.addEventListener("click", () => this._blaettern(Number(b.dataset.blaettern))));
    root.querySelectorAll("[data-ansicht]").forEach((b) => b.addEventListener("click", () => {
      this._ansicht = b.dataset.ansicht;
      this._merken("ansicht", this._ansicht);
      this._laden();
    }));
    root.querySelectorAll("[data-kal]").forEach((b) => b.addEventListener("click", () => {
      const e = b.dataset.kal;
      if (this._versteckt.has(e)) this._versteckt.delete(e); else this._versteckt.add(e);
      this._merken("filter", JSON.stringify([...this._versteckt]));
      this._zeichnen();
    }));
    const frei = root.querySelector(".frei");
    if (frei) frei.addEventListener("click", () => { this._frei = !this._frei; this._zeichnen(); });
    root.querySelector(".neu").addEventListener("click", () => this._oeffnen({ art: "neu", text: this._vorbelegung(datumIso(this._datum < tagAnfang(new Date()) ? new Date() : this._datum)) }));
    root.querySelectorAll(".termin").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const t = finde(el.dataset.id);
      if (t) this._oeffnen({ art: "zeigen", t });
    }));
    root.querySelectorAll("[data-slot]").forEach((el) => el.addEventListener("click", () => {
      const [tag, stunde] = el.dataset.slot.split("T");
      this._oeffnen({ art: "neu", text: this._vorbelegung(tag, Number(stunde)) });
    }));
    root.querySelectorAll(".freiblock").forEach((el) => el.addEventListener("click", (e) => {
      e.stopPropagation();
      const slot = el.parentElement.querySelector("[data-slot]");
      const tag = slot ? slot.dataset.slot.split("T")[0] : datumIso(this._datum);
      this._oeffnen({ art: "neu", text: this._vorbelegung(tag, Number(el.textContent.slice(0, 2))) });
    }));
    root.querySelectorAll(".mzelle, .tagkopf").forEach((el) => el.addEventListener("click", () => {
      this._datum = new Date(`${el.dataset.tag}T00:00:00`);
      this._ansicht = "tag";
      this._laden();
    }));
    // Wischen zum Blättern
    const inhalt = root.querySelector(".inhalt");
    if (inhalt) {
      inhalt.addEventListener("pointerdown", (e) => { this._wisch = { x: e.clientX, y: e.clientY }; }, { passive: true });
      inhalt.addEventListener("pointerup", (e) => {
        if (!this._wisch) return;
        const dx = e.clientX - this._wisch.x;
        const dy = e.clientY - this._wisch.y;
        this._wisch = null;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) this._blaettern(dx < 0 ? 1 : -1);
      }, { passive: true });
    }
    // Dialog
    const hg = root.querySelector(".hintergrund");
    if (!hg) return;
    hg.addEventListener("click", (e) => { if (e.target === hg) this._schliessen(); });
    root.querySelector(".zu").addEventListener("click", () => this._schliessen());
    root.querySelectorAll("[data-aktion]").forEach((b) => b.addEventListener("click", () => {
      this._dialog = { ...this._dialog, art: b.dataset.aktion, meldung: "" };
      this._zeichnen();
    }));
    root.querySelectorAll("[data-weg]").forEach((b) => b.addEventListener("click", () => this._loeschen(b.dataset.weg)));
    const formular = root.querySelector(".formular");
    if (formular) {
      formular.addEventListener("submit", (e) => { e.preventDefault(); this._speichern(formular); });
      const ganz = formular.querySelector("[name=ganz]");
      ganz.addEventListener("change", () => formular.querySelector(".zeiten2").classList.toggle("versteckt", ganz.checked));
    }
    const satz = root.querySelector(".satz");
    if (satz) satz.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = satz.querySelector("input").value.trim();
      if (text) this._satzEintragen(text);
    });
    root.addEventListener("keydown", (e) => { if (e.key === "Escape" && this._dialog) this._schliessen(); });
  }
}

const KALENDER_CSS = `
  :host { display: block; --fp-radius: var(--familienplaner-radius, 22px); --stunde: 46px; }
  ha-card { border-radius: var(--fp-radius); box-shadow: var(--familienplaner-schatten, 0 6px 20px rgba(0,0,0,.06)); padding: 16px 18px 18px; overflow: hidden;
            font-family: var(--familienplaner-schrift, var(--primary-font-family, inherit)); }
  button { font: inherit; cursor: pointer; color: var(--primary-text-color); }
  .kopf { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .nav { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .rund { width: 38px; height: 38px; border-radius: 50%; border: 0; font-size: 22px; line-height: 1; background: color-mix(in srgb, var(--primary-text-color) 7%, transparent); }
  .heutebtn { height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--divider-color, #ddd); background: transparent; font-weight: 700; }
  .titel { font-size: clamp(17px, 2.2vw, 22px); font-weight: 750; margin-left: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .werkzeuge { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .segmente { display: inline-flex; padding: 3px; border-radius: 999px; background: color-mix(in srgb, var(--primary-text-color) 7%, transparent); }
  .seg { border: 0; background: transparent; padding: 7px 13px; border-radius: 999px; font-weight: 650; font-size: 14px; color: var(--secondary-text-color); }
  .seg.an { background: var(--card-background-color, #fff); color: var(--primary-text-color); box-shadow: 0 1px 4px rgba(0,0,0,.12); }
  .frei { border: 1px solid var(--divider-color, #ddd); background: transparent; border-radius: 999px; padding: 7px 12px; font-weight: 650; font-size: 14px; }
  .frei.an { background: color-mix(in srgb, #3FA66B 18%, transparent); border-color: #3FA66B; }
  .neu { border: 0; border-radius: 999px; padding: 9px 16px; font-weight: 750; background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin: 12px 0 10px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--f) 45%, transparent);
          background: color-mix(in srgb, var(--f) 14%, transparent); font-weight: 650; font-size: 13.5px; }
  .chip.aus { opacity: .4; background: transparent; text-decoration: line-through; }
  .punkt { width: 10px; height: 10px; border-radius: 50%; background: var(--f); display: inline-block; flex: none; }
  .leer { padding: 28px 8px; text-align: center; color: var(--secondary-text-color); font-size: 16px; }

  /* Raster (Tag/Woche) */
  .raster { display: grid; grid-template-columns: 46px repeat(var(--n), minmax(0, 1fr)); column-gap: 4px; }
  .ecke.klein { font-size: 10px; color: var(--secondary-text-color); align-self: center; text-transform: uppercase; }
  .tagkopf { text-align: center; padding: 6px 0 8px; cursor: pointer; border-radius: 12px; }
  .tagkopf .wt { display: block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--secondary-text-color); }
  .tagkopf .nr { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; font-size: 18px; font-weight: 750; }
  .tagkopf.heute .nr { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .ganzzelle { display: flex; flex-direction: column; gap: 3px; padding: 4px 0 6px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.1)); min-width: 0; }
  .zeiten { position: relative; height: calc(var(--h) * var(--stunde)); }
  .stunde { height: var(--stunde); position: relative; }
  .stunde span { position: absolute; top: -8px; right: 6px; font-size: 11px; color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
  .spalte { position: relative; height: calc(var(--h) * var(--stunde)); border-left: 1px solid var(--divider-color, rgba(0,0,0,.08));
            background-image: linear-gradient(var(--divider-color, rgba(0,0,0,.08)) 1px, transparent 1px); background-size: 100% var(--stunde); }
  .spalte.heute { background-color: color-mix(in srgb, var(--primary-color) 5%, transparent); }
  .slot { height: var(--stunde); cursor: copy; }
  .slot:hover { background: color-mix(in srgb, var(--primary-color) 8%, transparent); }
  .termin { cursor: pointer; overflow: hidden; color: var(--primary-text-color); }
  .termin.zeit { position: absolute; box-sizing: border-box; padding: 4px 7px; border-radius: 10px; border-left: 4px solid var(--f);
                 background: color-mix(in srgb, var(--f) 20%, var(--card-background-color, #fff)); box-shadow: 0 1px 3px rgba(0,0,0,.08); z-index: 2; }
  .termin.zeit:hover { z-index: 3; box-shadow: 0 4px 14px rgba(0,0,0,.16); }
  .termin.vorbei { opacity: .5; }
  .tt { font-weight: 700; font-size: 13.5px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tz { font-size: 11.5px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .termin.kurz { display: flex; gap: 6px; align-items: center; padding-top: 1px; padding-bottom: 1px; }
  .termin.kurz .tz { display: none; }
  .termin.ganz { padding: 3px 8px; border-radius: 8px; font-size: 12.5px; font-weight: 700; white-space: nowrap; text-overflow: ellipsis;
                 background: color-mix(in srgb, var(--f) 26%, var(--card-background-color, #fff)); }
  .jetzt { position: absolute; left: -4px; right: 0; height: 2px; background: var(--error-color, #DB4437); z-index: 4; pointer-events: none; }
  .jetzt::before { content: ""; position: absolute; left: -5px; top: -5px; width: 12px; height: 12px; border-radius: 50%; background: var(--error-color, #DB4437); }
  .freiblock { position: absolute; left: 2px; right: 2px; z-index: 1; border-radius: 10px; cursor: copy; border: 2px dashed #3FA66B;
               background: repeating-linear-gradient(45deg, color-mix(in srgb, #3FA66B 16%, transparent) 0 8px, color-mix(in srgb, #3FA66B 8%, transparent) 8px 16px); }
  .freiblock span { position: absolute; top: 4px; left: 6px; font-size: 11px; font-weight: 800; color: #2E7D4F; }

  /* Monat */
  .monat { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .mkopf { text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--secondary-text-color); padding: 4px 0; }
  .mzelle { min-height: 96px; padding: 6px; border-radius: 12px; cursor: pointer; background: color-mix(in srgb, var(--primary-text-color) 3%, transparent);
            display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .mzelle:hover { background: color-mix(in srgb, var(--primary-color) 9%, transparent); }
  .mzelle.fremd { opacity: .45; }
  .mzelle.heute { box-shadow: inset 0 0 0 2px var(--primary-color); }
  .mnr { font-weight: 750; font-size: 14px; }
  .mzelle.heute .mnr { color: var(--primary-color); }
  .termin.mini { font-size: 12px; padding: 2px 6px; border-radius: 6px; white-space: nowrap; text-overflow: ellipsis; display: flex; gap: 4px; align-items: center;
                 background: color-mix(in srgb, var(--f) 18%, transparent); }
  .mt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mp { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--f); }
  .mehr { font-size: 11.5px; color: var(--secondary-text-color); font-weight: 700; padding-left: 4px; }

  /* Liste */
  .liste { display: flex; flex-direction: column; gap: 14px; }
  .llabel { font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--secondary-text-color); margin-bottom: 6px; }
  .lzeile { display: grid; grid-template-columns: 64px 5px 1fr; gap: 12px; align-items: center; padding: 9px 10px; border-radius: 14px; }
  .lzeile:hover { background: color-mix(in srgb, var(--f) 10%, transparent); }
  .lzeit { font-weight: 750; font-variant-numeric: tabular-nums; font-size: 15px; }
  .lzeit small { display: block; font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
  .lbalken { align-self: stretch; border-radius: 3px; background: var(--f); }
  .lt { display: block; font-size: 16.5px; font-weight: 650; }
  .lm { display: block; font-size: 13px; color: var(--secondary-text-color); margin-top: 1px; }

  /* Dialog */
  .hintergrund { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.35); display: grid; place-items: center; padding: 16px; animation: fp-ein .15s ease; }
  @keyframes fp-ein { from { opacity: 0; } to { opacity: 1; } }
  .dialog { position: relative; width: min(520px, 100%); max-height: 90vh; overflow: auto; box-sizing: border-box; padding: 24px 24px 20px; border-radius: 24px;
            background: var(--card-background-color, #fff); color: var(--primary-text-color); box-shadow: 0 20px 60px rgba(0,0,0,.3); }
  .dialog h2 { margin: 0 34px 12px 0; font-size: 23px; line-height: 1.25; }
  .dfarbe { position: absolute; left: 0; top: 0; right: 0; height: 8px; border-radius: 24px 24px 0 0; background: var(--f); }
  .zu { position: absolute; right: 14px; top: 14px; width: 36px; height: 36px; border-radius: 50%; border: 0; font-size: 16px; background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
  .dzeile { display: flex; align-items: center; gap: 8px; font-size: 16px; padding: 5px 0; flex-wrap: wrap; }
  .dzeile a { color: var(--primary-color); font-size: 14px; }
  .dnotiz { margin-top: 8px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--primary-text-color) 5%, transparent); white-space: pre-wrap; }
  .knoepfe { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
  .knoepfe button, .satz button { border: 0; border-radius: 14px; padding: 12px 18px; font-weight: 700; font-size: 15px; background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
  button.primaer { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  button.gefahr { background: var(--error-color, #DB4437); color: #fff; }
  .frage { margin-top: 16px; font-weight: 700; }
  .formular { display: flex; flex-direction: column; gap: 10px; }
  .formular label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 700; color: var(--secondary-text-color); }
  .formular label.check { flex-direction: row; align-items: center; gap: 8px; font-size: 15px; color: var(--primary-text-color); }
  .formular input, .formular textarea, .satz input { font: inherit; font-size: 16px; padding: 11px 12px; border-radius: 12px; border: 1px solid var(--divider-color, #ccc);
             background: var(--card-background-color, #fff); color: var(--primary-text-color); }
  .zeiten2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .versteckt { display: none; }
  .satz { display: flex; gap: 8px; }
  .satz input { flex: 1; min-width: 0; font-size: 17px; }
  .hinweis { color: var(--secondary-text-color); font-size: 13.5px; line-height: 1.45; }
  .meldung { min-height: 18px; font-weight: 650; font-size: 14.5px; }
  .meldung.ok { color: var(--success-color, #2E7D32); }
  .meldung.fehler { color: var(--error-color, #B3261E); }
  @media (max-width: 640px) {
    :host { --stunde: 40px; }
    ha-card { padding: 12px; }
    .segmente .seg { padding: 6px 9px; font-size: 13px; }
    .mzelle { min-height: 64px; padding: 4px; }
    .termin.mini b { display: none; }
  }
`;

if (!customElements.get("familienplaner-kalender")) customElements.define("familienplaner-kalender", FamilienplanerKalender);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "familienplaner-kalender")) {
  window.customCards.push({ type: "familienplaner-kalender", name: "Familienplaner: Kalender", description: "Tag, Woche, Monat, Liste – mit Personenfilter, Bearbeiten und „Wer hat Zeit?“" });
}

// Für abgeleitete Karten (z. B. das Zauberbuch im Stil „Zauberwelt“)
FamilienplanerKalender.CSS = KALENDER_CSS;
FamilienplanerKalender.hilfen = { KT, kesc, p2, tagAnfang, plusTage, gleicherTag, isoLokal, datumIso, hhmm, montag, kalenderwoche, sym };
window.familienplaner = window.familienplaner || {};
window.familienplaner.KalenderBasis = FamilienplanerKalender;
window.dispatchEvent(new Event("familienplaner-kalender-bereit"));
