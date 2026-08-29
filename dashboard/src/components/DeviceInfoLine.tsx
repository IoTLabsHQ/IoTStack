import type { Message } from "../lib/api/devices";
import { extractDeviceInfo } from "../lib/control-values";
import { formatExactTimeVi, formatRelativeTimeVi } from "../lib/relativeTime";

/**
 * Firmware version / WiFi RSSI, read live from the device's own message
 * feed — only rendered when the device's firmware actually sends them
 * (see extractDeviceInfo), never a placeholder for firmware that doesn't.
 */
export function DeviceInfoLine({ messages }: { messages: Message[] }) {
  const info = extractDeviceInfo(messages);
  if (info.firmwareVersion === null && info.wifiRssi === null) return null;

  const asOfText = info.asOf ? formatRelativeTimeVi(info.asOf).text : null;
  const asOfExact = info.asOf ? formatExactTimeVi(info.asOf) : undefined;

  const parts: string[] = [];
  if (info.firmwareVersion !== null) parts.push(`Firmware ${info.firmwareVersion}`);
  if (info.wifiRssi !== null) parts.push(`RSSI ${info.wifiRssi} dBm`);
  if (asOfText) parts.push(asOfText);

  return (
    <p className="mt-1 text-xs text-slate-500" data-testid="device-info-line" title={asOfExact}>
      {parts.join(" · ")}
    </p>
  );
}
