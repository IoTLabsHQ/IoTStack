# Control Panels

Every device gets its own **Control** page — a small, configurable
dashboard for viewing and operating that one device, instead of reading
raw JSON in the message feed. Open it from the **Control** nav item, or
from a device's own page.

## What a control is

A control is one thing you want to see or operate — a temperature
reading, a relay switch — bound to a real field the device actually
publishes. Each control renders as a **widget**, a display or interaction
style you pick when adding it.

There are two control types today:

| Type | Binds to | Widgets |
|---|---|---|
| Sensor value | a telemetry field (e.g. `temperature_c`) | Label + value, or Min / max / current |
| Toggle | a status target (e.g. `relay_1`) | Toggle switch |

A toggle control's switch operates the device directly — flipping it
sends the same `set` command the device page's command form does.

## Binding a control — type the field name

IoTStack doesn't know what fields your device publishes; there's no
autodiscovery. Adding a control means typing the exact JSON key name (for
a sensor value) or target (for a toggle), case-sensitive, matching what
your firmware actually sends. Get the spelling wrong and the widget just
shows no data — check the device's Recent messages feed to confirm the
real field names first.

## Min/max is over recent messages, not history

The Min/max/current widget computes its range from the device's most
recent messages (the same feed the device page shows), not a stored
historical rollup. It resets as older messages age out of that window —
it's a snapshot of recent behavior, not a long-term chart like the
[Resource monitoring](005_resource-monitoring.en.md) page's.

## Editing controls

Click **Edit** on a device's Control page to add, reorder, remove
controls, or change a control's widget (only shown when more than one
widget fits its type). Changes save as a whole set when you click
**Done** — nothing is saved control-by-control as you go.
