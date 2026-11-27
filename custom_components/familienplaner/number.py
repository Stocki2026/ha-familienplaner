"""Dauer des Termin-Formulars."""

from .entity import erweiterungen
from .form import DauerNumber


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([DauerNumber(entry.runtime_data)] + erweiterungen(entry.runtime_data, "number"))
