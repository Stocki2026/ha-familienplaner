"""Tests für Punkte, Belohnungen, Rotation und Familien-Rennen (aufgaben.py)."""


from freezegun.api import FrozenDateTimeFactory
import pytest

from homeassistant.core import Context, HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import ServiceValidationError, Unauthorized
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from pytest_homeassistant_custom_component.common import MockConfigEntry, async_fire_time_changed

from custom_components.familienplaner import aufgaben
from custom_components.familienplaner.const import DOMAIN


def test_punkte_aus_titel():
    assert aufgaben.punkte_aus_titel("Zimmer aufräumen +20", 10) == 20
    assert aufgaben.punkte_aus_titel("Hausaufgaben ⭐ 15", 10) == 15
    assert aufgaben.punkte_aus_titel("Müll", 10) == 10
    assert aufgaben.punkte_aus_titel("🎁 Ben löst ein: Eis +50", 10) == 0


def test_level_und_serie():
    assert aufgaben.level(0)[:2] == (1, "Bobbycar-Pilot")
    assert aufgaben.level(260)[:2] == (3, "Kart-Talent")
    heute = dt_util.parse_datetime("2026-11-27T10:00:00").date()
    assert aufgaben.neue_serie(4, "2026-11-26", heute) == 5
    assert aufgaben.neue_serie(4, "2026-11-20", heute) == 1
    assert aufgaben.neue_serie(4, "2026-11-27", heute) == 4
    assert aufgaben.wer_ist_dran(["ben", "mia"], 3, 0) == "mia"


@pytest.fixture
async def planer(hass: HomeAssistant, enable_custom_integrations, freezer: FrozenDateTimeFactory, tmp_path,
                 hass_admin_user, hass_read_only_user):
    """Familienplaner mit Anna (Elternteil) und Ben (Kind) und echten lokalen Listen."""
    await hass.config.async_set_time_zone("Europe/Berlin")
    hass.config.config_dir = str(tmp_path)
    (tmp_path / ".storage").mkdir()
    freezer.move_to(dt_util.parse_datetime("2026-11-27T10:00:00+01:00"))  # Freitag
    e = MockConfigEntry(domain="local_calendar", data={"calendar_name": "Familie", "storage_key": "familie"})
    e.add_to_hass(hass)
    assert await hass.config_entries.async_setup(e.entry_id)
    for name in ["Familie", "Anna", "Ben"]:
        e = MockConfigEntry(domain="local_todo", data={"todo_list_name": name, "storage_key": "todo_" + name.lower()})
        e.add_to_hass(hass)
        assert await hass.config_entries.async_setup(e.entry_id)
    hass.states.async_set("person.anna", "home", {"user_id": hass_admin_user.id, "friendly_name": "Anna"})
    hass.states.async_set("person.ben", "home", {"user_id": hass_read_only_user.id, "friendly_name": "Ben"})
    await hass.async_block_till_done()

    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"titel": "Familie Test", "familien_kalender": "calendar.familie", "familien_liste": "todo.familie"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    await hass.async_block_till_done()
    for name, rotation in (("Anna", False), ("Ben", True)):
        flow = await hass.config_entries.options.async_init(entry.entry_id)
        flow = await hass.config_entries.options.async_configure(flow["flow_id"], {"next_step_id": "person_neu"})
        flow = await hass.config_entries.options.async_configure(
            flow["flow_id"],
            {"name": name, "farbe": [91, 141, 184], "person_entity": f"person.{name.lower()}",
             "todo_entity": f"todo.{name.lower()}", "rotation": rotation},
        )
        assert flow["type"] is FlowResultType.CREATE_ENTRY
        await hass.async_block_till_done()
    entry = hass.config_entries.async_get_entry(entry.entry_id)
    return {"entry": entry, "m": entry.runtime_data.aufgaben, "anna": hass_admin_user, "ben": hass_read_only_user}


def _eid(hass, key):
    entry_id = hass.config_entries.async_entries(DOMAIN)[0].entry_id
    return er.async_get(hass).async_get_entity_id(key.split(".")[0], DOMAIN, f"{entry_id}_aufgaben_{key.split('.')[1]}")


async def _todo(hass, dienst, daten, user=None):
    await hass.services.async_call("todo", dienst, daten, blocking=True,
                                   context=Context(user_id=user.id) if user else None)
    await hass.async_block_till_done()


async def test_punkte_fuers_abhaken(hass: HomeAssistant, planer):
    m = planer["m"]
    await _todo(hass, "add_item", {"entity_id": "todo.ben", "item": "Zimmer aufräumen +20"})
    await _todo(hass, "add_item", {"entity_id": "todo.ben", "item": "Zähne putzen"})
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "Zimmer aufräumen +20", "status": "completed"})
    assert m.stand("ben")["rennen"] == 20 and m.stand("ben")["konto"] == 20 and m.stand("ben")["heute"] == 1
    assert m.stand("ben")["serie"] == 1
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "Zähne putzen", "status": "completed"})
    assert m.stand("ben")["rennen"] == 30
    # Haken wieder raus -> Punkte weg
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "Zimmer aufräumen +20", "status": "needs_action"})
    assert m.stand("ben")["rennen"] == 10 and m.stand("ben")["heute"] == 1
    # Erledigte löschen ändert nichts, erneutes Abhaken zählt wieder
    await _todo(hass, "remove_completed_items", {"entity_id": "todo.ben"})
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "Zimmer aufräumen +20", "status": "completed"})
    assert m.stand("ben")["rennen"] == 30

    rennen = hass.states.get(_eid(hass, "sensor.rennen"))
    assert rennen.state == "Ben"
    ben = next(f for f in rennen.attributes["fahrer"] if f["slug"] == "ben")
    assert ben["punkte"] == 30 and ben["user_id"] == planer["ben"].id
    assert hass.states.get(_eid(hass, "sensor.punkte_ben")).state == "30"
    # Übersetzte Namen (Testsprache Englisch) und die Entitäten-Liste für das Dashboard
    assert hass.states.get(_eid(hass, "sensor.punkte_ben")).attributes["friendly_name"] == "Familienplaner Points Ben"
    ids = rennen.attributes["entitaeten"]
    for key in ("rennen", "haushalt", "punkte_ben", "punkte_pro_aufgabe", "rennen_ziel", "familienziel_text",
                "rotation_aktiv", "rotation_uhrzeit", "rennen_neu", "dienste_verteilen", "familienziel_einloesen", "insel_neu"):
        assert ids[key] and hass.states.get(ids[key]), key


async def test_familienliste_zaehlt_fuer_wer_abhakt(hass: HomeAssistant, planer):
    m = planer["m"]
    await _todo(hass, "add_item", {"entity_id": "todo.familie", "item": "Wäsche aufhängen ⭐7"})
    await _todo(hass, "update_item", {"entity_id": "todo.familie", "item": "Wäsche aufhängen ⭐7", "status": "completed"},
                user=planer["anna"])
    assert m.stand("anna")["rennen"] == 7 and m.stand("ben")["rennen"] == 0


async def test_belohnung_einloesen(hass: HomeAssistant, planer):
    m = planer["m"]
    ben = Context(user_id=planer["ben"].id)
    antwort = await hass.services.async_call(DOMAIN, "belohnung_einloesen", {"belohnung": "Eis", "kosten": 50},
                                             blocking=True, return_response=True, context=ben)
    assert antwort == {"ok": False, "konto": 0, "fehlt": 50}
    await m.async_buchen("ben", 60, 0)
    antwort = await hass.services.async_call(DOMAIN, "belohnung_einloesen", {"belohnung": "Eis", "kosten": 50},
                                             blocking=True, return_response=True, context=ben)
    assert antwort["ok"] and m.stand("ben")["konto"] == 10 and m.stand("ben")["rennen"] == 60
    items = await hass.services.async_call("todo", "get_items", {"entity_id": "todo.familie"}, blocking=True,
                                           return_response=True)
    eintrag = items["todo.familie"]["items"][0]["summary"]
    assert eintrag == "🎁 Ben redeems: Eis"
    # Abhaken der Belohnung bringt keine Punkte
    await _todo(hass, "update_item", {"entity_id": "todo.familie", "item": eintrag, "status": "completed"},
                user=planer["anna"])
    assert m.stand("anna")["rennen"] == 0
    # Für jemand anderen einlösen darf ein Kind nicht
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "belohnung_einloesen", {"belohnung": "Eis", "kosten": 5, "person": "anna"},
                                       blocking=True, return_response=True, context=ben)


async def test_fahrzeug_waehlen(hass: HomeAssistant, planer):
    m = planer["m"]
    ben = Context(user_id=planer["ben"].id)
    await hass.services.async_call(DOMAIN, "fahrzeug_waehlen", {"person": "ben", "fahrzeug": "Einhorn", "farbe": "Lila"},
                                   blocking=True, context=ben)
    assert m.stand("ben")["fahrzeug"] == "Einhorn" and m.stand("ben")["farbe"] == "Lila"
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "fahrzeug_waehlen", {"person": "anna", "fahrzeug": "Rakete"},
                                       blocking=True, context=ben)
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "punkte_buchen", {"person": "ben", "punkte": 999},
                                       blocking=True, context=ben)
    await hass.services.async_call(DOMAIN, "fahrzeug_waehlen", {"person": "ben", "fahrzeug": "Rakete"},
                                   blocking=True, context=Context(user_id=planer["anna"].id))
    assert m.stand("ben")["fahrzeug"] == "Rakete"


async def test_rotation_und_sieg(hass: HomeAssistant, planer, freezer: FrozenDateTimeFactory):
    m = planer["m"]
    antwort = await hass.services.async_call(DOMAIN, "dienste_verteilen", {}, blocking=True, return_response=True)
    # Freitag: Spülmaschine + Tisch, Müll nur Mo/Do; nur Ben macht mit
    assert sorted(v["person"] for v in antwort["verteilt"]) == ["ben", "ben"]
    items = await hass.services.async_call("todo", "get_items", {"entity_id": "todo.ben"}, blocking=True,
                                           return_response=True)
    titel = [i["summary"] for i in items["todo.ben"]["items"]]
    assert "🍽️ Empty the dishwasher +15" in titel
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "🍽️ Empty the dishwasher +15", "status": "completed"})
    assert m.stand("ben")["rennen"] == 15

    # Ziellinie über die Einstellungs-Entität senken -> Sieg mit Bonus
    await hass.services.async_call("number", "set_value", {"entity_id": _eid(hass, "number.rennen_ziel"), "value": 20},
                                   blocking=True)
    await m.async_buchen("ben", 10, 0)
    assert m.daten["sieger"] == "Ben" and m.stand("ben")["konto"] == 25 + 50
    await hass.services.async_call("button", "press", {"entity_id": _eid(hass, "button.rennen_neu")}, blocking=True)
    assert m.daten["sieger"] == "" and m.stand("ben")["rennen"] == 0 and m.stand("ben")["konto"] == 75

    # Rotation automatisch zur eingestellten Uhrzeit am nächsten Morgen
    freezer.move_to(dt_util.parse_datetime("2026-11-30T06:30:00+01:00"))  # Montag
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    items = await hass.services.async_call("todo", "get_items", {"entity_id": "todo.ben"}, blocking=True,
                                           return_response=True)
    assert any(i["summary"].startswith("🗑️") for i in items["todo.ben"]["items"])
    # Serie abgerissen (letzte Aufgabe Freitag) -> nach Mitternacht 0
    assert m.stand("ben")["serie"] == 0 and m.stand("ben")["heute"] == 0


async def test_schatzkarte(hass: HomeAssistant, planer):
    """Die ganze Familie läuft gemeinsam: Stationen bringen Familien-Belohnungen in die Familienliste."""
    m = planer["m"]
    sk = hass.states.get(_eid(hass, "sensor.rennen")).attributes["schatzkarte"]
    assert sk["insel"] == 1 and sk["punkte"] == 0 and sk["stationen"][0]["name"] == "Shell Beach"
    assert sk["naechste"] == "Shell Beach" and sk["fehlt"] == 150 and sk["ziel"] == 1300

    # Anna und Ben sammeln gemeinsam
    await m.async_buchen("anna", 100, 1)
    await m.async_buchen("ben", 280, 1)
    await hass.async_block_till_done()
    sk = hass.states.get(_eid(hass, "sensor.rennen")).attributes["schatzkarte"]
    assert sk["punkte"] == 380 and [s["erreicht"] for s in sk["stationen"]][:3] == [True, True, False]
    assert sk["naechste"] == "Fire Mountain" and sk["fehlt"] == 220
    items = await hass.services.async_call("todo", "get_items", {"entity_id": "todo.familie"}, blocking=True,
                                           return_response=True)
    titel = [i["summary"] for i in items["todo.familie"]["items"]]
    assert titel == ["🎁 🐚 Shell Beach: Ice cream together 🍦", "🎁 🌴 Palm Oasis: Game night 🎲"]
    # Abhaken der Familien-Belohnung bringt keine Punkte
    await _todo(hass, "update_item", {"entity_id": "todo.familie", "item": titel[0], "status": "completed"},
                user=planer["anna"])
    assert m.stand("anna")["rennen"] == 100 and m.daten["insel"]["punkte"] == 380

    # Eigene Stationen (nur Eltern/Admins); schon überschrittene gelten als erreicht, ohne neue Aufgabe
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "schatzkarte_festlegen", {"stationen": [
            {"name": "Zoo", "belohnung": "Zoo", "punkte": 10}]}, blocking=True, context=Context(user_id=planer["ben"].id))
    await hass.services.async_call(DOMAIN, "schatzkarte_festlegen", {"stationen": [
        {"name": "Schwimmbad", "belohnung": "Schwimmen", "punkte": 500, "emoji": "🏊"},
        {"name": "Spielplatz", "belohnung": "Spielplatz", "punkte": 200},
    ]}, blocking=True, context=Context(user_id=planer["anna"].id))
    assert [s["name"] for s in m.daten["stationen"]] == ["Spielplatz", "Schwimmbad"] and m.daten["insel"]["erreicht"] == 1
    await m.async_buchen("ben", 120, 0)
    items = await hass.services.async_call("todo", "get_items", {"entity_id": "todo.familie"}, blocking=True,
                                           return_response=True)
    assert items["todo.familie"]["items"][-1]["summary"] == "🎁 🏊 Schwimmbad: Schwimmen"
    assert len(items["todo.familie"]["items"]) == 3
    sk = hass.states.get(_eid(hass, "sensor.rennen")).attributes["schatzkarte"]
    assert sk["naechste"] is None and sk["fehlt"] == 0

    # Neue Insel per Taste: von vorne, Inselnummer steigt
    await hass.services.async_call("button", "press", {"entity_id": _eid(hass, "button.insel_neu")}, blocking=True)
    assert m.daten["insel"] == {"nummer": 2, "punkte": 0, "erreicht": 0}


async def test_aufgaben_katalog(hass: HomeAssistant, planer):
    """Vorgefertigte Haushaltsaufgaben: Kinder nehmen sich selbst welche, Eltern dürfen sie verteilen."""
    m = planer["m"]
    katalog = hass.states.get(_eid(hass, "sensor.rennen")).attributes["katalog"]
    assert len(katalog) > 40 and {"kueche", "putzen", "waesche", "ordnung", "draussen", "tiere"} <= {a["bereich"] for a in katalog}
    assert len({a["key"] for a in katalog}) == len(katalog)
    ben = Context(user_id=planer["ben"].id)

    async def titel(liste):
        items = await hass.services.async_call("todo", "get_items", {"entity_id": liste}, blocking=True,
                                               return_response=True)
        return [(i["summary"], i.get("due")) for i in items[liste]["items"]]

    # Ben nimmt sich selbst eine Aufgabe; eigene Punkte setzen darf er nicht
    antwort = await hass.services.async_call(DOMAIN, "aufgabe_nehmen", {"aufgabe": "staubsaugen", "punkte": 500},
                                             blocking=True, return_response=True, context=ben)
    assert antwort == {"person": "ben", "liste": "todo.ben", "aufgabe": "🧹 Vacuum +25"}
    assert await titel("todo.ben") == [("🧹 Vacuum +25", "2026-11-27")]
    # ... und nicht für Anna
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "aufgabe_nehmen", {"aufgabe": "staubsaugen", "person": "anna"},
                                       blocking=True, context=ben)
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "aufgabe_nehmen", {"aufgabe": "gibt es nicht"}, blocking=True, context=ben)
    # Ein Wand-Tablet (Benutzer ohne eigene Person) darf für alle nehmen, aber keine Punkte ändern
    tablet = await hass.auth.async_create_user("Wand-Tablet")
    await hass.services.async_call(DOMAIN, "aufgabe_nehmen", {"aufgabe": "blumen", "person": "anna", "punkte": 99},
                                   blocking=True, context=Context(user_id=tablet.id))
    assert [t for t, _ in await titel("todo.anna")] == ["🪴 Water the plants +10"]
    # Anna (Admin) gibt Ben eine Aufgabe mit Extra-Punkten
    await hass.services.async_call(DOMAIN, "aufgabe_nehmen", {"aufgabe": "🐶 Walk the dog", "person": "ben", "punkte": 30},
                                   blocking=True, context=Context(user_id=planer["anna"].id))
    assert ("🐶 Walk the dog +30", "2026-11-27") in await titel("todo.ben")
    # Abhaken bringt die Punkte
    await _todo(hass, "update_item", {"entity_id": "todo.ben", "item": "🧹 Vacuum +25", "status": "completed"})
    assert m.stand("ben")["rennen"] == 25

    # Eigener Katalog (nur Admins)
    with pytest.raises(Unauthorized):
        await hass.services.async_call(DOMAIN, "katalog_festlegen", {"aufgaben": [{"titel": "x"}]}, blocking=True, context=ben)
    await hass.services.async_call(DOMAIN, "katalog_festlegen", {"aufgaben": [
        {"titel": "🦜 Feed the parrot", "punkte": 7, "bereich": "tiere"}]}, blocking=True)
    assert m.daten["katalog"] == [{"titel": "🦜 Feed the parrot", "punkte": 7, "bereich": "tiere", "key": "feed_the_parrot"}]


async def test_punkte_bleiben_nach_neustart(hass: HomeAssistant, planer):
    m = planer["m"]
    await m.async_buchen("ben", 42, 1)
    await hass.config_entries.async_reload(planer["entry"].entry_id)
    await hass.async_block_till_done()
    m2 = hass.config_entries.async_get_entry(planer["entry"].entry_id).runtime_data.aufgaben
    assert m2.stand("ben")["konto"] == 42


async def test_deutsch(hass: HomeAssistant, enable_custom_integrations, tmp_path):
    """Mit deutscher Systemsprache sind Dienste, Belohnungen und Texte deutsch."""
    hass.config.language = "de"
    hass.config.config_dir = str(tmp_path)
    (tmp_path / ".storage").mkdir(exist_ok=True)
    e = MockConfigEntry(domain="local_calendar", data={"calendar_name": "Familie", "storage_key": "familie"})
    e.add_to_hass(hass)
    assert await hass.config_entries.async_setup(e.entry_id)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"titel": "Familie Test", "familien_kalender": "calendar.familie"}
    )
    await hass.async_block_till_done()
    m = result["result"].runtime_data.aufgaben
    assert m.daten["dienste"][0]["titel"] == "🍽️ Spülmaschine ausräumen"
    assert m.daten["belohnungen"][0]["name"] == "Eis essen"
    assert m.einstellungen["familienziel_text"] == "Pizza- und Filmabend 🍕"
    assert aufgaben._t(hass, "belohnung_aufgabe", name="Carla", belohnung="Kino") == "🎁 Carla löst ein: Kino"
    assert aufgaben.level(260, "en")[1] == "Kart talent"
    assert m.daten["stationen"][0]["name"] == "Muschelstrand"
    assert m.daten["katalog"][0]["titel"] == "🍽️ Spülmaschine ausräumen"
