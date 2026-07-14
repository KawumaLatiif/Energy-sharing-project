# gPAWA MTN MoMo Sandbox Integration Report

**Project:** gPAWA Energy Wallet  
**Payment rail:** MTN MoMo Collection API  
**Environment covered:** Sandbox (with path to production)  
**Last updated:** June 2026  
**Audience:** Product, QA, DevOps, backend/frontend engineers

---

## 1) Executive Summary

gPAWA integrates MTN Mobile Money so a customer can pay from their phone and receive energy units in their unit wallet after payment success.

The integration supports two operating modes:

- **Real MoMo mode**: gPAWA calls MTN `requesttopay`, customer approves with PIN on phone/simulator, gPAWA polls status, then credits units.
- **Simulated mode**: for local development when credentials are not configured, payment auto-completes in ~2 seconds without MTN calls.

This design lets the team develop and test end-to-end business logic before external credentials are ready, while still supporting real sandbox request-to-pay once credentials are provided.

---

## 2) What Is Implemented Today

### Backend

- **MoMo config loader**: `backend/mtn_momo/config.py`
  - Reads environment values for subscription key, API user ID, API key, callback host, and environment.
  - Decides whether to run real MoMo or simulated mode (`should_simulate_payments()`).

- **MoMo API service**: `backend/mtn_momo/services.py`
  - Token request (`/collection/token/`).
  - Request-to-pay (`/collection/v1_0/requesttopay`).
  - Status check (`/collection/v1_0/requesttopay/{reference_id}`).
  - Uses **X-Reference-Id** as authoritative payment reference for polling.

- **Buy units flow**: `backend/meter/api/views.py`
  - Creates pending transaction.
  - If simulated mode: background auto-completion.
  - If real MoMo mode: sends request-to-pay and returns pending response.
  - On status polling success: credits unit wallet and records ledgers.

- **Shared completion logic**: `backend/meter/buy_units_payment.py`
  - Performs atomic wallet crediting after successful payment.
  - Applies auto loan repayment first where applicable.
  - Writes unit transaction and meter ledger records.
  - Triggers payment receipt email task.

- **USSD parity**: `backend/ussd/views.py`
  - Uses same real/simulated split for buy-units.
  - Supports transaction status checks.

- **Loan MoMo path alignment**: `backend/loan/api/momo_views.py`
  - Updated to use the same real/simulated decision and reference semantics.

- **Wallet balance robustness**: `backend/wallet/views.py`, `backend/wallet/signals.py`
  - Stabilized meter balance sync to avoid endpoint crashes after meter renames.
  - Prevents wallet-balance API failures from causing persistent 0.00 display.

### Frontend

- **Buy units form**: `frontend/src/app/(dashboard)/dashboard/buy-units/_components/form.tsx`
  - Shows real user prompt for MoMo PIN approval when in real mode.
  - Polls transaction status endpoint until success/failure.

- **Share/load wallet visibility**:
  - `share/_components/share_form.tsx`
  - `share/_components/load_units_form.tsx`
  - `share/_components/load_share_client.tsx`
  - Uses selected meter context + wallet refresh events for consistent wallet balance updates.

---

## 3) End-to-End Payment Sequence

1. User submits amount + phone number from TopUp Wallet UI.
2. Backend creates a pending transaction and assigns a MoMo reference UUID.
3. Backend decides mode:
   - **Simulated**: schedule auto-complete worker.
   - **Real MoMo**: call MTN request-to-pay with `X-Reference-Id`.
4. Frontend displays pending state and instructs user to approve on phone/simulator.
5. Frontend polls `meter/check-payment-status/`.
6. Backend polls MTN status using `X-Reference-Id`.
7. On successful status:
   - Credit units to unit wallet.
   - Apply loan deduction first if required.
   - Mark transaction completed.
   - Trigger receipt email.
8. Frontend refreshes wallet and shows success details.

---

## 4) Setup From Scratch (Sandbox)

## 4.1 Prerequisites

- Running backend and frontend locally.
- Access to MTN Developer Portal.
- Public callback URL for local machine (ngrok or equivalent).

## 4.2 MTN Developer Portal Steps

1. Go to [momodeveloper.mtn.com](https://momodeveloper.mtn.com).
2. Create/login account.
3. Subscribe to **Collection** product in sandbox.
4. Copy your **Collection subscription key**.
5. Create an API user (UUID) with `providerCallbackHost`.
6. Create API key for that API user.
7. Note sandbox MSISDN(s) for test approvals.

## 4.3 Local Callback URL

Run:

```bash
ngrok http 8000
```

Use the generated HTTPS host as `MTN_CALLBACK_HOST` (host root, no private localhost URL).

## 4.4 Environment Variables

Configure `backend/.env`:

```env
MTN_SUBSCRIPTION_KEY=...
MTN_API_USER_ID=...
MTN_API_KEY=...
MTN_CALLBACK_HOST=https://your-ngrok-domain.ngrok-free.app
MTN_ENVIRONMENT=sandbox
MTN_USE_SIMULATED_PAYMENTS=false
```

Optional local fallback:

```env
MTN_USE_SIMULATED_PAYMENTS=true
```

This bypasses MTN and auto-completes payments locally.

## 4.5 Start Services

- Restart backend after env changes.
- Start frontend.
- Ensure database and queue/worker pieces required by your setup are up.

---

## 5) How To Test Sandbox Correctly

## 5.1 Happy Path

1. Open TopUp Wallet page.
2. Enter amount + valid sandbox phone number.
3. Submit payment.
4. Verify UI says to approve on phone/simulator.
5. Approve payment in MTN sandbox simulator/handset.
6. Confirm status turns SUCCESS.
7. Confirm wallet kWh increases and receipt email is sent.

## 5.2 Failure/Edge Cases

- Reject payment in simulator -> transaction should become FAILED.
- Use invalid phone format -> API should return validation error.
- Turn off MoMo creds + set simulated mode -> still completes via local simulation.
- Refresh page during pending status -> polling should continue and reconcile.

---

## 6) Important Design Decisions

- **Reference ID semantics**: status polling is based on the same `X-Reference-Id` used at request-to-pay.
- **Sandbox currency behavior**: sandbox charges use EUR constraints while business-side unit computation remains based on user-entered UGX amount.
- **Separation of concerns**:
  - `mtn_momo/services.py` handles MTN protocol.
  - `buy_units_payment.py` handles internal financial/unit side effects.
- **Mode switch safety**: if credentials are missing, system automatically falls back to simulation to avoid broken local flows.

---

## 7) Troubleshooting Guide

## 7.1 "Failed to retrieve balance information"

Likely wallet balance endpoint issue (historically tied to meter-balance sync conflicts after meter renames). Check:

- Backend logs for exceptions in `wallet/views.py`.
- `wallet/balance/` response in network tab.
- MeterBalance consistency in DB.

## 7.2 Payment Stuck at PENDING

Check:

- Customer actually approved prompt in simulator/phone.
- `MTN_SUBSCRIPTION_KEY`, `MTN_API_USER_ID`, `MTN_API_KEY` values.
- Correct environment (`MTN_ENVIRONMENT=sandbox`).
- Polling uses correct reference ID.

## 7.3 Token/Auth failures from MTN

Usually caused by:

- Wrong API user ID/API key pairing.
- Wrong subscription key/product.
- Expired or mis-scoped portal credentials.

## 7.4 Callback host issues

- Must be publicly reachable HTTPS URL.
- Localhost callback hosts are invalid from MTN cloud.

---

## 8) Security and Compliance Notes

- Never commit real secrets to git (`.env`, API keys, passwords).
- Use environment/secret manager in production (not static files).
- Rotate API keys periodically and after any exposure suspicion.
- Audit payment state transitions and retain transaction logs.

---

## 9) Production-Grade Transition Plan

## 9.1 Configuration and Secrets

- Provision production MTN Collection credentials.
- Store secrets in managed secret store (Vault, AWS/GCP/Azure secrets, etc.).
- Separate envs: local, staging, production.
- Disable simulation in production:

```env
MTN_USE_SIMULATED_PAYMENTS=false
MTN_ENVIRONMENT=production
```

## 9.2 Reliability Improvements

- Replace client-only polling dependency with server-side reconciliation job.
- Add retry policy with backoff for transient MTN failures.
- Add dead-letter handling for permanently failed payment checks.
- Ensure idempotent completion logic is enforced (already mostly handled via status checks/locking).

## 9.3 Observability

- Structured logs with payment reference IDs.
- Metrics:
  - request-to-pay attempts
  - pending duration
  - success/failure rate
  - reconciliation lag
- Alerts on elevated failure rates and long-pending transactions.

## 9.4 Security Hardening

- Restrict outbound rules to MTN endpoints.
- Introduce strict input validation + rate limiting at payment endpoints.
- Add signed callback verification if/when callback flow is enabled.

## 9.5 QA/UAT Checklist Before Go-Live

- End-to-end success flow in staging with production-like settings.
- Failure case matrix signed off (reject, timeout, invalid phone, partial outage).
- Email receipts verified.
- Wallet, ledger, and loan deductions reconcile to expected values.
- Runbook and support escalation path documented.

---

## 10) Runbook for New Engineers (Quick Start)

1. Read this report.
2. Set up sandbox credentials in `.env`.
3. Keep `MTN_USE_SIMULATED_PAYMENTS=true` initially to verify local flow.
4. Switch to `false` and test real sandbox approvals.
5. Validate wallet updates on dashboard and share/load pages.
6. Validate USSD payment status path.
7. Add monitoring/logging before promoting to production.

---

## 11) Current Known Limitations

- Sandbox flow still depends on user approval action in simulator/phone; there is no in-app PIN capture.
- Production callback webhook path should be expanded into a full async reconciliation strategy.
- Operational dashboards/alerts are recommended as next step for production maturity.

---

## 12) Appendix: Key Files

- `backend/mtn_momo/config.py`
- `backend/mtn_momo/services.py`
- `backend/meter/api/views.py`
- `backend/meter/buy_units_payment.py`
- `backend/loan/api/momo_views.py`
- `backend/ussd/views.py`
- `backend/wallet/views.py`
- `backend/wallet/signals.py`
- `frontend/src/app/(dashboard)/dashboard/buy-units/_components/form.tsx`
- `frontend/src/app/(dashboard)/dashboard/share/_components/share_form.tsx`
- `frontend/src/app/(dashboard)/dashboard/share/_components/load_units_form.tsx`
- `frontend/src/app/(dashboard)/dashboard/share/_components/load_share_client.tsx`
