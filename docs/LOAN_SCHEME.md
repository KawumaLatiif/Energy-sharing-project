# gPawa Micro-Electricity Loan Scheme

This document describes how **energy loans** work in gPawa Energy Sharing, at the algorithm level: credit scoring, eligibility, tenure, disbursement (units math), repayment, and how customer behaviour changes what they can borrow next.

It reflects the **current implementation** in the backend (`loan` app + `utils/billing.py`). Every formula below is transcribed from the actual code, not a spec — file/line references are given so this can be re-verified against source at any time. Use it for product, support, compliance, and engineering onboarding.

---

## 1. Product summary

gPawa loans are **small, short-term credit for electricity**. Approved amounts are disbursed as **units (kWh) to the customer's wallet**, not cash — the UGX amount is converted to kWh using the same ERA tiered-tariff engine used for buying units. Customers repay in **UGX** (repayments convert back to kWh credited to the meter).

Design goals:

- **Low friction for new customers** — everyone can start borrowing without a long credit history (starter access).
- **Auto-approve, auto-disburse** — no human underwriting and no manual "accept loan" step; the moment a loan is approved (system decision, not admin), it is disbursed in the same request.
- **Repayment builds trust** — limits grow when loans are repaid on time; they shrink when customers are late or default.
- **One active loan at a time** — keeps exposure manageable on a prepaid energy platform.
- **Same rules on web, mobile, and USSD** — one shared service layer (`loan.services`), so there is exactly one implementation of every algorithm below.

---

## 2. Loan lifecycle & statuses

```
┌─────────────┐     ┌──────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│  APPLY      │────▶│ APPROVED │────▶│ DISBURSED │────▶│  REPAY    │────▶│ COMPLETED │
│ (customer)  │     │ (system, │     │ (system,  │     │ (partial/ │     │           │
│             │     │ scoring) │     │ automatic)│     │  full)    │     │           │
└─────────────┘     └──────────┘     └───────────┘     └───────────┘     └───────────┘
                           │                                    │
                           ▼                                    ▼
                     ┌──────────┐                       ┌───────────┐
                     │ REJECTED │                       │ DEFAULTED │
                     └──────────┘                       │ (manual)  │
                                                         └───────────┘
```

| Status | Meaning | Set by |
|--------|---------|--------|
| `PENDING` | Legacy / effectively unused — every current application resolves to `APPROVED` or `REJECTED` synchronously | — |
| `APPROVED` | Score/limit check passed; **transient** — the platform disburses in the same request. Only lingers if the disbursement attempt raised an exception | `create_loan_application` / `LoanApplicationView.create` |
| `DISBURSED` | Units credited to the wallet; loan is **active** and repayable | `disburse_loan` |
| `COMPLETED` | Outstanding balance reached zero | `repay_loan` (or `reconcile_user_loan_statuses`) |
| `REJECTED` | Amount approved was 0 (over limit / not eligible) | `create_loan_application` |
| `DEFAULTED` | Serious delinquency — **no automatic transition exists yet**; this status is only ever set manually (admin/DB), it feeds the Trust Ladder penalty (§3.2) if set | admin only |

**Statuses in `backend/loan/services.py`:**

```python
APPLY_BLOCK_STATUSES = ("PENDING", "APPROVED", "DISBURSED")   # blocks new applications
TERMINAL_LOAN_STATUSES = ("COMPLETED", "REJECTED")            # excluded from "incomplete" queries
DEBT_LOAN_STATUSES = ("DISBURSED", "DEFAULTED")                # carries an outstanding balance
```

### 2.1 Auto-disburse — no "Accept Loan" step

`create_loan_application()` (used by USSD directly, and mirrored by `LoanApplicationView.create` for web/mobile) calls `disburse_loan()` **immediately** after setting status to `APPROVED`, inside the same HTTP request / USSD screen:

```python
if loan.status == "APPROVED":
    try:
        disburse_loan(user, loan.id, channel=channel)
        loan.refresh_from_db()
    except Exception:
        logger.exception(...)   # loan stays APPROVED — see 2.2
```

There is no customer-facing "accept" or "disburse" action anywhere in the product. A loan going from application to units-in-wallet is a single, synchronous step.

### 2.2 Self-healing reconciliation

`reconcile_user_loan_statuses(user)` runs on **every** loan list/stats fetch (`GET /loans/my-loans/`, `GET /loans/stats/`, `GET /loans/<id>/`, and internally before any blocking/eligibility check). Besides its original job — flipping `DISBURSED`/`DEFAULTED` loans to `COMPLETED` once `outstanding_balance <= 0` — it also **retries disbursement for any loan still stuck at `APPROVED`**:

```python
for loan in LoanApplication.objects.filter(user=user, status="APPROVED"):
    try:
        disburse_loan(user, loan.id, channel="RECONCILE")
    except Exception:
        logger.exception(...)   # leave APPROVED, retry again next fetch
```

So a transient disbursement failure (e.g. a DB hiccup) self-heals the next time the customer opens their loans page — no admin ticket needed in the common case. `disburse_loan()` takes a row lock (`select_for_update()`) around the status check + write, so a reconcile retry racing the original apply-time attempt cannot double-credit the wallet.

The only case that stays stuck indefinitely is a **structural** failure (e.g. the customer's meter was deleted after approval) — that requires an admin to fix the underlying cause, then the next reconcile pass disburses it.

---

## 3. Eligibility & the credit score algorithm

The **effective credit score (0–100)** that gates borrowing is built in two layers: a static **profile score** (from onboarding answers) adjusted by a dynamic **Trust Ladder** delta (from actual repayment behaviour). Single entry point: `resolve_user_loan_access(user)` in `backend/loan/services.py`.

### 3.1 Profile score — weighted sub-factor model

Source: `backend/loan/scoring.py`.

**Step 1 — three major factors, each derived from onboarding profile fields:**

| Factor | Weight | Derived from user fields |
|--------|--------|---------------------------|
| `payment_history` | **1** | `payment_consistency`, `disconnection_history` |
| `energy_consumption` | **2** | `consumption_level`, `purchase_frequency` |
| `financial_capacity` | **3** | `monthly_income`, `income_stability` |

Weights sum to 6 → `financial_capacity` is 50% of the profile score, `energy_consumption` 33%, `payment_history` 17%.

**Step 2 — derivation rules** map raw profile answers to one of three categories per factor (`_derive_payment_history`, `_derive_energy_consumption`, `_derive_financial_capacity`):

```
payment_history:
  "Mostly late" / "Never paid"                          → POOR
  3+ disconnections                                       → POOR
  "Always on time" AND no disconnections                  → GOOD
  "Often on time" / "Sometimes late" / 1-2 disconnections → FAIR
  (no answer given)                                       → FAIR   (default)

energy_consumption:
  High/Extremely-high consumption AND Weekly/Biweekly buys → STABLE
  Very-low consumption AND Rarely buys                     → ERRATIC
  (any other answer, or none)                              → MODERATE (default)

financial_capacity:
  income > 500,000 UGX                                     → STRONG
  income 200,000-499,999 AND stable/regular income          → STRONG
  income < 100,000 UGX, OR unstable/seasonal income         → WEAK
  (any other answer, or none)                               → AVERAGE (default)
```

If **none** of the profile fields are filled in, the signal `source` is `"DEFAULT"` (FAIR / MODERATE / AVERAGE across the board) rather than `"PROFILE"` — this is what every brand-new customer starts with, and it's deliberately *not* the worst category, so starter borrowing isn't penalised for an incomplete profile.

**Step 3 — each factor's category converts to a 0–100 score via a weighted average of 3 sub-factors:**

| Factor | Sub-factors (weight) | GOOD/STABLE/STRONG | FAIR/MODERATE/AVERAGE | POOR/ERRATIC/WEAK |
|--------|----------------------|---------------------|------------------------|---------------------|
| `payment_history` | on_time_ratio (0.5), arrears_frequency (0.3), disconnection_events (0.2) | 95 / 90 / 90 | 75 / 60 / 55 | 45 / 35 / 30 |
| `energy_consumption` | usage_stability (0.4), peak_variation (0.35), seasonality (0.25) | 95 / 90 / 90 | 75 / 70 / 65 | 45 / 40 / 35 |
| `financial_capacity` | income_stability (0.4), expense_buffer (0.35), repayment_capacity (0.25) | 95 / 90 / 90 | 75 / 70 / 65 | 45 / 40 / 35 |

```python
factor_score = round( Σ(sub_score[i] × sub_weight[i]) / Σ(sub_weight[i]) )
```

**Step 4 — the three factor scores combine into the profile score:**

```python
profile_score = round( Σ(factor_score[f] × FACTOR_WEIGHT[f]) / Σ(FACTOR_WEIGHT[f]) )
profile_score = clamp(profile_score, 0, 100)
```

**Worked example — a brand-new customer with no profile filled in (`DEFAULT` signal, FAIR/MODERATE/AVERAGE):**

```
payment_history (FAIR):   75×0.5 + 60×0.3 + 55×0.2 = 66.5 → round → 66
energy_consumption (MOD): 75×0.4 + 70×0.35 + 65×0.25 = 70.75 → round → 71
financial_capacity (AVG): 75×0.4 + 70×0.35 + 65×0.25 = 70.75 → round → 71

profile_score = (66×1 + 71×2 + 71×3) / 6 = 421 / 6 = 70.17 → round → 70
```

*(Confirmed live against `GET /loans/stats/` for a fresh account: `"profile_score": 70`.)*

### 3.2 Trust Ladder — performance adjustment

Source: `backend/loan/trust_ladder.py`, `compute_repayment_trust(user)`.

Computed from the customer's **completed**, **defaulted**, and **overdue** loans:

```python
on_time_completions = COMPLETED loans with no repayment row where is_on_time=False
late_completions     = COMPLETED loans - on_time_completions
defaulted_count       = count of loans with status DEFAULTED
active_overdue         = True if any DISBURSED loan has due_date in the past
```

**Score delta:**

| Event | Score delta |
|-------|-------------|
| Each on-time completion | **+4** |
| Each late completion | **+1** |
| Each default | **−12** |
| Currently overdue | **−5** |

```python
score_delta = on_time×4 + late×1 - defaulted×12 - (5 if active_overdue else 0)
```

**Trust cap (limit growth):**

```python
trust_cap = STARTER_MAX_LOAN(30,000) + on_time×15,000 + late×7,500

if defaulted_count > 0:
    trust_cap = min(trust_cap, 15,000 + on_time×15,000)   # rehab ceiling
if active_overdue:
    trust_cap = min(trust_cap, 20,000)                     # overdue ceiling
```

| Completed on-time loans | Trust cap (UGX) |
|--------------------------|------------------|
| 0 | 30,000 |
| 1 | 45,000 |
| 2 | 60,000 |
| 3 | 75,000 |
| n | 30,000 + n × 15,000 |

**Trust level** (display/UX only, doesn't change the math directly):

```python
if active_overdue or defaulted_count > 0:      → "at_risk"
elif completed_count == 0:                     → "starter"
elif on_time_completions >= 3:                 → "trusted"
else:                                           → "building"
```

### 3.3 Effective score & effective limit

```python
credit_score = clamp(profile_score + score_delta, 0, 100)
if defaulted_count == 0 and not active_overdue:
    credit_score = max(credit_score, 76)     # good-standing floor (STARTER_CREDIT_SCORE)
```

The **76 floor** is why a brand-new customer with a 70 profile score still shows a **credit_score of 76** and clears the 75-point loan threshold — starter access does not depend on the profile assessment being filled in, only on not being in bad standing.

**Loan tier** (from `LoanTier` DB table, admin-configurable; hardcoded fallback in `loan/models.py` if the table lookup fails):

| Tier | Score band | Tier max (UGX) | Interest (p.a.) |
|------|-----------|------------------|-------------------|
| Bronze | 75–79 | 50,000 | 12% |
| Silver | 80–84 | 100,000 | 11% |
| Gold | 85–89 | 150,000 | 10% |
| Platinum | 90–100 | 200,000 | 9% |
| (below 75) | — | falls back to `"STARTER"`, 30,000 tier max, 12% interest | |

**Effective borrowing limit — the lowest of three ceilings:**

```python
max_eligible_amount = min(trust_cap, tier_max, PLATFORM_MAX_LOAN=200,000)
if max_eligible_amount < MIN_LOAN_AMOUNT(5,000):
    max_eligible_amount = 0

is_loan_eligible = (max_eligible_amount >= 5,000) AND (credit_score >= 75)
```

`resolve_user_loan_access()` is the single function that returns all of this (`credit_score`, `profile_score`, `loan_tier`, `max_eligible_amount`, `trust_level`, `trust_cap`, `is_loan_eligible`, …) — it is what every channel (web, mobile, USSD) calls to show eligibility and to gate applications.

---

## 4. Application & approval algorithm

`create_loan_application()` in `backend/loan/services.py` (USSD calls this directly; `LoanApplicationView.create` duplicates the same steps for web/mobile so the response can include extra UI fields like a cost breakdown — both call `resolve_user_loan_access` and disburse the same way):

1. **Block check:** reject if the user already has a `PENDING`/`APPROVED`/`DISBURSED` loan (`user_can_apply_for_loan`).
2. **Meter check:** reject if no registered meter.
3. **Amount validation:** `5,000 ≤ amount_requested ≤ 200,000`.
4. **Tenure validation:** integer `1–12` (§5).
5. **Eligibility:** `resolve_user_loan_access(user)` → `max_eligible_amount`, `credit_score`, `loan_tier`, `interest_rate`.
6. **Approved amount:**
   ```python
   amount_approved = min(max_eligible_amount, amount_requested)
   status = "APPROVED" if amount_approved > 0 else "REJECTED"
   ```
   Note this means a request for more than the customer's limit is **not rejected outright** — it's silently capped to the limit and approved at the lower amount.
7. **Persist** `LoanApplication` row, log `TransactionLog` (`LOAN_APPLICATION`), fire an in-app notification + email.
8. **Auto-disburse** if `APPROVED` (§2.1).

---

## 5. Tenure and due dates

Source: `backend/loan/tenure.py`.

| Rule | Value |
|------|--------|
| Tenure range | **1–12** months (integer) |
| Month length | **30 calendar days** (not a calendar month) |
| Due date | `disbursement_date + (tenure_months × 30 days)` |

Tenure only sets the **interest period and penalty trigger date** — repayment itself has no fixed instalment schedule (§7).

---

## 6. Disbursement algorithm — UGX → units conversion

Source: `disburse_loan()` in `loan/services.py`, unit math in `utils/billing.py`.

1. Resolve the `APPROVED` loan (by id, or "0"/none = latest approved), lock the row (`select_for_update`).
2. Re-check status is still `APPROVED` and `amount_approved > 0` (post-lock, race-safe).
3. Convert `amount_approved` (UGX) → kWh via `LoanApplication.calculate_units_from_amount()`, which calls the same **ERA tiered billing engine** used for buying units — see §9 for the full conversion algorithm. Loan disbursement always passes `apply_deductions=False` (existing loan debt is *not* subtracted from the amount being disbursed — that would be circular).
4. Create a `LoanDisbursement` row: `disbursed_amount`, `units_disbursed`, a random 10-digit `token` (30-day expiry — currently informational only, no channel requires re-entering it).
5. Loan status → `DISBURSED`.
6. Credit the customer's **unit wallet** (`wallet.models.Wallet.balance += units_disbursed`).
7. Best-effort push to the physical meter via ThingsBoard (`push_units_to_thingsboard`) — **never blocks disbursement**; if the meter has no device token or the push fails, the wallet is still credited and the loan is still `DISBURSED`, the failure is only logged in `TransactionLog.details.meter_push`.
8. Log `TransactionLog` (`LOAN_DISBURSEMENT`) + `UnitTransaction` (self-credit, direction `IN`).
9. In-app notification (`TYPE_LOAN_DISBURSEMENT`) + email (`handle_send_loan_disbursed_email`).

---

## 7. Interest, penalty, and outstanding balance

Source: `LoanApplication.outstanding_balance` / `total_amount_due` properties in `loan/models.py`.

```python
principal = amount_approved
interest  = principal × (interest_rate / 100) × (tenure_months / 12)     # pro-rata annual rate

if now() > due_date:
    days_late = (now() - due_date).days
    penalty = days_late × 0.001 × principal                              # 0.1% of principal / day late
else:
    penalty = 0

total_charges = min(interest + penalty, principal × MAX_CUMULATIVE_CHARGES_MULTIPLIER)  # statutory cap, default 1.0
                                                                          # i.e. interest+penalty can never exceed 100% of principal
total_due = principal + total_charges
outstanding_balance = max(0, total_due - amount_paid)
```

The `MAX_CUMULATIVE_CHARGES_MULTIPLIER` cap (env-configurable, default `1.0` = 100% of principal) mirrors Uganda's Tier 4 MFI / Money Lenders Act cap. `LoanTier.interest_rate` is separately capped at `MAX_ANNUAL_INTEREST_RATE_PCT` (33.6% p.a. = 2.8%/month) at the database-validation level (`LoanTier.clean()`), so an admin cannot configure a tier above the statutory monthly rate.

**Worked example** (30,000 UGX, Bronze 12% p.a., 2-month tenure, paid on time, no partial payments yet):

```
interest = 30,000 × 0.12 × (2/12) = 600
outstanding_balance = 30,000 + 600 - 0 = 30,600 UGX
```

---

## 8. Repayment algorithm

Source: `repay_loan()` in `loan/services.py`.

1. Resolve the loan to repay: explicit `loan_id`, or `"0"`/none → `get_repayable_loan(user)` (most recent `DISBURSED` loan with `outstanding_balance > 0`).
2. Must be `DISBURSED` (not `APPROVED`, not already `COMPLETED`).
3. `0 < amount ≤ outstanding_balance` — over-payment is rejected outright, not clamped.
4. Convert the UGX payment → kWh via the same ERA billing engine (`apply_deductions=False`).
5. Create `LoanRepayment` row: `amount_paid`, `units_paid`, `payment_reference`, `is_on_time = now() ≤ due_date`.
6. Credit the equivalent kWh **directly to the meter** (not the unit wallet — repayment units go straight to the physical meter).
7. Log `TransactionLog` (`LOAN_REPAYMENT`) + `UnitTransaction`.
8. Recompute `outstanding_balance`; if `≤ 0` → status `COMPLETED`, log `TransactionLog` (`LOAN_COMPLETION`).
9. All of the above happens inside a single `transaction.atomic()` block.

**Flexibility:** any amount up to the outstanding balance, any number of times, no fixed instalment schedule — tenure only determines the due date used for the on-time flag and late penalty (§7), not a payment calendar.

**Auto-offset on unit purchase:** when buying units through the normal top-up flow, `get_outstanding_deductions()` subtracts any `DISBURSED` loan balance from the payment *before* computing purchasable units (see `utils/billing.calculate_units_from_payment`, called with `apply_deductions=True` from the buy-units path) — so a customer with an open loan effectively repays it first out of every top-up, then whatever's left buys units. This is also why `user_can_purchase_units()` blocks buying units outright while any loan is open (§10) — the two mechanisms work together to keep exposure controlled.

### 8.1 Pay-for-someone (third-party repayment)

`PayForSomeoneView` (`POST /loans/pay-for-someone/`) lets one user repay *another* user's loan:

1. Look up the loan owner by `owner_phone`.
2. Reject if the payer is the owner (use the normal repay flow instead).
3. Call the same `repay_loan()`, passing `paid_by_user=<payer>` and `is_anonymous`.
4. Two notifications fire: the owner is told their loan was paid (by name, or "an anonymous benefactor" if `is_anonymous`); the payer gets a confirmation of what they paid and for whom.

`LoanLookupByPhoneView` (`GET /loans/lookup-by-phone/`) is the preview step — resolves the owner + their current outstanding balance before the payer commits to an amount.

---

## 9. Units ↔ UGX conversion engine (ERA tariff billing)

Both disbursement (§6) and repayment (§8) reuse this engine — source `utils/billing.py`. This is also the engine behind ordinary unit purchases.

**Tariff structure** (`ElectricityTariff` + `TariffBlock`, ERA/UEDCL Domestic Code 10.1, versioned by `effective_from`/`effective_to` so a rate change is a data edit, not a deploy):

| Block | Range (kWh, monthly cumulative) | Rate (UGX/kWh) |
|-------|-----------------------------------|------------------|
| Lifeline | 0–15 | 250.00 *(lifeline-eligible customers only; else falls back to the Normal rate)* |
| Normal | 16–80 | 756.20 |
| Cooking | 81–150 | 412.00 |
| Super normal | 151+ | 756.00 |

Plus:
- **Service charge:** 3,360 UGX, charged **once per calendar month** (waived if the customer already bought units this month).
- **VAT:** 18% of `(energy cost + service charge)`.

**Lifeline eligibility:** pilot default is `Profile.lifeline_eligible = True` for everyone; production formula (`recompute_lifeline_eligibility`) is a rolling 6-month average ≤ 100 kWh/month.

**Cost → units is solved by binary search** (`calculate_units_from_payment`), because the tiered/cumulative blocks make it non-invertible analytically:

```python
net = payment_ugx - deductions          # deductions = existing loan balance, only when apply_deductions=True
lo, hi = 0, 2000                        # kWh search bounds
repeat up to 90 times:
    mid = (lo + hi) / 2
    bill = calculate_bill_for_units(mid)   # energy (tiered, cumulative w/ this month's prior purchases) + service + 18% VAT
    if bill.total <= net:
        best = mid; lo = mid            # can afford at least this many units — try more
    else:
        hi = mid                        # too expensive — try fewer
    stop when (hi - lo) < 0.0001
```

This finds the maximum kWh whose full bill (energy, cumulative with anything already bought this calendar month, + service charge + VAT) does not exceed the net payment. `apply_deductions` is `False` for both loan disbursement and loan repayment (their UGX amount converts to units directly, undiscounted by any loan balance — deducting it would be circular since the loan itself *is* the balance).

---

## 10. Business rules and blocks

| Rule | Behaviour | Function |
|------|-----------|----------|
| One loan at a time | Cannot apply while another loan is `PENDING`, `APPROVED`, or `DISBURSED` | `user_can_apply_for_loan` |
| Buy units while indebted | **Blocked** while `pending_applications > 0` or `outstanding_balance > 0` on any `DISBURSED`/`DEFAULTED` loan | `user_can_purchase_units` / `get_blocking_loan_state` |
| Meter required | Must have a registered meter to apply (and to disburse — resolved again at disbursement time) | `create_loan_application`, `disburse_loan` |
| Approval amount | `min(amount_requested, max_eligible_amount)` — never rejected purely for asking too much, just capped | `create_loan_application` |
| Repayment amount | `0 < amount ≤ outstanding_balance` — over-payment rejected, not clamped | `repay_loan` |

---

## 11. Channels (parity)

| Feature | Web | Mobile | USSD |
|---------|-----|--------|------|
| Check eligibility / stats | ✓ (`loans/stats/`) | ✓ (same API) | ✓ `3*4` |
| Apply (amount + tenure, auto-disburses) | ✓ | ✓ (same API) | ✓ `3*2*<amount>*<tenure>` |
| Repay (full / partial) | ✓ | ✓ (same API) | ✓ `3*3` |
| Latest loan | ✓ (My Loans table) | ✓ | ✓ `3*1` |
| Pay for someone | ✓ | — | — |

There is no "Disburse loan" or "Accept loan" action on any channel — see §2.1.

Shared logic for all three channels: `loan.services.create_loan_application`, `resolve_user_loan_access`, `disburse_loan`, `repay_loan`, `reconcile_user_loan_statuses`.

USSD menu details: [USSD_INTEGRATION.md](../USSD_INTEGRATION.md). Buy-units tariff details: [TARIFFS_AND_BUY_UNITS.md](TARIFFS_AND_BUY_UNITS.md).

---

## 12. API quick reference

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/loans/stats/` | Eligibility, trust level, limits, outstanding, `repayable_loan` |
| `POST /api/v1/loans/apply/` | Submit application (`amount_requested`, `tenure_months`, `purpose`) — auto-disburses if approved |
| `GET /api/v1/loans/my-loans/` | List loans (triggers reconciliation, §2.2) |
| `POST /api/v1/loans/repay/active/` | Repay the current active loan (full or partial) |
| `POST /api/v1/loans/repay/<id>/` | Repay a specific loan by id |
| `POST /api/v1/loans/repay/momo/active/` | Repay active loan via MTN MoMo |
| `GET /api/v1/loans/lookup-by-phone/?phone=` | Preview another user's owed balance before paying for them |
| `POST /api/v1/loans/pay-for-someone/` | Repay someone else's loan (§8.1) |
| `POST /api/v1/loans/disburse/<id>/` | Admin-only manual disbursement retry (not exposed in any customer UI) |

**Key `loans/stats/` fields:**

```json
{
  "credit_score": 76,
  "profile_score": 70,
  "loan_tier": "BRONZE",
  "max_eligible_amount": 30000,
  "starter_max_loan": 30000,
  "platform_max_loan": 200000,
  "trust_level": "starter",
  "trust_cap": 30000,
  "loans_completed_on_time": 0,
  "loans_completed_late": 0,
  "loans_defaulted": 0,
  "loan_overdue": false,
  "is_loan_eligible": true,
  "active_loans": 0,
  "pending_applications": 0,
  "outstanding_balance": 0,
  "has_blocking_loan": false,
  "repayable_loan": null
}
```
*(Field values above are a live capture from a fresh account, taken during end-to-end verification of this system.)*

---

## 13. Admin configuration

- **Loan tiers** — Django admin → `LoanTier`: score bands, max amounts, interest rates. `clean()` enforces non-overlapping bands and the 33.6% p.a. statutory interest cap.
- **Tariffs** — `ElectricityTariff` / `TariffBlock`: affects units-per-UGX at disbursement, repayment, and purchase.
- **Trust Ladder constants** — `loan/trust_ladder.py` (code constants, requires a deploy to change: starter cap, bonus/penalty sizes, rehab/overdue ceilings).
- **Statutory caps** — env vars `MAX_ANNUAL_INTEREST_RATE_PCT`, `MAX_CUMULATIVE_CHARGES_MULTIPLIER`.
- **Manual disbursement retry** — admin panel `LoanDisburseView`, for the rare structural failure that reconciliation (§2.2) can't self-heal (e.g. deleted meter).

---

## 14. Support cheat sheet

**"I'm new — how much can I borrow?"**
Up to **UGX 30,000** once your meter is registered and you have no other open loan — no assessment form required.

**"Why did I get less than I asked for?"**
Requests above your limit are approved *at your limit*, not rejected — check `max_eligible_amount`.

**"How do I borrow more?"**
Repay loans **on time**. Each on-time completion adds **UGX 15,000** to your limit and **+4** to your score (late completions add UGX 7,500 / +1).

**"Why is my limit only 20,000?"**
You likely have an **overdue** active loan — the cap is held at UGX 20,000 until you clear it.

**"I applied and it still shows Approved, not Disbursed — is that a bug?"**
Only if it stays that way after reloading the page — reconciliation retries automatically on every page load (§2.2). If it's still stuck after that, it's a structural issue (e.g. meter removed) and needs an admin.

**"What does tenure mean?"**
Number of **30-day periods** from disbursement — that's your interest period and the date late penalties start, not a fixed monthly bill. Pay any amount, any time.

**"Can I repay early / in parts?"**
Yes — any amount up to the outstanding balance, as many times as needed, until it hits zero.

---

## 15. Related code map

| Topic | Location |
|-------|----------|
| Credit score / sub-factor model | `backend/loan/scoring.py` |
| Trust Ladder | `backend/loan/trust_ladder.py` |
| Eligibility, apply, disburse, repay, reconcile | `backend/loan/services.py` |
| Tenure / due date | `backend/loan/tenure.py` |
| Interest / penalty / outstanding balance | `backend/loan/models.py` → `LoanApplication.outstanding_balance`, `.total_amount_due` |
| Tariff tiers, loan tier config | `backend/loan/models.py` → `ElectricityTariff`, `TariffBlock`, `LoanTier`, `get_tier_by_score` |
| UGX ↔ units conversion (ERA billing) | `backend/utils/billing.py` |
| Auto-repay on top-up (deduction) | `backend/utils/billing.py` → `get_outstanding_deductions` |
| Web application view | `backend/loan/api/views.py` → `LoanApplicationView`, `PayForSomeoneView`, `LoanLookupByPhoneView` |
| Web UI (apply) | `frontend/.../request-loan/_components/simple-loan-form.tsx`, `loan-form.tsx` |
| Web UI (list/repay) | `frontend/.../myloans/_components/loan-list.tsx` |
| Mobile UI | `mobile/app/(app)/(tabs)/loans.tsx` |
| USSD | `backend/ussd/views.py` (menu `3` Loans) |

---

## 16. Future enhancements (not yet implemented)

- Automatic `DEFAULTED` status after X days past due (currently manual only, yet it already feeds the Trust Ladder penalty once set)
- SMS/USSD reminders before `due_date`
- Scheduled instalment nudges (optional minimum per month)
- Separate processing fee line item in ledger
- Per-user USSD PIN (see `ussd/pin_service.py` when enabled)
- Row-level locking on the wider blocking-check path (`user_can_apply_for_loan`) to close a narrow race if two applications are submitted in the same instant

---

*Last updated: July 2026 — reflects auto-disburse-on-approval, reconciliation self-healing, and the full credit-scoring/billing algorithms verified against source and a live test run.*
