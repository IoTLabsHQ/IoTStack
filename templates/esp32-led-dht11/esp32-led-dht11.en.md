# Light control with ESP32

Turn an ESP32 board's own LED on and off from the web, see its state live, and watch temperature/humidity readings arrive — all over secure MQTT (MQTTS). Works with just a bare ESP32 board; a real DHT11 sensor is optional.

## Features

- **Turn the LED on/off** — uses the board's own onboard LED, no extra wiring needed.
- **See the LED's state** — reflects the real state reported back by the device, not just what you last clicked.
- **See temperature/humidity from a DHT11** — with a simulation mode if you don't have a real sensor yet, so you can try the whole flow with nothing but the board itself.

## Hardware

| Item | Required? |
|---|---|
| ESP32 dev board (any supported board) | Yes |
| DHT11 temperature/humidity sensor | No — leave "Simulate DHT11" on to skip it |

## Wiring (only if using a real DHT11)

If you switch off DHT11 simulation, wire a real sensor:

- DHT11 `VCC` → board `3.3V`
- DHT11 `GND` → board `GND`
- DHT11 `DATA` → the board's data pin (shown on the generated code)

If your DHT11 module has no built-in pull-up resistor, add a 10kΩ resistor between `DATA` and `3.3V`.

No wiring is needed for the LED — it's the board's own onboard LED.
