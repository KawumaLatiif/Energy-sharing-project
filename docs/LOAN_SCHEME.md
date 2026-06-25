# gPawa Micro-Electricity Loan Scheme

This document describes how **energy loans** work in gPawa Energy Sharing: eligibility, limits, tenure, pricing, repayment, and how customer behaviour changes what they can borrow next.

It reflects the **current implementation** in the backend (`loan` app). Use it for product, support, compliance, and engineering onboarding.

---

## 1. Product summary

gPawa loans are **small, short-term credit for electricity**. Approved amounts are disbursed as **units (kWh) to the customer’s wallet/meter**, not cash. Customers repay in **UGX** via mobile money or other supported channels; repayments can also be **auto-deducted from unit top-ups**.

Design goals:

- **Low friction for new customers** — everyone can start borrowing without a long credit history.
- **Repayment builds trust** — limits grow when loans are repaid on time; they shrink when customers are late or default.
- **One active loan at a time** — keeps exposure manageable on a prepaid energy platform.
- **Same rules on web, mobile, and USSD** — one shared service layer (`loan.services`).

---

## 2. The Trust Ladder

The **Trust Ladder** is gPawa’s progressive credit model. It sits on top of profile-based scoring and tier caps.

### 2.1 Starter access (every new customer)

| Rule | Value |
|------|--------|
| Starter borrowing limit | **UGX 30,000** |
| Minimum effective credit score | **76 / 100** (floor while in good standing) |
| Profile / loan assessment required? | **No** — starter access does not depend on completing the assessment form |
| Registered meter required? | **Yes** |

A brand-new customer with zero loan history and no overdue balance can apply for up to **UGX 30,000** immediately (subject to one-loan-at-a-time rules below).

### 2.2 Trust levels

| Level | When | Typical limit behaviour |
|-------|------|-------------------------|
| `starter` | No completed loans, good standing | **UGX 30,000** |
| `building` | 1–2 on-time completions (or mixed history) | **30k + bonuses** (see below) |
| `trusted` | 3+ on-time completions, no default/overdue | Higher cap, approaching tier ceiling |
| `at_risk` | Active overdue loan and/or past default | Cap reduced (see penalties) |

### 2.3 How limits grow (good behaviour)

Bonuses are computed from **completed** loans and whether any repayment on that loan was late.

| Event | Limit bonus | Score bonus |
|-------|-------------|-------------|
| Loan completed **on time** (all repayments before due date) | **+ UGX 15,000** | **+ 4** points |
| Loan completed **late** (at least one late repayment) | **+ UGX 7,500** | **+ 1** point |

**On-time** means: loan status `COMPLETED` and no repayment row with `is_on_time=False`.

**Example progression (good standing, tier not binding):**

| Completed on-time loans | Trust cap (UGX) |
|-------------------------|-----------------|
| 0 | 30,000 |
| 1 | 45,000 |
| 2 | 60,000 |
| 3 | 75,000 |
| … | +15,000 per on-time loan |

The **effective limit** is the **lowest** of:

1. Trust Ladder cap  
2. Credit **tier** max (from score; admin-configurable in `LoanTier`)  
3. **Platform maximum** (UGX 200,000)

### 2.4 How limits shrink (poor behaviour)

| Condition | Effect |
|-----------|--------|
| **Active overdue** loan (`DISBURSED` and past `due_date`) | Cap capped at **UGX 20,000**; score **−5** |
| **Defaulted** loan (`DEFAULTED` status) | Cap capped at **UGX 15,000** (+ on-time rehab bonuses); score **−12** per default |
| Score floor (76) | **Not applied** while `at_risk` |

Customers in `at_risk` must **repay overdue balances** before normal starter access is restored.

### 2.5 Implementation reference

| Module | Role |
|--------|------|
| `backend/loan/trust_ladder.py` | Trust cap, score deltas, trust levels |
| `backend/loan/services.py` → `resolve_user_loan_access()` | Single entry point for eligibility |
| `GET /api/v1/loans/stats/` | Exposes `trust_level`, `starter_max_loan`, `max_eligible_amount`, etc. |

---

## 3. Amount limits

| Constant | Value | Meaning |
|----------|--------|---------|
| Minimum loan | **UGX 5,000** | Smallest application / approval |
| Starter max | **UGX 30,000** | New-user Trust Ladder ceiling |
| Platform max | **UGX 200,000** | Absolute ceiling (top tier) |
| Minimum credit score to borrow | **75** | Effective score must meet this (starter floor is 76) |

**Tier table (fallback / admin `LoanTier` model):**

| Tier (score band) | Typical max (UGX) | Typical interest (p.a.) |
|-------------------|-------------------|-------------------------|
| Bronze | 75–79 → 50,000 | 12% |
| Silver | 80–84 → 100,000 | 11% |
| Gold | 85–89 → 150,000 | 10% |
| Platinum | 90–100 → 200,000 | 9% |

Tiers in production are read from the **database** (`LoanTier`) when configured; hardcoded values in `loan/models.py` are fallback only.

---

## 4. Tenure and due dates

| Rule | Value |
|------|--------|
| Tenure range | **1–12 months** (integer) |
| What “month” means | **30 calendar days per month** from **disbursement** time |
| Due date formula | `disbursement_date + (tenure_months × 30 days)` |

Tenure is chosen at application time on **web**, **mobile**, and **USSD** (USSD: amount → tenure → submit).

Repayment is **flexible**: customers may pay **any partial amount** until the loan is cleared; there is no fixed monthly instalment schedule. Tenure defines the **maturity date** and **interest period**, not a rigid EMI calendar.

**Implementation:** `backend/loan/tenure.py`, `LoanApplication.due_date` property.

---

## 5. Credit score

The displayed **credit score (0–100)** combines two inputs:

### 5.1 Profile score (static assessment)

Derived from the customer’s **loan assessment** answers (payment consistency, income, consumption, etc.) via `UserCreditSignal` and weighted sub-factors in `backend/loan/scoring.py`.

Profile improves the score but **does not block** starter borrowing.

### 5.2 Performance score (dynamic)

Adjusted by the Trust Ladder from real loan outcomes (on-time / late / default / overdue). See section 2.

### 5.3 Effective score

```
effective_score = clamp(profile_score + performance_delta, 0, 100)
if good standing:
    effective_score = max(effective_score, 76)
```

---

## 6. Interest, fees, and penalties

### 6.1 Interest

- Stored as **annual percentage** on the loan (`interest_rate`), set from tier at approval.
- **Pro-rata** over chosen tenure:  
  `interest = principal × (rate / 100) × (tenure_months / 12)`

### 6.2 Late penalty

- **0.1% of principal per day** after `due_date`.
- Applied in `LoanApplication.outstanding_balance`.

### 6.3 Statutory charge cap

Total of interest + penalties is capped at **100% of principal** (configurable via `MAX_CUMULATIVE_CHARGES_MULTIPLIER`, default `1.0`), aligned with Uganda Tier 4 MFI / money-lender limits.

### 6.4 Processing fee (web UI display)

The web loan form may show a **2% processing fee** in the customer-facing breakdown; confirm with finance whether this is charged at disbursement or display-only.

---

## 7. Loan lifecycle

```
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  APPLY      │────▶│ APPROVED │────▶│ DISBURSED │────▶│  REPAY    │────▶│ COMPLETED │
│ (customer)  │     │ (system) │     │ (customer │     │ (partial/ │     │           │
│             │     │          │     │  accepts) │     │  full)    │     │           │
└─────────────┘     └──────────┘     └───────────┘     └───────────┘     └───────────┘
                           │                                    │
                           ▼                                    ▼
                     ┌──────────┐                       ┌───────────┐
                     │ REJECTED │                       │ DEFAULTED │
                     └──────────┘                       │ (manual/  │
                                                        │  future)  │
                                                        └───────────┘
```

| Status | Meaning |
|--------|---------|
| `PENDING` | Legacy / rare; new applications auto-approve or reject |
| `APPROVED` | Amount approved; **units not yet in wallet** — customer must **disburse / accept** |
| `DISBURSED` | Units credited; loan is **active** |
| `COMPLETED` | Outstanding balance is zero |
| `REJECTED` | Not approved (e.g. over limit, at risk) |
| `DEFAULTED` | Serious delinquency (reduces Trust Ladder) |

**Disburse** = customer action (“Accept loan”) that moves approved credit into the **unit wallet** (and may push to AMI meter). This is **not** the same as admin-only bookkeeping; customers disburse via web, mobile, or USSD.

---

## 8. Repayment

### 8.1 Channels

- Web / mobile: **Repay loan** (full or partial), MoMo where integrated  
- USSD: Loans → Repay (full / partial)  
- **Auto-offset**: When buying units, incoming payment **pays down disbursed loan balance first**, then credits units (`meter/buy_units_payment.py`)

### 8.2 Flexibility

- Any amount from **UGX 1** up to **outstanding balance** per payment.  
- Multiple partial payments allowed until `COMPLETED`.  
- **On-time** flag per repayment: payment timestamp ≤ loan `due_date` at time of payment.

### 8.3 After full repayment

- Loan → `COMPLETED`  
- Trust Ladder recalculates on next `loans/stats/` or application  
- Customer may apply for a **new** loan (if no other blocking loan)

---

## 9. Business rules and blocks

| Rule | Behaviour |
|------|-----------|
| One loan at a time | Cannot apply while another loan is `PENDING`, `APPROVED`, or `DISBURSED` |
| Buy units while indebted | **Blocked** while any non-terminal loan exists (`PENDING` / `APPROVED` / `DISBURSED` / `DEFAULTED`) |
| Meter required | Must have a registered meter to apply |
| Approval amount | `min(amount_requested, max_eligible_amount)` |

---

## 10. Channels (parity)

| Feature | Web | Mobile | USSD |
|---------|-----|--------|------|
| Check eligibility / stats | ✓ | ✓ | ✓ (wallet / loans menus) |
| Apply (amount + tenure) | ✓ | ✓ | ✓ (`3*2*amount*tenure`) |
| Disburse approved loan | ✓ | ✓ | ✓ |
| Repay (full / partial) | ✓ | ✓ | ✓ |
| Trust Ladder limits | ✓ | ✓ | ✓ |

Shared logic: `loan.services.create_loan_application`, `resolve_user_loan_access`, `repay_loan`, `disburse_loan`.

USSD details: see [USSD_INTEGRATION.md](../USSD_INTEGRATION.md).

Buy-units tariff details: see [TARIFFS_AND_BUY_UNITS.md](TARIFFS_AND_BUY_UNITS.md).

---

## 11. API quick reference

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/loans/stats/` | Eligibility, trust level, limits, outstanding |
| `POST /api/v1/loans/apply/` | Submit application (`amount_requested`, `tenure_months`, `purpose`) |
| `POST /api/v1/loans/disburse/<id>/` | Disburse approved loan |
| `POST /api/v1/loans/repay/active/` | Repay active loan (web/mobile) |

**Key stats fields:**

```json
{
  "credit_score": 76,
  "profile_score": 70,
  "max_eligible_amount": 30000,
  "starter_max_loan": 30000,
  "platform_max_loan": 200000,
  "trust_level": "starter",
  "trust_cap": 30000,
  "loans_completed_on_time": 0,
  "loan_overdue": false,
  "is_loan_eligible": true
}
```

---

## 12. Admin configuration

- **Loan tiers** — Django admin → `LoanTier`: score bands, max amounts, interest rates.  
- **Tariffs** — `ElectricityTariff` / blocks affect **units per UGX** at disbursement and repayment conversion.  
- **Trust Ladder constants** — code in `loan/trust_ladder.py` (change requires deploy).

---

## 13. Support cheat sheet

**“I’m new — how much can I borrow?”**  
Up to **UGX 30,000** once your meter is registered and you have no other open loan.

**“How do I borrow more?”**  
Repay loans **on time**. Each on-time completion adds **UGX 15,000** to your limit (until tier/platform cap).

**“Why is my limit only 20,000?”**  
You likely have an **overdue** active loan. Repay it to restore starter access.

**“What does tenure mean?”**  
Number of **30-day periods** from when you **accept/disburse** the loan — that’s your repayment deadline for penalty purposes, not a fixed monthly bill.

**“Can I repay early?”**  
Yes — any time, any partial amount. Early repayment is encouraged.

---

## 14. Related code map

| Topic | Location |
|-------|----------|
| Trust Ladder | `backend/loan/trust_ladder.py` |
| Eligibility & apply | `backend/loan/services.py` |
| Profile scoring | `backend/loan/scoring.py` |
| Tenure / due date | `backend/loan/tenure.py` |
| Outstanding balance | `backend/loan/models.py` → `LoanApplication.outstanding_balance` |
| Auto-repay on top-up | `backend/meter/buy_units_payment.py` |
| Web UI | `frontend/.../request-loan/_components/simple-loan-form.tsx` |
| Mobile UI | `mobile/app/(app)/(tabs)/loans.tsx` |
| USSD | `backend/ussd/views.py` (menu `3` Loans) |

---

## 15. Future enhancements (not yet implemented)

- Automatic `DEFAULTED` status after X days past due  
- SMS/USSD reminders before `due_date`  
- Scheduled instalment nudges (optional minimum per month)  
- Separate processing fee line item in ledger  
- Per-user USSD PIN (see `ussd/pin_service.py` when enabled)

---

*Last updated: June 2026 — aligned with Trust Ladder starter cap (UGX 30,000) and 30-day month tenure.*
