/*
 * Familienplaner – Stil „Zauberwelt“ / "Magic world" style
 *
 * Eigene, frei erfundene Zauberwelt (Pergament, Leder, Messing, Kerzenlicht).
 * Wird über die Auswahl-Entität „Stil“ der Integration ein- und ausgeschaltet;
 * die Dashboard-Strategie baut dann diese Ansichten:
 *
 *   custom:familienplaner-zauberkopf    Lederleiste mit Uhrzeit, Datum, Mond, Wetter, Stil-Umschalter
 *   custom:familienplaner-zauberuhr     Messing-Familienuhr: ein Zeiger pro Person zeigt, wo sie ist
 *   custom:familienplaner-zauberkarte   Pergament-Familienkarte mit Fußspuren
 *   custom:familienplaner-zauberbuch    Kalender als Zauberbuch (Tag / Woche / Monat / Liste, alle Funktionen
 *                                       der normalen Kalenderkarte: Eintragen, Ändern, Löschen, „Wer hat Zeit?“)
 *   custom:familienplaner-haeuser       Familien-Häuser mit Edelsteingläsern (Wochenpunkte) und Kerzen für Lampen
 *   custom:familienplaner-kessel        Spiel „Familienkessel“: gemeinsam einen Trank brauen (Familienziel)
 *   custom:familienplaner-figuren       Zauberer-Figuren der Familie mit Werkstatt, Tiergestalt, Stimmungen, Aufstieg
 *   custom:familienplaner-zauberrahmen  legt eine normale Karte auf Pergament (für die übrigen Seiten)
 *
 * Alles reines CSS/SVG, keine Bilddateien. Schriften kommen von Google Fonts (ohne Internet: Serifenschrift).
 */
(() => {
  if (window.familienplanerZauber) return;
  window.familienplanerZauber = true;

  // ------------------------------------------------------------------ Grundlagen
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const p2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const de = (hass) => String((hass && ((hass.locale && hass.locale.language) || hass.language)) || "de").toLowerCase().startsWith("de");
  const T = {
    de: {
      tage: ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"],
      monate: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
      mond: ["Neumond", "zunehmend", "Halbmond", "zunehmend", "Vollmond", "abnehmend", "Halbmond", "abnehmend"],
      orte: ["Zuhause", "Arbeit", "Schule", "Training", "Unterwegs", "Freunde"],
      seit: "seit", klassisch: "Klassisch", woche: "Woche", tag: "Tag", monat: "Monat", liste: "Liste", heute: "heute",
      alle: "Alle", eintragen: "Eintragen", frei: "Wer hat Zeit?", gleich: "gleich", frei_tag: "— frei —", ganztags: "ganztägig",
      karte: "Die Familienkarte", karte_unter: "~ wo jeder gerade wandelt ~", besondere: "Besondere Tage", zahlen: "Der Monat in Zahlen",
      termine: "Termine", tag_worte: "Der Tag in Worten", kerzenschein: "Der Tag im Kerzenschein", buch_woche: "Das Buch der Woche",
      haus: "Haus", pokal: "Wochen-Pokal", fuehrt: "führt", edelsteine: "Edelsteine", zuletzt: "Diese Woche",
      kessel: "Der Familienkessel", kessel_unter: "Gemeinsam brauen, gemeinsam belohnen", rezept: "Rezept", staerke: "Trank-Stärke",
      tropfen: "Tropfen", voll: "Der Trank ist fertig!", einloesen: "Belohnung einlösen", zutaten: "Zutaten dieser Woche",
      kessel_hilfe: "Jede erledigte Aufgabe ist eine Zutat in der Farbe der Person. Ist der Kessel voll, gibt es die Familien-Belohnung.",
      keine_aufgaben: "Das Aufgaben-Modul ist noch nicht eingerichtet.", licht: "Lichter", kw: "Woche",
    },
    en: {
      tage: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      monate: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
      mond: ["new moon", "waxing", "half moon", "waxing", "full moon", "waning", "half moon", "waning"],
      orte: ["Home", "Work", "School", "Training", "Travelling", "Friends"],
      seit: "since", klassisch: "Classic", woche: "Week", tag: "Day", monat: "Month", liste: "List", heute: "today",
      alle: "All", eintragen: "Add", frei: "Who's free?", gleich: "soon", frei_tag: "— free —", ganztags: "all day",
      karte: "The family map", karte_unter: "~ where everyone is wandering ~", besondere: "Special days", zahlen: "The month in numbers",
      termine: "events", tag_worte: "The day in words", kerzenschein: "The day by candlelight", buch_woche: "The book of the week",
      haus: "House", pokal: "Weekly cup", fuehrt: "leads", edelsteine: "gems", zuletzt: "This week",
      kessel: "The family cauldron", kessel_unter: "Brew together, celebrate together", rezept: "Recipe", staerke: "Potion strength",
      tropfen: "drops", voll: "The potion is ready!", einloesen: "Redeem reward", zutaten: "This week's ingredients",
      kessel_hilfe: "Every finished task is an ingredient in that person's colour. When the cauldron is full, the family reward is yours.",
      keine_aufgaben: "The tasks module is not set up yet.", licht: "Lights", kw: "Week",
    },
  };
  const tx = (hass) => T[de(hass) ? "de" : "en"];
  const roemisch = (n) => {
    const r = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let s = ""; for (const [w, z] of r) while (n >= w) { s += z; n -= w; } return s;
  };
  // Mondphase 0..7 (0 = Neumond, 4 = Vollmond)
  const mondphase = (d = new Date()) => {
    const tage = (d - new Date(Date.UTC(2000, 0, 6, 18, 14))) / 86400000;
    const alter = ((tage % 29.530588853) + 29.530588853) % 29.530588853;
    return Math.round((alter / 29.530588853) * 8) % 8;
  };
  const MONDZEICHEN = ["●", "◑", "◑", "◑", "○", "◐", "◐", "◐"];

  // Schriften einmal ins Dokument laden (gelten auch in Shadow-DOMs)
  if (!document.getElementById("familienplaner-zauber-schriften")) {
    const l = document.createElement("link");
    l.id = "familienplaner-zauber-schriften";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;800&family=Cinzel+Decorative:wght@700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Caveat:wght@600&display=swap";
    document.head.appendChild(l);
  }

  const svgUrl = (inhalt) => `url("data:image/svg+xml;utf8,${inhalt.replace(/#/g, "%23")}")`;
  const BASIS = `
    :host { display: block;
      --z-tinte: #2a1a0e; --z-gold-hell: #f3dfa6;
      --z-korn: ${svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .25  0 0 0 0 .16  0 0 0 0 .07  0 0 0 .40 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>")};
      --z-flecken: ${svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='1800' height='1800'><filter id='f'><feTurbulence type='fractalNoise' baseFrequency='.0039' numOctaves='5' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .3  0 0 0 0 .08  0 0 0 -1.5 .95'/></filter><rect width='100%' height='100%' filter='url(#f)'/></svg>")};
      --z-leder: ${svgUrl("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='l'><feTurbulence type='turbulence' baseFrequency='.09' numOctaves='4' seed='5'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 .75'/></filter><rect width='100%' height='100%' filter='url(#l)'/></svg>")};
      --z-gold: linear-gradient(176deg,#fff6cf 0%,#f2d27a 22%,#b9842a 48%,#ffe9a3 62%,#c8933a 78%,#7a5214 100%);
      --z-pergament: var(--z-flecken), var(--z-korn), linear-gradient(170deg,#f5e8c8,#ead6a6 55%,#dcc18a);
      --z-messing: conic-gradient(from 200deg at 30% 60%,#a57a2c,#f5dc8e,#b8892f,#fff0b8,#8a6420,#e6c065,#a57a2c);
      font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-weight: 600; color: var(--z-tinte); }
    * { box-sizing: border-box; }
    button { font: inherit; cursor: pointer; }
    ha-card { background: transparent; box-shadow: none; border: 0; overflow: visible; }
    .gold { background: var(--z-gold); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 1px 0 rgba(40,20,0,.75)); }
    .cinzel { font-family: Cinzel, Georgia, serif; letter-spacing: .06em; }
    .pergament { background: radial-gradient(ellipse at 30% 20%, rgba(255,252,235,.5), transparent 55%), var(--z-pergament);
      box-shadow: inset 0 0 18px rgba(120,70,20,.55), inset 0 0 70px rgba(150,95,35,.3), 0 24px 40px -10px rgba(0,0,0,.7), 0 8px 14px rgba(0,0,0,.4); border-radius: 3px; }
    .staub { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 30; }
    .staub i { position: absolute; border-radius: 50%; background: radial-gradient(circle,#fff6c8,#f2c95a 45%,rgba(242,201,90,0) 70%); animation: z-schweb var(--t) ease-in-out infinite; animation-delay: var(--v); opacity: 0; }
    @keyframes z-schweb { 0% { transform: translate(0,0); opacity: 0 } 15% { opacity: var(--o) } 85% { opacity: var(--o) } 100% { transform: translate(var(--dx),-140px); opacity: 0 } }
    @media (prefers-reduced-motion: reduce) { .staub { display: none; } * { animation: none !important; transition: none !important; } }
  `;
  const staub = (n = 40, breite = 1200, hoehe = 700) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const g = 1.5 + (i % 5) * 1.1;
      s += `<i style="left:${(i * 173) % 100}%;top:${10 + ((i * 97) % 85)}%;width:${g * 2}px;height:${g * 2}px;${i % 4 === 0 ? "filter:blur(1.5px);" : ""}--t:${7 + (i % 6)}s;--v:-${((i * 0.73) % 8).toFixed(2)}s;--dx:${(i % 2 ? 1 : -1) * (10 + (i % 30))}px;--o:${0.45 + (i % 5) / 10}"></i>`;
    }
    return `<div class="staub">${s}</div>`;
  };
  const siegelMaske = svgUrl("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 2 C58 4 62 1 69 6 C76 10 82 8 87 15 C92 22 97 25 97 34 C97 42 100 47 97 55 C95 63 98 69 92 76 C87 83 86 89 78 92 C70 96 64 99 55 97 C47 96 41 100 33 96 C25 92 18 93 12 86 C6 79 4 73 3 64 C2 56 -1 50 2 41 C4 33 3 26 9 19 C15 12 20 9 28 5 C35 2 42 1 50 2Z'/></svg>");
  const SIEGEL_CSS = `
    .siegelreihe { display: flex; justify-content: center; gap: clamp(10px, 2.4vw, 30px); flex-wrap: wrap; padding: 6px 0 2px; }
    .sp { display: flex; flex-direction: column; align-items: center; border: 0; background: none; padding: 0; filter: drop-shadow(0 5px 5px rgba(0,0,0,.6)); transition: filter .25s, transform .25s; }
    .sp:active { transform: scale(.94); }
    .sp.an { filter: drop-shadow(0 0 14px rgba(255,220,140,.95)) drop-shadow(0 0 3px #fff3c4); }
    .siegelkopf { width: 80%; height: 80%; border-radius: 50%; overflow: hidden; display: block; background: radial-gradient(circle at 50% 35%, rgba(255,255,255,.45), rgba(0,0,0,.15)); box-shadow: inset 0 0 0 2px rgba(0,0,0,.25); }
    .siegelkopf svg { width: 100%; height: 100%; display: block; }
    .sp small { margin-top: 4px; font: 600 16px 'Cormorant Garamond', Georgia, serif; color: var(--z-gold-hell); text-shadow: 0 1px 2px #000; }
    .siegel { width: clamp(48px, 5.5vw, 64px); height: clamp(48px, 5.5vw, 64px); display: grid; place-items: center; font: 800 clamp(19px, 2vw, 25px) Cinzel, Georgia, serif;
      -webkit-mask: ${siegelMaske} center/100% 100%; mask: ${siegelMaske} center/100% 100%;
      background: radial-gradient(circle at 50% 50%, transparent 37%, rgba(0,0,0,.3) 39%, rgba(255,255,255,.25) 42%, transparent 45%), radial-gradient(circle at 34% 28%, rgba(255,255,255,.55), transparent 22%), radial-gradient(circle at 70% 78%, rgba(0,0,0,.45), transparent 50%), var(--c);
      color: color-mix(in srgb, var(--c) 50%, #000); text-shadow: -1px -1px 0 rgba(255,255,255,.35), 1px 1px 1px rgba(0,0,0,.55); }
  `;
  const personSetzen = (slug) => {
    const fp = window.familienplaner || {};
    if (fp.personSetzen) fp.personSetzen(slug);
    else window.dispatchEvent(new CustomEvent("familienplaner-person", { detail: { slug } }));
  };

  // ------------------------------------------------------------- Orte der Uhr
  const ORT_WOERTER = [
    ["home", "zuhause", "daheim", "haus"],
    ["arbeit", "work", "büro", "buero", "office", "firma", "job"],
    ["schule", "school", "kita", "kindergarten", "uni", "hort"],
    ["training", "sport", "verein", "fußball", "fussball", "schwimm", "turnhalle", "gym", "halle"],
    [],
    ["freund", "friend", "oma", "opa", "familie", "besuch"],
  ];
  function ortVon(hass, personEntity, orte) {
    const st = personEntity && hass.states[personEntity];
    if (!st) return { index: 4, name: orte[4], seit: null, unbekannt: true };
    const zustand = st.state;
    const seit = st.last_changed ? new Date(st.last_changed) : null;
    if (zustand === "home") return { index: 0, name: orte[0], seit };
    if (zustand === "not_home" || zustand === "unknown" || zustand === "unavailable") return { index: 4, name: orte[4], seit };
    const zone = Object.values(hass.states).find((s) => s.entity_id.startsWith("zone.") && (s.attributes.friendly_name === zustand || s.entity_id === `zone.${zustand}`));
    const text = `${zustand} ${zone ? zone.entity_id : ""}`.toLowerCase();
    for (let i = 0; i < ORT_WOERTER.length; i++) if (ORT_WOERTER[i].some((w) => text.includes(w))) return { index: i, name: orte[i], seit, zone: zustand };
    return { index: 5, name: zustand, seit, zone: zustand };
  }
  const uhrzeit = (d) => (d ? `${p2(d.getHours())}:${p2(d.getMinutes())}` : "");

  // ================================================================ Zauberer-Figuren
  // Jede Person hat eine eigene Figur (Umhang in Personenfarbe). Aussehen wird mit
  // familienplaner.figur_setzen gespeichert und steht am Übersichts-Sensor unter "figuren".
  const HAUT = ["#ffe0c4", "#f5c8a0", "#d9a27a", "#a86b45", "#6e4128"];
  const HAARE = ["#2b1a12", "#6b3b1e", "#c77b2e", "#e8c26a", "#b9b2a8", "#8a2f2f"];
  const AUGEN = ["#3d6b3a", "#3a6ab0", "#6b3b1e", "#2a7a5a", "#5a5a6a"];
  const FIG_WAHL = {
    frisur: ["kurz", "lang", "locken", "zopf"],
    hut: ["spitz", "kapuze", "krone"],
    stab: ["holz", "knorrig", "silber", "kristall"],
    zeichen: ["stern", "mond", "flamme", "blatt"],
    begleiter: ["eule", "katze", "kroete", "drache"],
    tier: ["fuchs", "katze", "wolf", "adler"],
  };
  // Rang-Stufen (Gesamtpunkte aus dem Familien-Rennen) und was sie freischalten
  const RAENGE = [0, 250, 750, 1500, 3000];
  const FREI_AB = { "stab:knorrig": 2, "stab:silber": 3, "stab:kristall": 4, "hut:krone": 4, "begleiter:drache": 4 };
  const FIG_T = {
    de: {
      raenge: ["Lehrling", "Geselle", "Zauberer", "Meister", "Erzmagier"],
      stimmung: { normal: "wach", froh: "freut sich", gaehnt: "gähnt", schlaeft: "schläft" },
      werte: {
        frisur: { kurz: "Kurz", lang: "Lang", locken: "Locken", zopf: "Zopf" },
        hut: { spitz: "Spitzhut", kapuze: "Kapuze", krone: "Sternkrone" },
        stab: { holz: "Holz", knorrig: "Knorrig", silber: "Silber", kristall: "Kristall" },
        zeichen: { stern: "Stern", mond: "Mond", flamme: "Flamme", blatt: "Blatt" },
        begleiter: { eule: "Eule", katze: "Katze", kroete: "Kröte", drache: "Drache" },
        tier: { fuchs: "Fuchs", katze: "Katze", wolf: "Wolf", adler: "Adler" },
      },
      gruppen: { haut: "Hautton", haar: "Haarfarbe", augen: "Augenfarbe", frisur: "Frisur", hut: "Kopfbedeckung", stab: "Zauberstab", zeichen: "Zeichen", begleiter: "Begleittier", tier: "Tiergestalt", brille: "Brille" },
      ohne: "Ohne", rund: "Rund", gestalten: "Gestalten", speichern: "Speichern", abbrechen: "Abbrechen", verwandeln: "Verwandeln",
      punkte: "Punkte", noch: "noch", bis: "bis", ab: "ab", titel: "Die Zauberer der Familie", werkstatt: "Figuren-Werkstatt",
      unter: "Antippen verwandelt die Figur in ihre Tiergestalt", gesperrt: "Freigeschaltet ab", gespeichert: "Gespeichert",
    },
    en: {
      raenge: ["Apprentice", "Journeyman", "Wizard", "Master", "Archmage"],
      stimmung: { normal: "awake", froh: "happy", gaehnt: "yawning", schlaeft: "asleep" },
      werte: {
        frisur: { kurz: "Short", lang: "Long", locken: "Curls", zopf: "Braid" },
        hut: { spitz: "Pointed hat", kapuze: "Hood", krone: "Star crown" },
        stab: { holz: "Wood", knorrig: "Gnarled", silber: "Silver", kristall: "Crystal" },
        zeichen: { stern: "Star", mond: "Moon", flamme: "Flame", blatt: "Leaf" },
        begleiter: { eule: "Owl", katze: "Cat", kroete: "Toad", drache: "Dragon" },
        tier: { fuchs: "Fox", katze: "Cat", wolf: "Wolf", adler: "Eagle" },
      },
      gruppen: { haut: "Skin", haar: "Hair colour", augen: "Eyes", frisur: "Hairstyle", hut: "Headwear", stab: "Wand", zeichen: "Sign", begleiter: "Companion", tier: "Animal form", brille: "Glasses" },
      ohne: "None", rund: "Round", gestalten: "Customise", speichern: "Save", abbrechen: "Cancel", verwandeln: "Transform",
      punkte: "points", noch: "", bis: "to", ab: "from", titel: "The family's wizards", werkstatt: "Figure workshop",
      unter: "Tap a figure to turn it into its animal form", gesperrt: "Unlocked at", gespeichert: "Saved",
    },
  };
  const ft = (hass) => FIG_T[de(hass) ? "de" : "en"];
  const ZEICHEN_PFAD = {
    stern: '<path d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.3 L5.6 8 L0 4.2 L-5.6 8 L-3.8 1.3 L-9 -2.8 L-2.6 -2.8Z"/>',
    mond: '<path d="M3 -9 A9 9 0 1 0 3 9 A7 7 0 1 1 3 -9Z"/>',
    flamme: '<path d="M0 -10 C 5 -4, 7 0, 5 5 C 3 9, -3 9, -5 5 C -7 1, -3 -2, -1 -5 C 0 -2, 2 -1, 2 -3 C 2 -5, 1 -8, 0 -10Z"/>',
    blatt: '<path d="M0 9 C -8 4, -7 -5, 0 -10 C 7 -5, 8 4, 0 9Z M0 9 V-6"/>',
  };
  const hell = (f, a) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(f || "").trim());
    const n = m ? parseInt(m[1], 16) : 0x8c7b6b;
    const k = (v) => Math.max(0, Math.min(255, v + a));
    return "#" + ((1 << 24) | (k(n >> 16) << 16) | (k((n >> 8) & 255) << 8) | k(n & 255)).toString(16).slice(1);
  };
  const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const farbeHex = (f) => {
    if (/^#[0-9a-f]{6}$/i.test(f || "")) return f;
    const namen = { blue: "#2f6fd6", pink: "#e0559a", orange: "#f08a24", green: "#3aa35a", red: "#d33a3a", purple: "#8a4fd1", teal: "#1f9e95", yellow: "#e0b62a", brown: "#8a5a34", grey: "#7a7a7a", cyan: "#20a8c8", indigo: "#4a54c8", amber: "#f0a020", lime: "#8ac234" };
    return namen[String(f || "").replace(/^var\(--|-color\)$/g, "")] || "#8a4fd1";
  };

  /** Standard-Aussehen aus dem Kürzel, damit jede Figur von Anfang an anders aussieht. */
  function figurStandard(slug) {
    const h = hash(slug || "x");
    return {
      haut: HAUT[h % HAUT.length], haar: HAARE[(h >> 3) % HAARE.length], augen: AUGEN[(h >> 5) % AUGEN.length],
      frisur: FIG_WAHL.frisur[(h >> 7) % 4], hut: (h >> 9) % 5 === 0 ? "kapuze" : "spitz", stab: "holz",
      zeichen: FIG_WAHL.zeichen[(h >> 11) % 4], begleiter: FIG_WAHL.begleiter[(h >> 13) % 3], tier: FIG_WAHL.tier[(h >> 15) % 4], brille: false,
    };
  }

  let uebersichtId = null;
  const uebersicht = (hass) => {
    if (uebersichtId && hass.states[uebersichtId]) return hass.states[uebersichtId].attributes;
    uebersichtId = Object.keys(hass.states).find((id) => id.startsWith("sensor.") && hass.states[id].attributes.personen && "figuren" in hass.states[id].attributes) || null;
    return uebersichtId ? hass.states[uebersichtId].attributes : null;
  };
  const rennenVon = (hass) => {
    const id = Object.keys(hass.states).find((x) => {
      const a = hass.states[x].attributes;
      return x.startsWith("sensor.") && Array.isArray(a.fahrer) && a.entitaeten && Array.isArray(a.dienste);
    });
    return id ? hass.states[id].attributes : null;
  };
  const rangAus = (punkte) => RAENGE.reduce((r, ab, i) => (punkte >= ab ? i : r), 0);
  const letzteWoche = {};
  const frohBis = {};

  /** Stimmung nach Uhrzeit und frisch verdienten Punkten. */
  function stimmungVon(slug, woche) {
    const jetzt = Date.now();
    if (woche != null) {
      if (letzteWoche[slug] != null && woche > letzteWoche[slug]) frohBis[slug] = jetzt + 10 * 60000;
      letzteWoche[slug] = woche;
    }
    const st = new Date().getHours();
    if (st >= 22 || st < 6) return "schlaeft";
    if (frohBis[slug] > jetzt) return "froh";
    if (st < 8) return "gaehnt";
    return "normal";
  }

  /** Vollständige Figur einer Person (Aussehen + Farbe + Rang + Stimmung). */
  function figurVon(hass, person) {
    const slug = person.slug || "";
    const u = hass && uebersicht(hass);
    const r = hass && rennenVon(hass);
    const f = r && (r.fahrer || []).find((x) => x.slug === slug);
    const punkte = f ? Number(f.gesamt != null ? f.gesamt : f.punkte) || 0 : 0;
    const rang = rangAus(punkte);
    return {
      ...figurStandard(slug), ...((u && u.figuren && u.figuren[slug]) || {}),
      farbe: farbeHex(person.farbe || (f && f.farbe_hex)), name: person.name || "", slug, punkte, rang,
      stimmung: person.stimmung || stimmungVon(slug, f ? Number(f.woche) || 0 : null),
    };
  }

  let figNr = 0;
  /** SVG-Inhalt der Figur (Koordinaten 0..200 x 0..250). portrait: nur Kopf, ohne Stab/Begleiter. */
  function figurInhalt(o, portrait = false) {
    const id = `zf${figNr++}`;
    const u1 = o.farbe, u2 = hell(o.farbe, -70);
    const haut = o.haut, haar = o.haar, stim = o.stimmung || "normal", rang = o.rang || 0;
    const augen = stim === "schlaeft" || stim === "gaehnt"
      ? `<path d="M74 128 q8 ${stim === "gaehnt" ? -5 : 6} 16 0 M110 128 q8 ${stim === "gaehnt" ? -5 : 6} 16 0" stroke="#2a1a10" stroke-width="3.2" fill="none" stroke-linecap="round"/>`
      : `<g><ellipse cx="82" cy="126" rx="9" ry="${stim === "froh" ? 9 : 11}" fill="#fff"/><ellipse cx="118" cy="126" rx="9" ry="${stim === "froh" ? 9 : 11}" fill="#fff"/>
         <ellipse cx="83" cy="128" rx="6" ry="7.5" fill="${o.augen}"/><ellipse cx="119" cy="128" rx="6" ry="7.5" fill="${o.augen}"/>
         <circle cx="83" cy="129" r="3.4" fill="#120c08"/><circle cx="119" cy="129" r="3.4" fill="#120c08"/>
         <circle cx="85.5" cy="124.5" r="2.4" fill="#fff"/><circle cx="121.5" cy="124.5" r="2.4" fill="#fff"/>
         ${stim === "froh" ? `<path d="M72 134 q10 -8 20 0 v6 h-20z M108 134 q10 -8 20 0 v6 h-20z" fill="${haut}"/>` : ""}
         <ellipse class="lid" cx="82" cy="115" rx="10" ry="12" fill="${hell(haut, -12)}"/><ellipse class="lid" cx="118" cy="115" rx="10" ry="12" fill="${hell(haut, -12)}"/></g>`;
    const brauen = `<path d="M72 ${stim === "froh" ? 108 : 111} q10 -6 20 -1 M108 ${stim === "froh" ? 107 : 110} q10 -5 20 1" stroke="${hell(haar, -10)}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    const mund = stim === "gaehnt" ? `<ellipse class="mund-g" cx="100" cy="150" rx="7" ry="9" fill="#5a1f1f" stroke="#2a1010" stroke-width="1.5"/>`
      : stim === "schlaeft" ? `<path d="M95 149 q5 3 10 0" stroke="#5a2a1a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : stim === "froh" ? `<path d="M88 144 q12 14 24 0 z" fill="#7a2a24" stroke="#4a1a14" stroke-width="1.6" stroke-linejoin="round"/><path d="M93 151 q7 4 14 0" fill="#e86b6b"/>`
      : `<path d="M91 146 q9 7 18 0" stroke="#5a2a1a" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    const frisur = o.frisur;
    const langHinten = frisur === "lang" ? `<path d="M56 112 C 48 150, 52 178, 66 188 C 72 176, 70 160, 72 150 L128 150 C 130 160, 128 176, 134 188 C 148 178, 152 150, 144 112 Z" fill="${haar}"/>` : "";
    const haarHinten = frisur === "zopf" ? `<path d="M140 130 C 162 150, 160 186, 150 204 C 146 210, 140 206, 142 198 C 150 176, 148 156, 136 140Z" fill="${haar}"/><circle cx="147" cy="200" r="5" fill="${u1}"/>`
      : frisur === "locken" ? `<g fill="${haar}">${[[56, 120], [60, 142], [144, 120], [140, 142], [64, 104], [136, 104]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="14"/>`).join("")}</g>` : "";
    const haarVorne = frisur === "locken"
      ? `<g fill="${haar}">${[[70, 96], [86, 90], [102, 88], [118, 90], [132, 98]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11"/>`).join("")}</g>`
      : `<path d="M56 116 C 56 84, 80 76, 100 78 C 124 76, 146 86, 145 116 C 136 102, 122 98, 112 104 C 106 94, 92 92, 84 100 C 74 96, 62 104, 56 116Z" fill="${haar}"/><path d="M84 92 q12 -6 26 -2" stroke="${hell(haar, 40)}" stroke-width="3" fill="none" opacity=".5" stroke-linecap="round"/>`;
    const sterne = [...Array(Math.min(rang, 4))].map((_, i) => `<g transform="translate(${92 + (i % 2) * 16} ${60 - i * 12}) scale(.55)" fill="#ffe9a8">${ZEICHEN_PFAD.stern}</g>`).join("");
    const hut = o.hut === "kapuze"
      ? `<path d="M46 132 C 40 70, 80 50, 100 50 C 128 50, 164 74, 154 132 C 150 110, 132 90, 100 90 C 70 90, 52 108, 46 132Z" fill="${u1}"/><path d="M60 96 C 80 74, 122 74, 140 96" stroke="${hell(u1, 30)}" stroke-width="3" fill="none" opacity=".6"/>`
      : o.hut === "krone"
      ? `<path d="M66 92 L70 66 L84 80 L100 58 L116 80 L130 66 L134 92 Z" fill="#e9c46a" stroke="#8a6420" stroke-width="2"/><circle cx="100" cy="76" r="5" fill="${u1}"/><circle cx="76" cy="84" r="3" fill="#fff"/><circle cx="124" cy="84" r="3" fill="#fff"/>`
      : `<path d="M48 96 C 70 84, 130 84, 152 96 C 140 104, 60 104, 48 96Z" fill="${hell(u2, -10)}"/><path d="M66 94 C 80 60, 96 30, 128 ${rang >= 3 ? 6 : 16} C 116 34, 120 64, 134 94 Z" fill="${u2}"/><path d="M66 94 C 80 60, 96 30, 128 ${rang >= 3 ? 6 : 16} C 104 40, 96 66, 90 94Z" fill="${hell(u2, 22)}" opacity=".55"/>
         <path d="M68 90 C 90 84, 112 84, 134 90 L133 96 C 112 90, 90 90, 69 96Z" fill="${rang >= 2 ? "#d7b25a" : hell(u1, -20)}"/>${sterne}`;
    const begleiter = {
      eule: `<ellipse cx="0" cy="0" rx="15" ry="18" fill="#a07850"/><ellipse cx="0" cy="5" rx="9" ry="11" fill="#e8d4b0"/><circle cx="-6" cy="-7" r="6" fill="#fff"/><circle cx="6" cy="-7" r="6" fill="#fff"/><circle cx="-6" cy="-7" r="3" fill="#1a1a1a"/><circle cx="6" cy="-7" r="3" fill="#1a1a1a"/><path d="M-2 -2 L2 -2 L0 2Z" fill="#e8a23a"/><path d="M-13 -14 l4 6 M13 -14 l-4 6" stroke="#a07850" stroke-width="4" stroke-linecap="round"/>`,
      katze: `<ellipse cx="0" cy="6" rx="14" ry="12" fill="#3a3a44"/><circle cx="0" cy="-8" r="11" fill="#3a3a44"/><path d="M-10 -12 L-8 -24 L-2 -16Z M10 -12 L8 -24 L2 -16Z" fill="#3a3a44"/><ellipse cx="-4" cy="-9" rx="2.5" ry="3.5" fill="#d8e85a"/><ellipse cx="4" cy="-9" rx="2.5" ry="3.5" fill="#d8e85a"/><path d="M14 10 C 24 6, 22 -6, 16 -8" stroke="#3a3a44" stroke-width="4" fill="none" stroke-linecap="round"/>`,
      kroete: `<ellipse cx="0" cy="6" rx="16" ry="10" fill="#6f9a3a"/><circle cx="-7" cy="-3" r="5" fill="#6f9a3a"/><circle cx="7" cy="-3" r="5" fill="#6f9a3a"/><circle cx="-7" cy="-4" r="2.4" fill="#1a1a1a"/><circle cx="7" cy="-4" r="2.4" fill="#1a1a1a"/><path d="M-6 8 q6 4 12 0" stroke="#2a4a1a" stroke-width="1.6" fill="none"/>`,
      drache: `<path d="M-8 -6 C -24 -20, -26 -2, -14 2Z M8 -6 C 24 -20, 26 -2, 14 2Z" fill="#c24a3a" opacity=".9"/><ellipse cx="0" cy="4" rx="11" ry="13" fill="#e2603e"/><circle cx="0" cy="-10" r="9" fill="#e2603e"/><path d="M-5 -17 l-2 -6 l5 3Z M5 -17 l2 -6 l-5 3Z" fill="#f3d27a"/><circle cx="-3.5" cy="-11" r="2" fill="#1a1a1a"/><circle cx="3.5" cy="-11" r="2" fill="#1a1a1a"/><ellipse cx="0" cy="8" rx="6" ry="7" fill="#f6c27a"/>`,
    }[o.begleiter] || "";
    const stabFarbe = { holz: "#7a4a24", knorrig: "#5a3a1c", silber: "#cfd6e0", kristall: "#bfe6ff" }[o.stab] || "#7a4a24";
    const stab = `<g transform="rotate(-28 52 196)"><rect x="49" y="140" width="6" height="64" rx="3" fill="${stabFarbe}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
       ${o.stab === "knorrig" ? '<circle cx="52" cy="160" r="4" fill="#5a3a1c"/><circle cx="52" cy="180" r="3.5" fill="#5a3a1c"/>' : ""}
       ${o.stab === "kristall" ? '<path d="M52 128 l7 12 l-7 6 l-7 -6Z" fill="#bfe6ff" stroke="#6ab0e0"/>' : ""}
       <g transform="translate(52 ${o.stab === "kristall" ? 126 : 138})"><g class="funke" fill="#fff3c4">${ZEICHEN_PFAD.stern}</g></g></g>`;
    const zeichen = `<g transform="translate(100 196) scale(.9)" fill="${rang >= 2 ? "#ffe9a8" : hell(u1, 60)}" stroke="${hell(u2, -20)}" stroke-width=".8">${ZEICHEN_PFAD[o.zeichen] || ZEICHEN_PFAD.stern}</g>`;
    const saum = rang >= 1 ? `<path d="M40 244 C 70 236, 130 236, 160 244" stroke="#d7b25a" stroke-width="${2 + rang}" fill="none"/>` : "";
    const zz = stim === "schlaeft" ? `<text class="z" x="138" y="88">Z</text><text class="z" x="146" y="76" style="animation-delay:-1s;font-size:14px">z</text><text class="z" x="132" y="96" style="animation-delay:-2s;font-size:12px">z</text>` : "";
    return `<defs><radialGradient id="${id}w" cx="40%" cy="35%"><stop offset="0" stop-color="${hell(haut, 18)}"/><stop offset="1" stop-color="${hell(haut, -14)}"/></radialGradient>
      <linearGradient id="${id}u" x1="0" x2="1"><stop offset="0" stop-color="${hell(u1, -10)}"/><stop offset=".5" stop-color="${u1}"/><stop offset="1" stop-color="${hell(u1, -40)}"/></linearGradient></defs>
      ${portrait ? "" : '<ellipse cx="100" cy="246" rx="62" ry="7" fill="rgba(0,0,0,.35)"/>'}
      <g class="wippen">${langHinten}
       <g class="umhang"><path d="M66 160 C 50 190, 40 220, 38 246 L162 246 C 160 220, 150 190, 134 160 Z" fill="url(#${id}u)"/>
        <path d="M70 162 L100 246 L130 162" fill="${hell(u2, -10)}" opacity=".55"/>${saum}
        <path d="M78 160 L100 180 L122 160" fill="#f1e3c2" stroke="${hell(u2, -20)}" stroke-width="1"/></g>
       ${zeichen}<ellipse cx="60" cy="200" rx="9" ry="9" fill="${haut}"/>${portrait ? "" : stab}<ellipse cx="144" cy="196" rx="8.5" ry="8.5" fill="${haut}"/>
       <g class="kopf">${haarHinten}
        <ellipse cx="100" cy="126" rx="44" ry="42" fill="url(#${id}w)"/>
        <ellipse cx="58" cy="130" rx="7" ry="9" fill="${hell(haut, -10)}"/><ellipse cx="142" cy="130" rx="7" ry="9" fill="${hell(haut, -10)}"/>
        <ellipse cx="74" cy="142" rx="8" ry="5" fill="#ff8a8a" opacity="${stim === "froh" ? 0.55 : 0.3}"/><ellipse cx="126" cy="142" rx="8" ry="5" fill="#ff8a8a" opacity="${stim === "froh" ? 0.55 : 0.3}"/>
        ${augen}${brauen}<path d="M98 136 q2 5 5 3" stroke="${hell(haut, -40)}" stroke-width="2" fill="none" stroke-linecap="round"/>${mund}
        ${o.hut === "kapuze" ? "" : haarVorne}${hut}${o.brille ? '<g fill="none" stroke="#3a2a1a" stroke-width="2.4"><circle cx="82" cy="127" r="12"/><circle cx="118" cy="127" r="12"/><path d="M94 126 h12"/></g>' : ""}</g>
      </g>${portrait ? "" : `<g transform="translate(152 210)"><g class="begleiter">${begleiter}</g></g>`}${zz}`;
  }

  function tierInhalt(o) {
    const u1 = o.farbe, u2 = hell(o.farbe, -70);
    const t = {
      fuchs: `<g transform="translate(100 160)"><path d="M40 30 C 80 20, 90 -20, 70 -40 C 80 -10, 60 10, 34 14Z" fill="#e2702a"/><path d="M76 -36 C 82 -28, 82 -20, 78 -14 C 74 -22, 72 -30, 76 -36Z" fill="#fff"/>
        <ellipse cx="10" cy="20" rx="44" ry="30" fill="#e2702a"/><ellipse cx="4" cy="30" rx="26" ry="18" fill="#fff3e0"/>
        <path d="M-30 -20 L-46 -62 L-14 -36Z M10 -20 L22 -62 L-6 -36Z" fill="#e2702a"/><path d="M-30 -26 L-40 -52 L-20 -36Z M8 -26 L16 -52 L-2 -36Z" fill="#3a1a0a"/>
        <ellipse cx="-12" cy="-14" rx="32" ry="28" fill="#e2702a"/><path d="M-44 -6 C -30 14, 4 18, 18 -4 C 4 4, -30 4, -44 -6Z" fill="#fff3e0"/>
        <ellipse cx="-24" cy="-18" rx="4.5" ry="6" fill="#1a1a1a"/><ellipse cx="2" cy="-18" rx="4.5" ry="6" fill="#1a1a1a"/><circle cx="-22.5" cy="-20" r="1.6" fill="#fff"/><circle cx="3.5" cy="-20" r="1.6" fill="#fff"/>
        <ellipse cx="-11" cy="-2" rx="5" ry="3.5" fill="#1a1a1a"/></g>`,
      adler: `<g transform="translate(100 150)"><path d="M-10 0 C -60 -40, -96 -30, -100 -10 C -70 -16, -40 4, -14 20Z" fill="#6b4a2a"/><path d="M10 0 C 60 -40, 96 -30, 100 -10 C 70 -16, 40 4, 14 20Z" fill="#6b4a2a"/>
        <path d="M-80 -22 l-6 12 M-64 -24 l-4 14 M80 -22 l6 12 M64 -24 l4 14" stroke="#4a3018" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="0" cy="26" rx="26" ry="38" fill="#7a5530"/><path d="M-14 60 L0 80 L14 60Z" fill="#fff"/>
        <circle cx="0" cy="-16" r="24" fill="#fff"/><path d="M8 -14 C 26 -14, 26 4, 12 2Z" fill="#f0b030"/><circle cx="-2" cy="-20" r="5" fill="#1a1a1a"/><circle cx="-1" cy="-22" r="1.6" fill="#fff"/></g>`,
      wolf: `<g transform="translate(100 160)"><ellipse cx="10" cy="22" rx="46" ry="30" fill="#8a8f9a"/><path d="M50 20 C 80 10, 86 -10, 76 -24 C 72 -6, 60 4, 44 8Z" fill="#8a8f9a"/>
        <path d="M-34 -20 L-40 -64 L-12 -36Z M6 -20 L16 -64 L-8 -36Z" fill="#8a8f9a"/><ellipse cx="-14" cy="-14" rx="32" ry="30" fill="#8a8f9a"/>
        <path d="M-30 0 C -24 24, 0 24, 4 0 C -6 10, -20 10, -30 0Z" fill="#e8e8ee"/><ellipse cx="-13" cy="4" rx="7" ry="5" fill="#1a1a1a"/>
        <ellipse cx="-26" cy="-18" rx="4.5" ry="5.5" fill="#f3c23a"/><ellipse cx="0" cy="-18" rx="4.5" ry="5.5" fill="#f3c23a"/><circle cx="-26" cy="-18" r="2.2" fill="#1a1a1a"/><circle cx="0" cy="-18" r="2.2" fill="#1a1a1a"/></g>`,
      katze: `<g transform="translate(100 160)"><ellipse cx="10" cy="26" rx="40" ry="28" fill="#3a3a44"/><path d="M46 30 C 80 26, 82 -16, 64 -24 C 70 -4, 64 14, 44 16Z" fill="#3a3a44"/>
        <path d="M-36 -16 L-34 -60 L-10 -34Z M8 -16 L14 -60 L-12 -34Z" fill="#3a3a44"/><circle cx="-12" cy="-10" r="32" fill="#3a3a44"/>
        <ellipse cx="-24" cy="-14" rx="6" ry="8" fill="#d8e85a"/><ellipse cx="2" cy="-14" rx="6" ry="8" fill="#d8e85a"/><ellipse cx="-24" cy="-14" rx="2" ry="6" fill="#111"/><ellipse cx="2" cy="-14" rx="2" ry="6" fill="#111"/>
        <path d="M-15 0 l4 0 l-2 3Z" fill="#e88aa0"/><path d="M-40 -2 h-18 M-40 4 h-16 M18 -2 h18 M18 4 h16" stroke="#ccc" stroke-width="1.2"/></g>`,
    }[o.tier] || "";
    return `<ellipse cx="100" cy="238" rx="70" ry="8" fill="rgba(0,0,0,.35)"/>${t}
      <path d="M60 ${o.tier === "adler" ? 176 : 178} q40 18 80 0 l-6 10 q-34 14 -68 0Z" fill="${u1}" stroke="${u2}" stroke-width="1.5"/>`;
  }

  /** Fertiges <svg> der Figur. art: "ganz" | "kopf" | "tier" */
  function figurSvg(o, art = "ganz", attr = "") {
    if (art === "tier") return `<svg viewBox="0 0 200 250" ${attr}>${tierInhalt(o)}</svg>`;
    const vb = art === "kopf" ? "34 30 132 132" : "-14 -14 228 270";
    return `<svg class="fig ${esc(o.stimmung || "normal")}" viewBox="${vb}" ${attr}>${figurInhalt(o, art === "kopf")}</svg>`;
  }

  const FIGUR_CSS = `
    .fig .wippen { animation: zf-wippen 2.6s ease-in-out infinite; transform-origin: 100px 240px; }
    @keyframes zf-wippen { 50% { transform: translateY(-3px); } }
    .fig.froh .wippen { animation: zf-huepfen 1.1s cubic-bezier(.3,1.6,.5,1) infinite; }
    @keyframes zf-huepfen { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-9px) rotate(-1.5deg); } }
    .fig .lid { transform-box: fill-box; transform-origin: center top; transform: scaleY(0); animation: zf-blinzeln 4.2s infinite; }
    @keyframes zf-blinzeln { 0%, 92%, 100% { transform: scaleY(0); } 95% { transform: scaleY(1); } }
    .fig.gaehnt .mund-g { transform-box: fill-box; transform-origin: center; animation: zf-gaehnen 3.4s ease-in-out infinite; }
    @keyframes zf-gaehnen { 0%, 100% { transform: scale(.35); } 35%, 60% { transform: scale(1.1, 1.25); } }
    .fig.gaehnt .kopf { animation: zf-zurueck 3.4s ease-in-out infinite; transform-origin: 100px 130px; }
    @keyframes zf-zurueck { 35%, 60% { transform: rotate(-5deg) translateY(-2px); } }
    .fig.schlaeft .kopf { transform: rotate(9deg); transform-origin: 100px 140px; }
    .fig.schlaeft .wippen { animation: zf-atmen 3.6s ease-in-out infinite; }
    @keyframes zf-atmen { 50% { transform: scale(1.015, 1.03); } }
    .fig .z { font: 800 18px Cinzel, Georgia, serif; fill: #fff3c4; animation: zf-zett 3s linear infinite; opacity: 0; }
    @keyframes zf-zett { 0% { opacity: 0; transform: translate(0, 0) scale(.6); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(22px, -46px) scale(1.3); } }
    .fig .funke { animation: zf-funkeln 1.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes zf-funkeln { 50% { transform: scale(.4) rotate(45deg); opacity: .4; } }
    .fig .begleiter { animation: zf-begleiter 3s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
    @keyframes zf-begleiter { 50% { transform: translateY(-2px) rotate(2deg); } }
    .fig .umhang { animation: zf-wehen 3.2s ease-in-out infinite; transform-origin: 100px 150px; }
    @keyframes zf-wehen { 50% { transform: skewX(-2deg); } }
    @media (prefers-reduced-motion: reduce) { .fig * { animation: none !important; } }
  `;

  window.familienplaner = window.familienplaner || {};
  window.familienplaner.figur = { von: figurVon, svg: figurSvg, css: FIGUR_CSS };

  // =================================================================== Kopf
  class Zauberkopf extends HTMLElement {
    setConfig(c) { this._c = c || {}; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); }
    set hass(h) { const erst = !this._hass; this._hass = h; if (erst) this._zeichnen(); }
    connectedCallback() { this._t = setInterval(() => this._zeichnen(), 20000); }
    disconnectedCallback() { clearInterval(this._t); }
    getCardSize() { return 1; }
    _zeichnen() {
      if (!this._hass) return;
      const t = tx(this._hass);
      const j = new Date();
      const w = this._c.wetter && this._hass.states[this._c.wetter];
      const temp = w && w.attributes.temperature != null ? ` · ${Math.round(w.attributes.temperature)}°` : "";
      const mp = mondphase(j);
      this.shadowRoot.innerHTML = `<style>${BASIS}
        .kopf { position: relative; display: flex; align-items: center; gap: 18px; padding: 12px 24px; border-radius: 10px;
          background: var(--z-leder), linear-gradient(180deg,#2b1a10,#170d07);
          box-shadow: inset 0 1px 0 rgba(255,220,150,.15), 0 0 0 1px #6b4a1c, 0 3px 0 #c9a24a, 0 5px 0 #3a250f, 0 12px 22px rgba(0,0,0,.55); }
        h1 { margin: 0; font: 700 clamp(18px, 2.4vw, 26px) 'Cinzel Decorative', Cinzel, Georgia, serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rechts { margin-left: auto; text-align: right; line-height: 1.1; }
        .zeit { font: 600 clamp(24px, 3vw, 32px) Cinzel, Georgia, serif; }
        .datum { font: italic 600 clamp(14px, 1.6vw, 18px) 'Cormorant Garamond', Georgia, serif; color: #e9d3a0; }
        .stil { border: 1px solid #6b4a1c; border-radius: 999px; padding: 6px 12px; font: 600 12px Cinzel, Georgia, serif; letter-spacing: .1em;
          color: #e8d29c; background: var(--z-leder), linear-gradient(180deg,#4a2c18,#2e1b0e); }
        @media (max-width: 560px) { .kopf { padding: 10px 14px; gap: 10px; } .stil { padding: 5px 8px; font-size: 10px; } .mond { display: none; } }
      </style>
      <ha-card><div class="kopf">
        <h1 class="gold">✦ ${esc(this._c.name || "Familienplaner")}</h1>
        ${this._c.stil && this._hass.states[this._c.stil] ? `<button class="stil" title="${esc(t.klassisch)}">${esc(t.klassisch)}</button>` : ""}
        <div class="rechts"><div class="zeit gold">${p2(j.getHours())}:${p2(j.getMinutes())}</div>
        <div class="datum">${esc(t.tage[j.getDay()])}, ${j.getDate()}. ${esc(t.monate[j.getMonth()])} <span class="mond">· ${MONDZEICHEN[mp]} ${esc(t.mond[mp])}</span>${temp}</div></div>
      </div></ha-card>`;
      const b = this.shadowRoot.querySelector(".stil");
      if (b) b.addEventListener("click", async () => {
        await this._hass.callService("select", "select_option", { entity_id: this._c.stil, option: "klassisch" });
        setTimeout(() => location.reload(), 300);
      });
    }
  }

  // ============================================================== Familienuhr
  const ICON = {
    0: '<path d="M-11 6 v-10 l11 -9 l11 9 v10z M-3 6 v-6 h6 v6"/>',
    1: '<path d="M-11 -4 h22 v12 h-22z M-4 -4 v-4 h8 v4 M-11 2 h22"/>',
    2: '<path d="M0 -6 C -4 -9 -9 -9 -12 -7 v14 c3 -2 8 -2 12 1 c4 -3 9 -3 12 -1 v-14 c-3 -2 -8 -2 -12 1z M0 -6 v14"/>',
    3: '<circle r="10"/><path d="M0 -4 l4 3 -1.6 4.6 h-4.8 L-4 -1z M0 -4 v-6 M4 -1 l6 -2 M2.4 3.6 l3.6 5 M-2.4 3.6 l-3.6 5 M-4 -1 l-6 -2"/>',
    4: '<path d="M-12 2 h24 l-3 -9 h-18z M-12 2 v4 h24 v-4"/><circle cx="-7" cy="8" r="3"/><circle cx="7" cy="8" r="3"/>',
    5: '<path d="M0 8 C -14 -2 -10 -12 -4 -11 C -1 -10 0 -7 0 -6 C 0 -7 1 -10 4 -11 C 10 -12 14 -2 0 8Z"/>',
  };
  // Reihenfolge der Sektoren auf dem Zifferblatt (im Uhrzeigersinn ab oben)
  const SEKTOR = [0, 1, 3, 4, 2, 5]; // Zuhause, Arbeit, Training, Unterwegs, Schule, Freunde
  const CX = 245, CY = 305, G = Math.PI / 180;
  const pol = (r, a) => [+(CX + r * Math.sin(a * G)).toFixed(2), +(CY - r * Math.cos(a * G)).toFixed(2)];
  const hexRgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  function konisch(r1, r2, stops, dreh = 0, n = 160) {
    const S = stops.map(hexRgb);
    let s = "";
    for (let i = 0; i < n; i++) {
      const t = (i / n) * (S.length - 1), k = Math.floor(t), f = t - k, a = S[k], b = S[Math.min(k + 1, S.length - 1)];
      const c = `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * f)).join(",")})`;
      const a0 = (i * 360) / n + dreh, a1 = ((i + 1.3) * 360) / n + dreh;
      const p = [pol(r2, a0), pol(r2, a1), pol(r1, a1), pol(r1, a0)];
      s += `<path d="M${p[0]} A${r2} ${r2} 0 0 1 ${p[1]} L${p[2]} A${r1} ${r1} 0 0 0 ${p[3]}Z" fill="${c}"/>`;
    }
    return s;
  }
  let uhrGehaeuse = null; // einmal berechnen (statisch)
  function gehaeuse(orte) {
    const messing = ["#6e4a12", "#f6e3a2", "#b9862c", "#fff4c8", "#8f6619", "#e3bd61", "#5e3e0c", "#d9b257", "#fff0b8", "#9a6e1e", "#6e4a12"];
    const messing2 = ["#fff0b8", "#9a6e1e", "#5e3e0c", "#e8c56a", "#fff7d6", "#a57a2c", "#6e4a12", "#f3d684", "#fff0b8"];
    const sektoren = SEKTOR.map((ortIndex, i) => {
      const a = i * 60;
      const unten = a > 90 && a < 270;
      const r = unten ? 165 : 152;
      const bogen = unten ? `M${pol(r, a + 28)} A${r} ${r} 0 0 0 ${pol(r, a - 28)}` : `M${pol(r, a - 28)} A${r} ${r} 0 0 1 ${pol(r, a + 28)}`;
      const [p1, p2_, p3, p4] = [pol(178, a - 30), pol(178, a + 30), pol(112, a + 30), pol(112, a - 30)];
      const [ix, iy] = pol(126, a + (i % 2 ? -21 : 21));
      return `<path id="zb${i}" d="${bogen}" fill="none"/>
        <path d="M${p1} A178 178 0 0 1 ${p2_} L${p3} A112 112 0 0 0 ${p4}Z" fill="${i % 2 ? "rgba(185,140,60,.10)" : "rgba(255,255,255,.08)"}"/>
        <line x1="${pol(178, a + 30)[0]}" y1="${pol(178, a + 30)[1]}" x2="${pol(112, a + 30)[0]}" y2="${pol(112, a + 30)[1]}" stroke="#5a3a14" stroke-width="1.1"/>
        <circle cx="${pol(176, a + 30)[0]}" cy="${pol(176, a + 30)[1]}" r="3" fill="#b8862e" stroke="#4a3008" stroke-width=".6"/>
        <text font-family="Cinzel, Georgia, serif" font-weight="800" font-size="15" letter-spacing="2" fill="#2a180a"><textPath href="#zb${i}" startOffset="50%" text-anchor="middle">${esc(String(orte[ortIndex]).toUpperCase())}</textPath></text>
        <g transform="translate(${ix} ${iy})" fill="none" stroke="#4a2c10" stroke-width="1.3" stroke-linejoin="round">${ICON[ortIndex]}</g>`;
    }).join("");
    return `
      <defs>
        <radialGradient id="z-email" cx="44%" cy="38%" r="70%"><stop offset="0" stop-color="#fdf8ea"/><stop offset=".55" stop-color="#f3e8cc"/><stop offset=".9" stop-color="#ddc89c"/><stop offset="1" stop-color="#b89a62"/></radialGradient>
        <filter id="z-patina"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="4" seed="8"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .14  0 0 0 0 .05  0 0 0 -1.2 .55"/><feComposite in2="SourceGraphic" operator="in"/></filter>
        <filter id="z-schatten" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.6"/><feOffset dx="5" dy="8"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="z-perle" cx="35%" cy="30%"><stop offset="0" stop-color="#fffbe2"/><stop offset=".4" stop-color="#e2be62"/><stop offset="1" stop-color="#5e3e0c"/></radialGradient>
        <radialGradient id="z-kuppel" cx="38%" cy="32%"><stop offset="0" stop-color="#fffbe2"/><stop offset=".35" stop-color="#e8c56a"/><stop offset=".8" stop-color="#8a6018"/><stop offset="1" stop-color="#4a3008"/></radialGradient>
        <linearGradient id="z-zeiger" x1="0" x2="1"><stop offset="0" stop-color="#5e3e0c"/><stop offset=".45" stop-color="#fff0b8"/><stop offset=".55" stop-color="#d9a945"/><stop offset="1" stop-color="#5e3e0c"/></linearGradient>
        <radialGradient id="z-glanz" cx="30%" cy="22%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".25" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="z-glasrand" cx="50%" cy="50%" r="50%"><stop offset=".86" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1a05" stop-opacity=".45"/></radialGradient>
        <radialGradient id="z-wand" cx="50%" cy="50%"><stop offset=".6" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
        <linearGradient id="z-krone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".4" stop-color="#d1a54a"/><stop offset=".7" stop-color="#8a6018"/><stop offset="1" stop-color="#c9963c"/></linearGradient>
      </defs>
      <ellipse cx="${CX + 10}" cy="${CY + 22}" rx="240" ry="236" fill="url(#z-wand)" style="filter:blur(14px)"/>
      <g transform="translate(${CX} ${CY - 232})" filter="url(#z-schatten)">
        <path d="M0 -62 C 10 -50, 22 -48, 30 -40 C 44 -46, 62 -40, 70 -26 C 84 -30, 100 -22, 104 -8 C 110 -2, 112 6, 108 14 L-108 14 C -112 6, -110 -2, -104 -8 C -100 -22, -84 -30, -70 -26 C -62 -40, -44 -46, -30 -40 C -22 -48, -10 -50, 0 -62Z" fill="url(#z-krone)" stroke="#4a3008" stroke-width="1.2"/>
        <g fill="none" stroke="#5e3e0c" stroke-width="1.4"><path d="M-90 4 C -80 -14, -60 -18, -48 -8 C -40 -2, -46 8, -54 4"/><path d="M90 4 C 80 -14, 60 -18, 48 -8 C 40 -2, 46 8, 54 4"/><path d="M-36 6 C -30 -10, -14 -22, 0 -36 C 14 -22, 30 -10, 36 6"/></g>
        <path d="M0 -40 L5 -28 L18 -28 L8 -20 L12 -8 L0 -15 L-12 -8 L-8 -20 L-18 -28 L-5 -28Z" fill="#fff4c8" stroke="#6e4a12" stroke-width="1"/>
        <circle cx="0" cy="-74" r="8" fill="url(#z-perle)"/>
      </g>
      ${konisch(226, 240, messing, 0, 180)}${konisch(204, 226, messing2, 40, 180)}
      <circle cx="${CX}" cy="${CY}" r="240" fill="#000" filter="url(#z-patina)" opacity=".9"/>
      <circle cx="${CX}" cy="${CY}" r="240" fill="none" stroke="#3a2404" stroke-width="2"/>
      <circle cx="${CX}" cy="${CY}" r="226" fill="none" stroke="#3a2404" stroke-width="1.2" opacity=".8"/>
      ${[...Array(84)].map((_, i) => { const [x, y] = pol(233, (i * 360) / 84); return `<circle cx="${x}" cy="${y}" r="3.6" fill="url(#z-perle)" stroke="#4a3008" stroke-width=".4"/>`; }).join("")}
      <circle cx="${CX}" cy="${CY}" r="204" fill="#2a1804"/>
      <circle cx="${CX}" cy="${CY}" r="200" fill="url(#z-email)"/>
      <circle cx="${CX}" cy="${CY}" r="200" fill="#000" filter="url(#z-patina)" opacity=".35"/>
      <circle cx="${CX}" cy="${CY}" r="200" fill="none" stroke="#7a5214" stroke-width="1"/>
      <circle cx="${CX}" cy="${CY}" r="192" fill="none" stroke="#3a2410" stroke-width=".9"/><circle cx="${CX}" cy="${CY}" r="182" fill="none" stroke="#3a2410" stroke-width=".9"/>
      ${[...Array(120)].map((_, i) => { const a = i * 3, l = i % 10 === 0 ? 10 : 4, [x1, y1] = pol(192, a), [x2, y2] = pol(192 - l, a); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3a2410" stroke-width="${i % 10 === 0 ? 1.6 : 0.7}"/>`; }).join("")}
      ${sektoren}
      <circle cx="${CX}" cy="${CY}" r="178" fill="none" stroke="#5a3a14" stroke-width="1"/>
      <circle cx="${CX}" cy="${CY}" r="112" fill="none" stroke="#5a3a14" stroke-width="1"/>
      <circle cx="${CX}" cy="${CY}" r="108" fill="rgba(210,170,90,.16)"/>
      ${[...Array(48)].map((_, i) => `<ellipse cx="${CX}" cy="${CY - 48}" rx="18" ry="54" transform="rotate(${i * 7.5} ${CX} ${CY})" fill="none" stroke="#8a6020" stroke-opacity=".28" stroke-width=".6"/>`).join("")}
      ${[100, 96, 60].map((r) => `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="#7a5214" stroke-opacity=".55" stroke-width=".7"/>`).join("")}`;
  }
  const glas = () => `
    <circle cx="${CX}" cy="${CY}" r="22" fill="url(#z-kuppel)" stroke="#3a2404" filter="url(#z-schatten)"/>
    <circle cx="${CX}" cy="${CY}" r="9" fill="url(#z-perle)" stroke="#3a2404" stroke-width=".7"/>
    <path d="M${CX - 6} ${CY - 2} L${CX + 6} ${CY + 2}" stroke="#3a2404" stroke-width="1.6"/>
    <circle cx="${CX}" cy="${CY}" r="203" fill="url(#z-glasrand)"/>
    <path d="M${pol(194, -62)} A194 194 0 0 1 ${pol(194, 12)} A220 220 0 0 0 ${pol(150, -58)}Z" fill="#fff" opacity=".22"/>
    <path d="M${pol(188, -40)} A188 188 0 0 1 ${pol(188, -8)}" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>
    <path d="M${pol(196, 130)} A196 196 0 0 1 ${pol(196, 170)}" stroke="#fff" stroke-width="2" opacity=".18" fill="none" stroke-linecap="round"/>`;

  class Zauberuhr extends HTMLElement {
    setConfig(c) {
      this._c = { personen: [], schilder: true, ...(c || {}) };
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._gebaut = false;
    }
    set hass(h) {
      const alt = this._hass;
      this._hass = h;
      const ids = this._c.personen.flatMap((p) => [p.person, p.sensor]).filter(Boolean);
      const u = uebersicht(h);
      const sig = JSON.stringify([u && u.figuren, new Date().getHours()]);
      if (this._figSig !== sig) { this._figSig = sig; this._gebaut = false; }
      if (!this._gebaut) this._bauen();
      else if (!alt || ids.some((id) => alt.states[id] !== h.states[id])) this._aktualisieren();
    }
    getCardSize() { return 8; }
    _orte() { return this._c.orte && this._c.orte.length === 6 ? this._c.orte : tx(this._hass).orte; }
    _bauen() {
      if (!this._hass) return;
      const orte = this._orte();
      if (!uhrGehaeuse || uhrGehaeuse.orte !== orte.join()) uhrGehaeuse = { orte: orte.join(), svg: gehaeuse(orte) };
      const hand = (p, i) => {
        const L = [112, 98, 118, 104, 92, 124][i % 6];
        const farbe = p.farbe || "#8C7B6B";
        const n = esc((p.name || "?").slice(0, 1).toUpperCase());
        return `<g class="hand" data-i="${i}" style="transform-origin:${CX}px ${CY}px"><g filter="url(#z-schatten)">
          <circle cx="${CX}" cy="${CY + 34}" r="7" fill="url(#z-kuppel)" stroke="#3a2404" stroke-width=".6"/>
          <path d="M${CX - 3.2} ${CY + 30} L${CX - 2.2} ${CY - L + 46} C ${CX - 9} ${CY - L + 40}, ${CX - 9} ${CY - L + 30}, ${CX} ${CY - L + 26} C ${CX + 9} ${CY - L + 30}, ${CX + 9} ${CY - L + 40}, ${CX + 2.2} ${CY - L + 46} L${CX + 3.2} ${CY + 30}Z" fill="url(#z-zeiger)" stroke="#3a2404" stroke-width=".7"/>
          <rect x="${CX - 1.8}" y="${CY - L}" width="3.6" height="30" fill="url(#z-zeiger)" stroke="#3a2404" stroke-width=".5"/>
          <circle cx="${CX}" cy="${CY - 46}" r="6" fill="none" stroke="url(#z-zeiger)" stroke-width="3"/>
          <path d="M${CX} ${CY - L - 21} L${CX + 6} ${CY - L - 28} L${CX} ${CY - L - 38} L${CX - 6} ${CY - L - 28}Z" fill="url(#z-zeiger)" stroke="#3a2404" stroke-width=".7"/>
          <circle cx="${CX}" cy="${CY - L}" r="21" fill="url(#z-kuppel)" stroke="#3a2404" stroke-width=".8"/>
          <circle cx="${CX}" cy="${CY - L}" r="16.5" fill="${esc(farbe)}" stroke="#3a2404" stroke-width=".8"/>
          <circle cx="${CX}" cy="${CY - L}" r="16.5" fill="url(#z-glanz)"/>
          <g class="aufrecht" style="transform-origin:${CX}px ${CY - L}px">
            <ellipse cx="${CX - 5}" cy="${CY - L - 7}" rx="7" ry="4" fill="#fff" opacity=".45"/>
            ${this._c.figuren !== false
              ? `<clipPath id="z-medclip${i}"><circle cx="${CX}" cy="${CY - L}" r="16"/></clipPath><g clip-path="url(#z-medclip${i})"><svg x="${CX - 16}" y="${CY - L - 16}" width="32" height="32" viewBox="34 30 132 132">${figurInhalt(figurVon(this._hass, p), true)}</svg></g>`
              : `<text x="${CX}" y="${CY - L + 6.5}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="18" fill="#fff" stroke="rgba(0,0,0,.35)" stroke-width="1.2" style="paint-order:stroke">${n}</text>`}
          </g></g></g>`;
      };
      const schilder = this._c.schilder ? `<div class="schilder">${this._c.personen.map((p, i) => `<div class="schild" data-i="${i}" data-person="${esc(p.person || "")}">
          <div class="med" style="--c:${esc(p.farbe || "#8C7B6B")}">${this._c.figuren !== false ? figurSvg(figurVon(this._hass, p), "kopf") : esc((p.name || "?").slice(0, 1).toUpperCase())}</div>
          <div class="n"></div><div class="s"></div></div>`).join("")}</div>` : "";
      this.shadowRoot.innerHTML = `<style>${BASIS}${FIGUR_CSS}
        .uhr { position: relative; width: 100%; max-width: 560px; margin: 0 auto; aspect-ratio: 490 / 560; }
        .uhr svg { width: 100%; height: 100%; overflow: visible; display: block; }
        .hand { transition: transform 2.6s cubic-bezier(.34, 1.56, .64, 1); }
        .aufrecht { transition: transform 2.6s cubic-bezier(.34, 1.56, .64, 1); }
        .schilder { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 12px; margin-top: 10px; }
        .schild { position: relative; min-height: 58px; border-radius: 6px; padding: 7px 18px 6px 58px; cursor: pointer;
          background: linear-gradient(180deg, rgba(255,255,255,.35), transparent 40%, rgba(0,0,0,.15)), var(--z-messing);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -2px 3px rgba(0,0,0,.35), 0 0 0 1px #5a3f10, 0 6px 10px rgba(0,0,0,.55); }
        .schild::before, .schild::after { content: ""; position: absolute; top: 24px; width: 7px; height: 7px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3c4, #8a6420 70%); box-shadow: inset 0 0 0 1px #5a3f10; }
        .schild::before { left: 6px; } .schild::after { right: 6px; }
        .schild.neu { animation: z-aufleuchten 1.6s ease; }
        @keyframes z-aufleuchten { 40% { filter: brightness(1.5) drop-shadow(0 0 12px #ffd98a); } }
        .med { position: absolute; left: 19px; top: 13px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font: 700 15px Cinzel, Georgia, serif; color: #fff;
          background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.55), transparent 40%), var(--c); box-shadow: 0 0 0 2px #f3d27a, 0 0 0 3px #6b4a14, 0 2px 3px rgba(0,0,0,.5); text-shadow: 0 1px 1px rgba(0,0,0,.5); }
        .med svg { width: 100%; height: 100%; border-radius: 50%; display: block; }
        .n { font: 700 14px Cinzel, Georgia, serif; letter-spacing: .1em; color: #3a2608; text-shadow: 0 1px 0 rgba(255,245,200,.7), 0 -1px 0 rgba(0,0,0,.25); }
        .s { font: italic 600 15px 'Cormorant Garamond', Georgia, serif; color: #3a2608; text-shadow: 0 1px 0 rgba(255,245,200,.6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style>
      <ha-card><div class="uhr"><svg viewBox="0 0 490 560">${uhrGehaeuse.svg}${this._c.personen.map(hand).join("")}${glas()}</svg></div>${schilder}</ha-card>`;
      this.shadowRoot.querySelectorAll(".schild").forEach((el) => el.addEventListener("click", () => {
        if (!el.dataset.person) return;
        const e = new Event("hass-more-info", { bubbles: true, composed: true });
        e.detail = { entityId: el.dataset.person };
        this.dispatchEvent(e);
      }));
      this._gebaut = true;
      this._winkel = [];
      this._aktualisieren();
    }
    _aktualisieren() {
      const h = this._hass;
      const t = tx(h);
      const orte = this._orte();
      const lage = this._c.personen.map((p) => ortVon(h, p.person, orte));
      // Mehrere Personen am selben Ort fächern leicht auf
      const proSektor = {};
      lage.forEach((l, i) => { const s = SEKTOR.indexOf(l.index); (proSektor[s] = proSektor[s] || []).push(i); });
      lage.forEach((l, i) => {
        const s = SEKTOR.indexOf(l.index);
        const gruppe = proSektor[s];
        const k = gruppe.indexOf(i);
        const versatz = gruppe.length > 1 ? (k - (gruppe.length - 1) / 2) * Math.min(14, 40 / gruppe.length) : 0;
        let ziel = s * 60 + versatz;
        const alt = this._winkel[i];
        if (alt != null) { while (ziel - alt > 180) ziel -= 360; while (alt - ziel > 180) ziel += 360; }
        const hand = this.shadowRoot.querySelector(`.hand[data-i="${i}"]`);
        if (hand) {
          hand.style.transform = `rotate(${ziel}deg)`;
          const auf = hand.querySelector(".aufrecht");
          if (auf) auf.style.transform = `rotate(${-ziel}deg)`;
        }
        const schild = this.shadowRoot.querySelector(`.schild[data-i="${i}"]`);
        if (schild) {
          const p = this._c.personen[i];
          const naechster = p.sensor && h.states[p.sensor];
          const termin = naechster && naechster.state && !["unknown", "unavailable", "", "Keine Termine", "No events"].includes(naechster.state)
            ? `${naechster.state}${naechster.attributes.wann ? ` · ${naechster.attributes.wann}` : ""}` : "";
          const ortName = l.name;
          const neu = schild.dataset.ort && schild.dataset.ort !== ortName;
          schild.dataset.ort = ortName;
          schild.querySelector(".n").textContent = `${String(p.name || "").toUpperCase()} · ${String(ortName).toUpperCase()}`;
          schild.querySelector(".s").textContent = [l.seit && !l.unbekannt ? `${t.seit} ${uhrzeit(l.seit)}` : "", termin].filter(Boolean).join(" · ");
          if (neu) { schild.classList.remove("neu"); void schild.offsetWidth; schild.classList.add("neu"); }
        }
        this._winkel[i] = ziel;
      });
    }
  }

  // ============================================================ Familienkarte
  const KARTEN_ORTE = { 0: [345, 330], 2: [135, 165], 1: [560, 155], 3: [135, 540], 4: [560, 555], 5: [610, 340] };
  const ORT_BILD = {
    0: '<path d="M-44 0 v-38 l44 -34 l44 34 v38z" fill="rgba(200,140,60,.18)"/><path d="M-12 0 v-22 h24 v22"/><path d="M-34 -28 h12 v10 h-12z M22 -28 h12 v10 h-12z" fill="rgba(255,200,80,.55)"/><path d="M20 -56 v-14 h10 v22"/>',
    2: '<path d="M-40 14 v-36 h80 v36z" fill="rgba(160,120,70,.12)"/><path d="M-48 -22 l48 -26 l48 26"/><circle cy="-30" r="6"/><path d="M-30 -10 h10 v12 h-10z M20 -10 h10 v12 h-10z M-6 14 v-14 h12 v14"/>',
    1: '<path d="M-34 10 v-60 h68 v60z" fill="rgba(160,120,70,.12)"/><path d="M-24 -40 h10 v10 h-10z M-5 -40 h10 v10 h-10z M14 -40 h10 v10 h-10z M-24 -22 h10 v10 h-10z M14 -22 h10 v10 h-10z M-6 10 v-14 h12 v14"/><path d="M-38 -50 h76"/>',
    3: '<ellipse rx="52" ry="22" fill="rgba(120,150,60,.15)"/><path d="M0 -22 v44"/><circle r="7"/><path d="M-52 -6 h10 v12 h-10 M52 -6 h-10 v12 h10"/>',
    4: '<path d="M-30 4 h60 l-8 -26 h-44z" fill="rgba(160,120,70,.12)"/><circle cx="-18" cy="8" r="6"/><circle cx="18" cy="8" r="6"/>',
    5: '<path d="M0 10 C -20 -4 -14 -18 -6 -16 C -2 -15 0 -10 0 -9 C 0 -10 2 -15 6 -16 C 14 -18 20 -4 0 10Z" fill="rgba(200,90,90,.15)"/>',
  };
  class Zauberkarte extends HTMLElement {
    setConfig(c) { this._c = { personen: [], ...(c || {}) }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); }
    set hass(h) {
      const alt = this._hass;
      this._hass = h;
      const ids = this._c.personen.map((p) => p.person).filter(Boolean);
      const u = uebersicht(h);
      const sig = JSON.stringify([u && u.figuren, new Date().getHours()]);
      const neu = this._figSig !== sig;
      this._figSig = sig;
      if (!alt || neu || ids.some((id) => alt.states[id] !== h.states[id])) this._zeichnen();
    }
    getCardSize() { return 8; }
    _zeichnen() {
      const h = this._hass;
      const t = tx(h);
      const orte = this._c.orte && this._c.orte.length === 6 ? this._c.orte : t.orte;
      const lage = this._c.personen.map((p) => ortVon(h, p.person, orte));
      const [hx, hy] = KARTEN_ORTE[0];
      const spuren = lage.map((l, i) => {
        const farbe = this._c.personen[i].farbe || "#3b2414";
        if (l.index === 0) {
          const dx = (i - (lage.length - 1) / 2) * 22;
          return `<g fill="${esc(farbe)}"><use href="#z-fuss" transform="translate(${hx - 8 + dx} ${hy + 38}) rotate(12)"/><use href="#z-fuss" transform="translate(${hx + 6 + dx} ${hy + 48}) rotate(-14)" opacity=".7"/></g>`;
        }
        const [zx, zy] = KARTEN_ORTE[l.index];
        const winkel = (Math.atan2(zy - hy, zx - hx) * 180) / Math.PI + 90;
        let s = "";
        for (let k = 1; k <= 6; k++) {
          const f = 0.18 + k * 0.11;
          const seite = (k % 2 ? 1 : -1) * 5 + (i - 1.5) * 3;
          const nx = -(zy - hy), ny = zx - hx, nl = Math.hypot(nx, ny) || 1;
          const x = hx + (zx - hx) * f + (nx / nl) * seite, y = hy + (zy - hy) * f + (ny / nl) * seite;
          s += `<use href="#z-fuss" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${winkel.toFixed(0)})" opacity="${(0.3 + k * 0.12).toFixed(2)}"/>`;
        }
        return `<g fill="${esc(farbe)}">${s}</g>`;
      }).join("");
      const namen = lage.map((l, i) => {
        const p = this._c.personen[i];
        const [x, y] = KARTEN_ORTE[l.index];
        const gleiche = lage.slice(0, i).filter((x2) => x2.index === l.index).length;
        const ny = l.index === 0 ? y + 78 + gleiche * 24 : y - 62 - gleiche * 24;
        const tx0 = x + (l.index === 0 ? 70 : 0);
        const kopf = this._c.figuren !== false
          ? `<clipPath id="z-kk${i}"><circle cx="${tx0 - 8}" cy="${ny - 44}" r="19"/></clipPath><circle cx="${tx0 - 8}" cy="${ny - 44}" r="21" fill="${esc(p.farbe || "#3b2414")}" stroke="#3b2414" stroke-width="1.2"/><g clip-path="url(#z-kk${i})"><svg x="${tx0 - 27}" y="${ny - 63}" width="38" height="38" viewBox="34 30 132 132">${figurInhalt(figurVon(h, p), true)}</svg></g>`
          : "";
        return `${kopf}<text x="${tx0}" y="${ny}" text-anchor="middle" fill="${esc(p.farbe || "#3b2414")}">${esc(p.name)}</text>`;
      }).join("");
      const besucht = new Set(lage.map((l) => l.index));
      const ortBilder = [0, 1, 2, 3, 4, 5].filter((i) => i !== 5 || besucht.has(5)).map((i) => {
        const [x, y] = KARTEN_ORTE[i];
        const name = i === 5 ? (lage.find((l) => l.index === 5) || {}).name || orte[5] : orte[i];
        return `<g transform="translate(${x} ${y})" class="ort"><g filter="url(#z-tinte)" fill="none" stroke="#3b2414" stroke-width="1.8">${ORT_BILD[i]}</g>
          <text y="${i === 0 ? 24 : i === 3 ? 46 : 36}" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="14" letter-spacing="1.5" fill="#3b2414">${esc(String(name).toUpperCase())}</text></g>`;
      }).join("");
      const baeume = [[40, 300], [62, 318], [88, 302], [52, 344], [80, 350], [106, 336], [585, 470], [612, 456], [640, 478]].map(([x, y]) => `<use href="#z-baum" x="${x}" y="${y}"/>`).join("");
      this.shadowRoot.innerHTML = `<style>${BASIS}${FIGUR_CSS}
        .karte { position: relative; width: 100%; max-width: 760px; margin: 0 auto; aspect-ratio: 690 / 640; filter: drop-shadow(0 22px 22px rgba(0,0,0,.6)) drop-shadow(0 4px 4px rgba(0,0,0,.5)); transform: rotate(-.6deg); }
        svg { width: 100%; height: 100%; overflow: visible; display: block; }
        .namen { font-family: Caveat, 'Comic Sans MS', cursive; font-weight: 600; font-size: 26px; }
        .pin { position: absolute; width: 2.6%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff7d0, #d9b45a 35%, #7a5214 80%); box-shadow: 2px 4px 4px rgba(0,0,0,.55); }
      </style>
      <ha-card><div class="karte"><svg viewBox="0 0 690 640">
        <defs>
          <filter id="z-rand" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="4" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="14"/></filter>
          <filter id="z-tinte"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" result="d"/><feGaussianBlur in="d" stdDeviation=".25"/></filter>
          <filter id="z-aquarell"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="22" result="d"/><feGaussianBlur in="d" stdDeviation="2.2"/></filter>
          <radialGradient id="z-papier" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#f7ebcb"/><stop offset=".55" stop-color="#ead3a0"/><stop offset="1" stop-color="#c9a56a"/></radialGradient>
          <filter id="z-flecken"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="5" seed="11"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .27  0 0 0 0 .08  0 0 0 -1.5 .9"/><feComposite in2="SourceGraphic" operator="in"/></filter>
          <filter id="z-korn"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .15  0 0 0 0 .06  0 0 0 .35 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
          <filter id="z-brand"><feGaussianBlur stdDeviation="14"/></filter>
          <mask id="z-maske" maskUnits="userSpaceOnUse" x="-20" y="-20" width="730" height="680"><rect x="8" y="8" width="674" height="624" fill="#fff" filter="url(#z-rand)"/></mask>
          <g id="z-fuss"><ellipse cx="0" cy="0" rx="3.4" ry="5.8"/><circle cx="-2.1" cy="-8" r="1.4"/><circle cx=".6" cy="-8.8" r="1.4"/><circle cx="3" cy="-7.4" r="1.25"/></g>
          <g id="z-baum"><path d="M0 -14 C 6 -8, 8 -2, 5 2 C 8 3, 8 8, 2 8 L2 12 L-2 12 L-2 8 C -8 8, -8 3, -5 2 C -8 -2, -6 -8, 0 -14Z" fill="rgba(70,90,40,.18)" stroke="#4a3220" stroke-width="1"/><path d="M0 -8 V10 M0 -2 L3 -5 M0 3 L-3 0" stroke="#4a3220" stroke-width=".7" fill="none"/></g>
        </defs>
        <g filter="url(#z-rand)">
          <rect x="8" y="8" width="674" height="624" fill="url(#z-papier)"/>
          <rect x="8" y="8" width="674" height="624" fill="#000" filter="url(#z-flecken)"/>
          <rect x="8" y="8" width="674" height="624" fill="#000" filter="url(#z-korn)"/>
          <rect x="8" y="8" width="674" height="624" fill="none" stroke="#6b3c10" stroke-width="34" opacity=".35" filter="url(#z-brand)"/>
          <rect x="8" y="8" width="674" height="624" fill="none" stroke="#3a1c05" stroke-width="5" opacity=".55" style="filter:blur(2px)"/>
        </g>
        <g mask="url(#z-maske)">
          <circle cx="590" cy="560" r="46" fill="none" stroke="#7a4a18" stroke-width="3" opacity=".18" filter="url(#z-aquarell)"/>
          <path d="M345 10 V630 M8 320 H682" stroke="rgba(90,55,20,.18)" stroke-width="2"/><path d="M347 10 V630 M8 322 H682" stroke="rgba(255,250,230,.35)" stroke-width="1"/>
          <g filter="url(#z-aquarell)">
            <path d="M0 450 C 120 420, 200 500, 330 580 S 520 620, 690 590 L690 640 L0 640Z" fill="#6f98b5" opacity=".22"/>
            <ellipse cx="130" cy="560" rx="90" ry="40" fill="#8aa35a" opacity=".22"/>
            <ellipse cx="70" cy="330" rx="60" ry="70" fill="#5e7a3c" opacity=".18"/>
            <ellipse cx="345" cy="330" rx="70" ry="50" fill="#c98a3c" opacity=".16"/>
          </g>
          <g filter="url(#z-tinte)" fill="none" stroke="#3b2414" stroke-linecap="round">
            <path d="M0 455 C 120 425, 200 505, 330 585 S 520 625, 690 595" stroke="#3d5a70" stroke-width="2" opacity=".7"/>
            <path d="M0 468 C 120 438, 200 518, 328 598 S 520 638, 690 608" stroke="#3d5a70" stroke-width="1.2" opacity=".5"/>
            <g stroke-width="1.6" stroke-dasharray="2 7" opacity=".75">${[1, 2, 3, 4, 5].filter((i) => i !== 5 || besucht.has(5)).map((i) => { const [x, y] = KARTEN_ORTE[i]; return `<path d="M${hx} ${hy} Q ${(hx + x) / 2 + (y - hy) * 0.12} ${(hy + y) / 2 - (x - hx) * 0.12} ${x} ${y}"/>`; }).join("")}</g>
            <g transform="translate(615 140)" stroke-width="1"><circle r="30"/><circle r="24" stroke-dasharray="1 3"/>
              <path d="M0 -40 L6 -6 L40 0 L6 6 L0 40 L-6 6 L-40 0 L-6 -6Z" fill="rgba(160,110,50,.25)"/>
              <path d="M0 -40 L6 -6 L0 0Z M40 0 L6 6 L0 0Z M0 40 L-6 6 L0 0Z M-40 0 L-6 -6 L0 0Z" fill="#3b2414"/></g>
          </g>
          <g filter="url(#z-tinte)">${baeume}</g>
          ${ortBilder}
          <g filter="url(#z-tinte)">${spuren}</g>
        </g>
        <g transform="translate(345 50)">
          <path d="M-190 -24 H190 C 200 -24, 206 -10, 214 0 C 206 10, 200 24, 190 24 H-190 C -200 24, -206 10, -214 0 C -206 -10, -200 -24, -190 -24Z" fill="rgba(245,230,195,.6)" stroke="#5a3418" stroke-width="1.4" filter="url(#z-tinte)"/>
          <text y="9" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="25" fill="#3b2414" letter-spacing="2">${esc(t.karte)}</text>
        </g>
        <text x="345" y="96" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-weight="600" font-size="18" fill="#5a3418">${esc(t.karte_unter)}</text>
        <text x="615" y="92" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="13" fill="#3b2414">N</text>
        <g class="namen">${namen}</g>
      </svg>
      <div class="pin" style="left:2.6%;top:3%"></div><div class="pin" style="right:2.4%;top:2.2%"></div><div class="pin" style="left:2%;bottom:2.8%"></div><div class="pin" style="right:2.8%;bottom:2.4%"></div>
      </div></ha-card>`;
    }
  }

  // ============================================================== Zauberbuch
  const INITIAL_FARBEN = ["#1e3f7a", "#8a1a1a", "#1f5a3a", "#4a2a6a", "#8a1a1a", "#1e3f7a", "#1f5a3a"];
  const ZIER = `<svg class="zier" viewBox="0 0 300 26"><g fill="none" stroke="#8a5a22" stroke-width="1.2" stroke-linecap="round"><path d="M150 13 C 130 2, 112 2, 100 13 C 90 22, 76 22, 70 13 C 64 6, 52 8, 52 14 C 52 19, 60 19, 60 14"/><path d="M150 13 C 170 2, 188 2, 200 13 C 210 22, 224 22, 230 13 C 236 6, 248 8, 248 14 C 248 19, 240 19, 240 14"/><path d="M40 13 H8 M260 13 H292"/></g><path d="M150 5 L155 13 L150 21 L145 13Z" fill="#b8862e" stroke="#6a4512" stroke-width=".8"/><circle cx="125" cy="13" r="2" fill="#b8862e"/><circle cx="175" cy="13" r="2" fill="#b8862e"/></svg>`;
  const BUCH_CSS = `
    :host { --stunde: 40px; }
    ha-card { padding: 0; background: transparent; box-shadow: none; border: 0; overflow: visible; }
    .buchrahmen { position: relative; padding: 6px 0 4px; }
    .buch { position: relative; max-width: 1240px; margin: 34px auto 0; padding: 14px 18px 20px; border-radius: 16px; perspective: 2600px;
      background: radial-gradient(ellipse at 35% 25%, rgba(255,120,90,.16), transparent 60%), var(--z-leder), linear-gradient(160deg,#5a1a17,#3a0d0b 70%,#220605);
      box-shadow: inset 0 0 0 2px #1d0504, inset 0 0 26px rgba(0,0,0,.65), 0 40px 70px rgba(0,0,0,.65), 0 12px 22px rgba(0,0,0,.5); }
    .buch::before { content: ""; position: absolute; inset: 6px; border-radius: 12px; border: 1.5px solid transparent; background: var(--z-gold) border-box;
      -webkit-mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; opacity: .8; pointer-events: none; }
    .seiten { position: relative; display: grid; grid-template-columns: 1fr 1fr; min-height: 560px; }
    .seite { position: relative; padding: 30px 40px 34px; background: radial-gradient(ellipse at 30% 20%, rgba(255,252,235,.45), transparent 55%), var(--z-pergament); min-width: 0; }
    .seite.l { border-radius: 6px 2px 2px 10px; box-shadow: inset -70px 0 60px -30px rgba(70,38,8,.75), inset -12px 0 10px -6px rgba(40,20,0,.6), inset 0 0 24px rgba(120,70,20,.5),
      -2px 3px 0 -1px #f0dfb2, -3px 5px 0 -1px #d9a94a, -5px 8px 0 -1px #f3d27a, -7px 11px 0 -1px #b8862e, 0 18px 22px rgba(0,0,0,.5); }
    .seite.r { border-radius: 2px 6px 10px 2px; box-shadow: inset 70px 0 60px -30px rgba(70,38,8,.75), inset 12px 0 10px -6px rgba(40,20,0,.6), inset 0 0 24px rgba(120,70,20,.5),
      2px 3px 0 -1px #f0dfb2, 3px 5px 0 -1px #d9a94a, 5px 8px 0 -1px #f3d27a, 7px 11px 0 -1px #b8862e, 0 18px 22px rgba(0,0,0,.5); }
    .seite::after { content: ""; position: absolute; inset: 14px; border: 1px solid rgba(120,80,30,.4); pointer-events: none; }
    .seiten.einzeln { grid-template-columns: 1fr; }
    .seiten.einzeln .seite { border-radius: 6px; box-shadow: inset 0 0 24px rgba(120,70,20,.5), 3px 5px 0 -1px #d9a94a, 6px 9px 0 -1px #b8862e, 0 18px 22px rgba(0,0,0,.5); }
    .band-lese { position: absolute; left: calc(50% - 10px); top: -6px; width: 20px; height: 92%; z-index: 6; pointer-events: none;
      background: linear-gradient(90deg,#4a0b0e,#9e1f26 35%,#d14048 50%,#8e1a20 70%,#4a0b0e); clip-path: polygon(0 0,100% 0,100% 100%,50% 96%,0 100%); filter: drop-shadow(2px 3px 2px rgba(0,0,0,.55)); }
    .seiten.einzeln + .band-lese, .einzeln ~ .band-lese { display: none; }
    .baender { position: absolute; right: 60px; top: -40px; display: flex; gap: 8px; z-index: 8; }
    .band { width: 44px; height: 92px; border: 0; padding: 14px 0 0; display: flex; justify-content: center; writing-mode: vertical-rl; font: 700 11px Cinzel, Georgia, serif; letter-spacing: .12em; color: #f7e3a6;
      background: linear-gradient(90deg, rgba(0,0,0,.35), transparent 30%, rgba(255,255,255,.22) 48%, transparent 62%, rgba(0,0,0,.35)), var(--farbe);
      clip-path: polygon(0 0,100% 0,100% 100%,50% calc(100% - 14px),0 100%); filter: drop-shadow(0 4px 4px rgba(0,0,0,.6)); transition: height .3s; }
    .band.an { height: 118px; color: #fff6d2; text-shadow: 0 0 8px #ffd98a; }
    .zier { display: block; width: min(300px, 80%); margin: 0 auto; }
    .titel { text-align: center; margin: -2px 0 6px; }
    .titel .gross { font: 800 clamp(22px, 2.6vw, 30px) Cinzel, Georgia, serif; letter-spacing: .06em; }
    .titel .klein { font: italic 600 17px 'Cormorant Garamond', Georgia, serif; color: #6b4a28; }
    .nav { display: flex; justify-content: center; gap: 8px; margin: 6px 0 4px; }
    .knopf { height: 30px; min-width: 30px; padding: 0 12px; border-radius: 999px; border: 0; font: 600 12px Cinzel, Georgia, serif; letter-spacing: .08em; color: #3a2608;
      background: linear-gradient(180deg, rgba(255,255,255,.4), transparent 45%, rgba(0,0,0,.15)), var(--z-messing); box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 0 0 1px #5a3f10, 0 3px 5px rgba(0,0,0,.35); }
    .knopf.an { box-shadow: inset 0 1px 0 rgba(255,255,255,.6), 0 0 0 1px #5a3f10, 0 0 12px rgba(255,210,110,.9); }
    /* Tage (Woche) */
    .tagblock { display: grid; grid-template-columns: 56px 1fr; column-gap: 14px; margin-top: 14px; position: relative; }
    .initial { width: 54px; height: 54px; display: grid; place-items: center; position: relative; border-radius: 3px; cursor: pointer;
      background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.25), transparent 45%), radial-gradient(circle, rgba(255,220,120,.35) 1px, transparent 1.6px) 0 0/9px 9px, var(--grund);
      box-shadow: 0 0 0 1.5px #b8862e, 0 0 0 3px #f3d27a, 0 0 0 4px #7a5214, 0 3px 6px rgba(60,30,0,.45), inset 0 0 10px rgba(0,0,0,.45); }
    .initial b { font: 900 27px 'Cinzel Decorative', Cinzel, Georgia, serif; background: var(--z-gold); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 1px 1px rgba(0,0,0,.7)); }
    .tagname { font: 600 15px Cinzel, Georgia, serif; letter-spacing: .14em; color: #5a3418; display: flex; align-items: center; gap: 10px; margin-top: 2px; text-transform: uppercase; }
    .tagname::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(120,80,30,.55), transparent); }
    .tagname .plus { order: 3; border: 0; background: none; color: #8a5a22; font-size: 18px; padding: 0 2px; line-height: 1; }
    .heute-mark { font: 700 12px Cinzel, Georgia, serif; letter-spacing: .2em; color: #9a1b1b; }
    .tagblock.heute { margin-left: -14px; margin-right: -14px; padding: 8px 14px 10px; border-radius: 6px;
      background: radial-gradient(ellipse at 30% 50%, rgba(255,226,140,.55), rgba(255,220,120,.18) 60%, transparent 85%); box-shadow: 0 0 0 1px rgba(201,150,60,.35); }
    .tagblock.heute .initial { box-shadow: 0 0 0 1.5px #b8862e, 0 0 0 3px #f3d27a, 0 0 0 4px #7a5214, 0 0 22px 6px rgba(255,210,110,.75), inset 0 0 10px rgba(0,0,0,.45); }
    .kranz { position: absolute; left: -17px; top: -17px; width: 88px; height: 88px; pointer-events: none; animation: z-dreh 14s linear infinite; }
    @keyframes z-dreh { to { transform: rotate(360deg); } }
    .eintrag { display: grid; grid-template-columns: 46px 30px 1fr; align-items: center; column-gap: 8px; margin-top: 2px; cursor: pointer; border-radius: 4px; padding: 1px 4px; margin-left: -4px; }
    .eintrag:hover { background: rgba(255,240,200,.45); }
    .eintrag .z { font: 600 13px Cinzel, Georgia, serif; color: #7a5232; }
    .eintrag .t { font: italic 600 clamp(17px, 1.7vw, 21px)/1.25 'Cormorant Garamond', Georgia, serif; color: var(--z-tinte); min-width: 0; }
    .eintrag .t em { font: 600 16px Caveat, cursive; color: #7a5232; font-style: normal; margin-left: 6px; }
    .eintrag.vorbei { opacity: .55; }
    .kopfbild { width: 30px; height: 30px; border-radius: 50%; overflow: hidden; display: block; justify-self: center;
      background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--f) 45%, #fff), var(--f)); box-shadow: 0 0 0 1.5px #c9a24a, 0 2px 4px rgba(0,0,0,.35); }
    .kopfbild svg { width: 100%; height: 100%; display: block; }
    .eintrag.vorbei .kopfbild { filter: grayscale(.6) opacity(.7); }
    .tropfen { justify-self: center; width: 12px; height: 12px; border-radius: 50% 50% 50% 50%/60% 60% 40% 40%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.6), transparent 40%), var(--f);
      box-shadow: 0 1px 1.5px rgba(0,0,0,.45), inset 0 -1px 2px rgba(0,0,0,.35); display: inline-block; }
    .leer { font: italic 600 16px 'Cormorant Garamond', Georgia, serif; color: rgba(90,52,24,.55); margin-top: 2px; }
    .schreibt .t { animation: z-schreib 2.6s steps(36) both; }
    @keyframes z-schreib { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    .irrlicht { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; padding: 1px 10px 1px 4px; border-radius: 999px; vertical-align: middle;
      font: 700 11px Cinzel, Georgia, serif; letter-spacing: .12em; color: #eafaff; background: linear-gradient(90deg, rgba(30,60,110,.85), rgba(20,40,80,.6));
      border: 1px solid rgba(160,220,255,.7); box-shadow: 0 0 14px rgba(120,200,255,.6); animation: z-schwebe 3.4s ease-in-out infinite; }
    .irrlicht::before { content: ""; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(circle, #fff 0, #d9f4ff 25%, #7fd3ff 55%, rgba(80,170,255,0) 75%); box-shadow: 0 0 12px 5px rgba(120,200,255,.6); }
    @keyframes z-schwebe { 50% { transform: translateY(-3px); } }
    .fusszeile { position: absolute; bottom: 18px; left: 0; right: 0; text-align: center; font: italic 600 14px 'Cormorant Garamond', Georgia, serif; color: #7a5232; }
    .linksbox { margin-top: 14px; }
    .ueber { font: 600 14px Cinzel, Georgia, serif; letter-spacing: .14em; color: #5a3418; margin: 18px 0 6px; display: flex; gap: 10px; align-items: center; text-transform: uppercase; }
    .ueber::after { content: ""; flex: 1; height: 1px; background: rgba(120,80,30,.5); }
    .grossdatum { display: flex; gap: 22px; align-items: center; margin: 18px 0 6px 6px; }
    .grossdatum .initial { width: 110px; height: 110px; cursor: default; } .grossdatum .initial b { font-size: 58px; }
    .monde { display: flex; justify-content: center; gap: 22px; margin: 14px 0 6px; font: 600 12px Cinzel, Georgia, serif; color: #7a5232; text-align: center; }
    .monde span { display: block; font-size: 24px; color: #4a2c14; }
    /* Basis-Raster und Monat im Pergament-Look */
    .inhalt .raster, .inhalt .monat, .inhalt .liste { --primary-text-color: #2a1a0e; --secondary-text-color: #6b4a28; --divider-color: rgba(120,80,30,.35);
      --card-background-color: transparent; --primary-color: #8a1a1a; font-family: 'Cormorant Garamond', Georgia, serif; }
    .inhalt .tagkopf { font-family: Cinzel, Georgia, serif; }
    .inhalt .termin { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 700; }
    .inhalt .termin.zeit { background: linear-gradient(90deg, color-mix(in srgb, var(--f) 26%, rgba(255,250,235,.55)), color-mix(in srgb, var(--f) 8%, rgba(255,250,235,.25))) !important;
      border-left: 4px solid var(--f) !important; color: #2a1a0e !important; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--f) 30%, transparent) !important; }
    .inhalt .jetzt { background: linear-gradient(90deg, #ffcf6a, #fff3c4, #ffcf6a) !important; box-shadow: 0 0 10px 2px rgba(255,200,90,.9) !important; height: 2px !important; }
    .inhalt .jetzt::before { content: "" !important; position: absolute; left: -8px; top: -26px; width: 16px; height: 26px; border-radius: 50% 50% 40% 40%;
      background: radial-gradient(circle at 50% 70%, #fff 0, #fff3b0 25%, #ffb43c 60%, rgba(255,122,26,0) 75%) !important; filter: drop-shadow(0 0 6px #ffc94a); animation: z-flacker 2.2s ease-in-out infinite; }
    @keyframes z-flacker { 30% { transform: scale(.95,1.06) skewX(2deg); } 60% { transform: scale(1.04,.95) skewX(-2deg); } }
    .inhalt .mzelle { border-color: rgba(120,80,30,.4) !important; background: transparent !important; }
    .inhalt .mzelle.heute { background: radial-gradient(circle, rgba(255,226,140,.7), rgba(255,220,120,.15) 75%) !important; box-shadow: inset 0 0 0 2px #c9963c; }
    .inhalt .mnr, .inhalt .mkopf { font-family: Cinzel, Georgia, serif !important; color: #4a2c14 !important; }
    .inhalt .zeiten .stunde span { font-family: Cinzel, Georgia, serif; color: #7a5232; }
    .inhalt .stunde, .inhalt .spalte, .inhalt .slot { border-color: rgba(120,80,30,.22) !important; }
    .inhalt .tagkopf.heute .nr { background: #8a1a1a !important; color: #f3dfa6 !important; }
    .inhalt .llabel { font-family: Cinzel, Georgia, serif; letter-spacing: .1em; color: #5a3418; }
    .inhalt .chips { display: none; }
    /* Umblättern */
    .blatt { position: absolute; top: 14px; bottom: 20px; width: calc(50% - 18px); z-index: 7; transform-style: preserve-3d; pointer-events: none; }
    .blatt.vor { right: 18px; transform-origin: 0 50%; animation: z-vor 1.3s cubic-bezier(.45,.05,.3,1) forwards; }
    .blatt.zurueck { left: 18px; transform-origin: 100% 50%; animation: z-zurueck 1.3s cubic-bezier(.45,.05,.3,1) forwards; }
    .blatt > div { position: absolute; inset: 0; backface-visibility: hidden; overflow: hidden; padding: 30px 40px; background: var(--z-pergament); }
    .blatt .rs { transform: rotateY(180deg); }
    @keyframes z-vor { from { transform: rotateY(0); } to { transform: rotateY(-180deg); } }
    @keyframes z-zurueck { from { transform: rotateY(0); } to { transform: rotateY(180deg); } }
    .siegelplatz { margin-top: 12px; }
    .werkzeug { display: flex; justify-content: center; gap: 8px; margin-top: 8px; }
    .neu { display: none; }
    @media (max-width: 760px) {
      .seite { padding: 24px 22px 30px; }
      .buch { padding: 10px 10px 14px; margin-top: 30px; }
      .baender { right: 20px; }
      .band { width: 36px; height: 76px; } .band.an { height: 96px; }
    }
  `;

  function zauberbuchDefinieren() {
    const Basis = window.familienplaner && window.familienplaner.KalenderBasis;
    if (!Basis || customElements.get("familienplaner-zauberbuch")) return;
    const H = Basis.hilfen;
    const { kesc, tagAnfang, plusTage, gleicherTag, datumIso, hhmm, kalenderwoche, sym } = H;

    class Zauberbuch extends Basis {
      setConfig(config) {
        super.setConfig(config);
        this._gesehen = null;
      }
      _blaettern(richtung) {
        const r = this.shadowRoot && this.shadowRoot.querySelector(".seite.r");
        const l = this.shadowRoot && this.shadowRoot.querySelector(".seite.l");
        if (richtung && r && l && !this._schmal()) this._umblaettern = { richtung, vorne: richtung > 0 ? r.innerHTML : l.innerHTML };
        super._blaettern(richtung);
      }
      _eintrag(t, jetzt, neuIds, naechster) {
        const vorbei = t.ende < jetzt ? "vorbei" : "";
        const neu = neuIds.has(this._id(t)) ? "schreibt" : "";
        const extra = [t.ort, t.fahrer ? `🚗 ${t.fahrer}` : ""].filter(Boolean).join(" · ");
        const k = (this._config.kalender || []).find((x) => x.entity === t.kal);
        const kopf = k && k.slug && k.slug !== "familie" && this._config.figuren !== false
          ? `<span class="kopfbild" style="--f:${kesc(t.farbe)}">${figurSvg(figurVon(this._hass, { slug: k.slug, name: k.name, farbe: k.farbe }), "kopf")}</span>`
          : '<span class="tropfen"></span>';
        return `<div class="eintrag termin ${vorbei} ${neu}" data-id="${kesc(this._id(t))}" style="--f:${kesc(t.farbe)}">
          <span class="z">${t.ganz ? "✦" : hhmm(t.start)}</span>${kopf}
          <span class="t">${sym(t.titel)} ${kesc(t.titel)}${extra ? `<em>– ${kesc(extra)}</em>` : ""}${naechster === t ? `<span class="irrlicht">${kesc(tx(this._hass).gleich)}</span>` : ""}</span></div>`;
      }
      _tagBlock(d, i, termine, jetzt, neuIds, naechster) {
        const t = tx(this._hass);
        const n = plusTage(d, 1);
        // Termine über Mitternacht nur am Folgetag zeigen, wenn sie dort noch länger laufen
        const liste = termine.filter((x) => x.start < n && x.ende > d && !(x.ganz && x.ende <= d) && (x.ganz || x.start >= d || x.ende - d > 4 * 3600000));
        const heute = gleicherTag(d, jetzt);
        const kranz = heute ? `<svg class="kranz" viewBox="0 0 88 88">${[...Array(12)].map((_, k) => { const a = (k * 30 * Math.PI) / 180, x = 44 + 39 * Math.cos(a), y = 44 + 39 * Math.sin(a), s = k % 3 === 0 ? 4 : 2.2; return `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" d="M0 -${s} L${s * 0.3} -${s * 0.3} L${s} 0 L${s * 0.3} ${s * 0.3} L0 ${s} L-${s * 0.3} ${s * 0.3} L-${s} 0 L-${s * 0.3} -${s * 0.3}Z" fill="#fff3c4" style="filter:drop-shadow(0 0 3px #ffd36b)"/>`; }).join("")}</svg>` : "";
        return `<div class="tagblock ${heute ? "heute" : ""}">
          <div class="initial tagkopf" data-tag="${datumIso(d)}" style="--grund:${INITIAL_FARBEN[i % 7]}"><b>${d.getDate()}</b>${kranz}</div>
          <div><div class="tagname">${kesc(t.tage[d.getDay()])}${heute ? `<span class="heute-mark">· ${kesc(t.heute).toUpperCase()}</span>` : ""}<button class="plus" data-slot="${datumIso(d)}T${p2(heute ? Math.min(Math.max(jetzt.getHours() + 1, 7), 21) : 9)}" title="${kesc(t.eintragen)}">✒</button></div>
          ${liste.length ? liste.map((x) => this._eintrag(x, jetzt, neuIds, naechster)).join("") : `<div class="leer">${kesc(t.frei_tag)}</div>`}</div></div>`;
      }
      _zeichnen() {
        if (!this.shadowRoot || !this._hass) return;
        const t = tx(this._hass);
        const ktx = this._tx();
        const [start, ende] = this._bereich();
        const jetzt = new Date();
        const termine = this._sichtbar();
        // neue Termine erkennen (Tinte schreibt)
        const ids = new Set(this._termine.map((x) => this._id(x)));
        const neuIds = new Set(this._gesehen ? [...ids].filter((x) => !this._gesehen.has(x)) : []);
        if (this._termine.length || this._gesehen) this._gesehen = ids;
        const naechster = termine.find((x) => !x.ganz && x.start > jetzt && x.start - jetzt < 45 * 60000);
        const einzeln = this._schmal() || this._ansicht === "liste" && this._config.folge_person === false;
        let links = "", rechts = "";
        const nav = `<div class="nav"><button class="knopf" data-blaettern="-1" aria-label="zurück">‹</button><button class="knopf" data-blaettern="0">${kesc(ktx.heute)}</button><button class="knopf" data-blaettern="1" aria-label="vor">›</button>
          ${this._ansicht === "woche" || this._ansicht === "tag" ? `<button class="knopf frei ${this._frei ? "an" : ""}" title="${kesc(ktx.freiHinweis)}">${kesc(t.frei)}</button>` : ""}</div>`;
        const titel = (gross, klein) => `${ZIER}<div class="titel"><div class="gross gold">${kesc(gross)}</div><div class="klein">${kesc(klein)}</div></div>${nav}`;
        if (this._ansicht === "woche") {
          const anzahl = Math.round((ende - start) / 86400000);
          const tage = [...Array(anzahl)].map((_, i) => plusTage(start, i));
          const kw = kalenderwoche(start);
          const kopf = titel(`${t.kw} ${roemisch(kw)}`, ktx.kw === "KW" ? this._titel().replace(/^KW \d+ · /, "") : this._titel());
          if (einzeln || anzahl < 7) { links = kopf + tage.map((d, i) => this._tagBlock(d, i, termine, jetzt, neuIds, naechster)).join(""); }
          else {
            links = kopf + tage.slice(0, 3).map((d, i) => this._tagBlock(d, i, termine, jetzt, neuIds, naechster)).join("");
            rechts = tage.slice(3).map((d, i) => this._tagBlock(d, i + 3, termine, jetzt, neuIds, naechster)).join("");
          }
        } else if (this._ansicht === "tag") {
          const d = this._datum;
          const n = plusTage(tagAnfang(d), 1);
          const liste = termine.filter((x) => x.start < n && x.ende > tagAnfang(d));
          const mp = mondphase(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12));
          links = `${ZIER}${nav}<div class="grossdatum"><div class="initial" style="--grund:#8a1a1a"><b>${d.getDate()}</b></div>
            <div><div class="gold cinzel" style="font:800 clamp(24px,3vw,34px) Cinzel,Georgia,serif;letter-spacing:.06em">${kesc(t.tage[d.getDay()])}</div>
            <div style="font:italic 600 19px 'Cormorant Garamond',Georgia,serif;color:#6b4a28">${d.getDate()}. ${kesc(t.monate[d.getMonth()])} · ${kesc(t.kw)} ${roemisch(kalenderwoche(d))}</div>
            <div style="font:600 16px 'Cormorant Garamond',Georgia,serif;color:#4a2c14;margin-top:4px">${MONDZEICHEN[mp]} ${kesc(t.mond[mp])}</div></div></div>
            <div class="ueber">${kesc(t.tag_worte)}</div>${liste.length ? liste.map((x) => this._eintrag(x, jetzt, neuIds, naechster)).join("") : `<div class="leer">${kesc(t.frei_tag)}</div>`}`;
          rechts = `<div class="ueber" style="margin-top:0">${kesc(t.kerzenschein)}</div><div class="inhalt">${this._raster(tagAnfang(d), 1)}</div>`;
        } else if (this._ansicht === "monat") {
          const d = this._datum;
          const erster = new Date(d.getFullYear(), d.getMonth(), 1);
          const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const imMonat = termine.filter((x) => x.start < letzter && x.ende > erster);
          const besondere = imMonat.filter((x) => x.ganz).slice(0, 7);
          const monde = [];
          for (let k = 0; k < 31 && monde.length < 4; k++) {
            const tag = plusTage(erster, k);
            if (tag >= letzter) break;
            const mp = mondphase(new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 12));
            const vor = mondphase(new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() - 1, 12));
            if (mp % 2 === 0 && mp !== vor) monde.push(`<div><span>${MONDZEICHEN[mp]}</span>${tag.getDate()}.</div>`);
          }
          links = `${ZIER}<div class="titel"><div class="gross gold" style="font-size:clamp(28px,3.4vw,40px)">${kesc(t.monate[d.getMonth()])}</div><div class="klein">${roemisch(d.getFullYear())}</div></div>${nav}
            <div class="monde">${monde.join("")}</div>
            <div class="ueber">${kesc(t.besondere)}</div>${besondere.length ? besondere.map((x) => this._eintrag(x, jetzt, neuIds, null).replace('<span class="z">✦</span>', `<span class="z">${x.start.getDate()}.</span>`)).join("") : `<div class="leer">—</div>`}
            <div class="ueber">${kesc(t.zahlen)}</div><div class="leer" style="color:#3a2410;font-size:19px">${imMonat.length} ${kesc(t.termine)}</div>`;
          rechts = `<div class="inhalt">${this._monat(start)}</div>`;
          if (einzeln) { links += rechts; rechts = ""; }
        } else {
          links = titel(ktx.liste, this._titel()) + `<div class="inhalt">${this._liste(start)}</div>`;
        }
        if (einzeln && rechts) { links += rechts; rechts = ""; }
        const zwei = !!rechts;
        const ansichten = [["tag", "#5a1a1a"], ["woche", "#b3262b"], ["monat", "#1d3a66"], ["liste", "#3d4a1e"]].map(([a, f]) =>
          `<button class="band ${this._ansicht === a ? "an" : ""}" data-ansicht="${a}" style="--farbe:${f}">${kesc(ktx[a]).toUpperCase()}</button>`).join("");
        const pers = (this._config.kalender || []).filter((k) => k.slug && k.slug !== "familie" && this._hass.states[k.entity]);
        const aktiv = (window.familienplaner && window.familienplaner.person) || "familie";
        const siegel = this._config.folge_person !== false && pers.length ? `<div class="siegelreihe">
          <button class="sp ${aktiv === "familie" ? "an" : ""}" data-siegel="familie"><span class="siegel" style="--c:#7a5a2a">✦</span><small>${kesc(t.alle)}</small></button>
          ${pers.map((k) => `<button class="sp ${aktiv === k.slug ? "an" : ""}" data-siegel="${kesc(k.slug)}"><span class="siegel" style="--c:${kesc(k.farbe || "#8C7B6B")}">${this._config.figuren !== false ? `<span class="siegelkopf">${figurSvg(figurVon(this._hass, { slug: k.slug, name: k.name, farbe: k.farbe }), "kopf")}</span>` : kesc((k.name || "?").slice(0, 1).toUpperCase())}</span><small>${kesc(k.name)}</small></button>`).join("")}
          <button class="sp eintragen"><span class="siegel" style="--c:#2a2a48">✒</span><small>${kesc(t.eintragen)}</small></button></div>`
          : `<div class="werkzeug"><button class="knopf eintragen">✒ ${kesc(t.eintragen)}</button></div>`;
        const ub = this._umblaettern && zwei ? this._umblaettern : null;
        this._umblaettern = null;
        const blatt = ub ? `<div class="blatt ${ub.richtung > 0 ? "vor" : "zurueck"}"><div class="vs">${ub.vorne}</div><div class="rs"></div></div>` : "";
        this.shadowRoot.innerHTML = `<style>${BASIS}${SIEGEL_CSS}${Basis.CSS}${BUCH_CSS}${FIGUR_CSS}</style>
          <ha-card><div class="buchrahmen">
            <div class="buch">
              <div class="baender">${ansichten}</div>
              <div class="seiten ${zwei ? "" : "einzeln"}">
                <div class="seite l">${links}<div class="fusszeile">~ ${roemisch(Math.max(1, kalenderwoche(start) * 2 - 1))} ~</div></div>
                ${zwei ? `<div class="seite r">${rechts}<div class="fusszeile">~ ${roemisch(kalenderwoche(start) * 2)} ~</div></div>` : ""}
              </div>
              ${zwei ? '<div class="band-lese"></div>' : ""}
              ${blatt}
            </div>
            <div class="siegelplatz">${siegel}</div>
            <button class="neu"></button>
            ${this._config.goldstaub === false ? "" : staub(28)}
          </div></ha-card>
          ${this._dialog ? this._dialogHtml() : ""}`;
        this._verbinden();
      }
      _verbinden() {
        super._verbinden();
        const root = this.shadowRoot;
        root.querySelectorAll("[data-siegel]").forEach((b) => b.addEventListener("click", () => {
          const slug = b.dataset.siegel;
          personSetzen(slug);
          if (!(window.familienplaner && window.familienplaner.personSetzen)) this._zeichnen();
        }));
        root.querySelectorAll(".eintragen").forEach((b) => b.addEventListener("click", () => root.querySelector(".neu").click()));
        root.querySelectorAll(".plus").forEach((b) => b.addEventListener("click", (e) => e.stopPropagation(), { capture: false }));
        const bl = root.querySelector(".blatt");
        if (bl) bl.addEventListener("animationend", () => bl.remove());
      }
      connectedCallback() {
        super.connectedCallback();
        this._personNeu = () => this._zeichnen();
        window.addEventListener("familienplaner-person", this._personNeu);
      }
      disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("familienplaner-person", this._personNeu);
      }
    }
    customElements.define("familienplaner-zauberbuch", Zauberbuch);
  }
  zauberbuchDefinieren();
  if (!customElements.get("familienplaner-zauberbuch")) window.addEventListener("familienplaner-kalender-bereit", zauberbuchDefinieren);

  // ========================================================= Häuser & Kessel
  const HAUSNAMEN = {
    de: ["Sternenlicht", "Mondschein", "Funkenflug", "Waldmoos", "Nebelhorn", "Silberquell", "Bernsteinfeuer", "Eulenruh"],
    en: ["Starlight", "Moonshine", "Sparkflight", "Forestmoss", "Mistpeak", "Silverspring", "Amberfire", "Owlrest"],
  };
  const ZEICHEN = [
    '<path d="M0 -26 L7 -8 L26 -8 L11 4 L17 23 L0 12 L-17 23 L-11 4 L-26 -8 L-7 -8Z"/>',
    '<path d="M8 -24 A26 26 0 1 0 8 24 A20 20 0 1 1 8 -24Z"/>',
    '<path d="M0 -28 C 14 -10, 20 2, 14 16 C 10 26, -10 26, -14 16 C -18 4, -8 -4, -4 -14 C -2 -4, 4 -2, 4 -8 C 6 -14, 2 -22, 0 -28Z"/>',
    '<path d="M0 26 C -22 10, -20 -16, 0 -28 C 20 -16, 22 10, 0 26Z"/>',
    '<path d="M-24 18 L0 -26 L24 18Z M-10 18 L0 0 L10 18"/>',
    '<path d="M0 -26 C 10 -10, 18 0, 18 10 A18 18 0 0 1 -18 10 C -18 0, -10 -10, 0 -26Z"/>',
    '<circle r="22"/><circle r="10" fill="#fff" opacity=".3"/>',
    '<path d="M-20 -8 C -20 -24, 20 -24, 20 -8 L14 22 L-14 22Z"/>',
  ];
  const rennenFinden = (hass, gegeben) => {
    if (gegeben && hass.states[gegeben]) return gegeben;
    return Object.keys(hass.states).find((id) => {
      const a = hass.states[id].attributes;
      return id.startsWith("sensor.") && Array.isArray(a.fahrer) && a.entitaeten && Array.isArray(a.dienste);
    });
  };

  class Haeuser extends HTMLElement {
    setConfig(c) { this._c = { kerzen: [], ...(c || {}) }; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); }
    set hass(h) {
      const alt = this._hass;
      this._hass = h;
      const r = rennenFinden(h, this._c.entity);
      const ids = [r, ...(this._c.kerzen || []).map((k) => (typeof k === "string" ? k : k.entity))].filter(Boolean);
      if (!alt || ids.some((id) => alt.states[id] !== h.states[id])) this._zeichnen();
    }
    getCardSize() { return 8; }
    _zeichnen() {
      const h = this._hass;
      const t = tx(h);
      const r = rennenFinden(h, this._c.entity);
      const kerzen = (this._c.kerzen || []).map((k) => (typeof k === "string" ? { entity: k } : k)).filter((k) => h.states[k.entity]);
      const kerzenHtml = kerzen.length ? `<div class="kerzen">${kerzen.map((k, i) => {
        const s = h.states[k.entity];
        const an = s.state === "on";
        const name = k.name || s.attributes.friendly_name || k.entity;
        return `<button class="kerze ${an ? "an" : ""}" data-e="${esc(k.entity)}" style="--y:${(i % 2) * 14}px;--v:-${(i * 0.7) % 3}s">
          <svg viewBox="0 0 40 80" width="40" height="80">${an ? '<ellipse cx="20" cy="14" rx="16" ry="20" fill="rgba(255,200,90,.35)" style="filter:blur(4px)"/><g class="fl"><path d="M20 2 C 27 12, 26 22, 20 26 C 14 22, 13 12, 20 2Z" fill="#ffd36b"/><path d="M20 10 C 23 16, 22 21, 20 23 C 18 21, 17 16, 20 10Z" fill="#fff6d0"/></g>' : '<path d="M20 22 q 3 -6 0 -12" stroke="rgba(200,200,220,.5)" fill="none" stroke-width="2"/>'}
          <line x1="20" y1="24" x2="20" y2="30" stroke="#333" stroke-width="2"/><rect x="11" y="28" width="18" height="48" rx="3" fill="${an ? "#f4ead2" : "#bdb6a3"}"/><path d="M11 32 q4 6 0 12" fill="#e5d8b5"/></svg>
          <span>${esc(name)}</span></button>`;
      }).join("")}</div>` : "";
      let inhalt = `<div class="hinweis">${esc(t.keine_aufgaben)}</div>`;
      if (r) {
        const a = h.states[r].attributes;
        const fahrer = a.fahrer || [];
        const namen = HAUSNAMEN[de(h) ? "de" : "en"];
        const max = Math.max(...fahrer.map((f) => f.woche || 0), 0);
        const eigene = this._c.haeuser || {};
        inhalt = `<div class="haeuser">${fahrer.map((f, i) => {
          const farbe = f.farbe_hex || "#8C7B6B";
          const pkt = Math.max(0, Number(f.woche) || 0);
          const steine = Math.min(66, Math.round(pkt / (this._c.punkte_pro_stein || 5)));
          let gems = "";
          for (let k = 0; k < steine; k++) {
            const sp = k % 6, reihe = Math.floor(k / 6);
            const x = 50 + sp * 20 + (reihe % 2) * 9 + ((k * 7) % 5), y = 252 - reihe * 16 - ((k * 3) % 4);
            gems += `<path transform="translate(${x} ${y}) rotate(${((k * 37) % 40) - 20})" d="M0 -8 L7 -2 L4 7 L-4 7 L-7 -2Z" fill="${esc(farbe)}" stroke="rgba(255,255,255,.7)" stroke-width="1"/>`;
          }
          const hausname = (eigene[f.slug] && eigene[f.slug].name) || `${t.haus} ${namen[i % namen.length]}`;
          const zeichen = ZEICHEN[((eigene[f.slug] && eigene[f.slug].zeichen) ?? i) % ZEICHEN.length];
          return `<div class="haus">
            <svg viewBox="0 0 200 60" class="banner"><path d="M10 6 h180 v38 l-90 14 l-90 -14z" fill="${esc(farbe)}" stroke="#c9a24a" stroke-width="3"/><text x="100" y="33" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="800" font-size="${hausname.length > 18 ? 13 : 16}" fill="#fff">${esc(hausname)}</text></svg>
            <svg viewBox="0 0 200 300" class="glas">
              <defs><linearGradient id="g${i}" x1="0" x2="1"><stop offset="0" stop-color="rgba(255,255,255,.28)"/><stop offset=".2" stop-color="rgba(255,255,255,.06)"/><stop offset=".8" stop-color="rgba(255,255,255,.04)"/><stop offset="1" stop-color="rgba(255,255,255,.22)"/></linearGradient></defs>
              <ellipse cx="100" cy="270" rx="80" ry="10" fill="${esc(farbe)}" opacity=".35" style="filter:blur(6px)"/>
              <rect x="40" y="18" width="120" height="16" rx="3" fill="#c9a24a" stroke="#6e4f17"/>
              <path d="M48 34 h104 v10 q18 14 18 40 v170 q0 14 -14 14 h-112 q-14 0 -14 -14 v-170 q0 -26 18 -40z" fill="url(#g${i})" stroke="rgba(255,255,255,.55)" stroke-width="2"/>
              ${gems}
              <g transform="translate(100 108)" fill="${esc(farbe)}" stroke="#c9a24a" stroke-width="2" opacity=".95">${zeichen}</g>
              <path d="M58 60 q-8 60 0 180" stroke="rgba(255,255,255,.35)" stroke-width="5" fill="none" stroke-linecap="round"/>
            </svg>
            <div class="zahl gold">${pkt}</div>
            <div class="wer">${esc(f.name)}${max > 0 && pkt === max ? ` · <span class="krone">♛ ${esc(t.fuehrt)}</span>` : ""}</div>
          </div>`;
        }).join("")}</div>`;
      }
      this.shadowRoot.innerHTML = `<style>${BASIS}
        .rahmen { position: relative; padding: 10px 6px 16px; color: var(--z-gold-hell); }
        .kopf { text-align: center; margin-bottom: 8px; }
        .kopf .gross { font: 800 clamp(20px, 2.6vw, 28px) Cinzel, Georgia, serif; letter-spacing: .08em; }
        .kopf .klein { font: italic 600 17px 'Cormorant Garamond', Georgia, serif; color: #e9d3a0; }
        .kerzen { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 6px 10px; margin: 6px 0 16px; }
        .kerze { border: 0; background: none; display: flex; flex-direction: column; align-items: center; transform: translateY(var(--y)); animation: z-schwebe 4s ease-in-out infinite; animation-delay: var(--v); color: #8f88a8; font: 600 14px 'Cormorant Garamond', Georgia, serif; }
        .kerze.an { color: var(--z-gold-hell); }
        .kerze .fl { transform-origin: 20px 26px; animation: z-flacker 2s ease-in-out infinite; }
        @keyframes z-flacker { 30% { transform: scale(.95,1.06) skewX(2deg); } 60% { transform: scale(1.04,.95) skewX(-2deg); } }
        @keyframes z-schwebe { 50% { transform: translateY(calc(var(--y) - 6px)); } }
        .haeuser { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 18px; }
        .haus { text-align: center; }
        .banner { width: 100%; max-width: 240px; display: block; margin: 0 auto; }
        .glas { width: 100%; max-width: 220px; display: block; margin: -4px auto 0; }
        .zahl { font: 800 30px Cinzel, Georgia, serif; margin-top: -8px; }
        .wer { font: 600 17px 'Cormorant Garamond', Georgia, serif; }
        .krone { color: #ffe27a; }
        .hinweis { text-align: center; font-style: italic; padding: 20px; }
      </style><ha-card><div class="rahmen">
        <div class="kopf"><div class="gross gold">${esc(t.pokal)}</div><div class="klein">${esc(t.zuletzt)}</div></div>
        ${kerzenHtml}${inhalt}${staub(18)}</div></ha-card>`;
      this.shadowRoot.querySelectorAll(".kerze").forEach((b) => b.addEventListener("click", () => {
        const e = b.dataset.e;
        this._hass.callService(e.split(".")[0] === "light" ? "light" : "homeassistant", "toggle", { entity_id: e });
      }));
    }
  }

  const REZEPTE = {
    de: [["Sternenstaub", "Rosenblatt", "Drachenpfeffer", "Waldmoos", "Nebeltau", "Mondsilber", "Bernsteinharz", "Eulenfeder"], "Trank"],
    en: [["Stardust", "Rose petal", "Dragon pepper", "Forest moss", "Mist dew", "Moon silver", "Amber resin", "Owl feather"], "Potion"],
  };
  class Kessel extends HTMLElement {
    setConfig(c) { this._c = c || {}; if (!this.shadowRoot) this.attachShadow({ mode: "open" }); }
    set hass(h) {
      const alt = this._hass;
      this._hass = h;
      const r = rennenFinden(h, this._c.entity);
      if (!alt || !r || alt.states[r] !== h.states[r]) this._zeichnen();
    }
    getCardSize() { return 8; }
    _zeichnen() {
      const h = this._hass;
      const t = tx(h);
      const r = rennenFinden(h, this._c.entity);
      if (!r) { this.shadowRoot.innerHTML = `<style>${BASIS}</style><ha-card><div style="padding:20px;color:#f3dfa6">${esc(t.keine_aufgaben)}</div></ha-card>`; return; }
      const a = h.states[r].attributes;
      const fahrer = a.fahrer || [];
      const ziel = Math.max(1, Number(a.familienziel) || 500);
      const stand = Math.max(0, Number(a.familienpunkte) || 0);
      const anteil = Math.min(1, stand / ziel);
      const voll = stand >= ziel;
      const [zutaten, trank] = REZEPTE[de(h) ? "de" : "en"];
      const belohnung = a.familienziel_text || "";
      const ein = (a.entitaeten || {}).familienziel_einloesen;
      const fluessig = 470 - anteil * 70;
      const farbeMix = fahrer.length ? fahrer.map((f) => f.farbe_hex).filter(Boolean) : ["#8a3fd1"];
      const blasen = [...Array(9)].map((_, i) => `<circle class="blase" cx="${520 + ((i * 37) % 240)}" cy="${fluessig}" r="${4 + (i % 4) * 3}" style="animation-delay:-${(i * 0.43).toFixed(2)}s"/>`).join("");
      this.shadowRoot.innerHTML = `<style>${BASIS}
        .buehne { position: relative; display: grid; grid-template-columns: minmax(240px, 1fr) minmax(300px, 1.6fr) minmax(240px, 1fr); gap: 16px; align-items: center; padding: 6px 4px 12px; color: var(--z-gold-hell); }
        @media (max-width: 900px) { .buehne { grid-template-columns: 1fr; } }
        .rezept { position: relative; padding: 22px 24px; transform: rotate(-1.2deg); color: var(--z-tinte); }
        .rezept h3 { margin: 0; text-align: center; font: 800 20px Cinzel, Georgia, serif; letter-spacing: .06em; }
        .rezept .name { text-align: center; font: 600 28px Caveat, cursive; color: #5b2a86; margin: 4px 0 10px; }
        .zeile { display: flex; justify-content: space-between; gap: 8px; font-size: 18px; line-height: 1.7; }
        .zeile b { font-weight: 700; }
        .rezept .hilfe { margin-top: 10px; padding-top: 8px; border-top: 1px solid #8a6a44; font-style: italic; font-size: 15px; color: #6b4f33; }
        svg { width: 100%; height: auto; display: block; overflow: visible; }
        .dampf { animation: z-dampf 6s ease-in-out infinite; transform-origin: 640px 380px; }
        @keyframes z-dampf { 50% { transform: translateY(-14px) scale(1.06); opacity: .25; } }
        .blase { fill: rgba(255,255,255,.75); animation: z-blase 2.4s ease-in infinite; }
        @keyframes z-blase { 0% { transform: translateY(0); opacity: 0; } 30% { opacity: .9; } 100% { transform: translateY(-50px); opacity: 0; } }
        .glut { animation: z-glut 2.2s ease-in-out infinite; }
        @keyframes z-glut { 50% { opacity: .7; } }
        .rechts .titel { font: 600 15px Cinzel, Georgia, serif; letter-spacing: .1em; margin-bottom: 6px; }
        .balken { height: 22px; border-radius: 11px; background: rgba(255,255,255,.12); border: 1px solid #c9a24a; overflow: hidden; }
        .balken div { height: 100%; background: linear-gradient(90deg, ${farbeMix.join(",")}${farbeMix.length === 1 ? "," + farbeMix[0] : ""}); box-shadow: 0 0 14px rgba(200,150,255,.6); }
        .zutat { font-size: 18px; margin-top: 6px; }
        .knopf { margin-top: 14px; border: 0; border-radius: 999px; padding: 10px 18px; font: 700 14px Cinzel, Georgia, serif; letter-spacing: .08em; color: #3a2608;
          background: linear-gradient(180deg, rgba(255,255,255,.4), transparent 45%, rgba(0,0,0,.15)), var(--z-messing); box-shadow: 0 0 0 1px #5a3f10, 0 0 18px rgba(255,210,110,.8); }
        .fertig { font: 800 20px Cinzel, Georgia, serif; color: #ffe9a8; text-shadow: 0 0 12px #ffc94a; margin-top: 10px; }
      </style><ha-card><div class="buehne">
        <div class="rezept pergament">
          <h3>${esc(t.rezept)}</h3>
          <div class="name">${esc(trank)}${belohnung ? `: ${esc(belohnung)}` : ""}</div>
          ${fahrer.map((f, i) => `<div class="zeile"><span>◆ <b style="color:${esc(f.farbe_hex || "#5b2a86")}">${esc(zutaten[i % zutaten.length])}</b> · ${esc(f.name)}</span><span>${Number(f.woche) || 0}</span></div>`).join("")}
          <div class="hilfe">${esc(t.kessel_hilfe)}</div>
        </div>
        <svg viewBox="420 150 440 600">
          <defs>
            <radialGradient id="k-trank" cx="50%" cy="40%"><stop offset="0" stop-color="#d6a6ff"/><stop offset=".6" stop-color="#8a3fd1"/><stop offset="1" stop-color="#3b155f"/></radialGradient>
            <radialGradient id="k-glut" cx="50%" cy="50%"><stop offset="0" stop-color="#ffd27a"/><stop offset=".5" stop-color="#ff7a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff5a00" stop-opacity="0"/></radialGradient>
            <linearGradient id="k-eisen" x1="0" x2="1"><stop offset="0" stop-color="#1a1a1a"/><stop offset=".45" stop-color="#4a4a4a"/><stop offset="1" stop-color="#111"/></linearGradient>
          </defs>
          <ellipse class="glut" cx="640" cy="690" rx="220" ry="60" fill="url(#k-glut)"/>
          <g class="dampf" fill="#c99bff" style="filter:blur(16px)" opacity="${0.15 + anteil * 0.3}"><circle cx="600" cy="${fluessig - 120}" r="40"/><circle cx="660" cy="${fluessig - 170}" r="52"/><circle cx="700" cy="${fluessig - 230}" r="36"/></g>
          <path d="M440 420 Q 430 640 640 660 Q 850 640 840 420 Z" fill="url(#k-eisen)"/>
          <ellipse cx="640" cy="420" rx="210" ry="44" fill="#222" stroke="#555" stroke-width="6"/>
          <ellipse cx="640" cy="${Math.max(fluessig - 46, 424)}" rx="${150 + anteil * 42}" ry="${24 + anteil * 10}" fill="url(#k-trank)" opacity="${0.35 + anteil * 0.65}"/>
          ${blasen.replace(new RegExp(`cy="${fluessig}"`, "g"), `cy="${Math.max(fluessig - 46, 424)}"`)}
          ${voll ? '<g fill="#ffe9a8">' + [...Array(14)].map((_, i) => `<circle cx="${560 + ((i * 53) % 160)}" cy="${330 - ((i * 29) % 120)}" r="${2 + (i % 3)}" style="filter:drop-shadow(0 0 4px #ffc94a)"/>`).join("") + "</g>" : ""}
          <path d="M500 660 l-20 50 M780 660 l20 50 M640 664 v46" stroke="#111" stroke-width="14" stroke-linecap="round"/>
        </svg>
        <div class="rechts">
          <div class="titel">${esc(t.staerke)}</div>
          <div class="balken"><div style="width:${(anteil * 100).toFixed(1)}%"></div></div>
          <div class="zutat">${stand} / ${ziel} ${esc(t.tropfen)}</div>
          ${voll ? `<div class="fertig">✦ ${esc(t.voll)}</div>${ein ? `<button class="knopf" data-e="${esc(ein)}">${esc(t.einloesen)}</button>` : ""}` : ""}
          <div class="titel" style="margin-top:18px">${esc(t.zutaten)}</div>
          ${fahrer.map((f, i) => `<div class="zutat">◆ <b style="color:${esc(f.farbe_hex || "#ccc")}">${esc(f.name)}</b> → ${esc(zutaten[i % zutaten.length])} × ${Math.round((Number(f.woche) || 0) / 10)}</div>`).join("")}
        </div>
        ${staub(16)}
      </div></ha-card>`;
      const k = this.shadowRoot.querySelector(".knopf[data-e]");
      if (k) k.addEventListener("click", () => this._hass.callService("button", "press", { entity_id: k.dataset.e }));
    }
  }

  // ===================================================== Figuren-Galerie & Werkstatt
  class Figuren extends HTMLElement {
    setConfig(c) {
      this._c = { personen: [], ...(c || {}) };
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._sig = "";
    }
    set hass(h) {
      this._hass = h;
      const u = uebersicht(h);
      const r = rennenVon(h);
      const sig = JSON.stringify([u && u.figuren, r && (r.fahrer || []).map((f) => [f.slug, f.gesamt, f.woche]), new Date().getHours()]);
      if (sig !== this._sig) { this._sig = sig; this._zeichnen(); }
    }
    connectedCallback() { this._t = setInterval(() => { this._sig = ""; if (this._hass) this.hass = this._hass; }, 10 * 60000); }
    disconnectedCallback() { clearInterval(this._t); }
    getCardSize() { return 9; }
    _personen() { return (this._c.personen || []).map((p) => ({ ...p, fig: figurVon(this._hass, p) })); }
    _zeichnen() {
      if (!this._hass || !this.shadowRoot) return;
      const t = ft(this._hass);
      const tz = tx(this._hass);
      const leute = this._personen();
      const haus = HAUSNAMEN[de(this._hass) ? "de" : "en"];
      const karten = leute.map((p, i) => {
        const f = p.fig;
        const naechste = RAENGE[f.rang + 1];
        const anteil = naechste ? Math.min(1, (f.punkte - RAENGE[f.rang]) / (naechste - RAENGE[f.rang])) : 1;
        return `<div class="portrait">
          <button class="rahmen" data-i="${i}" title="${esc(t.verwandeln)}"><div class="innen" style="--hell:${hell(f.farbe, 70)};--dunkel:${hell(f.farbe, -95)}">
            <div class="a">${figurSvg(f)}</div><div class="b">${figurSvg(f, "tier")}</div>
            <svg class="rauch" viewBox="0 0 200 250"><g fill="#efe6ff" opacity=".9" style="filter:blur(4px)"><circle cx="80" cy="150" r="34"/><circle cx="120" cy="140" r="38"/><circle cx="100" cy="110" r="30"/><circle cx="70" cy="190" r="26"/><circle cx="132" cy="188" r="28"/></g>
            <g fill="#fff3c4">${[...Array(10)].map((_, k) => `<circle cx="${30 + k * 15}" cy="${70 + ((k * 37) % 140)}" r="${1.5 + (k % 3)}"/>`).join("")}</g></svg>
          </div></button>
          <div class="name">${esc(p.name)}</div>
          <div class="rang">${esc(t.raenge[f.rang])} · ${esc(tz.haus)} ${esc((this._c.haeuser && this._c.haeuser[p.slug] && this._c.haeuser[p.slug].name) || haus[i % haus.length])}</div>
          <div class="fortschritt" title="${f.punkte} ${esc(t.punkte)}"><div style="width:${(anteil * 100).toFixed(0)}%;background:${f.farbe}"></div></div>
          <div class="klein">${f.punkte} ${esc(t.punkte)}${naechste ? ` · ${esc(t.noch)} ${naechste - f.punkte} ${esc(t.bis)} ${esc(t.raenge[f.rang + 1])}` : " ✦"}</div>
          <span class="stimmung">${esc(t.stimmung[f.stimmung] || "")}</span>
          <button class="gestalten" data-slug="${esc(p.slug)}">✎ ${esc(t.gestalten)}</button>
        </div>`;
      }).join("");
      this.shadowRoot.innerHTML = `<style>${BASIS}${FIGUR_CSS}
        ha-card { padding: 4px 0 18px; background: transparent; box-shadow: none; border: 0; }
        h2 { margin: 6px 0 0; text-align: center; font: 800 clamp(22px, 3vw, 32px) 'Cinzel Decorative', Cinzel, Georgia, serif; }
        .unter { text-align: center; color: #e9d3a0; font: italic 600 17px 'Cormorant Garamond', Georgia, serif; margin: 2px 0 18px; }
        .reihe { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 20px; padding: 0 8px; }
        .portrait { text-align: center; color: #f3dfa6; }
        .rahmen { all: unset; display: block; box-sizing: border-box; width: 100%; cursor: pointer; border-radius: 50% 50% 12px 12px / 38% 38% 12px 12px; padding: 9px;
          background: linear-gradient(180deg, #fff3c4, #c9a24a 30%, #7a5214 60%, #e9c46a); box-shadow: 0 14px 26px rgba(0,0,0,.6); }
        .innen { position: relative; border-radius: 50% 50% 8px 8px / 36% 36% 8px 8px; overflow: hidden; aspect-ratio: 200 / 250;
          background: radial-gradient(ellipse at 50% 30%, var(--hell), var(--dunkel)); }
        .innen svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
        .a, .b { position: absolute; inset: 0; transition: opacity .35s, transform .35s; }
        .b { opacity: 0; transform: scale(.6); }
        .rauch { opacity: 0; pointer-events: none; }
        .verwandelt .a { opacity: 0; transform: scale(.6); } .verwandelt .b { opacity: 1; transform: scale(1); }
        .puff .rauch { animation: zf-rauch 1s ease-out; }
        @keyframes zf-rauch { 0% { opacity: 0; transform: scale(.4); } 30% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5); } }
        .name { font: 800 20px Cinzel, Georgia, serif; letter-spacing: .08em; margin-top: 10px; }
        .rang { font: italic 600 16px 'Cormorant Garamond', Georgia, serif; color: #e9d3a0; }
        .fortschritt { height: 8px; margin: 6px auto 2px; max-width: 180px; border-radius: 4px; background: rgba(255,255,255,.12); box-shadow: 0 0 0 1px #8a6a24; overflow: hidden; }
        .fortschritt div { height: 100%; box-shadow: 0 0 8px rgba(255,220,140,.6); }
        .klein { font: 600 13px 'Cormorant Garamond', Georgia, serif; color: #d9c08a; }
        .stimmung { display: inline-block; margin-top: 6px; font: 600 11px Cinzel, Georgia, serif; letter-spacing: .1em; color: #3a2608; background: linear-gradient(180deg, #fff3c4, #d7b25a); border-radius: 999px; padding: 3px 9px; }
        .gestalten, .knopf { display: inline-block; margin: 8px 4px 0; border: 0; border-radius: 999px; padding: 7px 14px; cursor: pointer; font: 700 12px Cinzel, Georgia, serif; letter-spacing: .08em; color: #3a2608;
          background: linear-gradient(180deg, rgba(255,255,255,.4), transparent 45%, rgba(0,0,0,.15)), var(--z-messing); box-shadow: 0 0 0 1px #5a3f10, 0 3px 6px rgba(0,0,0,.45); }
        .werkstatt { display: grid; grid-template-columns: minmax(200px, 300px) 1fr; gap: 22px; margin: 22px 8px 0; padding: 20px; }
        @media (max-width: 700px) { .werkstatt { grid-template-columns: 1fr; } .werkstatt .vor { max-width: 240px; margin: 0 auto; } }
        .werkstatt h3 { grid-column: 1 / -1; margin: 0; text-align: center; font: 800 20px Cinzel, Georgia, serif; color: #5a3a1a; }
        .gruppe h4 { margin: 10px 0 5px; font: 800 13px Cinzel, Georgia, serif; letter-spacing: .12em; color: #5a3a1a; }
        .chips { display: flex; flex-wrap: wrap; gap: 7px; }
        .chip { border: 1px solid #8a6a44; border-radius: 999px; padding: 5px 11px; font: 600 15px 'Cormorant Garamond', Georgia, serif; background: rgba(255,255,255,.35); cursor: pointer; color: var(--z-tinte); }
        .chip.an { background: linear-gradient(180deg, #fff3c4, #d7b25a); border-color: #7a5214; box-shadow: 0 0 0 2px rgba(201,162,74,.35); }
        .chip:disabled { opacity: .45; cursor: not-allowed; }
        .punkt { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px #7a5214; cursor: pointer; padding: 0; }
        .punkt.an { box-shadow: 0 0 0 3px #d7b25a, 0 0 0 4px #7a5214; }
        .aktionen { grid-column: 1 / -1; text-align: center; }
        .hinweis { font: 500 19px Caveat, cursive; color: #5b2a86; text-align: center; margin-top: 6px; }
      </style><ha-card>
        <h2 class="gold">${esc(t.titel)}</h2><div class="unter">${esc(t.unter)}</div>
        <div class="reihe">${karten}</div>
        ${this._bearbeiten ? this._werkstatt() : ""}
        ${staub(18)}
      </ha-card>`;
      const root = this.shadowRoot;
      root.querySelectorAll(".rahmen").forEach((b) => b.addEventListener("click", () => {
        const innen = b.querySelector(".innen");
        innen.classList.remove("puff"); void innen.offsetWidth; innen.classList.add("puff");
        setTimeout(() => innen.classList.toggle("verwandelt"), 280);
        clearTimeout(b._zurueck);
        b._zurueck = setTimeout(() => { innen.classList.remove("puff"); void innen.offsetWidth; innen.classList.add("puff"); setTimeout(() => innen.classList.remove("verwandelt"), 280); }, 6000);
      }));
      root.querySelectorAll(".gestalten").forEach((b) => b.addEventListener("click", () => {
        const p = leute.find((x) => x.slug === b.dataset.slug);
        const { farbe, name, slug, punkte, rang, stimmung, ...aussehen } = p.fig;
        this._bearbeiten = { slug: p.slug, name: p.name, farbe, rang, entwurf: { ...aussehen }, vorschau: "normal" };
        this._zeichnen();
        const w = root.querySelector(".werkstatt");
        if (w) w.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }));
      this._werkstattVerbinden();
    }
    _werkstatt() {
      const t = ft(this._hass);
      const b = this._bearbeiten;
      const o = { ...b.entwurf, farbe: b.farbe, rang: b.rang, stimmung: b.vorschau };
      const farben = (k, liste) => `<div class="gruppe"><h4>${esc(t.gruppen[k])}</h4><div class="chips">${liste.map((f) =>
        `<button class="punkt ${o[k] === f ? "an" : ""}" data-k="${k}" data-v="${f}" style="background:${f}" aria-label="${f}"></button>`).join("")}</div></div>`;
      const wahl = (k) => `<div class="gruppe"><h4>${esc(t.gruppen[k])}</h4><div class="chips">${FIG_WAHL[k].map((v) => {
        const ab = FREI_AB[`${k}:${v}`] || 0;
        const zu = b.rang < ab;
        return `<button class="chip ${o[k] === v ? "an" : ""}" data-k="${k}" data-v="${v}" ${zu ? `disabled title="${esc(t.gesperrt)} ${esc(t.raenge[ab])}"` : ""}>${zu ? "🔒 " : ab ? "✦ " : ""}${esc(t.werte[k][v])}</button>`;
      }).join("")}</div></div>`;
      const stimmungen = `<div class="gruppe"><h4>${esc(de(this._hass) ? "Stimmung (Vorschau)" : "Mood (preview)")}</h4><div class="chips">${["normal", "froh", "gaehnt", "schlaeft"].map((s) =>
        `<button class="chip ${b.vorschau === s ? "an" : ""}" data-vorschau="${s}">${esc(t.stimmung[s])}</button>`).join("")}</div></div>`;
      return `<div class="werkstatt pergament">
        <h3>${esc(t.werkstatt)} · ${esc(b.name)}</h3>
        <div class="vor"><div class="rahmen" style="cursor:default"><div class="innen" style="--hell:${hell(b.farbe, 70)};--dunkel:${hell(b.farbe, -95)}">${figurSvg(o)}</div></div>
          <div class="hinweis">${esc(t.gruppen.tier)}: ${esc(t.werte.tier[o.tier])}</div>
          <div style="max-width:140px;margin:6px auto 0;aspect-ratio:200/250;position:relative">${figurSvg(o, "tier", 'style="width:100%;height:100%"')}</div></div>
        <div>${farben("haut", HAUT)}${farben("haar", HAARE)}${farben("augen", AUGEN)}${wahl("frisur")}${wahl("hut")}${wahl("stab")}${wahl("zeichen")}${wahl("begleiter")}${wahl("tier")}
          <div class="gruppe"><h4>${esc(t.gruppen.brille)}</h4><div class="chips"><button class="chip ${!o.brille ? "an" : ""}" data-k="brille" data-v="false">${esc(t.ohne)}</button><button class="chip ${o.brille ? "an" : ""}" data-k="brille" data-v="true">${esc(t.rund)}</button></div></div>
          ${stimmungen}</div>
        <div class="aktionen"><button class="knopf speichern">✦ ${esc(t.speichern)}</button><button class="knopf abbrechen">${esc(t.abbrechen)}</button>
          ${b.fehler ? `<div class="hinweis" style="color:#a02020">${esc(b.fehler)}</div>` : ""}</div>
      </div>`;
    }
    _werkstattVerbinden() {
      const root = this.shadowRoot;
      const b = this._bearbeiten;
      if (!b) return;
      root.querySelectorAll(".werkstatt [data-k]").forEach((el) => el.addEventListener("click", () => {
        let v = el.dataset.v;
        if (v === "true") v = true; else if (v === "false") v = false;
        b.entwurf[el.dataset.k] = v;
        this._zeichnen();
      }));
      root.querySelectorAll(".werkstatt [data-vorschau]").forEach((el) => el.addEventListener("click", () => { b.vorschau = el.dataset.vorschau; this._zeichnen(); }));
      const ab = root.querySelector(".werkstatt .abbrechen");
      if (ab) ab.addEventListener("click", () => { this._bearbeiten = null; this._zeichnen(); });
      const sp = root.querySelector(".werkstatt .speichern");
      if (sp) sp.addEventListener("click", async () => {
        const daten = { person: b.slug };
        for (const k of ["haut", "haar", "augen", ...Object.keys(FIG_WAHL), "brille"]) if (b.entwurf[k] !== undefined) daten[k] = b.entwurf[k];
        try {
          await this._hass.callService("familienplaner", "figur_setzen", daten);
          this._bearbeiten = null;
          this._sig = "";
          this._zeichnen();
        } catch (e) {
          b.fehler = (e && e.message) || String(e);
          this._zeichnen();
        }
      });
    }
  }

  // ================================================ Zauberrahmen für normale Karten
  // Legt eine beliebige Karte (Aufgabenliste, Überschrift, Kalender, Rennstrecke …) auf
  // Pergament mit Goldrand, damit auch die übrigen Seiten im Stil Zauberwelt erscheinen.
  let kartenHelfer = null;
  class Zauberrahmen extends HTMLElement {
    setConfig(c) {
      if (!c || !c.karte) throw new Error("karte fehlt");
      this._c = c;
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._kind = null;
      this._bauen();
    }
    set hass(h) { this._hass = h; if (this._kind) this._kind.hass = h; }
    getCardSize() { return this._kind && this._kind.getCardSize ? this._kind.getCardSize() : 3; }
    getGridOptions() { return this._kind && this._kind.getGridOptions ? this._kind.getGridOptions() : { columns: 12 }; }
    async _bauen() {
      const k = this._c.karte;
      const ueberschrift = k.type === "heading";
      const ohneRahmen = ueberschrift || this._c.rahmen === false;
      this.shadowRoot.innerHTML = `<style>${BASIS}
        :host { display: block;
          --primary-text-color: ${ueberschrift ? "#f3dfa6" : "#3b2a1a"}; --secondary-text-color: ${ueberschrift ? "#d9c08a" : "#6b4f33"};
          --primary-color: #8a5a1c; --accent-color: #b3262b; --state-icon-color: #7a5214; --divider-color: rgba(122,82,20,.35);
          --ha-card-background: transparent; --card-background-color: transparent; --ha-card-box-shadow: none; --ha-card-border-width: 0;
          --mdc-theme-primary: #8a5a1c; --mdc-checkbox-unchecked-color: #7a5214; --input-fill-color: rgba(255,255,255,.35);
          --ha-font-family-body: 'Cormorant Garamond', Georgia, serif; --mdc-typography-font-family: 'Cormorant Garamond', Georgia, serif;
          --ha-font-size-m: 17px; --paper-font-body1_-_font-family: 'Cormorant Garamond', Georgia, serif;
          --ha-card-header-font-family: Cinzel, Georgia, serif; --ha-card-header-color: #5a3a1a; }
        .blatt { position: relative; padding: 4px; border-radius: 6px; font-family: 'Cormorant Garamond', Georgia, serif; }
        .blatt.mit { box-shadow: 0 14px 30px rgba(0,0,0,.55), inset 0 0 50px rgba(120,80,30,.35), 0 0 0 1px #8a6a24, 0 0 0 4px rgba(215,178,90,.55), 0 0 0 5px #5a3f10; }
        .blatt.mit::before, .blatt.mit::after { content: "✦"; position: absolute; top: 4px; color: #a07a2a; font-size: 13px; }
        .blatt.mit::before { left: 8px; } .blatt.mit::after { right: 8px; }
        .ueber { padding: 6px 2px 0; }
      </style><div class="blatt ${ohneRahmen ? (ueberschrift ? "ueber" : "") : "mit pergament"}"></div>`;
      try {
        if (!kartenHelfer) kartenHelfer = await window.loadCardHelpers();
        const el = kartenHelfer.createCardElement(k);
        el.addEventListener("ll-rebuild", (e) => { e.stopPropagation(); this._bauen(); });
        if (this._hass) el.hass = this._hass;
        this._kind = el;
        this.shadowRoot.querySelector(".blatt").appendChild(el);
      } catch (e) {
        this.shadowRoot.querySelector(".blatt").textContent = String(e);
      }
    }
  }

  const def = (n, k) => { if (!customElements.get(n)) customElements.define(n, k); };
  def("familienplaner-zauberkopf", Zauberkopf);
  def("familienplaner-zauberuhr", Zauberuhr);
  def("familienplaner-zauberkarte", Zauberkarte);
  def("familienplaner-haeuser", Haeuser);
  def("familienplaner-kessel", Kessel);
  def("familienplaner-figuren", Figuren);
  def("familienplaner-zauberrahmen", Zauberrahmen);
  window.customCards = window.customCards || [];
  for (const [type, name] of [["familienplaner-zauberuhr", "Familienplaner: Familienuhr"], ["familienplaner-zauberkarte", "Familienplaner: Familienkarte"], ["familienplaner-zauberbuch", "Familienplaner: Zauberbuch"], ["familienplaner-haeuser", "Familienplaner: Häuser"], ["familienplaner-kessel", "Familienplaner: Familienkessel"], ["familienplaner-figuren", "Familienplaner: Zauberer-Figuren"]]) {
    if (!window.customCards.some((c) => c.type === type)) window.customCards.push({ type, name, description: "Stil Zauberwelt" });
  }
})();
