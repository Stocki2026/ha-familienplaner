"""Tests: Terminkonflikte, Termin aus einem Satz, Wochenrückblick, Ereignisse fürs Haus."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from freezegun.api import FrozenDateTimeFactory

from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import async_capture_events

from custom_components.familienplaner import logic
from custom_components.familienplaner.const import DOMAIN
from custom_components.familienplaner.models import Termin

from .test_init import _sensor, _tick, basis  # noqa: F401

TZ = ZoneInfo("Europe/Berlin")
JETZT = datetime(2026, 11, 27, 15, 0, tzinfo=TZ)  # Freitag
NAMEN = {"anna": "anna", "ben": "ben", "carla": "carla"}


def _t(titel, person, h, dauer=60, tag=28, beschreibung=""):
    s = datetime(2026, 11, tag, h, 0, tzinfo=TZ)
    return Termin(titel, s, s + timedelta(minutes=dauer), description=beschreibung, kalender=f"calendar.{person}", person=person)


def _fahrer(t):
    return t.fahrer.lower()


def test_satz_verstehen():
    r = logic.termin_aus_satz("Ben hat Dienstag um 4 Fußball, Anna fährt", NAMEN, JETZT)
    assert r == {"person": "ben", "titel": "Fußball", "start": datetime(2026, 12, 1, 16, 0, tzinfo=TZ),
                 "ganztag": False, "fahrer": "anna"}
    r = logic.termin_aus_satz("Anna Zahnarzt morgen 9:30 Uhr", NAMEN, JETZT)
    assert (r["person"], r["titel"], r["start"]) == ("anna", "Zahnarzt", datetime(2026, 11, 28, 9, 30, tzinfo=TZ))
    r = logic.termin_aus_satz("Wir gehen am 24.12. zu Oma", NAMEN, JETZT)
    assert (r["person"], r["ganztag"], str(r["start"])) == ("familie", True, "2026-12-24")
    assert logic.termin_aus_satz("Carla hat halb 5 Klavier", NAMEN, JETZT)["start"].hour == 16
    assert logic.termin_aus_satz("Elternabend nächsten Freitag um 19 Uhr", NAMEN, JETZT)["start"].day == 4
    assert logic.termin_aus_satz("Ben football tomorrow at 3pm", NAMEN, JETZT)["start"].hour == 15
    assert logic.termin_aus_satz("Kino am 5. Dezember um 20 Uhr, fährt Ben", NAMEN, JETZT)["fahrer"] == "ben"
    assert logic.termin_aus_satz("morgen", NAMEN, JETZT) is None


def test_konflikte():
    termine = [
        _t("Zahnarzt", "anna", 10),
        _t("Friseur", "anna", 10, 30),
        _t("Fußball", "ben", 16, beschreibung="🚗 Fahrer: Anna"),
        _t("Yoga", "anna", 16, 30),
        _t("Klavier", "carla", 18),
    ]
    k = logic.konflikte(termine, JETZT, _fahrer, {"anna": "Anna"})
    assert [(x["art"], x["person"]) for x in k] == [("doppelt", "anna"), ("fahrer", "anna")]
    assert "Yoga" in k[1]["text"]
    # Vergangenes zählt nicht
    assert logic.konflikte(termine, JETZT + timedelta(days=2), _fahrer, {}) == []


def test_wochen_vorschau():
    zeilen = logic.wochen_vorschau([_t("Fußball", "ben", 16, tag=30)], datetime(2026, 11, 30).date(), TZ,
                                   {"ben": "Ben"}, mit_person=True)
    assert zeilen == ["Mo 30.11.: 16:00 Fußball (Ben)"]


async def test_satz_dienst_und_textfeld(hass: HomeAssistant, basis):  # noqa: F811
    antwort = await hass.services.async_call(
        DOMAIN, "termin_aus_satz", {"text": "Ben hat morgen um 16 Uhr Fußball, Anna fährt"},
        blocking=True, return_response=True,
    )
    assert antwort["person"] == "ben" and "Anna fährt" in antwort["antwort"]
    await hass.async_block_till_done()
    assert any("Du fährst" in c.data["title"] for c in basis["anna"])

    satz = _sensor(hass, "ubersicht").attributes["formular"]["satz"]
    await hass.services.async_call("text", "set_value", {"entity_id": satz, "value": "Anna hat Montag 9 Uhr Zahnarzt"},
                                   blocking=True)
    await hass.async_block_till_done()
    ev = await hass.services.async_call(
        "calendar", "get_events", {"entity_id": ["calendar.anna", "calendar.ben"], "duration": {"days": 7}},
        blocking=True, return_response=True,
    )
    assert [e["summary"] for e in ev["calendar.anna"]["events"]] == ["Zahnarzt"]
    assert ev["calendar.anna"]["events"][0]["start"].startswith("2026-11-30T09:00")
    assert [e["summary"] for e in ev["calendar.ben"]["events"]] == ["Fußball"]
    assert hass.states.get(satz).state == ""


async def test_konflikt_warnung_und_ereignisse(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):  # noqa: F811
    konflikte = async_capture_events(hass, f"{DOMAIN}_konflikt")
    beginnt = async_capture_events(hass, f"{DOMAIN}_termin_beginnt")
    bald = async_capture_events(hass, f"{DOMAIN}_termin_bald")
    endet = async_capture_events(hass, f"{DOMAIN}_termin_endet")
    start = dt_util.parse_datetime("2026-11-27T15:00:00+01:00")
    for person, titel in (("ben", "Fußball"), ("anna", "Yoga")):
        await hass.services.async_call(
            DOMAIN, "termin_anlegen",
            {"person": person, "titel": titel, "start": start, "dauer": 60,
             **({"fahrer": "anna"} if person == "ben" else {}), "benachrichtigen": False},
            blocking=True,
        )
    basis["anna"].clear()
    await _tick(hass, basis)
    assert _sensor(hass, "terminkonflikte").state == "1"
    assert len(konflikte) == 1 and konflikte[0].data["art"] == "fahrer"
    assert any("Terminkonflikt" in c.data["title"] for c in basis["anna"])
    # nur einmal melden
    basis["anna"].clear()
    await _tick(hass, basis)
    assert not [c for c in basis["anna"] if "Terminkonflikt" in c.data["title"]]

    beginn = _sensor(hass, "ben_nachster_beginn")
    assert dt_util.parse_datetime(beginn.state) == start

    freezer.move_to(start - timedelta(minutes=20))
    await _tick(hass, basis)
    assert {e.data["titel"] for e in bald} == {"Fußball", "Yoga"}

    freezer.move_to(start + timedelta(minutes=1))
    await _tick(hass, basis)
    assert {e.data["titel"] for e in beginnt} == {"Fußball", "Yoga"}
    assert next(x for x in hass.states.async_all("binary_sensor") if x.entity_id.endswith("ben_im_termin")).state == "on"
    fb = next(e for e in beginnt if e.data["titel"] == "Fußball")
    assert fb.data["person"] == "ben" and fb.data["fahrer"] == "anna"

    freezer.move_to(start + timedelta(minutes=61))
    await _tick(hass, basis)
    assert len(endet) == 2
    assert next(x for x in hass.states.async_all("binary_sensor") if x.entity_id.endswith("ben_im_termin")).state == "off"


async def test_wochenrueckblick(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):  # noqa: F811
    await hass.services.async_call(
        DOMAIN, "termin_anlegen",
        {"person": "ben", "titel": "Fußball", "start": dt_util.parse_datetime("2026-12-01T16:00:00+01:00"),
         "benachrichtigen": False},
        blocking=True,
    )
    basis["ben"].clear()
    basis["anna"].clear()
    # Sonntag 18:00 -> automatisch
    freezer.move_to(dt_util.parse_datetime("2026-11-29T18:00:00+01:00"))
    await _tick(hass, basis)
    ben = [c for c in basis["ben"] if "Deine Woche" in c.data["title"]]
    assert ben and "Di 1.12.: 16:00 Fußball" in ben[0].data["message"]
    assert any("Deine Woche: 0 Termine" in c.data["title"] for c in basis["anna"])


def test_blueprints_gueltig():
    from pathlib import Path

    from homeassistant.components.blueprint.models import Blueprint
    from homeassistant.components.automation.config import AUTOMATION_BLUEPRINT_SCHEMA
    from homeassistant.util.yaml import load_yaml

    dateien = sorted(Path(__file__).parent.parent.joinpath("blueprints/automation/familienplaner").glob("*.yaml"))
    assert len(dateien) == 3
    for d in dateien:
        Blueprint(load_yaml(d), expected_domain="automation", schema=AUTOMATION_BLUEPRINT_SCHEMA)


async def test_satz_nicht_verstanden(hass: HomeAssistant, basis):  # noqa: F811
    antwort = await hass.services.async_call(DOMAIN, "termin_aus_satz", {"text": "morgen"}, blocking=True,
                                             return_response=True)
    assert antwort["verstanden"] is False and "nicht verstanden" in antwort["antwort"]
