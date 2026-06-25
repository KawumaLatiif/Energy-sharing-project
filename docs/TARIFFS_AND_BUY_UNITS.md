# gPawa Tariffs & Buy Units

This document explains how **electricity tariffs** work when customers **buy units (top up)** in gPawa: ERA-aligned block pricing, service charge, VAT, lifeline rules, loan offsets, and how payment amounts convert to **kWh** in the wallet.

It reflects the implementation in `backend/utils/billing.py` and the buy-units flow in `backend/meter/`.

---

## 1. Overview

| Concept | Detail |
|---------|--------|
| Regulatory basis | **ERA / UEDCL domestic end-user framework** (Code **10.1**, low-voltage domestic) |
| Tariff storage | Database: `ElectricityTariff` + `TariffBlock` (`loan` app) |
| Billing engine | `backend/utils/billing.py` |
| What customers buy | **kWh credited to unit wallet** (not cash); STS/AMI load is a separate step |
| Currency | **UGX** via mobile money (MTN MoMo) or sandbox simulation |

Buy-units pricing is **not** a flat rate. The engine uses:

1. **Monthly cumulative tiered energy blocks** (lifeline → normal → cooking → super-normal)  
2. **Monthly service charge** (once per calendar month, first purchase)  
3. **18% VAT** on energy + service  
4. **Deductions** (outstanding loan balance) before energy is calculated  

---

## 2. Energy blocks (monthly cumulative)

Blocks are **cumulative within the calendar month**. Each purchase “fills” the current band before spilling into the next. Rates apply to **marginal** kWh in each band, not retroactively to earlier purchases.

Default schedule (seeded as `DOM-10.1-2026Q1` via `python manage.py seed_era_tariff`):

| Band | Monthly kWh range | Rate (UGX/kWh) | Notes |
|------|-------------------|----------------|--------|
| **Lifeline** | 0 – 15 | **250** | Eligible consumers only |
| **Normal** | 15.1 – 80 | **756.20** | |
| **Cooking** | 80.1 – 150 | **412.00** | Lower rate band |
| **Super normal** | Above 150 | **756.00** | Open-ended top block |

If the customer is **not lifeline-eligible**, the first 15 kWh band uses the **non-lifeline rate** (**756.20** UGX/kWh) instead of 250.

### 2.1 How “already bought this month” is tracked

`get_monthly_units_consumed()` sums **completed** purchases in the current calendar month from:

- `UnitTransaction` (self-credits: `sender=user`, `receiver=user`, `direction=IN`)  
- `meter.Transaction` (`TYPE_PURCHASE`, completed)

This drives which block the **next** kWh falls into.

### 2.2 Current band (UI helper)

`get_monthly_tier_context()` exposes:

| Field | Meaning |
|-------|---------|
| `monthly_units_consumed` | kWh bought this month so far |
| `lifeline_remaining_kwh` | kWh left at lifeline rate (if eligible) |
| `current_tier_band` | `lifeline` \| `normal` \| `cooking` \| `super_normal` |
| `service_charge_due` | `true` if service fee applies on next purchase |
| `lifeline_eligible` | Whether lifeline rate applies |

---

## 3. Fixed charges

| Charge | Amount | When applied |
|--------|--------|--------------|
| **Service charge** | **UGX 3,360** / month (configurable on tariff) | First unit purchase in the **calendar month** only |
| **VAT** | **18%** of (energy cost + service charge) | Every purchase |

Constants in code: `DEFAULT_SERVICE_CHARGE = 3360`, `VAT_RATE = 0.18`.

**Important:** A small payment may yield **0 kWh** if it cannot cover service + VAT + minimal energy. The estimate API returns `minimum_payment` and `insufficient_amount` for this case.

---

## 4. Lifeline eligibility

| Mode | Rule |
|------|------|
| **Pilot (default)** | `Profile.lifeline_eligible = True` for all users unless changed |
| **Production rule** | `recompute_lifeline_eligibility()`: 6-month rolling average consumption **≤ 100 kWh/month** |

Lifeline affects only the **first 15 kWh per month** band.

---

## 5. From payment (UGX) to units (kWh)

### 5.1 Formula (conceptual)

For a net payment amount after deductions:

```
Find maximum kWh such that:
  energy_cost(kWh | monthly context, blocks, lifeline)
  + service_charge (if first purchase this month)
  + VAT(18%)
  ≤ net_payment
```

The engine uses **binary search** (`calculate_units_from_payment`) because block tiers make a closed-form inversion non-trivial.

### 5.2 Bill breakdown structure

`BillBreakdown` fields returned internally / via estimate API:

| Field | Description |
|-------|-------------|
| `energy_units` | kWh purchased |
| `energy_cost` | Block-tiered energy subtotal |
| `service_charge` | Monthly fixed fee (0 if already paid this month) |
| `subtotal` | energy + service |
| `vat` | 18% of subtotal |
| `total` | Amount consumed from payment |
| `amount_deducted` | Loan / bill deductions |
| `net_payment` | Gross payment − deductions |
| `lifeline_applied` | Whether lifeline rate was used |

### 5.3 Fallback

If no active domestic tariff or no blocks exist in DB:

- Flat energy rate: **756.20 UGX/kWh** (`FALLBACK_ENERGY_RATE`)  
- Tariff code shown as `DEFAULT_500` in some responses  

Always run `python manage.py seed_era_tariff` after fresh deploy.

---

## 6. Loan repayment before units

Outstanding **disbursed loan** balances affect how much money goes to energy.

### 6.1 At payment completion (`complete_buy_units_payment`)

```
Customer pays UGX X (MoMo)
    → Auto-repay loan(s) from X (oldest first)
    → Remainder = amount_for_units
    → calculate_units_from_payment(remainder)
    → Credit unit wallet
```

Loan repayment does **not** generate kWh; only the **remainder** is tariff-converted.

### 6.2 On estimate / quote (before payment)

`GET /api/v1/meter/estimate-units/?amount=` returns:

- `gross_amount` — what customer enters  
- `deductions` — outstanding loan total  
- `net_amount` — amount that would go to energy  
- `estimated_units` — kWh from net amount  

This matches what the customer should expect after auto-loan-offset.

### 6.3 Buy blocked with open loan

If the user has a **pending / approved / disbursed** non-terminal loan, **new purchases may be blocked** entirely (`user_can_purchase_units`). Clear the loan first. See [LOAN_SCHEME.md](LOAN_SCHEME.md).

---

## 7. Worked examples (lifeline-eligible, no prior purchases this month)

Verified by `python manage.py verify_era_billing` (first purchase in month, service + VAT included):

| Payment (UGX) | Approx. units (kWh) | Notes |
|---------------|---------------------|--------|
| 5,000 | **3.51** | Small top-up; much goes to service + VAT |
| 20,000 | **28.00** | Lifeline + normal bands |
| 80,000 | **107.99** | Spans multiple blocks |

### 7.1 Second purchase in the same month

Service charge **already paid** → more kWh per UGX:

| Prior monthly kWh | Payment (UGX) | Approx. units |
|-----------------|-----------------|---------------|
| 3.51 | 5,000 | **13.29** |
| 28 | 5,000 | **5.60** |

Higher prior consumption = higher marginal block rate = fewer new kWh for the same UGX.

---

## 8. Buy-units flow (end to end)

```
┌──────────────┐    ┌─────────────┐    ┌──────────────────┐    ┌─────────────┐
│ Enter amount │───▶│ Estimate API │───▶│ MoMo payment     │───▶│ Complete    │
│ (web/mobile/ │    │ (optional)   │    │ PENDING → SUCCESS│    │ payment     │
│  USSD)       │    └─────────────┘    └──────────────────┘    └──────┬──────┘
└──────────────┘                                                        │
                                                                        ▼
                                                              ┌─────────────────┐
                                                              │ Loan auto-repay │
                                                              │ (if any)        │
                                                              └────────┬────────┘
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │ Tariff engine   │
                                                              │ → kWh to wallet │
                                                              └─────────────────┘
```

| Step | Channel | Entry point |
|------|---------|-------------|
| Estimate | Web, mobile | `GET /api/v1/meter/estimate-units/?amount=` |
| Pay | Web | `POST /api/v1/meter/buy-units/` |
| Pay | Mobile | Same buy-units API |
| Pay | USSD | `2` → Buy Units → amount → PIN → MoMo |
| Complete | Backend | `complete_buy_units_payment()` (MoMo callback or sandbox thread) |

Units land in the **unit wallet**. Loading an **AMI** meter or generating an **STS token** is separate (Manage / Tokens menus).

---

## 9. API reference

### Estimate units (no side effects)

```http
GET /api/v1/meter/estimate-units/?amount=20000
Authorization: Bearer <token>
```

**Example response:**

```json
{
  "estimated_units": 28.0,
  "tariff": "DOM-10.1-2026Q1",
  "gross_amount": 20000.0,
  "deductions": 0.0,
  "net_amount": 20000.0,
  "energy_cost": 13345.0,
  "service_charge": 3360.0,
  "vat": 3006.9,
  "total_bill": 19711.9,
  "insufficient_amount": false,
  "minimum_payment": 4314.48,
  "service_charge_included": true,
  "monthly_units_consumed": 0.0,
  "lifeline_remaining_kwh": 15.0,
  "current_tier_band": "lifeline"
}
```

### Buy units (initiates payment)

```http
POST /api/v1/meter/buy-units/
{
  "amount": 20000,
  "phone_number": "+2567XXXXXXXX"
}
```

Response includes `estimated_units`, `tariff_applied`, `loan_outstanding_deduction`, `transaction_id`, and MoMo / sandbox status.

### List tariffs (admin / reference)

```http
GET /api/v1/loans/tariffs/
```

---

## 10. Admin: managing tariffs

| Task | How |
|------|-----|
| Seed ERA defaults | `python manage.py seed_era_tariff` |
| Verify billing math | `python manage.py verify_era_billing` |
| Web admin | **Admin → Tariffs** (`frontend/src/app/admin/tariffs/`) |
| Activate schedule | Only **one** `ElectricityTariff` may be `is_active=True` (`loan/tariff_utils.py`) |
| Version by date | Set `effective_from` / `effective_to`; `get_active_domestic_tariff(on_date)` picks the right row |

When ERA publishes new quarterly rates:

1. Create or import new `ElectricityTariff` + blocks  
2. Set effective dates  
3. Activate the new tariff (deactivates others)  

No code deploy required if blocks are data-driven.

---

## 11. USSD specifics

Path: **Main menu → 2 Buy Units → 1 Start purchase → amount → PIN**

- Estimate uses same `BuyUnitsView._calculate_units_from_tariff` with loan outstanding subtracted for display  
- Completed payment runs `complete_buy_units_payment` with channel `USSD`  
- **2 → 2 Check payment status** polls transaction by ID  

See [USSD_INTEGRATION.md](../USSD_INTEGRATION.md).

---

## 12. Loans vs buy-units tariffs

| Use case | Tariff engine |
|----------|----------------|
| **Buy units** (MoMo top-up) | `utils.billing` — full ERA blocks + service + VAT |
| **Loan disbursement / repayment** | Loan’s linked `ElectricityTariff` via `LoanApplication.calculate_units_from_amount()` — used to convert loan UGX ↔ kWh for credit/repay |

Both can share the same domestic schedule but serve different product flows. Loan rules: [LOAN_SCHEME.md](LOAN_SCHEME.md).

---

## 13. Support cheat sheet

**“Why did UGX 5,000 only give me ~3.5 units?”**  
First purchase this month includes **UGX 3,360 service charge + 18% VAT**. The rest buys energy, starting in the lifeline band if eligible.

**“Why did my friend get more kWh than me for the same money?”**  
They may have **already paid service charge** this month, have **more lifeline remaining**, or have **no loan deduction**.

**“I paid UGX 20,000 but got fewer units than the estimate.”**  
Check **loan auto-repayment** — part of the payment may have cleared debt before energy conversion.

**“Why zero units?”**  
Payment after deductions may be below `minimum_payment` (cannot cover fixed charges + any energy).

**“Rates wrong after ERA update?”**  
Confirm active tariff in admin and run `seed_era_tariff` or import new blocks.

---

## 14. Code map

| Topic | Location |
|-------|----------|
| Billing engine | `backend/utils/billing.py` |
| ERA seed data | `backend/loan/tariff_utils.py` → `seed_era_domestic_tariff()` |
| Tariff models | `backend/loan/models.py` → `ElectricityTariff`, `TariffBlock` |
| Buy-units API | `backend/meter/api/views.py` → `BuyUnitsView`, `EstimateUnitsView` |
| Payment completion | `backend/meter/buy_units_payment.py` |
| USSD buy | `backend/ussd/views.py` → `_start_buy_units` |
| Web UI | `frontend/.../buy-units/_components/form.tsx` |
| Mobile UI | `mobile/app/(app)/(tabs)/buy-units.tsx` |
| Billing tests | `backend/loan/management/commands/verify_era_billing.py` |

---

## 15. Configuration constants

| Constant | Value | File |
|----------|-------|------|
| `VAT_RATE` | 0.18 (18%) | `utils/billing.py` |
| `DEFAULT_SERVICE_CHARGE` | 3,360 UGX | `utils/billing.py` |
| `FALLBACK_ENERGY_RATE` | 756.20 UGX/kWh | `utils/billing.py` |

---

*Last updated: June 2026 — aligned with ERA domestic Code 10.1 blocks and `DOM-10.1-2026Q1` seed schedule.*
