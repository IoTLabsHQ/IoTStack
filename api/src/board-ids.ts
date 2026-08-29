// Mirrors dashboard/src/lib/arduino/boards.ts's BoardDef ids — api and
// dashboard are separate packages with no shared module, so this is kept
// in sync by hand, same as VALID_COMMANDS/DEVICE_COMMANDS already are.
export const VALID_BOARD_IDS = new Set([
  "esp32-devkit-v1-30pin",
  "esp32-devkit-v1-38pin",
  "esp32-c3-supermini",
]);
