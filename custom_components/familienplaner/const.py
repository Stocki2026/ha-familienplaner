"""Konstanten für den Familienplaner."""

from __future__ import annotations

DOMAIN = "familienplaner"
URL_BASE = "/familienplaner_static"

# Einträge in entry.data
CONF_TITLE = "titel"
CONF_FAMILY_CALENDAR = "familien_kalender"
CONF_FAMILY_TODO = "familien_liste"
CONF_SHOPPING_TODO = "einkaufsliste"
CONF_WEATHER = "wetter"

# Einträge in entry.options
CONF_PERSONS = "personen"
CONF_SPECIAL_CALENDAR = "besondere_tage"
CONF_HOLIDAY_CALENDAR = "feiertage"
CONF_WASTE_CALENDAR = "muellabfuhr"
CONF_SCHOOL_CALENDAR = "schulferien"
CONF_MEAL_CALENDAR = "essensplan"
CONF_PINBOARD_TODO = "pinnwand"
CONF_ALEXA = "alexa"
CONF_REMINDER_MINUTES = "erinnerung_minuten"
CONF_MORNING_TIME = "morgen_uhrzeit"
CONF_EVENING_TIME = "abend_uhrzeit"
CONF_ALEXA_MORNING = "alexa_morgen"
CONF_ALEXA_TIME = "alexa_uhrzeit"
CONF_WASTE_TIME = "muell_uhrzeit"
CONF_WEATHER_HINT = "wetter_hinweis"
CONF_TRAVEL_TIME = "fahrzeit"
CONF_CONFLICTS = "konflikt_warnung"
CONF_WEEKLY = "wochenrueckblick"
CONF_WEEKLY_TIME = "wochenrueckblick_uhrzeit"

# Felder einer Person
P_SLUG = "slug"
P_NAME = "name"
P_PERSON = "person_entity"
P_CALENDAR = "calendar_entity"
P_TODO = "todo_entity"
P_COLOR = "farbe"
P_NOTIFY = "notify_service"
P_ROTATION = "rotation"

FAMILY = "familie"

DEFAULT_OPTIONS = {
    CONF_PERSONS: [],
    CONF_REMINDER_MINUTES: 30,
    CONF_MORNING_TIME: "07:00:00",
    CONF_EVENING_TIME: "19:30:00",
    CONF_ALEXA_MORNING: True,
    CONF_ALEXA_TIME: "07:00:00",
    CONF_WASTE_TIME: "18:00:00",
    CONF_WEATHER_HINT: True,
    CONF_TRAVEL_TIME: True,
    CONF_ALEXA: [],
    CONF_CONFLICTS: True,
    CONF_WEEKLY: True,
    CONF_WEEKLY_TIME: "18:00:00",
}

# Ereignisse auf dem Event-Bus (für eigene Automationen: Licht, Heizung, Alarm …)
EVENT_SOON = f"{DOMAIN}_termin_bald"
EVENT_START = f"{DOMAIN}_termin_beginnt"
EVENT_END = f"{DOMAIN}_termin_endet"
EVENT_CONFLICT = f"{DOMAIN}_konflikt"


FAMILY_COLOR = "#8C7B6B"
PALETTE = ["#5B8DB8", "#D9849B", "#E39350", "#6FA372", "#A585C1", "#E0B04F", "#4FB3BF", "#C0675B"]

# Vorlaufzeiten
WEATHER_HINT_MINUTES = 120
TRAVEL_CHECK_MINUTES = 90
TRAVEL_BUFFER_MINUTES = 10

SIGNAL_UPDATED = f"{DOMAIN}_aktualisiert"
