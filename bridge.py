#!/usr/bin/env python3
"""Rotaidem FlightSim Bridge.

Local web server and WebSocket for the iPad EFB. The flight provider is
swappable: SimulatedProvider is the default. SimConnectProvider is the
Windows/MSFS adapter and stays inactive until that SDK is present.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
import socket
import struct
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import qrcode
import vatsim

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"
PORT = 8080
PROTOCOL = 1
GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
TOKEN = base64.urlsafe_b64encode(hashlib.sha256(str(time.time()).encode()).digest())[:10].decode()

ESSA = (59.6519, 17.9186)
VTBS = (13.6811, 100.7473)


def lan_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def move(lat, lon, bearing_deg, distance_nm):
    radius = 3440.065
    br = math.radians(bearing_deg)
    lat1 = math.radians(lat)
    lon1 = math.radians(lon)
    lat2 = math.asin(math.sin(lat1) * math.cos(distance_nm / radius) + math.cos(lat1) * math.sin(distance_nm / radius) * math.cos(br))
    lon2 = lon1 + math.atan2(math.sin(br) * math.sin(distance_nm / radius) * math.cos(lat1), math.cos(distance_nm / radius) - math.sin(lat1) * math.sin(lat2))
    return math.degrees(lat2), math.degrees(lon2)


def bearing(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dl = lon2 - lon1
    y = math.sin(dl) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def haversine(a, b):
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * 3440.065 * math.asin(math.sqrt(h))


class SimulatedProvider:
    """Stand-in for SimConnect. A short ESSA-VTBS segment, time-compressed."""

    name = "Simulated provider"

    def __init__(self):
        self.total_nm = 220.0
        self.remaining = 160.0
        self.alt = 35000.0
        self.fuel = 4800.0
        self.flight_s = 6.4 * 3600
        self.forced = ""
        self.logged = False
        self.touchdown = None

    def set_phase(self, phase: str):
        self.forced = phase
        table = {
            "PARKED": 0.2, "TAXI": 0.4, "TAKEOFF": 1.2, "CLIMB": 40,
            "CRUISE": 180, "DESCENT": 70, "APPROACH": 12, "LANDING": 1.5, "TAXI IN": 0.3,
        }
        if phase in table:
            self.remaining = table[phase]

    def snapshot(self):
        lat, lon = self._pos()
        track = bearing((lat, lon), VTBS)
        phase = self.forced or self._phase()
        gs, ias, tas, mach, vs = self._speeds(phase)
        wind = (140, 18) if self.remaining > 40 else (140, 8)
        fixes = [("TOD", 80), ("BANKO", 35), ("SU10", 12), ("FAF", 5), ("RW19R", 0)]
        active, nxt, dist = "ENR", "TOD", self.remaining
        for name, gate in fixes:
            if self.remaining > gate:
                nxt = name
                dist = self.remaining - gate
                break
            active = name
        eta_min = self.remaining / max(gs, 1) * 60
        eta = time.strftime("%H:%M", time.gmtime(time.time() + eta_min * 60))
        return {
            "protocolVersion": PROTOCOL,
            "connection": {"msfs": True, "simconnect": False, "provider": self.name, "simulated": True},
            "aircraft": {"title": "Fenix A320", "registration": "SE-ROA", "airline": "Scandinavian"},
            "flight": {"callsign": "SAS123", "flightNumber": "SK123", "departure": "ESSA", "arrival": "VTBS", "alternate": "ENGM"},
            "position": {"latitude": round(lat, 4), "longitude": round(lon, 4), "altitude": round(self.alt), "heading": round(track)},
            "speed": {"ias": round(ias), "tas": round(tas), "groundSpeed": round(gs), "mach": round(mach, 2), "verticalSpeed": round(vs)},
            "fuel": {"total": round(self.fuel)},
            "nav": {"active": active, "next": nxt, "distanceNm": round(dist, 1)},
            "phase": phase,
            "wind": {"direction": wind[0], "speed": wind[1]},
            "progress": round(1 - self.remaining / self.total_nm, 3),
            "distanceRemainingNm": round(self.remaining, 1),
            "eta": eta,
            "flightTime": "%02d:%02d" % divmod(int(self.flight_s) // 60, 60),
            "track": round(track),
            "landingRate": self.touchdown,
        }

    def _pos(self):
        track = bearing(ESSA, VTBS)
        return move(VTBS[0], VTBS[1], (track + 180) % 360, self.remaining)

    def _phase(self):
        if self.remaining > 190 and self.alt < 200:
            return "TAXI" if self.remaining < 208 else "PARKED"
        if self.alt < 150 and self.remaining < 1:
            return "PARKED" if self.remaining < 0.15 else "TAXI IN"
        if self.remaining < 2 and self.alt < 400:
            return "LANDING"
        if self.remaining < 15:
            return "APPROACH"
        if self.remaining < 80 and self.alt > 8000:
            return "DESCENT"
        if self.alt < 34000 and self.remaining > 180:
            return "CLIMB"
        if self.alt >= 34000:
            return "CRUISE"
        return "CLIMB"

    def _speeds(self, phase):
        table = {
            "PARKED": (0, 0, 0, 0, 0),
            "TAXI": (12, 0, 12, 0, 0),
            "TAXI IN": (15, 0, 15, 0, 0),
            "TAKEOFF": (145, 140, 145, 0.22, 1800),
            "CLIMB": (290, 250, 300, 0.72, 1800),
            "CRUISE": (472, 274, 452, 0.78, 0),
            "DESCENT": (430, 280, 410, 0.74, -1600),
            "APPROACH": (165, 150, 160, 0.28, -700),
            "LANDING": (135, 132, 135, 0.2, -180),
        }
        return table.get(phase, table["CRUISE"])

    def step(self, dt):
        rate = 6.0
        phase = self.forced or self._phase()
        gs = self._speeds(phase)[0]
        self.remaining = max(0.0, self.remaining - gs * dt * rate / 3600)
        self.flight_s += dt * rate
        self.fuel = max(2400, self.fuel - 2400 * dt * rate / 3600)
        targets = {"PARKED": 80, "TAXI": 80, "TAXI IN": 20, "TAKEOFF": 400, "CLIMB": 35000, "CRUISE": 35000, "DESCENT": 8000, "APPROACH": 1800, "LANDING": 40}
        target = targets.get(phase, 35000)
        self.alt += (target - self.alt) * min(1, dt * 0.35)
        if phase == "LANDING" and self.touchdown is None and self.alt < 80:
            self.touchdown = -160
        if phase == "PARKED" and self.remaining < 0.2 and not self.logged:
            self.logged = True
            BRIDGE.log("Flight parked. Log available to the EFB.")


class Bridge:
    def __init__(self):
        self.provider = SimulatedProvider()
        self.clients = set()
        self.logs = []
        self.lock = threading.Lock()
        self.ip = lan_ip()
        self.log("Bridge started")
        self.log("SimConnect SDK not present. Using simulated flight ESSA-VTBS.")

    def log(self, line: str):
        stamp = time.strftime("%H:%M:%S")
        with self.lock:
            self.logs.append(f"{stamp}  {line}")
            del self.logs[:-40]

    def state(self):
        data = self.provider.snapshot()
        data["connection"]["server"] = True
        return data

    def status(self):
        snap = self.provider.snapshot()
        return {
            "msfs": False,
            "simconnect": False,
            "provider": self.provider.name,
            "server": True,
            "ip": self.ip,
            "port": PORT,
            "url": f"http://{self.ip}:{PORT}",
            "token": TOKEN,
            "ipadClients": len(self.clients),
            "aircraft": snap["aircraft"]["title"],
            "logs": list(self.logs),
        }


BRIDGE = Bridge()


def png(path: Path, size: int):
    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            cx, cy = x - size / 2, y - size / 2
            d = math.hypot(cx, cy)
            if d < size * 0.46:
                row.extend((28, 28, 30))
            else:
                row.extend((242, 242, 247))
            if abs(cx) < size * 0.035 and abs(cy) < size * 0.28:
                row[-3:] = bytes((196, 164, 106))
            if abs(cy) < size * 0.035 and abs(cx) < size * 0.18:
                row[-3:] = bytes((196, 164, 106))
        rows.append(bytes(row))
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib_crc(tag + data))
    raw = b"".join(b"\x00" + r for r in rows)
    blob = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", compress(raw)) + chunk(b"IEND", b"")
    path.write_bytes(blob)


def zlib_crc(data: bytes) -> int:
    return zlib.crc32(data) & 0xFFFFFFFF


import zlib


def compress(raw: bytes) -> bytes:
    return zlib.compress(raw, 9)


def send_frame(wfile, text: str):
    data = text.encode()
    header = bytearray([0x81])
    n = len(data)
    if n < 126:
        header.append(n)
    elif n < 65536:
        header.append(126)
        header.extend(struct.pack("!H", n))
    else:
        header.append(127)
        header.extend(struct.pack("!Q", n))
    wfile.write(header + data)
    wfile.flush()


def read_frame(rfile):
    head = rfile.read(2)
    if len(head) < 2:
        return None
    length = head[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", rfile.read(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", rfile.read(8))[0]
    mask = rfile.read(4)
    payload = bytearray(rfile.read(length))
    for i in range(length):
        payload[i] ^= mask[i % 4]
    return head[0] & 0x0F, bytes(payload)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/ws":
            self.upgrade(parsed)
            return
        if parsed.path == "/api/status":
            return self.json_out(BRIDGE.status())
        if parsed.path == "/api/state":
            return self.json_out(BRIDGE.state())
        if parsed.path == "/api/vatsim":
            query = urllib.parse.parse_qs(parsed.query)
            departure = query.get("departure", ["ESSA"])[0]
            arrival = query.get("arrival", ["VTBS"])[0]
            callsign = query.get("callsign", [""])[0]
            try:
                return self.json_out(vatsim.summary(departure, arrival, callsign))
            except Exception as exc:
                return self.json_out({"error": str(exc), "atc": [], "atis": [], "events": []})
        if parsed.path == "/qr.svg":
            url = f"http://{BRIDGE.ip}:{PORT}/?pair={TOKEN}"
            img = qrcode.make(url, image_factory=qrcode.image.svg.SvgImage)
            body = img.to_string()
            if isinstance(body, str):
                body = body.encode()
            return self.bytes_out(body, "image/svg+xml")
        if parsed.path in ("/icon-180.png", "/icon-512.png"):
            size = 180 if "180" in parsed.path else 512
            target = STATIC / parsed.path.lstrip("/")
            if not target.exists():
                png(target, size)
            return self.bytes_out(target.read_bytes(), "image/png")
        path = parsed.path
        if path in ("/", "/bridge"):
            path = "/index.html" if path == "/" else "/bridge.html"
        target = (STATIC / path.lstrip("/")).resolve()
        if not str(target).startswith(str(STATIC)) or not target.is_file():
            self.send_error(404)
            return
        kind = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".webmanifest": "application/manifest+json",
            ".png": "image/png",
            ".svg": "image/svg+xml",
        }.get(target.suffix, "application/octet-stream")
        self.bytes_out(target.read_bytes(), kind, cache=target.suffix != ".html")

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/api/phase":
            self.send_error(404)
            return
        n = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(n) or b"{}")
        BRIDGE.provider.set_phase(body.get("phase") or "")
        BRIDGE.log("Phase override: " + (body.get("phase") or "simulation"))
        self.json_out({"ok": True})

    def json_out(self, payload):
        self.bytes_out(json.dumps(payload).encode(), "application/json")

    def bytes_out(self, body: bytes, kind: str, cache: bool = False):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=3600" if cache else "no-store")
        self.end_headers()
        self.wfile.write(body)

    def upgrade(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        if query.get("token", [""])[0] != TOKEN:
            self.send_error(401)
            return
        key = self.headers.get("Sec-WebSocket-Key")
        if not key:
            self.send_error(400)
            return
        accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
        self.send_response(101)
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", accept)
        self.end_headers()
        BRIDGE.clients.add(self)
        BRIDGE.log("iPad connected")
        try:
            send_frame(self.wfile, json.dumps(BRIDGE.state()))
            while True:
                frame = read_frame(self.rfile)
                if frame is None or frame[0] == 8:
                    break
        except Exception:
            pass
        finally:
            BRIDGE.clients.discard(self)
            BRIDGE.log("iPad disconnected")


def broadcast():
    payload = json.dumps(BRIDGE.state())
    dead = []
    for client in list(BRIDGE.clients):
        try:
            send_frame(client.wfile, payload)
        except Exception:
            dead.append(client)
    for client in dead:
        BRIDGE.clients.discard(client)


def sim_loop():
    last = time.time()
    tick = 0
    while True:
        now = time.time()
        BRIDGE.provider.step(now - last)
        last = now
        tick += 1
        if tick % 2 == 0:
            broadcast()
        time.sleep(0.25)


def main():
    STATIC.mkdir(exist_ok=True)
    png(STATIC / "icon-180.png", 180)
    png(STATIC / "icon-512.png", 512)
    threading.Thread(target=sim_loop, daemon=True).start()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Rotaidem FlightSim Bridge  http://{BRIDGE.ip}:{PORT}/bridge")
    print(f"iPad EFB                    http://{BRIDGE.ip}:{PORT}/?pair={TOKEN}")
    server.serve_forever()


if __name__ == "__main__":
    main()
