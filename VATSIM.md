# VATSIM APIs

Official index: https://vatsim.dev/services/apis

The bridge calls the public feeds from `vatsim.py`. Core API and Connect need approval and are not called.

## Used by the EFB

These need no key. The bridge caches them for 20 seconds. The iPad reads `GET /api/vatsim?departure=ESSA&arrival=VTBS&callsign=SAS123`.

| Feed | Method and URL | EFB use |
| --- | --- | --- |
| Live network | `GET https://data.vatsim.net/v3/vatsim-data.json` | Pilots, flight plans, controllers, ATIS, servers. Regenerates every 15 seconds. |
| Audio clients | `GET https://data.vatsim.net/v3/transceivers-data.json` | Who is on voice, and transceiver positions. |
| Voice ATIS | `GET https://data.vatsim.net/v3/afv-atis-data.json` | Online ATIS stations. |
| METAR | `GET https://metar.vatsim.net/{icao}?format=json` | Weather page. Comma-separated ICAOs, a prefix, or `all`. |
| Events | `GET https://my.vatsim.net/api/v2/events/latest` | Events at departure or arrival. |
| Event by id | `GET https://my.vatsim.net/api/v2/events/{id}` | Event detail. |
| Event calendar | `GET https://my.vatsim.net/api/v2/events/export` | iCal export. |
| AIP airport | `GET https://my.vatsim.net/api/v2/aip/airports/{icao}` | Name, elevation, transition altitude, stations. |
| AIP stations | `GET https://my.vatsim.net/api/v2/aip/airports/{icao}/stations` | Frequencies and CTAF flag. |

`vatsim-data.json` fields used: `general`, `pilots` (callsign, position, altitude, groundspeed, transponder, flight_plan), `controllers` (callsign, frequency, facility, text_atis), `atis` (callsign, atis_code, text_atis).

## Not called

| API | Base | Why it is later |
| --- | --- | --- |
| Core API | `https://api.vatsim.net/v2` | Member, rating, division, and roster data. Header `X-API-Key`. Public access is anonymized. Org roster needs a division key. |
| Connect | `https://auth.vatsim.net` | OAuth login for VATSIM organizations and approved apps. Not required to read the public feeds. |
| Status | `https://status.vatsim.net` | Network status page, not a flight-data feed. |

Docs: https://vatsim.dev/api/data-api/ · https://vatsim.dev/api/metar-api/get-metar/ · https://vatsim.dev/api/events-api/list-all-events · https://vatsim.dev/api/aip-api/get-airport/ · https://vatsim.dev/api/core-api/ · https://vatsim.dev/api/connect-api/
