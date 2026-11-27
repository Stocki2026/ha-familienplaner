"""Knöpfe: Termin anlegen, Morgen-Ansage."""

from .entity import erweiterungen
from .form import AnlegenButton, AnsageButton


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([AnlegenButton(c), AnsageButton(c)] + erweiterungen(c, "button"))
