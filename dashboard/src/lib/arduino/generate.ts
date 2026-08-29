import type { BoardDef } from "./boards";
import type { SampleId } from "./samples";
import { SAMPLES } from "./samples";
import type { CredentialInfo } from "../credentialExport";

export interface GenerateSketchInput {
  board: BoardDef;
  sample: SampleId;
  device: CredentialInfo;
  mqttHost: string;
  /** Baked into FIRMWARE_VERSION — reported in the boot event and, after an
   * OTA update, as the "to" version in firmware.updated. */
  firmwareVersion: string;
}

// ISRG Root X1 (Let's Encrypt) — every IoTStack MQTTS cert chains to this
// root. Embedded verbatim (fetched + openssl-verified from
// https://letsencrypt.org/certs/isrgrootx1.pem); a device has no other way
// to obtain a CA bundle before its first-ever TLS handshake.
// Valid 2015-06-04 to 2035-06-04.
const ROOT_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----`;

function sanitizeForComment(s: string): string {
  return s.replace(/\*\//g, "* /").replace(/[\r\n]+/g, " ");
}

/** Embeds a user-supplied string as a C string literal body — escapes `\`
 * and `"` and strips newlines, so a firmware version like `1.0"; while(1);
 * //` can't break out of the literal in the generated .ino. */
function sanitizeForCString(s: string): string {
  return s.replace(/[\r\n]+/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function requiredLibraries(sample: SampleId): string {
  const base = ['    - "PubSubClient" by Nick O\'Leary', '    - "ArduinoJson" by Benoit Blanchon'];
  if (sample === "dht11") {
    return [
      ...base,
      '    - "DHT sensor library" by Adafruit',
      '    - "Adafruit Unified Sensor" by Adafruit',
    ].join("\n");
  }
  return base.join("\n");
}

function heartbeatNote(board: BoardDef): string {
  if (board.id !== "esp32-c3-supermini") return "";
  return `
  // NOTE: some ESP32-C3 SuperMini clones wire the onboard LED the
  // opposite way round depending on the seller/batch. If it stays lit
  // while "off" and dark while blinking, swap HEARTBEAT_LED_ON/OFF below.`;
}

function sampleGlobals(sample: SampleId, board: BoardDef): string {
  if (sample === "relay") {
    return `
#define RELAY_PIN ${board.defaultGpio}
#define RELAY_ACTIVE_LOW false // set true if your relay module triggers on LOW
#define RELAY_TARGET_NAME "relay_1" // must match "Target" in the dashboard's "Send a command" form
bool relayState = false;`;
  }
  if (sample === "dht11") {
    return `
// Wiring: DHT11 data pin -> DHT_PIN, VCC -> 3.3V, GND -> GND.
// If your DHT11 module has no built-in pull-up, add a 10k resistor
// between the data pin and 3.3V.
#define DHT_PIN ${board.defaultGpio}
#define DHT_TYPE DHT11
DHT dht(DHT_PIN, DHT_TYPE);
const unsigned long TELEMETRY_INTERVAL_MS = 10000;
unsigned long lastTelemetry = 0;`;
  }
  return "";
}

function sampleSetupExtra(sample: SampleId): string {
  if (sample === "relay") {
    return `  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
`;
  }
  if (sample === "dht11") {
    return `  dht.begin();
`;
  }
  return "";
}

function sampleCallback(sample: SampleId): string {
  if (sample !== "relay") return "";
  return `
void applyRelay(bool on) {
  relayState = on;
  bool pinHigh = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(RELAY_PIN, pinHigh ? HIGH : LOW);
  char payload[64];
  snprintf(payload, sizeof(payload), "{\\"target\\":\\"%s\\",\\"state\\":%s}", RELAY_TARGET_NAME, on ? "true" : "false");
  mqtt.publish(TOPIC_STATUS, payload);
  Serial.println(payload);
}
`;
}

// Every sample subscribes to TOPIC_CMD and gets a real JSON-parsed command
// dispatch (not just "relay") so future commands (e.g. an OTA trigger) have
// one shared entry point regardless of which sample is flashed.
function mqttCallbackBody(sample: SampleId): string {
  const setHandler =
    sample === "relay"
      ? `  if (strcmp(command, "set") == 0 && strcmp(data["target"] | "", RELAY_TARGET_NAME) == 0) {
    applyRelay(data["value"] | false);
    return;
  }`
      : `  // this sample has no controllable target — a "set" command lands
  // here as a no-op`;

  return `
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String body;
  body.reserve(length);
  for (unsigned int i = 0; i < length; i++) body += (char)payload[i];
  Serial.print("Received on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(body);

  // Expected envelope (what the dashboard's "Send a command" form, ota.routes.ts,
  // and every other command source all publish): {"command":"...","request_id":"...","data":{...}}
  StaticJsonDocument<768> doc;
  DeserializationError parseErr = deserializeJson(doc, body);
  if (parseErr) {
    Serial.print("Command JSON parse failed: ");
    Serial.println(parseErr.c_str());
    return;
  }
  const char* command = doc["command"];
  if (command == nullptr) return;
  const char* requestId = doc["request_id"] | "";
  JsonObject data = doc["data"];

  if (strcmp(command, "ota.start") == 0) {
    handleOtaStart(requestId, data);
    return;
  }

${setHandler}
}
`;
}

function sampleLoopBody(sample: SampleId): string {
  if (sample === "dht11") {
    return `
  // ---- Sample: read DHT11 and publish telemetry ----
  if (millis() - lastTelemetry >= TELEMETRY_INTERVAL_MS) {
    lastTelemetry = millis();
    float humidity = dht.readHumidity();
    float tempC = dht.readTemperature();
    if (isnan(humidity) || isnan(tempC)) {
      Serial.println("DHT11 read failed - check wiring/pin.");
    } else {
      char payload[96];
      snprintf(payload, sizeof(payload), "{\\"temperature_c\\":%.1f,\\"humidity_pct\\":%.1f}", tempC, humidity);
      mqtt.publish(TOPIC_TELEMETRY, payload);
      Serial.println(payload);
    }
  }
`;
  }
  // blink/relay: nothing extra beyond the universal heartbeat/ping above —
  // relay's state changes are driven entirely by the mqtt callback via mqtt.loop()
  return "";
}

export function generateSketch({ board, sample, device, mqttHost, firmwareVersion }: GenerateSketchInput): string {
  const sampleDef = SAMPLES.find((s) => s.id === sample)!;
  const clientId = device.clientId;
  const isRelay = sample === "relay";

  return `/*
  Generated by the IoTStack dashboard
  Sample: ${sampleDef.title}
  Board:  ${board.label}
  Device: ${sanitizeForComment(device.displayName)} (client_id: ${clientId})
  Generated: ${new Date().toISOString()}

  ------------------------------------------------------------------
  REQUIRED LIBRARIES (Arduino IDE > Tools > Manage Libraries):
${requiredLibraries(sample)}
  (TLS support — WiFiClientSecure, configTime — is built into the ESP32
  Arduino core, no extra library needed.)
  ------------------------------------------------------------------
  BEFORE UPLOADING:
    1. Fill in your WiFi SSID and password below.
    2. MQTT_HOST defaults to your IoTStack instance's configured domain
       (${mqttHost}) — this MUST be a real domain with a valid cert, not
       an IP, or the TLS handshake below will fail. Change it only if
       this device will reach the broker through a different domain.
    3. Client ID / username / password below are already filled in for
       THIS device - don't reuse them on another device.
    4. This device also needs outbound access to UDP/123 (NTP) in
       addition to TCP/8883 (MQTTS) — both are needed before the first
       successful connection.
  ------------------------------------------------------------------
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include "esp_ota_ops.h"
${sample === "dht11" ? "#include <DHT.h>\n" : ""}
// ---- Firmware version (bumped each time you regenerate for a new OTA
// release) — reported on boot and as the "to" version after an OTA update. ----
#define FIRMWARE_VERSION "${sanitizeForCString(firmwareVersion)}"

// ---- WiFi ----
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ---- MQTT broker (MQTTS/TLS only — IoTStack devices never use plain MQTT) ----
const char* MQTT_HOST = "${mqttHost}";
const uint16_t MQTT_PORT = 8883;

// ISRG Root X1 (Let's Encrypt) — every IoTStack MQTTS cert chains to
// this. Embedded as a raw string literal so the base64 body doesn't need
// manual "\\n"-per-line escaping (error-prone to hand-generate and easy to
// silently truncate).
const char* ROOT_CA = R"EOF(
${ROOT_CA_PEM}
)EOF";

// ---- Device credentials (generated for this device - keep private) ----
const char* MQTT_CLIENT_ID = "${clientId}";
const char* MQTT_USERNAME  = "${device.mqttUsername}";
const char* MQTT_PASSWORD  = "${device.password}";

// ---- Topics ----
const char* TOPIC_TELEMETRY = "devices/${clientId}/telemetry";
const char* TOPIC_CMD       = "devices/${clientId}/cmd";
const char* TOPIC_STATUS    = "devices/${clientId}/status";
const char* TOPIC_EVENT     = "devices/${clientId}/event";
const char* TOPIC_PING      = "devices/${clientId}/ping";

// ---- Heartbeat LED (present on every generated sketch) ----
// Blinks the onboard LED once a second so you can tell at a glance the
// board is powered and the main loop is running, even without opening
// Serial Monitor (it will freeze here if setup() gets stuck, e.g. bad
// WiFi credentials).
#define HEARTBEAT_LED_PIN ${board.ledPin}
#define HEARTBEAT_LED_ON  ${board.ledActiveLow ? "LOW" : "HIGH"}
#define HEARTBEAT_LED_OFF ${board.ledActiveLow ? "HIGH" : "LOW"}${heartbeatNote(board)}
const unsigned long HEARTBEAT_INTERVAL_MS = 1000;
unsigned long heartbeatLastToggle = 0;
bool heartbeatLedOn = false;

// ---- Application-level heartbeat over MQTT (PRD §11/§29) — not MQTT
// PINGREQ, not the heartbeat LED above. Proves the full WiFi+MQTT path
// works end-to-end; watch it under "Recent messages" on this device's page.
const unsigned long PING_INTERVAL_MS = 5000;
unsigned long lastPing = 0;

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);

// ---- OTA (firmware update) ----
Preferences otaPrefs;
// Set from NVS in setup() when the PREVIOUS boot just flashed new firmware
// and is waiting to confirm it works — see attemptBoundedOtaConfirmation()
// and the firmware.updated publish in reconnectMQTT() below.
bool otaConfirmPending = false;
String otaFromVersion;
String otaRequestId;
${sampleGlobals(sample, board)}

void connectWiFi() {
  Serial.print("Connecting to WiFi \\"");
  Serial.print(WIFI_SSID);
  Serial.println("\\"...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.print("\\nWiFi connected, IP: ");
  Serial.println(WiFi.localIP());
}

void syncTime() {
  // TLS certificate-validity checking needs a roughly-correct clock —
  // an ESP32 has no battery-backed RTC and boots at ~1970, which makes
  // every cert look "not yet valid" until this runs. gmtOffset/
  // daylightOffset are both 0 on purpose: only a correct moment in time
  // matters here, not a correct timezone.
  Serial.print("Syncing time via NTP");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  time_t now = time(nullptr);
  while (now < 8 * 3600 * 2) {
    delay(300);
    Serial.print(".");
    now = time(nullptr);
  }
  Serial.println(" done.");
}

// ---- OTA handling ----

void publishOtaStatus(const char* requestId, const char* state) {
  char payload[160];
  snprintf(payload, sizeof(payload), "{\\"ota\\":{\\"request_id\\":\\"%s\\",\\"state\\":\\"%s\\"}}", requestId, state);
  mqtt.publish(TOPIC_STATUS, payload);
  Serial.println(payload);
}

void publishOtaFailedEvent(const char* requestId, const char* reason) {
  char payload[224];
  snprintf(
    payload, sizeof(payload),
    "{\\"type\\":\\"firmware.update_failed\\",\\"data\\":{\\"reason\\":\\"%s\\",\\"request_id\\":\\"%s\\"}}",
    reason, requestId
  );
  mqtt.publish(TOPIC_EVENT, payload);
  Serial.println(payload);
}

// Handles {"command":"ota.start","request_id":"...","data":{"version","download_url","size_bytes","md5"}}.
// Delivered over MQTT, but the firmware binary itself is fetched over a
// direct HTTPS download (device→server), never through MQTT — the broker's
// per-message bounds are sized for small JSON, not multi-hundred-KB binaries.
void handleOtaStart(const char* requestId, JsonObject data) {
  // Runtime guard, not just a compile-time assumption: refuses to attempt a
  // flash if this board's currently-selected Partition Scheme has no second
  // OTA app slot (e.g. someone previously chose "Huge App (No OTA)").
  if (esp_ota_get_next_update_partition(NULL) == NULL) {
    publishOtaFailedEvent(requestId, "no_ota_partition");
    return;
  }

  const char* url = data["download_url"];
  if (url == nullptr) {
    publishOtaFailedEvent(requestId, "missing_download_url");
    return;
  }

  publishOtaStatus(requestId, "downloading");

  WiFiClientSecure otaClient;
  otaClient.setCACert(ROOT_CA);
  // We do our own bookkeeping (NVS flag + status publish) between a
  // successful flash and the reboot, so HTTPUpdate must not reboot for us.
  httpUpdate.rebootOnUpdate(false);

  // NOTE: HTTPUpdate::update() blocks for the whole download+flash — mqtt.loop()
  // isn't serviced during that window, so ota.cancel can't be received or
  // acted on mid-transfer (the server already accounts for this — see
  // ota.routes.ts). A long download can also exceed the MQTT keepalive if
  // it's slow enough to disconnect the broker session; that's a known,
  // accepted tradeoff of triggering OTA over the same MQTT connection used
  // for everything else, not something this generator works around.
  publishOtaStatus(requestId, "flashing");
  t_httpUpdate_return ret = httpUpdate.update(otaClient, url);

  if (ret == HTTP_UPDATE_OK) {
    // x-MD5 verification already happened inside httpUpdate.update() itself
    // (it reads the response header and calls Update.setMD5() automatically)
    // — reaching HTTP_UPDATE_OK means the image passed that check.
    otaPrefs.begin("ota", false);
    otaPrefs.putBool("pending", true);
    otaPrefs.putString("from_ver", FIRMWARE_VERSION);
    otaPrefs.putString("req_id", requestId);
    otaPrefs.end();
    publishOtaStatus(requestId, "flash_ok");
    delay(200); // let the publish above actually leave the socket before it goes away
    ESP.restart();
  } else {
    char reason[64];
    snprintf(reason, sizeof(reason), "http_update_failed_%d", (int)ret);
    publishOtaFailedEvent(requestId, reason);
  }
}

// Bounded self-check after an OTA reboot (PRD-adjacent safety net, not part
// of the base spec): a bad image that can't even reach WiFi must not hang
// forever the way a normal cold boot's infinite connectWiFi() retry would.
// Deliberately checks ONLY WiFi within the deadline, not the full MQTT
// handshake — MQTT_HOST/ROOT_CA/credentials don't change between OTA
// versions the way application code does, so a WiFi-reachable image that
// can't reach the broker is a much rarer failure mode than one that can't
// even associate; the normal (infinite-retry) reconnectMQTT() below still
// runs afterwards for that remaining case, matching existing boot behavior.
void attemptBoundedOtaConfirmation() {
  const unsigned long deadline = millis() + 60000;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (millis() < deadline) {
    if (WiFi.status() == WL_CONNECTED) return; // confirmed — normal setup() continues below
    delay(300);
  }

  Serial.println("OTA confirmation failed (no WiFi within 60s) - rolling back.");
  const esp_partition_t* previous = esp_ota_get_next_update_partition(NULL);
  if (previous != NULL) esp_ota_set_boot_partition(previous);
  ESP.restart();
}
${sampleCallback(sample)}${mqttCallbackBody(sample)}
void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT broker ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.println(" (TLS)...");
    // Last Will and Testament (PRD §30): registered here, at CONNECT time —
    // the broker publishes it on our behalf on an ungraceful disconnect
    // (network drop, power loss), never on a clean one we trigger ourselves.
    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD, TOPIC_EVENT, 1, false, "{\\"type\\":\\"network.disconnected\\"}")) {
      Serial.println("MQTT connected.");
      mqtt.subscribe(TOPIC_CMD);
      mqtt.publish(TOPIC_EVENT, "{\\"type\\":\\"boot\\"}");
${isRelay ? "      applyRelay(relayState); // report actual current state right after boot (PRD §12)\n" : ""}
      if (otaConfirmPending) {
        char payload[224];
        snprintf(
          payload, sizeof(payload),
          "{\\"type\\":\\"firmware.updated\\",\\"data\\":{\\"from\\":\\"%s\\",\\"to\\":\\"%s\\",\\"request_id\\":\\"%s\\"}}",
          otaFromVersion.c_str(), FIRMWARE_VERSION, otaRequestId.c_str()
        );
        mqtt.publish(TOPIC_EVENT, payload);
        Serial.println(payload);
        otaPrefs.begin("ota", false);
        otaPrefs.clear();
        otaPrefs.end();
        otaConfirmPending = false;
      }
    } else {
      char errBuf[128];
      wifiClient.lastError(errBuf, sizeof(errBuf));
      Serial.print("MQTT connect failed, rc=");
      Serial.print(mqtt.state());
      Serial.print(" (");
      Serial.print(errBuf);
      Serial.println(") - retrying in 2s");
      delay(2000);
    }
  }
}

// Non-blocking: toggles the LED by timestamp instead of delay(), so it
// keeps blinking evenly while WiFi/MQTT work happens in the same loop().
void updateHeartbeat() {
  unsigned long now = millis();
  if (now - heartbeatLastToggle >= HEARTBEAT_INTERVAL_MS) {
    heartbeatLastToggle = now;
    heartbeatLedOn = !heartbeatLedOn;
    digitalWrite(HEARTBEAT_LED_PIN, heartbeatLedOn ? HEARTBEAT_LED_ON : HEARTBEAT_LED_OFF);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(HEARTBEAT_LED_PIN, OUTPUT);
  digitalWrite(HEARTBEAT_LED_PIN, HEARTBEAT_LED_OFF);

${sampleSetupExtra(sample)}
  otaPrefs.begin("ota", true);
  otaConfirmPending = otaPrefs.getBool("pending", false);
  otaFromVersion = otaPrefs.getString("from_ver", "");
  otaRequestId = otaPrefs.getString("req_id", "");
  otaPrefs.end();
  // Bounded self-check right after an OTA reboot — rolls back and never
  // returns if this image can't even reach WiFi within 60s. A normal boot
  // (otaConfirmPending false) skips straight to the usual infinite-retry
  // connectWiFi() below, unchanged.
  if (otaConfirmPending) attemptBoundedOtaConfirmation();

  connectWiFi();
  syncTime();
  wifiClient.setCACert(ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  reconnectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) reconnectMQTT();
  mqtt.loop();

  updateHeartbeat();

  if (millis() - lastPing >= PING_INTERVAL_MS) {
    lastPing = millis();
    mqtt.publish(TOPIC_PING, "{}");
    Serial.println("Published ping");
  }
${sampleLoopBody(sample)}}
`;
}
