export interface CredentialInfo {
  displayName: string;
  clientId: string;
  mqttUsername: string;
  password: string;
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCredentialText(c: CredentialInfo, host: string): string {
  return [
    `Device: ${c.displayName}`,
    `Client ID: ${c.clientId}`,
    `Username: ${c.mqttUsername}`,
    `Password: ${c.password}`,
    `Host: ${host}`,
    `Port: 8883 (MQTTS)`,
    `Publish topics: devices/${c.clientId}/{telemetry,status,event,ping}`,
    `Subscribe topic: devices/${c.clientId}/cmd`,
  ].join("\n");
}

export function buildCredentialCsv(c: CredentialInfo, host: string): string {
  const rows: [string, string][] = [
    ["Device Name", c.displayName],
    ["Client ID", c.clientId],
    ["Username", c.mqttUsername],
    ["Password", c.password],
    ["Host", host],
    ["Port", "8883 (MQTTS)"],
    ["Publish Topics", `devices/${c.clientId}/{telemetry,status,event,ping}`],
    ["Subscribe Topic", `devices/${c.clientId}/cmd`],
    ["Generated At", new Date().toISOString()],
  ];
  return ["Field,Value", ...rows.map(([f, v]) => `${csvEscape(f)},${csvEscape(v)}`)].join("\n");
}
