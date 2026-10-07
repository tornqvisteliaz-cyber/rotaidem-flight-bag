# Start Rotaidem

The PC runs the bridge. The iPad only opens a page. No install on the iPad.

## 1. Get the code

```bash
git clone https://github.com/tornqvisteliaz-cyber/rotaidem-flight-bag.git
cd rotaidem-flight-bag
```

Python 3.10 or newer is enough. The only extra package is the QR code library.

```bash
pip install qrcode
```

## 2. Start the bridge

```bash
python3 bridge.py
```

Leave that window open. It prints two addresses:

- PC window: `http://<your-lan-ip>:8080/bridge`
- iPad: `http://<your-lan-ip>:8080/?pair=<token>`

The PC and the iPad must be on the same Wi-Fi. Do not forward port 8080 to the internet.

## 3. Open the PC window

Open the `/bridge` address in a browser on the flight simulator PC.

You should see:

- MSFS 2024: Not detected, until a SimConnect build is added
- EFB Server: Running
- iPad: Waiting
- A QR code and the address

The Settings section can force a demo phase: Cruise, Descent, Approach, Parked.

## 4. Connect the iPad

1. Open the Camera app and scan the QR code.
2. Safari opens the EFB.
3. Tap Share, then Add to Home Screen.
4. Open Rotaidem from the home screen after that. Safari's address bar stays hidden.

The pairing token is stored on the iPad. Next time, open the home-screen icon. You do not scan again unless you tap Forget this bridge.

## 5. Fly

The current build streams a simulated ESSA to VTBS flight so the tablet works without MSFS. Live figures update over the WebSocket. Notes, documents, and settings stay on the iPad if the bridge drops.

A later Windows build replaces `SimulatedProvider` in `bridge.py` with SimConnect. The iPad app does not change.

## If it does not connect

- Same Wi-Fi, not guest Wi-Fi isolation.
- Windows firewall must allow Python on private networks.
- Use the address printed by the bridge, not `127.0.0.1`, on the iPad.
- Token mismatch: scan the QR code again.
