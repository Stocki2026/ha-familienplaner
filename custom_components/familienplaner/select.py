"""Auswahlfelder: Termin-Formular und Stil (Aussehen) des Dashboards."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.const import EntityCategory
from homeassistant.helpers.restore_state import RestoreEntity

from .entity import FamilienplanerEntity
from .form import FahrerSelect, PersonSelect

STILE = ["klassisch", "zauber"]


class StilSelect(FamilienplanerEntity, RestoreEntity, SelectEntity):
    """Welches Aussehen das Familienplaner-Dashboard hat (umschaltbar, bleibt nach Neustart erhalten)."""

    _attr_translation_key = "stil"
    _attr_icon = "mdi:palette-outline"
    _attr_options = STILE
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, coord) -> None:
        super().__init__(coord, "stil")
        self._attr_current_option = STILE[0]

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        alt = await self.async_get_last_state()
        if alt and alt.state in STILE:
            self._attr_current_option = alt.state

    async def async_select_option(self, option: str) -> None:
        if option in STILE:
            self._attr_current_option = option
            self.async_write_ha_state()

    def _handle_coordinator_update(self) -> None:
        self.async_write_ha_state()


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([PersonSelect(c), FahrerSelect(c), StilSelect(c)])
