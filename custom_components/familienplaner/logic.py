"""Reine Logik (ohne Home-Assistant-Abhängigkeiten), gut testbar."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import re
from typing import Any, Iterable

from .models import Termin

WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]
WOCHENTAGE_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
MONATE = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
]

WETTER_DE = {
    "clear-night": "klar",
    "cloudy": "bewölkt",
    "exceptional": "Unwetter",
    "fog": "neblig",
    "hail": "Hagel",
    "lightning": "Gewitter",
    "lightning-rainy": "Gewitter mit Regen",
    "partlycloudy": "teils bewölkt",
    "pouring": "starker Regen",
    "rainy": "Regen",
    "snowy": "Schnee",
    "snowy-rainy": "Schneeregen",
    "sunny": "sonnig",
    "windy": "windig",
    "windy-variant": "windig und bewölkt",
}
NASS = {"rainy", "pouring", "snowy", "snowy-rainy", "lightning", "lightning-rainy", "hail"}


def _parse(value: Any, tz) -> datetime | date:
    if isinstance(value, (datetime, date)):
        return value
    text = str(value)
    if "T" in text or " " in text.strip():
        dt = datetime.fromisoformat(text.replace(" ", "T"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        return dt
    return date.fromisoformat(text[:10])


def parse_events(antwort: dict[str, Any], entity_id: str, person: str, tz) -> list[Termin]:
    """Antwort von calendar.get_events -> Termine eines Kalenders."""
    roh = (antwort or {}).get(entity_id, {}).get("events", []) or []
    termine = []
    for e in roh:
        try:
            termine.append(
                Termin(
                    summary=str(e.get("summary", "")),
                    start=_parse(e["start"], tz),
                    end=_parse(e["end"], tz),
                    location=str(e.get("location") or ""),
                    description=str(e.get("description") or ""),
                    uid=e.get("uid"),
                    kalender=entity_id,
                    person=person,
                )
            )
        except (KeyError, ValueError):
            continue
    return termine


def _sort_key(t: Termin) -> datetime:
    if isinstance(t.start, datetime):
        return t.start
    return datetime.combine(t.start, datetime.min.time()).replace(tzinfo=None).astimezone()


def sortiert(termine: Iterable[Termin]) -> list[Termin]:
    return sorted(termine, key=lambda t: (_sort_key(t).timestamp(), t.summary))


def naechster_termin(termine: Iterable[Termin], jetzt: datetime) -> Termin | None:
    """Laufender oder nächster Termin mit Uhrzeit."""
    for t in sortiert(x for x in termine if not x.ganztag):
        if t.end > jetzt:  # type: ignore[operator]
            return t
    return None


def wann_text(t: Termin | None, jetzt: datetime) -> str:
    """'läuft gerade', 'in 45 Min', 'heute 18:30', 'morgen 08:00', 'Fr 14:00'."""
    if t is None:
        return "die nächsten Tage frei"
    if t.ganztag:
        tage = (t.start - jetzt.date()).days  # type: ignore[operator]
        return "heute" if tage <= 0 else ("morgen" if tage == 1 else f"in {tage} Tagen")
    start = t.start.astimezone(jetzt.tzinfo)  # type: ignore[union-attr]
    ende = t.end.astimezone(jetzt.tzinfo)  # type: ignore[union-attr]
    if start <= jetzt < ende:
        return "läuft gerade"
    minuten = int(-(-(start - jetzt).total_seconds() // 60))
    if minuten < 60:
        return f"in {minuten} Min"
    if start.date() == jetzt.date():
        return f"heute {start:%H:%M}"
    if start.date() == (jetzt + timedelta(days=1)).date():
        return f"morgen {start:%H:%M}"
    return f"{WOCHENTAGE_KURZ[start.weekday()]} {start:%H:%M}"


def zeit_text(t: Termin, tz) -> str:
    return "ganztägig" if t.ganztag else t.start.astimezone(tz).strftime("%H:%M")  # type: ignore[union-attr]


def tage_bis(d: datetime | date, heute: date) -> int:
    if isinstance(d, datetime):
        d = d.date()
    return (d - heute).days


def ist_geburtstag(summary: str) -> bool:
    return "geburtstag" in summary.lower() or "🎂" in summary


def geburtstag_name(summary: str) -> str:
    name = re.sub(r"(?i)\bgeburtstag\b|🎂|\bvon\b|\bhat\b", "", summary)
    return name.strip(" :-–") or summary


def countdowns(besondere: list[Termin], feiertage: list[Termin], heute: date, limit: int = 6) -> list[dict[str, Any]]:
    kandidaten = list(besondere) + sortiert(t for t in feiertage if tage_bis(t.start, heute) >= 0)[:2]
    liste = []
    for t in kandidaten:
        tage = tage_bis(t.start, heute)
        if tage >= 0:
            liste.append({"titel": t.summary, "tage": tage, "datum": t.start.isoformat()[:10],
                          "geburtstag": ist_geburtstag(t.summary)})
    liste.sort(key=lambda x: (x["tage"], x["titel"]))
    return liste[:limit]


def countdown_text(tage: int) -> str:
    return "Heute! 🎉" if tage == 0 else ("Morgen" if tage == 1 else f"noch {tage} Tage")


def muell_liste(termine: list[Termin], heute: date) -> list[dict[str, Any]]:
    """Nächster Abholtermin je Tonne."""
    gesehen: dict[str, dict[str, Any]] = {}
    for t in sortiert(termine):
        tage = tage_bis(t.start, heute)
        if tage < 0:
            continue
        name = t.summary.strip()
        if name not in gesehen:
            gesehen[name] = {"tonne": name, "datum": t.start.isoformat()[:10], "tage": tage}
    return sorted(gesehen.values(), key=lambda x: x["tage"])


def muell_an_tag(termine: list[Termin], tag: date) -> list[str]:
    namen = []
    for t in termine:
        s = t.start.date() if isinstance(t.start, datetime) else t.start
        e = t.end.date() if isinstance(t.end, datetime) else t.end
        if s <= tag < max(e, s + timedelta(days=1)) and t.summary.strip() not in namen:
            namen.append(t.summary.strip())
    return namen


def ferien_info(termine: list[Termin], heute: date) -> dict[str, Any]:
    for t in sortiert(termine):
        start = t.start.date() if isinstance(t.start, datetime) else t.start
        ende = t.end.date() if isinstance(t.end, datetime) else t.end
        if ende <= heute:
            continue
        if start <= heute:
            rest = (ende - heute).days
            return {"titel": t.summary, "jetzt": True, "tage": rest, "text": f"{t.summary} · noch {rest} Tage frei"}
        tage = (start - heute).days
        return {"titel": t.summary, "jetzt": False, "tage": tage, "text": f"{t.summary} in {tage} Tagen"}
    return {}


def wetter_zur_zeit(forecast: list[dict[str, Any]], zeitpunkt: datetime) -> dict[str, Any] | None:
    """Stundenvorhersage, die zum Zeitpunkt passt (letzte vor zeitpunkt+30min)."""
    treffer = None
    grenze = zeitpunkt + timedelta(minutes=30)
    for f in forecast or []:
        try:
            dt = datetime.fromisoformat(str(f["datetime"]))
        except (KeyError, ValueError):
            continue
        if dt <= grenze:
            treffer = f
    return treffer


def wetter_bewertung(f: dict[str, Any] | None) -> tuple[bool, bool]:
    """(nass, kalt)"""
    if not f:
        return False, False
    nass = (
        f.get("condition") in NASS
        or float(f.get("precipitation_probability") or 0) >= 60
        or float(f.get("precipitation") or 0) >= 0.5
    )
    kalt = float(f.get("temperature", 10)) <= 2
    return nass, kalt


def wetter_hinweis(f: dict[str, Any], start: datetime) -> str:
    nass, kalt = wetter_bewertung(f)
    teile = [f"{WETTER_DE.get(f.get('condition', ''), f.get('condition', '')).capitalize()}, "
             f"{round(float(f.get('temperature', 0)))} °C um {start:%H:%M} Uhr."]
    if nass:
        teile.append("Regenjacke oder Schirm mitnehmen!")
    if kalt:
        teile.append("Warm anziehen, Mütze & Handschuhe!")
    return " ".join(teile)


def tages_zeilen(termine: list[Termin], tz) -> list[str]:
    zeilen = []
    for t in sortiert(termine):
        z = f"{zeit_text(t, tz)} {t.summary}"
        if t.location:
            z += f" ({t.location})"
        if t.fahrer:
            z += f" 🚗 {t.fahrer}"
        zeilen.append(z)
    return zeilen


def morgen_ansage(
    jetzt: datetime,
    wetter_tag: dict[str, Any] | None,
    termine: list[Termin],
    namen: dict[str, str],
    besondere: list[Termin],
    essen: list[str],
    muell_heute: list[str],
    ferien: dict[str, Any],
) -> str:
    """Text für die Alexa-Morgen-Ansage (ohne Emojis)."""
    teile = [f"Guten Morgen! Heute ist {WOCHENTAGE[jetzt.weekday()]}, der {jetzt.day}. {MONATE[jetzt.month - 1]}."]
    if wetter_tag:
        w = f"Das Wetter: {WETTER_DE.get(wetter_tag.get('condition', ''), 'gemischt')}, bis {round(float(wetter_tag.get('temperature', 0)))} Grad"
        if wetter_tag.get("templow") is not None:
            w += f", morgens {round(float(wetter_tag['templow']))} Grad"
        teile.append(w + ".")
    if ferien.get("jetzt"):
        teile.append(f"Es sind {ferien['titel']}, also schulfrei.")
    zeitlich = [t for t in sortiert(termine) if not t.ganztag]
    if zeitlich:
        saetze = []
        for t in zeitlich:
            wer = "" if t.person == "familie" else f"{namen.get(t.person, t.person.capitalize())}: "
            s = f"{t.start.astimezone(jetzt.tzinfo):%H:%M} Uhr {wer}{t.summary}"  # type: ignore[union-attr]
            if t.fahrer:
                s += f", {t.fahrer} fährt"
            saetze.append(s)
        teile.append("Heute steht an: " + ". ".join(saetze) + ".")
    else:
        teile.append("Heute stehen keine Termine an.")
    for t in besondere:
        teile.append(f"Und nicht vergessen: {t.summary}!")
    for gericht in essen:
        teile.append(f"Zum Essen gibt es {gericht}.")
    if muell_heute:
        teile.append(f"Heute wird {' und '.join(muell_heute)} abgeholt.")
    teile.append("Einen schönen Tag!")
    text = " ".join(teile)
    text = re.sub(r"[^\w\s.,:!?()\-+]", "", text)
    return re.sub(r"\s+", " ", text).strip()


# --------------------------------------------------------------- Konflikte
def _ueberlappt(a: Termin, b: Termin) -> bool:
    return a.start < b.end and b.start < a.end  # type: ignore[operator]


def konflikte(termine: list[Termin], jetzt: datetime, fahrer_von, namen: dict[str, str]) -> list[dict[str, Any]]:
    """Überschneidungen finden.

    - "doppelt": zwei eigene Termine einer Person überschneiden sich
    - "fahrer":  der Fahrer eines Termins hat zur selben Zeit selbst einen Termin
                 oder fährt gleichzeitig jemand anderen
    fahrer_von(t) liefert den slug des Fahrers ("" = keiner).
    """
    zukunft = [t for t in sortiert(termine) if not t.ganztag and t.end > jetzt]  # type: ignore[operator]
    ergebnis: list[dict[str, Any]] = []
    gesehen: set[str] = set()

    def neu(art: str, person: str, a: Termin, b: Termin) -> None:
        key = "|".join(sorted([a.key, b.key])) + f"|{art}|{person}"
        if key in gesehen:
            return
        gesehen.add(key)
        name = namen.get(person, person.capitalize())
        start = max(a.start, b.start)  # type: ignore[type-var]
        if art == "doppelt":
            text = f"{name}: „{a.summary}“ und „{b.summary}“ überschneiden sich"
        else:
            text = f"{name} soll fahren, hat aber „{b.summary}“"
        ergebnis.append({"art": art, "person": person, "a": a.summary, "b": b.summary,
                         "start": start.isoformat(), "text": text, "key": key})

    for i, a in enumerate(zukunft):
        for b in zukunft[i + 1:]:
            if b.start >= a.end:  # type: ignore[operator]
                break
            if a.person == b.person and a.person != "familie" and a.kalender == b.kalender:
                neu("doppelt", a.person, a, b)
    for t in zukunft:
        f = fahrer_von(t)
        if not f or f == t.person:
            continue
        for b in zukunft:
            if b is t or not _ueberlappt(t, b):
                continue
            if b.person == f or (fahrer_von(b) == f and b.person != t.person):
                neu("fahrer", f, t, b)
    ergebnis.sort(key=lambda k: k["start"])
    return ergebnis


# ------------------------------------------------------- Termin aus einem Satz
_TAGE = {
    "montag": 0, "dienstag": 1, "mittwoch": 2, "donnerstag": 3, "freitag": 4, "samstag": 5, "sonntag": 6,
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
}
_MONATE = {m.lower(): i + 1 for i, m in enumerate(MONATE)} | {
    m: i + 1 for i, m in enumerate(["january", "february", "march", "april", "may", "june", "july",
                                    "august", "september", "october", "november", "december"])
} | {"maerz": 3, "jan": 1, "feb": 2, "aug": 8, "sep": 9, "okt": 10, "nov": 11, "dez": 12}
_FUELL = {
    "hat", "habe", "haben", "muss", "müssen", "geht", "gehen", "soll", "einen", "ein", "eine", "termin", "um",
    "am", "uhr", "zum", "zur", "beim", "ab", "has", "have", "an", "a", "at", "on", "appointment", "the",
    "nächsten", "naechsten", "kommenden", "next", "trag", "trage", "ein,", "bitte", "please", "add",
    "für", "fuer", "for", "o'clock",
}
_FAMILIE_WORTE = {"wir", "familie", "alle", "uns", "we", "family", "everyone"}


def termin_aus_satz(text: str, namen: dict[str, str], jetzt: datetime) -> dict[str, Any] | None:
    """Versteht Sätze wie „Ben hat Dienstag um 4 Fußball, Anna fährt“.

    namen: {kleingeschriebener Name: slug}. Ergebnis: person, titel, start, ganztag, fahrer
    oder None, wenn kein Titel übrig bleibt.
    """
    satz = " " + re.sub(r"\s+", " ", text.strip()) + " "
    low = satz.lower()

    # Fahrer: "Anna fährt", "fährt Anna", "Fahrer Anna", "Anna drives"
    fahrer = ""
    for name, slug in namen.items():
        muster = rf"(?:,?\s*{re.escape(name)}\s+(?:fährt|faehrt|bringt|holt ab|drives)|,?\s*(?:fährt|faehrt|fahrer:?|driver:?)\s+{re.escape(name)})\b"
        m = re.search(muster, low)
        if m:
            fahrer = slug
            low = low[: m.start()] + " " + low[m.end():]
            break

    # Person
    person = "familie"
    woerter = re.findall(r"[\wäöüß]+", low)
    for w in woerter:
        if w in namen:
            person = namen[w]
            low = re.sub(rf"\b{re.escape(w)}\b", " ", low, count=1)
            break
        if w in _FAMILIE_WORTE:
            low = re.sub(rf"\b{re.escape(w)}\b", " ", low, count=1)
            break

    # Datum
    tag = jetzt.date()
    datum_gefunden = False
    m = re.search(r"\b(übermorgen|uebermorgen|morgen|heute|tomorrow|today)\b", low)
    if m:
        wort = m.group(1)
        tag = tag + timedelta(days=2 if wort.startswith(("über", "ueber")) else (1 if wort in ("morgen", "tomorrow") else 0))
        low = low[: m.start()] + " " + low[m.end():]
        datum_gefunden = True
    if not datum_gefunden:
        m = re.search(r"\b(\d{1,2})\.\s?(\d{1,2})\.(\d{2,4})?", low)
        m2 = re.search(r"\b(\d{1,2})\.?\s+(" + "|".join(sorted(_MONATE, key=len, reverse=True)) + r")\b", low)
        if m:
            tg, mo, jahr = int(m.group(1)), int(m.group(2)), m.group(3)
        elif m2:
            tg, mo, jahr = int(m2.group(1)), _MONATE[m2.group(2)], None
            m = m2
        if m:
            j = int(jahr) + (2000 if jahr and len(jahr) == 2 else 0) if jahr else jetzt.year
            try:
                tag = date(j, mo, tg)
                if not jahr and tag < jetzt.date():
                    tag = date(j + 1, mo, tg)
                low = low[: m.start()] + " " + low[m.end():]
                datum_gefunden = True
            except ValueError:
                pass
    if not datum_gefunden:
        for wort, wt in _TAGE.items():
            m = re.search(rf"\b{wort}s?\b", low)
            if m:
                diff = (wt - jetzt.weekday()) % 7
                if re.search(r"\b(nächste[nm]?|naechste[nm]?|next)\s*$", low[: m.start()].rstrip()):
                    diff = diff or 7
                tag = jetzt.date() + timedelta(days=diff)
                low = low[: m.start()] + " " + low[m.end():]
                datum_gefunden = True
                break

    # Uhrzeit
    zeit: tuple[int, int] | None = None
    m = re.search(r"\bhalb\s+(\d{1,2})\b", low)
    if m:
        stunde = (int(m.group(1)) - 1) % 24
        if 1 <= stunde <= 7 and not re.search(r"\b(früh|frueh|morgens|morning)\b", low):
            stunde += 12
        zeit = (stunde, 30)
    else:
        m = re.search(r"\b(?:um|at|ab)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(uhr|am|pm)?\b|\b(\d{1,2})(?:[:.](\d{2}))?\s*(uhr|am|pm)\b|\b(\d{1,2})[:](\d{2})\b", low)
        if m:
            g = m.groups()
            h, mi, zusatz = (g[0], g[1], g[2]) if g[0] else ((g[3], g[4], g[5]) if g[3] else (g[6], g[7], None))
            stunde, minute = int(h), int(mi or 0)
            if zusatz == "pm" and stunde < 12:
                stunde += 12
            elif zusatz != "am" and 1 <= stunde <= 7 and not re.search(r"\b(früh|frueh|morgens|morning)\b", low):
                stunde += 12  # "um 4" am Nachmittag
            if 0 <= stunde < 24 and 0 <= minute < 60:
                zeit = (stunde, minute)
    if m:
        low = low[: m.start()] + " " + low[m.end():]
    low = re.sub(r"\b(früh|frueh|morgens|nachmittags|abends|morning|afternoon|evening)\b", " ", low)

    # Rest = Titel (Originalschreibweise übernehmen)
    rest = [w for w in re.findall(r"[\wäöüßÄÖÜ'\-]+", low) if w not in _FUELL]
    if not rest:
        return None
    original = {w.lower(): w for w in re.findall(r"[\wäöüßÄÖÜ'\-]+", text)}
    titel = " ".join(original.get(w, w) for w in rest)
    titel = titel[0].upper() + titel[1:]

    tz = jetzt.tzinfo
    if zeit:
        start: datetime | date = datetime(tag.year, tag.month, tag.day, zeit[0], zeit[1], tzinfo=tz)
    else:
        start = tag
    return {"person": person, "titel": titel, "start": start, "ganztag": zeit is None, "fahrer": fahrer}


# ------------------------------------------------------------ Wochenrückblick
def wochen_vorschau(termine: list[Termin], montag: date, tz, namen: dict[str, str], mit_person: bool) -> list[str]:
    """Zeilen je Tag für die kommende Woche."""
    zeilen = []
    for i in range(7):
        tag = montag + timedelta(days=i)
        am_tag = []
        for t in sortiert(termine):
            s = t.start.astimezone(tz).date() if isinstance(t.start, datetime) else t.start
            e = t.end.astimezone(tz).date() if isinstance(t.end, datetime) else t.end - timedelta(days=1)
            if s <= tag <= e:
                z = f"{zeit_text(t, tz)} {t.summary}"
                if mit_person and t.person not in ("", "familie"):
                    z += f" ({namen.get(t.person, t.person)})"
                if t.fahrer:
                    z += f" 🚗 {t.fahrer}"
                am_tag.append(z)
        if am_tag:
            zeilen.append(f"{WOCHENTAGE_KURZ[tag.weekday()]} {tag.day}.{tag.month}.: " + ", ".join(am_tag))
    return zeilen
