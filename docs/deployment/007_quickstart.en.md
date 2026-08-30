# Quick Start

The fastest way to see IoTStack actually working: pick a sample project from the dashboard's home page, click through a short wizard, and end up with a real device you can view and control on the web — always over secure MQTT (MQTTS).

## Before you start — set a domain

Secure MQTT (port 8883) only works once your instance has a domain with a certificate — see [Security](../reference/002_security.en.md#transport-security). On the Settings page, set a domain and watch for its own "HTTPS is active for …" line — that's the real readiness signal, not just having typed a domain. Certificate issuance plus Mosquitto's own ~30 second cert-file poll mean "just saved" isn't necessarily "ready this second."

Every code path this feature generates (both the template wizard below and the [per-device Arduino code generator](/docs/reference/architecture)) refuses to produce anything until a domain is configured — there's no plain-MQTT fallback.

## Pick a project

From **Overview**, click **"Try a sample project"**. The first one available is **"Light control with ESP32"**: toggle the board's own onboard LED from the web, see its state live, and view temperature/humidity from a DHT11 — with a simulation mode, so a bare ESP32 board with nothing else attached is enough to try the whole thing.

Pick your board (the same 3 boards the Arduino code generator supports), and choose whether to simulate the DHT11 or use a real one.

## Create it

Click **Create**. A short wizard runs through:

1. Initializing the project
2. Creating the device and its controls
3. Confirming MQTT is ready (this is where it stops if no domain is set — go set one and come back)
4. Filling your device's real credentials into the Arduino code
5. Done

## Flash and go

Download the generated `.ino`, open it in the Arduino IDE, fill in your WiFi SSID/password, and flash it. Watch the Serial Monitor: WiFi connect → NTP time sync → MQTTS connect → telemetry/status publishing. Then open the device's **Control** page — the wizard already set it up with matching controls, so data and the LED toggle should be live as soon as the device connects.

## Troubleshooting

- **Create button disabled / "needs a domain" message**: set a domain on Settings first, and give it a minute for the certificate to actually be live.
- **Serial Monitor stuck on `rc=-4 (certificate verify failed)`**: the board's clock didn't sync via NTP (check outbound UDP/123 isn't blocked), or the cert on your domain hasn't propagated to Mosquitto yet (allow up to 30s after a domain/cert change).
- **Nothing shows up on the Control page**: check "Recent messages" on the device's own page first — if messages are arriving but the Control page is empty, the control's field name doesn't match what's actually in the payload.
