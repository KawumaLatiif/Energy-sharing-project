# USSD Integration Guide

This document describes the **actual** USSD behavior implemented in this project: backend handler, session model, menus, business rules, browser simulator, and Africa's Talking setup.

---

## Architecture

| Layer | Role |
|--------|------|
| **Provider** (Africa's Talking, or browser simulator) | Sends `sessionId`, `serviceCode`, `phoneNumber`, `text` on each dial step |
| **Backend** `POST /api/v1/ussd/entry/` | Resolves user by phone, runs menu logic, returns `CON` / `END` plain text |
| **`ussd.UssdSession`** | Persists session id, menu state, context (e.g. last transaction id, last share ref) |
| **Frontend simulator** | `http://localhost:3000/ussd-simulator` → `POST /api/ussd/simulate` → backend |

Authentication on the USSD endpoint: **none** (`AllowAny`). The user is identified only by `phoneNumber` matching `accounts_user.phone_number`.

---

## Request and response contract

### Request (JSON or form fields)

```json
{
  "sessionId": "ATUid_123",
  "serviceCode": "*123#",
  "phoneNumber": "+256701234567",
  "text": "3*2*60000"
}
```

- **`text`**: cumulative menu path, segments separated by `*` (Africa's Talking style).
  - Empty `text` = open main menu.
  - `2` = main menu option 2.
  - `2*1*30000` = Buy Units → Start purchase → amount 30000.

`serviceCode` is stored on the session but does not change routing.

### Response

Plain text body (not JSON), for example:

```text
CON gPawa
1. Wallet & Meter
2. Buy Units
...
```

| Prefix | Meaning |
|--------|---------|
| `CON ` | Session continues; provider should show menu and wait for next input |
| `END ` | Session ends |

---

## Session persistence (`ussd.UssdSession`)

- Keyed by **`sessionId`** (must stay the same for one USSD session).
- **Inactivity timeout**: **90 seconds** by default (`USSD_SESSION_TIMEOUT_SECONDS` in `backend/.env`). This matches the common USSD industry limit for time between user inputs (aligned with typical mobile network USSD session behaviour).
- The timer **resets on every `CON` response** (each menu prompt). If the user does not enter anything within the timeout window, the stored session is considered expired.
- **On expiry**:
  - If the session had prior activity and the user tries again (including pressing **Dial** in the simulator), the backend returns **`END`** with:  
    `Session expired (90s with no input). Dial the service code again to start a new session.`
  - A brand-new session with no prior activity opens the main menu normally.
- **`END` responses** (completed flows, Exit, errors) close the session immediately (`is_active=False`); they do not extend the inactivity timer.
- **Dedupe**: If the same `text` is sent again (provider retry), the cached `last_response` is returned without re-running side effects.
- **Context** stored in JSON, including:
  - `last_buy_transaction_id` — after a successful buy initiation
  - `last_response` — full last `CON`/`END` line

### Configuring timeout

In `backend/.env`:

```env
# Seconds of inactivity before USSD session expires (default 90)
USSD_SESSION_TIMEOUT_SECONDS=90
```

Restart Django after changing this value.

### Simulator note

The browser simulator at `/ussd-simulator` keeps the same `sessionId` until you click **New Session**. If you pause longer than the timeout while a menu is open, the next keypress may return the session-expired `END` message — click **New Session** or dial again to start fresh.

---

## Main menu (`text` empty)

```text
gPawa
1. Wallet & Meter
2. Buy Units
3. Loans
4. Share Units
5. My Tokens
6. Manage
7. Alerts
8. Exit
9. Energy Usage
```

Response: **`CON`**

Selecting **8** ends the session with **`END`** (thank-you). **9** shows a weekly AMI power-usage summary (see below).

---

## 1) Wallet & Meter — `text`: `1`

### Submenu (`text`: `1`)

```text
Wallet & Meter
1. Summary
2. Check units (AMI)
```

**`CON`**

### 1.1 Summary — `1*1`

**`END`** response includes:

- Unit wallet balance (`wallet.Wallet`, units)
- Registered meter number (or `Not registered`)
- Loan summary from **`GET /loans/stats/`** logic (`loan.services.get_user_loan_stats`): pending/active counts and outstanding UGX — same as web portal

### 1.2 Check units (AMI) — `1*2` …

Reads **live** remaining kWh from ThingsBoard (`remaining_units`) via `query_latest_units_from_thingsboard()` — same as web **Check Units**.

- **Single AMI meter:** `1*2` → **`END`** with live (TB) and ledger balances.
- **Multiple AMI meters:** `1*2` → pick list (`CON`), then `1*2*<n>` → **`END`**.

Example response:

```text
Meter 12345678901
Live (TB): 4.50 kWh
Ledger: 10.00 kWh
```

---

## 6) Manage — `text`: `6`

### Submenu (`text`: `6`)

```text
Manage
1. My meters
2. Alerts
3. Apply wallet (AMI)
```

**`CON`**

### 6.1 My meters — `6*1`

**`END`**: lists all meters on the account with architecture (`STS`/`AMI`), ledger balance (kWh), and whether a ThingsBoard token is configured (`TB` / `no-token`).

### 6.2 Alerts — `6*2`

Same as main-menu **7** (see below).

### 6.3 Apply wallet (AMI) — `6*3` …

Moves kWh from the unit wallet to an AMI meter via the same AMI gateway as the web portal (`POST /meter/apply-wallet-units/`).

- **Single AMI meter:** `6*3` → enter amount (`CON`) → `6*3*<kWh>` → **`END`** with meter and wallet balances.
- **Multiple AMI meters:** `6*3` → pick meter (`CON`) → `6*3*<n>` → enter amount → `6*3*<n>*<kWh>` → **`END`**.

Requires sufficient wallet balance. Uses `apply_units_to_meter()` (not manual ledger-only updates).

---

## 7) Alerts — `text`: `7` (or `6*2`)

**`END`**: up to 5 recent `meter_notifications` (e.g. low-units from ThingsBoard webhook). Unread items are prefixed with `*`. Includes unread count.

Alerts are created when ThingsBoard POSTs to `POST /webhooks/thingsboard/low-units` (see [`docs/THINGSBOARD_WEBHOOK.md`](docs/THINGSBOARD_WEBHOOK.md)).

---

## 8) Exit — `text`: `8`

**`END`**: “Thank you for using gPawa.”

---

## 9) Energy Usage — `text`: `9`

Weekly **text-only** energy consumption summary for **AMI meter users** only.

- **Single AMI meter:** `9` → **`END`** with 7-day totals and daily breakdown.
- **Multiple AMI meters:** `9` → pick meter (`CON`) → `9*<n>` → **`END`**.

Example response:

```text
Energy Usage (7 days)
Meter 12345678901
Total: 12.50 kWh
Avg/day: 1.79 kWh
Peak: 3.20 kWh (Mo)
---
Mo 3.2
Tu 1.8
We 1.5
...
```

Non-AMI users receive **`END`**: “This is only for AMI meter users.”

Uses the same backend as web/mobile `GET /meter/power-usage/?period=week`.

---

## Legacy note

Older docs listed **6. Exit**. Exit is now **8**; **6** opens **Manage**. Check units moved from **6*2** to **1*2** (Wallet & Meter).

---

## 2) Buy Units — `text`: `2`

### Submenu (`text`: `2`)

```text
Buy Units
1. Start purchase
2. Check payment status
```

**`CON`**

### 2.1 Start purchase — `2*1*<amount>`

Flow:

1. `2*1` → prompt: **Enter amount in UGX** (`CON`)
2. `2*1*30000` → creates payment transaction, starts processing

Requirements:

- User must have a **registered meter**
- User must **not** have any incomplete loan (`loan.services.user_can_purchase_units` — same as web buy-units API and `has_blocking_loan` on stats)

Sandbox (`MTN_MOMO_CONFIG.ENVIRONMENT=sandbox`):

- Returns **`END`** with `TxID`, `PENDING`, estimated units, tariff code
- Payment is simulated in a **background thread** (~10 seconds), then status becomes `COMPLETED` and units credit the **unit wallet**

Non-sandbox:

- Returns **`END`** with `TxID`; user should use option 2 to poll status (production MoMo hookup is not fully wired in `BuyUnitsView` beyond transaction creation message).

### 2.2 Check payment status — `2*2*<transaction_id>`

1. `2*2` → prompt for transaction ID (`CON`). If a previous buy ran in this session, a tip shows the last `TxID`.
2. `2*2*<id>` or `2*2*0` → **`END`** with `SUCCESS` / `PENDING` / `FAILED` (or error)

Shortcut: enter **`0`** as transaction ID to reuse `last_buy_transaction_id` from session context.

---

## 3) Loans — `text`: `3`

### Submenu (`text`: `3`)

```text
Loans
1. Latest loan
2. Apply loan
3. Disburse loan
4. Repay loan
5. Loan stats
```

**`CON`**

### 3.1 Latest loan — `3*1`

**`END`**: loan DB id, `loan_id` ref, status, requested/approved amounts, outstanding balance.  
If no loans: **`END`** “No loan record found.”

### 3.2 Apply loan — `3*2*<amount>`

1. `3*2` → **Enter amount in UGX (5000-200000)** (`CON`)
2. `3*2*60000` → same **`loan.services.create_loan_application`** as web `POST /loans/apply/`

Rules:

- Requires **meter**
- Blocks if user already has loan in `PENDING`, `APPROVED`, or `DISBURSED` (same as web)
- Amount must be **5000–200000 UGX**; tenure defaults to **6 months** (web model default)
- Uses **`get_active_domestic_tariff()`** and weighted credit score / DB loan tiers

**`END`**: approved (with loan id + ref + approved amount) or rejected (with reason).

### 3.3 Disburse loan — `3*3*<loan_id>`

1. `3*3` → **Enter LoanID to disburse (or 0 for latest approved)** (`CON`)
2. `3*3*<id>` or `3*3*0` → **`loan.services.disburse_loan`** (same as web `POST /loans/disburse/<id>/`)

Effects:

- Creates `LoanDisbursement`
- Sets loan status to **DISBURSED**
- Credits **unit wallet** with calculated units (tariff-based)

**`END`** with loan ref and units added.

### 3.4 Repay loan — `3*4*<loan_id>*<amount>`

1. `3*4` → Enter LoanID (`CON`)
2. `3*4*5` → Enter repayment amount UGX (`CON`)
3. `3*4*5*15000` → **`loan.services.repay_loan`** (same as web `POST /loans/repay/<id>/`)

Rules:

- Loan must be **DISBURSED**
- Amount ≤ outstanding balance
- Credits equivalent units to **meter** (same as web repayment); may set loan to **COMPLETED** if fully paid

**`END`** with payment summary and remaining outstanding.

### 3.5 Loan stats — `3*5`

**`END`**: same fields as web **`GET /loans/stats/`** (pending, active, outstanding, blocking flag).

---

## 4) Share Units — `text`: `4`

Linear flow (same as web/mobile): meter → units → summary → **account PIN** (login password). No email OTP.

1. `4` → Enter receiver meter number (`CON`)
2. `4*<meter>` → Enter units to share, min **2** (`CON`)
3. `4*<meter>*<units>` → Summary (recipient name, meter, type) + enter account PIN (`CON`)
4. `4*<meter>*<units>*<pin>` → completes share (`END`)

Rules:

- Sender must have a meter and enough **unit wallet** balance
- Receiver meter must exist and be active
- **Cannot share to your own meter** — use Manage → Apply wallet (AMI) or Tokens → Generate (STS)
- Minimum **2** units
- PIN = the password for the gPAWA account linked to the dialing phone number

On success (aligned with web `POST /share/share-units/`):

- Deducts sender wallet
- **STS receiver**: generates keypad **token** and emails receiver (token also shown in USSD response)
- **AMI receiver**: pushes units to device via **ThingsBoard**

**`END`** with completion details.

---

## 5) My Tokens — `text`: `5`

### Submenu (`text`: `5`)

```text
My Tokens
1. List unused
2. Generate STS token
```

**`CON`**

### 5.1 List unused — `5*1`

Lists up to **3** unused (`is_used=False`) tokens for the user:

```text
<token> | <units>u | <source>
```

**`END`**. If none: “No active tokens found.”

### 5.2 Generate STS token — `5*2` …

Deducts kWh from the unit wallet and creates an STS keypad token (same as web `POST /meter/generate-token/`).

1. `5*2` → **`CON`**: “Enter kWh from wallet (max …)”
2. `5*2*<kWh>` → **`END`**: token value, units, remaining wallet balance

Requires an STS meter on the account and sufficient wallet balance.

---

## Not implemented on USSD

These exist on the web/API but **not** in the USSD menu:

- Meter **transfer** (old meter → new meter)
- Account registration / login
- Admin operations
- Loan MoMo repay via dedicated USSD MoMo flow (web has `repay/momo/`)
- Customer **meter self-registration** or **removal** (web/mobile **My Meters**; USSD lists meters only via `6*1`)
- **Load / Share Units** combined UI (web/mobile; USSD uses menus **4**, **5*2**, **6*4**)
- Share **receiver preview** before OTP (web/mobile show name/type/phone; USSD verifies on complete)

### Feature parity (customer web vs USSD)

| Feature | Web | USSD |
|---------|-----|------|
| TopUp Wallet (MoMo) | Yes | Yes (menu **2** Buy Units) |
| **My Meters** (list/register/check/load/**delete**) | Yes | Partial (**1*2**, **6*1**, **6*3**; no register/delete) |
| Load Units (own STS) | Yes | Yes (menu **5*2**) |
| Load Units (own AMI) | Yes | Yes (menu **6*3**) |
| Share units + PIN | Yes | Yes (menu **4**; STS token / AMI device on confirm) |
| Share receiver preview | Yes | Yes (summary before PIN) |
| STS token generate | Yes | Yes (`5*2`) |
| Loans apply/disburse/repay | Yes | Yes |
| Loan MoMo repay | Yes | No |
| AMI check units | Yes | Yes (`1*2`) |
| Energy Usage (weekly) | Yes | Yes (`9`) |
| Low-units alerts | Yes | Yes (`6*2`, `7`) |
| Transaction history | Yes | No |
| Meter self-registration / removal | Yes | No |
| Admin-provisioned password change | Yes | N/A |

### ThingsBoard on USSD

| USSD path | ThingsBoard interaction |
|-----------|-------------------------|
| `1*2` / `1*2*<n>` | **Read** `remaining_units` from ThingsBoard (check units) |
| `6*3` / `6*3*…` | **Apply** wallet kWh via AMI gateway (ThingsBoard telemetry when configured) |
| `6*2`, `7` | List low-units **alerts** from TB webhook (no live TB call) |
| Buy / loan disburse / repay | **Push** telemetry via `push_units_to_thingsboard()` |

See [`docs/THINGSBOARD_WEBHOOK.md`](docs/THINGSBOARD_WEBHOOK.md) for webhook setup.

## Browser simulator (recommended for local testing)

### URL

- Page: `http://localhost:3000/ussd-simulator`
- Also linked from dashboard sidebar / account menu: **USSD Simulator**

### How it works

The page builds the same `text` path as a real provider:

| Action | Effect |
|--------|--------|
| **Open Menu** | Sends `text=""` |
| **Send Reply** | Appends input to path (e.g. `2`, then `1`, then `30000` → `2*1*30000`) |
| **Clear Path** | Resets path only (same session id) |
| **New Session** | New `sessionId` and cleared history |

Proxy: `POST /api/ussd/simulate` (Next.js) → `POST http://localhost:8000/api/v1/ussd/entry/`

### Example test sequences

| Goal | Replies to send (in order) |
|------|----------------------------|
| Wallet summary | `1` → `1` |
| Check AMI units (ThingsBoard) | `1` → `2` (or `1` → `2` → `1` if multiple AMI meters) |
| Buy 30000 UGX | `2` → `1` → `30000` |
| Check last buy status | `2` → `2` → `0` |
| Apply loan | `3` → `2` → `60000` |
| Disburse latest approved | `3` → `3` → `0` |
| Share 10 units | `4` → `<receiver_meter>` → `10` → `<login_password>` |
| List tokens | `5` |
| List meters | `6` → `1` |
| Apply wallet to AMI meter | `6` → `3` → `<kWh>` |
| View low-units alerts | `7` or `6` → `2` |

### Seeded test users (heavy dump)

After loading `database/sample_full_dump_heavy.sql`:

| Phone | Email |
|-------|--------|
| `+256701234567` | jane@powercred.local |
| `+256701111111` | john@powercred.local |
| `+256702222222` | mary@powercred.local |
| `+256703333333` | peter@powercred.local |
| `+256704444444` | amina@powercred.local |

Web login password (seed comment): **`Pass1234!`**

---

## Full local setup

### 1. PostgreSQL

Create database `project` and configure `backend/.env`:

```env
DB_NAME=project
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=127.0.0.1
DB_PORT=5432
```

### 2. Backend

```powershell
cd D:\Energy-sharing-project\backend
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py makemigrations ussd
python manage.py migrate
python manage.py runserver
```

### 3. Seed data (optional but recommended)

From project root:

```powershell
psql -U postgres -d project -f database/sample_full_dump_heavy.sql
```

See `database/LOAD_SAMPLE_DB.md` for details.

### 4. Frontend

```powershell
cd D:\Energy-sharing-project\frontend
npm install
npm run dev
```

### 5. Test

Open `http://localhost:3000/ussd-simulator`, set phone `+256701234567`, click **Open Menu**, continue with **Send Reply**.

### Services summary

| Service | Required for USSD |
|---------|-------------------|
| PostgreSQL | Yes |
| Django (`:8000`) | Yes |
| Next.js (`:3000`) | Yes (for browser simulator only) |
| Redis / Celery | Optional locally (`CELERY_TASK_ALWAYS_EAGER=True` by default) |

---

## Africa's Talking integration

### Callback URL

```text
https://<your-public-host>/api/v1/ussd/entry/
```

Local dev: expose port 8000 with ngrok:

```powershell
ngrok http 8000
```

### Checklist

1. Backend running and migrated.
2. ngrok (or deployed HTTPS) pointing to Django.
3. AT USSD channel callback = `/api/v1/ussd/entry/` (include `/api/v1` prefix).
4. Test MSISDN matches a user in DB (same normalization as local: `+256...` or local format; backend matches last 9 digits).
5. User has meter for buy/loan/share flows.

### Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Account not found | Phone not in `accounts_user` |
| Cannot buy units | Active loan not completed/rejected |
| Payment stays PENDING | Sandbox still processing; wait ~10s and check status again |
| Share fails | Wrong PIN; insufficient balance; invalid meter |
| Session expired message | No input for 90s (configurable); dial service code again or use simulator **New Session** |
| Duplicate charges on retry | Should not happen if `sessionId` + `text` unchanged (dedupe) |

---

## Source files

| File | Purpose |
|------|---------|
| `backend/ussd/views.py` | Menu logic and integrations |
| `backend/ussd/models.py` | `UssdSession` model |
| `backend/ussd/urls.py` | `entry/` route |
| `backend/backend/api1.py` | Mounts `ussd/` under `/api/v1/` |
| `frontend/src/app/ussd-simulator/page.tsx` | Browser UI |
| `frontend/src/app/api/ussd/simulate/route.ts` | Proxy to backend |

---

## Related docs

- `database/LOAD_SAMPLE_DB.md` — seed dumps
- `API_ROUTE_CATALOG.md` — full REST API list
- `API_PAYLOAD_EXAMPLES.md` — REST examples (separate from USSD plain-text flow)
- [`docs/THINGSBOARD_INTEGRATION_GUIDE.md`](docs/THINGSBOARD_INTEGRATION_GUIDE.md) — AMI / ThingsBoard
- [`docs/THINGSBOARD_WEBHOOK.md`](docs/THINGSBOARD_WEBHOOK.md) — low-units webhook
