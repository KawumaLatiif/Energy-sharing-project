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
- **Expiry**: 15 minutes; expired sessions are reset on next request.
- **Dedupe**: If the same `text` is sent again (provider retry), the cached `last_response` is returned without re-running side effects.
- **Context** stored in JSON, including:
  - `last_buy_transaction_id` — after a successful buy initiation
  - `last_share_ref` — after share initiate
  - `last_response` — full last `CON`/`END` line

---

## Main menu (`text` empty)

```text
gPawa
1. Wallet & Meter
2. Buy Units
3. Loans
4. Share Units
5. My Tokens
6. Exit
```

Response: **`CON`**

Selecting **6** or any unknown first digit ends the session with **`END`** (thank-you / invalid path message).

---

## 1) Wallet & Meter — `text`: `1`

**`END`** response includes:

- Unit wallet balance (`wallet.Wallet`, units)
- Registered meter number (or `Not registered`)
- Total outstanding on **DISBURSED** loans (UGX)

One-shot; no submenu.

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
- User must **not** have any loan except `COMPLETED` or `REJECTED` (blocks buy if loan is pending/approved/disbursed/defaulted)

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
2. `3*2*60000` → credit scoring + tier → creates `LoanApplication`

Rules:

- Requires **meter**
- Blocks if user already has loan in `PENDING`, `APPROVED`, or `DISBURSED`
- Amount must be **5000–200000 UGX**
- Approval uses weighted credit score and DB **loan tiers** (`get_tier_by_score`)

**`END`**: approved (with loan id + ref + approved amount) or rejected (with reason).

### 3.3 Disburse loan — `3*3*<loan_id>`

1. `3*3` → **Enter LoanID to disburse (or 0 for latest approved)** (`CON`)
2. `3*3*<id>` or `3*3*0` → disburses **APPROVED** loan only

Effects:

- Creates `LoanDisbursement`
- Sets loan status to **DISBURSED**
- Credits **unit wallet** with calculated units (tariff-based)

**`END`** with loan ref and units added.

### 3.4 Repay loan — `3*4*<loan_id>*<amount>`

1. `3*4` → Enter LoanID (`CON`)
2. `3*4*5` → Enter repayment amount UGX (`CON`)
3. `3*4*5*15000` → repayment

Rules:

- Loan must be **DISBURSED**
- Amount ≤ outstanding balance
- Credits equivalent units to unit wallet; may set loan to **COMPLETED** if fully paid

**`END`** with payment summary and remaining outstanding.

### 3.5 Loan stats — `3*5`

**`END`**: counts for pending/active loans and total outstanding (UGX).

---

## 4) Share Units — `text`: `4`

OTP is created in the database (`share.VerificationCode`, purpose `share_units`, 10 minutes). The **same email/Celery flow as the web app is not triggered from USSD initiate** in the current code—OTP must be obtained from DB/admin or extended later. For testing, check verification codes in Django admin or DB after initiate.

### Submenu (`text`: `4`)

```text
Share Units
1. Initiate share
2. Verify OTP
```

**`CON`**

### 4.1 Initiate share — `4*1*<meter>*<units>`

1. `4*1` → receiver meter number (`CON`)
2. `4*1*1234567891` → units to share, min **2** (`CON`)
3. `4*1*1234567891*10` → creates **PENDING** `ShareTransaction`, creates OTP record

Rules:

- Sender must have a meter and enough **unit wallet** balance
- Receiver meter must exist
- Minimum **2** units
- Cancels older pending shares from same sender

**`END`**: transaction ref; session stores `last_share_ref`.

### 4.2 Verify OTP — `4*2*<ref>*<otp>`

1. `4*2` → transaction ref (`CON`); tip shows last ref if available
2. `4*2*SHARE-ABC12345` → 6-digit OTP (`CON`)
3. `4*2*<ref>*123456` or `4*2*0*123456` (ref **`0`** = last share ref)

On success:

- Deducts sender wallet
- **Self-share** (same meter): issues **meter token** in response
- **Other meter**: credits receiver unit wallet

**`END`** with completion details.

---

## 5) My Tokens — `text`: `5`

Lists up to **3** unused (`is_used=False`) tokens for the user:

```text
<token> | <units>u | <source>
```

**`END`**. If none: “No active tokens found.”

---

## Not implemented on USSD

These exist on the web/API but **not** in the USSD menu:

- Meter **transfer** (old meter → new meter)
- Account registration / login
- Admin operations
- Loan MoMo repay via dedicated USSD MoMo flow (web has `repay/momo/`)

---

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
| Wallet summary | `1` |
| Buy 30000 UGX | `2` → `1` → `30000` |
| Check last buy status | `2` → `2` → `0` |
| Apply loan | `3` → `2` → `60000` |
| Disburse latest approved | `3` → `3` → `0` |
| Share 10 units | `4` → `1` → `<receiver_meter>` → `10`, then verify `4` → `2` → `0` → `<otp>` |
| List tokens | `5` |

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
| Share verify fails | Wrong/expired OTP; wrong ref; insufficient balance |
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
