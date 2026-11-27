"""Einrichtung per UI: Familie anlegen, Personen hinzufügen, Einstellungen."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import selector

from .const import (
    CONF_ALEXA,
    CONF_ALEXA_MORNING,
    CONF_ALEXA_TIME,
    CONF_EVENING_TIME,
    CONF_FAMILY_CALENDAR,
    CONF_FAMILY_TODO,
    CONF_HOLIDAY_CALENDAR,
    CONF_MEAL_CALENDAR,
    CONF_MORNING_TIME,
    CONF_PERSONS,
    CONF_PINBOARD_TODO,
    CONF_REMINDER_MINUTES,
    CONF_SCHOOL_CALENDAR,
    CONF_SHOPPING_TODO,
    CONF_SPECIAL_CALENDAR,
    CONF_TITLE,
    CONF_TRAVEL_TIME,
    CONF_WASTE_CALENDAR,
    CONF_WASTE_TIME,
    CONF_WEATHER,
    CONF_WEATHER_HINT,
    DEFAULT_OPTIONS,
    DOMAIN,
    P_CALENDAR,
    P_COLOR,
    P_NAME,
    P_NOTIFY,
    P_PERSON,
    P_ROTATION,
    P_SLUG,
    P_TODO,
    PALETTE,
)
from .models import slugify_name

KAL = selector.EntitySelector(selector.EntitySelectorConfig(domain="calendar"))
TODO = selector.EntitySelector(selector.EntitySelectorConfig(domain="todo"))


def _hex(rgb: list[int] | tuple[int, int, int]) -> str:
    return "#{:02X}{:02X}{:02X}".format(*[int(x) for x in rgb])


def _rgb(farbe: str) -> list[int]:
    f = farbe.lstrip("#")
    return [int(f[i : i + 2], 16) for i in (0, 2, 4)]


def _notify_dienste(hass: HomeAssistant) -> list[str]:
    return sorted(
        f"notify.{name}" for name in hass.services.async_services().get("notify", {})
        if name.startswith("mobile_app")
    )


def _opt(key: str, aktuell: dict[str, Any]) -> vol.Optional:
    wert = aktuell.get(key)
    return vol.Optional(key, description={"suggested_value": wert} if wert else None)


class FamilienplanerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Erste Einrichtung."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is not None:
            daten = {k: v for k, v in user_input.items() if v not in (None, "")}
            return self.async_create_entry(
                title=daten.get(CONF_TITLE) or "Familienplaner",
                data=daten,
                options=dict(DEFAULT_OPTIONS),
            )
        schema = vol.Schema(
            {
                vol.Required(CONF_TITLE, default="Familie"): selector.TextSelector(),
                vol.Required(CONF_FAMILY_CALENDAR): KAL,
                vol.Optional(CONF_FAMILY_TODO): TODO,
                vol.Optional(CONF_SHOPPING_TODO): TODO,
                vol.Optional(CONF_WEATHER): selector.EntitySelector(selector.EntitySelectorConfig(domain="weather")),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return FamilienplanerOptionsFlow()


class FamilienplanerOptionsFlow(OptionsFlow):
    """Personen und Einstellungen verwalten."""

    def __init__(self) -> None:
        self._bearbeiten: str | None = None

    @property
    def _optionen(self) -> dict[str, Any]:
        return {**DEFAULT_OPTIONS, **self.config_entry.options}

    def _speichern(self, **aenderungen: Any) -> ConfigFlowResult:
        return self.async_create_entry(data={**self._optionen, **aenderungen})

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        menue = ["person_neu"]
        if self._optionen[CONF_PERSONS]:
            menue += ["person_bearbeiten_waehlen", "person_entfernen"]
        menue += ["kalender", "einstellungen"]
        return self.async_show_menu(step_id="init", menu_options=menue)

    # ---------------------------------------------------------------- Personen
    def _personen_schema(self, aktuell: dict[str, Any]) -> vol.Schema:
        dienste = _notify_dienste(self.hass)
        if aktuell.get(P_NOTIFY) and aktuell[P_NOTIFY] not in dienste:
            dienste.append(aktuell[P_NOTIFY])
        anzahl = len(self._optionen[CONF_PERSONS])
        farbe = aktuell.get(P_COLOR) or PALETTE[anzahl % len(PALETTE)]
        return vol.Schema(
            {
                vol.Required(P_NAME, default=aktuell.get(P_NAME, "")): selector.TextSelector(),
                vol.Required(P_COLOR, default=_rgb(farbe)): selector.ColorRGBSelector(),
                _opt(P_PERSON, aktuell): selector.EntitySelector(selector.EntitySelectorConfig(domain="person")),
                _opt(P_CALENDAR, aktuell): KAL,
                _opt(P_TODO, aktuell): TODO,
                _opt(P_NOTIFY, aktuell): selector.SelectSelector(
                    selector.SelectSelectorConfig(options=dienste, custom_value=True, mode=selector.SelectSelectorMode.DROPDOWN)
                ),
                vol.Optional(P_ROTATION, default=aktuell.get(P_ROTATION, True)): selector.BooleanSelector(),
            }
        )

    @staticmethod
    def _person_aus_eingabe(eingabe: dict[str, Any], slug: str) -> dict[str, Any]:
        return {
            P_SLUG: slug,
            P_NAME: eingabe[P_NAME].strip(),
            P_COLOR: _hex(eingabe[P_COLOR]),
            P_PERSON: eingabe.get(P_PERSON) or None,
            P_CALENDAR: eingabe.get(P_CALENDAR) or None,
            P_TODO: eingabe.get(P_TODO) or None,
            P_NOTIFY: eingabe.get(P_NOTIFY) or None,
            P_ROTATION: bool(eingabe.get(P_ROTATION, True)),
        }

    async def async_step_person_neu(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        fehler: dict[str, str] = {}
        if user_input is not None:
            slug = slugify_name(user_input[P_NAME])
            if slug == "familie" or any(p[P_SLUG] == slug for p in self._optionen[CONF_PERSONS]):
                fehler[P_NAME] = "name_vergeben"
            else:
                personen = [*self._optionen[CONF_PERSONS], self._person_aus_eingabe(user_input, slug)]
                return self._speichern(**{CONF_PERSONS: personen})
        return self.async_show_form(step_id="person_neu", data_schema=self._personen_schema(user_input or {}), errors=fehler)

    def _auswahl(self) -> list[selector.SelectOptionDict]:
        return [selector.SelectOptionDict(value=p[P_SLUG], label=p[P_NAME]) for p in self._optionen[CONF_PERSONS]]

    async def async_step_person_bearbeiten_waehlen(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            self._bearbeiten = user_input[P_SLUG]
            return await self.async_step_person_bearbeiten()
        schema = vol.Schema({vol.Required(P_SLUG): selector.SelectSelector(selector.SelectSelectorConfig(options=self._auswahl()))})
        return self.async_show_form(step_id="person_bearbeiten_waehlen", data_schema=schema)

    async def async_step_person_bearbeiten(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        personen = list(self._optionen[CONF_PERSONS])
        aktuell = next(p for p in personen if p[P_SLUG] == self._bearbeiten)
        if user_input is not None:
            neu = self._person_aus_eingabe(user_input, aktuell[P_SLUG])
            personen = [neu if p[P_SLUG] == aktuell[P_SLUG] else p for p in personen]
            return self._speichern(**{CONF_PERSONS: personen})
        return self.async_show_form(
            step_id="person_bearbeiten",
            data_schema=self._personen_schema(aktuell),
            description_placeholders={"name": aktuell[P_NAME]},
        )

    async def async_step_person_entfernen(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            weg = set(user_input.get("personen", []))
            return self._speichern(**{CONF_PERSONS: [p for p in self._optionen[CONF_PERSONS] if p[P_SLUG] not in weg]})
        schema = vol.Schema(
            {vol.Required("personen"): selector.SelectSelector(selector.SelectSelectorConfig(options=self._auswahl(), multiple=True))}
        )
        return self.async_show_form(step_id="person_entfernen", data_schema=schema)

    # ---------------------------------------------------------- Zusatzkalender
    async def async_step_kalender(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        felder = [CONF_SPECIAL_CALENDAR, CONF_HOLIDAY_CALENDAR, CONF_WASTE_CALENDAR, CONF_SCHOOL_CALENDAR, CONF_MEAL_CALENDAR]
        if user_input is not None:
            werte = {k: user_input.get(k) for k in [*felder, CONF_PINBOARD_TODO]}
            return self._speichern(**werte)
        o = self._optionen
        schema = vol.Schema(
            {**{_opt(k, o): KAL for k in felder}, _opt(CONF_PINBOARD_TODO, o): TODO}
        )
        return self.async_show_form(step_id="kalender", data_schema=schema)

    # ------------------------------------------------------------ Einstellungen
    async def async_step_einstellungen(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self._speichern(**user_input)
        o = self._optionen
        schema = vol.Schema(
            {
                vol.Required(CONF_REMINDER_MINUTES, default=o[CONF_REMINDER_MINUTES]): selector.NumberSelector(
                    selector.NumberSelectorConfig(min=5, max=240, step=5, unit_of_measurement="min", mode=selector.NumberSelectorMode.BOX)
                ),
                vol.Required(CONF_MORNING_TIME, default=o[CONF_MORNING_TIME]): selector.TimeSelector(),
                vol.Required(CONF_EVENING_TIME, default=o[CONF_EVENING_TIME]): selector.TimeSelector(),
                vol.Required(CONF_WASTE_TIME, default=o[CONF_WASTE_TIME]): selector.TimeSelector(),
                vol.Required(CONF_WEATHER_HINT, default=o[CONF_WEATHER_HINT]): selector.BooleanSelector(),
                vol.Required(CONF_TRAVEL_TIME, default=o[CONF_TRAVEL_TIME]): selector.BooleanSelector(),
                vol.Optional(CONF_ALEXA, default=o.get(CONF_ALEXA) or []): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="notify", multiple=True)
                ),
                vol.Required(CONF_ALEXA_MORNING, default=o[CONF_ALEXA_MORNING]): selector.BooleanSelector(),
                vol.Required(CONF_ALEXA_TIME, default=o[CONF_ALEXA_TIME]): selector.TimeSelector(),
            }
        )
        return self.async_show_form(step_id="einstellungen", data_schema=schema)
