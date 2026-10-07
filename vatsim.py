"""Public VATSIM feeds used by the EFB.

No API key. Core API and Connect are documented in VATSIM.md and are not called.
Feeds refresh about every 15 seconds. This client caches for 20 seconds.
"""

from __future__ import annotations

import json
import time
import urllib.request

DATA_URL = "https://data.vatsim.net/v3/vatsim-data.json"
TRANSCEIVERS_URL = "https://data.vatsim.net/v3/transceivers-data.json"
ATIS_URL = "https://data.vatsim.net/v3/afv-atis-data.json"
METAR_URL = "https://metar.vatsim.net/{icao}?format=json"
EVENTS_URL = "https://my.vatsim.net/api/v2/events/latest"
AIP_URL = "https://my.vatsim.net/api/v2/aip/airports/{icao}"
STATIONS_URL = "https://my.vatsim.net/api/v2/aip/airports/{icao}/stations"

CACHE_S = 20
_cache = {}


def _get(url: str):
    now = time.time()
    hit = _cache.get(url)
    if hit and now - hit[0] < CACHE_S:
        return hit[1]
    request = urllib.request.Request(url, headers={"User-Agent": "RotaidemEFB/0.1", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode())
    _cache[url] = (now, payload)
    return payload


def network():
    return _get(DATA_URL)


def transceivers():
    return _get(TRANSCEIVERS_URL)


def voice_atis():
    return _get(ATIS_URL)


def metar(icao: str):
    try:
        return _get(METAR_URL.format(icao=icao.upper()))
    except Exception as exc:
        return {"error": str(exc), "icao": icao}


def events():
    try:
        return _get(EVENTS_URL)
    except Exception as exc:
        return {"error": str(exc), "data": []}


def airport(icao: str):
    try:
        return _get(AIP_URL.format(icao=icao.upper()))
    except Exception as exc:
        return {"error": str(exc), "icao": icao}


def stations(icao: str):
    try:
        return _get(STATIONS_URL.format(icao=icao.upper()))
    except Exception as exc:
        return {"error": str(exc), "data": []}


def _matches(callsign: str, icao: str) -> bool:
    return callsign.startswith(icao) or icao in callsign


def summary(departure: str, arrival: str, callsign: str = "") -> dict:
    feed = network()
    airports = {departure.upper(), arrival.upper()}
    pilots = feed.get("pilots") or []
    controllers = feed.get("controllers") or []
    atis = feed.get("atis") or []
    own = next((p for p in pilots if callsign and p.get("callsign", "").upper() == callsign.upper()), None)
    online_atc = [c for c in controllers if any(_matches(c.get("callsign", ""), icao) for icao in airports)]
    online_atis = [a for a in atis if any(_matches(a.get("callsign", ""), icao) for icao in airports)]
    event_rows = []
    raw_events = events()
    for event in raw_events.get("data") or []:
        icaos = {a.get("icao") for a in event.get("airports") or []}
        if icaos & airports:
            event_rows.append({
                "id": event.get("id"),
                "name": event.get("name"),
                "start": event.get("start_time"),
                "end": event.get("end_time"),
                "airports": sorted(icaos),
                "link": event.get("link"),
            })
    return {
        "source": "VATSIM public feeds",
        "updated": (feed.get("general") or {}).get("update_timestamp"),
        "connectedClients": (feed.get("general") or {}).get("connected_clients"),
        "own": _pilot(own) if own else None,
        "atc": [_controller(c) for c in online_atc[:12]],
        "atis": [_atis(a) for a in online_atis[:8]],
        "metar": {icao: metar(icao) for icao in sorted(airports)},
        "events": event_rows[:6],
    }


def _pilot(pilot: dict) -> dict:
    plan = pilot.get("flight_plan") or {}
    return {
        "callsign": pilot.get("callsign"),
        "cid": pilot.get("cid"),
        "latitude": pilot.get("latitude"),
        "longitude": pilot.get("longitude"),
        "altitude": pilot.get("altitude"),
        "groundspeed": pilot.get("groundspeed"),
        "heading": pilot.get("heading"),
        "transponder": pilot.get("transponder"),
        "departure": plan.get("departure"),
        "arrival": plan.get("arrival"),
        "alternate": plan.get("alternate"),
        "route": plan.get("route"),
        "remarks": plan.get("remarks"),
        "aircraft": plan.get("aircraft_short") or plan.get("aircraft"),
    }


def _controller(row: dict) -> dict:
    return {
        "callsign": row.get("callsign"),
        "frequency": row.get("frequency"),
        "facility": row.get("facility"),
        "rating": row.get("rating"),
        "text": row.get("text_atis"),
    }


def _atis(row: dict) -> dict:
    text = row.get("text_atis")
    if isinstance(text, list):
        text = " ".join(text)
    return {"callsign": row.get("callsign"), "frequency": row.get("frequency"), "code": row.get("atis_code"), "text": text}
