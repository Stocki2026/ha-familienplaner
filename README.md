# Familienplaner – Family Planner for Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)

A family calendar, reminders and a family dashboard that builds itself – as a Home Assistant integration.
Any number of people, each with their own color, calendar, to-do list and phone. Everything is set up in the UI,
no YAML needed. *Deutsch weiter unten.*

**Highlights**

- Next event per person with countdown ("in 45 min", "running now") and home/away
- "New event" form made of normal entities (who, what, when, duration, all day, where, who drives)
- Push reminders before events (also to the driver), daily overview in the morning, preview in the evening
- Weather hint before outdoor events, travel time warning via Waze ("leave now")
- Birthday assistant (gift to-do one week before), countdowns, waste collection, school holidays
- Meal plan that puts ingredients on the shopping list, family pinboard
- Alexa morning briefing (weather, events, drivers, birthdays, meals, waste)
- Dashboard strategy `custom:familienplaner`: week view for a wall tablet, a personal view per user for phones,
  family, meals and month – new people appear automatically

**Install:** HACS → ⋮ → Custom repositories → `https://github.com/Stocki2026/ha-familienplaner` (type *Integration*) →
download → restart → *Settings → Devices & services → Add integration → Familienplaner* → *Configure → Add person*.
Dashboard: add a new dashboard and use the raw configuration `strategy: {type: custom:familienplaner}`.

> Notifications and announcements are currently in German; the setup UI is available in German and English.

---

# Familienplaner (Deutsch)

Familienkalender, Termine, Erinnerungen und ein Familien-Dashboard, das sich selbst baut,
als eigene Home-Assistant-Integration (installierbar über HACS).

## Installation über HACS

1. HACS → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/Stocki2026/ha-familienplaner`,
   Typ **Integration** → Hinzufügen.
2. „Familienplaner“ suchen → **Herunterladen** → Home Assistant neu starten.
3. *Einstellungen → Geräte & Dienste → Integration hinzufügen → Familienplaner*:
   Familienname, Familienkalender, Familienliste, Einkaufsliste, Wetter wählen.
4. Beim Eintrag **Konfigurieren** → **Person hinzufügen** (je Person: Name, Farbe, Person in HA,
   eigener Kalender, eigene Aufgabenliste, Handy-Benachrichtigung).
5. **Konfigurieren → Zusatzkalender & Pinnwand**: Besondere Tage, Feiertage, Müllabfuhr, Schulferien,
   Essensplan, Pinnwand. **Erinnerungen & Alexa**: Zeiten, Vorlauf, Echos.
6. Dashboard: *Einstellungen → Dashboards → Dashboard hinzufügen* → **Familienplaner** (falls nicht in
   der Liste: „Neu von Grund auf“, URL `familienplaner`, dann ⋮ → Rohkonfiguration:
   ```yaml
   strategy:
     type: custom:familienplaner
   ```
   ). Neue Personen erscheinen danach automatisch. Optional `theme: Familienkalender` und
   `hacs_karten: false` (nur eingebaute Karten).

Empfohlen (HACS, Frontend): Week Planner Card, Calendar Card Pro, card-mod. Ohne sie nutzt das
Dashboard automatisch die eingebauten Kalenderkarten.

## Was es kann

| Funktion | Details |
|---|---|
| Nächster Termin pro Person | Sensor mit Countdown („in 45 Min“, „läuft gerade“), zu Hause/unterwegs, Fahrer |
| Neuer Termin | Formular aus normalen Entitäten (Für wen, Was, Wann, Dauer, Ganztägig, Wo, Wer fährt) + Dienst `familienplaner.termin_anlegen` |
| Erinnerungen | Push X Min vorher an Person und Fahrer; Tagesübersicht morgens, Vorschau abends |
| Wetter-Hinweis | 2 h vor Terminen mit Ort bei Regen/Schnee/Frost |
| Fahrzeit | 90 Min vorher Fahrzeit per Waze (falls eingerichtet), dann „Jetzt losfahren“ |
| Geburtstage | Countdown, 7 Tage vorher Aufgabe „Geschenk besorgen“, Hinweise am Vortag und am Tag |
| Müll | Vorabend-Push + Alexa, Morgen-Push, Sensor nächste Abholung je Tonne |
| Schulferien | Sensor „Weihnachtsferien in 24 Tagen“ / „noch 5 Tage frei“ |
| Essensplan | Dienst `familienplaner.gericht_planen`: Gericht in den Kalender, Zutaten auf die Einkaufsliste |
| Pinnwand | offene Einträge der Pinnwand-Liste als gelbe Zettel |
| Alexa-Morgen-Ansage | Wetter, Termine mit Fahrer, Geburtstage, Essen, Müll; automatisch oder per Knopf |

## Dienste

- `familienplaner.termin_anlegen` (person, titel, start, dauer, ganztag, ort, fahrer, benachrichtigen)
- `familienplaner.gericht_planen` (tag, gericht, zutaten)
- `familienplaner.benachrichtigen` (person oder `familie`, titel, nachricht)
- `familienplaner.morgen_ansage` (gibt den Text zurück)

## Für Erweiterungen

- Python: Ein Modul `aufgaben.py` mit `async def async_setup(hass, entry, coordinator)` wird automatisch geladen.
  Personen: `coordinator.personen` (slug, name, person_entity, calendar_entity, todo_entity, farbe,
  notify_service, rotation), Push: `await coordinator.async_benachrichtigen(slug_oder_familie, titel, text)`.
- Frontend: Jede `.js`-Datei in `frontend/` wird automatisch geladen. Eigene Dashboard-Views:
  `window.familienplanerViews.push(async (uebersicht, hass, {theme, hacs}) => view)`.

## Entwicklung

```bash
pip install pytest-homeassistant-custom-component ical home-assistant-frontend
python -m pytest tests
```
