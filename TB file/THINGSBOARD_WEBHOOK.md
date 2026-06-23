# ThingsBoard ↔ gPAWA: low-units alerts & integration reference

This document covers **inbound** low-units webhooks (ThingsBoard → gPAWA), manual testing, and rule-chain setup.

For the full integration picture (push, check units, channels), see **[THINGSBOARD_INTEGRATION_REPORT.md](./THINGSBOARD_INTEGRATION_REPORT.md)**.

**ThingsBoard instance (pilot):** `https://iot.energy-share.sun.ac.ug`

---

## 1. What this webhook does

When an AMI meter’s remaining units drop to **≤ 5 kWh**, ThingsBoard should POST to gPAWA. gPAWA then:

1. Finds the gPAWA user who owns that meter (by **device access token**)
2. Saves a row in `meter_notifications`
3. Pushes an in-app alert (web notification bell via Socket.IO; mobile/USSD lists)
4. Sends an **email** if the user saved a contact email and SMTP is configured

This is **not automatic** until you configure a ThingsBoard **rule chain** and gPAWA prerequisites below.

---

## 2. gPAWA prerequisites (before ThingsBoard)

| # | Requirement |
|---|-------------|
| 1 | Migrations **014** and **015** applied (`meter_notifications`, `users.email`) |
| 2 | AMI meter registered in gPAWA with **`iot_device_token`** = ThingsBoard **access token** |
| 3 | gPAWA API **publicly reachable** from the ThingsBoard server (not `localhost`) |
| 4 | Optional: `THINGSBOARD_WEBHOOK_SECRET` in `backend/.env` |
| 5 | Optional: SMTP + `WEB_PORTAL_URL` for email alerts |
| 6 | User saved email under **My Account → Contact email** |

---

## 3. Webhook API

### Endpoint

| Item | Value |
|------|--------|
| Method | `POST` |
| URL (local dev) | `http://localhost:8000/webhooks/thingsboard/low-units` |
| URL (production) | `https://<your-gpawa-api-host>/webhooks/thingsboard/low-units` |
| Content-Type | `application/json` |
| Optional header | `X-ThingsBoard-Webhook-Secret: <THINGSBOARD_WEBHOOK_SECRET>` |

### Request body

```json
{
  "device_token": "pCqLl8iPI1UKIMCA8w2Z",
  "units_kwh": 4.5,
  "occurred_at": "2026-06-22T14:30:00+03:00"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `device_token` | string | ThingsBoard **device access token** (= gPAWA `iot_device_token`) |
| `units_kwh` | number | Remaining kWh when the alert fired |
| `occurred_at` | string | ISO-8601 date/time (UTC or with offset) |

**Do not** send the ThingsBoard internal device UUID — only the **access token**.

### Success response (`201`)

```json
{
  "success": true,
  "notification_id": "…",
  "user_id": "…",
  "owner_name": "Joe",
  "email_queued": true
}
```

### Error responses

| HTTP | Meaning |
|------|---------|
| `404` | No active AMI meter in gPAWA with that `device_token` |
| `401` | Webhook secret mismatch |
| `422` | Invalid JSON or missing required fields |

---

## 4. ThingsBoard rule chain configuration

### 4.1 What to monitor

gPAWA **Check units** reads the shared attribute **`remaining_units`**:

```http
GET https://iot.energy-share.sun.ac.ug/api/v1/{token}/attributes?sharedKeys=remaining_units
```

Example response:

```json
{"shared":{"remaining_units":0.171}}
```

Your rule chain should fire when **`remaining_units` ≤ 5**.

| Source | Rule chain trigger node |
|--------|-------------------------|
| `remaining_units` in **shared/server attributes** | **Attributes updated** |
| `remaining_units` in **telemetry** | **Post telemetry** |

Use the same key your device/firmware actually updates.

> **Note:** gPAWA **pushes** credits via telemetry key `amount` (`payment: true`). The **low-units alert** should watch **`remaining_units`** (live balance), not `amount`.

### 4.2 Per-device setup

For each AMI device in ThingsBoard:

1. Copy **device access token** from **Manage credentials**
2. Register the same token on the matching AMI meter in gPAWA
3. **(Recommended)** Store token as server/shared attribute `accessToken` or `gpawa_device_token` for the rule script

### 4.3 Rule chain flow

```text
[Input / Message Type Switch]
        │
        ▼
[Script filter: remaining_units <= 5]
        │
        ▼
[Originator attributes]  ← load accessToken (optional)
        │
        ▼
[Transform Script]  ← build JSON body
        │
        ▼
[REST API Call]  POST → gPAWA webhook
```

Attach the chain to your AMI **device profile** (Device profiles → Default rule chain).

### 4.4 Filter script (≤ 5 kWh)

```javascript
var units = msg.remaining_units;
if (units === undefined || units === null) {
    return false;
}
return Number(units) <= 5;
```

### 4.5 Transform script (build POST body)

```javascript
var units = Number(msg.remaining_units);
var token = metadata.ss_accessToken
         || metadata.shared_accessToken
         || metadata.gpawa_device_token;

if (!token) {
    return { msg: {}, metadata: metadata, msgType: msgType };
}

var payload = {
    device_token: String(token),
    units_kwh: units,
    occurred_at: new Date().toISOString()
};

return { msg: payload, metadata: metadata, msgType: msgType };
```

Adjust `metadata.*` names to match your enrichment node output.

### 4.6 REST API Call node

| Setting | Value |
|---------|--------|
| Method | `POST` |
| URL | `https://<your-gpawa-api>/webhooks/thingsboard/low-units` |
| Headers | `Content-Type: application/json` |
| | `X-ThingsBoard-Webhook-Secret: …` *(if configured)* |
| Body | JSON from transform node |

### 4.7 Avoid duplicate alerts (recommended)

Without deduplication, every update while units stay ≤ 5 may POST again. Options:

- Fire only when crossing from **> 5** to **≤ 5** (store `low_units_alert_sent` server attribute)
- Cooldown (e.g. 24 h) per device

---

## 5. Manual testing

### 5.1 Test gPAWA webhook (PowerShell)

Save JSON to a file to avoid quoting issues:

```powershell
@'
{"device_token":"pCqLl8iPI1UKIMCA8w2Z","units_kwh":4.5,"occurred_at":"2026-06-22T14:30:00+03:00"}
'@ | Set-Content -Encoding utf8 webhook-test.json

curl.exe -s -w "`nHTTP:%{http_code}`n" `
  -X POST "http://localhost:8000/webhooks/thingsboard/low-units" `
  -H "Content-Type: application/json" `
  -H "X-ThingsBoard-Webhook-Secret: your-secret-if-configured" `
  -d "@webhook-test.json"
```

Expected: `HTTP:201` and `"success": true`.

### 5.2 Test ThingsBoard read path (Check units)

```bash
curl -X GET "https://iot.energy-share.sun.ac.ug/api/v1/pCqLl8iPI1UKIMCA8w2Z/attributes?sharedKeys=remaining_units"
```

### 5.3 Test push path (apply / share)

```bash
curl -X POST "https://iot.energy-share.sun.ac.ug/api/v1/pCqLl8iPI1UKIMCA8w2Z/telemetry" \
  -H "Content-Type: application/json" \
  -d '{"payment":true,"amount":8,"tx_ref":"manual-test-001"}'
```

### 5.4 Test from ThingsBoard UI

1. Set/simulate `remaining_units` = **4** on a device
2. Check **Rule chain → Events**
3. Confirm REST call returned **201** from gPAWA
4. User sees notification on web/mobile; USSD menu **10** or Manage **7**

---

## 6. Check units (user-initiated, not webhook)

Users tap **Check units** on the AMI meter page (web/mobile) or USSD **Manage → My meters**.

| Item | Value |
|------|--------|
| gPAWA API | `GET /meters/{meter_id}/check-units` (JWT) |
| ThingsBoard call | `GET …/api/v1/{token}/attributes?sharedKeys=remaining_units` |
| Implementation | `backend/app/services/thingsboard.py` → `query_latest_units_from_thingsboard()` |

On-demand only — no continuous polling.

---

## 7. Push units (gPAWA → ThingsBoard)

When users **apply** or **share** kWh:

```http
POST {THINGSBOARD_BASE_URL}/api/v1/{iot_device_token}/telemetry
Content-Type: application/json

{"payment": true, "amount": <kWh>, "tx_ref": "<transaction id>"}
```

Implementation: `push_units_to_thingsboard()` in `backend/app/services/thingsboard.py`, called from `electricity_ops.py`.

---

## 8. Environment variables

```env
# ThingsBoard
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TIMEOUT_SECONDS=8
THINGSBOARD_WEBHOOK_SECRET=choose-a-long-random-string

# Email alerts (optional)
WEB_PORTAL_URL=https://your-web-portal.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=alerts@gpawa.ug
SMTP_USE_TLS=true
```

`THINGSBOARD_TENANT_USERNAME` / `PASSWORD` are optional and **not used** for Check units today (device-token HTTP API is canonical).

---

## 9. Where users see alerts

| Channel | How |
|---------|-----|
| Web | Notification bell (dashboard + header); Socket.IO `notification:new` |
| Mobile | Notifications screen; unread badge on home |
| USSD | Main menu **10** or Manage **9 → 7** |
| Email | If `users.email` set + SMTP configured; **Check units** button links to login → AMI meter page |

---

## 10. Related files

| Path | Role |
|------|------|
| `backend/app/routers/webhooks.py` | Webhook handler |
| `backend/app/services/thingsboard.py` | Push + read `remaining_units` |
| `backend/app/services/email.py` | Alert email template |
| `backend/app/routers/notifications.py` | User notification API |
| `backend/migrations/014_notifications_and_tb_device.sql` | Notifications table |
| `backend/migrations/015_user_email.sql` | User email column |
| `docs/THINGSBOARD_INTEGRATION_REPORT.md` | Full integration report |

---

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| gPAWA `404` on webhook | Register AMI meter with matching access token |
| gPAWA `401` | Match `X-ThingsBoard-Webhook-Secret` to `.env` |
| Rule never fires | Wrong trigger (telemetry vs attributes); wrong key name |
| REST fails from TB | Use public gPAWA URL; check firewall |
| Check units fails | Ensure `remaining_units` shared attribute exists on device |
| Push fails HTTP 401 | Invalid `iot_device_token`; see `RUNBOOK.md` AMI section |
| No email | Set SMTP env vars; user must save email in My Account |
