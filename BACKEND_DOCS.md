# Energy-Sharing Project — Backend Documentation

**Framework:** Django 5.2 + Django REST Framework  
**Database:** PostgreSQL  
**Auth:** JWT (SimpleJWT)  
**Async Tasks:** Celery + Redis  
**Payments:** MTN Mobile Money (MoMo)

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Django Applications](#2-django-applications)
3. [Database Models](#3-database-models)
4. [API Endpoints](#4-api-endpoints)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Configuration & Environment](#6-configuration--environment)
7. [Background Tasks](#7-background-tasks)
8. [Credit Scoring System](#8-credit-scoring-system)
9. [Payment Integration (MTN MoMo)](#9-payment-integration-mtn-momo)
10. [USSD Integration](#10-ussd-integration)
11. [Utilities & Services](#11-utilities--services)
12. [Dependencies](#12-dependencies)
13. [Business Logic Flows](#13-business-logic-flows)

---

## 1. Project Structure

```
backend/
├── accounts/           # User registration, authentication, profiles, wallets
├── admin/              # Admin dashboard and management operations
├── loan/               # Energy loan applications, disbursements, repayments
├── meter/              # Electricity meter registration and token management
├── share/              # Unit sharing between users with OTP verification
├── transactions/       # Transaction history and unit purchase tracking
├── transfer/           # Meter-to-meter transfer requests (admin-approved)
├── wallet/             # Wallet balances and per-meter balance tracking
├── webhooks/           # External integrations (ESP32 device callbacks)
├── ussd/               # USSD menu-driven interface for feature phones
├── mtn_momo/           # MTN MoMo payment service
├── utils/              # Shared utilities, decorators, validators, email
├── backend/            # Django project configuration (settings, urls, celery)
└── requirements.txt    # Python package dependencies
```

---

## 2. Django Applications

| App | Purpose |
|---|---|
| `accounts` | Custom user model, profiles, wallet, email verification, credit signal data |
| `loan` | Loan application lifecycle, tariff pricing, credit scoring, disbursement, repayment |
| `meter` | Meter registration, unit tokens, buy/send/receive unit operations |
| `share` | Peer-to-peer unit sharing with OTP, rate limiting, and audit trails |
| `transactions` | Unit purchases, transaction history, audit log |
| `transfer` | Admin-approved meter-to-meter unit transfers |
| `wallet` | Main wallet and per-meter balance management |
| `admin` | Admin-only views: dashboard, user management, loan management, tier/tariff config |
| `ussd` | USSD session state machine for feature phone access |
| `mtn_momo` | MTN Mobile Money API client (create user, get token, request-to-pay, check status) |
| `webhooks` | Handles callbacks from ESP32 hardware meters; token decryption and verification |
| `utils` | Email sender, custom exceptions, auth token generators, field validators, decorators |

---

## 3. Database Models

### accounts

#### `User` (Custom AbstractUser)
| Field | Type | Notes |
|---|---|---|
| `email` | EmailField | USERNAME_FIELD — used for login |
| `phone_number` | PhoneNumberField | Required |
| `user_role` | CharField | Choices: `ADMIN`, `CLIENT` |
| `gender` | CharField | Optional |
| `consumption_level` | CharField | Used in credit scoring |
| `monthly_expenditure` | DecimalField | Used in credit scoring |
| `purchase_frequency` | CharField | Used in credit scoring |
| `payment_consistency` | CharField | Used in credit scoring |
| `disconnection_history` | CharField | Used in credit scoring |
| `meter_sharing` | CharField | Used in credit scoring |
| `monthly_income` | DecimalField | Used in credit scoring |
| `income_stability` | CharField | Used in credit scoring |

#### `Profile`
| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField(User) | |
| `email_verified` | BooleanField | Default False |
| `id_image` | URLField | National ID image URL |

#### `Wallet` (accounts)
| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField(User) | |
| `currency` | CharField | Default `UGX` |
| `balance` | DecimalField | |
| `add_funds(amount)` | Method | Adds funds atomically |
| `deduct_funds(amount)` | Method | Deducts funds with balance check |
| `total_earnings` | Property | Sum of all credit wallet logs |

#### `WalletLog`
Audit trail for every wallet transaction. Linked to `Wallet`.

#### `UserAccountDetails`
| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField(User) | |
| `account_number` | CharField | Auto-generated unique account number |
| `address` | CharField | |
| `energy_preference` | CharField | |
| `payment_method` | CharField | |

#### `CreditScoreResponse`
Tracks answers to credit assessment questionnaire. One record per user per question.

#### `SettingsConfirmationEmailCode`
Stores short-lived email verification codes for settings changes.

---

### loan

#### `ElectricityTariff`
| Field | Type | Notes |
|---|---|---|
| `tariff_code` | CharField | Unique |
| `name` | CharField | |
| `tariff_type` | CharField | Choices: `DOMESTIC`, `COMMERCIAL`, `INDUSTRIAL` |
| `voltage_level` | CharField | |
| `service_charge` | DecimalField | Fixed monthly service fee |
| `is_active` | BooleanField | |

#### `TariffBlock`
Progressive block pricing linked to `ElectricityTariff`.
| Field | Type | Notes |
|---|---|---|
| `tariff` | ForeignKey(ElectricityTariff) | |
| `min_units` | DecimalField | Block lower bound |
| `max_units` | DecimalField | Block upper bound (null = unlimited) |
| `rate_per_unit` | DecimalField | Price per unit within this block |
| `block_order` | PositiveIntegerField | Ordering for progressive calculation |

#### `LoanTier`
Configurable loan tiers stored in the database.
| Field | Type | Notes |
|---|---|---|
| `name` | CharField | e.g., Bronze, Silver, Gold, Platinum |
| `min_score` | IntegerField | |
| `max_score` | IntegerField | |
| `max_amount` | DecimalField | Maximum loan amount in UGX |
| `interest_rate` | DecimalField | Annual interest rate % |
| `is_active` | BooleanField | |

Default tiers:
| Tier | Score Range | Max Amount | Interest |
|---|---|---|---|
| Bronze | 75–79 | 50,000 UGX | 12% |
| Silver | 80–84 | 100,000 UGX | 11% |
| Gold | 85–89 | 150,000 UGX | 10% |
| Platinum | 90–100 | 200,000 UGX | 9% |

#### `LoanApplication`
| Field | Type | Notes |
|---|---|---|
| `user` | ForeignKey(User) | |
| `tariff` | ForeignKey(ElectricityTariff) | |
| `status` | CharField | `PENDING`, `APPROVED`, `REJECTED`, `DISBURSED`, `COMPLETED`, `DEFAULTED` |
| `credit_score` | IntegerField | Calculated at application |
| `loan_tier` | CharField | Tier name at approval |
| `amount_requested` | DecimalField | UGX |
| `amount_approved` | DecimalField | UGX — min(requested, tier max) |
| `tenure_months` | IntegerField | |
| `interest_rate` | DecimalField | |
| `calculate_units_from_amount()` | Method | Converts UGX → electricity units using tariff blocks |
| `calculate_cost_for_units()` | Method | Converts units → UGX using tariff blocks |

#### `LoanDisbursement`
OneToOne with `LoanApplication`. Created when loan is disbursed.
| Field | Type | Notes |
|---|---|---|
| `token` | CharField(10) | Meter token, 10 chars |
| `units_disbursed` | DecimalField | Calculated from approved amount |
| `expires_at` | DateTimeField | 30 days from disbursement |

#### `LoanRepayment`
| Field | Type | Notes |
|---|---|---|
| `loan` | ForeignKey(LoanApplication) | |
| `payment_date` | DateField | |
| `amount_paid` | DecimalField | UGX |
| `units_paid` | DecimalField | |
| `payment_method` | CharField | `CASH`, `MOBILE_MONEY`, `BANK_TRANSFER` |
| `momo_transaction_id` | CharField | Populated for MoMo payments |
| `payment_status` | CharField | |

#### `UserCreditSignal`
Third-party credit indicators for scoring.
| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField(User) | |
| `payment_history` | CharField | e.g., `GOOD`, `FAIR`, `POOR` |
| `energy_consumption` | CharField | e.g., `STABLE`, `MODERATE`, `ERRATIC` |
| `financial_capacity` | CharField | e.g., `STRONG`, `AVERAGE`, `WEAK` |

---

### meter

#### `Meter`
| Field | Type | Notes |
|---|---|---|
| `meter_no` | CharField | Unique meter number |
| `static_ip` | GenericIPAddressField | Meter's static IP for webhooks |
| `units` | DecimalField | Current unit balance |
| `user` | ForeignKey(User) | Owning user |

#### `MeterToken`
| Field | Type | Notes |
|---|---|---|
| `meter` | ForeignKey(Meter) | |
| `token_source` | CharField | `PURCHASE`, `LOAN`, `SHARE`, `TRANSFER` |
| `units` | DecimalField | |
| `is_used` | BooleanField | |
| `expires_at` | DateTimeField | Nullable; set for loan tokens (30 days) |
| `loan_application` | ForeignKey(LoanApplication) | Nullable |

---

### share

#### `ShareTransaction`
| Field | Type | Notes |
|---|---|---|
| `share_transaction_id` | CharField | Unique |
| `sender` | ForeignKey(User) | |
| `receiver` | ForeignKey(User) | |
| `units` | DecimalField | Min 2.00 |
| `meter_send` | ForeignKey(Meter) | |
| `meter_receive` | ForeignKey(Meter) | |
| `direction` | CharField | `IN` or `OUT` |
| `status` | CharField | `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| `ip_address` | GenericIPAddressField | Rate limiting |
| `user_agent` | CharField | |
| `verified_at` | DateTimeField | When OTP confirmed |

Indexes: `(share_transaction_id)`, `(sender, receiver)`, `(status, create_date)`

#### `Share`
Wallet-linked share record.
| Field | Type | Notes |
|---|---|---|
| `wallet` | ForeignKey(Wallet) | |
| `units` | DecimalField | |
| `meter_number` | ForeignKey(Meter) | |
| `status` | CharField | |
| `share_transaction_id` | CharField | |
| `verification_code` | CharField(6) | OTP code |
| `is_verified` | BooleanField | |

#### `TransferRequest`
Admin-approved meter transfers.
| Field | Type | Notes |
|---|---|---|
| `old_meter` | ForeignKey(Meter) | Source meter |
| `new_meter` | ForeignKey(Meter) | Destination meter |
| `units_to_transfer` | DecimalField | |
| `status` | CharField | `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED` |
| `approved_by` | ForeignKey(User) | Admin user |
| `approved_at` | DateTimeField | |

#### `VerificationCode`
General-purpose OTP codes used across multiple flows.
| Field | Type | Notes |
|---|---|---|
| `user` | ForeignKey(User) | |
| `code` | CharField(6) | |
| `purpose` | CharField | `share_units`, `transfer_units`, `login`, `reset_password` |
| `expires_at` | DateTimeField | |
| `is_used` | BooleanField | |

---

### wallet

#### `Wallet` (wallet app — main user wallet)
| Field | Type | Notes |
|---|---|---|
| `user` | OneToOneField(User) | |
| `balance` | DecimalField | |
| `is_active` | BooleanField | |

#### `Transaction` (wallet app)
| Field | Type | Notes |
|---|---|---|
| `wallet` | ForeignKey(Wallet) | |
| `transaction_type` | CharField | `CREDIT`, `DEBIT`, `SHARE`, `TRANSFER`, `PURCHASE` |
| `amount` | DecimalField | |
| `balance_after` | DecimalField | Snapshot of balance post-transaction |
| `reference` | CharField | Unique reference string |
| `metadata` | JSONField | Arbitrary extra data |

Indexes: `(reference)`, `(wallet, created_at)`, `(transaction_type, created_at)`

#### `MeterBalance`
Per-meter balance tracking.
| Field | Type | Notes |
|---|---|---|
| `meter` | ForeignKey(Meter) | |
| `meter_number` | CharField | |
| `balance` | DecimalField | |
| `is_active` | BooleanField | |

#### `MeterTransaction`
| Field | Type | Notes |
|---|---|---|
| `meter` | ForeignKey(Meter) | |
| `operation` | CharField | `ADD`, `DEDUCT`, `SHARE_IN`, `SHARE_OUT`, `TRANSFER` |
| `amount` | DecimalField | |
| `balance_after` | DecimalField | |

---

### transactions

#### `UnitTransaction`
Peer-to-peer unit transfers between users.
| Field | Type | Notes |
|---|---|---|
| `sender` | ForeignKey(User) | |
| `receiver` | ForeignKey(User) | |
| `units` | DecimalField | |
| `meter` | ForeignKey(Meter) | |
| `direction` | CharField | `IN` or `OUT` |
| `status` | CharField | `PENDING`, `COMPLETED`, `FAILED` |

#### `Transaction` (transactions app)
Wallet-level transactions.
| Field | Type | Notes |
|---|---|---|
| `wallet` | ForeignKey(Wallet) | |
| `amount` | DecimalField | |
| `phone_number` | CharField | For MoMo payments |
| `status` | CharField | |
| `transaction_reference` | CharField | |

#### `TransactionLog`
Full audit trail for all system events.
| Field | Type | Notes |
|---|---|---|
| `transaction_type` | CharField | See `TransactionType` choices below |
| `amount` | DecimalField | |
| `units` | DecimalField | |
| `status` | CharField | |
| `reference_id` | CharField | |
| `details` | JSONField | Event-specific metadata |

**TransactionType choices:**
`LOAN_APPLICATION`, `LOAN_APPROVAL`, `LOAN_DISBURSEMENT`, `LOAN_REPAYMENT`, `UNIT_PURCHASE`, `UNIT_SHARE`, `UNIT_TRANSFER`

---

### ussd

#### `UssdSession`
| Field | Type | Notes |
|---|---|---|
| `session_id` | CharField | From USSD gateway |
| `service_code` | CharField | USSD short code |
| `phone_number` | CharField | Caller's phone number |
| `user` | ForeignKey(User) | Nullable — resolved after first input |
| `last_text` | CharField | Last USSD input text |
| `current_menu` | CharField | Current menu state |
| `context` | JSONField | Session state data |
| `is_active` | BooleanField | |
| `expires_at` | DateTimeField | 15 minutes from creation |

Indexes: `(phone_number, is_active)`, `(expires_at)`

---

## 4. API Endpoints

Base path: `/api/v1/`

### Authentication (`/api/v1/auth/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `register/` | Register new user | No |
| POST | `login/` | Login and receive JWT tokens | No |
| POST | `refresh/token/` | Refresh access token | No |
| POST | `verify-email/` | Verify email address with token | No |
| POST | `forgot-password/` | Request password reset email | No |
| POST | `reset-password/` | Reset password using token | No |
| POST | `resend-email-link/` | Resend email verification link | No |
| GET | `get-user-config/` | Get user profile + account details combined | Yes |
| POST | `security-code/` | Send/validate email confirmation code | Yes |
| GET/POST | `account-details/` | Get or create account details | Yes |
| PUT | `update-account-details/` | Update account details | Yes |
| GET/PUT | `user-profile/` | Get or update user profile (credit assessment) | Yes |

---

### Meter (`/api/v1/meter/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `register/` | Register a new meter | Yes |
| GET | `my-meter/` | Get authenticated user's meter | Yes |
| POST | `send-units/` | Send units to another meter | Yes |
| POST | `receive-units/` | Receive units (accept incoming share) | Yes |
| GET | `token/` | List meter tokens | Yes |
| POST | `buy-units/` | Purchase electricity units via MoMo | Yes |
| POST | `check-payment-status/` | Poll MoMo payment status | Yes |
| PUT | `update/` | Update meter information | Yes |

---

### Loans (`/api/v1/loans/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `apply/` | Submit a loan application | Yes |
| GET | `my-loans/` | List authenticated user's loans | Yes |
| GET | `stats/` | User loan statistics | Yes |
| GET | `loan/{id}/` | Loan application detail | Yes |
| POST | `repay/{loan_id}/` | Submit cash/bank repayment | Yes |
| POST | `disburse/{loan_id}/` | Disburse approved loan (Admin) | Yes (Admin) |
| POST | `notify/{loan_id}/` | Send loan status notification to user | Yes (Admin) |
| POST | `verify-token/` | Verify loan disbursement token on meter | Yes |
| POST | `repay/momo/{loan_id}/` | Repay loan via MTN MoMo | Yes |
| GET | `payment-status/{external_id}/` | Check MoMo repayment status | Yes |
| GET | `tariffs/` | List active electricity tariffs | Yes |

---

### Transactions (`/api/v1/transactions/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `buy-units/` | Purchase units (alternative endpoint) | Yes |
| GET | `history/` | Transaction history for user | Yes |

---

### Share (`/api/v1/share/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `share-units/` | Initiate peer-to-peer unit share with OTP | Yes |
| POST | `transfer-units/` | Request meter-to-meter transfer (admin approval) | Yes |

---

### Wallet (`/api/v1/wallet/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `balance/` | Get wallet balance | Yes |
| GET | `transactions/` | Wallet transaction history | Yes |
| POST | `create/` | Create wallet for user | Yes |

---

### Admin (`/api/v1/admin/`)

All admin endpoints require `user_role == ADMIN`.

| Method | Path | Description |
|---|---|---|
| GET | `dashboard/` | Summary stats: users, loans, revenue |
| GET | `users/` | Paginated user list |
| GET | `users/{user_id}/` | User detail with meter, wallet, loans |
| GET | `meters/` | Paginated meter list |
| GET | `stats/` | System-wide statistics |
| POST | `toggle-user-status/` | Enable/disable user account |
| GET/POST | `loans/` | List all loans / update loan status |
| GET | `loans/{loan_id}/` | Loan detail |
| GET | `account/` | Admin account settings |
| POST | `account/password-change/` | Change admin password |
| GET/POST | `account/notifications/` | Notification preferences |
| GET | `account/sessions/` | Active admin sessions |
| GET | `account/activities/` | Admin activity log |
| GET | `loan-tiers/` | List loan tiers |
| GET/POST | `loan-tiers/{id}/` | Loan tier detail / update |
| GET | `tariffs/` | List electricity tariffs |
| GET/POST | `tariffs/{id}/` | Tariff detail / update |

---

### USSD (`/api/v1/ussd/`)

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `entry/` | USSD gateway entry point — receives session input, returns menu text | No |

---

### Webhooks (`/api/v1/webhooks/`)

Handles callbacks from ESP32 hardware meters for token decryption and validation.

---

## 5. Authentication & Authorization

### JWT Configuration

| Setting | Value |
|---|---|
| Header | `Authorization: Bearer <token>` |
| Access token lifetime | 240 minutes (4 hours) |
| Refresh token lifetime | 1 day |
| Rotate refresh tokens | Yes |
| Blacklist after rotation | Yes |
| Token backend | `PyJWT` |

### Authentication Flow

1. Client calls `POST /api/v1/auth/login/` with `email` + `password`.
2. Server validates credentials, returns `{ access, refresh }` tokens.
3. Client includes `Authorization: Bearer <access>` on subsequent requests.
4. When access token expires, client calls `POST /api/v1/auth/refresh/token/` with `{ refresh }`.
5. Server issues new `access` token (and rotates `refresh` token).

### Role-Based Access

| Role | Description |
|---|---|
| `CLIENT` | Default role. Access to own data (meter, loans, wallet, share). |
| `ADMIN` | Full access including admin dashboard, loan approval, user management. |

Role check in views uses `request.user.user_role == 'ADMIN'`.

### Email Verification

Required before certain actions. Flow:
1. Registration sends verification email with a link containing `uid` + `token`.
2. Client calls `POST /api/v1/auth/verify-email/` with those params.
3. `Profile.email_verified` set to `True`.

### Authentication Classes (DRF)

```python
DEFAULT_AUTHENTICATION_CLASSES = [
    'rest_framework_simplejwt.authentication.JWTAuthentication',
    'rest_framework.authentication.SessionAuthentication',
]
```

---

## 6. Configuration & Environment

### Environment Variables (`.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | Django secret key | Change in production |
| `DEBUG` | Debug mode | `True` / `False` |
| `DB_NAME` | PostgreSQL database name | `metering` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_USE_TLS` | TLS for email | `True` |
| `EMAIL_HOST_USER` | SMTP username | |
| `EMAIL_HOST_PASSWORD` | SMTP app password | |
| `CELERY_BROKER_URL` | Redis broker URL | `redis://127.0.0.1:6379/0` |
| `CELERY_RESULT_BACKEND` | Celery result backend | `redis://127.0.0.1:6379/0` |
| `CELERY_TIMEZONE` | Celery timezone | `Africa/Nairobi` |
| `CELERY_TASK_ALWAYS_EAGER` | Run tasks synchronously in dev | `True` |
| `REDIS_HOST` | Redis host | `127.0.0.1` |
| `REDIS_PORT` | Redis port | `6379` |
| `BASE_URL` | Backend base URL | `nginx:3030/api/v1` |
| `MTN_SUBSCRIPTION_KEY` | MTN MoMo subscription key | |
| `MTN_API_KEY` | MTN MoMo API key | |
| `MTN_API_USER_ID` | MTN MoMo API user ID | |
| `MTN_CALLBACK_HOST` | Callback URL for MoMo webhooks | `http://localhost:3030` |

### Database Settings (`backend/settings.py`)

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='metering'),
        'USER': env('DB_USER', default='postgres'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
        'OPTIONS': {
            'options': '-c search_path=custom,public',
        },
        'ATOMIC_REQUESTS': True,        # All requests wrapped in a transaction
        'CONN_MAX_AGE': 60,             # Connection pooling — 60s lifetime
    }
}
```

### CORS Settings

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3030",
]
```

### Installed Apps

```
django.contrib.admin, django.contrib.auth, django.contrib.contenttypes,
django.contrib.sessions, django.contrib.messages, django.contrib.staticfiles,
rest_framework, rest_framework_simplejwt, rest_framework_simplejwt.token_blacklist,
corsheaders, drf_yasg, cities_light, phonenumber_field,
accounts, loan, transactions, meter, share, transfer, wallet, ussd
```

### Middleware Order

```
SecurityMiddleware → SessionMiddleware → CommonMiddleware → CorsMiddleware
→ CsrfViewMiddleware → AuthenticationMiddleware → MessageMiddleware
→ XFrameOptionsMiddleware
```

---

## 7. Background Tasks

### Celery Configuration (`backend/celery.py`)

- **Broker:** Redis (`CELERY_BROKER_URL`)
- **Result backend:** Redis (`CELERY_RESULT_BACKEND`)
- **Timezone:** `Africa/Nairobi`
- **UTC:** Disabled
- **Task serializer:** JSON
- **Dev mode:** `CELERY_TASK_ALWAYS_EAGER = True` — tasks run synchronously without a worker

### Registered Tasks

| Task | Module | Description |
|---|---|---|
| `handle_send_email_verification` | `accounts/tasks.py` | Send email verification link to new user |
| `handle_send_email_code` | `accounts/tasks.py` | Send one-time confirmation code |
| `debug_task` | `backend/celery.py` | Test task to verify Celery is running |

### Running Celery (Production)

```bash
# Start a Celery worker
celery -A backend worker --loglevel=info

# Start Celery beat (for periodic tasks, if configured)
celery -A backend beat --loglevel=info
```

---

## 8. Credit Scoring System

Located in [loan/scoring.py](backend/loan/scoring.py).

### Scoring Factors

The credit score (0–100) is calculated from three weighted factor groups:

| Factor Group | Weight | Sub-factors |
|---|---|---|
| Payment History | 1 | on_time_ratio (50%), arrears_frequency (30%), disconnection_events (20%) |
| Energy Consumption | 2 | usage_stability (40%), peak_variation (35%), seasonality (25%) |
| Financial Capacity | 3 | income_stability (40%), expense_buffer (35%), repayment_capacity (25%) |

### Signal Value Mapping

Each sub-factor maps a qualitative signal to a numeric score:

| Signal | Score Range |
|---|---|
| GOOD / STRONG / STABLE | 90–95 |
| FAIR / AVERAGE / MODERATE | 70–75 |
| POOR / WEAK / ERRATIC | 35–45 |

### Scoring Formula

```
weighted_sum = Σ (factor_weight × factor_score)
total_weight = Σ factor_weights
final_score  = weighted_sum / total_weight
```

### Loan Eligibility

- Minimum required score: **75**
- Score is stored on `LoanApplication.credit_score` at application time
- Tier determined by score range → controls `max_amount` and `interest_rate`

---

## 9. Payment Integration (MTN MoMo)

Located in [mtn_momo/services.py](backend/mtn_momo/services.py).

### `MTNMoMoService` Methods

| Method | Description |
|---|---|
| `create_api_user()` | Provisions an API user on MTN sandbox |
| `create_api_key()` | Generates an API key for the provisioned user |
| `get_api_token()` | Exchanges credentials for a Bearer access token |
| `request_to_pay(amount, phone, external_id, note)` | Initiates a payment request to a phone number |
| `check_payment_status(external_id)` | Polls the status of a payment request |

### Payment Flows

**Buy Units:**
1. `POST /api/v1/meter/buy-units/` — initiates `request_to_pay`
2. Client polls `POST /api/v1/meter/check-payment-status/` with `external_id`
3. On `SUCCESSFUL` status, `MeterToken` is created with `token_source=PURCHASE`

**Loan Repayment via MoMo:**
1. `POST /api/v1/loans/repay/momo/{loan_id}/` — initiates `request_to_pay`
2. Client polls `GET /api/v1/loans/payment-status/{external_id}/`
3. On `SUCCESSFUL`, `LoanRepayment` record is created with `payment_method=MOBILE_MONEY`

### MoMo Credentials (Environment)

```
MTN_SUBSCRIPTION_KEY
MTN_API_KEY
MTN_API_USER_ID
MTN_CALLBACK_HOST     # Webhook callback URL
```

---

## 10. USSD Integration

Entry point: `POST /api/v1/ussd/entry/`

### Session Model

Sessions are stored in `UssdSession` with a 15-minute expiry. Each request carries:
- `sessionId` — gateway session identifier
- `serviceCode` — USSD short code
- `phoneNumber` — caller's MSISDN
- `text` — accumulated input string

### State Machine

Current menu state is stored in `UssdSession.current_menu`. Context (e.g., amounts entered mid-flow) is stored in `UssdSession.context` (JSONField).

### Menu Navigation

The USSD view parses the `text` field (pipe-delimited accumulated inputs) to determine the user's position in the menu tree and returns a `CON` (continue) or `END` (terminate) response string.

---

## 11. Utilities & Services

### Email (`utils/email.py`)

```python
send_email(to, subject, html_content, plain_text=None)
```

Uses Django's email backend (SMTP configured via environment). Supports HTML + plain text fallback.

Called from:
- Account registration (email verification link)
- Loan status notifications
- Password reset requests
- Settings confirmation codes

### Auth Token Generators (`utils/auth.py`)

| Generator | Purpose |
|---|---|
| `TokenGenerator` | Email address verification tokens |
| `ResetPasswordTokenGenerator` | Password reset tokens |

Both use Django's `PasswordResetTokenGenerator` as a base. User hash (`uid`) is base64-encoded user PK.

### Custom Exceptions (`utils/exceptions.py`)

```python
class CustomAPIException(APIException):
    # status_code, default_detail, default_code customizable per instance
```

Global exception handler registered in DRF settings. Returns consistent JSON error responses.

### Decorators (`utils/decorators.py`)

| Decorator | Purpose |
|---|---|
| `class_view_decorator(decorator)` | Apply function-based decorator to class-based views |
| `required_fields(*fields)` | Validate required POST/JSON fields before view executes |
| `email_verification_exempt` | Skip email-verified check on a view |
| `phone_verification_exempt` | Skip phone-verified check on a view |
| `exception_handler` | Wrap view in try/except; return 500 on unhandled exceptions |

### General Utilities (`utils/general.py`)

| Function | Description |
|---|---|
| `format_currency(amount)` | Format decimal as UGX string |
| `get_base_url()` | Return configured `BASE_URL` from env |
| `generate_numeric_id(length)` | Generate random numeric string ID |
| `format_human_date(dt)` | Format datetime as human-readable string |

### Verification Service (`share/services.py`)

```python
class VerificationService:
    generate_otp_code(user, purpose)     # Create 6-digit OTP, stores in VerificationCode
    format_transaction_details(tx)       # Format share/transfer details for email body
```

### Webhook Token Validator (`utils/models.py`)

`TokenValidator` class handles decryption and validation of tokens sent from ESP32 hardware meters via the webhooks endpoint.

---

## 12. Dependencies

Full list in [requirements.txt](backend/requirements.txt).

| Package | Version | Purpose |
|---|---|---|
| Django | 5.2 | Web framework |
| djangorestframework | 3.16.1 | REST API |
| djangorestframework_simplejwt | 5.5.1 | JWT authentication |
| django-cors-headers | 4.9.0 | CORS middleware |
| celery | 5.6.0 | Async task queue |
| redis | 7.1.0 | Message broker, result backend |
| psycopg | 3.3.2 | PostgreSQL async driver |
| psycopg2-binary | 2.9.11 | PostgreSQL sync driver |
| requests | 2.32.5 | HTTP client (MTN MoMo API calls) |
| django-phonenumber-field | 8.4.0 | Phone number model field + validation |
| django-cities-light | 3.10.2 | Country/city geographic data |
| drf-yasg | 1.21.11 | Swagger / OpenAPI 2.0 docs auto-generation |
| python-decouple | 3.8 | Environment variable management |
| python-dotenv | 1.2.1 | `.env` file loader |
| pytz | 2025.2 | Timezone support |
| python-dateutil | 2.9.0 | Date parsing utilities |
| PyJWT | 2.10.1 | JWT encode/decode |
| pydantic | 2.12.5 | Data validation |

---

## 13. Business Logic Flows

### User Registration & Onboarding

```
POST /auth/register/
  → Create User (role=CLIENT, email unverified)
  → Create Profile (email_verified=False)
  → Create Wallet (accounts.Wallet + wallet.Wallet)
  → Create UserAccountDetails (auto account_number)
  → Celery: handle_send_email_verification → sends verification email
POST /auth/verify-email/  → Profile.email_verified = True
POST /meter/register/     → Meter created and linked to user
```

### Loan Application Lifecycle

```
POST /loans/apply/
  → Read UserCreditSignal for user
  → Run scoring algorithm → credit_score
  → Match score to LoanTier
  → Create LoanApplication (status=PENDING)
  → TransactionLog entry: LOAN_APPLICATION

Admin: POST /admin/loans/ (approve/reject)
  → LoanApplication.status = APPROVED / REJECTED
  → TransactionLog entry: LOAN_APPROVAL
  → Celery: send notification email to user

Admin: POST /loans/disburse/{loan_id}/
  → Calculate units from approved amount using TariffBlock pricing
  → Create MeterToken (token_source=LOAN, expires in 30 days)
  → Create LoanDisbursement (token, units_disbursed)
  → LoanApplication.status = DISBURSED
  → TransactionLog entry: LOAN_DISBURSEMENT

POST /loans/verify-token/
  → User enters token on meter device
  → MeterToken.is_used = True → Meter.units += units_disbursed

POST /loans/repay/{loan_id}/  (or /repay/momo/{loan_id}/)
  → Create LoanRepayment record
  → Recalculate outstanding balance
  → If fully repaid → LoanApplication.status = COMPLETED
  → TransactionLog entry: LOAN_REPAYMENT
```

### Peer-to-Peer Unit Share

```
POST /share/share-units/
  → Validate: sender has meter, units >= 2, rate limit (10/hr per user, 50/hr per IP)
  → Generate OTP (VerificationCode, purpose=share_units, 15 min expiry)
  → Create ShareTransaction (status=PENDING)
  → Email OTP to sender

Sender submits OTP
  → Validate OTP (VerificationCode.is_used=False, not expired)
  → Atomic transaction:
      Meter(sender).units -= units
      Meter(receiver).units += units
      ShareTransaction.status = COMPLETED
      ShareTransaction.verified_at = now()
  → MeterTransaction records for both meters
  → TransactionLog entry: UNIT_SHARE
```

### Unit Purchase via MTN MoMo

```
POST /meter/buy-units/
  → Call MTNMoMoService.request_to_pay(amount, phone, external_id)
  → Return external_id to client

Client polls: POST /meter/check-payment-status/ {external_id}
  → Call MTNMoMoService.check_payment_status(external_id)
  → If SUCCESSFUL:
      Create MeterToken (token_source=PURCHASE)
      Create TransactionLog entry: UNIT_PURCHASE
  → Return status to client
```

### Tariff-Based Unit Calculation

Electricity units are calculated from UGX amounts using progressive block pricing:

```python
# Example for 50,000 UGX with blocks:
#   Block 1: 0–15 units @ 250 UGX/unit
#   Block 2: 15–50 units @ 350 UGX/unit
#   Block 3: 50+ units @ 500 UGX/unit

amount = 50,000
units = 0
remaining = 50,000

Block 1: min(15, remaining/250) → 15 units, costs 3,750 → remaining = 46,250
Block 2: min(35, remaining/350) → 35 units, costs 12,250 → remaining = 34,000
Block 3: remaining/500 → 68 units
Total units = 15 + 35 + 68 = 118 units
```

This calculation is performed by `LoanApplication.calculate_units_from_amount()` and reused in loan disbursement to determine `units_disbursed`.

---

*Generated: 2026-05-19*
