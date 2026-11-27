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
- Task catalogue with over 40 classic household chores (kitchen, cleaning, laundry, tidying, outside, pets) that
  everyone can pick for themselves with one tap – with picture and points
- Conflict warnings: double bookings and drivers who are busy themselves
- Events from one sentence: "Ben has football tomorrow at 3pm, Anna drives" (text field, service, Assist voice)
- Weekly review every Sunday evening: this week done, next week per person, birthdays, waste
- Your home reacts to the calendar: events on the bus, "next start" and "in an event" sensors, ready-made blueprints
- Cockpit: a living sky (sun position, clouds, rain, snow, thunderstorms, fog, stars, moon phase, northern lights) above a
  little house whose windows light up for everyone at home, with a 24-hour day ring per person – tap a person to see only their day
- Wall tablet mode: photo screensaver with clock and next events, night dimming, wake on motion
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
   `hacs_karten: true` (Week Planner Card / Calendar Card Pro statt der eigenen Kalenderansicht).

Zusätzliche HACS-Karten sind nicht nötig: Der Familienplaner bringt eine eigene Kalenderansicht mit.

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
  Dazu eine eigene Monster-Truck-Flotte mit Riesenreifen und Gesicht: Monstertruck mit Flammen, Hai-, Dino-, Blitz-,
  Polizei-, Feuerwehr-, Bagger-, Einhorn- und Renn-Truck. Statt eines Fahrzeugs geht auch ein **eigenes Bild**:
  Datei nach `/config/www/` legen und in der Garage `/local/…` eintragen (bleibt nur bei euch, nicht im Repo).
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
- **Aufgaben nehmen**: Ein Katalog mit über 40 klassischen Haushaltsaufgaben (Küche, Putzen, Wäsche, Ordnung,
  Draußen, Tiere), jede mit Bild und Punkten. Person antippen, eine oder mehrere Aufgaben auswählen und mit einem Knopf für heute eintragen. Eltern
  (Admins) können sie auch anderen geben. Eigener Katalog mit `familienplaner.katalog_festlegen`.
- **Belohnungs-Shop**: Punkte vom Konto einlösen; in der Familienliste erscheint „🎁 Ben löst ein: …“ für die Eltern.
- **Haushalts-Rotation**: Spülmaschine, Tisch decken (täglich) und Müll (Mo + Do) wechseln morgens reihum zwischen
  allen Personen mit „Bei der Rotation mitmachen“ und landen mit Punkten in deren Liste (plus Push).
- **Eltern-Bereich**: sichtbar für Personen, die *nicht* bei der Rotation mitmachen. Bonuspunkte, Spielregeln,
  neues Rennen, Rotation ein/aus und Uhrzeit.

Voraussetzung: Jede Person hat in der Einrichtung eine **Aufgabenliste** und eine **Person-Entität** (für die
Zuordnung zum angemeldeten Benutzer).

Dienste: `familienplaner.punkte_buchen`, `belohnung_einloesen`, `fahrzeug_waehlen`, `rennen_neu_starten`,
`dienste_verteilen`, `belohnungen_festlegen`, `dienste_festlegen`, `schatzkarte_festlegen`, `neue_insel`, `aufgabe_nehmen`, `katalog_festlegen`.

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
- `type: custom:katalog-card` (Aufgaben-Katalog, optional `bereich: kueche`)
- `type: custom:aufgaben-bilder-card` mit `entity: todo.ben` (optional `farbe`, `ton: false`, `erledigte: false`,
  `titel`)

## Die Kalenderansicht

Die Karte `custom:familienplaner-kalender` ist im Dashboard überall eingebaut (Woche, Monat, Mein Bereich, Familie):

- **Tag, Woche, Monat und Liste** mit einem Tipp umschalten; wischen oder ‹ › blättert, „Heute“ springt zurück.
  Auf dem Handy zeigt die Woche 3 Tage nebeneinander.
- **Farbige Personen-Chips** blenden Kalender aus und ein. Wird oben eine Person angetippt, folgt die Ansicht.
- **Termin antippen:** Details mit Ort (Karte), Notiz und Wiederholung, dann **Ändern** oder **Löschen**
  (bei Serien „nur diesen“ oder „diesen und alle folgenden“).
- **Leere Stunde antippen:** Neuer Termin, schon mit Tag und Uhrzeit vorausgefüllt – den Rest als Satz schreiben.
- **„Wer hat Zeit?“** markiert grün die Lücken, in denen alle sichtbaren Personen frei sind.
- **Symbole** erscheinen automatisch passend zum Titel (⚽ Fußball, 🦷 Zahnarzt, 🎂 Geburtstag, 🎹 Klavier …).
- Jetzt-Linie, Kalenderwoche, ganztägige Termine oben, überlappende Termine nebeneinander, vergangene blasser.

```yaml
type: custom:familienplaner-kalender
ansicht: woche          # tag | woche | monat | liste
von: 6                  # erste Stunde im Raster
bis: 22
tage_liste: 14
kalender:
  - entity: calendar.familie
    name: Familie
    farbe: "#8A8F98"
    slug: familie
  - entity: calendar.anna
    name: Anna
    farbe: "#5B8DB8"
    slug: anna
```

## Terminkonflikte

Der Familienplaner prüft die nächsten Tage auf Doppelbuchungen einer Person und auf Fahrer, die zur selben Zeit
selbst einen Termin haben (oder jemand anderen fahren). Jeder Konflikt kommt einmal als Push an die betroffene
Person, steht als roter Hinweis oben im Dashboard und im Sensor `Terminkonflikte` (Attribut `liste`).
Abschalten: *Konfigurieren → Erinnerungen & Alexa*.

## Termin in einem Satz

Ins Feld **„Termin in einem Satz“** (im Formular „Neuer Termin“) einfach schreiben, z. B.
„Ben hat Dienstag um 4 Fußball, Anna fährt“, „Zahnarzt Anna morgen 9:30“, „Wir gehen am 24.12. zu Oma“,
„Elternabend nächsten Freitag um 19 Uhr“, „Carla hat halb 5 Klavier“. Erkannt werden Person (sonst Familie),
heute/morgen/übermorgen, Wochentage, Datum, Uhrzeit („um 4“ = 16 Uhr, „halb 5“ = 16:30) und der Fahrer.

Außerdem:

- **Serien:** „Ben hat jeden Dienstag um 4 Fußball“, „Anna werktags 7:30 Arbeit“, „Müll alle 2 Wochen Freitag“,
  „täglich“, „wöchentlich“, „monatlich“, „jährlich“, „dienstags“
- **Ende oder Dauer:** „von 16 bis 17:30“, „16-18 Uhr“, „für 2 Stunden“, „90 Minuten“
- **Ort:** „… im Sportpark“, „… bei Oma“ am Satzende oder ausdrücklich „@Turnhalle“ / „Ort: Turnhalle“

**Per Sprache (Assist, Handy-App oder Voice-Gerät):** Vorlage importieren –
[Termin per Sprache](https://my.home-assistant.io/create-link/?redirect=blueprint_import&blueprint_url=https%3A%2F%2Fgithub.com%2FStocki2026%2Fha-familienplaner%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffamilienplaner%2Ftermin_per_sprache.yaml) – und sagen: „Termin Ben hat morgen um 16 Uhr Fußball“.
Alexa kann ohne eigenen Skill keinen freien Text an Home Assistant übergeben; dafür Assist nutzen.

## Wer hat Zeit?

Der Dienst `familienplaner.freie_zeit` sucht gemeinsame Lücken, z. B. für einen Familienausflug:

```yaml
action: familienplaner.freie_zeit
data:
  tage: 7          # wie weit voraus
  dauer: 120       # mindestens so viele Minuten
  personen: [anna, ben]   # leer = alle
  von: "08:00"
  bis: "20:00"
```

Antwort: `slots` (start, ende, minuten, text) und ein fertiger Satz in `antwort`, z. B. für Alexa oder Push.
Ganztägige Termine (Geburtstage, Feiertage) blockieren nicht.

## Wochenrückblick

Sonntags um 18:00 (einstellbar) bekommt jede Person eine Nachricht: wie viele Termine diese Woche geschafft wurden,
die nächste Woche Tag für Tag, Geburtstage, Müllabfuhr und eventuelle Konflikte. Sofort testen:
Dienst `familienplaner.wochenrueckblick`.

## Das Haus reagiert auf den Kalender

Für eigene Automationen gibt es pro Person die Sensoren **„nächster Beginn“** (Zeitstempel) und **„im Termin“**
(an/aus) sowie diese Ereignisse mit `person`, `name`, `titel`, `start`, `ende`, `ort`, `fahrer`:
`familienplaner_termin_bald` (zur Erinnerungszeit), `familienplaner_termin_beginnt`, `familienplaner_termin_endet`,
`familienplaner_konflikt`.

Fertige Vorlagen (Blueprints) zum Importieren:

- [Vor einem Termin](https://my.home-assistant.io/create-link/?redirect=blueprint_import&blueprint_url=https%3A%2F%2Fgithub.com%2FStocki2026%2Fha-familienplaner%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffamilienplaner%2Fvor_termin.yaml) – z. B. Wecklicht 45 Minuten vor dem ersten Termin (nur wenn er vor
  10 Uhr beginnt), Bad vorheizen, Kaffeemaschine an
- [Wenn ein Termin beginnt/endet](https://my.home-assistant.io/create-link/?redirect=blueprint_import&blueprint_url=https%3A%2F%2Fgithub.com%2FStocki2026%2Fha-familienplaner%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Ffamilienplaner%2Ftermin_ereignis.yaml) – z. B. Heizung runter, Flurlicht an,
  Alarmanlage scharf; filterbar nach Person und Stichwort

## Cockpit

Die Ansicht **Cockpit** (zweiter Reiter im Familienplaner-Dashboard) ist ein Hingucker fürs Wand-Display:

- **Lebendiger Himmel** im Hintergrund, passend zum echten Sonnenstand (`sun.sun`) und Wetter: Morgenrot,
  blauer Himmel, Abendrot, Sternenhimmel mit Sternschnuppen und Polarlicht, Mond mit echter Mondphase,
  ziehende Wolken, Regen, Schnee, Blitze bei Gewitter, Nebelbänke. Bei Frost oder Schnee wird die Landschaft weiß.
- **Das Haus**: In der Landschaft steht ein Haus, in dem so viele Fenster leuchten, wie Personen zu Hause sind.
  Ist es kalt, raucht der Kamin.
- **24-Stunden-Tagesring**: ein Ring je Person in ihrer Farbe, jeder Termin ein Bogen mit Symbol, ganztägige
  Termine als gepunkteter Ring, Tag und Nacht als Sonnenbogen außen, der Zeiger zeigt „jetzt“. Laufende
  Termine leuchten. Bogen antippen = Details in der Mitte.
- **Personen antippen**: nur der Tag dieser Person (die anderen Ringe treten zurück), in der Mitte ihr nächster
  Termin mit Countdown. Gleiche Auswahl wie bei den anderen Karten; nach 3 Minuten geht es zurück zu „Alle“.
  Kleine Monde kreisen um jede Person, einer je Termin, der heute noch kommt.
- **Als Nächstes** mit Live-Countdown und Fortschrittsbalken, unten die Wetter-Vorhersage der nächsten Stunden,
  Sonnenauf- und -untergang, Mondphase und wer zu Hause ist.
- Auf dem Handy stapelt sich alles untereinander.

```yaml
strategy:
  type: custom:familienplaner
  cockpit:
    zuerst: true          # Cockpit als Startseite
    polarlicht: false     # kein Polarlicht
    leistung: sparsam     # weniger Bilder pro Sekunde (Standard: auto, erkennt langsame Geräte selbst)
  # cockpit: false        # Ansicht ausblenden
```

Die Karte geht auch einzeln in jedem Dashboard: `type: custom:familienplaner-cockpit` (liest alles aus der
Einrichtung). Zum Ausprobieren eines Wetters: `szene: {wetter: snowy, sonne: -12, temperatur: -3}`.

## Wand-Tablet-Modus

Auf dem Wand-Tablet das Familienplaner-Dashboard **einmal mit `?wand=1` am Ende der Adresse** öffnen
(z. B. `http://homeassistant.local:8123/familienplaner/woche?wand=1`). Ab dann gilt nur auf diesem Gerät:

- nach 5 Minuten ohne Berührung: Bildschirmschoner mit Fotos, großer Uhr und den nächsten Terminen
- nachts (22–6 Uhr): schwarzer Bildschirm mit gedimmter Uhr, optional wird die Tablet-Helligkeit gesenkt
- Berührung oder Bewegungsmelder weckt sofort
- mit `?wand=0` wieder ausschalten

Einstellungen in der Rohkonfiguration des Dashboards:

```yaml
strategy:
  type: custom:familienplaner
  tablet:
    leerlauf: 5                                         # Minuten
    fotos: media-source://media_source/local/fotos      # Ordner /media/fotos, oder Liste von Bild-URLs
    bewegung: binary_sensor.flur_bewegung
    helligkeit: number.wandtablet_bildschirmhelligkeit  # z. B. Fully Kiosk; auch light.* möglich
    hell_tag: 200
    hell_nacht: 5
    nacht_von: "22:00"
    nacht_bis: "06:00"
```

Tipp: Mit der App *Fully Kiosk Browser* (und der gleichnamigen Integration) bleibt das Tablet immer an und
die Helligkeit lässt sich steuern.

## Dienste

- `familienplaner.termin_anlegen` (person, titel, start, dauer, ganztag, ort, fahrer, benachrichtigen, rrule)
- `familienplaner.gericht_planen` (tag, gericht, zutaten)
- `familienplaner.benachrichtigen` (person oder `familie`, titel, nachricht)
- `familienplaner.morgen_ansage` (gibt den Text zurück)
- `familienplaner.termin_aus_satz` (text; gibt `verstanden` und `antwort` zurück)
- `familienplaner.wochenrueckblick` (verschickt den Wochenrückblick sofort)
- `familienplaner.freie_zeit` (tage, dauer, personen, von, bis; gibt `slots` und `antwort` zurück)

## Für Erweiterungen

- Python: Ein Modul `aufgaben.py` mit `async def async_setup(hass, entry, coordinator)` wird automatisch geladen.
  Personen: `coordinator.personen` (slug, name, person_entity, calendar_entity, todo_entity, farbe,
  notify_service, rotation), Push: `await coordinator.async_benachrichtigen(slug_oder_familie, titel, text)`.
- Frontend: Jede `.js`-Datei in `frontend/` wird automatisch geladen. Eigene Dashboard-Views:
  `window.familienplanerViews.push(async (uebersicht, hass, {theme, hacs}) => view)`.
  Passendes Symbol zu einem Titel: `window.familienplaner.symbol("Fußball")` → „⚽“.

## Entwicklung

```bash
pip install pytest-homeassistant-custom-component ical home-assistant-frontend
python -m pytest tests
```
