/*
 * Familienplaner – Ansicht „Aufgaben“ (Punkte, Familien-Rennen, Haushalt, Belohnungen)
 *
 * Hängt sich an die Dashboard-Strategie „custom:familienplaner“ an und baut die Ansicht
 * komplett aus den Daten der Integration. Keine Konfiguration nötig.
 */

(() => {
  const BLAU = "#5F7F63";

  function entities(hass, domain) {
    const reg = hass.entities || {};
    return Object.keys(hass.states).filter(
      (id) => id.startsWith(domain + ".") && (!Object.keys(reg).length || (reg[id] && reg[id].platform === "familienplaner"))
    );
  }

  function finde(hass, domain, name) {
    return entities(hass, domain).find((id) => {
      const fn = (hass.states[id].attributes.friendly_name || "").toLowerCase();
      return fn === name.toLowerCase() || fn.endsWith(" " + name.toLowerCase());
    });
  }

  function aufgabenView(u, hass, { theme }) {
    const rennen = entities(hass, "sensor").find((id) => {
      const a = hass.states[id].attributes;
      return Array.isArray(a.fahrer) && a.ziel !== undefined && Array.isArray(a.dienste);
    });
    if (!rennen) return null;
    const a = hass.states[rennen].attributes;
    const fahrer = a.fahrer || [];
    const sections = [];

    // --- Begrüßung + Rennstrecke --------------------------------------------------
    sections.push({
      type: "grid",
      column_span: 4,
      cards: [
        {
          type: "markdown",
          text_only: true,
          content:
            `{% set f = state_attr('${rennen}', 'fahrer') | selectattr('name', 'eq', user) | list %}` +
            "## Hallo {{ user }} 🏁\n" +
            "{% if f %}{% set f = f[0] %}Du hast **{{ f.konto }} Punkte** auf dem Konto" +
            "{% if f.heute %} und heute schon **{{ f.heute }} {{ 'Aufgabe' if f.heute == 1 else 'Aufgaben' }}** geschafft{% endif %}." +
            "{% if f.serie >= 2 %} 🔥 {{ f.serie }} Tage in Folge!{% endif %}" +
            "{% else %}Hake Aufgaben ab und sammle Punkte fürs Familien-Rennen.{% endif %}\n" +
            "Tipp: Schreib „+20“ in den Titel einer Aufgabe, dann bringt sie 20 Punkte. Tippe auf dein Fahrzeug, um es umzubauen.",
        },
        { type: "custom:rennstrecke-card", entity: rennen },
      ],
    });

    // --- Aufgaben pro Person --------------------------------------------------------
    for (const f of fahrer) {
      if (!f.liste) continue;
      const punkte = entities(hass, "sensor").find(
        (id) => hass.states[id].attributes.level_name !== undefined &&
          (hass.states[id].attributes.friendly_name || "").endsWith(`Punkte ${f.name}`)
      );
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: f.name,
            icon: "mdi:account",
            badges: punkte ? [{ type: "entity", entity: punkte, color: f.farbe_hex, show_icon: true }] : [],
          },
          { type: "todo-list", entity: f.liste, hide_completed: false },
        ],
      });
    }

    // --- Haushalt heute + Familienliste --------------------------------------------
    const haushalt = finde(hass, "sensor", "Haushalt heute");
    const hausKarten = [{ type: "heading", heading: "Haushalt heute", icon: "mdi:home-heart" }];
    if (haushalt) {
      hausKarten.push({
        type: "markdown",
        text_only: true,
        content:
          `{% set d = state_attr('${haushalt}', 'dienste') or [] %}` +
          "{% for x in d %}{% if x.heute_dran %}**{{ x.titel }}** · {{ x.zuletzt or 'noch nicht verteilt' }} · {{ x.punkte }} Punkte\n\n{% endif %}{% endfor %}" +
          "{% if not (d | selectattr('heute_dran') | list) %}Heute stehen keine Dienste an.{% endif %}",
      });
    }
    if (a.familien_liste) {
      hausKarten.push({ type: "heading", heading: "Familie", heading_style: "subtitle", icon: "mdi:home-heart" });
      hausKarten.push({ type: "todo-list", entity: a.familien_liste, hide_completed: false });
    }
    sections.push({ type: "grid", column_span: 2, cards: hausKarten });

    // --- Belohnungs-Shop -------------------------------------------------------------
    const shop = [
      { type: "heading", heading: "Belohnungs-Shop", icon: "mdi:gift-outline" },
      {
        type: "markdown",
        text_only: true,
        content:
          `{% set f = state_attr('${rennen}', 'fahrer') | selectattr('name', 'eq', user) | list %}` +
          "{% if f %}Dein Konto: **{{ f[0].konto }} Punkte**. {% endif %}" +
          "Tippen zum Einlösen. Die Punkte werden abgebucht und in der Familienliste erscheint eine Aufgabe für die Eltern.",
      },
    ];
    for (const b of a.belohnungen || []) {
      shop.push({
        type: "button",
        name: `${b.name} · ${b.kosten}`,
        icon: b.icon || "mdi:gift-outline",
        show_state: false,
        grid_options: { columns: 4, rows: 2 },
        tap_action: {
          action: "perform-action",
          perform_action: "familienplaner.belohnung_einloesen",
          data: { belohnung: b.name, kosten: b.kosten },
          confirmation: { text: `${b.name} für ${b.kosten} Punkte einlösen?` },
        },
      });
    }
    sections.push({ type: "grid", column_span: 2, cards: shop });

    // --- Eltern-Bereich: Personen, die nicht bei der Rotation mitmachen ---------------
    const eltern = fahrer.filter((f) => !f.rotation && f.user_id).map((f) => f.user_id);
    const e = (domain, name) => finde(hass, domain, name);
    const regeln = [
      e("number", "Punkte pro Aufgabe"),
      e("number", "Rennen: Ziellinie"),
      e("number", "Serien-Bonus pro Tag"),
      e("number", "Sieger-Bonus"),
      e("number", "Familienziel"),
      e("text", "Familienziel: Belohnung"),
      e("button", "Neues Rennen starten"),
      e("button", "Familienziel einlösen"),
    ].filter(Boolean);
    const rotation = [
      e("switch", "Haushalts-Rotation"),
      e("time", "Haushalts-Rotation Uhrzeit"),
      e("button", "Dienste jetzt verteilen"),
    ].filter(Boolean);
    const elternKarten = [{ type: "heading", heading: "Eltern-Bereich", icon: "mdi:shield-account-outline" }];
    for (const f of fahrer) {
      elternKarten.push({
        type: "button",
        name: `${f.name} +10`,
        icon: "mdi:star-plus-outline",
        show_state: false,
        grid_options: { columns: 3, rows: 1 },
        tap_action: {
          action: "perform-action",
          perform_action: "familienplaner.punkte_buchen",
          data: { person: f.slug, punkte: 10 },
        },
      });
    }
    if (regeln.length) elternKarten.push({ type: "entities", title: "Spielregeln", grid_options: { columns: 6 }, entities: regeln });
    if (rotation.length) {
      elternKarten.push({ type: "entities", title: "Haushalts-Rotation", grid_options: { columns: 6 }, entities: rotation });
    }
    const elternSec = { type: "grid", column_span: 4, cards: elternKarten };
    // Ohne festgelegte Eltern (alle machen bei der Rotation mit) ist der Bereich für alle sichtbar.
    if (eltern.length) elternSec.visibility = [{ condition: "user", users: eltern }];
    sections.push(elternSec);

    return {
      title: "Aufgaben",
      path: "aufgaben",
      icon: "mdi:trophy-variant-outline",
      type: "sections",
      max_columns: 4,
      theme,
      sections,
    };
  }

  window.familienplanerViews = window.familienplanerViews || [];
  if (!window.familienplanerViews.includes(aufgabenView)) window.familienplanerViews.push(aufgabenView);
  console.info("%c FAMILIENPLANER %c Aufgaben ", `color:#fff;background:${BLAU};font-weight:700`, `color:${BLAU}`);
})();
