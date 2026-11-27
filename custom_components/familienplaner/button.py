"""Knöpfe: Termin anlegen, Morgen-Ansage."""

from .form import AnlegenButton, AnsageButton


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([AnlegenButton(c), AnsageButton(c)])
