# gPawa Project Overview

## What This Project Does

This project is a full-stack energy platform that lets users:
- register and manage an electricity meter,
- buy electricity units,
- share units with other users,
- request and repay energy-focused micro-loans,
- track wallet and transaction activity.

It is designed around practical energy access use cases, where users may need to transfer units quickly or borrow for short-term electricity needs.

## Tech Stack

### Frontend
- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- React Hook Form + Zod
- Redux Toolkit and UI component libraries

### Backend
- Django + Django REST Framework
- PostgreSQL
- JWT authentication (SimpleJWT)
- Celery + Redis for background tasks

## Core Feature Set

### 1) Authentication and Account Management
- Email/phone registration and login
- Email verification flow
- JWT-based authenticated API access
- User profile and account detail management

### 2) Meter Management
- Register meter to account (STS or AMI architecture)
- AMI meters: ThingsBoard device token (`iot_device_token`) for push and live reads
- Fetch and update user meter info; multi-meter support
- **Check units** — on-demand live kWh from ThingsBoard (`GET /meter/check-units/`)
- **Apply wallet units** — AMI meters receive kWh over the network (no STS token)
- Meter-linked unit balances and token history
- **Low-units alerts** — ThingsBoard webhook → in-app notification bell + email

### 3) Buy Units
- User submits purchase amount and phone details
- Backend processes payment flow (sandbox simulation hooks)
- Purchased amount is converted into units based on active tariff blocks
- Units are credited to user wallet/meter context

### 4) Loan System
- User applies for an energy loan
- Credit score and tier are evaluated
- Approved loans can be disbursed into units
- Repayment and outstanding balance tracking are supported
- Loan stats endpoints support dashboard reporting

### 5) Unit Sharing
- User initiates transfer/share request
- OTP verification secures transfer confirmation
- Atomic transaction logic prevents partial/misaligned state
- Recipient receives units (or sender receives a token for self-share flow)

### 6) Wallets and Transactions
- Tracks unit/economic movements tied to purchases, loans, and sharing
- Exposes user transaction history and related account activity

### 7) Admin Capabilities
- Manage users, meters, tariffs, loan tiers, and loan operations
- Monitor dashboards and analytics endpoints
- Handle admin account/security operations

### 8) ThingsBoard Integration (AMI)
- **Outbound:** push unit credits via device telemetry API (`payment` + `amount`)
- **Inbound read:** check live `remaining_units` on user request (web refresh, USSD `6*2`)
- **Inbound webhook:** low-units alerts when TB rule chain fires (`POST /webhooks/thingsboard/low-units`)
- Channels: web (notification bell + AMI card), USSD (Manage / Alerts), API for future mobile

See [`docs/THINGSBOARD_INTEGRATION_GUIDE.md`](docs/THINGSBOARD_INTEGRATION_GUIDE.md).

## Core Business Logic and How It Works

### Tariff-Based Unit Calculation
Money-to-unit conversion uses tariff rules, including block pricing where configured. If no active block tariff is available, fallback/default tariff logic is used.

### Credit Scoring for Loans
Loan decisions are based on weighted factors such as:
- payment history,
- energy consumption behavior,
- financial capacity.

The score maps to a loan tier, which influences approval and borrowing limits.

### Loan Balance and Penalties
Outstanding loan calculations combine:
- principal,
- interest,
- overdue penalties (when applicable),
- minus repayments already made.

### Safe Transfer and Consistency Controls
Critical flows (share, repay, disburse, buy credit updates) use transaction-safe patterns so ledger/meter state changes are consistent and recoverable.

## Typical User Journey

1. Sign up and verify account.
2. Register a meter and complete profile.
3. Buy units or request a loan when needed.
4. Share units to another meter (OTP protected).
5. Track balances, loan status, and transactions in dashboard pages.

## API and Architecture Shape

- API is grouped by domain apps (`accounts`, `meter`, `loan`, `share`, `wallet`, `transactions`, `admin`, `webhooks`, `ussd`).
- Frontend routes mirror these user domains through dashboard and admin pages.
- Background tasks handle asynchronous notifications and integration workflows.
- ThingsBoard integration is centralized in `backend/meter/services.py` and `backend/utils/ami_gateway.py`.

## Key Project Strengths

- Clear domain separation across Django apps
- Strong feature coverage for energy operations and financing
- Security-aware flows (JWT, OTP, role-aware endpoints)
- Extensible design for tariff rules, loan tiers, and admin operations

## Suggested Next Documentation Improvements

- Add sequence diagrams for buy/share/loan/ThingsBoard flows
- Add environment variable reference with required/optional flags (partially in `BACKEND_DOCS.md`)
- Add test strategy and coverage status for each backend app
