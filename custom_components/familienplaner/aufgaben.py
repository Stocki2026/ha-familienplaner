"""Aufgaben, Punkte, Belohnungen, Haushalts-Rotation und Familien-Rennen.

Wird von ``__init__.async_setup_entry`` vor dem Einrichten der Plattformen geladen.
Hängt sich mit einer Entitäten-Fabrik an ``coordinator.erweiterungen`` an.

So funktioniert es:
* Wer eine Aufgabe abhakt, bekommt Punkte (Standard ``punkte_pro_aufgabe``).
  ``+20`` oder ``⭐20`` im Titel = 20 Punkte. Haken wieder raus = Punkte wieder weg.
* Aufgaben aus der eigenen Liste zählen für die Person, Aufgaben aus der Familienliste
  für die Person, die abhakt (über den angemeldeten HA-Benutzer).
* Drei Stände pro Person: ``rennen`` (Rennstrecke), ``konto`` (Belohnungen), ``gesamt`` (Level).
* Serie: mehrere Tage am Stück etwas erledigt -> ab Tag 3 Serien-Bonus.
* Haushalts-Rotation: Dienste wechseln reihum zwischen den Personen mit ``rotation = True``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from copy import deepcopy
from datetime import date, time, timedelta
import logging
import re
from typing import TYPE_CHECKING, Any

import voluptuous as vol

from homeassistant.components import persistent_notification
from homeassistant.components.button import ButtonEntity
from homeassistant.components.number import NumberEntity, NumberMode
from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.components.switch import SwitchEntity
from homeassistant.components.text import TextEntity
from homeassistant.components.time import TimeEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EntityCategory
from homeassistant.core import (
    CALLBACK_TYPE,
    Context,
    Event,
    EventStateChangedData,
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
    callback,
)
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError, Unauthorized
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import CONF_FAMILY_TODO, DOMAIN, FAMILY
from .entity import FamilienplanerEntity
from .models import Person

if TYPE_CHECKING:
    from .coordinator import FamilienplanerCoordinator

_LOGGER = logging.getLogger(__name__)

SPEICHER_VERSION = 1

FAHRZEUGE = ["Auto", "Rennwagen", "Motorrad", "Pferd", "Einhorn", "Fahrrad", "Traktor", "Rakete"]
FARBEN: dict[str, str] = {
    "Blau": "#5B8DB8",
    "Pink": "#D9849B",
    "Orange": "#E39350",
    "Grün": "#6FA372",
    "Rot": "#D45D5D",
    "Gelb": "#E5BE3C",
    "Lila": "#9B7BC4",
    "Türkis": "#3FAFAA",
    "Braun": "#9A7256",
    "Grau": "#8A8F96",
    "Schwarz": "#3B3936",
    "Weiß": "#F4F1EA",
    "Gold": "#C9A227",
    "Silber": "#B8BEC6",
}
STANDARD_FAHRZEUGE = ["Auto", "Motorrad", "Rennwagen", "Pferd"]

LEVEL = [
    (0, "Bobbycar-Pilot", "Toy car pilot"),
    (100, "Seifenkisten-Fahrer", "Soapbox racer"),
    (250, "Kart-Talent", "Kart talent"),
    (500, "Rallye-Fahrer", "Rally driver"),
    (900, "Rennprofi", "Racing pro"),
    (1500, "Champion", "Champion"),
    (2500, "Legende", "Legend"),
    (4000, "Weltmeister", "World champion"),
]

STANDARD_EINSTELLUNGEN: dict[str, Any] = {
    "punkte_pro_aufgabe": 10,
    "rennen_ziel": 500,
    "serien_bonus": 5,
    "sieger_bonus": 50,
    "familienziel": 1500,
    "familienziel_text": None,
    "rotation_aktiv": True,
    "rotation_uhrzeit": "06:30:00",
}

ALLE_TAGE = [0, 1, 2, 3, 4, 5, 6]
STANDARD_DIENSTE: dict[str, list[dict[str, Any]]] = {
    "de": [
        {"key": "spuelmaschine", "titel": "🍽️ Spülmaschine ausräumen", "punkte": 15, "tage": ALLE_TAGE, "versatz": 0},
        {"key": "tisch", "titel": "🍴 Tisch decken & abräumen", "punkte": 10, "tage": ALLE_TAGE, "versatz": 1},
        {"key": "muell", "titel": "🗑️ Müll rausbringen", "punkte": 20, "tage": [0, 3], "versatz": 0},
    ],
    "en": [
        {"key": "spuelmaschine", "titel": "🍽️ Empty the dishwasher", "punkte": 15, "tage": ALLE_TAGE, "versatz": 0},
        {"key": "tisch", "titel": "🍴 Set & clear the table", "punkte": 10, "tage": ALLE_TAGE, "versatz": 1},
        {"key": "muell", "titel": "🗑️ Take out the trash", "punkte": 20, "tage": [0, 3], "versatz": 0},
    ],
}

STANDARD_BELOHNUNGEN: dict[str, list[dict[str, Any]]] = {
    "de": [
        {"name": "Eis essen", "kosten": 50, "icon": "mdi:ice-cream"},
        {"name": "30 Min. Bildschirmzeit", "kosten": 80, "icon": "mdi:tablet"},
        {"name": "Länger aufbleiben", "kosten": 100, "icon": "mdi:weather-night"},
        {"name": "Spieleabend aussuchen", "kosten": 120, "icon": "mdi:dice-multiple"},
        {"name": "Lieblingsessen", "kosten": 150, "icon": "mdi:food-drumstick"},
        {"name": "Kino", "kosten": 400, "icon": "mdi:movie-open-outline"},
    ],
    "en": [
        {"name": "Ice cream", "kosten": 50, "icon": "mdi:ice-cream"},
        {"name": "30 min extra screen time", "kosten": 80, "icon": "mdi:tablet"},
        {"name": "Stay up later", "kosten": 100, "icon": "mdi:weather-night"},
        {"name": "Pick game night", "kosten": 120, "icon": "mdi:dice-multiple"},
        {"name": "Favourite dinner", "kosten": 150, "icon": "mdi:food-drumstick"},
        {"name": "Cinema", "kosten": 400, "icon": "mdi:movie-open-outline"},
    ],
}

STANDARD_STATIONEN: dict[str, list[dict[str, Any]]] = {
    "de": [
        {"emoji": "🐚", "name": "Muschelstrand", "belohnung": "Gemeinsam Eis essen 🍦", "punkte": 150},
        {"emoji": "🌴", "name": "Palmenoase", "belohnung": "Spieleabend 🎲", "punkte": 350},
        {"emoji": "🌋", "name": "Feuerberg", "belohnung": "Picknick im Park 🧺", "punkte": 600},
        {"emoji": "🏴‍☠️", "name": "Piratenbucht", "belohnung": "Pizza selbst backen 🍕", "punkte": 900},
        {"emoji": "💎", "name": "Schatzhöhle", "belohnung": "Großer Familienausflug 🎢", "punkte": 1300},
    ],
    "en": [
        {"emoji": "🐚", "name": "Shell Beach", "belohnung": "Ice cream together 🍦", "punkte": 150},
        {"emoji": "🌴", "name": "Palm Oasis", "belohnung": "Game night 🎲", "punkte": 350},
        {"emoji": "🌋", "name": "Fire Mountain", "belohnung": "Picnic in the park 🧺", "punkte": 600},
        {"emoji": "🏴‍☠️", "name": "Pirate Bay", "belohnung": "Bake pizza together 🍕", "punkte": 900},
        {"emoji": "💎", "name": "Treasure Cave", "belohnung": "Big family day out 🎢", "punkte": 1300},
    ],
}

TEXTE: dict[str, dict[str, str]] = {
    "de": {
        "familienziel_text": "Pizza- und Filmabend 🍕",
        "sieg_titel": "🏁 {name} hat das Familien-Rennen gewonnen!",
        "sieg_text": "Glückwunsch! {bonus} Bonuspunkte gehen aufs Konto.",
        "dienst_beschreibung": "Heute bist du dran. Abhaken bringt {punkte} Punkte.",
        "dienst_push": "🧹 Heute bist du dran",
        "belohnung_aufgabe": "🎁 {name} löst ein: {belohnung}",
        "belohnung_beschreibung": "{kosten} Punkte am {zeit} abgebucht. Abhaken, wenn die Belohnung erfüllt ist.",
        "eingeloest_titel": "🎉 Belohnung eingelöst",
        "eingeloest_text": "{name} hat „{belohnung}“ für {kosten} Punkte eingelöst. Restguthaben: {konto} Punkte.",
        "zu_wenig_titel": "🎁 Noch nicht genug Punkte",
        "zu_wenig_text": "{name}, für „{belohnung}“ fehlen dir noch {fehlt} Punkte. Weiter so! 💪",
        "wer_unbekannt": "Ich konnte nicht erkennen, wer einlösen möchte. Bitte mit dem eigenen Benutzer anmelden.",
        "person_unbekannt": "Unbekannte Person „{slug}“.",
        "farbe_unbekannt": "Unbekannte Farbe „{farbe}“.",
        "nicht_eingerichtet": "Der Familienplaner ist nicht eingerichtet.",
        "start": "Start",
        "station_titel": "🗺️ Station erreicht: {emoji} {name}",
        "station_text": "Die ganze Familie hat es geschafft! Belohnung: {belohnung}",
        "station_aufgabe": "🎁 {emoji} {name}: {belohnung}",
        "station_beschreibung": "Schatzkarte, Insel {insel}. Abhaken, wenn die Familien-Belohnung erfüllt ist.",
    },
    "en": {
        "familienziel_text": "Pizza & movie night 🍕",
        "sieg_titel": "🏁 {name} won the family race!",
        "sieg_text": "Congratulations! {bonus} bonus points go to the account.",
        "dienst_beschreibung": "It's your turn today. Done = {punkte} points.",
        "dienst_push": "🧹 Your turn today",
        "belohnung_aufgabe": "🎁 {name} redeems: {belohnung}",
        "belohnung_beschreibung": "{kosten} points deducted on {zeit}. Check off when the reward has been granted.",
        "eingeloest_titel": "🎉 Reward redeemed",
        "eingeloest_text": "{name} redeemed “{belohnung}” for {kosten} points. Remaining: {konto} points.",
        "zu_wenig_titel": "🎁 Not enough points yet",
        "zu_wenig_text": "{name}, you still need {fehlt} points for “{belohnung}”. Keep going! 💪",
        "wer_unbekannt": "Could not tell who wants to redeem. Please sign in with your own user.",
        "person_unbekannt": "Unknown person “{slug}”.",
        "farbe_unbekannt": "Unknown colour “{farbe}”.",
        "nicht_eingerichtet": "Familienplaner is not set up.",
        "start": "Start",
        "station_titel": "🗺️ Station reached: {emoji} {name}",
        "station_text": "The whole family made it! Reward: {belohnung}",
        "station_aufgabe": "🎁 {emoji} {name}: {belohnung}",
        "station_beschreibung": "Treasure map, island {insel}. Check off when the family reward has been granted.",
    },
}


def sprache(hass: HomeAssistant) -> str:
    return "de" if (hass.config.language or "en").lower().startswith("de") else "en"


def _t(hass: HomeAssistant, key: str, **kw: Any) -> str:
    return TEXTE[sprache(hass)][key].format(**kw)

PUNKTE_MUSTER = re.compile(r"[+⭐]\s*(\d+)")

SIGNAL = f"{DOMAIN}_aufgaben"


# --------------------------------------------------------------------------- Logik
def punkte_aus_titel(titel: str, standard: int) -> int:
    """'Zimmer aufräumen +20' -> 20, sonst Standard. Eingelöste Belohnungen (🎁) zählen nicht."""
    if (titel or "").startswith("🎁"):
        return 0
    treffer = PUNKTE_MUSTER.findall(titel or "")
    return int(treffer[-1]) if treffer else int(standard)


def level(gesamt: float, sprache: str = "de") -> tuple[int, str, int | None]:
    """Level-Nummer, Name und Punkte bis zum nächsten Level."""
    spalte = 1 if sprache == "de" else 2
    stufe, name, naechste = 1, LEVEL[0][spalte], None
    for i, eintrag in enumerate(LEVEL):
        if gesamt >= eintrag[0]:
            stufe, name = i + 1, eintrag[spalte]
            naechste = LEVEL[i + 1][0] if i + 1 < len(LEVEL) else None
    return stufe, name, naechste


def farbe_hex(farbe: str | None, fallback: str) -> str:
    if not farbe:
        return fallback
    if farbe.startswith("#"):
        return farbe
    return FARBEN.get(farbe, fallback)


def wer_ist_dran(mitmacher: list[str], zaehler: int, versatz: int) -> str | None:
    if not mitmacher:
        return None
    return mitmacher[(zaehler + versatz) % len(mitmacher)]


def neue_serie(serie: int, zuletzt: str | None, heute: date) -> int:
    """Serie für den ersten erledigten Tag: +1 wenn gestern aktiv, sonst 1."""
    if zuletzt == heute.isoformat():
        return serie
    if zuletzt == (heute - timedelta(days=1)).isoformat():
        return serie + 1
    return 1


def _leerer_stand(p: Person, index: int) -> dict[str, Any]:
    return {
        "rennen": 0,
        "konto": 0,
        "gesamt": 0,
        "heute": 0,
        "woche": 0,
        "serie": 0,
        "aktiv": None,
        "fahrzeug": STANDARD_FAHRZEUGE[index % len(STANDARD_FAHRZEUGE)],
        "farbe": next((n for n, h in FARBEN.items() if h.lower() == (p.farbe or "").lower()), p.farbe),
    }


# ------------------------------------------------------------------------ Manager
class AufgabenManager:
    """Hält Punktestände, beobachtet die Aufgabenlisten und plant die Rotation."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, coord: FamilienplanerCoordinator) -> None:
        self.hass = hass
        self.entry = entry
        self.coord = coord
        self._store: Store[dict[str, Any]] = Store(hass, SPEICHER_VERSION, f"{DOMAIN}.{entry.entry_id}.aufgaben")
        self.daten: dict[str, Any] = {}
        self._lock = asyncio.Lock()
        self._unsubs: list[CALLBACK_TYPE] = []
        self._rotation_unsub: CALLBACK_TYPE | None = None

    # ---------------------------------------------------------------- Zustand
    @property
    def signal(self) -> str:
        return f"{SIGNAL}_{self.entry.entry_id}"

    @property
    def einstellungen(self) -> dict[str, Any]:
        return self.daten["einstellungen"]

    @property
    def personen(self) -> list[Person]:
        return self.coord.personen

    def stand(self, slug: str) -> dict[str, Any]:
        return self.daten["personen"][slug]

    def mitmacher(self) -> list[str]:
        return [p.slug for p in self.personen if p.rotation and p.todo_entity]

    async def async_laden(self) -> None:
        gespeichert = await self._store.async_load() or {}
        lang = sprache(self.hass)
        self.daten = {
            "einstellungen": {**STANDARD_EINSTELLUNGEN, **gespeichert.get("einstellungen", {})},
            "personen": gespeichert.get("personen", {}),
            "familienpunkte": gespeichert.get("familienpunkte", 0),
            "sieger": gespeichert.get("sieger", ""),
            "gedaechtnis": gespeichert.get("gedaechtnis", {}),
            "dienste": gespeichert.get("dienste") or deepcopy(STANDARD_DIENSTE[lang]),
            "belohnungen": gespeichert.get("belohnungen") or deepcopy(STANDARD_BELOHNUNGEN[lang]),
            "rotation": gespeichert.get("rotation", {"zaehler": {}, "zuletzt": {}, "datum": None}),
            "stationen": gespeichert.get("stationen") or deepcopy(STANDARD_STATIONEN[lang]),
            "insel": gespeichert.get("insel", {"nummer": 1, "punkte": 0, "erreicht": 0}),
        }
        if not self.daten["einstellungen"].get("familienziel_text"):
            self.daten["einstellungen"]["familienziel_text"] = TEXTE[lang]["familienziel_text"]
        for i, p in enumerate(self.personen):
            self.daten["personen"].setdefault(p.slug, _leerer_stand(p, i))

    @callback
    def _geaendert(self) -> None:
        self._store.async_delay_save(lambda: self.daten, 1)
        async_dispatcher_send(self.hass, self.signal)

    async def async_speichern(self) -> None:
        await self._store.async_save(self.daten)

    # ----------------------------------------------------------- Lebenszyklus
    async def async_start(self) -> None:
        await self.async_laden()
        listen = self._listen()
        if listen:
            self._unsubs.append(async_track_state_change_event(self.hass, list(listen), self._liste_geaendert))
        self._unsubs.append(async_track_time_change(self.hass, self._tageswechsel, hour=0, minute=0, second=5))
        self._rotation_planen()

    @callback
    def async_stop(self) -> None:
        for u in self._unsubs:
            u()
        self._unsubs.clear()
        if self._rotation_unsub:
            self._rotation_unsub()
            self._rotation_unsub = None

    @callback
    def _rotation_planen(self) -> None:
        if self._rotation_unsub:
            self._rotation_unsub()
        t = time.fromisoformat(self.einstellungen["rotation_uhrzeit"])
        self._rotation_unsub = async_track_time_change(
            self.hass, self._rotation_zeit, hour=t.hour, minute=t.minute, second=t.second
        )

    def _listen(self) -> dict[str, str | None]:
        """todo-Entität -> Besitzer (slug) oder None für die Familienliste."""
        listen: dict[str, str | None] = {p.todo_entity: p.slug for p in self.personen if p.todo_entity}
        familie = self.coord.opt.get(CONF_FAMILY_TODO)
        if familie:
            listen[familie] = None
        return listen

    def _slug_von_benutzer(self, user_id: str | None) -> str | None:
        if not user_id:
            return None
        for p in self.personen:
            st = self.hass.states.get(p.person_entity) if p.person_entity else None
            if st and st.attributes.get("user_id") == user_id:
                return p.slug
        return None

    def _user_id(self, p: Person) -> str | None:
        st = self.hass.states.get(p.person_entity) if p.person_entity else None
        return st.attributes.get("user_id") if st else None

    # ---------------------------------------------------------- Abhaken -> Punkte
    async def _liste_geaendert(self, event: Event[EventStateChangedData]) -> None:
        alt, neu = event.data["old_state"], event.data["new_state"]
        if neu is None or neu.state in ("unknown", "unavailable"):
            return
        if alt is not None and alt.state == neu.state:
            return
        await self.async_liste_pruefen(event.data["entity_id"], neu.context)

    async def async_liste_pruefen(self, entity_id: str, context: Context | None = None) -> None:
        async with self._lock:
            try:
                antwort = await self.hass.services.async_call(
                    "todo", "get_items", {"entity_id": entity_id, "status": ["needs_action", "completed"]},
                    blocking=True, return_response=True,
                )
            except HomeAssistantError as err:
                _LOGGER.warning("Aufgaben von %s konnten nicht gelesen werden: %s", entity_id, err)
                return
            items = (antwort or {}).get(entity_id, {}).get("items", [])
            erledigt = [i for i in items if i.get("status") == "completed"]
            uids_jetzt = [i["uid"] for i in erledigt]
            gemerkt = self.daten["gedaechtnis"].get(entity_id)
            self.daten["gedaechtnis"][entity_id] = uids_jetzt
            if gemerkt is None:  # erster Blick auf die Liste: nur merken
                self._geaendert()
                return
            neu = [i for i in erledigt if i["uid"] not in gemerkt]
            zurueck = [i for i in items if i.get("status") == "needs_action" and i["uid"] in gemerkt]
            if not neu and not zurueck:
                self._geaendert()
                return
            besitzer = self._listen().get(entity_id)
            slug = besitzer or self._slug_von_benutzer(context.user_id if context else None)
            if not slug or slug not in self.daten["personen"]:
                self._geaendert()
                return
            standard = int(self.einstellungen["punkte_pro_aufgabe"])
            punkte = sum(punkte_aus_titel(i.get("summary", ""), standard) for i in neu)
            punkte -= sum(punkte_aus_titel(i.get("summary", ""), standard) for i in zurueck)
            bonus = 0
            st = self.stand(slug)
            heute = dt_util.now().date()
            if neu and st.get("aktiv") != heute.isoformat():
                st["serie"] = neue_serie(int(st.get("serie", 0)), st.get("aktiv"), heute)
                st["aktiv"] = heute.isoformat()
                if st["serie"] >= 3:
                    bonus = int(self.einstellungen["serien_bonus"])
        await self.async_buchen(slug, punkte + bonus, len(neu) - len(zurueck))

    async def async_buchen(self, slug: str, punkte: int, aufgaben: int = 0) -> None:
        if slug not in self.daten["personen"]:
            raise ServiceValidationError(_t(self.hass, "person_unbekannt", slug=slug))
        st = self.stand(slug)
        for feld in ("rennen", "konto", "gesamt"):
            st[feld] = max(0, st[feld] + punkte)
        self.daten["familienpunkte"] = max(0, self.daten["familienpunkte"] + punkte)
        insel = self.daten["insel"]
        insel["punkte"] = max(0, insel["punkte"] + punkte)
        if aufgaben:
            st["heute"] = max(0, st["heute"] + aufgaben)
            st["woche"] = max(0, st["woche"] + aufgaben)
        await self._sieg_pruefen(slug)
        await self._stationen_pruefen()
        self._geaendert()

    async def _sieg_pruefen(self, slug: str) -> None:
        if self.daten["sieger"] or self.stand(slug)["rennen"] < int(self.einstellungen["rennen_ziel"]):
            return
        name = self.coord.namen.get(slug, slug.capitalize())
        bonus = int(self.einstellungen["sieger_bonus"])
        self.daten["sieger"] = name
        self.stand(slug)["konto"] += bonus
        await self.coord.async_benachrichtigen(
            FAMILY, _t(self.hass, "sieg_titel", name=name), _t(self.hass, "sieg_text", bonus=bonus)
        )

    async def _stationen_pruefen(self) -> None:
        """Schatzkarte: Für jede neu erreichte Station Familien-Push und Aufgabe in der Familienliste."""
        insel = self.daten["insel"]
        stationen = self.daten["stationen"]
        while insel["erreicht"] < len(stationen) and insel["punkte"] >= int(stationen[insel["erreicht"]]["punkte"]):
            s = stationen[insel["erreicht"]]
            insel["erreicht"] += 1
            kw = {"emoji": s.get("emoji", "📍"), "name": s["name"], "belohnung": s["belohnung"], "insel": insel["nummer"]}
            await self.coord.async_benachrichtigen(
                FAMILY, _t(self.hass, "station_titel", **kw), _t(self.hass, "station_text", **kw)
            )
            familie = self.coord.opt.get(CONF_FAMILY_TODO)
            if not familie:
                continue
            try:
                await self.hass.services.async_call(
                    "todo", "add_item",
                    {"entity_id": familie, "item": _t(self.hass, "station_aufgabe", **kw),
                     "description": _t(self.hass, "station_beschreibung", **kw)},
                    blocking=True,
                )
                await self.async_liste_pruefen(familie)
            except HomeAssistantError as err:
                _LOGGER.warning("Station %s konnte nicht eingetragen werden: %s", s["name"], err)

    def insel_neu(self) -> None:
        insel = self.daten["insel"]
        self.daten["insel"] = {"nummer": int(insel.get("nummer", 1)) + 1, "punkte": 0, "erreicht": 0}
        self._geaendert()

    def stationen_festlegen(self, stationen: list[dict[str, Any]]) -> None:
        self.daten["stationen"] = sorted(stationen, key=lambda s: int(s["punkte"]))
        insel = self.daten["insel"]
        # Bereits überschrittene Stationen gelten als erreicht, ohne erneute Benachrichtigung.
        insel["erreicht"] = sum(1 for s in self.daten["stationen"] if insel["punkte"] >= int(s["punkte"]))
        self._geaendert()

    def schatzkarte_attribute(self) -> dict[str, Any]:
        insel = self.daten["insel"]
        stationen = [
            {**s, "emoji": s.get("emoji", "📍"), "erreicht": i < insel["erreicht"]}
            for i, s in enumerate(self.daten["stationen"])
        ]
        naechste = next((s for s in stationen if not s["erreicht"]), None)
        return {
            "insel": insel["nummer"],
            "punkte": insel["punkte"],
            "ziel": int(stationen[-1]["punkte"]) if stationen else 0,
            "stationen": stationen,
            "naechste": naechste["name"] if naechste else None,
            "fehlt": max(0, int(naechste["punkte"]) - insel["punkte"]) if naechste else 0,
        }

    # ----------------------------------------------------------------- Zeitpläne
    async def _tageswechsel(self, jetzt) -> None:
        gestern = (dt_util.as_local(jetzt).date() - timedelta(days=1)).isoformat()
        for st in self.daten["personen"].values():
            st["heute"] = 0
            if dt_util.as_local(jetzt).weekday() == 0:
                st["woche"] = 0
            if st.get("aktiv") not in (gestern, dt_util.as_local(jetzt).date().isoformat()):
                st["serie"] = 0
        self._geaendert()

    async def _rotation_zeit(self, _jetzt) -> None:
        if self.einstellungen.get("rotation_aktiv"):
            await self.async_dienste_verteilen()

    async def async_dienste_verteilen(self) -> list[dict[str, Any]]:
        mitmacher = self.mitmacher()
        if not mitmacher:
            return []
        heute = dt_util.now().date()
        rot = self.daten["rotation"]
        verteilt = []
        for d in self.daten["dienste"]:
            if heute.weekday() not in d.get("tage", ALLE_TAGE):
                continue
            zaehler = int(rot["zaehler"].get(d["key"], 0))
            slug = wer_ist_dran(mitmacher, zaehler, int(d.get("versatz", 0)))
            rot["zaehler"][d["key"]] = zaehler + 1
            rot["zuletzt"][d["key"]] = slug
            person = self.coord.person(slug)
            if not person or not person.todo_entity:
                continue
            try:
                await self.hass.services.async_call(
                    "todo", "add_item",
                    {"entity_id": person.todo_entity, "item": f"{d['titel']} +{d['punkte']}",
                     "due_date": heute.isoformat(),
                     "description": _t(self.hass, "dienst_beschreibung", punkte=d["punkte"])},
                    blocking=True,
                )
            except HomeAssistantError as err:
                _LOGGER.warning("Dienst %s konnte nicht eingetragen werden: %s", d["titel"], err)
                continue
            verteilt.append({"dienst": d["titel"], "person": slug})
        rot["datum"] = heute.isoformat()
        for slug in {v["person"] for v in verteilt}:
            titel = ", ".join(v["dienst"] for v in verteilt if v["person"] == slug)
            await self.coord.async_benachrichtigen(slug, _t(self.hass, "dienst_push"), titel)
        self._geaendert()
        return verteilt

    # --------------------------------------------------------------- Aktionen
    async def async_einloesen(self, belohnung: str, kosten: int, slug: str) -> dict[str, Any]:
        st = self.stand(slug)
        name = self.coord.namen.get(slug, slug.capitalize())
        if st["konto"] < kosten:
            return {"ok": False, "konto": st["konto"], "fehlt": kosten - st["konto"]}
        st["konto"] -= kosten
        familie = self.coord.opt.get(CONF_FAMILY_TODO)
        if familie:
            await self.hass.services.async_call(
                "todo", "add_item",
                {"entity_id": familie, "item": _t(self.hass, "belohnung_aufgabe", name=name, belohnung=belohnung),
                 "description": _t(self.hass, "belohnung_beschreibung", kosten=kosten,
                                   zeit=f"{dt_util.now():%d.%m.%Y %H:%M}")},
                blocking=True,
            )
            # Diese Aufgabe soll beim Abhaken keine Punkte bringen.
            await self.async_liste_pruefen(familie)
        self._geaendert()
        return {"ok": True, "konto": st["konto"], "fehlt": 0}

    def rennen_neu(self) -> None:
        for st in self.daten["personen"].values():
            st["rennen"] = 0
        self.daten["sieger"] = ""
        self._geaendert()

    def familienziel_einloesen(self) -> None:
        self.daten["familienpunkte"] = 0
        self._geaendert()

    def einstellen(self, key: str, wert: Any) -> None:
        self.einstellungen[key] = wert
        if key == "rotation_uhrzeit":
            self._rotation_planen()
        self._geaendert()

    # ---------------------------------------------------------------- Anzeige
    def rennen_attribute(self) -> dict[str, Any]:
        fahrer = []
        for p in self.personen:
            st = self.daten["personen"].get(p.slug)
            if not st:
                continue
            stufe, lname, naechste = level(st["gesamt"], sprache(self.hass))
            fahrer.append({
                "slug": p.slug,
                "name": p.name,
                "person": p.person_entity,
                "user_id": self._user_id(p),
                "liste": p.todo_entity,
                "rotation": p.rotation,
                "punkte": st["rennen"],
                "konto": st["konto"],
                "gesamt": st["gesamt"],
                "heute": st["heute"],
                "woche": st["woche"],
                "serie": st["serie"],
                "level": stufe,
                "level_name": lname,
                "naechstes_level": naechste,
                "fahrzeug": st["fahrzeug"],
                "farbe": st["farbe"],
                "farbe_hex": farbe_hex(st["farbe"], p.farbe),
            })
        e = self.einstellungen
        return {
            "ziel": e["rennen_ziel"],
            "sieger": self.daten["sieger"],
            "familienpunkte": self.daten["familienpunkte"],
            "familienziel": e["familienziel"],
            "familienziel_text": e["familienziel_text"],
            "punkte_pro_aufgabe": e["punkte_pro_aufgabe"],
            "fahrer": fahrer,
            "fahrzeuge": FAHRZEUGE,
            "farben": FARBEN,
            "belohnungen": self.daten["belohnungen"],
            "dienste": self.dienste_attribute(),
            "familien_liste": self.coord.opt.get(CONF_FAMILY_TODO),
            "entitaeten": self.entitaeten(),
            "schatzkarte": self.schatzkarte_attribute(),
        }

    def entitaeten(self) -> dict[str, str]:
        """Entitäts-IDs der eigenen Entitäten (für das Dashboard, sprachunabhängig)."""
        reg = er.async_get(self.hass)
        aus: dict[str, str] = {}
        for eintrag in er.async_entries_for_config_entry(reg, self.entry.entry_id):
            praefix = f"{self.entry.entry_id}_aufgaben_"
            if eintrag.unique_id.startswith(praefix):
                aus[eintrag.unique_id.removeprefix(praefix)] = eintrag.entity_id
        return aus

    def dienste_attribute(self) -> list[dict[str, Any]]:
        rot = self.daten["rotation"]
        mitmacher = self.mitmacher()
        heute = dt_util.now().date().weekday()
        aus = []
        for d in self.daten["dienste"]:
            zaehler = int(rot["zaehler"].get(d["key"], 0))
            aus.append({
                "key": d["key"],
                "titel": d["titel"],
                "punkte": d["punkte"],
                "tage": d.get("tage", ALLE_TAGE),
                "heute_dran": d.get("tage", ALLE_TAGE).count(heute) > 0,
                "zuletzt": self.coord.namen.get(rot["zuletzt"].get(d["key"]) or "", ""),
                "als_naechstes": self.coord.namen.get(wer_ist_dran(mitmacher, zaehler, int(d.get("versatz", 0))) or "", ""),
            })
        return aus


# ------------------------------------------------------------------------ Dienste
SCHEMA_BUCHEN = vol.Schema({
    vol.Required("person"): cv.string,
    vol.Required("punkte"): vol.Coerce(int),
    vol.Optional("aufgaben", default=0): vol.Coerce(int),
})
SCHEMA_EINLOESEN = vol.Schema({
    vol.Required("belohnung"): cv.string,
    vol.Required("kosten"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    vol.Optional("person"): cv.string,
})
SCHEMA_FAHRZEUG = vol.Schema({
    vol.Required("person"): cv.string,
    vol.Optional("fahrzeug"): vol.In(FAHRZEUGE),
    vol.Optional("farbe"): cv.string,
})
SCHEMA_BELOHNUNGEN = vol.Schema({
    vol.Required("belohnungen"): [vol.Schema({
        vol.Required("name"): cv.string,
        vol.Required("kosten"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("icon", default="mdi:gift-outline"): cv.icon,
    })],
})
SCHEMA_STATIONEN = vol.Schema({
    vol.Required("stationen"): vol.All([vol.Schema({
        vol.Required("name"): cv.string,
        vol.Required("belohnung"): cv.string,
        vol.Required("punkte"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("emoji", default="📍"): cv.string,
    })], vol.Length(min=1)),
})
SCHEMA_DIENSTE = vol.Schema({
    vol.Required("dienste"): [vol.Schema({
        vol.Required("titel"): cv.string,
        vol.Optional("key"): cv.slug,
        vol.Optional("punkte", default=10): vol.All(vol.Coerce(int), vol.Range(min=0)),
        vol.Optional("tage", default=ALLE_TAGE): [vol.All(vol.Coerce(int), vol.Range(min=0, max=6))],
        vol.Optional("versatz", default=0): vol.Coerce(int),
    })],
})


def _manager(hass: HomeAssistant) -> AufgabenManager:
    for entry in hass.config_entries.async_loaded_entries(DOMAIN):
        m = getattr(entry.runtime_data, "aufgaben", None)
        if m:
            return m
    raise ServiceValidationError(_t(hass, "nicht_eingerichtet"))


async def _darf_fuer(hass: HomeAssistant, m: AufgabenManager, call: ServiceCall, slug: str) -> None:
    """Nur die Person selbst oder ein Admin darf für eine Person handeln."""
    uid = call.context.user_id
    if uid is None:  # Automationen, Skripte
        return
    user = await hass.auth.async_get_user(uid)
    if user and user.is_admin:
        return
    if m._slug_von_benutzer(uid) != slug:
        raise Unauthorized(context=call.context)


def _dienste_registrieren(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "punkte_buchen"):
        return

    async def buchen(call: ServiceCall) -> None:
        m = _manager(hass)
        uid = call.context.user_id
        if uid:
            user = await hass.auth.async_get_user(uid)
            if not (user and user.is_admin):
                raise Unauthorized(context=call.context)
        await m.async_buchen(call.data["person"].lower(), call.data["punkte"], call.data["aufgaben"])

    async def einloesen(call: ServiceCall) -> ServiceResponse:
        m = _manager(hass)
        slug = (call.data.get("person") or "").lower() or m._slug_von_benutzer(call.context.user_id)
        if not slug or slug not in m.daten["personen"]:
            raise ServiceValidationError(_t(hass, "wer_unbekannt"))
        await _darf_fuer(hass, m, call, slug)
        name = m.coord.namen.get(slug, slug.capitalize())
        ergebnis = await m.async_einloesen(call.data["belohnung"], call.data["kosten"], slug)
        b, k = call.data["belohnung"], call.data["kosten"]
        if ergebnis["ok"]:
            persistent_notification.async_create(
                hass, _t(hass, "eingeloest_text", name=name, belohnung=b, kosten=k, konto=ergebnis["konto"]),
                title=_t(hass, "eingeloest_titel"), notification_id=f"{DOMAIN}_belohnung_{slug}",
            )
        else:
            persistent_notification.async_create(
                hass, _t(hass, "zu_wenig_text", name=name, belohnung=b, fehlt=ergebnis["fehlt"]),
                title=_t(hass, "zu_wenig_titel"), notification_id=f"{DOMAIN}_belohnung_{slug}",
            )
        return ergebnis

    async def fahrzeug(call: ServiceCall) -> None:
        m = _manager(hass)
        slug = call.data["person"].lower()
        if slug not in m.daten["personen"]:
            raise ServiceValidationError(_t(hass, "person_unbekannt", slug=slug))
        await _darf_fuer(hass, m, call, slug)
        st = m.stand(slug)
        if "fahrzeug" in call.data:
            st["fahrzeug"] = call.data["fahrzeug"]
        if "farbe" in call.data:
            farbe = call.data["farbe"].strip()
            if farbe not in FARBEN and not re.fullmatch(r"#[0-9a-fA-F]{6}", farbe):
                raise ServiceValidationError(_t(hass, "farbe_unbekannt", farbe=farbe))
            st["farbe"] = farbe
        m._geaendert()

    async def nur_admin(call: ServiceCall) -> None:
        uid = call.context.user_id
        if uid:
            user = await hass.auth.async_get_user(uid)
            if not (user and user.is_admin):
                raise Unauthorized(context=call.context)

    async def rennen_neu(call: ServiceCall) -> None:
        await nur_admin(call)
        _manager(hass).rennen_neu()

    async def verteilen(call: ServiceCall) -> ServiceResponse:
        await nur_admin(call)
        return {"verteilt": await _manager(hass).async_dienste_verteilen()}

    async def belohnungen(call: ServiceCall) -> None:
        await nur_admin(call)
        m = _manager(hass)
        m.daten["belohnungen"] = call.data["belohnungen"]
        m._geaendert()

    async def dienste(call: ServiceCall) -> None:
        await nur_admin(call)
        m = _manager(hass)
        neu = []
        for i, d in enumerate(call.data["dienste"]):
            key = d.get("key") or cv.slug(d["titel"].encode("ascii", "ignore").decode().strip() or f"dienst_{i}") or f"dienst_{i}"
            neu.append({**d, "key": key})
        m.daten["dienste"] = neu
        m._geaendert()

    hass.services.async_register(DOMAIN, "punkte_buchen", buchen, schema=SCHEMA_BUCHEN)
    hass.services.async_register(
        DOMAIN, "belohnung_einloesen", einloesen, schema=SCHEMA_EINLOESEN, supports_response=SupportsResponse.OPTIONAL
    )
    hass.services.async_register(DOMAIN, "fahrzeug_waehlen", fahrzeug, schema=SCHEMA_FAHRZEUG)
    hass.services.async_register(DOMAIN, "rennen_neu_starten", rennen_neu, schema=vol.Schema({}))
    hass.services.async_register(
        DOMAIN, "dienste_verteilen", verteilen, schema=vol.Schema({}), supports_response=SupportsResponse.OPTIONAL
    )
    hass.services.async_register(DOMAIN, "belohnungen_festlegen", belohnungen, schema=SCHEMA_BELOHNUNGEN)
    hass.services.async_register(DOMAIN, "dienste_festlegen", dienste, schema=SCHEMA_DIENSTE)

    async def stationen(call: ServiceCall) -> None:
        await nur_admin(call)
        _manager(hass).stationen_festlegen(call.data["stationen"])

    async def insel_neu(call: ServiceCall) -> None:
        await nur_admin(call)
        _manager(hass).insel_neu()

    hass.services.async_register(DOMAIN, "schatzkarte_festlegen", stationen, schema=SCHEMA_STATIONEN)
    hass.services.async_register(DOMAIN, "neue_insel", insel_neu, schema=vol.Schema({}))


# ----------------------------------------------------------------------- Entitäten
class _AufgabenEntity(FamilienplanerEntity):
    """Basis: aktualisiert sich bei jeder Punkte-Änderung."""

    def __init__(self, coord: FamilienplanerCoordinator, key: str, translation_key: str, icon: str) -> None:
        super().__init__(coord, f"aufgaben_{key}")
        self.m: AufgabenManager = coord.aufgaben  # type: ignore[attr-defined]
        self._attr_translation_key = translation_key
        self._attr_icon = icon

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(async_dispatcher_connect(self.hass, self.m.signal, self.async_write_ha_state))


class RennenSensor(_AufgabenEntity, SensorEntity):
    """Alles für die Rennstrecken-Karte in einer Entität."""

    def __init__(self, coord) -> None:
        super().__init__(coord, "rennen", "rennen", "mdi:flag-checkered")

    @property
    def native_value(self) -> str:
        if self.m.daten["sieger"]:
            return self.m.daten["sieger"]
        fahrer = [(st["rennen"], p.name) for p in self.m.personen if (st := self.m.daten["personen"].get(p.slug))]
        if not fahrer or max(fahrer)[0] <= 0:
            return _t(self.hass, "start")
        return max(fahrer)[1]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return self.m.rennen_attribute()


class PunkteSensor(_AufgabenEntity, SensorEntity):
    """Punktekonto einer Person (für Überschriften und Automationen)."""

    _attr_native_unit_of_measurement = "Punkte"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coord, p: Person) -> None:
        super().__init__(coord, f"punkte_{p.slug}", "punkte", "mdi:star-circle-outline")
        self._attr_translation_placeholders = {"name": p.name}
        self.slug = p.slug

    @property
    def native_value(self) -> int:
        return int(self.m.stand(self.slug)["konto"]) if self.slug in self.m.daten["personen"] else 0

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        st = self.m.daten["personen"].get(self.slug, {})
        stufe, name, _ = level(st.get("gesamt", 0), sprache(self.hass))
        return {k: st.get(k) for k in ("rennen", "gesamt", "heute", "woche", "serie", "fahrzeug", "farbe")} | {
            "level": stufe, "level_name": name,
        }


class HaushaltSensor(_AufgabenEntity, SensorEntity):
    def __init__(self, coord) -> None:
        super().__init__(coord, "haushalt", "haushalt", "mdi:home-heart")

    @property
    def native_value(self) -> str:
        teile = [f"{d['titel'].split(' ', 1)[-1]}: {d['zuletzt']}" for d in self.m.dienste_attribute()
                 if d["heute_dran"] and d["zuletzt"]]
        return " · ".join(teile)[:250] or "—"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {"dienste": self.m.dienste_attribute(), "verteilt_am": self.m.daten["rotation"].get("datum")}


EINSTELLUNG_ZAHLEN = [
    ("punkte_pro_aufgabe", "mdi:star-circle", 0, 500, 1),
    ("rennen_ziel", "mdi:flag-checkered", 10, 100000, 10),
    ("serien_bonus", "mdi:fire", 0, 500, 1),
    ("sieger_bonus", "mdi:trophy", 0, 5000, 5),
    ("familienziel", "mdi:account-group", 10, 1000000, 10),
]


class EinstellungNumber(_AufgabenEntity, NumberEntity):
    _attr_entity_category = EntityCategory.CONFIG
    _attr_mode = NumberMode.BOX
    _attr_native_unit_of_measurement = "Punkte"

    def __init__(self, coord, key, icon, mn, mx, step) -> None:
        super().__init__(coord, key, key, icon)
        self.key = key
        self._attr_native_min_value, self._attr_native_max_value, self._attr_native_step = mn, mx, step

    @property
    def native_value(self) -> float:
        return float(self.m.einstellungen[self.key])

    async def async_set_native_value(self, value: float) -> None:
        self.m.einstellen(self.key, int(value))


class FamilienzielText(_AufgabenEntity, TextEntity):
    _attr_entity_category = EntityCategory.CONFIG
    _attr_native_max = 100

    def __init__(self, coord) -> None:
        super().__init__(coord, "familienziel_text", "familienziel_text", "mdi:gift-outline")

    @property
    def native_value(self) -> str:
        return self.m.einstellungen["familienziel_text"]

    async def async_set_value(self, value: str) -> None:
        self.m.einstellen("familienziel_text", value)


class RotationSwitch(_AufgabenEntity, SwitchEntity):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, coord) -> None:
        super().__init__(coord, "rotation_aktiv", "rotation_aktiv", "mdi:autorenew")

    @property
    def is_on(self) -> bool:
        return bool(self.m.einstellungen["rotation_aktiv"])

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.m.einstellen("rotation_aktiv", True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.m.einstellen("rotation_aktiv", False)


class RotationTime(_AufgabenEntity, TimeEntity):
    _attr_entity_category = EntityCategory.CONFIG

    def __init__(self, coord) -> None:
        super().__init__(coord, "rotation_uhrzeit", "rotation_uhrzeit", "mdi:clock-outline")

    @property
    def native_value(self) -> time:
        return time.fromisoformat(self.m.einstellungen["rotation_uhrzeit"])

    async def async_set_value(self, value: time) -> None:
        self.m.einstellen("rotation_uhrzeit", value.isoformat())


class AktionButton(_AufgabenEntity, ButtonEntity):
    def __init__(self, coord, key, icon, aktion: Callable[[AufgabenManager], Any]) -> None:
        super().__init__(coord, key, key, icon)
        self._aktion = aktion

    async def async_press(self) -> None:
        ergebnis = self._aktion(self.m)
        if asyncio.iscoroutine(ergebnis):
            await ergebnis


def entitaeten(coord: FamilienplanerCoordinator, plattform: str) -> list:
    if plattform == "sensor":
        return [RennenSensor(coord), HaushaltSensor(coord)] + [PunkteSensor(coord, p) for p in coord.personen]
    if plattform == "number":
        return [EinstellungNumber(coord, *z) for z in EINSTELLUNG_ZAHLEN]
    if plattform == "text":
        return [FamilienzielText(coord)]
    if plattform == "switch":
        return [RotationSwitch(coord)]
    if plattform == "time":
        return [RotationTime(coord)]
    if plattform == "button":
        return [
            AktionButton(coord, "rennen_neu", "mdi:flag-variant-outline", lambda m: m.rennen_neu()),
            AktionButton(coord, "dienste_verteilen", "mdi:autorenew", lambda m: m.async_dienste_verteilen()),
            AktionButton(coord, "familienziel_einloesen", "mdi:party-popper", lambda m: m.familienziel_einloesen()),
            AktionButton(coord, "insel_neu", "mdi:island", lambda m: m.insel_neu()),
        ]
    return []


# --------------------------------------------------------------------- Einstieg
async def async_setup(hass: HomeAssistant, entry: ConfigEntry, coord: FamilienplanerCoordinator) -> None:
    manager = AufgabenManager(hass, entry, coord)
    await manager.async_start()
    coord.aufgaben = manager  # type: ignore[attr-defined]
    if not hasattr(coord, "erweiterungen"):
        coord.erweiterungen = []  # type: ignore[attr-defined]
    coord.erweiterungen.append(entitaeten)  # type: ignore[attr-defined]
    _dienste_registrieren(hass)

    async def _beenden() -> None:
        manager.async_stop()
        await manager.async_speichern()

    entry.async_on_unload(_beenden)
