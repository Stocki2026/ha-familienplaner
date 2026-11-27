"""Datenmodelle des Familienplaners."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
import re
from typing import Any

from .const import (
    P_CALENDAR,
    P_COLOR,
    P_NAME,
    P_NOTIFY,
    P_PERSON,
    P_ROTATION,
    P_SLUG,
    P_TODO,
)


def slugify_name(name: str) -> str:
    """Name -> slug (anna, carla, ...), deutsch-freundlich."""
    s = name.strip().lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s or "person"


@dataclass
class Person:
    """Ein Familienmitglied."""

    slug: str
    name: str
    person_entity: str | None = None
    calendar_entity: str | None = None
    todo_entity: str | None = None
    farbe: str = "#5B8DB8"
    notify_service: str | None = None
    rotation: bool = True

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Person:
        return cls(
            slug=data[P_SLUG],
            name=data[P_NAME],
            person_entity=data.get(P_PERSON) or None,
            calendar_entity=data.get(P_CALENDAR) or None,
            todo_entity=data.get(P_TODO) or None,
            farbe=data.get(P_COLOR) or "#5B8DB8",
            notify_service=data.get(P_NOTIFY) or None,
            rotation=bool(data.get(P_ROTATION, True)),
        )

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Termin:
    """Ein Kalendertermin, wie ihn calendar.get_events liefert."""

    summary: str
    start: datetime | date
    end: datetime | date
    location: str = ""
    description: str = ""
    uid: str | None = None
    kalender: str = ""
    person: str = ""  # slug oder "familie"

    @property
    def ganztag(self) -> bool:
        return not isinstance(self.start, datetime)

    @property
    def fahrer(self) -> str:
        """Fahrer aus der Beschreibung ("Fahrer: Carla")."""
        m = re.search(r"(?i)fahrer:\s*([A-Za-zÄÖÜäöüß]+)", self.description or "")
        return m.group(1).capitalize() if m else ""

    @property
    def key(self) -> str:
        return f"{self.kalender}|{self.uid or self.summary}|{self.start.isoformat()}"

    def as_dict(self) -> dict[str, Any]:
        return {
            "titel": self.summary,
            "start": self.start.isoformat(),
            "ende": self.end.isoformat(),
            "ort": self.location,
            "beschreibung": self.description,
            "ganztag": self.ganztag,
            "fahrer": self.fahrer,
            "person": self.person,
            "kalender": self.kalender,
        }


@dataclass
class PlanerDaten:
    """Ergebnis eines Coordinator-Updates."""

    naechste: dict[str, Termin | None] = field(default_factory=dict)
    heute: dict[str, list[Termin]] = field(default_factory=dict)
    alle_kurz: list[Termin] = field(default_factory=list)
    countdowns: list[dict[str, Any]] = field(default_factory=list)
    muell: list[dict[str, Any]] = field(default_factory=list)
    ferien: dict[str, Any] = field(default_factory=dict)
    pinnwand: list[str] = field(default_factory=list)
    essen_heute: list[str] = field(default_factory=list)
