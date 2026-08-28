// Hand-maintained — small enough at this count that auto-discovery buys
// nothing (same convention as docs-manifest.ts). Add an entry here
// whenever a new template is added under templates/<id>/ in the repo
// root — see templates/esp32-led-dht11/ for the expected structure:
//   templates/<id>/template.json    — boards, controls, hardware list
//   templates/<id>/<id>.en.md       — feature/hardware/wiring description
//   templates/<id>/<id>.vi.md       — (Vietnamese)
//   templates/<id>/<id>.ino         — Arduino code with __TOKEN__ placeholders
// The templates/ folder itself is the source of truth — never edited
// from the dashboard, only from a repo checkout/PR.
export const TEMPLATES = [
  {
    id: "esp32-led-dht11",
    title: { en: "Light control with ESP32", vi: "Điều khiển bật tắt đèn dùng ESP32" },
  },
] as const;
