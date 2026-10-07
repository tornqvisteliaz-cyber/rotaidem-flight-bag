# FlightSim EFB

iPad electronic flight bag for Microsoft Flight Simulator 2024. The iPad talks only to the PC bridge. The bridge talks to SimConnect, Aviation Weather Center, VATSIM, and SimBrief.

.NET is not installed in this environment, so the runnable bridge is `bridge/server.py`. It uses the same versioned WebSocket protocol as the Windows host in `windows/FlightSimBridge`. SimConnect itself needs the MSFS 2024 SDK on Windows.

## Start

```bash
cd flightsim-efb
npm install
npm run build
python3 bridge/server.py
```

Open the printed address on the iPad, then Share → Add to Home Screen. The PC and iPad must be on the same Wi-Fi. Do not expose port 8080.

Import a SimBrief plan from Settings with a Pilot ID or username. Weather comes from `https://aviationweather.gov/api/data/metar` and `taf`. VATSIM comes from `https://data.vatsim.net/v3/vatsim-data.json`. Charts are schematic until a licensed provider or a user PDF is added.

## Protocol

Messages are `{ protocolVersion, type, timestamp, data }`. Types: `connection.status`, `flight.state`, `flight.plan.updated`, `weather.updated`, `vatsim.updated`. The iPad never sees raw SimVar names.
