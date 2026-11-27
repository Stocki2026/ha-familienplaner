"""Uhrzeit-Entitäten (Haushalts-Rotation)."""

from .entity import erweiterungen


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities(erweiterungen(entry.runtime_data, "time"))
