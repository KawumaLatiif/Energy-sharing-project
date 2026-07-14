# gPawa Energy-Sharing Platform — Database Snapshot
**Date:** 30 June 2026  
**Database:** `metering` (PostgreSQL 17) | **Environment:** Pilot / Development  
**Prepared for:** Non-Technical Stakeholders

---

> **How to read this document**  
> Each section is one table from the system's database. Rows are actual live records — what you see here is exactly what the system holds right now.  
> Columns are labelled in plain English. Technical codes that appear in the raw database are explained in footnotes.

---

## 1. Registered Users

There are **6 registered accounts** in the system (1 admin, 5 clients).

| # | Full Name | Email | Role | Phone | Email Verified? | Account Active? | Joined |
|---|-----------|-------|------|-------|-----------------|-----------------|--------|
| 1 | gPawa Admin | admin@gpawa.com | Admin | — | Yes | No | 14 Jun 2026 |
| 3 | Joshua Benjamin | 2401600236@sun.ac.ug | Client | +256 773 443 684 | Yes | No | 15 Jun 2026 |
| 4 | Joshua Benjamin | mazzihannah2@gmail.com | Client | +256 773 442 680 | Yes | No | 15 Jun 2026 |
| 5 | Joseph Walusimbi | wlausimbijoseph100@gmail.com | Client | +256 764 123 306 | No | No | 15 Jun 2026 |
| 6 | Walusimbi Joseph | walusimbijoseph100@gmail.com | Client | +256 764 123 307 | Yes | No | 15 Jun 2026 |
| 7 | *(unnamed)* | admin2@gpawa.com | Client | — | Yes | No | 24 Jun 2026 |

> **Note:** "Account Active" refers to the admin-activation flag (separate from email verification). All accounts are in pilot/testing mode — none have been formally activated yet.

---

## 2. System Account Numbers

Every registered user is automatically assigned a unique account number (like a bank account number).

| User | Email | Account Number |
|------|-------|----------------|
| gPawa Admin | admin@gpawa.com | EN-87001363 |
| Joshua Benjamin | 2401600236@sun.ac.ug | EN-87964656 |
| Joshua Benjamin | mazzihannah2@gmail.com | EN-42506290 |
| Joseph Walusimbi | wlausimbijoseph100@gmail.com | EN-39958484 |
| Walusimbi Joseph | walusimbijoseph100@gmail.com | EN-66959940 |
| *(unnamed)* | admin2@gpawa.com | EN-76747878 |

---

## 3. Registered Electricity Meters

There are **4 active meters** registered in the system.

| Meter Number | Label | Owner (User #) | Type ¹ | Status | Current Balance (kWh) | Pending Units (kWh) |
|--------------|-------|----------------|--------|--------|----------------------|---------------------|
| 1236784560 | home 2 | #3 — Joshua Benjamin (2401600236) | AMI (Networked) | Active | **9.00 kWh** | 0.00 |
| 6728883889 | Home | #3 — Joshua Benjamin (2401600236) | STS (Token-based) | Active | 0.00 kWh | 0.00 |
| 9421678806 | Home | #4 — Joshua Benjamin (mazzihannah2) | STS (Token-based) | Active | 0.00 kWh | 0.00 |
| 9864567223 | Home | #6 — Walusimbi Joseph | STS (Token-based) | Active | 0.00 kWh | 0.00 |

> ¹ **AMI (Advanced Metering Infrastructure):** A "smart" networked meter — units are loaded automatically by the system over the internet.  
> ¹ **STS (Standard Transfer Specification):** A traditional prepaid meter — units are loaded by typing a 20-digit token code on the keypad.

---

## 4. Meter Balances (Wallet Ledger View)

The system tracks each meter's unit balance independently for accounting purposes.

| Meter Number | Owner (User #) | Recorded Balance (kWh) | Status |
|--------------|---------------|------------------------|--------|
| 1236784560 | #3 — Joshua Benjamin (2401600236) | **9.00 kWh** | Active |
| 6728883889 | #3 — Joshua Benjamin (2401600236) | 0.00 kWh | Active |
| 9421678806 | #4 — Joshua Benjamin (mazzihannah2) | 0.00 kWh | Active |
| 9864567223 | #6 — Walusimbi Joseph | 0.00 kWh | Active |

---

## 5. User Wallet Balances

Each user has a digital wallet that holds kWh credits ready to be assigned to a meter.

| User | Email | Wallet Balance (kWh) | Active? |
|------|-------|----------------------|---------|
| gPawa Admin | admin@gpawa.com | 0.00 kWh | Yes |
| Joshua Benjamin | 2401600236@sun.ac.ug | **6.68 kWh** | Yes |
| Joshua Benjamin | mazzihannah2@gmail.com | **39.63 kWh** | Yes |
| Joseph Walusimbi | wlausimbijoseph100@gmail.com | 0.00 kWh | Yes |
| Walusimbi Joseph | walusimbijoseph100@gmail.com | **4.00 kWh** | Yes |
| *(unnamed)* | admin2@gpawa.com | 0.00 kWh | Yes |

---

## 6. Unit Purchase Transactions (Mobile Money Payments)

A total of **7 payment attempts** have been made via MTN Mobile Money to buy electricity units.

| # | Date | User (Phone) | Amount Paid (UGX) | Units Received (kWh) | Tariff Used | Result |
|---|------|--------------|-------------------|----------------------|-------------|--------|
| 1 | 15 Jun 2026 | +256 773 443 684 | 6,000 UGX | 17.98 kWh | CODE10.1 | ✅ Completed |
| 2 | 15 Jun 2026 | +256 773 443 684 | 2,000 UGX | 8.00 kWh | CODE10.1 | ✅ Completed |
| 3 | 15 Jun 2026 | +256 773 443 684 | 1,000 UGX | 4.00 kWh | CODE10.1 | ✅ Completed |
| 4 | 16 Jun 2026 | +256 773 443 684 | 5,000 UGX | 16.65 kWh | CODE10.1 | ✅ Completed ² |
| 5 | 20 Jun 2026 | +256 773 443 684 | 4,000 UGX | 0.12 kWh | DOM-10.1-2026Q1 | ✅ Completed ² |
| 6 | 20 Jun 2026 | +256 773 443 684 | 5,000 UGX | 15.56 kWh | DOM-10.1-2026Q1 | ✅ Completed |
| 7 | 29 Jun 2026 | +256 773 443 684 | 30,000 UGX | — | — | ❌ Failed ³ |

**Total value purchased (completed):** 23,000 UGX  
**Total units delivered (completed):** 62.31 kWh

> ² Payment completed, but the meter push to ThingsBoard (the smart metering cloud) failed because no IoT token was configured for that meter — units were held in the wallet instead.  
> ³ Failed at payment stage — MTN API credentials were not available (sandbox environment limitation).

---

## 7. Energy Unit Sharing

Users can share electricity units between meters. **1 share transaction** has occurred.

| Transaction ID | Date | Sender | Receiver | Units Shared (kWh) | Status |
|----------------|------|--------|----------|--------------------|--------|
| SHARE-B3AE0DF7 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | Walusimbi Joseph | **4.00 kWh** | ✅ Completed |

---

## 8. STS Meter Tokens Generated

When an STS (keypad) meter is used, the system generates a token. **1 token** has been generated.

| Token Code | Units (kWh) | Meter | User | Source | Used? | Generated |
|------------|-------------|-------|------|--------|-------|-----------|
| 2207681053 | 3.00 kWh | 9421678806 | Joshua Benjamin (mazzihannah2) | Purchase | No | 18 Jun 2026 |

> The token has not yet been entered into the meter keypad.

---

## 9. Loan Applications

**3 loan applications** have been submitted. All were rejected due to insufficient credit score.

| Loan ID | Date | Applicant | Amount Requested (UGX) | Term | Credit Score | Outcome | Reason |
|---------|------|-----------|------------------------|------|--------------|---------|--------|
| RFIFHEYVE2 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | 5,000 UGX | 1 month | 62/100 | ❌ Rejected | Score below 75 threshold |
| 411UMVEH05 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | 10,000 UGX | 2 months | 62/100 | ❌ Rejected | Score below 75 threshold |
| CKK85TGZO3 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | 7,000 UGX | 3 months | 62/100 | ❌ Rejected | Score below 75 threshold |

> No loans have been disbursed or repaid yet. The minimum credit score required to qualify is **75 out of 100**.

---

## 10. Loan Tier Configuration

Loan tiers define the borrowing limits and interest rates for different creditworthiness levels.

> ⚠️ **The loan tier table is currently empty.** Tier configuration has not yet been entered by an administrator. Until tiers are configured, no loans can be approved.

| Tier | Credit Score Range | Max Loan Amount | Annual Interest Rate |
|------|--------------------|-----------------|----------------------|
| Bronze | 75–79 | 50,000 UGX | 12% |
| Silver | 80–84 | 100,000 UGX | 11% |
| Gold | 85–89 | 150,000 UGX | 10% |
| Platinum | 90–100 | 200,000 UGX | 9% |

> *Above values are from the system's built-in defaults (hardcoded), not from the database. An admin must enter these into the system to activate loan approvals.*

---

## 11. Electricity Tariff Schedule (ERA Rates)

The system uses official ERA (Electricity Regulatory Authority) tariffs. **3 tariff records** exist.

| Tariff Code | Name | Category | Monthly Service Charge (UGX) | Active? | Valid From | Valid To |
|-------------|------|----------|------------------------------|---------|------------|----------|
| DOM-10.1-2025Q4 | ERA Domestic Code 10.1 (Q4 2025) | Domestic | 3,360 UGX | Yes | 1 Oct 2025 | Open-ended |
| DOM-10.1-2026Q1 | ERA Domestic Code 10.1 (Q1 2026) | Domestic | 3,360 UGX | Yes | 1 Jan 2026 | Open-ended |
| CODE10.1 | Domestic Consumers | Domestic | 0 UGX | No (Legacy) | — | — |

---

## 12. Electricity Rate Blocks (Cost Per kWh)

Each tariff has rate blocks — the cost per unit (kWh) changes depending on how much you use per month.

### Tariff: DOM-10.1-2025Q4 (Q4 2025 — still active)

| Block | Usage Range | Rate per kWh (UGX) | Lifeline Block? |
|-------|-------------|---------------------|-----------------|
| Lifeline (first 15 units) | 0 – 15 kWh/month | 250 UGX/kWh | ✅ Yes |
| Normal | 16 – 80 kWh/month | 756.20 UGX/kWh | No |
| Cooking tariff | 81 – 150 kWh/month | 412 UGX/kWh | No |
| Super normal | Above 150 kWh/month | 756 UGX/kWh | No |

### Tariff: DOM-10.1-2026Q1 (Q1 2026 — current)

| Block | Usage Range | Rate per kWh (UGX) | Lifeline Block? |
|-------|-------------|---------------------|-----------------|
| Lifeline (first 15 units) | 0 – 15 kWh/month | 250 UGX/kWh | ✅ Yes |
| Normal | 16 – 80 kWh/month | 756.20 UGX/kWh | No |
| Cooking tariff | 81 – 150 kWh/month | 412 UGX/kWh | No |
| Super normal | Above 150 kWh/month | 756 UGX/kWh | No |

> **Lifeline Block:** A subsidised rate (250 UGX/kWh) for low-consumption domestic users who use 100 kWh or less per month on average. All pilot users are currently treated as lifeline-eligible.

---

## 13. User Credit Signals

Credit signals are a quick assessment of each user's creditworthiness, pulled from a third-party data source (currently using test/dummy data for the pilot).

| User | Payment History | Energy Consumption | Financial Capacity | Data Source |
|------|----------------|--------------------|--------------------|-------------|
| gPawa Admin | Good | Stable | Strong | Test Data |
| Joshua Benjamin (2401600236) | Fair | Moderate | Strong | Test Data |
| Joshua Benjamin (mazzihannah2) | Fair | Stable | Weak | Test Data |
| Walusimbi Joseph | Poor | Erratic | Weak | Test Data |
| *(unnamed)* admin2 | Poor | Erratic | Strong | Test Data |

---

## 14. Activity Log (All System Events)

A full audit trail of significant actions taken in the system.

| # | Date | User | Event Type | Amount (UGX) | Units (kWh) | Reference | Outcome |
|---|------|------|------------|--------------|-------------|-----------|---------|
| 1 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | Loan Application | 5,000 UGX | — | RFIFHEYVE2 | Rejected |
| 2 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | Loan Application | 10,000 UGX | — | 411UMVEH05 | Rejected |
| 3 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | Unit Share | — | 4.00 kWh | SHARE-B3AE0DF7 | Completed |
| 4 | 15 Jun 2026 | Joshua Benjamin (mazzihannah2) | Loan Application | 7,000 UGX | — | CKK85TGZO3 | Rejected |

---

## 15. Summary at a Glance

| Metric | Value |
|--------|-------|
| Total registered users | 6 |
| Active meters | 4 |
| Total kWh purchased (all time) | 62.31 kWh |
| Total UGX transacted (successful) | 23,000 UGX |
| Energy units shared between users | 4.00 kWh |
| Loan applications submitted | 3 |
| Loans approved & disbursed | 0 |
| Pending STS tokens (not yet used) | 1 |
| ERA tariffs on record | 3 (2 active) |

---

*This document was auto-generated from the live database on 30 June 2026. All figures reflect real data.*
