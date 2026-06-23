# Platform Alignment Guide (June 2026)

This document lists **database migrations**, **environment variables**, **API additions**, and **channel parity** for recent gPawa updates. Use it after pulling the latest code or before deploying.

---

## 1. Required database migrations

Run from `backend/` with your virtualenv active:

```powershell
python manage.py migrate
```

| App | Migration | Purpose |
|-----|-----------|---------|
| `accounts` | `0015_user_must_change_password` | Admin-provisioned users must change password on first login |
| `meter` | `0016_meternotification` | Low-units alerts (ThingsBoard webhook) |
| `meter` | `0017_meter_power_usage` | `MeterBalanceSnapshot` + `MeterUsageDaily` for AMI Power Usage |
| `meter` | `0019_meter_soft_delete` | Soft-delete fields on `Meter` + `DeletedMeterRecord` audit table |

Verify:

```powershell
python manage.py showmigrations accounts meter
```

All listed migrations should show `[X]`.

---

## 2. Environment variables

Add to `backend/.env` (see `backend/.env.production.example`):

```env
# ThingsBoard — AMI meters
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TIMEOUT_SECONDS=8
THINGSBOARD_WEBHOOK_SECRET=your-webhook-secret
THINGSBOARD_TENANT_USERNAME=          # Required for remaining_units attribute sync + Power Usage
THINGSBOARD_TENANT_PASSWORD=
THINGSBOARD_USAGE_TELEMETRY_KEY=daily_kwh
AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway

# Celery — set ALWAYS_EAGER=False in production + run worker + beat
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
CELERY_TIMEZONE=Africa/Kampala
CELERY_TASK_ALWAYS_EAGER=True
```

**Production Celery Beat** (configured in `backend/backend/settings.py`):

| Task | Schedule |
|------|----------|
| `meter.tasks.snapshot_ami_meter_balances` | Every 6 hours |
| `meter.tasks.aggregate_daily_ami_usage` | Daily 01:15 |
| `meter.tasks.retry_pending_ami_deliveries` | Every 5 minutes |

```bash
celery -A backend worker -l info
celery -A backend beat -l info
```

---

## 3. New / updated API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/change-required-password/` | First-login password change |
| GET | `/api/v1/share/receiver-preview/?meter_number=` | Share confirmation: name, type, phone |
| POST | `/api/v1/share/share-units/` | Share (OTP); STS → token, AMI → ThingsBoard |
| POST | `/api/v1/meter/apply-wallet-units/` | **Load Units** — own AMI meter top-up |
| GET | `/api/v1/meter/power-usage/` | AMI usage reports (week/month/year) |
| POST | `/webhooks/thingsboard/daily-usage` | Inbound daily kWh from ThingsBoard |
| POST | `/webhooks/thingsboard/low-units` | Inbound low-units alert |

---

## 4. Customer web portal (labels & routes)

| Menu label | Route | Function |
|------------|-------|----------|
| **TopUp Wallet** | `/dashboard/buy-units` | MoMo purchase → unit wallet (formerly “Buy Units”) |
| **My Meters** | `/dashboard/my-meters` | List, register, check, load, **remove** meters |
| **Load / Share Units** | `/dashboard/share` | Load own meter (AMI/STS) or share to others |
| **Power Usage** | `/dashboard/power-usage` | AMI only — charts & reports |
| **STS Tokens** | `/dashboard/tokens` | STS keypad tokens |
| Admin | `/admin/dashboard` | Staff console (not customer flow) |

### Load vs Share

| Action | Source | Destination | Delivery |
|--------|--------|-------------|----------|
| **Load Units** | Unit wallet | Your AMI meter | `apply-wallet-units` → ThingsBoard device token |
| **Share → AMI** | Unit wallet | Another user’s AMI meter | ThingsBoard push on OTP verify |
| **Share → STS** | Unit wallet | Another user’s STS meter | STS token generated + emailed on OTP verify |

Sharing to **your own meter** is blocked — use **Load Units**.

### Meter removal (soft delete)

Customers and admins can **remove a meter from an account** without destroying historical data:

| Action | API | Effect |
|--------|-----|--------|
| Customer remove | `POST /api/v1/meter/delete/` `{ meter_no, reason? }` | Unlinks meter; writes `DeletedMeterRecord` |
| Admin remove | `POST /api/v1/admin/meters/{id}/delete/` | Same + admin audit log |
| Audit list | `GET /api/v1/admin/deleted-meters/` | Search archived deletions |

The live `Meter` row is soft-deleted (`is_deleted=True`, user cleared, `meter_no` renamed) so the **original number can be registered again** via `POST /meter/register/`. Token/share history remains on the archived row.

**Migration:** `meter.0019_meter_soft_delete`

---

## 5. USSD menu (unchanged numbering for MoMo buy)

| # | Label | Notes |
|---|-------|-------|
| 2 | Buy Units | Same as web **TopUp Wallet** (MoMo → wallet) |
| 4 | Share Units | OTP + email; AMI/STS delivery as API |
| 9 | Power Usage | Weekly text summary (AMI only) |

Load Units (web/mobile) maps to USSD **Manage → Apply wallet (`6*4`)** for AMI and **Tokens → Generate (`5*2`)** for STS.

**My Meters** (web/mobile) maps to USSD **Manage → My meters (`6*1`)** — list only; registration is web/mobile (USSD cannot enter device tokens conveniently).

---

## 6. Mobile app

| Tab | Maps to |
|-----|---------|
| **Meters** | My Meters — register (STS/AMI + `iot_device_token`), check units, load |
| **TopUp** | TopUp Wallet (`meter/buy-units/`) |
| **Load/Share** | Load / Share Units hub — load (AMI push or STS token), share + preview + OTP |
| **Tokens** | STS token history + quick generate (multi-meter picker) |
| **Usage** | Power Usage API (AMI) |
| **Loans** | Apply / disburse / repay |
| **Account** | Profile, alerts, recent transactions |

Rebuild APK after API URL changes: see [`MOBILE_APP.md`](MOBILE_APP.md).

---

## 7. Documentation index

| Document | Contents |
|----------|----------|
| [`PLATFORM_ALIGNMENT.md`](PLATFORM_ALIGNMENT.md) | This file — migrations & deploy checklist |
| [`MOBILE_APP.md`](MOBILE_APP.md) | Android app setup & features |
| [`POWER_USAGE.md`](POWER_USAGE.md) | AMI usage data sources & Celery |
| [`USSD_INTEGRATION.md`](../USSD_INTEGRATION.md) | Full USSD menus |
| [`THINGSBOARD_WEBHOOK.md`](THINGSBOARD_WEBHOOK.md) | Low-units + daily-usage webhooks |
| [`API_ROUTE_CATALOG.md`](../API_ROUTE_CATALOG.md) | All REST routes |
| [`API_PAYLOAD_EXAMPLES.md`](../API_PAYLOAD_EXAMPLES.md) | Request/response samples |
| [`BACKEND_DOCS.md`](../BACKEND_DOCS.md) | Backend architecture |
| [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) | Local setup |

---

## 8. Post-deploy smoke test

1. `python manage.py migrate` — no pending migrations
2. Customer login → **TopUp Wallet** → sandbox MoMo completes
3. **Load / Share Units** → Load (AMI) → confirm → ThingsBoard push
4. **Load / Share Units** → Share → enter meter → preview → OTP → complete
5. **Power Usage** (AMI account) → weekly chart loads
6. USSD `9` → weekly summary (AMI phone user)
7. Admin login → `/admin/dashboard` (not customer meter registration flow)
