export type SampleId = "blink" | "relay" | "dht11";

export interface SampleDef {
  id: SampleId;
  title: string;
  description: string;
}

export const SAMPLES: SampleDef[] = [
  {
    id: "blink",
    title: "ESP32 Blink Led",
    description:
      "Blinks the onboard LED and pings the broker every 5s — the simplest way to confirm WiFi + MQTT both work.",
  },
  {
    id: "relay",
    title: "ESP32 Control Relay",
    description:
      'Turns a relay on/off from the dashboard\'s "Send a command" form and reports its state back over MQTT.',
  },
  {
    id: "dht11",
    title: "ESP32 Control DHT11 (ESP32 đọc cảm biến nhiệt độ)",
    description: "Reads temperature and humidity from a DHT11 sensor and publishes them as telemetry every 10s.",
  },
];
