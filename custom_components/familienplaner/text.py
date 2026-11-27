"""Textfelder des Termin-Formulars."""

from .entity import erweiterungen
from .form import SatzText, TitelText


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([
        TitelText(c, "titel", "Neuer Termin: Was?", "mdi:text"),
        TitelText(c, "ort", "Neuer Termin: Wo?", "mdi:map-marker"),
        SatzText(c),
    ] + erweiterungen(c, "text"))
