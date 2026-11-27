"""Gemeinsame Basis für alle Entitäten."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import FamilienplanerCoordinator


class FamilienplanerEntity(CoordinatorEntity[FamilienplanerCoordinator]):
    """Hängt alle Entitäten an ein Gerät „Familienplaner“."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: FamilienplanerCoordinator, key: str) -> None:
        super().__init__(coordinator)
        entry = coordinator.config_entry
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Familienplaner",
            manufacturer="Familienplaner",
            model=entry.title,
            entry_type=DeviceEntryType.SERVICE,
        )
