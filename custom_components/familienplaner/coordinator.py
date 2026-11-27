"""Coordinator: holt Termine, berechnet Anzeigen und verschickt Erinnerungen."""

from __future__ import annotations

from datetime import datetime, time, timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from . import logic
from .const import (
    CONF_ALEXA,
    CONF_ALEXA_MORNING,
    CONF_ALEXA_TIME,
    CONF_CONFLICTS,
    CONF_WEEKLY,
    CONF_WEEKLY_TIME,
    EVENT_CONFLICT,
    EVENT_END,
    EVENT_SOON,
    EVENT_START,
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
    CONF_SPECIAL_CALENDAR,
    CONF_TRAVEL_TIME,
    CONF_WASTE_CALENDAR,
    CONF_WASTE_TIME,
    CONF_WEATHER,
    CONF_WEATHER_HINT,
    DEFAULT_OPTIONS,
    DOMAIN,
    FAMILY,
    TRAVEL_BUFFER_MINUTES,
    TRAVEL_CHECK_MINUTES,
    WEATHER_HINT_MINUTES,
)
from .models import Person, PlanerDaten, Termin

_LOGGER = logging.getLogger(__name__)
LANG_INTERVALL = timedelta(minutes=15)


class FamilienplanerCoordinator(DataUpdateCoordinator[PlanerDaten]):
    """Zentrale Logik pro Config-Eintrag."""

    config_entry: ConfigEntry

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=1),
            config_entry=entry,
        )
        self._lang_cache: dict[str, Any] = {}
        self._lang_zeit: datetime | None = None
        self._store: Store[dict[str, Any]] = Store(hass, 1, f"{DOMAIN}.{entry.entry_id}.gesendet")
        self._gesendet: dict[str, str] = {}
        self._abfahrt: dict[str, dict[str, Any]] = {}
        self._unsubs: list[CALLBACK_TYPE] = []
        self.formular: dict[str, Any] = formular_standard()

    # ------------------------------------------------------------------ Konfig
    @property
    def opt(self) -> dict[str, Any]:
        return {**DEFAULT_OPTIONS, **self.config_entry.data, **self.config_entry.options}

    @property
    def personen(self) -> list[Person]:
        return [Person.from_dict(p) for p in self.opt.get(CONF_PERSONS, [])]

    def person(self, slug: str) -> Person | None:
        return next((p for p in self.personen if p.slug == slug), None)

    @property
    def namen(self) -> dict[str, str]:
        return {p.slug: p.name for p in self.personen}

    def kalender_von(self, slug: str) -> str | None:
        if slug == FAMILY:
            return self.opt.get(CONF_FAMILY_CALENDAR)
        p = self.person(slug)
        return p.calendar_entity if p else None

    # --------------------------------------------------------------- Lebenszyklus
    async def async_start(self) -> None:
        gespeichert = await self._store.async_load() or {}
        self._gesendet = gespeichert.get("gesendet", {})
        self._planen()

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()

    @callback
    def _planen(self) -> None:
        self.async_stop()
        o = self.opt

        def bei(zeit: str, ziel) -> None:
            t = time.fromisoformat(zeit)
            self._unsubs.append(
                async_track_time_change(self.hass, ziel, hour=t.hour, minute=t.minute, second=t.second)
            )

        bei(o[CONF_MORNING_TIME], self._tagesuebersicht_heute)
        bei(o[CONF_EVENING_TIME], self._tagesuebersicht_morgen)
        bei(o[CONF_WASTE_TIME], self._muell_vorabend)
        bei("06:30:00", self._muell_morgens)
        bei("08:00:00", self._geburtstags_assistent)
        if o.get(CONF_ALEXA_MORNING):
            bei(o[CONF_ALEXA_TIME], self._alexa_automatisch)
        if o.get(CONF_WEEKLY):
            bei(o[CONF_WEEKLY_TIME], self._wochenrueckblick_sonntag)

    # ------------------------------------------------------------------ Abfragen
    async def async_events(self, entities: list[str], start: datetime, dauer: timedelta) -> dict[str, Any]:
        """Öffentlich: Termine mehrerer Kalender (Antwort von calendar.get_events)."""
        return await self._events(entities, start, dauer)

    async def _events(self, entities: list[str], start: datetime, dauer: timedelta) -> dict[str, Any]:
        entities = [e for e in dict.fromkeys(entities) if e and self.hass.states.get(e)]
        if not entities:
            return {}
        try:
            return await self.hass.services.async_call(
                "calendar",
                "get_events",
                {"entity_id": entities, "start_date_time": start.isoformat(), "duration": {"seconds": int(dauer.total_seconds())}},
                blocking=True,
                return_response=True,
            ) or {}
        except HomeAssistantError as err:
            _LOGGER.warning("Termine konnten nicht geladen werden: %s", err)
            return {}

    async def _todo_items(self, entity: str | None) -> list[str]:
        if not entity or not self.hass.states.get(entity):
            return []
        try:
            antwort = await self.hass.services.async_call(
                "todo", "get_items", {"entity_id": entity, "status": "needs_action"},
                blocking=True, return_response=True,
            )
        except HomeAssistantError:
            return []
        return [i.get("summary", "") for i in (antwort or {}).get(entity, {}).get("items", [])]

    def _termine_personen(self, antwort: dict[str, Any]) -> dict[str, list[Termin]]:
        tz = dt_util.get_default_time_zone()
        res: dict[str, list[Termin]] = {}
        fam = self.opt.get(CONF_FAMILY_CALENDAR)
        res[FAMILY] = logic.parse_events(antwort, fam, FAMILY, tz) if fam else []
        for p in self.personen:
            res[p.slug] = logic.parse_events(antwort, p.calendar_entity, p.slug, tz) if p.calendar_entity else []
        return res

    def _personen_kalender(self) -> list[str]:
        return [self.opt.get(CONF_FAMILY_CALENDAR)] + [p.calendar_entity for p in self.personen]

    async def _async_update_data(self) -> PlanerDaten:
        jetzt = dt_util.now()
        tz = dt_util.get_default_time_zone()
        o = self.opt

        kurz = await self._events(self._personen_kalender(), jetzt - timedelta(hours=12), timedelta(days=3))
        if self._lang_zeit is None or jetzt - self._lang_zeit > LANG_INTERVALL:
            self._lang_cache = await self._events(
                [o.get(CONF_SPECIAL_CALENDAR), o.get(CONF_HOLIDAY_CALENDAR), o.get(CONF_WASTE_CALENDAR),
                 o.get(CONF_SCHOOL_CALENDAR), o.get(CONF_MEAL_CALENDAR)],
                dt_util.start_of_local_day(), timedelta(days=370),
            )
            self._lang_zeit = jetzt
        lang = self._lang_cache

        pro_person = self._termine_personen(kurz)
        daten = PlanerDaten()
        familie = pro_person.get(FAMILY, [])
        for p in self.personen:
            eigene = pro_person.get(p.slug, []) + familie
            daten.naechste[p.slug] = logic.naechster_termin(eigene, jetzt)
            daten.heute[p.slug] = [t for t in logic.sortiert(eigene) if _am_tag(t, jetzt.date())]
        daten.naechste[FAMILY] = logic.naechster_termin(familie, jetzt)
        daten.alle_kurz = [t for liste in pro_person.values() for t in liste]

        def lang_von(key: str, person: str = "") -> list[Termin]:
            e = o.get(key)
            return logic.parse_events(lang, e, person, tz) if e else []

        daten.countdowns = logic.countdowns(lang_von(CONF_SPECIAL_CALENDAR), lang_von(CONF_HOLIDAY_CALENDAR), jetzt.date())
        daten.muell = logic.muell_liste(lang_von(CONF_WASTE_CALENDAR), jetzt.date())
        daten.ferien = logic.ferien_info(lang_von(CONF_SCHOOL_CALENDAR), jetzt.date())
        daten.essen_heute = [t.summary for t in lang_von(CONF_MEAL_CALENDAR) if _am_tag(t, jetzt.date())]
        daten.pinnwand = await self._todo_items(o.get(CONF_PINBOARD_TODO))

        daten.konflikte = logic.konflikte(daten.alle_kurz, jetzt, self._fahrer_slug, self.namen)
        await self._konflikte_melden(daten.konflikte)
        await self._erinnerungen(jetzt, daten.alle_kurz)
        return daten

    # -------------------------------------------------------------- Benachrichtigung
    async def async_benachrichtigen(self, wer: str, titel: str, nachricht: str) -> None:
        """Push an eine Person (slug) oder an alle (familie)."""
        ziele = self.personen if wer in (FAMILY, "alle") else [p for p in self.personen if p.slug == wer]
        for p in ziele:
            if not p.notify_service:
                continue
            dienst = p.notify_service.removeprefix("notify.")
            try:
                await self.hass.services.async_call(
                    "notify", dienst,
                    {"title": titel, "message": nachricht,
                     "data": {"group": DOMAIN, "url": "/familienplaner", "clickAction": "/familienplaner"}},
                    blocking=False,
                )
            except HomeAssistantError as err:
                _LOGGER.warning("Benachrichtigung an %s fehlgeschlagen: %s", p.name, err)

    async def async_alexa(self, text: str) -> None:
        ziele = self.opt.get(CONF_ALEXA) or []
        if not ziele:
            return
        try:
            await self.hass.services.async_call(
                "notify", "send_message", {"entity_id": ziele, "message": text}, blocking=False
            )
        except HomeAssistantError as err:
            _LOGGER.warning("Alexa-Ansage fehlgeschlagen: %s", err)

    def _schon(self, key: str) -> bool:
        return key in self._gesendet

    def _merken(self, key: str) -> None:
        self._gesendet[key] = dt_util.now().isoformat()
        grenze = (dt_util.now() - timedelta(days=3)).isoformat()
        self._gesendet = {k: v for k, v in self._gesendet.items() if v > grenze}
        self._store.async_delay_save(lambda: {"gesendet": self._gesendet}, 5)

    def _fahrer_slug(self, t: Termin) -> str:
        if not t.fahrer:
            return ""
        f = t.fahrer.lower()
        return next((p.slug for p in self.personen if p.slug == f or p.name.lower() == f), "")

    async def _erinnerungen(self, jetzt: datetime, termine: list[Termin]) -> None:
        o = self.opt
        vorlauf = int(o.get(CONF_REMINDER_MINUTES, 30))
        for t in termine:
            if t.ganztag:
                continue
            minuten = (t.start - jetzt).total_seconds() / 60  # type: ignore[operator]
            seit_ende = (jetzt - t.end).total_seconds() / 60  # type: ignore[operator]
            # Ereignisse für eigene Automationen (Haus reagiert auf den Kalender)
            if -5 < minuten <= 0 and not self._schon(t.key + "|beginnt"):
                self._merken(t.key + "|beginnt")
                self._ereignis(EVENT_START, t)
            if 0 <= seit_ende < 5 and not self._schon(t.key + "|endet"):
                self._merken(t.key + "|endet")
                self._ereignis(EVENT_END, t)
            if minuten <= 0:
                continue
            uhr = t.start.astimezone(jetzt.tzinfo).strftime("%H:%M")  # type: ignore[union-attr]
            ort = f" · {t.location}" if t.location else ""
            fahrer = self._fahrer_slug(t)

            # 1) Erinnerung X Minuten vorher
            if minuten <= vorlauf and not self._schon(t.key + "|erinnerung"):
                self._merken(t.key + "|erinnerung")
                self._ereignis(EVENT_SOON, t, minuten=round(minuten))
                await self.async_benachrichtigen(t.person, f"⏰ In {round(minuten)} Min: {t.summary}", f"{uhr} Uhr{ort}")
                if fahrer and fahrer != t.person and t.person != FAMILY:
                    wer = self.namen.get(t.person, t.person)
                    await self.async_benachrichtigen(fahrer, f"🚗 Gleich fahren: {t.summary}", f"{wer} um {uhr} Uhr{ort}")

            # 2) Wetter-Hinweis 2 h vorher (nur mit Ort)
            if (o.get(CONF_WEATHER_HINT) and o.get(CONF_WEATHER) and t.location
                    and minuten <= WEATHER_HINT_MINUTES and not self._schon(t.key + "|wetter")):
                self._merken(t.key + "|wetter")
                await self._wetter_hinweis(t, fahrer)

            # 3) Fahrzeit: 90 Min vorher berechnen, dann "Jetzt losfahren"
            if o.get(CONF_TRAVEL_TIME) and t.location and len(t.location) > 3:
                if minuten <= TRAVEL_CHECK_MINUTES and t.key not in self._abfahrt and not self._schon(t.key + "|fahrt"):
                    fahrzeit = await self._fahrzeit(t.location)
                    self._abfahrt[t.key] = {"min": fahrzeit}
                plan = self._abfahrt.get(t.key)
                if plan and plan["min"] and plan["min"] >= 5 and not self._schon(t.key + "|fahrt"):
                    if minuten <= plan["min"] + TRAVEL_BUFFER_MINUTES:
                        self._merken(t.key + "|fahrt")
                        await self.async_benachrichtigen(
                            fahrer or t.person,
                            f"🚗 Jetzt losfahren: {t.summary}",
                            f"Fahrzeit gerade {plan['min']} Min bis {t.location}. Beginn {uhr} Uhr.",
                        )

    @callback
    def _ereignis(self, typ: str, t: Termin, **extra: Any) -> None:
        fahrer = self._fahrer_slug(t)
        self.hass.bus.async_fire(typ, {
            "person": t.person,
            "name": self.namen.get(t.person, t.person),
            "titel": t.summary,
            "start": t.start.isoformat(),
            "ende": t.end.isoformat(),
            "ort": t.location,
            "fahrer": fahrer,
            "kalender": t.kalender,
            **extra,
        })

    async def _konflikte_melden(self, liste: list[dict[str, Any]]) -> None:
        for k in liste:
            key = "konflikt|" + k["key"]
            if self._schon(key):
                continue
            self._merken(key)
            self.hass.bus.async_fire(EVENT_CONFLICT, {x: k[x] for x in ("art", "person", "a", "b", "start", "text")})
            if self.opt.get(CONF_CONFLICTS):
                start = dt_util.as_local(datetime.fromisoformat(k["start"]))
                wann = f"{logic.WOCHENTAGE_KURZ[start.weekday()]} {start:%d.%m. %H:%M}"
                await self.async_benachrichtigen(k["person"], "⚠️ Terminkonflikt", f"{k['text']} ({wann}).")

    async def _wetter_hinweis(self, t: Termin, fahrer: str) -> None:
        wetter = self.opt.get(CONF_WEATHER)
        try:
            antwort = await self.hass.services.async_call(
                "weather", "get_forecasts", {"entity_id": wetter, "type": "hourly"},
                blocking=True, return_response=True,
            )
        except HomeAssistantError:
            return
        f = logic.wetter_zur_zeit((antwort or {}).get(wetter, {}).get("forecast", []), t.start)  # type: ignore[arg-type]
        nass, kalt = logic.wetter_bewertung(f)
        if not (nass or kalt) or f is None:
            return
        text = logic.wetter_hinweis(f, t.start.astimezone(dt_util.get_default_time_zone()))  # type: ignore[union-attr]
        titel = f"{'🌧️' if nass else '🥶'} Wetter bei {t.summary}"
        await self.async_benachrichtigen(t.person, titel, text)
        if fahrer and fahrer != t.person and t.person != FAMILY:
            await self.async_benachrichtigen(fahrer, titel + " (du fährst)", text)

    async def _fahrzeit(self, ziel: str) -> int:
        if not self.hass.services.has_service("waze_travel_time", "get_travel_times"):
            return 0
        home = self.hass.states.get("zone.home")
        if home is None:
            return 0
        try:
            antwort = await self.hass.services.async_call(
                "waze_travel_time", "get_travel_times",
                {"origin": f"{home.attributes['latitude']},{home.attributes['longitude']}",
                 "destination": ziel, "region": "eu"},
                blocking=True, return_response=True,
            )
        except (HomeAssistantError, KeyError) as err:
            _LOGGER.debug("Fahrzeit nicht verfügbar: %s", err)
            return 0
        routen = (antwort or {}).get("routes", [])
        dauer = [r.get("duration") for r in routen if r.get("duration") is not None]
        return round(min(dauer)) if dauer else 0

    # ------------------------------------------------------------ Tagesaufgaben
    async def _uebersicht(self, tag_offset: int) -> None:
        start = dt_util.start_of_local_day() + timedelta(days=tag_offset)
        antwort = await self._events(self._personen_kalender(), start, timedelta(days=1))
        pro = self._termine_personen(antwort)
        tz = dt_util.get_default_time_zone()
        for p in self.personen:
            liste = [t for t in pro.get(p.slug, []) + pro.get(FAMILY, []) if _am_tag(t, start.date())]
            if not liste:
                continue
            titel = ("☀️ Dein Tag heute" if tag_offset == 0 else "🌙 Morgen steht an") + \
                f" ({len(liste)} {'Termin' if len(liste) == 1 else 'Termine'})"
            await self.async_benachrichtigen(p.slug, titel, "\n".join(logic.tages_zeilen(liste, tz)))

    async def _tagesuebersicht_heute(self, _now: datetime) -> None:
        await self._uebersicht(0)

    async def _tagesuebersicht_morgen(self, _now: datetime) -> None:
        await self._uebersicht(1)

    async def _muell(self, tag_offset: int) -> list[str]:
        e = self.opt.get(CONF_WASTE_CALENDAR)
        if not e:
            return []
        start = dt_util.start_of_local_day() + timedelta(days=tag_offset)
        antwort = await self._events([e], start, timedelta(days=1))
        return logic.muell_an_tag(logic.parse_events(antwort, e, "", dt_util.get_default_time_zone()), start.date())

    async def _muell_vorabend(self, _now: datetime) -> None:
        tonnen = await self._muell(1)
        if tonnen:
            text = " und ".join(tonnen)
            await self.async_benachrichtigen(FAMILY, "🗑️ Morgen wird abgeholt", f"{text} – heute Abend die Tonne rausstellen!")
            await self.async_alexa(f"Kleine Erinnerung: Morgen wird {text} abgeholt. Bitte heute Abend die Tonne rausstellen.")

    async def _muell_morgens(self, _now: datetime) -> None:
        tonnen = await self._muell(0)
        if tonnen:
            await self.async_benachrichtigen(FAMILY, "🗑️ Heute wird abgeholt", f"{' und '.join(tonnen)} – steht die Tonne draußen?")

    async def _geburtstags_assistent(self, _now: datetime) -> None:
        e = self.opt.get(CONF_SPECIAL_CALENDAR)
        if not e:
            return
        antwort = await self._events([e], dt_util.start_of_local_day(), timedelta(days=8))
        heute = dt_util.now().date()
        for t in logic.parse_events(antwort, e, "", dt_util.get_default_time_zone()):
            if not logic.ist_geburtstag(t.summary):
                continue
            tage = logic.tage_bis(t.start, heute)
            name = logic.geburtstag_name(t.summary)
            if tage == 7:
                liste = self.opt.get(CONF_FAMILY_TODO)
                if liste and self.hass.states.get(liste):
                    faellig = (t.start if not isinstance(t.start, datetime) else t.start.date()) - timedelta(days=1)
                    await self.hass.services.async_call(
                        "todo", "add_item",
                        {"entity_id": liste, "item": f"🎁 Geschenk für {name} besorgen", "due_date": faellig.isoformat()},
                        blocking=False,
                    )
                await self.async_benachrichtigen(FAMILY, f"🎂 In einer Woche: {t.summary}",
                                                 f"„Geschenk für {name} besorgen“ steht auf der Familienliste.")
            elif tage == 1:
                await self.async_benachrichtigen(FAMILY, f"🎂 Morgen: {t.summary}", "Geschenk und Karte bereit?")
            elif tage == 0:
                await self.async_benachrichtigen(FAMILY, f"🎉 Heute: {t.summary}", "Nicht vergessen zu gratulieren!")

    async def _wochenrueckblick_sonntag(self, _now: datetime) -> None:
        if dt_util.now().weekday() == 6:
            await self.async_wochenrueckblick()

    async def async_wochenrueckblick(self) -> dict[str, str]:
        """Sonntagabend: Rückblick auf diese Woche und Vorschau auf die nächste, pro Person."""
        o = self.opt
        tz = dt_util.get_default_time_zone()
        heute = dt_util.start_of_local_day()
        montag = heute + timedelta(days=7 - heute.weekday())
        vorher = await self._events(self._personen_kalender(), montag - timedelta(days=7), timedelta(days=7))
        naechste = await self._events(
            self._personen_kalender() + [o.get(CONF_SPECIAL_CALENDAR), o.get(CONF_WASTE_CALENDAR)],
            montag, timedelta(days=7),
        )
        pro_vorher = self._termine_personen(vorher)
        pro = self._termine_personen(naechste)
        familie = pro.get(FAMILY, [])
        alle = [t for liste in pro.values() for t in liste]
        konflikte = logic.konflikte(alle, montag, self._fahrer_slug, self.namen)
        extra: list[str] = []
        for t in logic.parse_events(naechste, o.get(CONF_SPECIAL_CALENDAR) or "", "", tz):
            extra.append(f"🎉 {logic.WOCHENTAGE_KURZ[_tag(t).weekday()]}: {t.summary}")
        for name in dict.fromkeys(t.summary for t in logic.parse_events(naechste, o.get(CONF_WASTE_CALENDAR) or "", "", tz)):
            tage = [logic.WOCHENTAGE_KURZ[_tag(t).weekday()] for t in logic.parse_events(naechste, o.get(CONF_WASTE_CALENDAR) or "", "", tz) if t.summary == name]
            extra.append(f"🗑️ {name}: {', '.join(tage)}")
        texte: dict[str, str] = {}
        for p in self.personen:
            eigene = pro.get(p.slug, []) + familie
            geschafft = len([t for t in pro_vorher.get(p.slug, []) + pro_vorher.get(FAMILY, []) if not t.ganztag])
            zeilen = [f"Diese Woche: {geschafft} {'Termin' if geschafft == 1 else 'Termine'} geschafft 💪"]
            vorschau = logic.wochen_vorschau(eigene, montag.date(), tz, self.namen, mit_person=False)
            zeilen += vorschau or ["Nächste Woche ist noch frei 😎"]
            zeilen += extra
            zeilen += [f"⚠️ {k['text']}" for k in konflikte if k["person"] == p.slug]
            text = "\n".join(zeilen)
            texte[p.slug] = text
            anzahl = len([t for t in eigene if not t.ganztag])
            await self.async_benachrichtigen(p.slug, f"📅 Deine Woche: {anzahl} {'Termin' if anzahl == 1 else 'Termine'}", text)
        return texte

    async def _alexa_automatisch(self, _now: datetime) -> None:
        zuhause = [p for p in self.personen if p.person_entity and self.hass.states.is_state(p.person_entity, "home")]
        if zuhause or not any(p.person_entity for p in self.personen):
            await self.async_morgen_ansage()

    async def async_morgen_ansage(self) -> str:
        """Erzeugt die Morgen-Ansage und spielt sie auf den Echos ab."""
        o = self.opt
        tz = dt_util.get_default_time_zone()
        jetzt = dt_util.now()
        start = dt_util.start_of_local_day()
        wetter_tag = None
        if o.get(CONF_WEATHER):
            try:
                antwort = await self.hass.services.async_call(
                    "weather", "get_forecasts", {"entity_id": o[CONF_WEATHER], "type": "daily"},
                    blocking=True, return_response=True,
                )
                fc = (antwort or {}).get(o[CONF_WEATHER], {}).get("forecast", [])
                wetter_tag = fc[0] if fc else None
            except HomeAssistantError:
                pass
        kal = await self._events(
            self._personen_kalender() + [o.get(CONF_SPECIAL_CALENDAR), o.get(CONF_MEAL_CALENDAR)],
            start, timedelta(days=1),
        )
        pro = self._termine_personen(kal)
        termine = [t for liste in pro.values() for t in liste if _am_tag(t, start.date())]
        besondere = logic.parse_events(kal, o.get(CONF_SPECIAL_CALENDAR) or "", "", tz)
        essen = [t.summary for t in logic.parse_events(kal, o.get(CONF_MEAL_CALENDAR) or "", "", tz)]
        text = logic.morgen_ansage(
            jetzt, wetter_tag, termine, self.namen, besondere, essen,
            await self._muell(0), self.data.ferien if self.data else {},
        )
        await self.async_alexa(text)
        return text


def formular_standard() -> dict[str, Any]:
    naechste_stunde = (dt_util.now() + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    return {"person": FAMILY, "fahrer": "niemand", "titel": "", "ort": "", "start": naechste_stunde,
            "dauer": 60, "ganztag": False}


def _tag(t: Termin):
    return dt_util.as_local(t.start).date() if isinstance(t.start, datetime) else t.start


def _am_tag(t: Termin, tag) -> bool:
    if isinstance(t.start, datetime):
        s = dt_util.as_local(t.start).date()
        e = dt_util.as_local(t.end).date()  # type: ignore[arg-type]
        return s <= tag <= e
    return t.start <= tag < t.end  # type: ignore[operator]
