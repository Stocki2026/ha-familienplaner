"""Auswahlfelder des Termin-Formulars."""

from .form import FahrerSelect, PersonSelect


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([PersonSelect(c), FahrerSelect(c)])
