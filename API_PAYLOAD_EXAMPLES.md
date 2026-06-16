# gPawa Project API Payload Examples

This document provides practical request/response examples for key flows.
All examples assume base URL prefix: `/api/v1`.

## Conventions

- Authenticated endpoints require `Authorization: Bearer <access_token>`
- JSON bodies are shown with representative values
- Response fields can vary slightly by environment and data state

---

## 1) Register (`POST /auth/register/`)

### Request

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone_number": "+256701234567",
  "gender": "FEMALE",
  "password": "SecurePass123",
  "confirm_password": "SecurePass123"
}
```

### Success Response (201)

```json
{
  "success": true,
  "message": "User registered successfully!"
}
```

### Validation Error Example (400)

```json
{
  "email": [
    "This email is already registered. Please use a different email or try logging in."
  ]
}
```

---

## 2) Login (`POST /auth/login/`)

### Request

```json
{
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```

### Success Response (200)

```json
{
  "refresh": "<jwt_refresh_token>",
  "access": "<jwt_access_token>",
  "user": {
    "id": 42,
    "email": "jane@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "user_role": "CLIENT",
    "is_admin": false,
    "redirect_to": "/dashboard"
  }
}
```

### Error Example (400)

```json
{
  "non_field_errors": [
    "Invalid credentials or server error. Please try again."
  ]
}
```

---

## 3) Buy Units - Start Payment (`POST /meter/buy-units/`)

### Request

```json
{
  "amount": "20000",
  "phone_number": "+256701234567"
}
```

### Success (Sandbox Pending) Response (200)

```json
{
  "status": "PENDING",
  "message": "Simulating sandbox payment - Please wait...",
  "external_id": "6f6f65f3-4a9e-4d9d-bb6a-09f8ef6f0abc",
  "transaction_id": 311,
  "user_prompt": "Sandbox mode: Payment will auto-complete in 2 seconds",
  "estimated_units": 40.0,
  "tariff_applied": "CODE10.1",
  "loan_outstanding_deduction": 0.0
}
```

### Blocking Error Example (400)

```json
{
  "error": "Loan in progress",
  "message": "You cannot buy units while you have a pending or incomplete loan. Please clear your loan first."
}
```

---

## 4) Buy Units - Check Status (`POST /meter/check-payment-status/`)

### Request

```json
{
  "transaction_id": 311
}
```

### Success Response (200)

```json
{
  "status": "SUCCESS",
  "message": "Payment completed successfully",
  "units_purchased": 40.0,
  "token": null,
  "transaction": {
    "id": 311,
    "amount": 20000.0,
    "units": 40.0,
    "timestamp": "2026-04-06T09:35:12.781245+00:00"
  }
}
```

### Pending Response (200)

```json
{
  "status": "PENDING",
  "message": "Payment still processing"
}
```

### Failure Response (400)

```json
{
  "status": "FAILED",
  "message": "Payment failed"
}
```

---

## 5) Share Units - Step 1 Initiate (`POST /share/share-units/`)

### Request

```json
{
  "meter_number": "1234567890",
  "units": "12.50"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "Verification code sent to your email. Please check and verify.",
  "transaction_ref": "SHARE-A1B2C3D4",
  "requires_verification": true
}
```

### Validation Error Example (400)

```json
{
  "units": [
    "Minimum 2 units required to share"
  ]
}
```

---

## 6) Share Units - Step 2 Verify OTP (`POST /share/share-units/`)

### Request

```json
{
  "verification_code": "123456",
  "transaction_ref": "SHARE-A1B2C3D4"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "Units shared successfully",
  "transaction_ref": "SHARE-A1B2C3D4",
  "units_shared": "12.50"
}
```

### OTP Error Example (400)

```json
{
  "error": "Invalid or expired verification code"
}
```

---

## 7) Loan Apply (`POST /loans/apply/`)

### Request

```json
{
  "purpose": "Emergency electricity top-up",
  "amount_requested": 60000,
  "tenure_months": 2,
  "tariff_id": 1
}
```

### Success Response (201)

```json
{
  "loan_id": "LN-9Q1X7P",
  "credit_score": 82.5,
  "status": "APPROVED",
  "amount_requested": 60000.0,
  "amount_approved": 60000.0,
  "loan_tier": "SILVER",
  "max_eligible_amount": 100000,
  "interest_rate": 11.0,
  "tariff_applied": "CODE10.1",
  "units_calculated": 121.6,
  "cost_breakdown": [
    {
      "block_name": "Lifeline",
      "units": 50.0,
      "rate": 450.0,
      "cost": 22500.0,
      "block_range": "0-50"
    }
  ],
  "credit_factors": {
    "payment_history": "GOOD",
    "energy_consumption": "MODERATE",
    "financial_capacity": "STABLE",
    "major_weights": {
      "payment_history": 0.4,
      "energy_consumption": 0.3,
      "financial_capacity": 0.3
    },
    "factor_scores": {},
    "subfactor_scores": {},
    "threshold": 75,
    "source": "dummy"
  },
  "message": "Loan approved! You qualified for SILVER tier. Go to 'My Loans' to disburse and receive your electricity units."
}
```

### Error Example (400)

```json
{
  "error": "You already have an active loan. Please complete repayment before applying for a new one."
}
```

---

## 8) Loan Repay (`POST /loans/repay/{loan_id}/`)

### Request

```json
{
  "amount_paid": 15000
}
```

### Success Response (200, representative)

```json
{
  "message": "Repayment successful",
  "loan_id": "LN-9Q1X7P",
  "amount_paid": 15000.0
}
```

### Error Example (400)

```json
{
  "error": "Amount exceeds outstanding balance"
}
```

---

## Quick Testing Sequence

1. Register -> Login -> copy `access` token
2. Register meter (if not already)
3. Buy units -> poll payment status
4. Initiate share -> verify OTP
5. Apply loan -> disburse -> repay

---

## Important Notes

- OTP-based flows are two-step and must use the same authenticated user.
- Some responses include dynamic fields (`transaction_ref`, `external_id`, timestamps).
- `buy-units` and `loan` behavior can be constrained by active-loan guards and meter prerequisites.
