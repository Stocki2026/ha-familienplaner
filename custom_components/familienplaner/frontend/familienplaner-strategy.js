/*
 * Familienplaner – Dashboard-Strategie
 *
 * Baut das komplette Familien-Dashboard automatisch aus der Einrichtung der
 * Integration (Personen, Farben, Kalender, Listen). Neue Person in der
 * Integration anlegen -> erscheint automatisch im Dashboard.
 *
 * Verwendung: neues Dashboard anlegen, Rohkonfiguration:
 *   strategy:
 *     type: custom:familienplaner
 *     # optional:
 *     # theme: Familienkalender
 *     # hacs_karten: true   (week-planner-card / calendar-card-pro statt der eigenen Kalenderkarte)
 *     # tablet:             (Wand-Tablet-Modus, aktiv nach einmaligem Öffnen mit ?wand=1)
 *     #   leerlauf: 5                      Minuten bis zum Bildschirmschoner
 *     #   fotos: media-source://media_source/local/fotos   (oder Liste von Bild-URLs)
 *     #   bewegung: binary_sensor.flur_bewegung
 *     #   helligkeit: number.wandtablet_screen_brightness  (z. B. Fully Kiosk)
 *     #   nacht_von: "22:00"  nacht_bis: "06:00"
 *     # cockpit:            (Ansicht „Cockpit“: lebendiger Himmel + 24-Stunden-Tagesring)
 *     #   zuerst: true                     Cockpit als erste Ansicht (Startseite)
 *     #   polarlicht: false  leistung: sparsam   (false statt Optionen blendet die Ansicht aus)
 */

const VERSION = "0.1.0";

function findeUebersicht(hass) {
  const ids = Object.keys(hass.states).filter((id) => id.startsWith("sensor."));
  const reg = hass.entities || {};
  const treffer = ids.find((id) => reg[id] && reg[id].platform === "familienplaner" && hass.states[id].attributes.personen);
  return treffer || ids.find((id) => hass.states[id].attributes.personen && hass.states[id].attributes.formular);
}

async function karteVerfuegbar(name, warten = 1500) {
  if (customElements.get(name)) return true;
  try {
    await Promise.race([customElements.whenDefined(name), new Promise((_, rej) => setTimeout(rej, warten))]);
    return true;
  } catch (e) {
    return false;
  }
}

const markdownKopf = {
  type: "markdown",
  text_only: true,
  content:
    "{% set tage = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'] %}" +
    "{% set monate = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'] %}" +
    "{% set h = now().hour %}\n" +
    "<h1>{{ now().strftime('%H:%M') }}</h1>\n" +
    "<h2>{{ tage[now().weekday()] }}, {{ now().day }}. {{ monate[now().month - 1] }}</h2>\n" +
    "{% if h < 11 %}Guten Morgen{% elif h < 17 %}Schönen Tag{% elif h < 22 %}Guten Abend{% else %}Gute Nacht{% endif %} · KW {{ now().isocalendar()[1] }}",
  card_mod: {
    style: {
      "ha-markdown$":
        "h1 { font-size: 84px; font-weight: 300; letter-spacing: -3px; line-height: 1; margin: 4px 0 6px; }" +
        "h2 { font-size: 26px; font-weight: 600; margin: 0 0 4px; }",
    },
  },
};

function personKachel(p) {
  return {
    type: "tile",
    entity: p.sensor,
    name: p.name,
    icon: "mdi:account",
    color: p.farbe,
    vertical: false,
    state_content: ["state", "wann", "wo"],
    tap_action: { action: "more-info" },
    card_mod: { style: `ha-card { border-left: 6px solid ${p.farbe}; }` },
  };
}

function formularKarte(u, titel = "Neuer Termin") {
  const f = u.formular || {};
  return {
    type: "entities",
    title: titel,
    icon: "mdi:calendar-plus",
    state_color: true,
    entities: [
      ...(f.satz ? [{ entity: f.satz, name: "Schnell: alles in einem Satz" }, { type: "section", label: "oder einzeln" }] : []),
      { entity: f.person, name: "Für wen?" },
      { entity: f.titel, name: "Was?" },
      { entity: f.start, name: "Wann?" },
      { entity: f.dauer, name: "Dauer" },
      { entity: f.ganztag, name: "Ganztägig" },
      { entity: f.ort, name: "Wo?" },
      { entity: f.fahrer, name: "Wer fährt?" },
      { type: "button", entity: f.anlegen, name: "Termin anlegen", action_name: "Anlegen" },
    ].filter((e) => e.entity),
  };
}

function pinnwandKarte(u) {
  const s = u.sensoren && u.sensoren.pinnwand;
  if (!s) return null;
  return {
    type: "markdown",
    content:
      "## 📌 Pinnwand\n" +
      `{% for n in state_attr('${s}', 'notizen') or [] %}\n> {{ n }}\n\n{% else %}\nNoch keine Notizen – einfach in die Liste „Pinnwand“ schreiben.\n{% endfor %}`,
    card_mod: {
      style: {
        "ha-markdown$":
          "blockquote { background: #FFF1B8; color: #4A3F1C; border: none; border-radius: 10px; padding: 10px 14px; margin: 8px 0; font-size: 17px; box-shadow: 0 2px 6px rgba(0,0,0,.08); }",
      },
    },
  };
}

function countdownKarte(u) {
  const s = u.sensoren && u.sensoren.countdowns;
  if (!s) return null;
  return {
    type: "markdown",
    content:
      "## ⏳ Countdowns\n" +
      `{% for c in state_attr('${s}', 'liste') or [] %}\n**{{ c.text }}** · {{ c.titel }}\n\n{% else %}\nGeburtstage und Urlaube im Kalender „Besondere Tage“ eintragen.\n{% endfor %}`,
  };
}

function alleKalender(u) {
  const liste = [];
  if (u.familie.kalender) liste.push({ entity: u.familie.kalender, name: "Familie", color: u.familie.farbe, icon: "mdi:home-heart" });
  for (const p of u.personen) if (p.kalender) liste.push({ entity: p.kalender, name: p.name, color: p.farbe, icon: "mdi:account" });
  const k = u.kalender || {};
  const extra = [
    [k.feiertage, "Feiertage", "#9AA0A6", "mdi:party-popper"],
    [k.besondere_tage, "Besondere Tage", "#C99A3E", "mdi:cake-variant"],
    [k.essensplan, "Essen", "#B8A07E", "mdi:silverware-fork-knife"],
    [k.muellabfuhr, "Müll", "#6E7B85", "mdi:trash-can-outline"],
    [k.schulferien, "Schulferien", "#4FB3BF", "mdi:beach"],
  ];
  for (const [entity, name, color, icon] of extra) if (entity) liste.push({ entity, name, color, icon });
  return liste;
}

function wochenKarte(u, hacs) {
  const kal = alleKalender(u);
  if (hacs.week) {
    return {
      type: "custom:week-planner-card",
      locale: "de",
      days: 7,
      startingDay: "today",
      showNavigation: true,
      showLegend: true,
      legendToggle: true,
      showLocation: true,
      combineSimilarEvents: true,
      maxDayEvents: 6,
      dateFormat: "cccc, d. LLL",
      columns: { extraLarge: 7, large: 7, medium: 4, small: 2, extraSmall: 1 },
      weather: u.wetter ? { entity: u.wetter, showCondition: true, showTemperature: true, showLowTemperature: true } : undefined,
      texts: {
        fullDay: "Ganztägig", noEvents: "Keine Termine", moreEvents: "weitere Termine", today: "Heute", tomorrow: "Morgen",
        yesterday: "Gestern", monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch", thursday: "Donnerstag",
        friday: "Freitag", saturday: "Samstag", sunday: "Sonntag",
      },
      calendars: kal,
    };
  }
  return { type: "calendar", initial_view: "listWeek", entities: kal.map((k) => k.entity) };
}

function kalenderListe(u, nurPerson) {
  const liste = [];
  const fam = u.familie.kalender ? { entity: u.familie.kalender, name: "Familie", farbe: u.familie.farbe, slug: "familie" } : null;
  if (nurPerson) {
    if (nurPerson.kalender) liste.push({ entity: nurPerson.kalender, name: nurPerson.name, farbe: nurPerson.farbe, slug: nurPerson.slug });
    if (fam) liste.push(fam);
    return liste;
  }
  if (fam) liste.push(fam);
  for (const p of u.personen || []) if (p.kalender) liste.push({ entity: p.kalender, name: p.name, farbe: p.farbe, slug: p.slug });
  for (const k of alleKalender(u)) if (!liste.some((x) => x.entity === k.entity)) liste.push({ entity: k.entity, name: k.name, farbe: k.color });
  return liste;
}

function eigeneKarte(u, ansicht, extra = {}) {
  return { type: "custom:familienplaner-kalender", ansicht, kalender: kalenderListe(u, extra.person), ...(extra.titel ? { titel: extra.titel } : {}), ...(extra.person ? { folge_person: false } : {}) };
}

function agendaKarte(hacs, entities, titel, tage = 7) {
  if (hacs.agenda) {
    return {
      type: "custom:calendar-card-pro",
      title: titel,
      language: "de",
      days_to_show: tage,
      compact_days_to_show: Math.min(tage, 3),
      time_24h: true,
      show_location: true,
      event_background_opacity: 15,
      entities: entities.map((e) => ({ entity: e.entity, color: e.color })),
    };
  }
  return { type: "calendar", title: titel, initial_view: "listWeek", entities: entities.map((e) => e.entity) };
}

class FamilienplanerStrategy extends HTMLElement {
  static async generate(config, hass) {
    const id = findeUebersicht(hass);
    if (!id) {
      return {
        title: "Familienplaner",
        views: [{ title: "Familienplaner", cards: [{ type: "markdown", content: "## Familienplaner\nDie Integration ist noch nicht eingerichtet oder konnte nicht starten.\n\n- Einrichten: *Einstellungen → Geräte & Dienste → Integration hinzufügen → Familienplaner*\n- Fehler ansehen: *Einstellungen → System → Protokolle* (nach „familienplaner“ suchen)\n\n*Not set up yet or failed to start – see Settings → System → Logs.*" }] }],
      };
    }
    const u = hass.states[id].attributes;
    const nutzeHacs = config.hacs_karten === true;
    const hacs = {
      week: nutzeHacs && (await karteVerfuegbar("week-planner-card")),
      agenda: nutzeHacs && (await karteVerfuegbar("calendar-card-pro")),
    };
    const schoen = await karteVerfuegbar("familienplaner-kopf");
    // Eigene Kalenderkarte ist Standard; HACS-Karten nur noch, wenn ausdrücklich gewünscht
    const eigen = config.hacs_karten !== true && (await karteVerfuegbar("familienplaner-kalender"));
    const themen = (hass.themes && hass.themes.themes) || {};
    const theme = config.theme || (themen.Familienkalender ? "Familienkalender" : undefined);
    const personen = u.personen || [];
    const famKal = u.familie.kalender ? [{ entity: u.familie.kalender, color: u.familie.farbe }] : [];
    const s = u.sensoren || {};

    // ----------------------------------------------------------- Woche (Wand)
    const kopf = schoen ? [{ type: "custom:familienplaner-kopf", wetter: u.wetter, muell: s.muell, ferien: s.ferien, konflikte: s.konflikte }] : [markdownKopf];
    if (u.wetter) kopf.push({ type: "weather-forecast", entity: u.wetter, show_current: !schoen, show_forecast: true, forecast_type: "daily" });
    const personenKarte = (liste, auswahl = false) => schoen
      ? { type: "custom:familienplaner-personen", auswahl, personen: liste.filter((p) => p.sensor).map((p) => ({ slug: p.slug, sensor: p.sensor, name: p.name, farbe: p.farbe, person: p.person })) }
      : { type: "grid", columns: Math.max(1, Math.min(liste.length, 5)), square: false, cards: liste.filter((p) => p.sensor).map((p) => personKachel(p)) };
    const extras = schoen
      ? [s.pinnwand && { type: "custom:familienplaner-pinnwand", entity: s.pinnwand, liste: u.listen && u.listen.pinnwand }, s.countdowns && { type: "custom:familienplaner-countdowns", entity: s.countdowns }].filter(Boolean)
      : [pinnwandKarte(u), countdownKarte(u)].filter(Boolean);
    const kacheln = [];
    if (s.muell && !schoen) kacheln.push({ type: "tile", entity: s.muell, name: "Müllabfuhr", icon: "mdi:trash-can-outline", color: "grey" });
    if (s.ferien && !schoen) kacheln.push({ type: "tile", entity: s.ferien, name: "Schulferien", icon: "mdi:beach", color: "cyan" });
    if (u.ansage) kacheln.push({ type: "tile", entity: u.ansage, name: "Alexa: Was steht heute an?", icon: "mdi:account-voice", color: "primary", hide_state: true, tap_action: { action: "perform-action", perform_action: "button.press", target: { entity_id: u.ansage } } });

    const woche = {
      title: "Woche",
      path: "woche",
      icon: "mdi:calendar-week",
      type: "panel",
      theme,
      cards: [
        {
          type: "vertical-stack",
          cards: [
            { type: "grid", columns: 2, square: false, cards: kopf },
            personenKarte(personen, schoen),
            ...(schoen ? [{
              type: "custom:familienplaner-fokus",
              personen: personen.map((p) => ({ slug: p.slug, name: p.name, farbe: p.farbe, person: p.person, sensor: p.sensor, kalender: p.kalender, liste: p.liste })),
              familie: { kalender: u.familie.kalender, liste: u.familie.liste },
            }] : []),
            eigen ? eigeneKarte(u, "woche") : wochenKarte(u, hacs),
            { type: "custom:familienplaner-wand", personen: personen.filter((p) => p.sensor).map((p) => ({ sensor: p.sensor, name: p.name, farbe: p.farbe })), ...(config.tablet || {}) },
            { type: "grid", columns: 3, square: false, cards: [...extras, { type: "vertical-stack", cards: [schoen && u.formular && u.formular.satz ? { type: "custom:familienplaner-schnell" } : formularKarte(u), ...kacheln] }] },
          ],
        },
      ],
    };

    // -------------------------------------------------------- Mein Bereich (Handy)
    const sections = [
      {
        type: "grid",
        cards: [
          { type: "markdown", text_only: true, content: "## Hallo {{ user }} 👋\n{% set tage = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'] %}{{ tage[now().weekday()] }}, {{ now().day }}.{{ now().month }}." },
          formularKarte(u),
        ],
      },
    ];
    for (const p of personen) {
      const karten = [];
      if (p.sensor) karten.push(schoen ? personenKarte([p]) : personKachel(p));
      karten.push({ type: "heading", heading: "Meine Termine", icon: "mdi:calendar-account" });
      karten.push(eigen ? eigeneKarte(u, "liste", { person: p }) : agendaKarte(hacs, [...(p.kalender ? [{ entity: p.kalender, color: p.farbe }] : []), ...famKal], undefined, 7));
      if (p.liste) {
        karten.push({ type: "heading", heading: "Meine Aufgaben", icon: "mdi:checkbox-marked-circle-outline" });
        karten.push({ type: "todo-list", entity: p.liste });
      }
      const sec = { type: "grid", cards: karten };
      if (p.user_id) sec.visibility = [{ condition: "user", users: [p.user_id] }];
      else karten.unshift({ type: "heading", heading: p.name, icon: "mdi:account" });
      sections.push(sec);
    }
    const gemeinsam = [];
    if (u.familie.liste) gemeinsam.push({ type: "todo-list", entity: u.familie.liste, title: "Familie" });
    if (u.listen && u.listen.einkauf) gemeinsam.push({ type: "todo-list", entity: u.listen.einkauf, title: "Einkauf" });
    if (u.listen && u.listen.pinnwand) gemeinsam.push({ type: "todo-list", entity: u.listen.pinnwand, title: "Pinnwand" });
    if (gemeinsam.length) sections.push({ type: "grid", cards: [{ type: "heading", heading: "Gemeinsam", icon: "mdi:home-heart" }, ...gemeinsam] });
    const mein = { title: "Mein Bereich", path: "mein-bereich", icon: "mdi:cellphone-text", type: "sections", max_columns: 3, theme, sections };

    // ------------------------------------------------------------------ Familie
    const familie = {
      title: "Familie",
      path: "familie",
      icon: "mdi:account-group",
      type: "sections",
      max_columns: Math.max(1, Math.min(personen.length, 4)),
      theme,
      sections: personen.map((p) => ({
        type: "grid",
        cards: [
          schoen && p.sensor ? personenKarte([p]) : { type: "heading", heading: p.name, icon: "mdi:account" },
          eigen ? eigeneKarte(u, "liste", { person: p }) : agendaKarte(hacs, [...(p.kalender ? [{ entity: p.kalender, color: p.farbe }] : []), ...famKal], undefined, 7),
        ],
      })),
    };

    const views = [woche, mein, familie];

    // ------------------------------------------------------------------ Cockpit
    if (config.cockpit !== false && (await karteVerfuegbar("familienplaner-cockpit"))) {
      const { zuerst, ...optionen } = config.cockpit && typeof config.cockpit === "object" ? config.cockpit : {};
      const cockpit = {
        title: "Cockpit",
        path: "cockpit",
        icon: "mdi:orbit",
        type: "panel",
        theme,
        cards: [{
          type: "custom:familienplaner-cockpit",
          personen: personen.map((p) => ({ slug: p.slug, name: p.name, farbe: p.farbe, person: p.person, sensor: p.sensor, kalender: p.kalender })),
          familie: { name: u.familie.name, kalender: u.familie.kalender, farbe: u.familie.farbe },
          wetter: u.wetter,
          ...optionen,
        }],
      };
      if (zuerst) views.unshift(cockpit);
      else views.splice(1, 0, cockpit);
    }

    // -------------------------------------------------------------------- Essen
    if (u.kalender && u.kalender.essensplan) {
      views.push({
        title: "Essen",
        path: "essen",
        icon: "mdi:silverware-fork-knife",
        type: "sections",
        max_columns: 2,
        theme,
        sections: [
          { type: "grid", cards: [{ type: "heading", heading: "Essensplan", icon: "mdi:silverware-fork-knife" }, agendaKarte(hacs, [{ entity: u.kalender.essensplan, color: "#B8A07E" }], undefined, 7)] },
          ...(u.listen && u.listen.einkauf ? [{ type: "grid", cards: [{ type: "heading", heading: "Einkaufsliste", icon: "mdi:cart-outline" }, { type: "todo-list", entity: u.listen.einkauf }] }] : []),
        ],
      });
    }

    // -------------------------------------------------------------------- Monat
    views.push({
      title: "Monat",
      path: "monat",
      icon: "mdi:calendar-month",
      type: "panel",
      theme,
      cards: [eigen ? eigeneKarte(u, "monat") : { type: "calendar", initial_view: "dayGridMonth", entities: alleKalender(u).map((k) => k.entity) }],
    });

    // Erweiterungen (z. B. Aufgaben/Punkte) können eigene Views anhängen
    for (const erweiterung of window.familienplanerViews || []) {
      try {
        const v = await erweiterung(u, hass, { theme, hacs });
        if (v) views.push(...(Array.isArray(v) ? v : [v]));
      } catch (e) {
        console.warn("Familienplaner: Erweiterung fehlgeschlagen", e);
      }
    }

    return { title: u.familie.name || "Familienplaner", views };
  }
}

customElements.define("ll-strategy-dashboard-familienplaner", FamilienplanerStrategy);
window.customStrategies = window.customStrategies || [];
if (!window.customStrategies.some((s) => s.type === "familienplaner")) {
  window.customStrategies.push({
    type: "familienplaner",
    strategyType: "dashboard",
    name: "Familienplaner",
    description: "Familienkalender, Termine, Aufgaben und Erinnerungen – baut sich automatisch.",
    documentationURL: "https://github.com/Stocki2026/ha-familienplaner",
  });
}
console.info(`%c FAMILIENPLANER %c ${VERSION} `, "color:#fff;background:#5F7F63;font-weight:700", "color:#5F7F63");
