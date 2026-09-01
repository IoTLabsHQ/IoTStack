# Control Panels

Every device gets its own **Control** page — a small, configurable
dashboard for viewing and operating that one device, instead of reading
raw JSON in the message feed. Open it from the **Control** nav item, or
from a device's own page.

## What a control is

A control is one thing you want to see or operate — a temperature
reading, a relay switch, the latest event — bound to a real field (or
message type) the device actually publishes. Each control renders as a
**widget**, a display or interaction style you pick when adding it.

There are three control types:

| Type | Binds to | Widgets |
|---|---|---|
| Sensor value | a telemetry field (e.g. `temperature_c`, or a nested path like `gps.lat`) | Label + value, Min / max / current, or History chart |
| Toggle | a status target + field (e.g. target `relay_1`, field `state`) | Toggle switch, or Label + value (read-only) |
| Latest event | the device's `event` messages, optionally filtered to one `type` | Latest event |

A toggle control's switch operates the device directly — flipping it
sends the same `set` command the device page's command form does, then
shows a loading state until the device's real reply arrives (see
"Toggle commands wait for the real reply" below). The Label + value
widget on a toggle is read-only — useful for a second, glanceable
display of the same target/field without a clickable switch.

## Binding a control — pick from the device's real message shapes

IoTStack doesn't know what fields your device publishes ahead of time;
there's no schema registration step. Instead, while editing controls, a
**Message formats** panel on the right shows the device's actual message
shapes — deduplicated by structure (not by value, so ten telemetry
messages with the same keys collapse into one shown shape), grouped by
message type:

- **Telemetry** — every distinct shape seen, with a `Fields:` list of
  clickable field paths.
- **Status** — grouped by `target` first (different targets can carry
  different fields), then by shape within each target.
- **Event** / **Ping** — shown for reference only (not bindable to a
  control field).

To map a control: click **Add control** (or **Edit** on an existing one),
pick a **Type**, then click into its **Telemetry field** or **Status
field** input — the panel highlights the matching fields as clickable.
Clicking one fills the input. You can still type a field name by hand if
you already know it or the device hasn't sent a matching message yet.

**Nested fields** use dot-notation: a payload like
`{ "gps": { "lat": 10.7, "long": 106.6 } }` offers `gps.lat` and
`gps.long` as pickable (or typeable) field paths — not just top-level
keys.

## Editing an existing control's binding

Editing isn't limited to relabeling or changing the widget — a
`sensor-numeric` control's **Telemetry field** and a `toggle` control's
**Status target**/**Status field** are all editable after creation, the
same field-picker panel applies. Re-point a control at a different field
without deleting and re-adding it.

## Min/max is over recent messages, not history

The Min/max/current widget computes its range from the device's most
recent messages (the same feed the device page shows), not a stored
historical rollup. It resets as older messages age out of that window —
it's a snapshot of recent behavior. For an actual long-term view, use
the History chart widget instead (below).

## History charts — real trends over time

The History chart widget plots a sensor value over time, switchable
between **Day / Week / Month / Year** — same granularity picker as the
[Resource monitoring](resource-monitoring) page. Day reads the device's
raw recent messages directly; Week/Month/Year read from an hourly/daily
rollup that's computed once an hour, so a brand-new control's longer
ranges fill in gradually over the following hour rather than showing
data immediately (Day is unaffected — it's live). This mirrors Resource
monitoring's own "a new install only has a day of data at first"
behavior.

## Device data usage

Separately from controls, each device's own page (not the Control page)
has a **Data usage** chart — bytes and message count sent per period,
with the same Day/Week/Month/Year toggle, next to the existing
"Storage used" running total. Storage used never resets (it gates the
device's storage cap); the Data usage chart is for spotting usage
trends — a device suddenly sending far more than usual is often the
first sign of a firmware bug or a misbehaving sensor loop.

## Toggle commands wait for the real reply

Clicking a toggle switch doesn't just flip the UI optimistically: it
shows a loading spinner immediately, sends the `set` command, and keeps
loading until the device publishes a matching `status` reply (or up to
15 seconds elapse with no reply, at which point loading clears without
assuming success). This means the switch always reflects what the device
actually reported, not just what was last clicked — useful for catching
a command that never reached the device (offline, dropped connection).

## Firmware version / signal strength

If a device's firmware reports `firmware_version` and/or `wifi_rssi` in
any message (ping or status), it shows under the device's title on both
the Devices page and the Control page — e.g. "Firmware 1.0.0 · RSSI -76
dBm". This is read live from the message feed, not a separate
configuration step; firmware that doesn't send these fields simply
doesn't show the line.

## Editing controls

Click **Edit** on a device's Control page to add, reorder, remove
controls, or change a control's widget/binding. Changes save as a whole
set when you click **Done** — nothing is saved control-by-control as you
go.
