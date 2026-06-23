# gPAWA ↔ ThingsBoard Integration Report

> **This repo (Django):** Implementation lives under `backend/meter/services.py`, `backend/meter/ami_delivery.py`, `backend/utils/ami_gateway.py`, `backend/webhooks/api/views.py`, and `backend/meter/api/views.py`. See also [`THINGSBOARD_WEBHOOK.md`](./THINGSBOARD_WEBHOOK.md). The sections below describe the full product behaviour; FastAPI paths in Part 2 are from an earlier prototype and map to the Django files above.

**Project:** gPAWA Energy Wallet  
**ThingsBoard instance:** `https://iot.energy-share.sun.ac.ug`  
**Last updated:** June 2026  
**Audience:** Non-technical stakeholders and technical implementers

---

## Part 1 — Plain-language summary (for everyone)

### What is ThingsBoard, and why do we use it?

**ThingsBoard** is the IoT platform that talks to **AMI meters** — smart electricity meters connected over the network. gPAWA does **not** replace ThingsBoard; it works **with** it.

Think of it this way:

| Meter type | How the customer gets power | ThingsBoard involved? |
|------------|----------------------------|------------------------|
| **STS** (token keypad) | Customer receives a **20-digit code** and types it on the meter | **No** |
| **AMI** (networked) | Units are sent **over the air** to the meter automatically | **Yes** |

### What gPAWA does with AMI meters

For customers with AMI meters, gPAWA handles **money and units in the wallet**; ThingsBoard handles **delivery to the physical meter**.

1. **Customer tops up their unit wallet** (Mobile Money → kWh in gPAWA).
2. **Customer loads or shares units** to an AMI meter registered on their account.
3. **gPAWA tells ThingsBoard** to credit that meter (telemetry + `remaining_units` attribute).
4. **ThingsBoard forwards** the credit to the real device when it is online.

**Important:** **Top Up Wallet** only fills the unit wallet. **Load Units** (or share) moves kWh from the wallet to the meter.

The customer does **not** type a token on an AMI meter — the units should appear on the meter after a successful push.

### How we link a person’s account to a meter

Each AMI meter in gPAWA is stored with:

- **Meter number** (11 digits) — for the customer’s reference  
- **Device token** — a secret key from ThingsBoard that identifies that one physical device  

When the customer registers an AMI meter (web, mobile app, USSD, or admin), they (or an admin) must provide the **device token** from ThingsBoard. That token is what gPAWA uses for all communication with that meter.

**Important:** gPAWA uses the **access token**, not the internal ThingsBoard device UUID.

### Three ways gPAWA and ThingsBoard talk today

#### A. Sending units **to** the meter (gPAWA → ThingsBoard)

When a user **loads** or **shares** kWh to an AMI meter, gPAWA:

1. Sends a **payment telemetry** message to ThingsBoard (`payment: true`, `amount: kWh`).
2. Updates the **`remaining_units`** shared attribute so **Check units** reflects the credit.
3. If the meter is **offline** or ThingsBoard rejects the message, the kWh are stored in **pending delivery** on the meter and **retried automatically** every 5 minutes (and when the user taps **Check units**). The customer’s wallet is already debited; units are not lost.

#### Ledger balance vs live balance

| | **Ledger balance** | **Live balance (Check units)** |
|--|-------------------|-------------------------------|
| **Meaning** | kWh successfully delivered to ThingsBoard via gPAWA | `remaining_units` on the device / in ThingsBoard |
| **Updates when** | Load or share succeeds (or pending queue clears) | Device reports consumption; attribute sync after delivery |

If ledger is higher than live, the meter may have **consumed** power since the last credit, or an older load happened before attribute sync was enabled. New loads update both paths.

#### B. Checking units **on demand** (gPAWA asks ThingsBoard)

On the **AMI meter detail** page (web/mobile) or via **USSD → Manage → My meters**, the user can tap **Check units**. gPAWA:

1. **Retries any pending delivery** queued while the meter was offline.
2. Asks ThingsBoard for the current **remaining units** and shows the result.

This only runs when the user asks — it is **not** continuous polling (background retry runs every 5 minutes via Celery).

#### D. Offline reconciliation (automatic)

When a meter is **offline** or ThingsBoard rejects delivery:

| Field | Meaning |
|-------|---------|
| **Ledger balance** (`meter.units`) | kWh successfully delivered to ThingsBoard |
| **Pending delivery** (`meter.pending_units`) | kWh debited from wallet but not yet accepted by ThingsBoard |

A Celery task (`meter.tasks.retry_pending_ami_deliveries`) retries every **5 minutes**. Pending units move to ledger when delivery succeeds. The customer does **not** lose paid units.

#### C. Low-units **alerts** (ThingsBoard → gPAWA)

When a meter’s remaining units drop to **about 5 kWh or below**, ThingsBoard can notify gPAWA. gPAWA then:

- Shows an **in-app notification** (web bell, mobile notifications)
- Sends an **email** (if the user saved an email and SMTP is configured)
- Lets the user open the meter page and **check units** or **top up**

This alert path is configured in **ThingsBoard rule chains** (technical setup below).

### Where customers can do AMI-related tasks

The **same account** (phone + PIN) works across:

| Channel | AMI-related actions |
|---------|---------------------|
| **Web portal** | Unit wallet, apply/share, My meters (STS/AMI), check units, notifications |
| **Mobile app** | Same as web (no live socket on mobile yet) |
| **USSD** | Top up units, apply, share, register meter, check units, notifications, save email |

All channels read and update the **same balances and meters** in the database.

### What customers need to do

1. Register an **AMI meter** with the correct **ThingsBoard device token**.  
2. **Top up the unit wallet** (kWh) via Mobile Money.  
3. **Apply** units to their meter or **share** to someone else’s AMI meter.  
4. Optionally save an **email** under My Account for low-units alerts.  
5. Use **Check units** when they want to see live remaining kWh from the field.

### What still depends on ThingsBoard / field setup

- ThingsBoard must expose **`remaining_units`** as a shared attribute for “Check units” to work (gPAWA also writes this attribute on delivery when tenant credentials are set).
- **`THINGSBOARD_TENANT_USERNAME`** / **`THINGSBOARD_TENANT_PASSWORD`** — required for writing `remaining_units` via tenant REST API and for Power Usage timeseries.
- ThingsBoard **rule chains** must be configured to POST low-units alerts to gPAWA (not automatic until configured).
- gPAWA’s server must be reachable from ThingsBoard for alerts (public URL, not `localhost`).
- Physical meters must be online and correctly provisioned in ThingsBoard for **device firmware** to receive credits (server-side attribute sync can still update Check Units while offline).
- **Celery worker + beat** must run in production for automatic pending-delivery retry.

---

## Part 2 — Technical reference

### Architecture overview

```
┌─────────────┐     REST / USSD      ┌──────────────┐     HTTP Device API     ┌──────────────┐
│ Web / Mobile│ ───────────────────► │ gPAWA Backend│ ◄──────────────────────► │ ThingsBoard  │
│ USSD        │                      │  (FastAPI)   │                        │ IoT platform │
└─────────────┘                      └──────┬───────┘                        └──────┬───────┘
                                            │                                       │
                                            │ PostgreSQL                            │ AMI devices
                                            ▼                                       ▼
                                     users, meters,                          physical meters
                                     meter_notifications
```

**STS meters** never call ThingsBoard. **AMI meters** go through `backend/meter/services.py` and `backend/meter/ami_delivery.py`.

### Configuration (Django `backend/backend/settings.py` + `.env`)

| Variable | Default / purpose |
|----------|-------------------|
| `THINGSBOARD_BASE_URL` | `https://iot.energy-share.sun.ac.ug` |
| `THINGSBOARD_TIMEOUT_SECONDS` | `8` |
| `THINGSBOARD_WEBHOOK_SECRET` | Optional shared secret for inbound webhook |
| `THINGSBOARD_TENANT_USERNAME` / `PASSWORD` | Tenant JWT — **writes `remaining_units`** on delivery + Power Usage timeseries |
| `AMI_GATEWAY` | `utils.ami_gateway.ThingsBoardAMIGateway` (production) or `MockAMIGateway` (pilot) |
| `WEB_PORTAL_URL` / `FRONTEND_URL` | Deep links in alert emails |
| SMTP settings | Optional email for low-units alerts |
| `CELERY_BROKER_URL` | Redis — required for pending-delivery retry beat task |

### Data model

**`meters` table (AMI-relevant columns):**

| Column | Purpose |
|--------|---------|
| `architecture` | `STS` or `AMI` |
| `iot_device_token` | ThingsBoard **device access token** |
| `units` | gPAWA **ledger** — kWh delivered to ThingsBoard via gPAWA |
| `pending_units` | STS: awaiting token generation; AMI: **queued for ThingsBoard delivery** |

**`meter_notifications` table:** stores low-units alerts from the webhook (`device_token`, `units_kwh`, `occurred_at`, etc.).

**`users.email`:** contact address for alert emails (`PATCH /auth/email`).

### Integration flows (technical)

#### 1. Push units to meter (outbound)

**Services:** `push_units_to_thingsboard()`, `increment_shared_remaining_units()` in `backend/meter/services.py`  
**Orchestration:** `credit_ami_meter()` in `backend/meter/ami_delivery.py`  
**Entry point:** `apply_units_to_meter()` in `backend/utils/ami_gateway.py`  
**Channels:** Web (`POST /meter/apply-wallet-units/`), share verify, USSD `6*4`

```http
POST {THINGSBOARD_BASE_URL}/api/v1/{iot_device_token}/telemetry
Content-Type: application/json

{
  "payment": true,
  "amount": <kWh as float>,
  "tx_ref": "<transaction id>"
}
```

After successful telemetry POST, gPAWA increments the **`remaining_units` shared attribute** via tenant REST API:

```http
POST {THINGSBOARD_BASE_URL}/api/plugins/telemetry/DEVICE/{deviceId}/SHARED_SCOPE
X-Authorization: Bearer <tenant JWT>

{"remaining_units": <new balance>}
```

**Behaviour:**

- Missing token → failure → amount queued in `meter.pending_units` (wallet already debited on load)  
- Token prefix `dev-` → stub success (local testing; Check Units returns ledger)  
- HTTP 2xx on telemetry + attribute sync → `meter.units += amount` (ledger)  
- Telemetry or network failure → `meter.pending_units += amount`; Celery retries every 5 min  
- On **Check units**, pending delivery is retried immediately before reading live balance  
- If ledger exists but `remaining_units` attribute was never set, Check units bootstraps attribute from ledger (one-time)  

**Example (verified in testing):**

```bash
curl -X POST "https://iot.energy-share.sun.ac.ug/api/v1/pCqLl8iPI1UKIMCA8w2Z/telemetry" \
  -H "Content-Type: application/json" \
  -d '{"payment":true,"amount":8,"tx_ref":"manual-test-001"}'
```

#### 2. Read remaining units (on-demand inbound query)

**Service:** `query_latest_units_from_thingsboard()`  
**API:** `GET /api/v1/meter/check-units/?meter_no=` (JWT auth)  
**UI:** Web My Meters, `ami-status-card.tsx`, mobile Meters tab, USSD `6*2`

```http
GET {THINGSBOARD_BASE_URL}/api/v1/{iot_device_token}/attributes?sharedKeys=remaining_units
```

**Example response:**

```json
{"shared":{"remaining_units":0.1710000000000001}}
```

gPAWA maps `shared.remaining_units` → `units_kwh` in the API response. Response also includes `ledger_balance_kwh`, `pending_delivery_kwh`, and `pending_retry` (result of inline delivery retry).

#### 3. Low-units webhook (ThingsBoard → gPAWA)

**Endpoint:** `POST /webhooks/thingsboard/low-units`  
**Router:** `backend/app/routers/webhooks.py`  
**Auth:** Optional header `X-ThingsBoard-Webhook-Secret`

**Request body:**

```json
{
  "device_token": "<ThingsBoard access token>",
  "units_kwh": 4.5,
  "occurred_at": "2026-06-22T14:30:00+03:00"
}
```

**Processing:**

1. Lookup `meters` where `iot_device_token = device_token`, `architecture = AMI`, `status = active`  
2. Insert `meter_notifications` row for `user_id`  
3. Emit Socket.IO `notification:new` to room `user:{id}` (web portal)  
4. If `users.email` set → queue HTML email via `send_low_units_alert_email()`  
5. Return `201` with `notification_id`, `user_id`, `email_queued`

**ThingsBoard setup:** Rule chain on `remaining_units <= 5` → POST `/webhooks/thingsboard/low-units`. Full steps: **[THINGSBOARD_WEBHOOK.md](./THINGSBOARD_WEBHOOK.md)**.

### End-user API surface (AMI + ThingsBoard)

| Endpoint | Method | ThingsBoard? |
|----------|--------|--------------|
| `/api/v1/meter/register/` | POST | Stores `iot_device_token` |
| `/api/v1/meter/check-units/` | GET | **Yes** — retry pending + read `remaining_units` |
| `/api/v1/meter/apply-wallet-units/` | POST | **Yes** — push telemetry + attribute sync |
| `/api/v1/share/share-units/` | POST | **Yes** (AMI receiver) — same delivery engine |
| `/api/v1/meter/buy-units/` | POST | No (credits unit wallet only) |
| `/api/v1/meter/notifications/` | GET | No (reads alerts created by webhook) |
| `/webhooks/thingsboard/low-units` | POST | Inbound from TB |

### Channel parity (same account)

All channels use the same PostgreSQL state. USSD invokes the same Python services as the REST API (not a separate HTTP loopback).

| Capability | Web | Mobile | USSD |
|------------|-----|--------|------|
| Register AMI + token | ✓ | ✓ | ✓ |
| Top up unit wallet | ✓ | ✓ | ✓ |
| Apply units | ✓ | ✓ | ✓ |
| Share units | ✓ | ✓ | ✓ |
| Check units | ✓ | ✓ | ✓ |
| Low-units notifications | ✓ | ✓ | ✓ (text list) |
| Save alert email | ✓ | ✓ | ✓ |

### Key source files (Django implementation)

| File | Role |
|------|------|
| `backend/meter/services.py` | `push_units_to_thingsboard()`, `query_latest_units_from_thingsboard()`, `increment_shared_remaining_units()` |
| `backend/meter/ami_delivery.py` | `credit_ami_meter()`, `retry_pending_for_meter()`, offline reconciliation |
| `backend/meter/tasks.py` | `retry_pending_ami_deliveries` (Celery beat, every 5 min) |
| `backend/utils/ami_gateway.py` | `apply_units_to_meter()` — delegates AMI to `ami_delivery` |
| `backend/meter/api/views.py` | Check-units, notifications, apply-wallet, ami-status |
| `backend/webhooks/api/views.py` | `ThingsBoardLowUnitsWebhookView` |
| `backend/ussd/views.py` | USSD Manage / check units / alerts |
| `backend/accounts/tasks.py` | `handle_send_low_units_alert_email` |
| `backend/meter/models.py` | `Meter`, `MeterNotification` |
| `frontend/.../my-meters-client.tsx` | Ledger, pending delivery, live balance, Check Units |
| `frontend/.../notification-bell.tsx` | Web notification bell UI |
| `frontend/.../ami-status-card.tsx` | AMI check-units + apply wallet UI |

*Earlier FastAPI paths (`backend/app/...`) in sections below describe the same behaviour; use the Django files above in this repo.*

### Testing checklist

| Test | Command / action | Expected |
|------|------------------|----------|
| Push telemetry | `POST .../api/v1/{token}/telemetry` with `payment` + `amount` | HTTP 200 |
| Read units | `GET .../api/v1/{token}/attributes?sharedKeys=remaining_units` | `shared.remaining_units` present |
| gPAWA check-units | `GET /meters/{id}/check-units` with JWT | `units_kwh` matches TB |
| Low-units webhook | `POST /webhooks/thingsboard/low-units` | HTTP 201, notification in app |
| Apply flow | Top up wallet → Load Units on AMI meter | TB telemetry + attribute sync; ledger ↑ or pending queue |
| Offline retry | Disconnect meter → Load Units → reconnect | Pending clears within 5 min or on Check Units |
| Pending queue | Load while TB unreachable | `pending_delivery_kwh` > 0; auto-delivered when online |

### Known limitations and assumptions

1. **Two “balances”:** `meter.units` is the **ledger** (delivered to ThingsBoard); `remaining_units` is the **live field reading**. They differ when the customer has consumed power, or when delivery is still pending.  
2. **Top Up ≠ Load:** wallet top-up does not change meter balances until Load Units or share.  
3. **Check units** reads `remaining_units` (shared/server/client attribute, telemetry fallback). gPAWA writes this attribute on each successful delivery when tenant credentials are configured.  
4. **Pending delivery** (`meter.pending_units` on AMI) is retried by Celery every 5 minutes and on Check Units.  
5. **Low-units alerts** require ThingsBoard rule-chain configuration and a **public** gPAWA webhook URL.  
6. **Push path** uses telemetry key `amount`; **read path** uses attribute key `remaining_units`.  
7. **Device access token** is used for device HTTP API; **tenant JWT** is used for shared-attribute writes and timeseries.  
8. **Email alerts** require SMTP env vars and user-saved email.

### Related documentation

| Document | Contents |
|----------|----------|
| **[THINGSBOARD_WEBHOOK.md](./THINGSBOARD_WEBHOOK.md)** | Rule chain setup, webhook payload, manual tests, env vars, troubleshooting |
| **[THINGSBOARD_INTEGRATION_REPORT.md](./THINGSBOARD_INTEGRATION_REPORT.md)** | Full integration report (non-technical + technical) |
| **[SYSTEM_REPORT.md](./SYSTEM_REPORT.md)** | Platform-wide flows and channel parity |
| **[RUNBOOK.md](../RUNBOOK.md)** | Operations, AMI push errors, migrations |

---

*This report describes the integration as implemented in the gPAWA codebase. ThingsBoard rule chains and device firmware behaviour on the Soroti/ERA test deployment should be validated against the live instance at `iot.energy-share.sun.ac.ug`.*
