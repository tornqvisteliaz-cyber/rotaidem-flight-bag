# Rotaidem Flight Bag

External electronic flight bag for Microsoft Flight Simulator 2024.

The iPad app is the product. The PC bridge is infrastructure: it serves the EFB, pairs the tablet, and streams flight state over the local network.

Start here: [START.md](START.md).

```bash
pip install -r requirements.txt
python3 bridge.py
```

PC window: `http://<lan-ip>:8080/bridge`  
iPad: scan the QR code, then Share → Add to Home Screen.

## This prototype

SimConnect is not linked here. `SimulatedProvider` flies a time-compressed ESSA → VTBS sector so the EFB can be used without the simulator. The bridge page can force a phase.

Protocol version is 1. A Windows build would replace the provider with a SimConnect adapter without changing the iPad app.

Performance figures are profile estimates. They are not validated against the Fenix or Airbus documentation.

VATSIM public feeds are in [VATSIM.md](VATSIM.md). The Traffic screen reads them through `GET /api/vatsim`. Core API and Connect are not called.

## Version 1 screens

Home, Flight, Airport, Weather, Charts, Notes, Settings, Traffic. Performance, Aircraft, and Documents are usable shells. Real chart files and validated aircraft performance are later versions.

