import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { DocMarkdown } from "../components/DocMarkdown";
import { BOARDS } from "../lib/arduino/boards";
import { TEMPLATES } from "../lib/templates-manifest";
import { useDocsLang } from "../lib/docsLang";
import { getSettings } from "../lib/api/settings";
import { createDevice, listDevices } from "../lib/api/devices";
import { saveDashboard, type Control, type ControlType, type WidgetType } from "../lib/api/control";
import { triggerDownload } from "../lib/download";
import { buildUniqueProjectName, normalizeProjectName } from "../lib/projectName";

interface TemplateControlDef {
  label: { en: string; vi: string };
  type: ControlType;
  widget: WidgetType;
  binding: { field?: string; target?: string };
}
interface TemplateHardwareItem {
  name: { en: string; vi: string };
  required: boolean;
}
interface TemplateJson {
  id: string;
  boards: string[];
  controls: TemplateControlDef[];
  hardware: TemplateHardwareItem[];
  simulateDht11Default: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fillTokens(raw: string, tokens: Record<string, string>): string {
  let result = raw;
  for (const [key, value] of Object.entries(tokens)) {
    result = result.split(`__${key}__`).join(value);
  }
  return result;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

const WIZARD_LABELS: Record<Exclude<WizardStep, 0>, { en: string; vi: string }> = {
  1: { en: "Initializing project", vi: "Khởi tạo project" },
  2: { en: "Creating device and controls", vi: "Khởi tạo thiết bị và controls" },
  3: { en: "Checking MQTT connection", vi: "Khởi tạo kết nối MQTT" },
  4: { en: "Filling in Arduino code", vi: "Cập nhật MQTT vào Arduino Code" },
  5: { en: "Done", vi: "Hoàn thành" },
};

export function TemplateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [lang] = useDocsLang();
  const templateDef = TEMPLATES.find((t) => t.id === id);

  const [boardId, setBoardId] = useState(BOARDS[0].id);
  const [simulateDht11, setSimulateDht11] = useState(true);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deviceId: number; code: string } | null>(null);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const domain = settingsQuery.data?.domain ?? "";

  const jsonQuery = useQuery({
    queryKey: ["template-json", id],
    queryFn: async () => {
      const res = await fetch(`/templates-content/${id}/template.json`);
      if (!res.ok) return null;
      return (await res.json()) as TemplateJson;
    },
    enabled: !!id,
  });

  const mdQuery = useQuery({
    queryKey: ["template-md", id, lang],
    queryFn: async () => {
      const res = await fetch(`/templates-content/${id}/${id}.${lang}.md`);
      if (!res.ok) return null;
      return res.text();
    },
    enabled: !!id,
  });

  const inoQuery = useQuery({
    queryKey: ["template-ino", id],
    queryFn: async () => {
      const res = await fetch(`/templates-content/${id}/${id}.ino`);
      if (!res.ok) return null;
      return res.text();
    },
    enabled: !!id,
  });

  if (!templateDef) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">
          {lang === "vi" ? "Không tìm thấy template này." : "This template doesn't exist."}
        </p>
      </Shell>
    );
  }

  const template = jsonQuery.data;
  const board = BOARDS.find((b) => b.id === boardId)!;

  async function runWizard() {
    if (!template) return;
    setWizardError(null);
    setResult(null);
    setWizardStep(1);
    await delay(2000);

    setWizardStep(2);
    let deviceId: number;
    let credential: { clientId: string; mqttUsername: string; password: string };
    try {
      const existingDevices = await listDevices();
      const existingNormalized = new Set(
        existingDevices.devices.map((d) => normalizeProjectName(d.display_name)),
      );
      const baseName = normalizeProjectName(`${templateDef!.title[lang]} - ${board.label}`);
      const projectName = buildUniqueProjectName(baseName, existingNormalized);

      const created = await createDevice(projectName);
      deviceId = created.device.id;
      credential = {
        clientId: created.device.clientId,
        mqttUsername: created.device.mqttUsername,
        password: created.password,
      };

      const controls: Control[] = template.controls.map((c) => {
        if (c.type === "sensor-numeric") {
          return {
            id: crypto.randomUUID(),
            label: c.label[lang],
            type: "sensor-numeric",
            widget: c.widget,
            matchingWidgets: ["label-value", "min-max-current"],
            binding: { source: "telemetry", field: c.binding.field! },
          };
        }
        return {
          id: crypto.randomUUID(),
          label: c.label[lang],
          type: "toggle",
          widget: c.widget,
          matchingWidgets: ["toggle-switch"],
          binding: { source: "status", target: c.binding.target!, field: c.binding.field ?? "state" },
        };
      });
      await saveDashboard(deviceId, controls);
    } catch {
      setWizardError(lang === "vi" ? "Không tạo được thiết bị." : "Failed to create device.");
      setWizardStep(0);
      return;
    }
    await delay(2000);

    setWizardStep(3);
    await delay(1000);
    if (!domain) {
      setWizardError(
        lang === "vi"
          ? "Chưa cấu hình domain — MQTT bảo mật cần domain thật. Thiết lập ở trang Settings rồi thử lại."
          : "No domain configured — secure MQTT needs a real domain. Set one on the Settings page and try again.",
      );
      setWizardStep(0);
      return;
    }
    await delay(1000);

    setWizardStep(4);
    let code = "";
    try {
      const raw = inoQuery.data ?? (await (await fetch(`/templates-content/${id}/${id}.ino`)).text());
      code = fillTokens(raw, {
        MQTT_HOST: domain,
        MQTT_CLIENT_ID: credential.clientId,
        MQTT_USERNAME: credential.mqttUsername,
        MQTT_PASSWORD: credential.password,
        LED_PIN: String(board.ledPin),
        LED_ACTIVE_LOW: String(board.ledActiveLow),
        DHT_PIN: String(board.defaultGpio),
        SIMULATE_DHT11: simulateDht11 ? "1" : "0",
      });
    } catch {
      setWizardError(lang === "vi" ? "Không tải được code mẫu." : "Failed to load the code template.");
      setWizardStep(0);
      return;
    }
    await delay(2000);

    setResult({ deviceId, code });
    setWizardStep(5);
    queryClient.invalidateQueries({ queryKey: ["devices"] });
  }

  return (
    <Shell>
      <Link to="/templates" className="mb-3 inline-block text-sm text-slate-500 hover:underline">
        {lang === "vi" ? "← Dự án mẫu" : "← Sample projects"}
      </Link>
      <h1 className="mb-6 text-lg font-semibold text-slate-900">{templateDef.title[lang]}</h1>

      {mdQuery.data && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <DocMarkdown>{mdQuery.data}</DocMarkdown>
        </div>
      )}

      {wizardStep === 0 && !result && (
        <>
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              {lang === "vi" ? "Cấu hình" : "Configuration"}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Board</label>
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  {BOARDS.filter((b) => template?.boards.includes(b.id) ?? true).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={simulateDht11}
                    onChange={(e) => setSimulateDht11(e.target.checked)}
                  />
                  {lang === "vi"
                    ? "Mô phỏng DHT11 (chưa có cảm biến thật)"
                    : "Simulate DHT11 (no real sensor yet)"}
                </label>
              </div>
            </div>
          </div>

          {template && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">
                {lang === "vi" ? "Cấu trúc dự án" : "Project structure"}
              </h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-slate-500">Project</dt>
                <dd>{templateDef.title[lang]}</dd>
                <dt className="text-slate-500">Device</dt>
                <dd>{board.label}</dd>
                <dt className="text-slate-500">Controls</dt>
                <dd>{template.controls.map((c) => c.label[lang]).join(", ")}</dd>
              </dl>
            </div>
          )}

          {inoQuery.data && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Arduino code</h2>
              <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                {inoQuery.data}
              </pre>
            </div>
          )}

          {!domain && (
            <p className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {lang === "vi" ? (
                <>
                  MQTT bảo mật cần domain thật.{" "}
                  <a href="/settings" className="underline">
                    Thiết lập domain ở trang Settings
                  </a>{" "}
                  trước khi tạo.
                </>
              ) : (
                <>
                  Secure MQTT needs a real domain.{" "}
                  <a href="/settings" className="underline">
                    Set one on the Settings page
                  </a>{" "}
                  before creating.
                </>
              )}
            </p>
          )}

          {wizardError && (
            <p className="mb-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
              {wizardError}
            </p>
          )}

          <button
            onClick={runWizard}
            disabled={!domain || !template}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {lang === "vi" ? "Tạo" : "Create"}
          </button>
        </>
      )}

      {wizardStep > 0 && wizardStep < 5 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <ol className="flex flex-col gap-3">
            {([1, 2, 3, 4, 5] as const).map((step) => (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    step < wizardStep
                      ? "bg-emerald-500 text-white"
                      : step === wizardStep
                        ? "animate-pulse bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step < wizardStep ? "✓" : step}
                </span>
                <span className={step <= wizardStep ? "text-slate-900" : "text-slate-400"}>
                  {WIZARD_LABELS[step][lang]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {wizardStep === 5 && result && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-6">
          <p className="mb-3 text-sm font-semibold text-emerald-900">
            {lang === "vi" ? "Hoàn thành!" : "Done!"}
          </p>
          <p className="mb-4 text-sm text-emerald-800">
            {lang === "vi"
              ? "Nạp code bên dưới bằng Arduino IDE (nhớ điền WiFi SSID/password), rồi mở trang thiết bị để xem dữ liệu thời gian thực và điều khiển."
              : "Flash the code below with the Arduino IDE (fill in your WiFi SSID/password first), then open the device's page to see live data and control it."}
          </p>
          <pre className="mb-4 max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
            {result.code}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={() => triggerDownload(`${id}.ino`, result.code, "text/x-arduino")}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              {lang === "vi" ? "Tải .ino" : "Download .ino"}
            </button>
            <button
              onClick={() => navigate(`/control/${result.deviceId}`)}
              className="rounded-md border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              {lang === "vi" ? "Mở trang điều khiển" : "Open Control page"}
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}
