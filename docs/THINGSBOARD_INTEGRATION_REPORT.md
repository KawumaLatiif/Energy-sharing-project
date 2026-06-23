# gPAWA ↔ ThingsBoard Integration Report

> **This repo (Django):** Implementation lives under `backend/meter/services.py`, `backend/utils/ami_gateway.py`, `backend/webhooks/api/views.py`, and `backend/meter/api/views.py`. See also [`THINGSBOARD_WEBHOOK.md`](./THINGSBOARD_WEBHOOK.md). The sections below describe the full product behaviour; FastAPI paths in Part 2 are from an earlier prototype and map to the Django files above.

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
2. **Customer applies or shares units** to an AMI meter registered on their account.
3. **gPAWA tells ThingsBoard** to credit that meter.
4. **ThingsBoard forwards** the credit to the real device in the field.

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

On the **AMI meter detail** page (web/mobile) or via **USSD → Manage → My meters**, the user can tap **Check units**. gPAWA asks ThingsBoard for the current **remaining units** and shows the result. This only runs when the user asks — it is **not** continuous polling.

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

- ThingsBoard must expose **`remaining_units`** as a shared attribute for “Check units” to work.  
- ThingsBoard **rule chains** must be configured to POST low-units alerts to gPAWA (not automatic until configured).  
- gPAWA’s server must be reachable from ThingsBoard for alerts (public URL, not `localhost`).  
- Physical meters must be online and correctly provisioned in ThingsBoard.

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

**STS meters** never call ThingsBoard. **AMI meters** always go through `app/services/thingsboard.py`.

### Configuration (`backend/app/config.py`)

| Variable | Default / purpose |
|----------|-------------------|
| `THINGSBOARD_BASE_URL` | `https://iot.energy-share.sun.ac.ug` |
| `THINGSBOARD_TIMEOUT_SECONDS` | `8` |
| `THINGSBOARD_WEBHOOK_SECRET` | Optional shared secret for inbound webhook |
| `THINGSBOARD_TENANT_USERNAME` / `PASSWORD` | Reserved; not used for check-units (device-token API is canonical) |
| `WEB_PORTAL_URL` | Deep links in alert emails |
| SMTP settings | Optional email for low-units alerts |

### Data model

**`meters` table (AMI-relevant columns):**

| Column | Purpose |
|--------|---------|
| `architecture` | `STS` or `AMI` |
| `iot_device_token` | ThingsBoard **device access token** |
| `thingsboard_device_id` | Optional UUID (reserved for future tenant API reads) |
| `balance_kwh` | gPAWA’s ledger of units credited via apply/share (not live TB reading) |

**`meter_notifications` table:** stores low-units alerts from the webhook (`device_token`, `units_kwh`, `occurred_at`, etc.).

**`users.email`:** contact address for alert emails (`PATCH /auth/email`).

### Integration flows (technical)

#### 1. Push units to meter (outbound)

**Service:** `push_units_to_thingsboard()` in `backend/app/services/thingsboard.py`  
**Called from:** `execute_apply_units`, `execute_ami_share` in `backend/app/services/electricity_ops.py`  
**Channels:** Web (`POST /electricity/apply`, `/electricity/share`), mobile, USSD

```http
POST {THINGSBOARD_BASE_URL}/api/v1/{iot_device_token}/telemetry
Content-Type: application/json

{
  "payment": true,
  "amount": <kWh as float>,
  "tx_ref": "<transaction id>"
}
```

**Behaviour:**

- Missing token → failure, no push  
- Token prefix `dev-` → stub success (local testing, no HTTP)  
- HTTP 2xx → success; `meters.balance_kwh` incremented in DB  
- Failure → `GatewayError`; apply/share transaction rolled back  

**Example (verified in testing):**

```bash
curl -X POST "https://iot.energy-share.sun.ac.ug/api/v1/pCqLl8iPI1UKIMCA8w2Z/telemetry" \
  -H "Content-Type: application/json" \
  -d '{"payment":true,"amount":8,"tx_ref":"manual-test-001"}'
```

#### 2. Read remaining units (on-demand inbound query)

**Service:** `query_latest_units_from_thingsboard()`  
**API:** `GET /meters/{meter_id}/check-units` (JWT auth)  
**UI:** Web `MeterAmiDetail.tsx`, mobile `meter_ami_detail_screen.dart`, USSD Manage → My meters  
**USSD:** `ussd_handler.py` → `_check_units_for_meter()`

```http
GET {THINGSBOARD_BASE_URL}/api/v1/{iot_device_token}/attributes?sharedKeys=remaining_units
```

**Example response:**

```json
{"shared":{"remaining_units":0.1710000000000001}}
```

gPAWA maps `shared.remaining_units` → `units_kwh` in the API response. Query timestamp is server time at read (attribute API does not return a device timestamp).

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
| `/meters` | POST | Stores `iot_device_token` |
| `/meters/catalog/list?architecture=AMI` | GET | No |
| `/meters/{id}/check-units` | GET | **Yes** — reads `remaining_units` |
| `/electricity/apply` | POST | **Yes** — push telemetry |
| `/electricity/share` | POST | **Yes** — push telemetry |
| `/wallet/topup-units` | POST | No (credits unit wallet only) |
| `/notifications` | GET | No (reads alerts created by webhook) |
| `/webhooks/thingsboard/low-units` | POST | Inbound from TB |
| `/admin/meters/{id}/ami-credentials` | PATCH | Updates token in DB only |

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
| `backend/meter/services.py` | `push_units_to_thingsboard()`, `query_latest_units_from_thingsboard()` |
| `backend/utils/ami_gateway.py` | `ThingsBoardAMIGateway`, `apply_units_to_meter()` |
| `backend/meter/api/views.py` | Check-units, notifications, apply-wallet, ami-status |
| `backend/webhooks/api/views.py` | `ThingsBoardLowUnitsWebhookView` |
| `backend/ussd/views.py` | USSD Manage / check units / alerts (`_check_units_for_meter`, `_notifications_summary`) |
| `backend/accounts/tasks.py` | `handle_send_low_units_alert_email` |
| `backend/meter/models.py` | `Meter`, `MeterNotification` |
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
| Apply flow | Top up units → Apply on AMI meter | TB telemetry POST + DB balance update |

### Known limitations and assumptions

1. **Two “balances”:** `meters.balance_kwh` in gPAWA is the **ledger** of units sent via gPAWA; `remaining_units` in ThingsBoard is the **live field reading**. They may differ if units were applied outside gPAWA or if the device has not updated attributes yet.  
2. **Check units** depends on ThingsBoard exposing `remaining_units` as a **shared attribute**.  
3. **Low-units alerts** require ThingsBoard rule-chain configuration and a **public** gPAWA webhook URL.  
4. **Push path** uses telemetry key `amount`; **read path** uses attribute key `remaining_units` — ThingsBoard/device firmware must keep these consistent with field logic.  
5. **Device UUID** in ThingsBoard is not used by gPAWA today; only the **access token** matters.  
6. **Email alerts** require SMTP env vars and user-saved email.

### Related documentation

| Document | Contents |
|----------|----------|
| **[THINGSBOARD_WEBHOOK.md](./THINGSBOARD_WEBHOOK.md)** | Rule chain setup, webhook payload, manual tests, env vars, troubleshooting |
| **[THINGSBOARD_INTEGRATION_REPORT.md](./THINGSBOARD_INTEGRATION_REPORT.md)** | Full integration report (non-technical + technical) |
| **[SYSTEM_REPORT.md](./SYSTEM_REPORT.md)** | Platform-wide flows and channel parity |
| **[RUNBOOK.md](../RUNBOOK.md)** | Operations, AMI push errors, migrations |

---

*This report describes the integration as implemented in the gPAWA codebase. ThingsBoard rule chains and device firmware behaviour on the Soroti/ERA test deployment should be validated against the live instance at `iot.energy-share.sun.ac.ug`.*
