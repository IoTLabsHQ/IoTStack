export interface BoardDef {
  id: string;
  label: string;
  /** Onboard LED pin used as a "board is alive" heartbeat in every generated sketch. */
  ledPin: number;
  ledActiveLow: boolean;
  /** Suggested GPIO for a sample's own I/O (relay/DHT11 data pin) — never collides with ledPin. */
  defaultGpio: number;
}

export const BOARDS: BoardDef[] = [
  {
    id: "esp32-devkit-v1-30pin",
    label: "ESP32 DevKit V1 (30pin)",
    ledPin: 2,
    ledActiveLow: false,
    defaultGpio: 26,
  },
  {
    id: "esp32-devkit-v1-38pin",
    label: "ESP32 DevKit V1 (38pin)",
    ledPin: 2,
    ledActiveLow: false,
    defaultGpio: 26,
  },
  {
    id: "esp32-c3-supermini",
    label: "ESP32 C3 Supermini (tenstar robot)",
    ledPin: 8,
    ledActiveLow: true,
    defaultGpio: 4,
  },
];
