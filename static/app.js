const AIRPORTS = {
  ESSA: {
    icao: "ESSA", iata: "ARN", name: "Stockholm Arlanda", elevation: 137,
    runways: [
      { id: "01L", heading: 10, length: 3301, surface: "Asphalt", pair: "19R" },
      { id: "19R", heading: 190, length: 3301, surface: "Asphalt", pair: "01L" },
      { id: "01R", heading: 10, length: 2500, surface: "Asphalt", pair: "19L" },
      { id: "19L", heading: 190, length: 2500, surface: "Asphalt", pair: "01R" },
      { id: "08", heading: 76, length: 2500, surface: "Asphalt", pair: "26" },
      { id: "26", heading: 256, length: 2500, surface: "Asphalt", pair: "08" }
    ],
    freqs: [["ATIS", "119.000"], ["Tower", "118.500"], ["Ground", "121.700"], ["Approach", "126.650"]],
    weather: {
      metar: "ESSA 071350Z 22012KT 9999 SCT040 09/03 Q1016 NOSIG",
      taf: "TAF ESSA 071100Z 0712/0812 22012KT 9999 SCT040",
      windDir: 220, windKt: 12, vis: "10 km", clouds: "SCT 4000 ft", temp: 9, dew: 3, qnh: 1016, trend: "NOSIG"
    }
  },
  VTBS: {
    icao: "VTBS", iata: "BKK", name: "Bangkok Suvarnabhumi", elevation: 5,
    runways: [
      { id: "01L", heading: 14, length: 4000, surface: "Asphalt", pair: "19R" },
      { id: "19R", heading: 194, length: 4000, surface: "Asphalt", pair: "01L" },
      { id: "01R", heading: 14, length: 3700, surface: "Concrete", pair: "19L" },
      { id: "19L", heading: 194, length: 3700, surface: "Concrete", pair: "01R" }
    ],
    freqs: [["ATIS", "127.250"], ["Tower", "118.200"], ["Ground", "121.750"], ["Approach", "124.350"]],
    weather: {
      metar: "VTBS 071400Z 14008KT 9999 FEW025 33/24 Q1008 NOSIG",
      taf: "TAF VTBS 071100Z 0712/0812 14008KT 9999 FEW025 TEMPO 0718/0806 4000 TSRA",
      windDir: 140, windKt: 8, vis: "10 km", clouds: "FEW 2500 ft", temp: 33, dew: 24, qnh: 1008, trend: "NOSIG"
    }
  },
  ENGM: {
    icao: "ENGM", iata: "OSL", name: "Oslo Gardermoen", elevation: 681,
    runways: [
      { id: "01L", heading: 12, length: 3600, surface: "Asphalt", pair: "19R" },
      { id: "19R", heading: 192, length: 3600, surface: "Asphalt", pair: "01L" },
      { id: "01R", heading: 12, length: 2950, surface: "Asphalt", pair: "19L" },
      { id: "19L", heading: 192, length: 2950, surface: "Asphalt", pair: "01R" }
    ],
    freqs: [["ATIS", "126.125"], ["Tower", "118.300"], ["Ground", "121.900"], ["Approach", "120.450"]],
    weather: {
      metar: "ENGM 071350Z 20015KT 9999 BKN035 07/02 Q1014",
      taf: "TAF ENGM 071100Z 0712/0812 20015KT 9999 BKN035",
      windDir: 200, windKt: 15, vis: "10 km", clouds: "BKN 3500 ft", temp: 7, dew: 2, qnh: 1014, trend: "NOSIG"
    }
  }
};

const PROFILE = {
  title: "Fenix A320",
  limits: [["MMO", "M 0.82"], ["VMO", "350 kt"], ["Flaps 1", "230 kt"], ["Flaps 2", "200 kt"], ["Flaps 3", "185 kt"], ["Flaps Full", "177 kt"], ["Gear", "250 kt"]],
  speeds: [["Green dot", "weight dependent"], ["VLS clean", "profile table"], ["VAPP full", "VLS + 5"]],
  weights: [["MTOW", "77.0 t"], ["MLW", "66.0 t"], ["MZFW", "62.5 t"], ["OEW demo", "42.6 t"]],
  fuel: [["Max", "18.7 t"], ["Taxi allowance", "0.2 t"], ["Demo burn", "2.4 t/h cruise"]],
  checklist: ["Parking brake — set", "Fuel quantity — checked", "Baro — set", "Flaps — takeoff", "Flight controls — checked", "Transponder — set"]
};

const DOCS = [
  { id: "sop", title: "Normal procedures", body: "This company note is a simulator aid.\n\nBefore start, confirm the loadsheet fuel, the departure runway, and the cleared altitude. Brief the SID only after the runway is known.\n\nAfter takeoff, acceleration altitude is 1 500 ft AAL unless the chart says otherwise. Retract flaps on schedule. Climb at the profile managed speed.\n\nCruise: review destination weather at top of descent minus 40 minutes. Note ATIS letter, runway, and transition level in Notes." },
  { id: "clb", title: "Climb checklist", body: "Landing gear — up\nFlaps — up\nPacks — on\nAltimeters — standard at transition\nAutopilot — engaged as cleared" },
  { id: "des", title: "Descent brief", body: "Arrival, runway, approach type, minima, missed approach altitude, and autobrake. Cross-check landing weight against MLW. Confirm landing performance is an estimate in this version." },
  { id: "fuel", title: "Fuel policy", body: "Taxi, trip, contingency, alternate, and final reserve are planned outside the EFB in version 1. The live fuel figure is tank quantity from the bridge, not a dispatch release." }
];

const state = {
  protocolVersion: 1,
  connection: { msfs: false, simconnect: false },
  aircraft: { title: "Fenix A320", registration: "SE-ROA", airline: "Scandinavian" },
  flight: { callsign: "SAS123", flightNumber: "SK123", departure: "ESSA", arrival: "VTBS", alternate: "ENGM" },
  position: { latitude: 13.9, longitude: 100.2, altitude: 35000, heading: 142 },
  speed: { ias: 274, tas: 452, groundSpeed: 472, mach: 0.78, verticalSpeed: 0 },
  fuel: { total: 4800 },
  nav: { active: "TOD", next: "BANKO", distanceNm: 42 },
  phase: "CRUISE",
  wind: { direction: 140, speed: 18 },
  progress: 0.72,
  distanceRemainingNm: 180,
  eta: "08:42",
  flightTime: "06:12",
  track: 142,
  updatedAt: 0
};

const shown = {};
let ws;
let token = localStorage.getItem("rotaidem-token") || "";
let airportRole = "arrival";
let chart = { zoom: 1, rot: 0, x: 0, y: 0 };
const favorites = new Set(JSON.parse(localStorage.getItem("rotaidem-favs") || "[]"));

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}
function text(el, value) {
  if (el.textContent !== value) el.textContent = value;
}
function bindAll() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    const value = String(get(viewModel(), key) ?? "—");
    text(el, value);
  });
}
function viewModel() {
  const alt = state.position.altitude;
  const phase = state.phase || "PARKED";
  return {
    ...state,
    depIata: AIRPORTS[state.flight.departure]?.iata || state.flight.departure,
    arrIata: AIRPORTS[state.flight.arrival]?.iata || state.flight.arrival,
    phaseLabel: phase.charAt(0) + phase.slice(1).toLowerCase(),
    altitudeText: alt >= 18000 ? "FL" + String(Math.round(alt / 100)).padStart(3, "0") : Math.round(alt) + " ft",
    gsText: Math.round(state.speed.groundSpeed) + " kt",
    iasText: Math.round(state.speed.ias) + " kt",
    tasText: Math.round(state.speed.tas) + " kt",
    vsText: Math.round(state.speed.verticalSpeed) + " fpm",
    machText: "M " + Number(state.speed.mach || 0).toFixed(2),
    fuelText: (state.fuel.total / 1000).toFixed(1) + " t",
    etaText: state.eta || "—",
    flightTimeText: state.flightTime || "—",
    distanceRemainingText: Math.round(state.distanceRemainingNm) + " nm",
    latText: Number(state.position.latitude).toFixed(3),
    lonText: Number(state.position.longitude).toFixed(3),
    hdgText: String(Math.round(state.position.heading)).padStart(3, "0") + "°",
    trackText: String(Math.round(state.track || state.position.heading)).padStart(3, "0") + "°",
    windText: String(state.wind.direction).padStart(3, "0") + "/" + state.wind.speed,
    nav: { ...state.nav, distanceText: Math.round(state.nav.distanceNm || 0) + " nm" }
  };
}

function applyState(next) {
  const previous = state.phase;
  Object.assign(state, next);
  state.updatedAt = Date.now();
  document.body.dataset.phase = state.phase || "CRUISE";
  const pip = document.getElementById("route-pip");
  if (pip) pip.style.left = Math.round((state.progress || 0) * 100) + "%";
  bindAll();
  renderHomeExtra();
  if (document.getElementById("screen-airport").classList.contains("active")) renderAirport();
  if (document.getElementById("screen-weather").classList.contains("active")) renderWeather();
  if (previous && previous !== "PARKED" && state.phase === "PARKED" && state.landingRate) {
    const log = JSON.parse(localStorage.getItem("rotaidem-log") || "[]");
    log.unshift({
      date: new Date().toISOString().slice(0, 10),
      callsign: state.flight.callsign,
      aircraft: state.aircraft.title,
      departure: state.flight.departure,
      arrival: state.flight.arrival,
      flightTime: state.flightTime,
      landingRate: state.landingRate
    });
    localStorage.setItem("rotaidem-log", JSON.stringify(log.slice(0, 20)));
  }
}

function renderHomeExtra() {
  const host = document.getElementById("home-extra");
  const kicker = document.getElementById("home-extra-kicker");
  const phase = state.phase;
  const arrival = AIRPORTS[state.flight.arrival];
  const w = arrival.weather;
  let rows;
  if (phase === "DESCENT" || phase === "APPROACH" || phase === "LANDING") {
    kicker.textContent = "Arrival";
    const best = bestRunway(arrival);
    rows = [
      ["Airport", arrival.icao + " " + arrival.name],
      ["Runway", best.id + " · " + best.note],
      ["Wind", w.windDir + "/" + w.windKt],
      ["QNH", String(w.qnh)],
      ["Landing", "Open Performance"]
    ];
  } else {
    kicker.textContent = "Destination weather";
    rows = [
      ["Airport", arrival.icao],
      ["Wind", w.windDir + "/" + w.windKt],
      ["Visibility", w.vis],
      ["Clouds", w.clouds],
      ["QNH", String(w.qnh)],
      ["Trend", w.trend]
    ];
  }
  host.replaceChildren(...rows.map(([l, v]) => row(l, v)));
}
function row(label, value) {
  const el = document.createElement("div");
  el.className = "row";
  el.innerHTML = `<span class="label"></span><span class="value"></span>`;
  el.firstChild.textContent = label;
  el.lastChild.textContent = value;
  return el;
}

function windComp(runway, windDir, windKt) {
  const diff = ((windDir - runway.heading + 540) % 360) - 180;
  const head = Math.round(windKt * Math.cos(diff * Math.PI / 180));
  const cross = Math.round(windKt * Math.sin(diff * Math.PI / 180));
  return { head, cross };
}
function bestRunway(airport) {
  let best = airport.runways[0];
  let bestHead = -999;
  airport.runways.forEach((r) => {
    const c = windComp(r, airport.weather.windDir, airport.weather.windKt);
    if (c.head > bestHead) { bestHead = c.head; best = r; }
  });
  const c = windComp(best, airport.weather.windDir, airport.weather.windKt);
  return { id: best.id, note: (c.head >= 0 ? c.head + " kt head" : Math.abs(c.head) + " kt tail") + " · " + Math.abs(c.cross) + " kt cross" };
}

function selectedAirport() {
  const f = state.flight;
  const icao = airportRole === "departure" ? f.departure : airportRole === "alternate" ? f.alternate : f.arrival;
  return AIRPORTS[icao] || AIRPORTS.VTBS;
}
function renderAirport() {
  const a = selectedAirport();
  document.getElementById("airport-info").replaceChildren(
    ...[
      ["ICAO", a.icao], ["IATA", a.iata], ["Name", a.name], ["Elevation", a.elevation + " ft"],
      ["Weather", a.weather.metar.split(" ").slice(2, 5).join(" ")], ["ATIS", "Letter not decoded"]
    ].map(([l, v]) => row(l, v))
  );
  const box = document.getElementById("runway-list");
  box.replaceChildren();
  a.runways.forEach((r) => {
    const c = windComp(r, a.weather.windDir, a.weather.windKt);
    const el = document.createElement("div");
    el.className = "row";
    const head = c.head >= 0 ? c.head + " kt head" : Math.abs(c.head) + " kt tail";
    el.innerHTML = `<span class="label runway-name"></span><span class="value secondary"></span>`;
    el.firstChild.textContent = r.id;
    el.lastChild.textContent = r.length + " m · " + r.surface + " · " + String(r.heading).padStart(3, "0") + " · " + head + " · " + Math.abs(c.cross) + " kt cross";
    box.appendChild(el);
  });
  document.getElementById("freq-list").replaceChildren(...a.freqs.map(([l, v]) => row(l, v)));
}
function renderWeather() {
  const a = selectedAirport();
  const w = a.weather;
  document.getElementById("metar-raw").textContent = w.metar;
  document.getElementById("taf-raw").textContent = w.taf;
  document.getElementById("weather-decoded").replaceChildren(...[
    ["Temperature", w.temp + " °C"], ["Dew point", w.dew + " °C"], ["Wind", w.windDir + " / " + w.windKt + " kt"],
    ["Visibility", w.vis], ["Clouds", w.clouds], ["QNH", String(w.qnh)], ["Trend", w.trend], ["ATIS", "Not available in V1"]
  ].map(([l, v]) => row(l, v)));
}

function seg(host, onPick) {
  host.replaceChildren();
  ["departure", "arrival", "alternate"].forEach((role) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = role[0].toUpperCase() + role.slice(1);
    b.setAttribute("aria-pressed", String(role === airportRole));
    b.addEventListener("click", () => { airportRole = role; seg(host, onPick); onPick(); });
    host.appendChild(b);
  });
}

function renderAircraft() {
  const host = document.getElementById("aircraft-sections");
  host.replaceChildren();
  const blocks = [["Limits", PROFILE.limits], ["Speeds", PROFILE.speeds], ["Weights", PROFILE.weights], ["Fuel", PROFILE.fuel]];
  blocks.forEach(([title, rows]) => {
    const k = document.createElement("div");
    k.className = "kicker";
    k.textContent = title;
    const g = document.createElement("div");
    g.className = "group";
    rows.forEach(([l, v]) => g.appendChild(row(l, v)));
    host.append(k, g);
  });
  const k = document.createElement("div");
  k.className = "kicker";
  k.textContent = "Checklist";
  const g = document.createElement("div");
  g.className = "group";
  g.style.padding = "4px 16px";
  const saved = JSON.parse(localStorage.getItem("rotaidem-check") || "{}");
  PROFILE.checklist.forEach((item, i) => {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!saved[i];
    input.addEventListener("change", () => {
      saved[i] = input.checked;
      localStorage.setItem("rotaidem-check", JSON.stringify(saved));
    });
    label.append(input, document.createTextNode(item));
    g.appendChild(label);
  });
  host.append(k, g);
}

function renderDocs(filter = "") {
  const list = document.getElementById("doc-list");
  const q = filter.toLowerCase();
  const items = DOCS.filter((d) => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q));
  list.replaceChildren();
  items.forEach((d, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = d.title;
    b.setAttribute("aria-current", String(i === 0 && !list.dataset.current ? true : list.dataset.current === d.id));
    b.addEventListener("click", () => { list.dataset.current = d.id; openDoc(d); renderDocs(filter); });
    list.appendChild(b);
  });
  const current = DOCS.find((d) => d.id === list.dataset.current) || items[0];
  if (current) openDoc(current);
}
function openDoc(d) {
  const reader = document.getElementById("doc-reader");
  reader.replaceChildren();
  const h = document.createElement("h3");
  h.textContent = d.title;
  reader.appendChild(h);
  d.body.split("\n").forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    reader.appendChild(p);
  });
}

function perfForm(kind) {
  const host = document.getElementById("perf-form");
  const airport = kind === "takeoff" ? state.flight.departure : state.flight.arrival;
  const fields = kind === "takeoff"
    ? [["Airport", airport], ["Runway", "01L"], ["Weight t", "64"], ["Wind", "220/12"], ["OAT", "9"], ["QNH", "1016"], ["Flaps", "1"], ["Packs", "On"], ["Anti-ice", "Off"], ["Condition", "Dry"]]
    : [["Weight t", "58"], ["Runway", "19R"], ["Wind", "140/08"], ["OAT", "33"], ["QNH", "1008"], ["Flaps", "Full"], ["Autobrake", "Med"], ["Condition", "Dry"]];
  host.className = "form-grid";
  host.replaceChildren();
  fields.forEach(([label, value]) => {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const span = document.createElement("span");
    span.textContent = label;
    const input = document.createElement("input");
    input.value = value;
    input.dataset.k = label;
    input.addEventListener("input", () => calcPerf(kind));
    wrap.append(span, input);
    host.appendChild(wrap);
  });
  calcPerf(kind);
}
function num(label) {
  const el = [...document.querySelectorAll("#perf-form input")].find((n) => n.dataset.k === label);
  return el ? el.value : "";
}
function calcPerf(kind) {
  const weight = parseFloat(kind === "takeoff" ? num("Weight t") : num("Weight t")) || 60;
  const oat = parseFloat(num("OAT")) || 15;
  const cond = num("Condition") || "Dry";
  const wet = /wet|contam/i.test(cond) ? 1.18 : 1;
  const host = document.getElementById("perf-results");
  if (kind === "takeoff") {
    const v1 = Math.round(128 + (weight - 60) * 1.4 + Math.max(0, oat - 15) * 0.4);
    const vr = v1 + 4;
    const v2 = vr + 5;
    const flex = Math.max(oat, Math.round(42 + (64 - weight)));
    const tod = Math.round((1500 + (weight - 55) * 45 + Math.max(0, oat - 15) * 18) * wet);
    host.replaceChildren(...[["V1", v1 + " kt"], ["VR", vr + " kt"], ["V2", v2 + " kt"], ["FLEX", flex + " °C"], ["Takeoff distance", tod + " m"]].map(([l, v]) => row(l, v)));
  } else {
    const vref = Math.round(126 + (weight - 55) * 1.3);
    const vapp = vref + 5;
    const ld = Math.round((1300 + (weight - 52) * 28) * wet);
    host.replaceChildren(...[["VREF", vref + " kt"], ["VAPP", vapp + " kt"], ["Landing distance", ld + " m"], ["Margin", "Not computed"]].map(([l, v]) => row(l, v)));
  }
}

function drawChart() {
  const canvas = document.getElementById("chart-canvas");
  const stage = document.getElementById("chart-stage");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = stage.clientWidth * dpr;
  canvas.height = stage.clientHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const dark = document.documentElement.dataset.theme === "dark";
  ctx.fillStyle = dark ? "#1c1c1e" : "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 + chart.x, h / 2 + chart.y);
  ctx.rotate(chart.rot * Math.PI / 180);
  ctx.scale(chart.zoom, chart.zoom);
  ctx.strokeStyle = dark ? "#d0d0d4" : "#1c1c1e";
  ctx.fillStyle = dark ? "#f2f2f7" : "#1c1c1e";
  ctx.lineWidth = 1.4;
  ctx.font = "13px -apple-system, Segoe UI, sans-serif";
  const type = document.getElementById("chart-type").value;
  const icao = document.getElementById("chart-airport").value;
  ctx.fillText(icao + "  " + type, -w / 2 + 28, -h / 2 + 36);
  if (type === "Approach") {
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(0, -40); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-70, 160); ctx.lineTo(0, 40); ctx.lineTo(70, 160); ctx.stroke();
    ctx.fillText("FAF  2 000", 12, 70);
    ctx.fillText("RWY", 12, 130);
    ctx.fillText("Missed  climb runway heading", 12, -70);
  } else if (type === "SID" || type === "STAR") {
    const pts = [[-180, 80], [-60, 20], [40, -30], [150, -90]];
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.stroke();
    pts.forEach((p, i) => ctx.fillText(type === "SID" ? ["RWY", "D120", "D250", "ENR"][i] : ["ENR", "BANKO", "IF", "RWY"][i], p[0] + 8, p[1] - 8));
  } else {
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(-40, -150); ctx.lineTo(20, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, -140); ctx.lineTo(110, 150); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "#8e8e93" : "#8e8e93";
    ctx.beginPath(); ctx.moveTo(-120, 40); ctx.lineTo(160, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-90, -20); ctx.lineTo(40, -40); ctx.stroke();
    ctx.fillStyle = dark ? "#f2f2f7" : "#1c1c1e";
    ctx.fillText("01L / 19R", -30, 8);
    ctx.fillText("01R / 19L", 70, 8);
    ctx.fillText("A", -130, 28);
    ctx.fillText("B", -100, -36);
  }
  ctx.restore();
}

function renderHistory() {
  const host = document.getElementById("history");
  const items = JSON.parse(localStorage.getItem("rotaidem-log") || "[]");
  if (!items.length) {
    host.innerHTML = '<div class="history-empty">No flights logged yet. A log is saved when the simulated flight parks after landing.</div>';
    return;
  }
  host.replaceChildren(...items.slice(0, 8).map((f) => row(f.date + "  " + f.callsign, f.departure + "–" + f.arrival + "  " + f.flightTime)));
}

function setLink(up, msfs, simulated) {
  document.body.dataset.link = up ? "up" : "down";
  document.getElementById("stale-text").textContent = up ? "MSFS not detected" : "Bridge disconnected";
  document.getElementById("pip-bridge").className = "pip " + (up ? "on" : "bad");
  document.getElementById("pip-msfs").className = "pip " + (simulated ? "wait" : msfs ? "on" : up ? "wait" : "bad");
  document.getElementById("side-bridge").textContent = up ? "Bridge connected" : "Bridge disconnected";
  document.getElementById("side-msfs").textContent = simulated ? "MSFS simulated" : msfs ? "MSFS connected" : "MSFS not detected";
  document.getElementById("set-bridge").textContent = up ? location.host : "Not connected";
}

function connect() {
  if (!token) return;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(proto + "://" + location.host + "/ws?token=" + encodeURIComponent(token));
  ws.onopen = () => setLink(true, false);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.protocolVersion) applyState(msg);
    const simulated = !!(msg.connection && msg.connection.simulated);
    setLink(true, !!(msg.connection && msg.connection.msfs), simulated);
  };
  ws.onclose = () => {
    setLink(false, false);
    setTimeout(connect, 1500);
  };
}

function show(screen) {
  document.querySelectorAll(".screen").forEach((el) => el.classList.toggle("active", el.id === "screen-" + screen));
  document.querySelectorAll("[data-screen]").forEach((el) => el.setAttribute("aria-current", el.dataset.screen === screen ? "page" : "false"));
  if (screen === "airport") renderAirport();
  if (screen === "weather") renderWeather();
  if (screen === "charts") drawChart();
  if (screen === "aircraft") renderAircraft();
  if (screen === "documents") renderDocs(document.getElementById("doc-search").value);
  if (screen === "settings") renderHistory();
  if (screen === "traffic") loadTraffic();
}

function applyTheme(mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.getElementById("theme-color").content = dark ? "#000000" : "#F2F2F7";
  if (document.getElementById("screen-charts").classList.contains("active")) drawChart();
}

function initNotes() {
  const notes = JSON.parse(localStorage.getItem("rotaidem-notes") || "{}");
  ["clearance", "atis", "squawk", "freq", "gate", "runway"].forEach((k) => {
    const el = document.getElementById("note-" + k);
    el.value = notes[k] || "";
    el.addEventListener("input", () => {
      notes[k] = el.value;
      localStorage.setItem("rotaidem-notes", JSON.stringify(notes));
    });
  });
  const scratch = document.getElementById("scratch");
  scratch.value = notes.scratch || "";
  scratch.addEventListener("input", () => {
    notes.scratch = scratch.value;
    localStorage.setItem("rotaidem-notes", JSON.stringify(notes));
  });
}

function initCharts() {
  const sel = document.getElementById("chart-airport");
  Object.keys(AIRPORTS).forEach((icao) => {
    const o = document.createElement("option");
    o.textContent = icao;
    sel.appendChild(o);
  });
  sel.value = "VTBS";
  ["chart-airport", "chart-type"].forEach((id) => document.getElementById(id).addEventListener("change", drawChart));
  document.getElementById("zoom-in").onclick = () => { chart.zoom = Math.min(3, chart.zoom + 0.2); drawChart(); };
  document.getElementById("zoom-out").onclick = () => { chart.zoom = Math.max(0.6, chart.zoom - 0.2); drawChart(); };
  document.getElementById("rotate-chart").onclick = () => { chart.rot = (chart.rot + 90) % 360; drawChart(); };
  document.getElementById("fav-chart").onclick = () => {
    const id = sel.value + ":" + document.getElementById("chart-type").value;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem("rotaidem-favs", JSON.stringify([...favorites]));
    document.getElementById("fav-chart").textContent = favorites.has(id) ? "Favorited" : "Favorite";
  };
  document.getElementById("full-chart").onclick = () => {
    document.getElementById("chart-stage").classList.toggle("full");
    drawChart();
  };
  const stage = document.getElementById("chart-stage");
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, ox: chart.x, oy: chart.y }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => {
    if (!drag) return;
    chart.x = drag.ox + e.clientX - drag.x;
    chart.y = drag.oy + e.clientY - drag.y;
    drawChart();
  });
  stage.addEventListener("pointerup", () => { drag = null; });
  window.addEventListener("resize", () => { if (document.getElementById("screen-charts").classList.contains("active")) drawChart(); });
}

function loadTraffic() {
  const q = new URLSearchParams({
    departure: state.flight.departure,
    arrival: state.flight.arrival,
    callsign: state.flight.callsign
  });
  fetch("/api/vatsim?" + q.toString())
    .then((res) => res.json())
    .then((data) => {
      const own = document.getElementById("vat-own");
      own.replaceChildren(data.own ? row(data.own.callsign, (data.own.departure || "—") + " → " + (data.own.arrival || "—") + "  " + (data.own.transponder || "")) : row("Callsign", "Not online on VATSIM"));
      const atc = document.getElementById("vat-atc");
      atc.replaceChildren(...((data.atc || []).length ? data.atc.map((c) => row(c.callsign, (c.frequency || "—") + (c.text ? "  " + c.text : ""))) : [row("ATC", "None online at these airports")]));
      const atis = document.getElementById("vat-atis");
      atis.replaceChildren(...((data.atis || []).length ? data.atis.map((a) => row(a.callsign, (a.code || "") + "  " + (a.text || ""))) : [row("ATIS", "No voice ATIS")]));
      const events = document.getElementById("vat-events");
      events.replaceChildren(...((data.events || []).length ? data.events.map((e) => row(e.name, (e.airports || []).join(" "))) : [row("Events", "None at these airports")]));
      if (data.error) own.appendChild(row("Feed", data.error));
    })
    .catch(() => {
      document.getElementById("vat-own").replaceChildren(row("VATSIM", "Bridge has no network feed"));
    });
}

function init() {
  document.getElementById("nav").addEventListener("click", (e) => {
    const b = e.target.closest("[data-screen]");
    if (b) show(b.dataset.screen);
  });
  document.querySelector(".settings-btn").addEventListener("click", () => show("settings"));
  seg(document.getElementById("airport-seg"), renderAirport);
  seg(document.getElementById("weather-seg"), renderWeather);
  document.getElementById("perf-seg").addEventListener("click", (e) => {
    const b = e.target.closest("[data-perf]");
    if (!b) return;
    document.querySelectorAll("#perf-seg button").forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
    perfForm(b.dataset.perf);
  });
  perfForm("takeoff");
  renderAircraft();
  renderDocs();
  document.getElementById("doc-search").addEventListener("input", (e) => renderDocs(e.target.value));
  initNotes();
  initCharts();
  renderHomeExtra();
  bindAll();
  const theme = localStorage.getItem("rotaidem-theme") || "system";
  document.getElementById("theme-select").value = theme;
  applyTheme(theme);
  document.getElementById("theme-select").addEventListener("change", (e) => {
    localStorage.setItem("rotaidem-theme", e.target.value);
    applyTheme(e.target.value);
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(localStorage.getItem("rotaidem-theme") || "system"));
  document.getElementById("forget").onclick = () => {
    localStorage.removeItem("rotaidem-token");
    token = "";
    if (ws) ws.close();
    document.getElementById("connect").classList.add("show");
  };
  const params = new URLSearchParams(location.search);
  if (params.get("pair")) {
    token = params.get("pair");
    localStorage.setItem("rotaidem-token", token);
    history.replaceState({}, "", "/");
  }
  document.getElementById("pair-btn").onclick = () => {
    token = document.getElementById("token-input").value.trim();
    if (!token) return;
    localStorage.setItem("rotaidem-token", token);
    document.getElementById("connect").classList.remove("show");
    connect();
  };
  if (!token) document.getElementById("connect").classList.add("show");
  else connect();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}
init();
