#!/usr/bin/env python3
"""Local FlightSim bridge.

This is the runnable host for development and for machines without the
MSFS SimConnect SDK. The Windows product host is in ../windows and uses
the same protocol. External APIs are called here, not by the iPad.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import sqlite3
import struct
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT.parent / "dist"
DB = ROOT / "efb.sqlite"
PORT = 8080
PROTOCOL = 1
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TOKEN = base64.urlsafe_b64encode(hashlib.sha256(str(time.time()).encode()).digest())[:10].decode()
ESSA = (59.6519, 17.9186)
VTBS = (13.6811, 100.7473)


def db():
    conn = sqlite3.connect(DB)
    conn.execute("create table if not exists settings (key text primary key, value text)")
    conn.execute("create table if not exists flight_plans (id integer primary key, json text, saved_at integer)")
    conn.execute("create table if not exists cached_weather (icao text primary key, json text, saved_at integer)")
    conn.execute("create table if not exists paired_devices (token text primary key, seen_at integer)")
    return conn


def envelope(kind: str, data: dict) -> str:
    return json.dumps({"protocolVersion": PROTOCOL, "type": kind, "timestamp": int(time.time()), "data": data})


def fetch(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": "FlightSimEFB/0.1", "Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode())


def bearing(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dl = lon2 - lon1
    y = math.sin(dl) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def move(lat, lon, bearing_deg, distance_nm):
    radius = 3440.065
    br = math.radians(bearing_deg)
    lat1, lon1 = math.radians(lat), math.radians(lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(distance_nm / radius) + math.cos(lat1) * math.sin(distance_nm / radius) * math.cos(br))
    lon2 = lon1 + math.atan2(math.sin(br) * math.sin(distance_nm / radius) * math.cos(lat1), math.cos(distance_nm / radius) - math.sin(lat1) * math.sin(lat2))
    return math.degrees(lat2), math.degrees(lon2)


class Sim:
    """Normalized stand-in for SimConnect. Raw SimVar names never leave this class."""

    def __init__(self):
        self.remaining = 160.0
        self.alt = 35000.0
        self.fuel = 4800.0
        self.seconds = 6.4 * 3600
        self.forced = ""

    def step(self, dt: float):
        phase = self.phase()
        gs = self.speeds(phase)[2]
        self.remaining = max(0.0, self.remaining - gs * dt * 6 / 3600)
        self.seconds += dt * 6
        self.fuel = max(2200, self.fuel - 2400 * dt * 6 / 3600)
        target = {"CRUISE": 35000, "DESCENT": 8000, "APPROACH": 1800, "LANDING": 40, "TAXI_IN": 20, "PARKED": 20}.get(phase, 35000)
        self.alt += (target - self.alt) * min(1, dt * 0.3)

    def phase(self) -> str:
        if self.forced:
            return self.forced
        if self.remaining < 1 and self.alt < 200:
            return "PARKED"
        if self.remaining < 2:
            return "LANDING"
        if self.remaining < 15:
            return "APPROACH"
        if self.remaining < 80:
            return "DESCENT"
        return "CRUISE"

    def speeds(self, phase: str):
        return {
            "CRUISE": (274, 452, 472, 0.78, 0),
            "DESCENT": (280, 410, 430, 0.74, -1600),
            "APPROACH": (150, 160, 165, 0.28, -700),
            "LANDING": (132, 135, 135, 0.20, -180),
            "PARKED": (0, 0, 0, 0, 0),
        }.get(phase, (250, 300, 290, 0.62, 1200))

    def state(self) -> dict:
        lat, lon = move(VTBS[0], VTBS[1], (bearing(ESSA, VTBS) + 180) % 360, self.remaining)
        track = bearing((lat, lon), VTBS)
        phase = self.phase()
        ias, tas, gs, mach, vs = self.speeds(phase)
        eta = time.strftime("%H:%M", time.gmtime(time.time() + self.remaining / max(gs, 1) * 3600))
        return {
            "phase": phase,
            "aircraft": {"title": "Fenix A320", "registration": "SE-ROA", "airline": "Scandinavian"},
            "flight": {"callsign": "SAS123", "flightNumber": "SK123", "departure": "ESSA", "arrival": "VTBS", "alternate": "VTBD"},
            "position": {"latitude": round(lat, 4), "longitude": round(lon, 4), "altitude": round(self.alt), "heading": round(track), "onGround": phase in {"PARKED", "TAXI_OUT", "TAXI_IN"}, "radioHeight": round(max(0, self.alt - 5))},
            "speed": {"ias": ias, "tas": tas, "groundSpeed": gs, "mach": mach, "verticalSpeed": vs},
            "fuel": {"total": round(self.fuel)},
            "nav": {"active": "ENR", "next": "LAMPU" if self.remaining > 40 else "FAF", "distanceNm": round(min(42, self.remaining), 1)},
            "wind": {"direction": 180, "speed": 8 if self.remaining < 80 else 18},
            "progress": round(1 - self.remaining / 220, 3),
            "distanceRemainingNm": round(self.remaining, 1),
            "eta": eta,
            "flightTime": "%02d:%02d" % divmod(int(self.seconds) // 60, 60),
            "track": round(track),
        }


class Bridge:
    def __init__(self):
        self.sim = Sim()
        self.clients = set()
        self.plan = None
        self.weather = {}
        self.vatsim = {}
        self.last_weather = 0
        self.last_vatsim = 0
        db()

    def broadcast(self, kind: str, data: dict):
        payload = envelope(kind, data)
        dead = []
        for client in list(self.clients):
            try:
                send_frame(client.wfile, payload)
            except Exception:
                dead.append(client)
        for client in dead:
            self.clients.discard(client)

    def refresh_weather(self):
        if time.time() - self.last_weather < 600 and self.weather:
            return
        self.last_weather = time.time()
        for icao in ("ESSA", "VTBS", "VTBD"):
            try:
                metar = fetch(f"https://aviationweather.gov/api/data/metar?ids={icao}&format=json")
                taf = fetch(f"https://aviationweather.gov/api/data/taf?ids={icao}&format=json")
                obs = metar[0] if isinstance(metar, list) and metar else {}
                forecast = taf[0] if isinstance(taf, list) and taf else {}
                report = {
                    "icao": icao,
                    "observed": obs.get("reportTime", "")[:16],
                    "raw": obs.get("rawOb", "No METAR"),
                    "taf": forecast.get("rawTAF", "No TAF"),
                    "wind": f"{obs.get('wdir', 'VRB')}/{obs.get('wspd', '—')} kt",
                    "visibility": str(obs.get("visib", "—")),
                    "temperature": str(obs.get("temp", "—")) + " °C",
                    "dewpoint": str(obs.get("dewp", "—")) + " °C",
                    "qnh": str(obs.get("altim", "—")),
                    "clouds": " ".join(f"{c.get('cover', '')}{c.get('base', '')}" for c in obs.get("clouds") or []) or "—",
                    "updatedAt": int(time.time()),
                }
            except Exception as exc:
                report = {"icao": icao, "observed": "", "raw": f"Weather unavailable: {exc}", "taf": "", "wind": "—", "visibility": "—", "temperature": "—", "dewpoint": "—", "qnh": "—", "clouds": "—", "updatedAt": int(time.time())}
            self.weather[icao] = report
            with db() as conn:
                conn.execute("insert or replace into cached_weather values (?, ?, ?)", (icao, json.dumps(report), int(time.time())))
            self.broadcast("weather.updated", report)

    def refresh_vatsim(self):
        if time.time() - self.last_vatsim < 30 and self.vatsim:
            return
        self.last_vatsim = time.time()
        try:
            feed = fetch("https://data.vatsim.net/v3/vatsim-data.json")
        except Exception:
            feed = {"controllers": [], "atis": []}
        for icao in ("ESSA", "VTBS", "VTBD"):
            stations = []
            for row in feed.get("controllers") or []:
                if str(row.get("callsign", "")).startswith(icao):
                    stations.append({"role": row.get("callsign", "").split("_")[-1], "callsign": row.get("callsign"), "frequency": row.get("frequency"), "online": True})
            for row in feed.get("atis") or []:
                if str(row.get("callsign", "")).startswith(icao):
                    stations.append({"role": "ATIS", "callsign": row.get("callsign"), "frequency": row.get("frequency"), "online": True})
            self.vatsim[icao] = stations[:8]
            self.broadcast("vatsim.updated", {"icao": icao, "stations": stations[:8]})

    def import_simbrief(self, pilot: str):
        key = "userid" if pilot.isdigit() else "username"
        payload = fetch(f"https://www.simbrief.com/api/xml.fetcher.php?{key}={urllib.parse.quote(pilot)}&json=1")
        general = payload.get("general") or {}
        origin = payload.get("origin") or {}
        destination = payload.get("destination") or {}
        alternate = (payload.get("alternate") or {})
        weights = payload.get("weights") or {}
        fuel = payload.get("fuel") or {}
        plan = {
            "flightNumber": general.get("flight_number", ""),
            "callsign": general.get("icao_airline", "") + general.get("flight_number", ""),
            "departure": origin.get("icao_code", ""),
            "arrival": destination.get("icao_code", ""),
            "alternate": alternate.get("icao_code", ""),
            "route": (payload.get("general") or {}).get("route", ""),
            "sid": origin.get("plan_sid", ""),
            "star": destination.get("plan_star", ""),
            "cruiseAltitude": int(general.get("initial_altitude") or 0),
            "costIndex": str(general.get("costindex", "")),
            "weights": {"zfw": int(weights.get("est_zfw") or 0), "tow": int(weights.get("est_tow") or 0), "lw": int(weights.get("est_ldw") or 0)},
            "fuel": {"block": int(fuel.get("plan_ramp") or 0), "trip": int(fuel.get("enroute_burn") or 0), "taxi": int(fuel.get("taxi") or 0), "reserve": int(fuel.get("reserve") or 0), "alternate": int(fuel.get("alternate_burn") or 0)},
            "passengers": int((payload.get("general") or {}).get("passengers") or 0),
            "cargo": int(weights.get("cargo") or 0),
            "source": "simbrief",
        }
        self.plan = plan
        with db() as conn:
            conn.execute("insert into flight_plans (json, saved_at) values (?, ?)", (json.dumps(plan), int(time.time())))
        self.broadcast("flight.plan.updated", plan)
        return plan


BRIDGE = Bridge()


def send_frame(wfile, text: str):
    data = text.encode()
    header = bytearray([0x81, len(data) if len(data) < 126 else 126])
    if len(data) >= 126:
        header.extend(struct.pack("!H", len(data)))
    wfile.write(bytes(header) + data)
    wfile.flush()


def read_frame(rfile):
    head = rfile.read(2)
    if len(head) < 2:
        return None
    length = head[1] & 127
    if length == 126:
        length = struct.unpack("!H", rfile.read(2))[0]
    mask = rfile.read(4)
    payload = bytearray(rfile.read(length))
    for i in range(length):
        payload[i] ^= mask[i % 4]
    return head[0] & 15


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/ws":
            return self.upgrade(parsed)
        if parsed.path == "/api/status":
            return self.send_json({"msfs": False, "server": True, "token": TOKEN, "url": f"http://lan:{PORT}"})
        self.static(parsed.path)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/simbrief":
            self.send_error(404)
            return
        size = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(size) or b"{}")
        try:
            self.send_json(BRIDGE.import_simbrief(body.get("pilot", "")))
        except Exception as exc:
            self.send_json({"error": str(exc)})

    def send_json(self, payload):
        raw = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def static(self, path: str):
        if path in ("/", ""):
            path = "/index.html"
        target = (DIST / path.lstrip("/")).resolve()
        if not str(target).startswith(str(DIST.resolve())) or not target.is_file():
            message = b"Build the iPad app first: npm run build"
            self.send_response(404)
            self.send_header("Content-Length", str(len(message)))
            self.end_headers()
            self.wfile.write(message)
            return
        kind = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json"}.get(target.suffix, "application/octet-stream")
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def upgrade(self, parsed):
        if urllib.parse.parse_qs(parsed.query).get("token", [""])[0] != TOKEN:
            self.send_error(401)
            return
        key = self.headers.get("Sec-WebSocket-Key", "")
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        self.send_response(101)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        BRIDGE.clients.add(self)
        with db() as conn:
            conn.execute("insert or replace into paired_devices values (?, ?)", (TOKEN, int(time.time())))
        send_frame(self.wfile, envelope("connection.status", {"bridge": "CONNECTED", "msfs": "MSFS NOT DETECTED"}))
        send_frame(self.wfile, envelope("flight.state", BRIDGE.sim.state()))
        if BRIDGE.plan:
            send_frame(self.wfile, envelope("flight.plan.updated", BRIDGE.plan))
        for report in BRIDGE.weather.values():
            send_frame(self.wfile, envelope("weather.updated", report))
        try:
            while read_frame(self.rfile) != 8:
                pass
        except Exception:
            pass
        finally:
            BRIDGE.clients.discard(self)


def loop():
    last = time.time()
    while True:
        now = time.time()
        BRIDGE.sim.step(now - last)
        last = now
        BRIDGE.broadcast("flight.state", BRIDGE.sim.state())
        BRIDGE.refresh_weather()
        BRIDGE.refresh_vatsim()
        time.sleep(0.5)


def main():
    threading.Thread(target=loop, daemon=True).start()
    print(f"FlightSim bridge  http://127.0.0.1:{PORT}/?pair={TOKEN}")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
