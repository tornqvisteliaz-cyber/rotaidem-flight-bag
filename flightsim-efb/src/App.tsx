import { useEffect, useState } from "react";
import { altitudeText, apply, fuelText, setLink, useStore } from "./store";
import { loadNotes, saveNotes } from "./notes";
import type { Envelope } from "./protocol";

const NAV = ["Home", "Flight", "Map", "Plan", "Airport", "Weather", "Charts", "Performance", "Checklists", "Documents", "Notes", "Logbook"] as const;
type Screen = (typeof NAV)[number] | "Tools" | "VATSIM" | "SimBrief" | "Settings" | "Aircraft" | "License" | "Briefing" | "Notams" | "Fuel" | "Nearest";

const AIRPORTS: Record<string, { name: string; city: string; elevation: number; runways: { id: string; heading: number; length: number; surface: string; approach: string }[]; freqs: [string, string][] }> = {
  ESSA: { name: "Arlanda", city: "Stockholm, Sweden", elevation: 137, runways: [{ id: "01L", heading: 10, length: 3301, surface: "Asphalt", approach: "ILS" }, { id: "19R", heading: 190, length: 3301, surface: "Asphalt", approach: "ILS" }, { id: "08", heading: 76, length: 2500, surface: "Asphalt", approach: "VOR" }, { id: "26", heading: 256, length: 2500, surface: "Asphalt", approach: "ILS" }], freqs: [["ATIS", "119.000"], ["Tower", "118.500"], ["Ground", "121.700"]] },
  VTBS: { name: "Suvarnabhumi", city: "Bangkok, Thailand", elevation: 5, runways: [{ id: "19R", heading: 194, length: 4000, surface: "Asphalt", approach: "ILS" }, { id: "19L", heading: 194, length: 3700, surface: "Concrete", approach: "ILS" }, { id: "01L", heading: 14, length: 4000, surface: "Asphalt", approach: "ILS" }, { id: "01R", heading: 14, length: 3700, surface: "Concrete", approach: "ILS" }], freqs: [["ATIS", "127.250"], ["Tower", "118.200"], ["Ground", "121.750"]] },
  VTBD: { name: "Don Mueang", city: "Bangkok, Thailand", elevation: 9, runways: [{ id: "21L", heading: 214, length: 3700, surface: "Asphalt", approach: "ILS" }, { id: "03R", heading: 34, length: 3700, surface: "Asphalt", approach: "ILS" }], freqs: [["ATIS", "127.200"], ["Tower", "118.100"]] },
};

const DOCS = [
  { name: "Normal procedures", section: "Aircraft", date: "7 Oct 2026" },
  { name: "Before start checklist", section: "Checklists", date: "7 Oct 2026" },
  { name: "Company fuel policy", section: "Company", date: "1 Oct 2026" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    Home: "M4 11.5 12 4l8 7.5V20H4z",
    Flight: "M3 13l18-6-6 14-3-5z",
    Map: "M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z",
    Plan: "M6 4h12v16H6z M9 8h6 M9 12h4",
    Airport: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z",
    Weather: "M7 16h10a4 4 0 0 0 0-8 5 5 0 0 0-9.5 1.5A3.5 3.5 0 0 0 7 16z",
    Charts: "M5 4h14v16H5z",
    Performance: "M5 19V5 M5 19h14",
    Checklists: "M6 4h12v16H6z M9 9l2 2 4-4",
    Documents: "M7 3h7l4 4v14H7z",
    Notes: "M6 4h12v16H6z",
    Logbook: "M5 4h14v16H5z M8 8h8",
    Tools: "M5 19V5 M5 19h14",
    VATSIM: "M5 12h14 M12 5v14",
    SimBrief: "M6 5h12v14H6z",
    Settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name] || paths.Home} />
    </svg>
  );
}

function windParts(heading: number, wind: string) {
  const match = wind.match(/(\d{3}).*?(\d{1,2})/);
  if (!match) return { head: "—", cross: "—" };
  const diff = ((Number(match[1]) - heading + 540) % 360) - 180;
  const kt = Number(match[2]);
  const head = Math.round(kt * Math.cos((diff * Math.PI) / 180));
  return { head: head >= 0 ? head + " KT head" : Math.abs(head) + " KT tail", cross: Math.round(Math.abs(kt * Math.sin((diff * Math.PI) / 180))) + " KT" };
}

export default function App() {
  const { flight, link, msfs, weather } = useStore();
  const [screen, setScreen] = useState<Screen>("Home");
  const [token, setToken] = useState(localStorage.getItem("efb-token") || "");
  const [paired, setPaired] = useState(Boolean(localStorage.getItem("efb-token")));
  const [theme, setTheme] = useState(localStorage.getItem("efb-theme") || "system");
  const [licensed, setLicensed] = useState(localStorage.getItem("efb-license") === "active");

  useEffect(() => {
    const fromQr = new URLSearchParams(location.search).get("pair");
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

  const status = link === "CONNECTED" ? (msfs === "CONNECTED" ? "Connected" : "MSFS Offline") : "Disconnected";
  const pip = link !== "CONNECTED" ? "bad" : msfs === "CONNECTED" ? "on" : "wait";
  const utc = new Date().toISOString().slice(11, 16);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 10h10M8 3v10" stroke="#c4b08a" strokeWidth="1.6" /></svg></div>
          <div><strong>FlightSim EFB</strong><span>v1.0</span></div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <button key={item} type="button" aria-current={screen === item ? "page" : undefined} aria-label={item} onClick={() => setScreen(item)}>
              <Icon name={item} /><span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="nav" style={{ marginTop: 12 }}>
          {(["Tools", "Aircraft", "VATSIM", "SimBrief", "License", "Settings"] as const).map((item) => (
            <button key={item} type="button" aria-current={screen === item ? "page" : undefined} aria-label={item} onClick={() => setScreen(item)}>
              <Icon name={item} /><span>{item}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="column">
        <header className="toolbar">
          <h1>{screen}</h1>
          <div className="flight-id">{flight.flight.flightNumber}<span>{flight.flight.departure} → {flight.flight.arrival}</span></div>
          <div className="status-pill"><i className={"pip " + pip} />{status}</div>
        </header>
        <main className="screen">
          {screen === "Home" && <Home onOpen={setScreen} />}
          {screen === "Flight" && <Flight />}
          {screen === "Map" && <MapView />}
          {screen === "Plan" && <PlanView />}
          {screen === "Airport" && <Airport weather={weather} />}
          {screen === "Weather" && <Weather />}
          {screen === "Charts" && (licensed ? <Charts /> : <Locked onOpen={() => setScreen("License")} />)}
          {screen === "Performance" && <Performance />}
          {screen === "Checklists" && <Checklists />}
          {screen === "Documents" && (licensed ? <Documents /> : <Locked onOpen={() => setScreen("License")} />)}
          {screen === "Notes" && <Notes />}
          {screen === "Logbook" && <Logbook />}
          {screen === "Tools" && <Tools />}
          {screen === "Aircraft" && <Aircraft />}
          {screen === "VATSIM" && <Vatsim />}
          {screen === "SimBrief" && <SimBrief />}
          {screen === "Briefing" && <Briefing />}
          {screen === "Notams" && <Notams />}
          {screen === "Fuel" && <Fuel />}
          {screen === "Nearest" && <Nearest onOpen={setScreen} />}
          {screen === "License" && <License licensed={licensed} onActivate={() => { localStorage.setItem("efb-license", "active"); setLicensed(true); }} />}
          {screen === "Settings" && <Settings theme={theme} setTheme={setTheme} link={link} onForget={() => { localStorage.removeItem("efb-token"); setPaired(false); }} onSheet={setSheet} />}
        </main>
      </div>
      <footer className="statusbar">{status} · {flight.aircraft.title} · {utc} UTC{link !== "CONNECTED" ? " · Last values kept" : ""}</footer>
      <div className={"connect" + (paired ? "" : " show")}>
        <div className="connect-card">
          <h1>FlightSim EFB</h1>
          <p className="note">Unable to use live data until this iPad is paired. Enter the token printed by the Windows bridge, then Share → Add to Home Screen.</p>
          <div className="token">
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pairing token" aria-label="Pairing token" />
            <button type="button" onClick={() => { if (!token.trim()) return; localStorage.setItem("efb-token", token.trim()); setPaired(true); }}>Connect</button>
          </div>
        </div>
      </div>
      {sheet === "units" && (
        <div className="sheet" onClick={() => setSheet("")}>
          <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
            <div className="kicker">Units</div>
            <div className="group">
              <Row label="Weight" value="KG" />
              <Row label="Distance" value="NM" />
              <Row label="Altitude" value="FT" />
              <Row label="Pressure" value="hPa" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MapView() {
  const { flight } = useStore();
  return (
    <>
      <p className="meta">North up · route schematic</p>
      <div className="chart"><canvas id="plate" /></div>
      <div className="group" style={{ marginTop: 12 }}>
        <Row label="Aircraft" value={flight.flight.callsign} />
        <Row label="Position" value={`${flight.position.latitude.toFixed(2)}  ${flight.position.longitude.toFixed(2)}`} />
        <Row label="Track" value={String(Math.round(flight.track)).padStart(3, "0") + "°"} />
      </div>
      <p className="note">A licensed map provider is not connected. This view uses the live position only.</p>
    </>
  );
}

function PlanView() {
  const { flight, plan } = useStore();
  return (
    <>
      <p className="route">{flight.flight.departure} → {flight.flight.arrival}</p>
      <div className="group">
        <Row label="SID" value={plan?.sid || "Not imported"} />
        <Row label="Route" value={plan?.route || "Import from SimBrief"} />
        <Row label="STAR" value={plan?.star || "Not imported"} />
        <Row label="Alternate" value={plan?.alternate || flight.flight.alternate} />
        <Row label="Cruise" value={plan?.cruiseAltitude ? "FL" + String(Math.round(plan.cruiseAltitude / 100)).padStart(3, "0") : "FL350"} />
      </div>
    </>
  );
}

function Checklists() {
  const items = ["Parking brake set", "Fuel quantity checked", "Beacon on", "Doors closed", "Flight controls checked"];
  const [done, setDone] = useState<Record<string, boolean>>({});
  return (
    <>
      <div className="kicker">Before start</div>
      <div className="group">
        {items.map((item) => (
          <button className="list-row" key={item} type="button" aria-pressed={!!done[item]} onClick={() => setDone({ ...done, [item]: !done[item] })}>
            <span>{done[item] ? "Done" : "Open"}</span><span>{item}</span>
          </button>
        ))}
      </div>
      <p className="note">Items are not completed automatically.</p>
    </>
  );
}

function Logbook() {
  const { flight } = useStore();
  return (
    <div className="group">
      <Row label="7 Oct 2026" value={flight.flight.departure + " → " + flight.flight.arrival} />
      <Row label="Aircraft" value={flight.aircraft.title} />
      <Row label="Flight time" value={flight.flightTime} />
      <Row label="Landing" value="Recorded after parking" />
    </div>
  );
}

function Tools() {
  const [runway, setRunway] = useState("190");
  const [wind, setWind] = useState("220");
  const [speed, setSpeed] = useState("12");
  const diff = ((Number(wind) - Number(runway) + 540) % 360) - 180;
  const head = Math.round(Number(speed) * Math.cos((diff * Math.PI) / 180));
  const cross = Math.round(Math.abs(Number(speed) * Math.sin((diff * Math.PI) / 180)));
  return (
    <>
      <div className="kicker">Crosswind</div>
      <div className="grid">
        <label className="field">Runway heading<input value={runway} onChange={(e) => setRunway(e.target.value)} /></label>
        <label className="field">Wind direction<input value={wind} onChange={(e) => setWind(e.target.value)} /></label>
        <label className="field">Wind speed KT<input value={speed} onChange={(e) => setSpeed(e.target.value)} /></label>
      </div>
      <div className="group" style={{ marginTop: 12 }}>
        <Row label="Headwind" value={(head >= 0 ? head : 0) + " KT"} />
        <Row label="Tailwind" value={(head < 0 ? Math.abs(head) : 0) + " KT"} />
        <Row label="Crosswind" value={cross + " KT"} />
      </div>
    </>
  );
}

function Vatsim() {
  const { flight, vatsim } = useStore();
  const rows = vatsim[flight.flight.arrival] || [];
  return (
    <div className="group">
      {rows.length ? rows.map((item) => <Row key={item.callsign} label={item.callsign} value={(item.frequency || "—") + "  Online"} />) : <Row label={flight.flight.arrival} value="No ATC online" />}
    </div>
  );
}

function SimBrief() {
  const [pilot, setPilot] = useState("");
  const [message, setMessage] = useState("Import uses the bridge, not the iPad.");
  return (
    <>
      <label className="field">Pilot ID or username<input value={pilot} onChange={(e) => setPilot(e.target.value)} /></label>
      <button className="primary" style={{ marginTop: 12 }} type="button" onClick={() => fetch("/api/simbrief", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pilot }) }).then((res) => res.json()).then((data) => setMessage(data.error || "Imported " + (data.flightNumber || "flight"))).catch(() => setMessage("Bridge did not answer."))}>Import latest flight</button>
      <p className="note">{message}</p>
    </>
  );
}

function Home({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { flight, weather } = useStore();
  const dest = weather[flight.flight.arrival];
  const descent = ["DESCENT", "APPROACH", "LANDING"].includes(flight.phase);
  return (
    <>
      <p className="meta">{flight.flight.flightNumber} · {flight.aircraft.title}</p>
      <p className="route">{flight.flight.departure} → {flight.flight.arrival}</p>
      <p className="phase">{flight.phase.replace("_", " ")}</p>
      <div className="split" style={{ marginTop: 16 }}>
        <div>
          <div className="figures">
            <div><strong>{altitudeText(flight.position.altitude)}</strong><span>Altitude</span></div>
            <div><strong>{Math.round(flight.speed.groundSpeed) || "—"} KT</strong><span>Ground speed</span></div>
            <div><strong>{String(Math.round(flight.position.heading)).padStart(3, "0")}°</strong><span>Heading</span></div>
          </div>
          <div className="group" style={{ marginTop: 12 }}>
            <Row label="Fuel" value={fuelText(flight.fuel.total)} />
            <Row label="ETA" value={flight.eta + " UTC"} />
            <Row label="Next" value={flight.nav.next + "  " + Math.round(flight.nav.distanceNm) + " NM"} />
          </div>
        </div>
        <div>
          <div className="kicker">{descent ? "Arrival" : "Destination"}</div>
          <div className="group">
            <Row label="Airport" value={flight.flight.arrival} />
            <Row label="Weather" value={dest ? dest.temperature + " · " + dest.wind : "Waiting"} />
            <Row label="QNH" value={dest?.qnh || "—"} />
          </div>
          <button className="primary" style={{ marginTop: 12 }} type="button" onClick={() => onOpen(descent ? "Airport" : "Weather")}>{descent ? "Open arrival" : "Open weather"}</button>
          <div className="seg" style={{ marginTop: 16 }}>
            {(["Briefing", "Fuel", "Nearest", "Notams"] as const).map((item) => <button key={item} type="button" onClick={() => onOpen(item)}>{item}</button>)}
          </div>
        </div>
      </div>
      <div className="progress">
        <div className="ends"><span>{flight.flight.departure}</span><span>{Math.round(flight.progress * 100)}%</span><span>{flight.flight.arrival}</span></div>
        <div className="track"><i style={{ left: Math.round(flight.progress * 100) + "%" }} /></div>
        <div className="ends"><span>Next {flight.nav.next}</span><span>{Math.round(flight.distanceRemainingNm)} NM</span></div>
      </div>
    </>
  );
}

function Flight() {
  const { flight, plan } = useStore();
  return (
    <div className="split">
      <div>
        <div className="kicker">Identification</div>
        <div className="group">
          <Row label="Flight" value={plan?.flightNumber || flight.flight.flightNumber} />
          <Row label="Callsign" value={plan?.callsign || flight.flight.callsign} />
          <Row label="Aircraft" value={flight.aircraft.title} />
          <Row label="Departure" value={flight.flight.departure} />
          <Row label="Arrival" value={flight.flight.arrival} />
          <Row label="Alternate" value={plan?.alternate || flight.flight.alternate} />
        </div>
        <div className="kicker">Navigation</div>
        <div className="group">
          <Row label="Next waypoint" value={flight.nav.next} />
          <Row label="Distance" value={Math.round(flight.nav.distanceNm) + " NM"} />
          <Row label="Remaining" value={Math.round(flight.distanceRemainingNm) + " NM"} />
          <Row label="ETA" value={flight.eta + " UTC"} />
          <Row label="Route" value={plan?.route || "No OFP imported"} />
        </div>
      </div>
      <div>
        <div className="kicker">Position</div>
        <div className="group">
          <Row label="Latitude" value={flight.position.latitude.toFixed(4)} />
          <Row label="Longitude" value={flight.position.longitude.toFixed(4)} />
          <Row label="Altitude" value={altitudeText(flight.position.altitude)} />
          <Row label="IAS" value={Math.round(flight.speed.ias) + " KT"} />
          <Row label="TAS" value={Math.round(flight.speed.tas) + " KT"} />
          <Row label="Ground speed" value={Math.round(flight.speed.groundSpeed) + " KT"} />
          <Row label="Heading" value={String(Math.round(flight.position.heading)).padStart(3, "0") + "°"} />
          <Row label="Track" value={String(Math.round(flight.track)).padStart(3, "0") + "°"} />
          <Row label="Vertical speed" value={Math.round(flight.speed.verticalSpeed) + " FPM"} />
          <Row label="Fuel" value={fuelText(flight.fuel.total)} />
          <Row label="Wind" value={`${String(flight.wind.direction).padStart(3, "0")}° / ${flight.wind.speed} KT`} />
        </div>
      </div>
    </div>
  );
}

function Airport({ weather }: { weather: Record<string, { wind: string }> }) {
  const { flight, vatsim } = useStore();
  const [role, setRole] = useState<"departure" | "arrival" | "alternate">("arrival");
  const icao = role === "departure" ? flight.flight.departure : role === "alternate" ? flight.flight.alternate : flight.flight.arrival;
  const airport = AIRPORTS[icao] || { name: icao, city: "", elevation: 0, runways: [], freqs: [] as [string, string][] };
  const [runway, setRunway] = useState(airport.runways[0]?.id || "");
  const selected = airport.runways.find((item) => item.id === runway) || airport.runways[0];
  const parts = selected ? windParts(selected.heading, weather[icao]?.wind || "") : { head: "—", cross: "—" };
  return (
    <>
      <RoleSwitch role={role} setRole={setRole} />
      <p className="route">{icao}</p>
      <p className="meta">{airport.name} · {airport.city}</p>
      <div className="split" style={{ marginTop: 16 }}>
        <div>
          <div className="kicker">Runways</div>
          <div className="group">
            {airport.runways.map((item) => (
              <button className="list-row" key={item.id} type="button" aria-pressed={item.id === selected?.id} onClick={() => setRunway(item.id)}>
                <span><strong>{item.id}</strong><span className="meta"> {item.approach}</span></span>
                <span className="meta">{item.length} m · {String(item.heading).padStart(3, "0")}°</span>
              </button>
            ))}
          </div>
          <div className="kicker">Frequencies</div>
          <div className="group">{airport.freqs.map(([name, freq]) => <Row key={name} label={name} value={freq} />)}</div>
        </div>
        {selected && (
          <div>
            <div className="kicker">{selected.id}</div>
            <div className="group">
              <Row label="Heading" value={String(selected.heading).padStart(3, "0") + "°"} />
              <Row label="Length" value={selected.length + " m"} />
              <Row label="Surface" value={selected.surface} />
              <Row label="Elevation" value={airport.elevation + " FT"} />
              <Row label="Wind" value={weather[icao]?.wind || "—"} />
              <Row label="Headwind" value={parts.head} />
              <Row label="Crosswind" value={parts.cross} />
            </div>
            <div className="kicker">VATSIM</div>
            <div className="group">
              {(vatsim[icao] || []).length ? vatsim[icao].map((item) => <Row key={item.callsign} label={item.callsign} value={(item.frequency || "—") + "  Online"} />) : <Row label="Stations" value="None online" />}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Weather() {
  const { flight, weather } = useStore();
  const [role, setRole] = useState<"departure" | "arrival" | "alternate">("arrival");
  const [tab, setTab] = useState("METAR");
  const icao = role === "departure" ? flight.flight.departure : role === "alternate" ? flight.flight.alternate : flight.flight.arrival;
  const report = weather[icao];
  const airport = AIRPORTS[icao];
  return (
    <>
      <RoleSwitch role={role} setRole={setRole} />
      <p className="route">{icao}</p>
      <p className="meta">{airport?.name || "Airport"}{report ? ` · Updated ${new Date(report.updatedAt * 1000).toISOString().slice(11, 16)} UTC` : " · Waiting"}</p>
      <div className="seg">
        {["METAR", "TAF", "ATIS", "Current"].map((item) => <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      {tab === "METAR" && <div className="group"><div className="raw">{report?.raw || "No observation yet."}</div></div>}
      {tab === "TAF" && <div className="group"><div className="raw">{report?.taf || "No forecast yet."}</div></div>}
      {tab === "ATIS" && <div className="group"><Row label="ATIS" value="Shown when a VATSIM station is online" /></div>}
      <div className="kicker">Decoded</div>
      <div className="group">
        <Row label="Wind" value={report?.wind || "—"} />
        <Row label="Visibility" value={report?.visibility || "—"} />
        <Row label="Temperature" value={report?.temperature || "—"} />
        <Row label="Dew point" value={report?.dewpoint || "—"} />
        <Row label="QNH" value={report?.qnh || "—"} />
        <Row label="Clouds" value={report?.clouds || "—"} />
      </div>
    </>
  );
}

function Charts() {
  const { flight } = useStore();
  const [kind, setKind] = useState("Approach");
  const [chart, setChart] = useState("ILS 19R");
  useEffect(() => {
    const canvas = document.getElementById("plate") as HTMLCanvasElement | null;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = host.clientWidth * dpr;
      canvas.height = host.clientHeight * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim() || "#fff";
      ctx.fillRect(0, 0, host.clientWidth, host.clientHeight);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim() || "#111";
      ctx.font = "15px -apple-system, Segoe UI, sans-serif";
      ctx.fillText(flight.flight.arrival + "  " + chart + "  · schematic", 24, 36);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(host.clientWidth * 0.35, 70);
      ctx.lineTo(host.clientWidth * 0.62, host.clientHeight - 50);
      ctx.stroke();
    };
    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [chart, flight.flight.arrival]);
  return (
    <div className="split">
      <div>
        <div className="seg">{["Airport", "SID", "STAR", "Approach", "Taxi"].map((item) => <button key={item} type="button" aria-pressed={kind === item} onClick={() => setKind(item)}>{item}</button>)}</div>
        <div className="group">
          {["ILS 19R", "ILS 19L", "RNAV 19R"].map((item) => <button className="list-row" key={item} type="button" aria-pressed={chart === item} onClick={() => setChart(item)}><span>{item}</span><span className="meta">{kind}</span></button>)}
        </div>
        <p className="note">Licensed plates are not bundled. This is a schematic, not for navigation.</p>
      </div>
      <div className="chart"><canvas id="plate" /></div>
    </div>
  );
}

function Performance() {
  const { flight } = useStore();
  const [mode, setMode] = useState("Takeoff");
  return (
    <>
      <p className="meta">{flight.aircraft.title}</p>
      <div className="seg">{["Takeoff", "Landing"].map((item) => <button key={item} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{item}</button>)}</div>
      <div className="split">
        <div className="group">
          <Row label="Airport" value={mode === "Takeoff" ? flight.flight.departure : flight.flight.arrival} />
          <Row label="Runway" value={mode === "Takeoff" ? "19R" : "19R"} />
          <Row label="Weight" value={mode === "Takeoff" ? "72.0 T" : "61.0 T"} />
          <Row label="Wind" value="220° / 8 KT" />
          <Row label="Temperature" value="18 °C" />
        </div>
        <div>
          <div className="results">
            <div><strong>{mode === "Takeoff" ? "139" : "137"}</strong><span>{mode === "Takeoff" ? "V1" : "VREF"}</span></div>
            <div><strong>{mode === "Takeoff" ? "142" : "142"}</strong><span>{mode === "Takeoff" ? "VR" : "VAPP"}</span></div>
            <div><strong>{mode === "Takeoff" ? "148" : "—"}</strong><span>{mode === "Takeoff" ? "V2" : "Margin"}</span></div>
          </div>
          <p className="note">Demonstration estimate. Not validated against the aircraft flight manual.</p>
        </div>
      </div>
    </>
  );
}

function Locked({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <p className="route">License required</p>
      <p className="note">Charts and manuals stay on this iPad and are watermarked with the paired device. No copyrighted plates are included.</p>
      <button className="primary" type="button" onClick={onOpen}>Open license</button>
    </>
  );
}

function License({ licensed, onActivate }: { licensed: boolean; onActivate: () => void }) {
  const device = localStorage.getItem("efb-token")?.slice(0, 8) || "unpaired";
  return (
    <>
      <div className="group">
        <Row label="Device" value={device} />
        <Row label="Charts" value={licensed ? "Unlocked on this iPad" : "Locked"} />
        <Row label="Manuals" value={licensed ? "Watermarked" : "Locked"} />
      </div>
      <p className="note">A license only unlocks content you add yourself. It does not download Navigraph, Jeppesen, or airline manuals.</p>
      {!licensed && <button className="primary" type="button" onClick={onActivate}>Activate this iPad</button>}
    </>
  );
}

function Briefing() {
  const { flight, weather } = useStore();
  const dest = weather[flight.flight.arrival];
  return (
    <>
      <p className="route">{flight.flight.flightNumber}</p>
      <p className="meta">{flight.flight.departure} → {flight.flight.arrival} · {flight.aircraft.title}</p>
      <div className="group">
        <Row label="Phase" value={flight.phase} />
        <Row label="Cruise" value={altitudeText(flight.position.altitude)} />
        <Row label="Destination weather" value={dest ? dest.wind + " · " + dest.temperature : "Waiting"} />
        <Row label="Fuel" value={fuelText(flight.fuel.total)} />
      </div>
    </>
  );
}

function Notams() {
  return (
    <>
      <p className="route">No NOTAM feed</p>
      <p className="note">Airport, runway, and procedure notices appear here when a licensed data source is connected. Nothing is invented.</p>
    </>
  );
}

function Fuel() {
  const { flight, plan } = useStore();
  return (
    <div className="group">
      <Row label="Block" value={plan ? plan.fuel.block + " KG" : "—"} />
      <Row label="Trip" value={plan ? plan.fuel.trip + " KG" : "—"} />
      <Row label="Actual remaining" value={fuelText(flight.fuel.total)} />
      <Row label="Reserve" value={plan ? plan.fuel.reserve + " KG" : "—"} />
    </div>
  );
}

function Nearest({ onOpen }: { onOpen: (screen: Screen) => void }) {
  const { flight } = useStore();
  return (
    <div className="group">
      <button className="list-row" type="button" onClick={() => onOpen("Airport")}><span>{flight.flight.arrival}</span><span className="meta">Destination</span></button>
      <button className="list-row" type="button" onClick={() => onOpen("Airport")}><span>{flight.flight.alternate}</span><span className="meta">Alternate</span></button>
    </div>
  );
}

function Aircraft() {
  const { flight } = useStore();
  return (
    <>
      <p className="route">{flight.aircraft.title}</p>
      <p className="meta">{flight.aircraft.registration} · {flight.aircraft.airline}</p>
      <div className="kicker">Limits</div>
      <div className="group">
        <Row label="MMO" value="M 0.82" />
        <Row label="VMO" value="350 KT" />
        <Row label="Flaps full" value="177 KT" />
        <Row label="Gear" value="250 KT" />
      </div>
      <div className="kicker">Weights</div>
      <div className="group">
        <Row label="MTOW" value="77000 KG" />
        <Row label="MLW" value="66000 KG" />
        <Row label="Fuel" value={fuelText(flight.fuel.total)} />
      </div>
    </>
  );
}

function Documents() {
  return (
    <>
      <div className="kicker">Recent</div>
      <div className="group">
        {DOCS.map((doc) => <div className="row" key={doc.name}><span><span className="label">{doc.name}</span><span className="meta"> {doc.section}</span></span><span className="meta">{doc.date}</span></div>)}
      </div>
      <p className="note">PDF files stay on the iPad once added. No copyrighted manuals are bundled.</p>
    </>
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
    <>
      <div className="grid">
        {["ATIS", "Clearance", "Squawk", "Frequency", "Gate", "Runway"].map((key) => (
          <label className="field" key={key}>{key}<input value={notes[key] || ""} onChange={(e) => update(key, e.target.value)} /></label>
        ))}
      </div>
      <div className="kicker">Scratchpad</div>
      <div className="group"><textarea className="scratch" value={notes.scratch || ""} onChange={(e) => update("scratch", e.target.value)} placeholder="Hold short, altitude, personal notes" /></div>
    </>
  );
}

function Settings({ theme, setTheme, link, onForget, onSheet }: { theme: string; setTheme: (value: string) => void; link: string; onForget: () => void; onSheet: (name: string) => void }) {
  return (
    <>
      <div className="kicker">Connection</div>
      <div className="group"><Row label="Wi-Fi bridge" value={link === "CONNECTED" ? "Connected" : "Offline"} /></div>
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
      <div className="kicker">Units</div>
      <div className="group"><button className="list-row" type="button" onClick={() => onSheet("units")}><span>Units</span><span className="meta">KG · NM · FT</span></button></div>
      <div className="kicker">Data sources</div>
      <div className="group">
        <Row label="SimBrief" value="Pilot ID in bridge" />
        <Row label="Weather" value="Aviation Weather Center" />
        <Row label="VATSIM" value="Public data feed" />
      </div>
      <div className="kicker">Privacy</div>
      <div className="group"><button className="list-row" type="button" onClick={onForget}><span>Forget this bridge</span><span className="meta">Pair again</span></button></div>
    </>
  );
}

function RoleSwitch({ role, setRole }: { role: string; setRole: (role: "departure" | "arrival" | "alternate") => void }) {
  return (
    <div className="seg">
      {(["departure", "arrival", "alternate"] as const).map((item) => <button key={item} type="button" aria-pressed={role === item} onClick={() => setRole(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="row"><span className="label">{label}</span><span className="value">{value}</span></div>;
}
