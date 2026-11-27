"""Ganztägig-Schalter des Termin-Formulars."""

from .entity import erweiterungen
from .form import GanztagSwitch


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([GanztagSwitch(entry.runtime_data)] + erweiterungen(entry.runtime_data, "switch"))
