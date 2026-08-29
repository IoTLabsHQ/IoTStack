export interface BoardDef {
  id: string;
  label: string;
  /** Onboard LED pin used as a "board is alive" heartbeat in every generated sketch. */
  ledPin: number;
  ledActiveLow: boolean;
  /** Suggested GPIO for a sample's own I/O (relay/DHT11 data pin) — never collides with ledPin. */
  defaultGpio: number;
  /** The Arduino IDE "Tools > Partition Scheme" choice OTA relies on —
   * verified against the pinned esp32:esp32 core (3.3.10): this is already
   * the DEFAULT selection for every board below, so a first-time user
   * doesn't need to change anything. Recorded so the dashboard can warn if
   * someone previously switched to a no-OTA scheme (e.g. "Huge App"). */
  partitionSchemeLabel: string;
  /** Size of a single OTA app partition slot, in bytes — an uploaded
   * firmware must fit under this (with margin) or OTA can't flash it. */
  otaAppSlotBytes: number;
}

const DEFAULT_PARTITION_SCHEME = "Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)";
const DEFAULT_OTA_APP_SLOT_BYTES = 1_310_720;

export const BOARDS: BoardDef[] = [
  {
    id: "esp32-devkit-v1-30pin",
    label: "ESP32 DevKit V1 (30pin)",
    ledPin: 2,
    ledActiveLow: false,
    defaultGpio: 26,
    partitionSchemeLabel: DEFAULT_PARTITION_SCHEME,
    otaAppSlotBytes: DEFAULT_OTA_APP_SLOT_BYTES,
  },
  {
    id: "esp32-devkit-v1-38pin",
    label: "ESP32 DevKit V1 (38pin)",
    ledPin: 2,
    ledActiveLow: false,
    defaultGpio: 26,
    partitionSchemeLabel: DEFAULT_PARTITION_SCHEME,
    otaAppSlotBytes: DEFAULT_OTA_APP_SLOT_BYTES,
  },
  {
    id: "esp32-c3-supermini",
    label: "ESP32 C3 Supermini (tenstar robot)",
    ledPin: 8,
    ledActiveLow: true,
    defaultGpio: 4,
    partitionSchemeLabel: DEFAULT_PARTITION_SCHEME,
    otaAppSlotBytes: DEFAULT_OTA_APP_SLOT_BYTES,
  },
];
