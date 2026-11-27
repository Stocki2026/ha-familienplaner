"""Formular „Neuer Termin“ als normale Entitäten (funktioniert in jedem Dashboard und in der App)."""

from __future__ import annotations

from datetime import datetime

from homeassistant.components.button import ButtonEntity
from homeassistant.components.datetime import DateTimeEntity
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.components.select import SelectEntity
from homeassistant.components.switch import SwitchEntity
from homeassistant.components.text import TextEntity
from homeassistant.const import UnitOfTime
from homeassistant.exceptions import HomeAssistantError

from .const import FAMILY
from .coordinator import FamilienplanerCoordinator, formular_standard
from .entity import FamilienplanerEntity


class _Feld(FamilienplanerEntity):
    _feld: str

    def __init__(self, coord: FamilienplanerCoordinator, feld: str, name: str, icon: str) -> None:
        super().__init__(coord, f"form_{feld}")
        self._feld = feld
        self._attr_name = name
        self._attr_icon = icon

    @property
    def _wert(self):
        return self.coordinator.formular.get(self._feld)

    def _setzen(self, wert) -> None:
        self.coordinator.formular[self._feld] = wert
        self.async_write_ha_state()

    def _handle_coordinator_update(self) -> None:
        self.async_write_ha_state()


class PersonSelect(_Feld, SelectEntity):
    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "person", "Neuer Termin: Für wen?", "mdi:account-question")

    @property
    def _mapping(self) -> dict[str, str]:
        return {"Familie": FAMILY, **{p.name: p.slug for p in self.coordinator.personen}}

    @property
    def options(self) -> list[str]:
        return list(self._mapping)

    @property
    def current_option(self) -> str | None:
        return next((n for n, s in self._mapping.items() if s == self._wert), "Familie")

    async def async_select_option(self, option: str) -> None:
        self._setzen(self._mapping.get(option, FAMILY))


class FahrerSelect(_Feld, SelectEntity):
    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "fahrer", "Neuer Termin: Wer fährt?", "mdi:car")

    @property
    def _mapping(self) -> dict[str, str]:
        return {"Niemand": "niemand", **{p.name: p.slug for p in self.coordinator.personen}}

    @property
    def options(self) -> list[str]:
        return list(self._mapping)

    @property
    def current_option(self) -> str | None:
        return next((n for n, s in self._mapping.items() if s == self._wert), "Niemand")

    async def async_select_option(self, option: str) -> None:
        self._setzen(self._mapping.get(option, "niemand"))


class TitelText(_Feld, TextEntity):
    _attr_native_max = 120

    def __init__(self, coord: FamilienplanerCoordinator, feld: str, name: str, icon: str) -> None:
        super().__init__(coord, feld, name, icon)

    @property
    def native_value(self) -> str:
        return self._wert or ""

    async def async_set_value(self, value: str) -> None:
        self._setzen(value)


class SatzText(_Feld, TextEntity):
    """„Termin in einem Satz“: Text eingeben -> Termin wird sofort angelegt."""

    _attr_native_max = 200

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "satz", "Termin in einem Satz", "mdi:message-text-clock")

    @property
    def native_value(self) -> str:
        return self._wert or ""

    async def async_set_value(self, value: str) -> None:
        from . import async_termin_aus_satz  # noqa: PLC0415 (Zirkelimport vermeiden)

        if not value.strip():
            self._setzen("")
            return
        await async_termin_aus_satz(self.coordinator, value)
        self._setzen("")


class StartDateTime(_Feld, DateTimeEntity):
    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "start", "Neuer Termin: Wann?", "mdi:calendar-clock")

    @property
    def native_value(self) -> datetime | None:
        return self._wert

    async def async_set_value(self, value: datetime) -> None:
        self._setzen(value)


class DauerNumber(_Feld, NumberEntity):
    _attr_native_min_value = 5
    _attr_native_max_value = 720
    _attr_native_step = 5
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = UnitOfTime.MINUTES

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "dauer", "Neuer Termin: Dauer", "mdi:timer-outline")

    @property
    def native_value(self) -> float:
        return float(self._wert or 60)

    async def async_set_native_value(self, value: float) -> None:
        self._setzen(int(value))


class GanztagSwitch(_Feld, SwitchEntity):
    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "ganztag", "Neuer Termin: Ganztägig", "mdi:calendar-today")

    @property
    def is_on(self) -> bool:
        return bool(self._wert)

    async def async_turn_on(self, **kwargs) -> None:
        self._setzen(True)

    async def async_turn_off(self, **kwargs) -> None:
        self._setzen(False)


class AnlegenButton(FamilienplanerEntity, ButtonEntity):
    _attr_icon = "mdi:calendar-plus"
    _attr_name = "Neuer Termin: Anlegen"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "form_anlegen")

    async def async_press(self) -> None:
        from . import async_termin_anlegen  # noqa: PLC0415

        f = self.coordinator.formular
        if not str(f.get("titel") or "").strip():
            raise HomeAssistantError("Bitte zuerst eintragen, was ansteht (Titel).")
        await async_termin_anlegen(
            self.coordinator,
            {"person": f["person"], "titel": f["titel"], "start": f["start"], "dauer": f["dauer"],
             "ganztag": f["ganztag"], "ort": f["ort"], "fahrer": f["fahrer"], "benachrichtigen": True},
        )
        # Formular zurücksetzen und alle Felder aktualisieren
        self.coordinator.formular.clear()
        self.coordinator.formular.update(formular_standard())
        self.coordinator.async_update_listeners()


class AnsageButton(FamilienplanerEntity, ButtonEntity):
    _attr_icon = "mdi:account-voice"
    _attr_name = "Morgen-Ansage abspielen"

    def __init__(self, coord: FamilienplanerCoordinator) -> None:
        super().__init__(coord, "morgen_ansage")

    async def async_press(self) -> None:
        await self.coordinator.async_morgen_ansage()
