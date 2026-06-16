# gPawa ThingsBoard Integration Guide (Web, USSD, Mobile API)

This document explains:
- how gPawa channels connect to ThingsBoard,
- what logic runs in each flow,
- and how to test end-to-end.

It also answers whether there is an Android app version in this repository.

---

## 1) Quick answer: Do we already have an Android app?

Short answer: **No native Android app is present in this repo yet**.

Current channels available:
- **Web app** (Next.js frontend)
- **USSD** (Django USSD endpoint + browser simulator)
- **Backend APIs** that can be consumed by a future mobile app

Evidence in repo:
- No `android/` project, no `build.gradle`, no Flutter/React Native project structure.
- `MOBILE_APP` appears as a channel enum value in backend models, but there is no standalone Android client implementation here yet.

---

## 2) What you were given — and what it means

Your team gave you a **single HTTP command** that tells the IoT platform to add units to a physical meter. That command is the “contract” between gPawa and the metering hardware.

### 2.1 The command you received

```bash
curl -X POST "https://iot.energy-share.sun.ac.ug/api/v1/fyU8TAtCtoJWX7WzBH34/telemetry" \
  -H "Content-Type: application/json" \
  -d "{\"payment\":true,\"amount\":8.2}"
```

In plain language: **“Send 8.2 units of electricity credit to Meter 1.”**

This is not a gPawa URL. It goes straight to **ThingsBoard** — the IoT server where the physical meter is registered and monitored.

### 2.2 What ThingsBoard is (in this project)

Think of ThingsBoard as the **middle layer between your business app and the physical meter**:

```
User (web / USSD / future mobile)
        │
        ▼
   gPawa backend (Django)     ← records payment, wallet, loans
        │
        │  POST telemetry: { payment: true, amount: 8.2 }
        ▼
   ThingsBoard (iot.energy-share.sun.ac.ug)   ← IoT platform
        │
        │  rules / device profile / firmware logic
        ▼
   Physical prepaid meter (Meter 1)   ← balance updates on device
```

- **gPawa** handles users, money, loans, USSD menus, and wallets.
- **ThingsBoard** knows which physical device is “Meter 1” and forwards credit instructions to it (or to whatever gateway/firmware listens on that device).
- **The meter** is the end device that actually receives and applies the units.

You were given the **ThingsBoard side** of the link — the exact HTTP call that credits a meter.

### 2.3 Breaking down each part of the URL

| Part | Example | Meaning |
|------|---------|---------|
| `https://iot.energy-share.sun.ac.ug` | ThingsBoard server | Where the IoT platform lives. gPawa stores this as `THINGSBOARD_BASE_URL`. |
| `/api/v1/` | API version | Standard ThingsBoard device HTTP API. |
| `fyU8TAtCtoJWX7WzBH34` | Device access token | **Secret ID for Meter 1** on ThingsBoard. Each physical meter has its own token. This is **not** the meter number shown to users — it is the IoT credential. |
| `/telemetry` | Telemetry endpoint | “Send device data / events to ThingsBoard.” Here, the data is a payment credit event. |

So the full path means: *“Post a telemetry message to the device identified by token `fyU8TAtCtoJWX7WzBH34`.”*

### 2.4 Breaking down the JSON body

```json
{
  "payment": true,
  "amount": 8.2
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `payment` | `true` | This is a **credit/purchase event**, not random sensor data. The meter firmware or ThingsBoard rule is expected to treat this as “add units to balance.” |
| `amount` | `8.2` | **How many units (kWh)** to credit. In your example, 8.2 units are added to Meter 1. |

gPawa may also send `tx_ref` (transaction reference) when pushing from buy/loan flows — useful for audit trails. Your sample curl did not include it; that is fine for a manual test.

### 2.5 How it is meant to work (end-to-end)

**Manual test (what you were given):**

1. You run the curl command (or PowerShell equivalent).
2. ThingsBoard receives `payment: true` and `amount: 8.2` for device token `fyU8TAtCtoJWX7WzBH34`.
3. ThingsBoard applies its device rules / forwards to the meter.
4. Meter 1’s balance increases by 8.2 units (visible on the device or in ThingsBoard dashboards).

**Production flow (how gPawa is wired):**

1. User buys units on **web** or **USSD** (or disburses/repays a loan).
2. gPawa backend completes the business logic (payment, wallet, loan records).
3. Backend looks up the user’s `Meter` row and reads `iot_device_token`.
4. Backend calls the **same** ThingsBoard URL and payload your curl uses (`push_units_to_thingsboard` in `backend/meter/services.py`).
5. ThingsBoard → physical meter, same as the manual curl.

Important: **Web and USSD never call ThingsBoard directly.** Only the Django backend does, using the token stored on each meter.

### 2.6 What you must configure in gPawa for this to work

| Where | What to set | Meter 1 example |
|-------|-------------|-----------------|
| Backend `.env` | `THINGSBOARD_BASE_URL` | `https://iot.energy-share.sun.ac.ug` |
| Database `Meter` row | `iot_device_token` | `fyU8TAtCtoJWX7WzBH34` |

If `iot_device_token` is empty, gPawa can still credit the **in-app wallet**, but nothing is sent to ThingsBoard — the physical meter will not update.

### 2.7 Quick reference table

| Piece | Value for Meter 1 |
|-------|-------------------|
| ThingsBoard host | `https://iot.energy-share.sun.ac.ug` |
| Device access token | `fyU8TAtCtoJWX7WzBH34` |
| Endpoint | `POST /api/v1/{token}/telemetry` |
| JSON body | `payment: true`, `amount: <units>` |

### 2.8 gPawa uses the same API (not a different one)

When a buy/loan/USSD flow credits units, the backend builds:

```http
POST https://iot.energy-share.sun.ac.ug/api/v1/{meter.iot_device_token}/telemetry
Content-Type: application/json

{"payment": true, "amount": 8.2, "tx_ref": "optional-reference-id"}
```

`tx_ref` is optional metadata gPawa adds when it has a transaction or loan ID.

### 2.9 Map Meter 1 in the database

For gPawa flows to hit Meter 1 on ThingsBoard, the meter row for that user must have:

```text
iot_device_token = fyU8TAtCtoJWX7WzBH34
```

Set via Django admin, SQL, or meter update API. Without this token on the meter record, web/USSD flows will credit the wallet but **will not** reach ThingsBoard.

### 2.10 Windows PowerShell equivalent (same test)

```powershell
Invoke-RestMethod -Method POST `
  -Uri "https://iot.energy-share.sun.ac.ug/api/v1/fyU8TAtCtoJWX7WzBH34/telemetry" `
  -ContentType "application/json" `
  -Body '{"payment":true,"amount":8.2}'
```

If this succeeds (HTTP 2xx and telemetry visible in ThingsBoard), the IoT link is good. Next step: store the token on the meter in gPawa and test through the app.

---

## 3) Architecture overview

ThingsBoard integration is implemented **server-side in Django**, not in frontend pages directly.

Core integration function:
- `backend/meter/services.py` -> `push_units_to_thingsboard(meter, units, reference_id="")`

How it works:
1. Reads meter token from `meter.iot_device_token` (for Meter 1: `fyU8TAtCtoJWX7WzBH34`).
2. Reads base URL from `THINGSBOARD_BASE_URL` (default: `https://iot.energy-share.sun.ac.ug`).
3. Sends telemetry to:
   - `POST {THINGSBOARD_BASE_URL}/api/v1/{DEVICE_ACCESS_TOKEN}/telemetry`
4. Payload sent (matches your curl):
   - `payment: true`
   - `amount: <units as number>` (e.g. `8.2`)
   - `tx_ref: <reference id>` (optional; added by gPawa when available)

Expected success:
- HTTP `2xx` from ThingsBoard.
- Function returns `(True, "ThingsBoard push successful.")`.

Common failure reasons:
- Meter has no `iot_device_token`.
- `THINGSBOARD_BASE_URL` missing/misconfigured.
- ThingsBoard network/timeout/non-2xx response.

---

## 4) Required configuration

### 4.1 Backend environment/settings

In `backend/backend/settings.py`, the integration depends on:
- `THINGSBOARD_BASE_URL`
- `THINGSBOARD_TIMEOUT_SECONDS`

Example `.env` values:

```env
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TIMEOUT_SECONDS=8
```

### 4.2 Meter-level mapping

Each meter must have its ThingsBoard device token in:
- `Meter.iot_device_token` (`backend/meter/models.py`)

Without this token, pushes fail immediately.

---

## 5) Channel-by-channel logic

## 5.1 Web app -> Backend -> ThingsBoard

The web UI does not call ThingsBoard directly. It triggers backend APIs that eventually push telemetry.

Main paths:

1. **Buy Units**
   - API: `/api/v1/meter/buy-units/`
   - Implementation: `backend/meter/api/views.py` (`BuyUnitsView`)
   - In sandbox simulation, `_simulate_sandbox_payment(...)` credits units and calls:
     - `push_units_to_thingsboard(meter, units_purchased, transaction_reference)`

2. **Loan disbursement**
   - API: loan disbursement endpoint in `backend/loan/api/views.py` (`LoanDisbursementView`)
   - After units are disbursed to wallet, backend calls:
     - `push_units_to_thingsboard(meter, units_to_disburse, loan.loan_id)`

3. **Loan repayment**
   - APIs in:
     - `backend/loan/api/views.py` (`LoanRepaymentView`)
     - `backend/loan/api/momo_views.py` (MoMo sandbox and production status paths)
   - On successful repayment unit-credit logic, backend calls:
     - `push_units_to_thingsboard(...)`

4. **Manual test endpoints**
   - User: `/api/v1/meter/test-meter-push/`
   - Admin: `/api/v1/meter/admin-test-meter-push/`
   - These endpoints do not alter balances; they only send telemetry to ThingsBoard.

---

## 5.2 USSD -> Backend -> ThingsBoard

USSD entrypoint:
- `/api/v1/ussd/entry/`
- Implemented in `backend/ussd/views.py`

ThingsBoard-linked USSD flows:

1. **USSD Buy Units**
   - Uses helper `_start_buy_units(...)`.
   - Reuses buy/sandbox simulation logic from `BuyUnitsView`.
   - That simulation path triggers `push_units_to_thingsboard(...)`.

2. **USSD Loan Disbursement**
   - Helper `_disburse_loan(...)`.
   - On disbursement, calls:
     - `push_units_to_thingsboard(meter, units_to_disburse, loan.loan_id)`

3. **USSD Loan Repayment**
   - Helper `_repay_loan(...)`.
   - On repayment, calls:
     - `push_units_to_thingsboard(meter, units_equivalent, repayment.payment_reference)`

USSD simulator support endpoints:
- `/api/v1/ussd/phones/` (phone list)
- `/api/v1/ussd/meters/?phoneNumber=<sender>` (receiver meters excluding sender meter)

Frontend simulator route proxies:
- `frontend/src/app/api/ussd/simulate/route.ts`
- `frontend/src/app/api/ussd/phones/route.ts`
- `frontend/src/app/api/ussd/meters/route.ts`

---

## 5.3 Mobile app linkage status

There is **no native Android app implementation in this repo yet**.

How “mobile” is currently served:
- Browser-based responsive web app on phones.
- USSD for feature phones.
- Backend endpoints are ready for a future Android client; that future app would call the same APIs and get the same ThingsBoard behavior automatically.

---

## 6) End-to-end testing checklist

This section is designed to be followed as-is.

### 6.1 Start services

1. Start backend:
   - `cd backend`
   - activate venv
   - `python manage.py runserver`
2. Start frontend:
   - `cd frontend`
   - `npm run dev`
3. Confirm database is running and has test users/meters.

---

### 6.2 Pre-test data validation

For at least one test user:
1. User exists and can authenticate.
2. User has a `Meter`.
3. Meter has:
   - valid `meter_no`
   - `iot_device_token` set (Meter 1 example: `fyU8TAtCtoJWX7WzBH34`)
4. Backend `.env` has `THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug`.

If any of these are missing, pushes will fail by design.

---

### 6.3 Test 0: Your provided curl (ThingsBoard only, no gPawa)

Run the exact command you were given:

```bash
curl -X POST "https://iot.energy-share.sun.ac.ug/api/v1/fyU8TAtCtoJWX7WzBH34/telemetry" \
  -H "Content-Type: application/json" \
  -d "{\"payment\":true,\"amount\":8.2}"
```

Expected:
- HTTP 200 (or other 2xx)
- New telemetry on the Meter 1 device in ThingsBoard UI (`payment`, `amount`)

This confirms ThingsBoard is reachable before testing gPawa flows.

---

### 6.4 Test A: Direct push via gPawa API (same payload, through Django)

Use the user test endpoint:
- `POST /api/v1/meter/test-meter-push/`
- Body:

```json
{
  "amount": 8.2,
  "reference_id": "TEST-SMOKE-001"
}
```

Expected:
- `success: true`
- message similar to `"ThingsBoard push successful."`
- ThingsBoard receives the same shape as your curl, plus optional `tx_ref`

If failed, fix `iot_device_token` / `THINGSBOARD_BASE_URL` first before deeper flow tests.

---

### 6.5 Test B: Web buy-units flow

1. Log in to web dashboard.
2. Run Buy Units with valid amount + phone number.
3. In sandbox mode, wait for async completion.
4. Check payment status endpoint/UI until transaction is complete.
5. Verify:
   - unit wallet credited,
   - transaction completed,
   - transaction message includes meter push outcome.
6. Confirm telemetry appears in ThingsBoard device telemetry timeline.

---

### 6.6 Test C: USSD buy-units flow (simulator)

1. Open `/ussd-simulator`.
2. Select phone number.
3. Dial and follow menu:
   - Buy Units -> Start purchase -> Enter amount
4. Check payment status via USSD option.
5. Verify:
   - transaction completes,
   - telemetry appears in ThingsBoard.

---

### 6.7 Test D: Loan disbursement push

1. Create/approve a loan for a user (or use existing APPROVED loan).
2. Trigger disbursement (web or API/USSD path).
3. Verify API response includes `meter_push` status.
4. Confirm telemetry in ThingsBoard with loan reference.

---

### 6.8 Test E: Loan repayment push

1. Use a DISBURSED loan with outstanding balance.
2. Repay part/all amount via repayment endpoint or USSD flow.
3. Verify:
   - repayment recorded,
   - units equivalent handled,
   - ThingsBoard push attempted and logged.
4. Confirm telemetry in ThingsBoard with repayment reference.

---

## 7) Troubleshooting guide

If push fails with meter token message:
- Set `Meter.iot_device_token` on the target meter.

If push fails with base URL message:
- Set `THINGSBOARD_BASE_URL` correctly in backend `.env`.

If push returns HTTP non-2xx:
- Validate device access token belongs to the target device.
- Validate ThingsBoard URL and route `/api/v1/{token}/telemetry`.
- Check ThingsBoard side auth/network restrictions.

If flow succeeds functionally but no telemetry appears:
- Confirm you are checking the same device token/device in ThingsBoard.
- Check backend logs for warning lines from `meter.services`.

---

## 8) Recommended next step (Android)

If you want Android next, the fastest path is:
1. Build Android client (native Kotlin or React Native/Flutter).
2. Authenticate against existing Django JWT endpoints.
3. Reuse existing meter/loan APIs.
4. Keep ThingsBoard calls server-side only (already done), so Android remains thin and secure.

