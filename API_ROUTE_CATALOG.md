# gPawa Project API Route Catalog

This catalog summarizes backend API endpoints by route group, including method(s), auth level, and purpose.

## Base Route Mapping

- `api/v1/` -> versioned API router (`backend/api1.py`)
- `api/v1/admin/` -> admin module routes (`admin/urls.py`)
- `api/v1/wallet/` -> wallet routes (also exposed directly in root URLs)

Within `api/v1/`, module prefixes are:
- `auth/`
- `meter/`
- `transactions/`
- `webhooks/`
- `loans/`
- `wallet/`
- `share/`

---

## Auth Endpoints (`/api/v1/auth`)

- `POST /register/` - Public - Create user account
- `GET /verify-email/` - Public - Verify account via email link/token
- `POST /login/` - Public - Authenticate user and issue tokens
- `POST /refresh/token/` - Public (token-based) - Refresh JWT access token
- `POST /change-required-password/` - Authenticated - Set new password when `must_change_password` is true
- `GET /get-user-config/` - Authenticated - Fetch current user config/profile completeness
- `POST /forgot-password/` - Public - Start password reset flow
- `GET /reset-password/` - Public - Validate reset token/link
- `PATCH /reset-password/` - Public - Set a new password
- `GET /resend-email-link/` - Public - Resend verification email
- `POST /security-code/` - Authenticated - Security settings update action
- `GET /security-code/` - Authenticated - Security settings fetch action
- `GET /account-details/` - Authenticated - Retrieve account details
- `PATCH /update-account-details/` - Authenticated - Update account details
- `GET /user-profile/` - Authenticated - Retrieve user profile
- `POST /user-profile/` - Authenticated - Create/update user profile

---

## Meter Endpoints (`/api/v1/meter`)

- `POST /send-units/` - Authenticated - Send units from current user context
- `POST /receive-units/` - Authenticated (expected by business flow) - Receive/process unit transfer payload
- `GET /token/` - Authenticated - Fetch token details/history context
- `POST /buy-units/` - Authenticated - Initiate unit purchase/payment flow
- `POST /check-payment-status/` - Authenticated - Poll/check payment status
- `POST /register/` - Authenticated - Register user meter (`iot_device_token` required for AMI)
- `GET /my-meter/` - Authenticated - Check current user meter record(s)
- `GET /ami-status/?meter_no=` - Authenticated - AMI gateway status + wallet balance
- `GET /check-units/?meter_no=` - Authenticated - Live kWh from ThingsBoard (`remaining_units`)
- `GET /notifications/` - Authenticated - List meter alerts (e.g. low-units)
- `PATCH /notifications/` - Authenticated - Mark alerts read (`ids` or `all: true`)
- `POST /apply-wallet-units/` - Authenticated - AMI: debit wallet, push to ThingsBoard (**Load Units**)
- `GET /power-usage/?period=&meter_no=&year=&month=` - Authenticated - AMI usage reports
- `POST /generate-token/` - Authenticated - STS: debit wallet → keypad token
- `POST /test-meter-push/` - Authenticated - Manual ThingsBoard push test
- `POST /admin-test-meter-push/` - Admin - Push test for any meter
- `PUT /update/` - Authenticated - Update meter details
- `PATCH /update/` - Authenticated - Partial meter update
- `POST /delete/` - Authenticated - Remove meter from account (soft delete + `DeletedMeterRecord` audit)
- `DELETE /delete/?meter_no=` - Authenticated - Same as POST delete

---

## Loan Endpoints (`/api/v1/loans`)

- `GET /apply/` - Authenticated - List/apply context for loan endpoint
- `POST /apply/` - Authenticated - Submit loan application
- `GET /my-loans/` - Authenticated - List current user loans
- `GET /stats/` - Authenticated - Loan metrics for current user
- `GET /loan/{pk}/` - Authenticated - Retrieve a specific loan
- `POST /repay/{loan_id}/` - Authenticated - Repay a loan
- `POST /disburse/{loan_id}/` - Authenticated - Disburse approved loan
- `POST /notify/{loan_id}/` - Authenticated - Trigger/send loan notification
- `GET /verify-token/` - Public - Validate loan token
- `POST /verify-token/` - Public - Verify and consume/process token payload
- `POST /repay/momo/{loan_id}/` - Authenticated - Repay via MoMo flow
- `GET /payment-status/{external_id}/` - Authenticated - Check repayment transaction status
- `GET /tariffs/` - Authenticated - List active tariff data

---

## Share Endpoints (`/api/v1/share`)

- `GET /receiver-preview/?meter_number=` - Authenticated - Recipient name, type, phone (share confirmation)
- `POST /share-units/` - Authenticated - Initiate/confirm OTP share (STS → token, AMI → device)
- `POST /transfer-units/` - Authenticated - Transfer units between meter contexts

---

## Wallet Endpoints (`/api/v1/wallet`)

- `GET /balance/` - Authenticated - Get wallet balance
- `GET /transactions/` - Authenticated - Get wallet transaction history
- `POST /create/` - Authenticated - Create wallet for user (if missing)

---

## Transactions Endpoints (`/api/v1/transactions`)

- `POST /buy-units/` - Authenticated - Transaction-scoped buy units action
- `GET /history/` - Authenticated - Transaction history feed

---

## Webhooks Endpoints

### ThingsBoard (root URL — not under `/api/v1/`)

- `POST /webhooks/thingsboard/low-units` - Public (optional secret header) - ThingsBoard low-units alert webhook
- `POST /webhooks/thingsboard/daily-usage` - Public (optional secret header) - Daily kWh consumption webhook

### API v1 (`/api/v1/webhooks/`)

- `GET /token/` - Public - Verify/decrypt token state
- `POST /token/` - Public - Submit token verification payload

---

## USSD Endpoints (`/api/v1/ussd/`)

- `POST /entry/` - Public - USSD session handler (Africa's Talking format)
- `GET /phones/` - Public - Simulator helper: users with phone numbers
- `GET /meters/` - Public - Simulator helper: receiver meter list

---

## Admin Endpoints (`/api/v1/admin`)

All endpoints below require authenticated user with admin authorization checks:

- `GET /dashboard/` - Admin - Dashboard aggregates
- `GET /users/` - Admin - List/search users
- `GET /users/{user_id}/` - Admin - User detail
- `POST /toggle-user-status/` - Admin - Activate/deactivate user
- `GET /meters/` - Admin - Meter management list
- `GET /meters/{id}/` - Admin - Meter detail
- `PATCH /meters/{id}/` - Admin - Update meter (label, IoT token)
- `POST /meters/{id}/deactivate/` - Admin - Deactivate meter (status only)
- `POST /meters/{id}/delete/` - Admin - Remove meter from user (soft delete + audit record)
- `POST /meters/{id}/transfer/` - Admin - Transfer ownership
- `GET /deleted-meters/` - Admin - List `DeletedMeterRecord` audit rows
- `GET /stats/` - Admin - System/admin KPIs
- `GET /loans/` - Admin - Loan management list
- `GET /loans/{loan_id}/` - Admin - Loan detail
- `GET /account/` - Admin - Admin account settings
- `PUT /account/` - Admin - Update admin account settings
- `POST /account/password-change/` - Admin - Change admin password
- `GET /account/notifications/` - Admin - Notification settings
- `PUT /account/notifications/` - Admin - Update notification settings
- `GET /account/sessions/` - Admin - Active sessions overview
- `POST /account/sessions/` - Admin - Session management action
- `DELETE /account/sessions/` - Admin - Revoke session(s)
- `GET /account/activities/` - Admin - Admin activity log
- `GET /loan-tiers/` - Admin - List loan tiers
- `POST /loan-tiers/` - Admin - Create loan tier
- `GET /loan-tiers/{pk}/` - Admin - Loan tier detail
- `PUT /loan-tiers/{pk}/` - Admin - Update loan tier
- `DELETE /loan-tiers/{pk}/` - Admin - Delete loan tier
- `GET /tariffs/` - Admin - List all tariffs (active + inactive)
- `POST /tariffs/` - Admin - Create tariff (marking Active deactivates others)
- `POST /tariffs/seed-era/` - Admin - Import ERA Code 10.1 domestic defaults
- `POST /tariffs/{pk}/activate/` - Admin - Set tariff as sole active schedule
- `GET /tariffs/{pk}/` - Admin - Tariff detail
- `PUT /tariffs/{pk}/` - Admin - Update tariff
- `DELETE /tariffs/{pk}/` - Admin - Delete tariff (blocked if currently Active)

---

## Notes

- Auth labels are inferred from DRF permission classes in view files.
- Some endpoints are grouped as generic DRF views; the listed methods reflect implemented handlers.
- For production-grade API docs, add request/response schemas and status code tables per endpoint.
