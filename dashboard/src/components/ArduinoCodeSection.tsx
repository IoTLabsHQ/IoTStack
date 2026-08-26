import { useState } from "react";
import { BOARDS } from "../lib/arduino/boards";
import { SAMPLES, type SampleId } from "../lib/arduino/samples";
import { generateSketch } from "../lib/arduino/generate";
import { triggerDownload } from "../lib/download";
import type { CredentialInfo } from "../lib/credentialExport";

export function ArduinoCodeSection({ credential }: { credential: CredentialInfo }) {
  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [sampleId, setSampleId] = useState<SampleId>(SAMPLES[0].id);
  const selectedSample = SAMPLES.find((s) => s.id === sampleId)!;

  function handleDownload() {
    const board = BOARDS.find((b) => b.id === boardId)!;
    const sketch = generateSketch({
      board,
      sample: sampleId,
      device: credential,
      mqttHost: window.location.hostname,
    });
    triggerDownload(`${sampleId}_${credential.clientId}.ino`, sketch, "text/x-arduino");
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-slate-900">Arduino code</h3>
      <p className="mb-3 text-xs text-slate-500">
        Download a ready-to-flash sketch with this device's credentials already filled in. Flash
        it with the Arduino IDE, watch the serial monitor, then check "Recent messages" on this
        device's page for data arriving.
      </p>
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
        className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Download .ino
      </button>
    </div>
  );
}
