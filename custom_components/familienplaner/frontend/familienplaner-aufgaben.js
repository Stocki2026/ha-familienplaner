/*
 * Familienplaner – Ansicht „Aufgaben“ / "Tasks" view (Punkte, Familien-Rennen, Haushalt, Belohnungen)
 *
 * Hängt sich an die Dashboard-Strategie „custom:familienplaner“ an und baut die Ansicht
 * komplett aus den Daten der Integration. Keine Konfiguration nötig. Deutsch und Englisch.
 */

(() => {
  const FARBE = "#5F7F63";

  const TEXTE = {
    de: {
      titel: "Aufgaben",
      hallo: "Hallo",
      konto_satz: "Du hast **{{ f.konto }} Punkte** auf dem Konto",
      heute_satz: " und heute schon **{{ f.heute }} {{ 'Aufgabe' if f.heute == 1 else 'Aufgaben' }}** geschafft",
      serie_satz: " 🔥 {{ f.serie }} Tage in Folge!",
      gast: "Hake Aufgaben ab und sammle Punkte fürs Familien-Rennen.",
      tipp: "Tipp: Schreib „+20“ in den Titel einer Aufgabe, dann bringt sie 20 Punkte. Ein Emoji am Anfang des Titels wird zum großen Bild. Tippe auf dein Fahrzeug, um es umzubauen.",
      haushalt: "Haushalt heute",
      nicht_verteilt: "noch nicht verteilt",
      punkte: "Punkte",
      keine_dienste: "Heute stehen keine Dienste an.",
      familie: "Familie",
      shop: "Belohnungs-Shop",
      dein_konto: "Dein Konto: **{{ f[0].konto }} Punkte**. ",
      shop_text: "Tippen zum Einlösen. Die Punkte werden abgebucht und in der Familienliste erscheint eine Aufgabe für die Eltern.",
      einloesen: (b, k) => `${b} für ${k} Punkte einlösen?`,
      eltern: "Eltern-Bereich",
      regeln: "Spielregeln",
      rotation: "Haushalts-Rotation",
    },
    en: {
      titel: "Tasks",
      hallo: "Hello",
      konto_satz: "You have **{{ f.konto }} points** in your account",
      heute_satz: " and already finished **{{ f.heute }} {{ 'task' if f.heute == 1 else 'tasks' }}** today",
      serie_satz: " 🔥 {{ f.serie }} days in a row!",
      gast: "Check off tasks and collect points for the family race.",
      tipp: "Tip: write “+20” in a task title and it is worth 20 points. An emoji at the start of the title becomes the big picture. Tap your vehicle to customise it.",
      haushalt: "Chores today",
      nicht_verteilt: "not assigned yet",
      punkte: "points",
      keine_dienste: "No chores today.",
      familie: "Family",
      shop: "Reward shop",
      dein_konto: "Your account: **{{ f[0].konto }} points**. ",
      shop_text: "Tap to redeem. The points are deducted and a task for the parents appears in the family list.",
      einloesen: (b, k) => `Redeem ${b} for ${k} points?`,
      eltern: "Parents",
      regeln: "Rules",
      rotation: "Chore rotation",
    },
  };

  function sprache(hass) {
    const l = (hass && ((hass.locale && hass.locale.language) || hass.language)) || "de";
    return String(l).toLowerCase().startsWith("de") ? "de" : "en";
  }

  function rennenFinden(hass) {
    const reg = hass.entities || {};
    const ids = Object.keys(hass.states).filter((id) => {
      const a = hass.states[id].attributes;
      return id.startsWith("sensor.") && Array.isArray(a.fahrer) && a.entitaeten && Array.isArray(a.dienste);
    });
    return ids.find((id) => reg[id] && reg[id].platform === "familienplaner") || ids[0];
  }

  function aufgabenView(u, hass, { theme }) {
    const t = TEXTE[sprache(hass)];
    const rennen = rennenFinden(hass);
    if (!rennen) return null;
    const a = hass.states[rennen].attributes;
    const id = (key) => (a.entitaeten || {})[key];
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
            `## ${t.hallo} {{ user }} 🏁\n` +
            `{% if f %}{% set f = f[0] %}${t.konto_satz}{% if f.heute %}${t.heute_satz}{% endif %}.` +
            `{% if f.serie >= 2 %}${t.serie_satz}{% endif %}{% else %}${t.gast}{% endif %}\n` +
            t.tipp,
        },
        { type: "custom:rennstrecke-card", entity: rennen },
      ],
    });

    // --- Schatzkarte: die ganze Familie läuft gemeinsam --------------------------------
    if (a.schatzkarte) {
      sections.push({ type: "grid", column_span: 4, cards: [{ type: "custom:schatzkarte-card", entity: rennen }] });
    }

    // --- Aufgaben pro Person (große Bilder, auch ohne Lesen verständlich) --------------------------------------------------------
    for (const f of fahrer) {
      if (!f.liste) continue;
      const punkte = id(`punkte_${f.slug}`);
      sections.push({
        type: "grid",
        cards: [
          {
            type: "heading",
            heading: f.name,
            icon: "mdi:account",
            badges: punkte ? [{ type: "entity", entity: punkte, color: f.farbe_hex, show_icon: true }] : [],
          },
          { type: "custom:aufgaben-bilder-card", entity: f.liste, titel: "" },
        ],
      });
    }

    // --- Haushalt heute + Familienliste --------------------------------------------
    const hausKarten = [
      { type: "heading", heading: t.haushalt, icon: "mdi:home-heart" },
      {
        type: "markdown",
        text_only: true,
        content:
          `{% set d = state_attr('${rennen}', 'dienste') or [] %}` +
          `{% for x in d %}{% if x.heute_dran %}**{{ x.titel }}** · {{ x.zuletzt or '${t.nicht_verteilt}' }} · {{ x.punkte }} ${t.punkte}\n\n{% endif %}{% endfor %}` +
          `{% if not (d | selectattr('heute_dran') | list) %}${t.keine_dienste}{% endif %}`,
      },
    ];
    if (a.familien_liste) {
      hausKarten.push({ type: "heading", heading: t.familie, heading_style: "subtitle", icon: "mdi:home-heart" });
      hausKarten.push({ type: "todo-list", entity: a.familien_liste, hide_completed: false });
    }
    sections.push({ type: "grid", column_span: 2, cards: hausKarten });

    // --- Belohnungs-Shop -------------------------------------------------------------
    const shop = [
      { type: "heading", heading: t.shop, icon: "mdi:gift-outline" },
      {
        type: "markdown",
        text_only: true,
        content:
          `{% set f = state_attr('${rennen}', 'fahrer') | selectattr('name', 'eq', user) | list %}` +
          `{% if f %}${t.dein_konto}{% endif %}${t.shop_text}`,
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
          confirmation: { text: t.einloesen(b.name, b.kosten) },
        },
      });
    }
    sections.push({ type: "grid", column_span: 2, cards: shop });

    // --- Eltern-Bereich: Personen, die nicht bei der Rotation mitmachen ---------------
    const eltern = fahrer.filter((f) => !f.rotation && f.user_id).map((f) => f.user_id);
    const elternKarten = [{ type: "heading", heading: t.eltern, icon: "mdi:shield-account-outline" }];
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
    const regeln = ["punkte_pro_aufgabe", "rennen_ziel", "serien_bonus", "sieger_bonus", "familienziel",
      "familienziel_text", "rennen_neu", "familienziel_einloesen", "insel_neu"].map(id).filter(Boolean);
    const rotation = ["rotation_aktiv", "rotation_uhrzeit", "dienste_verteilen"].map(id).filter(Boolean);
    if (regeln.length) elternKarten.push({ type: "entities", title: t.regeln, grid_options: { columns: 6 }, entities: regeln });
    if (rotation.length) elternKarten.push({ type: "entities", title: t.rotation, grid_options: { columns: 6 }, entities: rotation });
    const elternSec = { type: "grid", column_span: 4, cards: elternKarten };
    // Ohne festgelegte Eltern (alle machen bei der Rotation mit) ist der Bereich für alle sichtbar.
    if (eltern.length) elternSec.visibility = [{ condition: "user", users: eltern }];
    sections.push(elternSec);

    return {
      title: t.titel,
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
  console.info("%c FAMILIENPLANER %c Aufgaben ", `color:#fff;background:${FARBE};font-weight:700`, `color:${FARBE}`);
})();
