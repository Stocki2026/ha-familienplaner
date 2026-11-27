"""Datum/Uhrzeit des Termin-Formulars."""

from .form import StartDateTime


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([StartDateTime(entry.runtime_data)])
