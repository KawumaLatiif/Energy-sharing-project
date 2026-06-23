# Energy Sharing (gPawa)

Full-stack energy platform: **Next.js** frontend, **Django** API, **PostgreSQL** database. Optional **mobile** app in `mobile/`.

## Repository layout

| Folder | What it is | Where you run commands |
|--------|------------|-------------------------|
| `backend/` | Django REST API | All Python / `manage.py` commands |
| `frontend/` | Next.js web app | All `npm` commands for the website |
| `mobile/` | Expo / React Native Android app | See [`mobile/README.md`](mobile/README.md) |

---

## Prerequisites

Install these before you start:

- **Python 3** (3.11+ recommended)
- **Node.js** (18+ recommended) and **npm**
- **PostgreSQL** running locally (default DB name: `metering`)

---

## 1. Clone the repository

From any directory:

```bash
git clone <repository-url>
cd Energy-sharing-project
```

All paths below assume your shell is at the **repo root** (`Energy-sharing-project/`) unless stated otherwise.

---

## 2. Backend setup (`backend/`)

Open a terminal and work **inside the backend folder**:

```bash
cd backend
```

### Create and activate a virtual environment

**Windows (PowerShell):**

```powershell
python -m venv venv
venv\Scripts\activate
```

**macOS / Linux:**

```bash
python -m venv venv
source venv/bin/activate
```

Your prompt should show `(venv)`. Keep this terminal’s working directory as `backend/`.

### Install Python dependencies

```bash
pip install -r requirements.txt
```

### Environment variables (optional for local dev)

Django loads `backend/.env` if it exists. For local development, sensible defaults are already in `backend/backend/settings.py` (database, Redis, Celery eager mode).

For production-style configuration, copy the example and edit values:

```bash
# from backend/
cp .env.production.example .env   # macOS/Linux
# copy .env.production.example .env   # Windows
```

See [`BACKEND_DOCS.md`](BACKEND_DOCS.md) for the full list of environment variables.

### Database

1. Create a PostgreSQL database (default name: `metering`).
2. With the venv still active and cwd still `backend/`, run:

```bash
python manage.py migrate
python manage.py createsuperuser
```

Default local DB settings (override in `backend/.env` if needed):

- `DB_NAME=metering`
- `DB_USER=postgres`
- `DB_HOST=localhost`
- `DB_PORT=5432`

---

## 3. Frontend setup (`frontend/`)

Open a **new** terminal. Work **inside the frontend folder**:

```bash
cd frontend
```

### Install Node dependencies

```bash
npm install
```

The app talks to the API at `http://localhost:8000/api/v1` by default (`frontend/src/common/constants/api.ts`). Start the backend before using the site.

---

## 4. Run the app locally

Use **separate terminals**, each started from the repo root then `cd` into the right folder.

### Terminal 1 — Django API (`backend/`)

```powershell
cd backend
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
python manage.py runserver
```

- API: **http://127.0.0.1:8000/**
- Admin: **http://127.0.0.1:8000/admin/**

### Terminal 2 — Next.js web app (`frontend/`)

```powershell
cd frontend
npm run dev
```

- Website: **http://localhost:3000**

### Redis and Celery (usually not needed locally)

Background tasks (e.g. verification emails) use **Celery + Redis**. In local dev, `CELERY_TASK_ALWAYS_EAGER=True` by default, so tasks run **inline** without a separate worker.

You only need Redis and Celery if you set `CELERY_TASK_ALWAYS_EAGER=False` in `backend/.env`:

**Terminal 3 — Redis** (install and run Redis for your OS), then:

**Terminal 4 — Celery worker** (from `backend/`, venv active):

```bash
celery -A backend worker --loglevel=info
```

---

## Quick reference

| Service | Working directory | Command | URL |
|---------|-------------------|---------|-----|
| Backend | `backend/` | `python manage.py runserver` | http://127.0.0.1:8000 |
| Frontend | `frontend/` | `npm run dev` | http://localhost:3000 |
| Celery (optional) | `backend/` | `celery -A backend worker --loglevel=info` | — |
| Mobile app | `mobile/` | See [`mobile/README.md`](mobile/README.md) | — |

---

## Production builds

**Frontend** (from `frontend/`):

```bash
npm run build
npm start
```

**Backend:** see [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`BACKEND_DOCS.md`](BACKEND_DOCS.md).

---

## More documentation

- [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) — features and architecture
- [`BACKEND_DOCS.md`](BACKEND_DOCS.md) — API, env vars, Celery
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — deployment guide
- [`USSD_INTEGRATION.md`](USSD_INTEGRATION.md) — USSD menus and simulator
- [`API_ROUTE_CATALOG.md`](API_ROUTE_CATALOG.md) — REST endpoint index
- [`docs/THINGSBOARD_INTEGRATION_GUIDE.md`](docs/THINGSBOARD_INTEGRATION_GUIDE.md) — ThingsBoard setup and testing
- [`docs/THINGSBOARD_INTEGRATION_REPORT.md`](docs/THINGSBOARD_INTEGRATION_REPORT.md) — full TB integration reference
- [`docs/THINGSBOARD_WEBHOOK.md`](docs/THINGSBOARD_WEBHOOK.md) — low-units webhook and rule chains
- [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md) — detailed local dev guide
- [`mobile/README.md`](mobile/README.md) — Android app setup
- [`frontend/README.md`](frontend/README.md) — frontend dev server and troubleshooting

---

## ThingsBoard (AMI meters) — quick reference

AMI (networked) meters integrate with **ThingsBoard** at `https://iot.energy-share.sun.ac.ug`.

| Capability | Where |
|------------|--------|
| Push units to meter | `backend/meter/services.py` → `push_units_to_thingsboard()` |
| Check live kWh | `GET /api/v1/meter/check-units/?meter_no=` |
| Low-units webhook (TB → gPawa) | `POST /webhooks/thingsboard/low-units` |
| User alerts API | `GET/PATCH /api/v1/meter/notifications/` |
| Web notification bell | Dashboard header (`frontend/.../notification-bell.tsx`) |
| USSD check units / alerts | Main menu **6** (Manage) or **7** (Alerts) — see [`USSD_INTEGRATION.md`](USSD_INTEGRATION.md) |

**Local `.env` (real meters):**

```env
AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_WEBHOOK_SECRET=your-long-random-secret
```

Register AMI meters with `iot_device_token` = ThingsBoard **device access token**. Use tokens starting with `dev-` for local stub testing (no HTTP to ThingsBoard).
