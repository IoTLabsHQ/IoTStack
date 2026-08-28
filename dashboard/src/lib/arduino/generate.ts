import type { BoardDef } from "./boards";
import type { SampleId } from "./samples";
import { SAMPLES } from "./samples";
import type { CredentialInfo } from "../credentialExport";

export interface GenerateSketchInput {
  board: BoardDef;
  sample: SampleId;
  device: CredentialInfo;
  mqttHost: string;
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

function requiredLibraries(sample: SampleId): string {
  const base = '    - "PubSubClient" by Nick O\'Leary';
  if (sample === "dht11") {
    return [
      base,
      '    - "DHT sensor library" by Adafruit',
      '    - "Adafruit Unified Sensor" by Adafruit',
    ].join("\n");
  }
  return base;
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

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String body;
  body.reserve(length);
  for (unsigned int i = 0; i < length; i++) body += (char)payload[i];
  Serial.print("Received on ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(body);

  // Expected payload (exactly what the dashboard's "Send a command" form
  // sends): {"target":"relay_1","command":"set","value":true}
  // A tiny hand-rolled check is used here to avoid pulling in a JSON
  // library for one field — swap in ArduinoJson if you need more.
  if (body.indexOf("\\"target\\":\\"" RELAY_TARGET_NAME "\\"") == -1) return;
  if (body.indexOf("\\"command\\":\\"set\\"") == -1) return;
  applyRelay(body.indexOf("\\"value\\":true") != -1);
}
`;
}

function sampleLoopBody(sample: SampleId): string {
  if (sample === "blink") {
    return `
  // ---- Sample: periodic "still alive" ping over MQTT ----
  // The LED above already blinks locally; this additionally proves the
  // full WiFi + MQTT path works end-to-end. Watch it appear under
  // "Recent messages" on this device's page in the dashboard.
  static unsigned long lastPing = 0;
  if (millis() - lastPing >= 5000) {
    lastPing = millis();
    mqtt.publish(TOPIC_PING, "{}");
    Serial.println("Published ping");
  }
`;
  }
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
  // relay: state changes are driven entirely by the mqtt callback via mqtt.loop()
  return "";
}

export function generateSketch({ board, sample, device, mqttHost }: GenerateSketchInput): string {
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
${sample === "dht11" ? "#include <DHT.h>\n" : ""}
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

WiFiClientSecure wifiClient;
PubSubClient mqtt(wifiClient);
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
${sampleCallback(sample)}
void reconnectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT broker ");
    Serial.print(MQTT_HOST);
    Serial.print(":");
    Serial.print(MQTT_PORT);
    Serial.println(" (TLS)...");
    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD)) {
      Serial.println("MQTT connected.");
${isRelay ? "      mqtt.subscribe(TOPIC_CMD);\n" : ""}      mqtt.publish(TOPIC_PING, "{\\"event\\":\\"boot\\"}");
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

${sampleSetupExtra(sample)}  connectWiFi();
  syncTime();
  wifiClient.setCACert(ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
${isRelay ? "  mqtt.setCallback(mqttCallback);\n" : ""}  reconnectMQTT();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) reconnectMQTT();
  mqtt.loop();

  updateHeartbeat();
${sampleLoopBody(sample)}}
`;
}
