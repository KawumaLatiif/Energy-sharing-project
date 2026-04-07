# Energy Sharing Project API Route Catalog

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
- `POST /register/` - Authenticated - Register user meter
- `GET /my-meter/` - Authenticated - Check current user meter record
- `PUT /update/` - Authenticated - Update meter details
- `PATCH /update/` - Authenticated - Partial meter update

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

- `POST /share-units/` - Authenticated - Initiate/confirm OTP-based unit sharing
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

## Webhooks Endpoints (`/api/v1/webhooks`)

- `GET /token/` - Public - Verify/decrypt token state
- `POST /token/` - Public - Submit token verification payload

---

## Admin Endpoints (`/api/v1/admin`)

All endpoints below require authenticated user with admin authorization checks:

- `GET /dashboard/` - Admin - Dashboard aggregates
- `GET /users/` - Admin - List/search users
- `GET /users/{user_id}/` - Admin - User detail
- `POST /toggle-user-status/` - Admin - Activate/deactivate user
- `GET /meters/` - Admin - Meter management list
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
- `GET /tariffs/` - Admin - List tariffs
- `POST /tariffs/` - Admin - Create tariff
- `GET /tariffs/{pk}/` - Admin - Tariff detail
- `PUT /tariffs/{pk}/` - Admin - Update tariff
- `DELETE /tariffs/{pk}/` - Admin - Delete tariff

---

## Notes

- Auth labels are inferred from DRF permission classes in view files.
- Some endpoints are grouped as generic DRF views; the listed methods reflect implemented handlers.
- For production-grade API docs, add request/response schemas and status code tables per endpoint.
