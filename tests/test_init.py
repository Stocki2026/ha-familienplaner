"""Integrationstests mit echten lokalen Kalendern und Listen."""

from datetime import timedelta

from freezegun.api import FrozenDateTimeFactory
import pytest

from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import (
    MockConfigEntry,
    async_fire_time_changed,
    async_mock_service,
)

from custom_components.familienplaner.const import DOMAIN


@pytest.fixture
async def basis(hass: HomeAssistant, enable_custom_integrations, freezer: FrozenDateTimeFactory, tmp_path):
    """Lokale Kalender/Listen + Familienplaner mit zwei Personen einrichten."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    hass.config.config_dir = str(tmp_path)
    (tmp_path / ".storage").mkdir()
    freezer.move_to(dt_util.parse_datetime("2026-11-27T10:00:00+01:00"))
    for name in ["Familie", "Anna", "Ben", "Besondere Tage", "Essensplan"]:
        e = MockConfigEntry(domain="local_calendar", data={"calendar_name": name, "storage_key": name.lower().replace(" ", "_")})
        e.add_to_hass(hass)
        assert await hass.config_entries.async_setup(e.entry_id)
    for name in ["Familie", "Einkaufsliste", "Pinnwand"]:
        e = MockConfigEntry(domain="local_todo", data={"todo_list_name": name, "storage_key": "todo_" + name.lower()})
        e.add_to_hass(hass)
        assert await hass.config_entries.async_setup(e.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("calendar.anna") and hass.states.get("todo.einkaufsliste")

    notify_anna = async_mock_service(hass, "notify", "mobile_app_anna")
    notify_ben = async_mock_service(hass, "notify", "mobile_app_ben")

    # Einrichtung über den echten Config-Flow
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {"titel": "Familie Test", "familien_kalender": "calendar.familie", "familien_liste": "todo.familie",
         "einkaufsliste": "todo.einkaufsliste"},
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    await hass.async_block_till_done()

    for name, notify in (("Anna", "notify.mobile_app_anna"), ("Ben", "notify.mobile_app_ben")):
        flow = await hass.config_entries.options.async_init(entry.entry_id)
        assert flow["type"] is FlowResultType.MENU
        flow = await hass.config_entries.options.async_configure(flow["flow_id"], {"next_step_id": "person_neu"})
        flow = await hass.config_entries.options.async_configure(
            flow["flow_id"],
            {"name": name, "farbe": [91, 141, 184], "calendar_entity": f"calendar.{name.lower()}", "notify_service": notify},
        )
        assert flow["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()

    flow = await hass.config_entries.options.async_init(entry.entry_id)
    flow = await hass.config_entries.options.async_configure(flow["flow_id"], {"next_step_id": "kalender"})
    flow = await hass.config_entries.options.async_configure(
        flow["flow_id"],
        {"besondere_tage": "calendar.besondere_tage", "essensplan": "calendar.essensplan", "pinnwand": "todo.pinnwand"},
    )
    assert flow["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    return {"entry": hass.config_entries.async_get_entry(entry.entry_id), "anna": notify_anna, "ben": notify_ben}


async def _tick(hass, basis):
    """Zeit vorspulen: geplante Zeit-Trigger auslösen und den Coordinator aktualisieren."""
    async_fire_time_changed(hass)
    await basis["entry"].runtime_data.async_refresh()
    await hass.async_block_till_done()


def _sensor(hass, suffix):
    return next(s for s in hass.states.async_all("sensor") if s.entity_id.endswith(suffix))


async def test_termin_anlegen_und_erinnerung(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):
    assert len(basis["entry"].options["personen"]) == 2
    start = dt_util.parse_datetime("2026-11-27T15:00:00+01:00")
    await hass.services.async_call(
        DOMAIN, "termin_anlegen",
        {"person": "ben", "titel": "Fußball", "start": start, "dauer": 90, "ort": "Sportplatz", "fahrer": "anna"},
        blocking=True,
    )
    await hass.async_block_till_done()
    # Bestätigung an Ben, Fahrer-Info an Anna
    assert any("Neuer Termin" in c.data["title"] for c in basis["ben"])
    assert any("Du fährst" in c.data["title"] for c in basis["anna"])

    ben = _sensor(hass, "ben_nachster_termin")
    assert ben.state == "Fußball"
    assert ben.attributes["fahrer"] == "Anna"
    assert ben.attributes["wann"] == "heute 15:00"

    # 25 Minuten vorher -> Erinnerung an Ben und Fahrer Anna
    basis["ben"].clear()
    basis["anna"].clear()
    freezer.move_to(start - timedelta(minutes=25))
    await _tick(hass, basis)
    assert any("In 25 Min: Fußball" in c.data["title"] for c in basis["ben"])
    assert any("Gleich fahren" in c.data["title"] for c in basis["anna"])
    assert _sensor(hass, "ben_nachster_termin").attributes["wann"] == "in 25 Min"

    # nicht doppelt
    basis["ben"].clear()
    freezer.tick(timedelta(minutes=2))
    await _tick(hass, basis)
    assert not basis["ben"]


async def test_formular_entitaeten(hass: HomeAssistant, basis):
    u = _sensor(hass, "ubersicht")
    f = u.attributes["formular"]
    assert all(f.values()), f
    await hass.services.async_call("select", "select_option", {"entity_id": f["person"], "option": "Anna"}, blocking=True)
    await hass.services.async_call("text", "set_value", {"entity_id": f["titel"], "value": "Zahnarzt"}, blocking=True)
    await hass.services.async_call("datetime", "set_value",
                                   {"entity_id": f["start"], "datetime": "2026-11-28 09:00:00"}, blocking=True)
    await hass.services.async_call("button", "press", {"entity_id": f["anlegen"]}, blocking=True)
    await hass.async_block_till_done()
    antwort = await hass.services.async_call(
        "calendar", "get_events", {"entity_id": "calendar.anna", "duration": {"days": 3}}, blocking=True, return_response=True
    )
    assert [e["summary"] for e in antwort["calendar.anna"]["events"]] == ["Zahnarzt"]
    assert hass.states.get(f["titel"]).state == ""  # Formular zurückgesetzt
    assert [p["name"] for p in u.attributes["personen"]] == ["Anna", "Ben"]


async def test_gericht_und_pinnwand(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):
    await hass.services.async_call(
        DOMAIN, "gericht_planen", {"tag": "2026-11-27", "gericht": "Lasagne", "zutaten": "Nudelplatten\nHackfleisch"},
        blocking=True,
    )
    await hass.services.async_call("todo", "add_item", {"entity_id": "todo.pinnwand", "item": "Oma kommt Sonntag"}, blocking=True)
    freezer.tick(timedelta(minutes=1))
    await _tick(hass, basis)
    assert hass.states.get("todo.einkaufsliste").state == "2"
    assert _sensor(hass, "pinnwand").attributes["notizen"] == ["Oma kommt Sonntag"]
    antwort = await hass.services.async_call(DOMAIN, "morgen_ansage", {}, blocking=True, return_response=True)
    assert "Lasagne" in antwort["text"]


async def test_countdowns_und_geburtstag(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):
    await hass.services.async_call(
        "calendar", "create_event",
        {"entity_id": "calendar.besondere_tage", "summary": "🎂 Geburtstag Oma", "start_date": "2026-12-04", "end_date": "2026-12-05"},
        blocking=True,
    )
    # Langer Cache wird nach 15 Min neu geladen
    freezer.tick(timedelta(minutes=16))
    await _tick(hass, basis)
    c = _sensor(hass, "countdowns")
    assert c.attributes["liste"][0]["tage"] == 7
    # Geburtstags-Assistent um 08:00 am nächsten Morgen? Heute ist der 27., Geburtstag in 7 Tagen -> am 27. um 8:00
    freezer.move_to(dt_util.parse_datetime("2026-11-28T08:00:00+01:00"))
    await _tick(hass, basis)
    # am 28. sind es 6 Tage -> keine Aufgabe; 7 Tage vorher war der 27. -> nachholen nicht vorgesehen
    assert hass.states.get("todo.familie").state == "0"


async def test_geburtstags_assistent_und_muell(hass: HomeAssistant, basis, freezer: FrozenDateTimeFactory):
    coord = basis["entry"].runtime_data
    await hass.services.async_call(
        "calendar", "create_event",
        {"entity_id": "calendar.besondere_tage", "summary": "Geburtstag von Lisa", "start_date": "2026-12-05", "end_date": "2026-12-06"},
        blocking=True,
    )
    freezer.move_to(dt_util.parse_datetime("2026-11-28T08:00:00+01:00"))
    await coord._geburtstags_assistent(dt_util.now())
    await hass.async_block_till_done()
    antwort = await hass.services.async_call(
        "todo", "get_items", {"entity_id": "todo.familie"}, blocking=True, return_response=True
    )
    items = antwort["todo.familie"]["items"]
    assert items[0]["summary"] == "🎁 Geschenk für Lisa besorgen"
    assert items[0]["due"] == "2026-12-04"
    assert any("In einer Woche" in c.data["title"] for c in basis["anna"])

    # Tagesübersicht morgens: Termin heute -> Push an Anna
    await hass.services.async_call(
        DOMAIN, "termin_anlegen",
        {"person": "anna", "titel": "Zahnarzt", "start": dt_util.parse_datetime("2026-11-28T11:00:00+01:00"),
         "benachrichtigen": False},
        blocking=True,
    )
    basis["anna"].clear()
    await coord._tagesuebersicht_heute(dt_util.now())
    await hass.async_block_till_done()
    assert basis["anna"][0].data["title"].startswith("☀️ Dein Tag heute (1 Termin)")
    assert "11:00 Zahnarzt" in basis["anna"][0].data["message"]
