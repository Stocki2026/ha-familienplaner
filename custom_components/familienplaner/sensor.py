"""Sensoren: nächster Termin pro Person, Countdowns, Müll, Ferien, Pinnwand, Übersicht."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.util import dt as dt_util

from . import logic
from .const import (
    CONF_FAMILY_CALENDAR,
    CONF_FAMILY_TODO,
    CONF_HOLIDAY_CALENDAR,
    CONF_MEAL_CALENDAR,
    CONF_PINBOARD_TODO,
    CONF_SCHOOL_CALENDAR,
    CONF_SHOPPING_TODO,
    CONF_SPECIAL_CALENDAR,
    CONF_WASTE_CALENDAR,
    CONF_WEATHER,
    DOMAIN,
    FAMILY_COLOR,
)
from .coordinator import FamilienplanerCoordinator
from .entity import FamilienplanerEntity, erweiterungen
from .models import Person


async def async_setup_entry(hass: HomeAssistant, entry, async_add_entities: AddEntitiesCallback) -> None:
    coord: FamilienplanerCoordinator = entry.runtime_data
    entities: list[SensorEntity] = [NaechsterTerminSensor(coord, p) for p in coord.personen]
    entities += [BeginnSensor(coord, p) for p in coord.personen]
    entities += [
        UebersichtSensor(coord),
        CountdownSensor(coord),
        MuellSensor(coord),
        FerienSensor(coord),
        PinnwandSensor(coord),
        KonflikteSensor(coord),
    ]
    async_add_entities(entities + erweiterungen(coord, "sensor"))


class NaechsterTerminSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:calendar-clock"

    def __init__(self, coord: FamilienplanerCoordinator, person: Person) -> None:
        super().__init__(coord, f"{person.slug}_naechster_termin")
        self._slug = person.slug
        self._attr_name = f"{person.name} nächster Termin"
        self._person = person

    @property
    def native_value(self) -> str:
        t = self.coordinator.data.naechste.get(self._slug) if self.coordinator.data else None
        return (t.summary if t else "Nichts geplant")[:250]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        jetzt = dt_util.now()
        daten = self.coordinator.data
        t = daten.naechste.get(self._slug) if daten else None
        p = self._person
        wo = "–"
        if p.person_entity and (st := self.hass.states.get(p.person_entity)):
            wo = {"home": "🏠 zu Hause", "not_home": "🚗 unterwegs"}.get(st.state, f"📍 {st.state}")
        heute = daten.heute.get(self._slug, []) if daten else []
        return {
            "person": p.slug,
            "name": p.name,
            "farbe": p.farbe,
            "wann": logic.wann_text(t, jetzt),
            "wo": wo,
            "start": t.start.isoformat() if t else None,
            "ende": t.end.isoformat() if t else None,
            "ort": t.location if t else "",
            "fahrer": t.fahrer if t else "",
            "heute": [x.as_dict() for x in heute][:12],
        }


class UebersichtSensor(FamilienplanerEntity, SensorEntity):
    """Beschreibt die Familie fürs automatische Dashboard."""

    _attr_icon = "mdi:home-heart"
    _attr_name = "Übersicht"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "uebersicht")

    def _id(self, key: str) -> str | None:
        reg = er.async_get(self.hass)
        return reg.async_get_entity_id(
            key.split(".")[0], DOMAIN, f"{self.coordinator.config_entry.entry_id}_{key.split('.')[1]}"
        )

    @property
    def native_value(self) -> int:
        return len(self.coordinator.personen)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        c = self.coordinator
        o = c.opt
        personen = [
            {
                "slug": p.slug,
                "name": p.name,
                "farbe": p.farbe,
                "person": p.person_entity,
                "kalender": p.calendar_entity,
                "liste": p.todo_entity,
                "sensor": self._id(f"sensor.{p.slug}_naechster_termin"),
                "beginn": self._id(f"sensor.{p.slug}_naechster_beginn"),
                "im_termin": self._id(f"binary_sensor.{p.slug}_im_termin"),
                "user_id": (self.hass.states.get(p.person_entity).attributes.get("user_id")
                            if p.person_entity and self.hass.states.get(p.person_entity) else None),
            }
            for p in c.personen
        ]
        formular = {k: self._id(v) for k, v in {
            "person": "select.form_person", "fahrer": "select.form_fahrer", "titel": "text.form_titel",
            "ort": "text.form_ort", "start": "datetime.form_start", "dauer": "number.form_dauer",
            "ganztag": "switch.form_ganztag", "anlegen": "button.form_anlegen", "satz": "text.form_satz",
        }.items()}
        return {
            "familie": {"name": c.config_entry.title, "farbe": FAMILY_COLOR, "kalender": o.get(CONF_FAMILY_CALENDAR),
                        "liste": o.get(CONF_FAMILY_TODO)},
            "personen": personen,
            "kalender": {
                "besondere_tage": o.get(CONF_SPECIAL_CALENDAR), "feiertage": o.get(CONF_HOLIDAY_CALENDAR),
                "muellabfuhr": o.get(CONF_WASTE_CALENDAR), "schulferien": o.get(CONF_SCHOOL_CALENDAR),
                "essensplan": o.get(CONF_MEAL_CALENDAR),
            },
            "listen": {"einkauf": o.get(CONF_SHOPPING_TODO), "pinnwand": o.get(CONF_PINBOARD_TODO)},
            "wetter": o.get(CONF_WEATHER),
            "sensoren": {k: self._id(v) for k, v in {
                "countdowns": "sensor.countdowns", "muell": "sensor.muell", "ferien": "sensor.ferien",
                "pinnwand": "sensor.pinnwand", "konflikte": "sensor.konflikte",
            }.items()},
            "formular": formular,
            "ansage": self._id("button.morgen_ansage"),
            "stil": self._id("select.stil"),
            "figuren": {p.slug: c.figuren[p.slug] for p in c.personen if p.slug in c.figuren},
        }


class CountdownSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:timer-sand"
    _attr_name = "Countdowns"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "countdowns")

    @property
    def native_value(self) -> str:
        l = self.coordinator.data.countdowns if self.coordinator.data else []
        return f"{l[0]['titel']} · {logic.countdown_text(l[0]['tage'])}"[:250] if l else "Nichts geplant"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        l = self.coordinator.data.countdowns if self.coordinator.data else []
        return {"liste": [{**x, "text": logic.countdown_text(x["tage"])} for x in l]}


class MuellSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:trash-can-outline"
    _attr_name = "Müllabfuhr"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "muell")

    @property
    def native_value(self) -> str:
        l = self.coordinator.data.muell if self.coordinator.data else []
        if not l:
            return "unbekannt"
        erste = [x["tonne"] for x in l if x["tage"] == l[0]["tage"]]
        tage = l[0]["tage"]
        wann = "heute" if tage == 0 else ("morgen" if tage == 1 else f"in {tage} Tagen")
        return f"{' + '.join(erste)} · {wann}"[:250]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"naechste": self.coordinator.data.muell if self.coordinator.data else []}


class FerienSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:beach"
    _attr_name = "Schulferien"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "ferien")

    @property
    def native_value(self) -> str:
        f = self.coordinator.data.ferien if self.coordinator.data else {}
        return f.get("text", "unbekannt")[:250]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        f = self.coordinator.data.ferien if self.coordinator.data else {}
        return {"ferien_jetzt": bool(f.get("jetzt")), "tage": f.get("tage")}


class PinnwandSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:pin"
    _attr_name = "Pinnwand"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "pinnwand")

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data.pinnwand) if self.coordinator.data else 0

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"notizen": self.coordinator.data.pinnwand if self.coordinator.data else []}


class BeginnSensor(FamilienplanerEntity, SensorEntity):
    """Beginn des nächsten Termins als Zeitstempel – für Automationen (Wecklicht, Heizung …)."""

    _attr_icon = "mdi:clock-start"
    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(self, coord: FamilienplanerCoordinator, person: Person) -> None:
        super().__init__(coord, f"{person.slug}_naechster_beginn")
        self._slug = person.slug
        self._attr_name = f"{person.name} nächster Beginn"

    def _termin(self):
        daten = self.coordinator.data
        jetzt = dt_util.now()
        if not daten:
            return None
        kommend = [t for t in daten.alle_kurz
                   if t.person in (self._slug, "familie") and not t.ganztag and t.start > jetzt]
        return logic.sortiert(kommend)[0] if kommend else None

    @property
    def native_value(self):
        t = self._termin()
        return t.start if t else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        t = self._termin()
        return {"titel": t.summary, "ort": t.location, "fahrer": t.fahrer} if t else {}


class KonflikteSensor(FamilienplanerEntity, SensorEntity):
    _attr_icon = "mdi:calendar-alert"
    _attr_name = "Terminkonflikte"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "konflikte")

    @property
    def native_value(self) -> int:
        return len(self.coordinator.data.konflikte) if self.coordinator.data else 0

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        liste = self.coordinator.data.konflikte if self.coordinator.data else []
        return {"liste": [{k: v for k, v in x.items() if k != "key"} for x in liste]}
