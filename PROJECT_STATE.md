# Energy Sharing Project — Current State

**Date:** June 2026  
**Branch:** `main`  
**Status:** Active development — core features functional, running locally

---

## 1. What This Project Is

A prepaid electricity management platform for Uganda. Users register smart meters, purchase electricity units via MTN Mobile Money, take short-term electricity credit loans, and share units peer-to-peer. Admins manage users, meters, loans, tariffs, and monitor transactions via a web portal.

**Access channels:**
- Web portal (Next.js frontend at `localhost:3000`)
- **Android app** (Expo/React Native in `mobile/` — see [`docs/MOBILE_APP.md`](docs/MOBILE_APP.md))
- USSD (feature phone interface, Africastalking-style)
- REST API (Django backend at `localhost:8000`)

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.2, Django REST Framework, PostgreSQL 17 |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Mobile | Expo SDK 56, React Native (Android) — `mobile/` |
| Auth | JWT (simplejwt), TOTP 2FA (pyotp) |
| Payments | MTN MoMo API (sandbox) |
| Async tasks | Celery 5.6 (runs eagerly/inline in DEBUG — no Redis needed) |
| Email | Gmail SMTP (ssentongojoshua86@gmail.com) |
| Cache/Broker | Redis (only required in production) |

---

## 3. Local Development Setup

### 3.1 Database

- **Engine:** PostgreSQL 17 (service: `postgresql-x64-17`)
- **Database:** `metering`
- **Schema:** `custom` (search_path: `custom,public`)
- **User:** `postgres`  
- **Password:** `Phaneroo1`
- **Host:** `localhost:5432`
- **Migrations:** Run `python manage.py migrate` after pull — includes `accounts.0015_user_must_change_password`, `meter.0016_meternotification`, `meter.0017_meter_power_usage`. See [`docs/PLATFORM_ALIGNMENT.md`](docs/PLATFORM_ALIGNMENT.md).

### 3.2 Backend

```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver          # http://127.0.0.1:8000
```

Key `.env` variables (backend/.env):

```
DEBUG=True
SECRET_KEY=super-secret-key-change-this

# Database
POSTGRES_DB=metering
POSTGRES_USER=postgres
POSTGRES_PASSWORD=Phaneroo1
PG_HOST=localhost
PG_PORT=5432

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=ssentongojoshua86@gmail.com
EMAIL_HOST_PASSWORD=torv wghv ktxw pxxv
DEFAULT_EMAIL_SENDER=ssentongojoshua86@gmail.com

# Celery (runs inline in DEBUG — Redis not needed locally)
CELERY_TASK_ALWAYS_EAGER=True
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0

# MTN MoMo (sandbox)
MTN_SUBSCRIPTION_KEY=58862e0b7b3f4f419a74ca6b89076178
MTN_API_USER_ID=14231880-15e5-455b-8993-cf17328bb6f7
MTN_ENVIRONMENT=sandbox
MTN_CALLBACK_HOST=http://localhost:3030
```

### 3.3 Frontend

```
cd frontend
npm install
npm run dev                         # http://localhost:3000
```

### 3.4 Admin Account

| Field | Value |
|---|---|
| Email | admin@gpawa.com |
| Password | Admin@gPawa2025 |
| Role | ADMIN |
| Email verified | Yes |

---

## 4. Backend Django Apps

### `accounts`
User management, authentication, profiles, wallets.

**Key models:**
- `User` — Custom AbstractUser. Fields: `email` (login), `phone_number`, `user_role` (ADMIN / CLIENT / CUSTOMER_SERVICE / OPERATOR), `kyc_status`, `is_suspended`, `totp_secret`, `totp_enabled`, credit assessment fields.
- `Profile` — `email_verified`, `avatar`, KYC documents.
- `UserAccountDetails` — Address, NIN, next of kin.
- `Wallet` — Balance for each user.
- `SettingsConfirmationEmailCode` — OTP codes for sensitive account changes.

**Signals** (accounts/signals.py):
- On user creation → creates `Profile` (auto-verified only for superusers) + `UserAccountDetails`.
- On Profile creation → sends email verification if not auto-verified.

### `meter`
Meter registration, unit purchasing, token generation, ThingsBoard AMI integration.

**Key models:**
- `Meter` — Linked to user; `architecture` (STS/AMI), `iot_device_token`, `units`, `pending_units`.
- `MeterToken` — Generated tokens with unit values.
- `MeterNotification` — Low-units and other alerts (ThingsBoard webhook).
- `Transaction` — 9 types: PURCHASE, GENERATE_TOKEN, TRANSFER_OUT, TRANSFER_IN, CREDIT, REPAYMENT_AUTO, REPAYMENT_DIRECT, PENALTY, REFUND.

**ThingsBoard services** (`meter/services.py`):
- `push_units_to_thingsboard()` — outbound telemetry
- `query_latest_units_from_thingsboard()` — read `remaining_units`

**Channels:** USSD, MOBILE_APP, WEB_PORTAL, ADMIN.

### `loan`
Electricity credit loan lifecycle.

**Key models:**
- `LoanApplication` — Loan request with status (PENDING / APPROVED / DISBURSED / REPAID / DEFAULTED).
- `LoanTier` — Bronze / Silver / Gold / Platinum tiers with credit limits and interest rates.
- `ElectricityTariff` / `TariffBlock` — Block pricing for unit conversion.
- `UserCreditSignal` — Purchase history signals used to compute credit score.

**Tiers:**
| Tier | Score | Max (UGX) | Rate |
|---|---|---|---|
| Bronze | 75–79% | 50,000 | 12% |
| Silver | 80–84% | 100,000 | 11% |
| Gold | 85–89% | 150,000 | 10% |
| Platinum | 90–100% | 200,000 | 9% |

### `share`
Peer-to-peer unit sharing with OTP verification.

**Rules:** Minimum share = 2.00 units. OTP required. IP + User Agent logged. Atomic transaction.

### `wallet`
User and meter wallet balances.

### `transactions`
Transaction history and logging across all features.

### `portal_admin`
Admin portal operations, audit log, staff management.

**Key models:**
- `AuditLog` — Full audit trail with 21+ action types.
- `FlaggedAccount` — Fraud detection flags (Volume Spike, Rapid Transfers, etc.).
- `StaffInvitation` — Invite flow for OPERATOR / CUSTOMER_SERVICE accounts.
- `ScheduledReport` — Configured auto-reports.

### `ussd`
Feature phone USSD interface (Africastalking-compatible).

**Main menu:** Wallet, Buy, Loans, Share, Tokens, **Manage** (meters / check units / alerts), **Alerts**, Exit.

**ThingsBoard:** `6*2` check live units; `7` or `6*3` list low-units notifications.

### `mtn_momo`
MTN Mobile Money payment integration. Service class only — no ORM models. Currently using sandbox environment.

---

## 5. API Routes (v1)

Base: `http://localhost:8000/api/v1/`

### Auth (`/auth/`)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/register/` | Register new user |
| POST | `/auth/login/` | Login → JWT tokens |
| POST | `/auth/refresh/token/` | Refresh access token |
| GET | `/auth/verify-email/` | Verify email link (uid + token) |
| POST | `/auth/resend-email-link/` | Resend verification email |
| POST | `/auth/forgot-password/` | Initiate password reset |
| POST | `/auth/reset-password/` | Complete password reset |
| GET | `/auth/get-user-config/` | Current user config |
| GET | `/auth/user-profile/` | User profile |
| POST | `/auth/update-account-details/` | Update account info |

### Meter (`/meter/`)
| Method | Path | Description |
|---|---|---|
| GET | `/meter/my-meter/` | List user's meter(s) |
| POST | `/meter/register/` | Register meter (`iot_device_token` for AMI) |
| POST | `/meter/delete/` | Remove meter from account (soft delete + audit) |
| POST | `/meter/buy-units/` | Purchase electricity units |
| POST | `/meter/apply-wallet-units/` | AMI: apply wallet kWh to meter |
| GET | `/meter/check-units/` | AMI: live kWh from ThingsBoard |
| GET | `/meter/ami-status/` | AMI gateway + wallet status |
| GET | `/meter/notifications/` | Meter alerts (low-units) |
| PATCH | `/meter/notifications/` | Mark alerts read |
| POST | `/meter/send-units/` | Send units to another meter |
| GET | `/meter/token/` | List/generate meter tokens |
| POST | `/meter/check-payment-status/` | Check MTN MoMo payment |
| POST | `/meter/test-meter-push/` | Manual ThingsBoard push test |

### ThingsBoard webhook (root)
| Method | Path | Description |
|---|---|---|
| POST | `/webhooks/thingsboard/low-units` | Inbound low-units alert from ThingsBoard |

### Loans (`/loans/`)
| Method | Path | Description |
|---|---|---|
| POST | `/loans/apply/` | Apply for loan |
| GET | `/loans/my-loans/` | User's loan list |
| GET | `/loans/stats/` | Loan statistics |
| GET | `/loans/loan/<id>/` | Loan detail |
| POST | `/loans/repay/<id>/` | Repay loan |
| GET | `/loans/tariffs/` | Active tariffs |

### Share (`/share/`)
| Method | Path | Description |
|---|---|---|
| POST | `/share/share-units/` | Share units (OTP required) |
| POST | `/share/transfer-units/` | Transfer between meters |

### Wallet (`/wallet/`)
| Method | Path | Description |
|---|---|---|
| GET | `/wallet/balance/` | Wallet balance |

### Transactions (`/transactions/`)
| Method | Path | Description |
|---|---|---|
| GET | `/transactions/history/` | Transaction history (paginated) |

### USSD (`/ussd/`)
| Method | Path | Description |
|---|---|---|
| POST | `/ussd/entry/` | USSD session entry point |

### Admin (`/admin/`)
Full admin API for user management, loan approvals, staff, reports, system health, audit log — accessible to ADMIN role only.

---

## 6. Frontend Pages

### Public / Auth
- `/auth/login` — Login
- `/auth/register` — Registration
- `/auth/verify-email` — Email verification (processes uid + token from link)
- `/auth/verify-pending` — "Check your email" holding page
- `/auth/forgot-password` — Forgot password
- `/auth/reset-password` — Reset password

### User Dashboard (`/dashboard/`)
- `/dashboard` — Home: meter status, wallet balance, recent transactions, loan stats
- `/dashboard/buy-units` — Purchase units via MTN MoMo
- `/dashboard/share` — Share units with another user
- `/dashboard/transfering` — Transfer status
- `/dashboard/tokens` — Token history + AMI meter card (check units, apply wallet)
- `/dashboard/myloans` — Active and past loans
- `/dashboard/request-loan` — Loan application
- `/dashboard/request-loan/register-meter` — Register meter (part of loan flow)
- `/dashboard/myaccount` — Account settings
- **Notification bell** — header on all dashboard pages (low-units alerts from ThingsBoard)

### Admin Portal (`/admin/`)
- `/admin/dashboard` — Overview stats
- `/admin/users` — User list + search
- `/admin/users/[id]` — User detail, KYC, suspend, credit limit override
- `/admin/meters` — Meter registry
- `/admin/meters/[id]` — Meter detail, deactivate, transfer ownership
- `/admin/loans` — Loan management (approve, disburse)
- `/admin/loans/[id]` — Loan detail
- `/admin/loan-tiers` — Configure loan tiers
- `/admin/tariffs` — Manage tariff blocks
- `/admin/transactions` — All transactions with filters (type, status, date)
- `/admin/staff` — Staff accounts (invite, deactivate)
- `/admin/reports` — Generate reports (9 types, CSV export)
- `/admin/audit-log` — Read-only audit trail with filters
- `/admin/system-health` — System monitoring dashboard
- `/admin/analytics` — Charts and KPIs
- `/admin/myaccount` — Admin account settings

### Other
- `/ussd-simulator` — Browser-based feature phone simulator for testing USSD flows

---

## 7. Authentication & Security

### JWT Flow
1. User registers → verification email sent (Gmail SMTP)
2. User clicks link → `GET /auth/verify-email/?uid=...&token=...` → account activated
3. User logs in → receives `access` + `refresh` JWT tokens
4. All authenticated requests: `Authorization: Bearer <access_token>`

### 2FA (TOTP)
- Required for staff roles (ADMIN, CUSTOMER_SERVICE, OPERATOR)
- Library: `pyotp`
- Fields on User: `totp_secret`, `totp_enabled`
- Issuer name: `Gpawa Admin`

### Staff Sessions
- 30-minute inactivity timeout
- Enforced by `accounts.middleware.StaffInactivityMiddleware`

### Roles
| Role | Access |
|---|---|
| CLIENT | Dashboard, own data only |
| OPERATOR | Meter operations |
| CUSTOMER_SERVICE | View users, limited actions |
| ADMIN | Full admin portal |

---

## 8. Email System

- **Provider:** Gmail SMTP (`smtp.gmail.com:587`, TLS)
- **Account:** ssentongojoshua86@gmail.com
- **App password:** In `.env` as `EMAIL_HOST_PASSWORD`
- **Status:** SMTP confirmed working (test send returns 1)

**Development note:** In local dev, emails are sent to real inboxes but verification links point to `http://localhost:3000/...`. Gmail may route these to spam. Check the Spam folder — the link itself works fine since your frontend is running locally.

**Task dispatch:** In DEBUG mode (`CELERY_TASK_ALWAYS_EAGER=True`), all email tasks run synchronously inline — no Redis or Celery worker needed. In production, tasks are dispatched via `.delay()`.

---

## 9. Async Tasks (Celery)

The `dispatch_task()` helper in `utils/general.py` handles the DEBUG/production split:

```python
def dispatch_task(task, *args, **kwargs):
    if settings.DEBUG:
        task(*args, **kwargs)   # runs synchronously, no Redis
    else:
        task.delay(*args, **kwargs)
```

All task calls use this helper — no `.delay()` calls appear directly in views or signals.

**Email tasks defined in:**
- `accounts/tasks.py` — `handle_send_email_verification`, `handle_send_email_code`
- `share/tasks.py` — share verification, wallet update, token, transfer verification notifications

---

## 10. Known Issues / Active Work

| Issue | Status |
|---|---|
| Email verification links go to spam (localhost URLs) | Known dev limitation — check Spam folder. Fixed on deployment to real domain. |
| Redis / Celery not running locally | Not needed — `CELERY_TASK_ALWAYS_EAGER=True` bypasses Redis in DEBUG. |
| MTN MoMo on sandbox | Payments use sandbox credentials — no real money. Callbacks go to localhost. |
| No test suite | No unit or integration tests written yet. |

---

## 11. Project Files

```
Energy-sharing-project/
├── backend/                    # Django project
│   ├── accounts/               # Users, auth, profiles, wallets
│   ├── meter/                  # Meters, tokens, unit purchase
│   ├── loan/                   # Credit loans, tariffs, tiers
│   ├── share/                  # Unit sharing/transfer
│   ├── wallet/                 # Wallet balances
│   ├── transactions/           # Transaction history
│   ├── portal_admin/           # Admin operations, audit log
│   ├── ussd/                   # USSD session handling
│   ├── mtn_momo/               # MTN MoMo payment service
│   ├── webhooks/               # ESP32 hardware callbacks
│   ├── utils/                  # Shared helpers (email, general)
│   ├── backend/                # Django project config (settings, urls, celery)
│   ├── .env                    # Environment variables (not committed)
│   └── requirements.txt        # Python dependencies
├── frontend/                   # Next.js project
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # Reusable UI components
│   │   ├── redux/              # State management
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # Utilities, API client
│   └── package.json
├── docs/                       # Additional documentation
├── PROJECT_STATE.md            # This file
├── BACKEND_DOCS.md             # Detailed backend reference
├── API_ROUTE_CATALOG.md        # Full API listing
└── Readme.md                   # Quick start
```

---

## 12. Production Checklist (Not Yet Done)

- [ ] Set `DEBUG=False` in production `.env`
- [ ] Set real `DOMAIN_NAME` (e.g. `app.gpawa.com`) so email links are real URLs
- [ ] Set a strong `SECRET_KEY`
- [ ] Run Redis for Celery broker + result backend
- [ ] Run Celery worker: `celery -A backend worker -l info`
- [ ] Configure Gunicorn + nginx
- [ ] Set `ALLOWED_HOSTS` to production domain
- [ ] Configure SSL (HTTPS)
- [ ] Switch MTN MoMo from sandbox to production credentials
- [ ] Set up PostgreSQL with a non-default user and strong password
- [ ] Configure `MTN_CALLBACK_HOST` to public HTTPS URL
