# USSD Integration Guide

This project provides a full USSD backend and a **browser-based simulator UI**.

## Core Endpoint

- `POST /api/v1/ussd/entry/`

Expected provider payload (Africa's Talking compatible):

```json
{
  "sessionId": "ATUid_123",
  "serviceCode": "*384*123#",
  "phoneNumber": "+256701234567",
  "text": "2*2*50000"
}
```

USSD response contract:
- `CON <message>` continue session
- `END <message>` end session

## Session Persistence

USSD sessions are persisted in `ussd.UssdSession`:
- key: `sessionId`
- fields tracked: `current_menu`, `last_text`, context values (example: last tx id/share ref)
- expiry: 15 minutes
- retry dedupe: repeated same `text` reuses cached response

---

## Browser Simulator (No CLI)

Use the web simulator page:

- `http://localhost:3000/ussd-simulator`

It uses a frontend proxy route:
- `POST /api/ussd/simulate` (Next.js)
- forwards to backend `POST /api/v1/ussd/entry/`

### Simulator Controls

- **Open Menu**: sends empty `text` for current session
- **Send Reply**: appends your next reply to the current path and sends it
- **Clear Path**: clears the current `text` path
- **New Session**: starts a new `sessionId`

---

## Full Local Setup (Everything Needed)

### Required services

1. **PostgreSQL** running
2. **Django backend** running on `127.0.0.1:8000`
3. **Next.js frontend** running on `localhost:3000`
4. **Database migrated**
5. **Seed/test data loaded** (users + meters) or manually created records

Optional:
- Redis + Celery worker (not mandatory for local when tasks are eager)

### Backend startup

From `backend/`:

```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend startup

From `frontend/`:

```bash
npm install
npm run dev
```

### Quick test path

1. Open `http://localhost:3000/ussd-simulator`
2. Set phone to a known user, for example `+256701234567`
3. Click **Open Menu**
4. Try:
   - `1` for wallet/meter
   - `2 -> 1 -> 30000` for buy units
   - `2 -> 2 -> <transaction_id>` for status
   - `3` loans menu
   - `4` share menu
   - `5` token history

---

## Africa's Talking Testing

### Required services during AT testing

1. PostgreSQL
2. Django backend (`python manage.py runserver`)
3. Public tunnel to backend (for callback URL), e.g. ngrok
4. (Optional) frontend if you also want browser simulator running in parallel

### Steps

1. Start backend:

```bash
cd backend
venv\Scripts\activate
python manage.py runserver
```

2. Expose backend publicly:

```bash
ngrok http 8000
```

3. In Africa's Talking USSD settings, set callback URL:

- `https://<your-ngrok-domain>/api/v1/ussd/entry/`

4. Start a USSD session from AT simulator/device.
5. Ensure the incoming `phoneNumber` maps to an existing user in your DB.

### Common troubleshooting

- **Account not found** -> phone format mismatch between AT payload and `accounts_user.phone_number`
- **No callback hits** -> expired ngrok URL or wrong callback path
- **500 errors** -> backend not running/migrations missing
- **Unexpected repeats** -> provider retries are deduped by session `last_text`

---

## Menu Coverage Implemented

Main menu:
1. Wallet & Meter
2. Buy Units
3. Loans
4. Share Units
5. My Tokens
6. Exit

Key flows implemented:
- buy units start + status poll
- loan apply / latest / disburse / repay / stats
- share initiate + OTP verify
- token lookup

## Notes

- `Buy Units` is blocked when user has active/incomplete loan (by current backend business rule).
- `Share Units` requires OTP verification and minimum 2 units.
- For realistic QA, load heavy seed data:
  - `database/sample_full_dump_heavy.sql`
