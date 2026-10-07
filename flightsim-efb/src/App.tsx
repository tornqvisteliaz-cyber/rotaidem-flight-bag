import { useEffect, useMemo, useState } from "react";
import { altitudeText, apply, fuelText, setLink, useStore } from "./store";
import { loadNotes, saveNotes } from "./notes";
import type { Envelope } from "./protocol";

const NAV = ["Home", "Flight", "Airport", "Weather", "Charts", "Notes", "Settings"] as const;
type Screen = (typeof NAV)[number];

const AIRPORTS: Record<string, { name: string; elevation: number; runways: { id: string; heading: number; length: number; surface: string }[]; freqs: [string, string][] }> = {
  ESSA: { name: "Stockholm Arlanda", elevation: 137, runways: [{ id: "01L", heading: 10, length: 3301, surface: "Asphalt" }, { id: "19R", heading: 190, length: 3301, surface: "Asphalt" }, { id: "08", heading: 76, length: 2500, surface: "Asphalt" }, { id: "26", heading: 256, length: 2500, surface: "Asphalt" }], freqs: [["ATIS", "119.000"], ["Tower", "118.500"], ["Ground", "121.700"]] },
  VTBS: { name: "Bangkok Suvarnabhumi", elevation: 5, runways: [{ id: "01L", heading: 14, length: 4000, surface: "Asphalt" }, { id: "19R", heading: 194, length: 4000, surface: "Asphalt" }, { id: "01R", heading: 14, length: 3700, surface: "Concrete" }, { id: "19L", heading: 194, length: 3700, surface: "Concrete" }], freqs: [["ATIS", "127.250"], ["Tower", "118.200"], ["Ground", "121.750"]] },
  VTBD: { name: "Bangkok Don Mueang", elevation: 9, runways: [{ id: "21L", heading: 214, length: 3700, surface: "Asphalt" }, { id: "03R", heading: 34, length: 3700, surface: "Asphalt" }], freqs: [["ATIS", "127.200"], ["Tower", "118.100"]] },
};

function windParts(heading: number, wind: string) {
  const match = wind.match(/(\d{3}).*?(\d{1,2})/);
  if (!match) return { head: "—", cross: "—" };
  const dir = Number(match[1]);
  const kt = Number(match[2]);
  const diff = ((dir - heading + 540) % 360) - 180;
  const head = Math.round(kt * Math.cos((diff * Math.PI) / 180));
  const cross = Math.round(Math.abs(kt * Math.sin((diff * Math.PI) / 180)));
  return { head: (head >= 0 ? head + " kt head" : Math.abs(head) + " kt tail"), cross: cross + " kt" };
}

export default function App() {
  const { flight, link, msfs, plan, weather, vatsim } = useStore();
  const [screen, setScreen] = useState<Screen>("Home");
  const [role, setRole] = useState<"departure" | "arrival" | "alternate">("arrival");
  const [token, setToken] = useState(localStorage.getItem("efb-token") || "");
  const [paired, setPaired] = useState(Boolean(localStorage.getItem("efb-token")));
  const [theme, setTheme] = useState(localStorage.getItem("efb-theme") || "system");
  const [pilot, setPilot] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQr = params.get("pair");
    if (fromQr) {
      localStorage.setItem("efb-token", fromQr);
      setToken(fromQr);
      setPaired(true);
      history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [theme]);

  useEffect(() => {
    if (!paired || !token) return;
    let socket: WebSocket | null = null;
    let closed = false;
    const connect = () => {
      setLink("CONNECTING");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
      socket.onopen = () => setLink("CONNECTED");
      socket.onmessage = (event) => apply(JSON.parse(event.data) as Envelope);
      socket.onclose = () => {
        setLink("BRIDGE OFFLINE");
        if (!closed) setTimeout(connect, 1500);
      };
    };
    connect();
    return () => {
      closed = true;
      socket?.close();
    };
  }, [paired, token]);

  const icao = role === "departure" ? flight.flight.departure : role === "alternate" ? flight.flight.alternate : flight.flight.arrival;
  const airport = AIRPORTS[icao] || { name: icao, elevation: 0, runways: [], freqs: [] };
  const report = weather[icao];
  const descent = flight.phase === "DESCENT" || flight.phase === "APPROACH" || flight.phase === "LANDING";
  const stale = link !== "CONNECTED";

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><strong>FlightSim</strong><span>EFB</span></div>
        <nav>
          {NAV.map((item) => (
            <button key={item} type="button" aria-current={screen === item ? "page" : undefined} onClick={() => setScreen(item)}>{item}</button>
          ))}
        </nav>
        <div className="grow" />
        <div className="status">
          <div><i className={"pip " + (msfs === "CONNECTED" ? "on" : "wait")} />{msfs === "CONNECTED" ? "MSFS connected" : "MSFS not detected"}</div>
          <div><i className={"pip " + (link === "CONNECTED" ? "on" : "bad")} />{link === "CONNECTED" ? "Bridge connected" : link}</div>
        </div>
      </aside>
      <div className="main">
        <div className={"banner" + (stale ? " show" : "")}><i className="pip bad" />{link === "CONNECTED" ? "MSFS not detected" : "Bridge offline. Notes and saved data remain available."}</div>
        {screen === "Home" && <Home descent={descent} />}
        {screen === "Flight" && <Flight />}
        {screen === "Airport" && <Airport role={role} setRole={setRole} icao={icao} airport={airport} report={report} stations={vatsim[icao] || []} />}
        {screen === "Weather" && <Weather role={role} setRole={setRole} icao={icao} report={report} />}
        {screen === "Charts" && <Charts icao={icao} />}
        {screen === "Notes" && <Notes />}
        {screen === "Settings" && <Settings theme={theme} setTheme={setTheme} pilot={pilot} setPilot={setPilot} onForget={() => { localStorage.removeItem("efb-token"); setPaired(false); }} />}
      </div>
      <div className={"connect" + (paired ? "" : " show")}>
        <div className="connect-card">
          <h1>FlightSim EFB</h1>
          <p className="note">Scan the QR code on the PC bridge, or enter the pairing token. Then use Share → Add to Home Screen.</p>
          <div className="token">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pairing token" />
            <button type="button" onClick={() => { if (!token.trim()) return; localStorage.setItem("efb-token", token.trim()); setPaired(true); }}>Connect</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Home({ descent }: { descent: boolean }) {
  const { flight, weather } = useStore();
  const dest = weather[flight.flight.arrival];
  return (
    <section className="screen on">
      <h1>Home</h1>
      <div className="group">
        <div className="head">
          <p className="flightno">{flight.flight.flightNumber} · {flight.aircraft.title}</p>
          <p className="route">{flight.flight.departure} → {flight.flight.arrival}</p>
          <p className="phase">{flight.phase.replace("_", " ")}</p>
        </div>
        <div className="figures">
          <div><strong>{altitudeText(flight.position.altitude)}</strong><span>Altitude</span></div>
          <div><strong>{Math.round(flight.speed.groundSpeed) || "—"} kt</strong><span>Ground speed</span></div>
          <div><strong>{fuelText(flight.fuel.total)}</strong><span>Fuel</span></div>
          <div><strong>{flight.eta}</strong><span>ETA</span></div>
        </div>
        {descent ? (
          <>
            <Row label="Arrival" value={flight.flight.arrival} />
            <Row label="Runway" value={dest ? "See Airport" : "—"} />
            <Row label="Wind" value={dest?.wind || "—"} />
            <Row label="QNH" value={dest?.qnh || "—"} />
          </>
        ) : (
          <>
            <Row label="Next waypoint" value={flight.nav.next} />
            <Row label="Distance" value={Math.round(flight.distanceRemainingNm) + " nm"} />
            <Row label="Destination" value={dest ? dest.temperature + " · " + dest.wind : "Weather loading"} />
          </>
        )}
      </div>
    </section>
  );
}

function Flight() {
  const { flight, plan } = useStore();
  return (
    <section className="screen on">
      <h1>Flight</h1>
      <div className="columns">
        <div>
          <div className="kicker">Plan</div>
          <div className="group">
            <Row label="Flight number" value={plan?.flightNumber || flight.flight.flightNumber} />
            <Row label="Callsign" value={plan?.callsign || flight.flight.callsign} />
            <Row label="Aircraft" value={flight.aircraft.title} />
            <Row label="Departure" value={flight.flight.departure} />
            <Row label="Arrival" value={flight.flight.arrival} />
            <Row label="Alternate" value={plan?.alternate || flight.flight.alternate} />
            <Row label="Route" value={plan?.route || "—"} />
          </div>
        </div>
        <div>
          <div className="kicker">Live</div>
          <div className="group">
            <Row label="Position" value={`${flight.position.latitude.toFixed(2)}, ${flight.position.longitude.toFixed(2)}`} />
            <Row label="Altitude" value={altitudeText(flight.position.altitude)} />
            <Row label="IAS" value={Math.round(flight.speed.ias) + " kt"} />
            <Row label="TAS" value={Math.round(flight.speed.tas) + " kt"} />
            <Row label="Ground speed" value={Math.round(flight.speed.groundSpeed) + " kt"} />
            <Row label="Mach" value={flight.speed.mach.toFixed(2)} />
            <Row label="Heading" value={String(Math.round(flight.position.heading)).padStart(3, "0")} />
            <Row label="Track" value={String(Math.round(flight.track)).padStart(3, "0")} />
            <Row label="Vertical speed" value={Math.round(flight.speed.verticalSpeed) + " fpm"} />
            <Row label="Fuel" value={fuelText(flight.fuel.total)} />
            <Row label="Flight time" value={flight.flightTime} />
            <Row label="Distance" value={Math.round(flight.distanceRemainingNm) + " nm"} />
            <Row label="Next waypoint" value={flight.nav.next} />
            <Row label="ETA" value={flight.eta} />
            <Row label="Wind" value={`${String(flight.wind.direction).padStart(3, "0")}/${flight.wind.speed}`} />
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleSwitch({ role, setRole }: { role: string; setRole: (role: "departure" | "arrival" | "alternate") => void }) {
  return (
    <div className="seg">
      {(["departure", "arrival", "alternate"] as const).map((item) => (
        <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
      ))}
    </div>
  );
}

function Airport({ role, setRole, icao, airport, report, stations }: { role: "departure" | "arrival" | "alternate"; setRole: (role: "departure" | "arrival" | "alternate") => void; icao: string; airport: { name: string; elevation: number; runways: { id: string; heading: number; length: number; surface: string }[]; freqs: [string, string][] }; report?: { wind: string }; stations: { role: string; callsign: string; frequency: string; online: boolean }[] }) {
  const [runway, setRunway] = useState(airport.runways[0]?.id || "");
  const selected = airport.runways.find((item) => item.id === runway) || airport.runways[0];
  const parts = selected ? windParts(selected.heading, report?.wind || "") : { head: "—", cross: "—" };
  return (
    <section className="screen on">
      <h1>Airport</h1>
      <RoleSwitch role={role} setRole={setRole} />
      <div className="group">
        <Row label="ICAO" value={icao} />
        <Row label="Name" value={airport.name} />
        <Row label="Elevation" value={airport.elevation + " ft"} />
      </div>
      <div className="kicker">Runway</div>
      <div className="seg">
        {airport.runways.map((item) => <button key={item.id} type="button" aria-pressed={item.id === selected?.id} onClick={() => setRunway(item.id)}>{item.id}</button>)}
      </div>
      {selected && (
        <div className="group">
          <Row label="Heading" value={String(selected.heading).padStart(3, "0") + "°"} />
          <Row label="Length" value={selected.length + " m"} />
          <Row label="Surface" value={selected.surface} />
          <Row label="Wind" value={report?.wind || "—"} />
          <Row label="Crosswind" value={parts.cross} />
          <Row label="Headwind" value={parts.head} />
        </div>
      )}
      <div className="kicker">Frequencies</div>
      <div className="group">{airport.freqs.map(([name, freq]) => <Row key={name} label={name} value={freq} />)}</div>
      <div className="kicker">VATSIM</div>
      <div className="group">
        {stations.length ? stations.map((item) => <Row key={item.callsign} label={item.role + " " + item.callsign} value={(item.frequency || "—") + "  " + (item.online ? "Online" : "Offline")} />) : <Row label="Stations" value="Waiting for bridge" />}
      </div>
    </section>
  );
}

function Weather({ role, setRole, icao, report }: { role: "departure" | "arrival" | "alternate"; setRole: (role: "departure" | "arrival" | "alternate") => void; icao: string; report?: { observed: string; raw: string; taf: string; wind: string; visibility: string; temperature: string; dewpoint: string; qnh: string; clouds: string; updatedAt: number } }) {
  const age = report ? Math.max(0, Math.round((Date.now() / 1000 - report.updatedAt) / 60)) : null;
  return (
    <section className="screen on">
      <h1>Weather</h1>
      <RoleSwitch role={role} setRole={setRole} />
      <p className="note">{icao}{age != null ? ` · Updated ${age} min ago` : " · Waiting for Aviation Weather Center"}</p>
      <div className="kicker">METAR {report?.observed || ""}</div>
      <div className="group"><div className="raw">{report?.raw || "No observation yet."}</div></div>
      <div className="kicker">Decoded</div>
      <div className="group">
        <Row label="Wind" value={report?.wind || "—"} />
        <Row label="Visibility" value={report?.visibility || "—"} />
        <Row label="Temperature" value={report?.temperature || "—"} />
        <Row label="Dew point" value={report?.dewpoint || "—"} />
        <Row label="QNH" value={report?.qnh || "—"} />
        <Row label="Clouds" value={report?.clouds || "—"} />
      </div>
      <div className="kicker">TAF</div>
      <div className="group"><div className="raw">{report?.taf || "No forecast yet."}</div></div>
      <p className="note">ATIS text comes from VATSIM when a station is online. It is not a substitute for official ATIS.</p>
    </section>
  );
}

function Charts({ icao }: { icao: string }) {
  const [kind, setKind] = useState("Airport");
  const canvas = useMemo(() => document.createElement("canvas"), []);
  useEffect(() => {
    const host = document.getElementById("chart-host");
    if (!host) return;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    host.replaceChildren(canvas);
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = host.clientWidth * dpr;
      canvas.height = host.clientHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--group") || "#fff";
      ctx.fillRect(0, 0, host.clientWidth, host.clientHeight);
      ctx.fillStyle = getComputedStyle(document.documentElement).color;
      ctx.font = "14px -apple-system, Segoe UI, sans-serif";
      ctx.fillText(icao + "  " + kind + "  · schematic, not for navigation", 24, 32);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = kind === "Taxi" ? 2 : 8;
      ctx.beginPath();
      ctx.moveTo(host.clientWidth * 0.3, 80);
      ctx.lineTo(host.clientWidth * 0.7, host.clientHeight - 80);
      ctx.stroke();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [canvas, icao, kind]);
  return (
    <section className="screen on">
      <h1>Charts</h1>
      <div className="tools">
        {["Airport", "SID", "STAR", "Approach", "Taxi"].map((item) => <button key={item} type="button" onClick={() => setKind(item)}>{item}</button>)}
      </div>
      <div className="chart" id="chart-host" />
      <p className="note">Licensed plates are not bundled. User PDFs are the ChartProvider path. This view is a schematic only.</p>
    </section>
  );
}

function Notes() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  useEffect(() => { loadNotes().then(setNotes); }, []);
  function update(key: string, value: string) {
    const next = { ...notes, [key]: value };
    setNotes(next);
    saveNotes(next);
  }
  return (
    <section className="screen on">
      <h1>Notes</h1>
      <div className="grid">
        {["Clearance", "ATIS", "Squawk", "Frequency", "Gate", "Runway"].map((key) => (
          <label className="field" key={key}>{key}<input value={notes[key] || ""} onChange={(e) => update(key, e.target.value)} /></label>
        ))}
      </div>
      <div className="kicker">Scratchpad</div>
      <div className="group"><textarea className="scratch" value={notes.scratch || ""} onChange={(e) => update("scratch", e.target.value)} placeholder="Hold short, altitude, personal notes" /></div>
    </section>
  );
}

function Settings({ theme, setTheme, pilot, setPilot, onForget }: { theme: string; setTheme: (value: string) => void; pilot: string; setPilot: (value: string) => void; onForget: () => void }) {
  return (
    <section className="screen on">
      <h1>Settings</h1>
      <div className="kicker">Appearance</div>
      <div className="group">
        <div className="row"><span className="label">Theme</span>
          <select value={theme} onChange={(e) => { setTheme(e.target.value); localStorage.setItem("efb-theme", e.target.value); }}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>
      <div className="kicker">SimBrief</div>
      <div className="grid">
        <label className="field">Pilot ID or username<input value={pilot} onChange={(e) => setPilot(e.target.value)} /></label>
      </div>
      <button className="tools" type="button" style={{ marginTop: 10 }} onClick={() => fetch("/api/simbrief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pilot }) })}><span style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>Import latest flight</span></button>
      <div className="kicker">Connection</div>
      <div className="group"><div className="row"><span className="label">Forget this bridge</span><button type="button" onClick={onForget}>Forget</button></div></div>
      <p className="note">The bridge stays on the local network. Do not expose port 8080 to the internet.</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="row"><span className="label">{label}</span><span className="value">{value}</span></div>;
}
