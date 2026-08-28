import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BOARDS } from "../lib/arduino/boards";
import { SAMPLES, type SampleId } from "../lib/arduino/samples";
import { generateSketch } from "../lib/arduino/generate";
import { triggerDownload } from "../lib/download";
import type { CredentialInfo } from "../lib/credentialExport";
import { getSettings } from "../lib/api/settings";

export function ArduinoCodeSection({
  credential,
  hasRealPassword = true,
}: {
  credential: CredentialInfo;
  /** false when `credential.password` is a placeholder, not the device's real one (the API never returns it again after creation/regeneration). */
  hasRealPassword?: boolean;
}) {
  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [sampleId, setSampleId] = useState<SampleId>(SAMPLES[0].id);
  const selectedSample = SAMPLES.find((s) => s.id === sampleId)!;
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const domain = settings?.domain ?? "";

  function handleDownload() {
    const board = BOARDS.find((b) => b.id === boardId)!;
    const sketch = generateSketch({
      board,
      sample: sampleId,
      device: credential,
      mqttHost: domain,
    });
    triggerDownload(`${sampleId}_${credential.clientId}.ino`, sketch, "text/x-arduino");
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Arduino code</h2>
      <p className="mb-3 text-xs text-slate-500">
        Download a ready-to-flash sketch. Flash it with the Arduino IDE, watch the serial monitor,
        then check "Recent messages" on this device's page for data arriving.
      </p>
      {!hasRealPassword && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The generated file has a <code className="font-mono">YOUR_DEVICE_PASSWORD</code>{" "}
          placeholder — paste in the password you saved when this device was created or last
          regenerated. Lost it? Use "Regenerate credential" above to get a new one.
        </p>
      )}
      {!domain && (
        <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Generated code always connects over secure MQTT (TLS), which needs a real domain with a
          certificate.{" "}
          <a href="/settings" className="underline">
            Set a domain on the Settings page
          </a>{" "}
          first — download unlocks once one is configured (allow up to ~30s after saving for the
          certificate to propagate to the broker).
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Board</label>
          <select
            value={boardId}
            onChange={(e) => setBoardId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {BOARDS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Sample</label>
          <select
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value as SampleId)}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">{selectedSample.description}</p>
        </div>
      </div>
      <button
        onClick={handleDownload}
        disabled={!domain}
        className="mt-3 rounded-md bg-primary-800 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
      >
        Download .ino
      </button>
    </div>
  );
}
