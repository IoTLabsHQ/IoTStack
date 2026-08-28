# Resource Monitoring

IoTStack watches its own resource usage in real time, so you don't have to
guess whether your VPS is comfortable or already straining. The dashboard's
**Resources** page shows live CPU, RAM, and disk usage — for the whole
server and for each of IoTStack's three services — plus charts going back
a day, a week, a month, and a year.

## Why this matters

The [server requirements](001_server-requirements.en.md) doc gives you
numbers to plan around before you deploy: 1-2 vCPU, 2 GB RAM, 20-40 GB
disk. Resource Monitoring is how you confirm those numbers hold up for
*your* actual usage once real devices are connected, instead of just
trusting a promise. IoTStack's three services idle at roughly 150-300 MB
combined RAM — most of a 2 GB VPS stays free for the OS and everything
else.

## Warning and critical thresholds

Every metric has two levels, shown as colored bars on the Resources page
and as a banner on Overview once either is crossed:

| Metric | Warn | Critical |
|---|---|---|
| Host RAM | 70% | 85% |
| Host CPU (averaged, not spikes) | 70% | 90% |
| Host disk | 80% | 90% |
| Per-service memory (of its own limit) | 80% | 95% |

These are sensible defaults, not fixed — adjust them from the Resources
page if your setup is different (e.g. you're running other things on the
same VPS). Crossing "warn" means "keep an eye on this"; crossing "critical"
means "act soon" — either free something up or move to a bigger VPS.

## Reading the charts

- **Day** shows individual samples, taken every 30 seconds by default.
- **Week** and **month** show hourly averages.
- **Year** shows daily averages.

A brand-new install only has a day's worth of data at first — the longer
views fill in naturally as the week/month/year passes; there's nothing to
configure to make that happen.

## How it works, briefly

A small agent runs directly on your server (not inside a container) so it
can see real host-level usage — see
[Architecture](../reference/001_architecture.en.md#resource-monitoring) if
you want the technical detail. It's installed automatically by the
[installer](002_installer.en.md); nothing extra to set up.
