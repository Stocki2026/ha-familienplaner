"""Familienplaner: Familienkalender, Erinnerungen und Familien-Dashboard für Home Assistant."""

from __future__ import annotations

from datetime import date, datetime, datetime as _DateTime, timedelta
import hashlib
import logging
from pathlib import Path
from typing import Any

import voluptuous as vol

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import ServiceValidationError
import homeassistant.helpers.config_validation as cv
from homeassistant.util import dt as dt_util

from . import logic
from .const import CONF_MEAL_CALENDAR, CONF_SHOPPING_TODO, DOMAIN, FAMILY, URL_BASE
from .coordinator import FamilienplanerCoordinator

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
    Platform.SELECT,
    Platform.TEXT,
    Platform.DATETIME,
    Platform.NUMBER,
    Platform.SWITCH,
    Platform.BUTTON,
    Platform.TIME,
]

type FamilienplanerConfigEntry = ConfigEntry[FamilienplanerCoordinator]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

SCHEMA_TERMIN = vol.Schema(
    {
        vol.Required("person"): cv.string,
        vol.Required("titel"): cv.string,
        vol.Required("start"): cv.datetime,
        vol.Optional("dauer", default=60): vol.All(vol.Coerce(int), vol.Range(min=1, max=60 * 24 * 14)),
        vol.Optional("ganztag", default=False): cv.boolean,
        vol.Optional("ort", default=""): cv.string,
        vol.Optional("fahrer", default=""): cv.string,
        vol.Optional("benachrichtigen", default=True): cv.boolean,
    }
)
SCHEMA_GERICHT = vol.Schema(
    {
        vol.Required("tag"): cv.date,
        vol.Required("gericht"): cv.string,
        vol.Optional("zutaten", default=""): vol.Any(cv.string, [cv.string]),
    }
)
SCHEMA_NACHRICHT = vol.Schema(
    {vol.Required("person"): cv.string, vol.Required("titel"): cv.string, vol.Required("nachricht"): cv.string}
)


def _coordinator(hass: HomeAssistant) -> FamilienplanerCoordinator:
    for entry in hass.config_entries.async_loaded_entries(DOMAIN):
        return entry.runtime_data
    raise ServiceValidationError("Der Familienplaner ist nicht eingerichtet.")


async def async_termin_anlegen(coord: FamilienplanerCoordinator, daten: dict[str, Any]) -> str:
    """Legt einen Termin im Kalender der Person (oder Familie) an."""
    hass = coord.hass
    person = str(daten["person"]).lower()
    kalender = coord.kalender_von(person)
    if not kalender:
        raise ServiceValidationError(f"Für „{person}“ ist kein Kalender eingerichtet.")
    start: datetime = daten["start"]
    if start.tzinfo is None:
        start = start.replace(tzinfo=dt_util.get_default_time_zone())
    fahrer = str(daten.get("fahrer") or "").strip()
    if fahrer.lower() in ("", "niemand", "none"):
        fahrer = ""
    fahrer_name = coord.namen.get(fahrer.lower(), fahrer.capitalize()) if fahrer else ""
    ort = str(daten.get("ort") or "").strip()
    titel = str(daten["titel"]).strip()

    event: dict[str, Any] = {"entity_id": kalender, "summary": titel}
    if ort:
        event["location"] = ort
    if fahrer_name:
        event["description"] = f"🚗 Fahrer: {fahrer_name}"
    if daten.get("ganztag"):
        event["start_date"] = start.date().isoformat()
        event["end_date"] = (start.date() + timedelta(days=1)).isoformat()
    else:
        event["start_date_time"] = start.isoformat()
        event["end_date_time"] = (start + timedelta(minutes=int(daten.get("dauer", 60)))).isoformat()
    await hass.services.async_call("calendar", "create_event", event, blocking=True)

    lokal = dt_util.as_local(start)
    wann = f"{['Mo','Di','Mi','Do','Fr','Sa','So'][lokal.weekday()]}, {lokal.day}.{lokal.month}."
    wann += " (ganztägig)" if daten.get("ganztag") else f" um {lokal:%H:%M} Uhr"
    if ort:
        wann += f" · {ort}"
    if daten.get("benachrichtigen", True):
        await coord.async_benachrichtigen(person, f"📅 Neuer Termin: {titel}", wann)
    fahrer_slug = fahrer.lower()
    if fahrer_slug and fahrer_slug != person and coord.person(fahrer_slug):
        wer = "" if person == FAMILY else f" ({coord.namen.get(person, person)})"
        await coord.async_benachrichtigen(fahrer_slug, f"🚗 Du fährst: {titel}", wann + wer)
    await coord.async_request_refresh()
    return wann


async def async_termin_aus_satz(coord: FamilienplanerCoordinator, text: str, werfen: bool = True) -> dict[str, Any]:
    """Versteht einen Satz („Ben hat Dienstag um 4 Fußball, Anna fährt“) und legt den Termin an."""
    namen = {p.name.lower(): p.slug for p in coord.personen}
    namen.update({p.slug: p.slug for p in coord.personen})
    erkannt = logic.termin_aus_satz(text, namen, dt_util.now())
    if not erkannt:
        hinweis = f"Ich habe „{text}“ nicht verstanden. Beispiel: „Ben hat Dienstag um 16 Uhr Fußball“."
        if werfen:
            raise ServiceValidationError(hinweis)
        return {"verstanden": False, "antwort": hinweis}
    start = erkannt["start"]
    # Achtung: „datetime“ wird in diesem Paket von der Plattform datetime.py überschattet
    if not isinstance(start, _DateTime):
        start = _DateTime.combine(start, _DateTime.min.time(), tzinfo=dt_util.get_default_time_zone())
    if not coord.kalender_von(erkannt["person"]):
        erkannt["person"] = FAMILY
    wann = await async_termin_anlegen(coord, {
        "person": erkannt["person"], "titel": erkannt["titel"], "start": start,
        "ganztag": erkannt["ganztag"], "fahrer": erkannt["fahrer"], "dauer": 60,
    })
    wer = "die Familie" if erkannt["person"] == FAMILY else coord.namen.get(erkannt["person"], erkannt["person"])
    antwort = f"Eingetragen: {erkannt['titel']} für {wer}, {wann}."
    if erkannt["fahrer"]:
        antwort += f" {coord.namen.get(erkannt['fahrer'], erkannt['fahrer'])} fährt."
    return {"verstanden": True, "person": erkannt["person"], "titel": erkannt["titel"], "start": start.isoformat(),
            "ganztag": erkannt["ganztag"], "fahrer": erkannt["fahrer"], "antwort": antwort}


async def async_gericht_planen(coord: FamilienplanerCoordinator, daten: dict[str, Any]) -> None:
    hass = coord.hass
    kalender = coord.opt.get(CONF_MEAL_CALENDAR)
    if not kalender:
        raise ServiceValidationError("Kein Essensplan-Kalender eingerichtet.")
    tag: date = daten["tag"]
    zutaten = daten.get("zutaten") or []
    if isinstance(zutaten, str):
        zutaten = [z.strip() for z in zutaten.replace(",", "\n").split("\n")]
    zutaten = [z for z in zutaten if z]
    event = {
        "entity_id": kalender,
        "summary": daten["gericht"],
        "start_date": tag.isoformat(),
        "end_date": (tag + timedelta(days=1)).isoformat(),
    }
    if zutaten:
        event["description"] = ", ".join(zutaten)
    await hass.services.async_call("calendar", "create_event", event, blocking=True)
    liste = coord.opt.get(CONF_SHOPPING_TODO)
    if liste:
        for z in zutaten:
            await hass.services.async_call(
                "todo", "add_item", {"entity_id": liste, "item": z, "description": f"für {daten['gericht']}"},
                blocking=True,
            )
    await coord.async_request_refresh()


def _dienste_registrieren(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "termin_anlegen"):
        return

    async def termin(call: ServiceCall) -> None:
        await async_termin_anlegen(_coordinator(hass), dict(call.data))

    async def gericht(call: ServiceCall) -> None:
        await async_gericht_planen(_coordinator(hass), dict(call.data))

    async def nachricht(call: ServiceCall) -> None:
        await _coordinator(hass).async_benachrichtigen(
            str(call.data["person"]).lower(), call.data["titel"], call.data["nachricht"]
        )

    async def ansage(call: ServiceCall) -> ServiceResponse:
        text = await _coordinator(hass).async_morgen_ansage()
        return {"text": text}

    async def satz(call: ServiceCall) -> ServiceResponse:
        return await async_termin_aus_satz(_coordinator(hass), call.data["text"], werfen=False)

    async def woche(call: ServiceCall) -> ServiceResponse:
        return {"texte": await _coordinator(hass).async_wochenrueckblick()}

    hass.services.async_register(
        DOMAIN, "termin_aus_satz", satz, schema=vol.Schema({vol.Required("text"): cv.string}),
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN, "wochenrueckblick", woche, schema=vol.Schema({}), supports_response=SupportsResponse.OPTIONAL
    )
    hass.services.async_register(DOMAIN, "termin_anlegen", termin, schema=SCHEMA_TERMIN)
    hass.services.async_register(DOMAIN, "gericht_planen", gericht, schema=SCHEMA_GERICHT)
    hass.services.async_register(DOMAIN, "benachrichtigen", nachricht, schema=SCHEMA_NACHRICHT)
    hass.services.async_register(
        DOMAIN, "morgen_ansage", ansage, schema=vol.Schema({}), supports_response=SupportsResponse.OPTIONAL
    )


def _js_dateien() -> list[tuple[str, str]]:
    """(Dateiname, Kurz-Hash) aller Frontend-Dateien; der Hash erzwingt nach Updates frisches JS."""
    pfad = Path(__file__).parent / "frontend"
    return [(d.name, hashlib.sha1(d.read_bytes()).hexdigest()[:10]) for d in sorted(pfad.glob("*.js"))]


async def _frontend_registrieren(hass: HomeAssistant) -> None:
    key = f"{DOMAIN}_frontend"
    if hass.data.get(key):
        return
    hass.data[key] = True
    pfad = Path(__file__).parent / "frontend"
    await hass.http.async_register_static_paths([StaticPathConfig(URL_BASE, str(pfad), False)])
    for name, hash_ in await hass.async_add_executor_job(_js_dateien):
        add_extra_js_url(hass, f"{URL_BASE}/{name}?v={hash_}")


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Dashboard-Strategie und Karten immer bereitstellen – auch wenn die Einrichtung
    (noch) fehlschlägt. Sonst meldet das Dashboard nur „Timeout waiting for strategy“."""
    await _frontend_registrieren(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: FamilienplanerConfigEntry) -> bool:
    coord = FamilienplanerCoordinator(hass, entry)
    await coord.async_start()
    await coord.async_config_entry_first_refresh()
    entry.runtime_data = coord

    _dienste_registrieren(hass)
    await _frontend_registrieren(hass)

    # Erweiterungen (z. B. Aufgaben/Punkte-Modul) vor den Plattformen einhängen,
    # damit sie ihre Entitäten über entity.erweiterungen() mitliefern können.
    coord.erweiterungen = []
    try:
        from . import aufgaben  # type: ignore[attr-defined]
    except ImportError:
        aufgaben = None
    if aufgaben is not None and hasattr(aufgaben, "async_setup"):
        await aufgaben.async_setup(hass, entry, coord)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_neu_laden))
    return True


async def _neu_laden(hass: HomeAssistant, entry: FamilienplanerConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: FamilienplanerConfigEntry) -> bool:
    entry.runtime_data.async_stop()
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
