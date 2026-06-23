# AMI Power Usage — Architecture & Data Sources

This document explains how **Power Usage** works in gPawa (web, mobile, API), how to connect **real AMI meter data**, and what to configure on ThingsBoard.

---

## What the feature shows

For users with at least one **AMI** (networked) meter:

| View | Range | Charts / summary |
|------|-------|------------------|
| **Weekly** | Last 7 days | Daily area/bar chart, total, average, peak/low day |
| **Monthly** | Selected month | Daily chart + table |
| **Annual** | Selected year (clickable year chips) | Monthly bar chart + yearly totals |

Users with **STS-only** accounts see:

> *This is only for AMI meter users.*

---

## Where it appears

| Channel | Location |
|---------|----------|
| **Web** | Sidebar → **Power Usage** (only if account has an AMI meter) |
| **Mobile** | Tab → **Usage** |
| **USSD** | Main menu → **9. Power Usage** (weekly text summary) |
| **API** | `GET /api/v1/meter/power-usage/` |

### API parameters

```
GET /api/v1/meter/power-usage/?period=week|month|year&meter_no=&year=&month=
```

Response includes `eligible`, `daily[]`, `monthly[]` (year view), `summary`, `available_years`, `data_source`.

---

## How usage is calculated (three data paths)

gPawa supports **three ways** to obtain daily kWh used, in priority order:

### 1. ThingsBoard telemetry (recommended for production)

**Best when:** The meter firmware (or TB rule chain) publishes a telemetry key such as `daily_kwh` or `energy_consumed_kwh` once per day.

**gPawa behaviour:**

- Uses ThingsBoard **Tenant REST API** to read timeseries aggregated by day.
- Stores rows in `meter_meterusagedaily` with source `THINGSBOARD`.

**Backend env (`backend/.env`):**

```env
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TENANT_USERNAME=tenant@example.com
THINGSBOARD_TENANT_PASSWORD=your-tenant-password
THINGSBOARD_USAGE_TELEMETRY_KEY=daily_kwh
```

**ThingsBoard setup (meter / rule chain):**

1. Ensure the device posts daily consumption, e.g. every midnight or on each reading:

   ```json
   { "daily_kwh": 2.45 }
   ```

   Or cumulative energy (then use a TB rule to compute daily delta before forwarding).

2. Optional: add a **rule chain** node that POSTs to gPawa webhook (path 2 below) instead of relying on pull.

**Verify telemetry exists:**

```bash
# Tenant JWT required — or use ThingsBoard UI → Device → Latest telemetry
curl -H "X-Authorization: Bearer $TB_JWT" \
  "https://iot.energy-share.sun.ac.ug/api/plugins/telemetry/DEVICE/{deviceId}/values/timeseries?keys=daily_kwh&startTs=...&endTs=..."
```

---

### 2. ThingsBoard → gPawa webhook (push daily rollup)

**Best when:** You already have a TB rule chain and want gPawa to receive pre-computed daily totals (no tenant API polling).

**Endpoint:**

```
POST /webhooks/thingsboard/daily-usage
Header: X-ThingsBoard-Webhook-Secret: <THINGSBOARD_WEBHOOK_SECRET>
Body: {
  "device_token": "<iot_device_token>",
  "usage_date": "2026-06-21",
  "kwh_used": 2.45
}
```

**Rule chain sketch:**

```
[Post telemetry / Scheduled]
    → [Script: compute yesterday kWh]
    → [REST API Call → gPawa daily-usage webhook]
```

---

### 3. Balance snapshots (works without new meter firmware)

**Best when:** You only have `remaining_units` today (current gPawa integration) and need usage **before** meters report `daily_kwh`.

**How it works:**

1. gPawa records **`remaining_units`** whenever:
   - User taps **Check units** (web/mobile/USSD)
   - Celery task `meter.tasks.snapshot_ami_meter_balances` runs (schedule in Celery Beat)
2. Between consecutive readings on the same day:
   - If balance **decreases** → that drop is **usage**
   - If balance **increases** → treated as a **top-up** (ignored as usage)

**Limitation:** Needs at least two readings per day for accuracy. Periodic snapshots are **enabled in Celery Beat** (see below).

```python
# backend/backend/settings.py — CELERY_BEAT_SCHEDULE (active)
'ami-meter-balance-snapshots': {
    'task': 'meter.tasks.snapshot_ami_meter_balances',
    'schedule': crontab(minute=0, hour='*/6'),  # every 6 hours
},
'ami-daily-usage-aggregate': {
    'task': 'meter.tasks.aggregate_daily_ami_usage',
    'schedule': crontab(minute=15, hour=1),  # 01:15 daily
},
```

**Run in production:**

```bash
celery -A backend worker -l info
celery -A backend beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

Set `CELERY_TASK_ALWAYS_EAGER=False` in production `.env` so tasks run via Redis, not inline.

**Recommendation:** Use snapshots as a **bridge**; move to path 1 or 2 when meters expose consumption telemetry.

---

### Development stub

Meters with `iot_device_token` starting with `dev-` get **synthetic** daily usage so UI can be tested without ThingsBoard.

---

## Database models

| Model | Purpose |
|-------|---------|
| `MeterBalanceSnapshot` | Point-in-time `remaining_kwh` from ThingsBoard |
| `MeterUsageDaily` | One row per meter per calendar day (`kwh_used`, `source`) |

---

## Suggested rollout plan

| Phase | Action |
|-------|--------|
| **1. UI + API** | Ship Power Usage page; verify with `dev-*` tokens |
| **2. Snapshots** | Enable 6-hour Celery snapshots + daily aggregation |
| **3. Meter telemetry** | Confirm with hardware team which key meters publish (`daily_kwh`, `active_energy`, etc.) |
| **4. ThingsBoard** | Configure rule chain or device profile to publish daily kWh |
| **5. Tenant API** | Set `THINGSBOARD_TENANT_*` and `THINGSBOARD_USAGE_TELEMETRY_KEY` |
| **6. Webhook (optional)** | Push daily totals from TB for lowest latency |

---

## Questions for your meter / IoT team

1. Does the AMI firmware report **cumulative energy (kWh)** or **instantaneous power (kW)**?
2. How often does it POST to ThingsBoard?
3. What telemetry key names are used? (Map to `THINGSBOARD_USAGE_TELEMETRY_KEY`.)
4. Is `remaining_units` updated on every consumption event, or only on top-up?

Once you have answers, configure path **1** or **2** above; snapshot-based usage (path **3**) will still work as a fallback.

---

## Related docs

- [`THINGSBOARD_INTEGRATION_GUIDE.md`](THINGSBOARD_INTEGRATION_GUIDE.md)
- [`THINGSBOARD_WEBHOOK.md`](THINGSBOARD_WEBHOOK.md)
- [`MOBILE_APP.md`](MOBILE_APP.md)
