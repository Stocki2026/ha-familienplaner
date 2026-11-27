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
- Chores with points: a family race track, streaks, levels, a reward shop and an automatic chore rotation
- Big picture tiles for tasks, so children who can't read yet know what to do (tap = done, with confetti)
- Family treasure map: everyone walks together across an island, each station unlocks a family reward
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

## Aufgaben, Punkte & Familien-Rennen

Die Ansicht **Aufgaben** erscheint automatisch im Familienplaner-Dashboard:

- **Punkte fürs Abhaken**: Jede erledigte Aufgabe bringt Punkte (Standard 10). `+20` oder `⭐20` im Titel = 20 Punkte.
  Haken wieder raus = Punkte wieder weg. Aufgaben aus der Familienliste zählen für die Person, die sie abhakt.
- **Familien-Rennen**: Alle fahren auf einer Rennstrecke, Position nach Punkten. Wer zuerst die Ziellinie erreicht,
  gewinnt und bekommt einen Sieger-Bonus. Fahrzeug (Auto, Rennwagen, Motorrad, Pferd, Einhorn, Fahrrad, Traktor,
  Rakete) und Farbe wählt jede Person in der Garage selbst (Fahrzeug antippen). Kinder nur ihr eigenes, Admins alle.
- **Serien, Level, Familienziel**: ab 3 Tagen am Stück Serien-Bonus, Level nach Gesamtpunkten, gemeinsames Ziel
  (z. B. Pizzaabend), auf das alle Punkte einzahlen.
- **Große Bilder**: Die Aufgaben jeder Person erscheinen als große Bild-Kacheln, damit auch Kinder, die noch nicht
  lesen können, wissen, was zu tun ist. Antippen = erledigt (mit Haken, Konfetti und Ton), nochmal antippen =
  zurück. Das Bild kommt aus einem Emoji am Titelanfang („🦷 Zähne putzen“), einer Zeile `bild: https://…` in der
  Beschreibung (eigenes Foto) oder wird automatisch passend zum Titel gewählt (Zähne, Zimmer, Müll, Hund, …).
- **Schatzkarte**: Die ganze Familie läuft gemeinsam über eine Schatzinsel. Alle Punkte aller Personen bringen die
  Familie weiter. An jeder Station gibt es eine Familien-Belohnung (Push an alle und Eintrag in der Familienliste),
  am Ende wartet die Schatzkiste. Danach startet „Neue Schatzinsel“ von vorne. Eigene Stationen mit
  `familienplaner.schatzkarte_festlegen`.
- **Belohnungs-Shop**: Punkte vom Konto einlösen; in der Familienliste erscheint „🎁 Ben löst ein: …“ für die Eltern.
- **Haushalts-Rotation**: Spülmaschine, Tisch decken (täglich) und Müll (Mo + Do) wechseln morgens reihum zwischen
  allen Personen mit „Bei der Rotation mitmachen“ und landen mit Punkten in deren Liste (plus Push).
- **Eltern-Bereich**: sichtbar für Personen, die *nicht* bei der Rotation mitmachen. Bonuspunkte, Spielregeln,
  neues Rennen, Rotation ein/aus und Uhrzeit.

Voraussetzung: Jede Person hat in der Einrichtung eine **Aufgabenliste** und eine **Person-Entität** (für die
Zuordnung zum angemeldeten Benutzer).

Dienste: `familienplaner.punkte_buchen`, `belohnung_einloesen`, `fahrzeug_waehlen`, `rennen_neu_starten`,
`dienste_verteilen`, `belohnungen_festlegen`, `dienste_festlegen`, `schatzkarte_festlegen`, `neue_insel`.

```yaml
action: familienplaner.schatzkarte_festlegen
data:
  stationen:
    - {emoji: "🛝", name: Spielplatz, belohnung: Nachmittag auf dem Spielplatz, punkte: 200}
    - {emoji: "🏊", name: Schwimmbad, belohnung: Ab ins Schwimmbad, punkte: 600}
    - {emoji: "🎢", name: Schatzkiste, belohnung: Freizeitpark, punkte: 1500}
```

Die Karten funktionieren auch einzeln:

- `type: custom:rennstrecke-card` (findet das Rennen selbst) oder mit `entity: sensor.familienplaner_familien_rennen`
- `type: custom:schatzkarte-card` (findet die Schatzkarte selbst)
- `type: custom:aufgaben-bilder-card` mit `entity: todo.ben` (optional `farbe`, `ton: false`, `erledigte: false`,
  `titel`)

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
