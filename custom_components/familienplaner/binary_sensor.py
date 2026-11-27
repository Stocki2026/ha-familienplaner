"""Binärsensoren: „hat gerade einen Termin“ pro Person – praktisch für eigene Automationen."""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.util import dt as dt_util

from .entity import FamilienplanerEntity, erweiterungen
from .models import Person


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([ImTerminSensor(c, p) for p in c.personen] + erweiterungen(c, "binary_sensor"))


class ImTerminSensor(FamilienplanerEntity, BinarySensorEntity):
    _attr_icon = "mdi:calendar-account"

    def __init__(self, coord, person: Person) -> None:
        super().__init__(coord, f"{person.slug}_im_termin")
        self._slug = person.slug
        self._attr_name = f"{person.name} im Termin"

    def _laufend(self):
        jetzt = dt_util.now()
        daten = self.coordinator.data
        for t in (daten.heute.get(self._slug, []) if daten else []):
            if not t.ganztag and t.start <= jetzt < t.end:
                return t
        return None

    @property
    def is_on(self) -> bool:
        return self._laufend() is not None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        t = self._laufend()
        return {"titel": t.summary, "ort": t.location, "ende": t.end.isoformat()} if t else {}
