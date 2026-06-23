# gPawa — Run the App Locally

Step-by-step guide to run the **gPawa** web app, backend API, and USSD simulator on your machine.

---

## 1) What you are running

| Service | Tech | Local URL |
|---------|------|-----------|
| Frontend (web UI) | Next.js 16 + React 19 | http://localhost:3000 |
| Backend API | Django 5.2 + DRF | http://localhost:8000/api/v1 |
| Android app | Expo / React Native | Connects to backend API (see [`MOBILE_APP.md`](MOBILE_APP.md)) |
| API docs (Swagger) | drf-yasg | http://localhost:8000/swagger/ |
| USSD simulator | Next.js page → Django USSD API | http://localhost:3000/ussd-simulator |
| Database | PostgreSQL | `localhost:5432` |

You need **two terminals** for day-to-day development:
1. Django backend
2. Next.js frontend

Optional third terminal for the **Android app** — see [`MOBILE_APP.md`](MOBILE_APP.md) (physical phone + APK install guide).

Redis and a Celery worker are **not required locally** when `CELERY_TASK_ALWAYS_EAGER=True` (default in dev).

---

## 2) Prerequisites

Install these before you start:

| Tool | Version | Notes |
|------|---------|-------|
| **Git** | latest | clone/pull the repo |
| **Python** | 3.10+ (3.13 tested) | backend |
| **Node.js** | 20+ LTS recommended | frontend |
| **npm** | comes with Node | frontend deps |
| **PostgreSQL** | 15+ (17 used in team setup) | database |

Optional (only for production-like async tasks):
- Redis (not needed for normal local dev)

### Windows checks

```powershell
git --version
python --version
node --version
npm --version
psql --version
```

---

## 3) Clone the repository

```powershell
git clone https://github.com/KawumaLatiif/Energy-sharing-project.git
cd Energy-sharing-project
```

Use the branch your team is working on (usually `main`):

```powershell
git checkout main
git pull origin main
```

---

## 4) Database setup (PostgreSQL)

### 4.1 Create the database

Default database name in Django settings is `metering`. Create it once:

```powershell
createdb -U postgres metering
```

If `createdb` is not on your PATH, create database `metering` using **pgAdmin**.

### 4.2 (Recommended) Load sample data

The repo includes seed dumps for faster testing:

- `database/sample_full_dump.sql`
- `database/sample_full_dump_heavy.sql` (more users/scenarios)

**Steps:**

1. Run migrations first (section 5.4).
2. Load a dump from the project root:

```powershell
psql -U postgres -d metering -f database/sample_full_dump_heavy.sql
```

**Sample logins from the dump** (password: `Pass1234!`):

| Email | Use for |
|-------|---------|
| `admin@powercred.local` | admin-style testing |
| `jane@powercred.local` | normal user |
| `john@powercred.local` | normal user |
| `mary@powercred.local` | heavy dump only |
| `peter@powercred.local` | heavy dump only |
| `amina@powercred.local` | heavy dump only |

Sample USSD phone numbers include `+256701234567`.

---

## 5) Backend setup (Django)

### 5.1 Create and activate virtual environment

From project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

### 5.2 Install Python dependencies

```powershell
pip install -r requirements.txt
```

### 5.3 Create `backend/.env`

Create `backend/.env` (this file is gitignored — never commit it).

Minimum local config:

```env
DEBUG=True
SECRET_KEY=local-dev-secret-change-me

# Database
DB_NAME=metering
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432

# Frontend URL (email verification/reset links in dev)
FRONTEND_URL=http://localhost:3000

# Celery runs inline in dev (no Redis worker needed)
CELERY_TASK_ALWAYS_EAGER=True
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0

# ThingsBoard (optional — for physical meter push/read tests)
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TIMEOUT_SECONDS=8
THINGSBOARD_WEBHOOK_SECRET=choose-a-long-random-string
# Real AMI push/read (default is mock simulation):
# AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway
```

For a fuller production-style template, see `backend/.env.production.example`.

### 5.4 Run migrations

With venv active in `backend/`:

```powershell
python manage.py migrate
```

### 5.5 (Optional) Create your own superuser

If you are **not** using the sample dump:

```powershell
python manage.py createsuperuser
```

### 5.6 Start backend server

```powershell
python manage.py runserver
```

Backend runs at: **http://127.0.0.1:8000**

Quick check:

- API base: http://localhost:8000/api/v1/
- Swagger: http://localhost:8000/swagger/

Leave this terminal running.

---

## 6) Frontend setup (Next.js)

Open a **new terminal** from project root.

### 6.1 Install dependencies

```powershell
cd frontend
npm install
```

### 6.2 API URL

Frontend points to local backend via:

`frontend/src/common/constants/api.ts`

```ts
export const API_URL = 'http://localhost:8000/api/v1';
```

Change this only if your backend runs on a different host/port.

### 6.3 Start frontend dev server

```powershell
npm run dev
```

Frontend runs at: **http://localhost:3000**

Leave this terminal running.

---

## 7) Use the app locally

### Main pages

| Page | URL |
|------|-----|
| Landing page | http://localhost:3000 |
| Register | http://localhost:3000/auth/register |
| Login | http://localhost:3000/auth/login |
| User dashboard | http://localhost:3000/dashboard |
| TopUp Wallet | http://localhost:3000/dashboard/buy-units |
| Load / Share Units | http://localhost:3000/dashboard/share |
| Power Usage (AMI) | http://localhost:3000/dashboard/power-usage |
| Admin portal | http://localhost:3000/admin/dashboard |
| USSD simulator | http://localhost:3000/ussd-simulator |

### Typical first test flow

1. Open http://localhost:3000
2. Log in with a seeded user (e.g. `jane@powercred.local` / `Pass1234!`)
3. Register or view meter in dashboard
4. Try **TopUp Wallet** (sandbox MoMo simulation auto-completes)
5. Try **Load / Share Units** and **Power Usage** (AMI accounts)
6. Open USSD simulator and test menu flows with a seeded phone number

After pulling latest code:

```powershell
cd backend
python manage.py migrate
```

See [`PLATFORM_ALIGNMENT.md`](PLATFORM_ALIGNMENT.md) for full migration and env checklist.

### Android mobile app (optional)

The native Android app lives in `mobile/`. Full guide: **[`docs/MOBILE_APP.md`](MOBILE_APP.md)**.

**Terminal 3 (optional):**

```powershell
cd mobile
cp .env.example .env
npm install
npm run android
```

| Target | Set in `mobile/.env` |
|--------|----------------------|
| Emulator | `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1` |
| Phone on same Wi‑Fi | `EXPO_PUBLIC_API_URL=http://<YOUR_PC_IP>:8000/api/v1` and run backend with `python manage.py runserver 0.0.0.0:8000` |

To build an installable APK, see [§4 in MOBILE_APP.md](MOBILE_APP.md#4-building-and-installing-the-apk).

---

## 8) USSD simulator (local)

1. Ensure backend and frontend are both running.
2. Open http://localhost:3000/ussd-simulator
3. Pick a phone number from the dropdown (loaded from `/api/v1/ussd/phones/`)
4. Click **Dial** and step through menus

The simulator sends Africa's Talking-style payloads to:

- `POST /api/v1/ussd/entry/`

More details: `USSD_INTEGRATION.md`

---

## 9) ThingsBoard integration (optional)

Only needed if you are testing **AMI** meters with ThingsBoard.

### 9.1 Environment

In `backend/.env`:

```env
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_TIMEOUT_SECONDS=8
THINGSBOARD_WEBHOOK_SECRET=local-dev-secret
AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway
```

Use `dev-` prefix on `iot_device_token` to stub push/read without HTTP.

### 9.2 Migrate

```powershell
python manage.py migrate meter
```

Requires `0016_meternotification` for low-units alerts.

### 9.3 Test flows

| Test | How |
|------|-----|
| Push telemetry | `POST /api/v1/meter/test-meter-push/` |
| Check live units | `GET /api/v1/meter/check-units/?meter_no=` or web AMI card refresh |
| Low-units webhook | `POST http://localhost:8000/webhooks/thingsboard/low-units` |
| Web alerts | Dashboard notification bell |
| USSD check units | Simulator: `6` → `2` |
| USSD alerts | Simulator: `7` |

Full guides:
- [`docs/THINGSBOARD_INTEGRATION_GUIDE.md`](THINGSBOARD_INTEGRATION_GUIDE.md)
- [`docs/THINGSBOARD_WEBHOOK.md`](THINGSBOARD_WEBHOOK.md)
- [`USSD_INTEGRATION.md`](../USSD_INTEGRATION.md)

---

## 10) Daily developer workflow

```powershell
# Terminal 1
cd backend
.\venv\Scripts\activate
python manage.py runserver

# Terminal 2
cd frontend
npm run dev
```

After pulling new code:

```powershell
# backend
pip install -r requirements.txt
python manage.py migrate

# frontend
npm install
```

---

## 11) Common issues and fixes

### `connection refused` / database errors

- Confirm PostgreSQL service is running.
- Verify `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` in `backend/.env`.
- Ensure database exists (`metering` or your chosen name).

### Frontend cannot reach backend

- Backend must be running on port `8000`.
- Check `API_URL` in `frontend/src/common/constants/api.ts`.
- Confirm CORS allows `http://localhost:3000` (enabled by default in `DEBUG=True`).

### `ModuleNotFoundError` (Python)

```powershell
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
```

### `next.config.ts is not supported`

Use `frontend/next.config.js` (project already uses `.js`).

### Email verification links go to spam (dev)

Normal in local dev because links point to `http://localhost:3000`. Check spam folder.

### Redis/Celery errors in local dev

Set in `backend/.env`:

```env
CELERY_TASK_ALWAYS_EAGER=True
```

This runs background tasks inline and avoids needing Redis locally.

### Port already in use

```powershell
# use another port
python manage.py runserver 8001
npm run dev -- -p 3001
```

If you change ports, update `API_URL` accordingly.

---

## 12) What not to commit

The root `.gitignore` excludes local-only files such as:

- `backend/.env`
- `backend/venv/`
- `frontend/node_modules/`
- `frontend/.next/`
- `__pycache__/`

Never commit secrets or local build artifacts.

---

## 13) Related docs

| Document | Purpose |
|----------|---------|
| `Readme.md` | quick start summary |
| `PROJECT_STATE.md` | current project status and architecture |
| `USSD_INTEGRATION.md` | USSD menu and API behavior |
| `docs/THINGSBOARD_INTEGRATION_GUIDE.md` | IoT meter integration |
| `database/LOAD_SAMPLE_DB.md` | sample database loading |
| `API_ROUTE_CATALOG.md` | API endpoint reference |

---

## 14) Quick checklist

- [ ] PostgreSQL installed and running
- [ ] Database created (`metering`)
- [ ] `backend/.env` created
- [ ] `pip install -r requirements.txt`
- [ ] `python manage.py migrate`
- [ ] (Optional) sample SQL dump loaded
- [ ] `python manage.py runserver` running
- [ ] `npm install` in `frontend/`
- [ ] `npm run dev` running
- [ ] App opens at http://localhost:3000
