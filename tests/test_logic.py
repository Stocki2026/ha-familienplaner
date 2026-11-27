"""Tests der reinen Logik."""

from datetime import date, datetime, timedelta, timezone

from custom_components.familienplaner import logic
from custom_components.familienplaner.models import Termin, slugify_name

TZ = timezone(timedelta(hours=1))
JETZT = datetime(2026, 11, 27, 14, 0, tzinfo=TZ)


def t(summary, start, end, **kw):
    return Termin(summary=summary, start=start, end=end, **kw)


def test_slug():
    assert slugify_name("Anna") == "anna"
    assert slugify_name("Jörg-Peter") == "joerg_peter"


def test_naechster_termin_und_countdown():
    alt = t("Alt", JETZT - timedelta(hours=2), JETZT - timedelta(hours=1))
    ganz = t("Ganztag", date(2026, 11, 27), date(2026, 11, 28))
    fb = t("Fußball", JETZT + timedelta(minutes=45), JETZT + timedelta(minutes=90))
    morgen = t("Frühstück", JETZT + timedelta(hours=19), JETZT + timedelta(hours=20))
    n = logic.naechster_termin([morgen, alt, ganz, fb], JETZT)
    assert n.summary == "Fußball"
    assert logic.wann_text(n, JETZT) == "in 45 Min"
    assert logic.wann_text(morgen, JETZT) == "morgen 09:00"
    laeuft = t("Läuft", JETZT - timedelta(minutes=5), JETZT + timedelta(minutes=5))
    assert logic.wann_text(laeuft, JETZT) == "läuft gerade"
    assert logic.wann_text(None, JETZT) == "die nächsten Tage frei"


def test_fahrer():
    assert t("x", JETZT, JETZT, description="🚗 Fahrer: carla").fahrer == "Carla"
    assert t("x", JETZT, JETZT).fahrer == ""


def test_parse_events():
    antwort = {"calendar.a": {"events": [
        {"start": "2026-11-27T15:00:00+01:00", "end": "2026-11-27T16:00:00+01:00", "summary": "A"},
        {"start": "2026-11-28", "end": "2026-11-29", "summary": "B"},
        {"start": "kaputt", "end": "x", "summary": "C"},
    ]}}
    termine = logic.parse_events(antwort, "calendar.a", "anna", TZ)
    assert [x.summary for x in termine] == ["A", "B"]
    assert termine[1].ganztag


def test_countdowns_geburtstag():
    heute = date(2026, 11, 27)
    besondere = [t("🎂 Geburtstag Oma", date(2026, 11, 27), date(2026, 11, 28)),
                 t("Geburtstag von Lisa", date(2026, 12, 4), date(2026, 12, 5))]
    feiertage = [t("Neujahr", date(2027, 1, 1), date(2027, 1, 2)), t("1. Weihnachtstag", date(2026, 12, 25), date(2026, 12, 26)),
                 t("2. Weihnachtstag", date(2026, 12, 26), date(2026, 12, 27))]
    l = logic.countdowns(besondere, feiertage, heute)
    assert [x["titel"] for x in l] == ["🎂 Geburtstag Oma", "Geburtstag von Lisa", "1. Weihnachtstag", "2. Weihnachtstag"]
    assert logic.countdown_text(0).startswith("Heute")
    assert logic.geburtstag_name("Geburtstag von Lisa") == "Lisa"
    assert logic.geburtstag_name("🎂 Hatice hat Geburtstag") == "Hatice"


def test_muell_und_ferien():
    heute = date(2026, 11, 27)
    m = [t("Restmüll", date(2026, 11, 28), date(2026, 11, 29)), t("Biotonne", date(2026, 11, 28), date(2026, 11, 29)),
         t("Restmüll", date(2026, 12, 12), date(2026, 12, 13)), t("Papier", date(2026, 12, 3), date(2026, 12, 4))]
    l = logic.muell_liste(m, heute)
    assert [x["tonne"] for x in l] == ["Biotonne", "Restmüll", "Papier"]
    assert logic.muell_an_tag(m, date(2026, 11, 28)) == ["Restmüll", "Biotonne"]
    f = logic.ferien_info([t("Weihnachtsferien", date(2026, 12, 21), date(2027, 1, 7))], heute)
    assert f["text"] == "Weihnachtsferien in 24 Tagen" and not f["jetzt"]
    f = logic.ferien_info([t("Weihnachtsferien", date(2026, 12, 21), date(2027, 1, 7))], date(2027, 1, 2))
    assert f["jetzt"] and f["tage"] == 5


def test_wetter():
    fc = [{"datetime": "2026-11-27T14:00:00+01:00", "condition": "cloudy", "temperature": 6},
          {"datetime": "2026-11-27T15:00:00+01:00", "condition": "rainy", "temperature": 5},
          {"datetime": "2026-11-27T16:00:00+01:00", "condition": "sunny", "temperature": 5}]
    f = logic.wetter_zur_zeit(fc, JETZT + timedelta(hours=1))
    assert f["condition"] == "rainy"
    assert logic.wetter_bewertung(f) == (True, False)
    assert "Regenjacke" in logic.wetter_hinweis(f, JETZT + timedelta(hours=1))
    assert logic.wetter_bewertung({"condition": "sunny", "temperature": -3}) == (False, True)


def test_morgen_ansage():
    termine = [t("Fußball", JETZT + timedelta(hours=1), JETZT + timedelta(hours=2), description="Fahrer: Carla", person="ben"),
               t("Abendessen", JETZT + timedelta(hours=4), JETZT + timedelta(hours=5), person="familie")]
    text = logic.morgen_ansage(JETZT.replace(hour=7), {"condition": "rainy", "temperature": 6.4, "templow": 1.2}, termine,
                               {"ben": "Ben"}, [t("🎂 Geburtstag Oma", date(2026, 11, 27), date(2026, 11, 28))],
                               ["🍽️ Lasagne"], ["Restmüll"], {"jetzt": False})
    assert "Freitag, der 27. November" in text
    assert "15:00 Uhr Ben: Fußball, Carla fährt" in text
    assert "Geburtstag Oma" in text and "🎂" not in text
    assert "Restmüll" in text and "Lasagne" in text
