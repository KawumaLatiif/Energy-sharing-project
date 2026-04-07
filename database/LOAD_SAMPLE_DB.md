# Load Sample Database

This project includes a sample PostgreSQL seed dump:

- `database/sample_full_dump.sql`
- `database/sample_full_dump_heavy.sql` (expanded scenarios)

It contains sample data for:
- users, profiles, account details
- tariffs, loan tiers, loan applications/disbursement/repayments
- meters, wallet balances, wallet transactions
- purchase/share transaction history
- meter tokens
- persisted USSD sessions

Heavy variant adds:
- 6 users total
- loan states across `APPROVED`, `REJECTED`, `DISBURSED`, `COMPLETED`, `DEFAULTED`
- denser share timelines (`COMPLETED`, `PENDING`, `CANCELLED`)
- larger token history (used + unused, mixed sources)

## 1) Create database

```powershell
createdb -U postgres project
```

If `createdb` is not on PATH, use pgAdmin UI to create DB `project`.

## 2) Configure backend DB env

In `backend/.env`:

```env
DB_NAME=project
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
```

## 3) Run migrations first

From `backend/` (inside venv):

```powershell
python manage.py migrate
```

## 4) Load sample dump

From project root:

```powershell
psql -U postgres -d project -f database/sample_full_dump.sql
```

For heavier testing instead:

```powershell
psql -U postgres -d project -f database/sample_full_dump_heavy.sql
```

## 5) Start backend

```powershell
cd backend
python manage.py runserver
```

## 6) Sample logins

The dump includes:
- `admin@powercred.local`
- `jane@powercred.local`
- `john@powercred.local`

Heavy dump additionally includes:
- `mary@powercred.local`
- `peter@powercred.local`
- `amina@powercred.local`

Password in dump comment:
- `Pass1234!`

## 7) Test USSD quickly

```powershell
cd backend
python manage.py runserver
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Then open:
- `http://localhost:3000/ussd-simulator`

Use a seeded phone, for example:
- `+256701234567`

---

If your PostgreSQL instance uses a different user or host, update `.env` and the `psql` command accordingly.
