# Server Configuration Guide — ThingsBoard, AMI & Hosted gPAWA

**Audience:** Operators deploying gPAWA on `energy-share.sun.ac.ug` (or similar single-VM pilots)  
**Last updated:** June 2026  
**Status:** Verified on host `energy-system-set` with Docker ThingsBoard CE + Django/gunicorn

**Related:** [`THINGSBOARD_INTEGRATION_REPORT.md`](./THINGSBOARD_INTEGRATION_REPORT.md) · [`DEPLOYMENT.md`](../DEPLOYMENT.md) · [`backend/.env.production.example`](../backend/.env.production.example)

---

## Documentation map (ThingsBoard + server)

| Document | Use when you need… |
|----------|-------------------|
| **This file** | Server `.env`, DNS, Docker port 9090, Check Units failures, smoke tests |
| [`THINGSBOARD_INTEGRATION_REPORT.md`](./THINGSBOARD_INTEGRATION_REPORT.md) | Product behaviour, ledger vs live balance, channel parity |
| [`THINGSBOARD_INTEGRATION_GUIDE.md`](./THINGSBOARD_INTEGRATION_GUIDE.md) | API payloads, developer testing, curl examples |
| [`THINGSBOARD_WEBHOOK.md`](./THINGSBOARD_WEBHOOK.md) | Low-units rule chain → gPAWA webhook |
| [`DEPLOYMENT.md`](../DEPLOYMENT.md) | Full server install (Postgres, gunicorn, nginx, SSL) |
| [`PLATFORM_ALIGNMENT.md`](./PLATFORM_ALIGNMENT.md) | Migrations, Celery beat tasks, env checklist after git pull |
| [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md) | Dev laptop setup (mock gateway vs real TB) |

---

## 1. Hosted architecture (pilot VM)

```
                    ┌─────────────────────────────────────────┐
  Browser / USSD    │  energy-system-set (single VM)          │
        │           │                                         │
        ▼           │  nginx → gunicorn (Django) :8000         │
  energy-share      │       │                                 │
  .sun.ac.ug        │       │ THINGSBOARD_INTERNAL_BASE_URL   │
                    │       ▼                                 │
                    │  http://127.0.0.1:9090  (Docker TB)      │
                    │       │                                 │
                    │       └──► AMI devices (MQTT 1883)      │
                    └─────────────────────────────────────────┘
```

| Component | Pilot host | Notes |
|-----------|------------|--------|
| Web + API | `https://energy-share.sun.ac.ug` | nginx → gunicorn |
| ThingsBoard UI/API (local) | `http://127.0.0.1:9090` | Docker `tb-node`; **not** public DNS today |
| ThingsBoard (public, optional) | `https://iot.energy-share.sun.ac.ug` | Requires DNS A record — **was missing** on pilot |
| Postgres (gPAWA) | `localhost:5432` | DB `metering` |
| Postgres (ThingsBoard) | `127.0.0.1:5433` | Docker `thingsboard-postgres-1` |
| Redis | `127.0.0.1:6379` | Celery broker (production) |

**Critical lesson:** The web app can work while **Check Units fails** if Django cannot reach ThingsBoard. A configured device token in gPAWA is not enough — the backend must reach TB over HTTP.

---

## 2. Verified Docker layout (`energy-system-set`)

```bash
docker ps
```

Example output:

```text
thingsboard/tb-node:4.2.1.1
  127.0.0.1:9090->8080/tcp    ← use host port 9090 for gPAWA .env
  0.0.0.0:1883->1883/tcp      MQTT
  0.0.0.0:7070->7070/tcp

postgres:15 (thingsboard-postgres-1)
  127.0.0.1:5433->5432/tcp
```

**Common mistake:** Using port `8080` on the host. Inside the container TB listens on 8080; on the host it is mapped to **9090 only on localhost**.

---

## 3. Production `.env` (working configuration)

Copy from [`backend/.env.production.example`](../backend/.env.production.example). Minimum for real AMI meters:

```env
# ThingsBoard — server setup guide: docs/SERVER_THINGSBOARD_CONFIGURATION.md

# Public URL (docs, future nginx for TB UI). DNS optional for backend if INTERNAL is set.
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug

# REQUIRED on same-VM pilot: Django → TB without DNS
THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:9090

THINGSBOARD_TIMEOUT_SECONDS=15
THINGSBOARD_VERIFY_SSL=true

# Tenant login — writes remaining_units after load/share; Energy Usage timeseries
THINGSBOARD_TENANT_USERNAME=<tenant@tenant>
THINGSBOARD_TENANT_PASSWORD=<password>
THINGSBOARD_WEBHOOK_SECRET=<long-random-string>
THINGSBOARD_USAGE_TELEMETRY_KEY=daily_kwh

# Real AMI delivery (NOT MockAMIGateway)
AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway

# Production background jobs (pending AMI retry, low-units poll)
CELERY_TASK_ALWAYS_EAGER=False
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
```

**Quick fix without latest code:** If `THINGSBOARD_INTERNAL_BASE_URL` is not deployed yet, set:

```env
THINGSBOARD_BASE_URL=http://127.0.0.1:9090
```

Then restart gunicorn.

**Restart after any `.env` change:**

```bash
sudo systemctl restart gpawa    # or your gunicorn unit name
sudo systemctl status gpawa
```

Confirm systemd loads env:

```bash
sudo systemctl cat gpawa | grep EnvironmentFile
# Should point to .../backend/.env
```

---

## 4. Diagnose connectivity (SSH)

### 4.1 DNS failure (what we hit on pilot)

```bash
curl -v --connect-timeout 10 https://iot.energy-share.sun.ac.ug/api/v1/telemetry
```

```text
curl: (6) Could not resolve host: iot.energy-share.sun.ac.ug
```

**Meaning:** `iot.` subdomain not in DNS. `energy-share.sun.ac.ug` can still work.

**Fix:** `THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:9090` (see §3).

### 4.2 Local ThingsBoard healthy

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9090
# Expected: 200

curl -s "http://127.0.0.1:9090/api/v1/<DEVICE_TOKEN>/attributes?sharedKeys=remaining_units"
# Expected: {"shared":{"remaining_units":59.3}}
```

### 4.3 Django sees the same URL

After deploying code with `thingsboard-health`:

```http
GET /api/v1/meter/thingsboard-health/
Authorization: Bearer <JWT>
```

Expected:

```json
{
  "success": true,
  "thingsboard_url_in_use": "http://127.0.0.1:9090",
  "http_status": 200
}
```

Shell alternative:

```bash
cd /path/to/gpawa/backend
source venv/bin/activate
python manage.py shell -c "
from django.conf import settings
from meter.services import _thingsboard_base_url
import requests
url = _thingsboard_base_url()
print('URL:', url)
print('HTTP:', requests.get(url + '/', timeout=10).status_code)
"
```

### 4.4 Check Units API

```bash
curl -s -H "Authorization: Bearer <JWT>" \
  "https://energy-share.sun.ac.ug/api/v1/meter/check-units/?meter_no=EM_SRT002"
```

Expected: `"success": true`, `"units_kwh"` matching ThingsBoard `remaining_units`.

---

## 5. UI symptoms → causes

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| `Could not resolve host: iot.energy-share...` | No DNS for `iot.` | `THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:9090` |
| `ThingsBoard request failed: ConnectionError` (short message) | Old code or `.env` not applied | Set `THINGSBOARD_BASE_URL=http://127.0.0.1:9090`, restart gunicorn, pull latest code |
| `Connection refused` on `:9090` | TB container stopped | `docker ps` → `docker start thingsboard-thingsboard-ce-1` |
| Check Units works; Load/Share AMI fails | `AMI_GATEWAY=MockAMIGateway` | Set `ThingsBoardAMIGateway` in `.env` |
| `Meter has no ThingsBoard device token` | Registration incomplete | Re-register AMI meter with TB access token |
| `no remaining_units attribute` | TB device not provisioned | Set shared attribute via rule chain or tenant API |
| Email shows 47 kWh; TB shows 59.3 kWh | Old email template used **ledger** not live TB | Pull latest code (`share/notifications.py`) |
| Share: receiver email only, no sender | Old USSD path | Pull latest; sender gets confirmation email too |
| Pending delivery never clears | Celery not running | `CELERY_TASK_ALWAYS_EAGER=False` + worker + beat |
| Low-units alerts never fire | Poll task not running | Redis + `celery -A backend worker` + `celery -A backend beat` |

---

## 6. Two balances (ledger vs live)

| | **Ledger** (`meter.units` in gPAWA) | **Live** (`remaining_units` in ThingsBoard) |
|--|-------------------------------------|---------------------------------------------|
| Meaning | kWh gPAWA successfully pushed to TB | Field reading on device / TB attribute |
| Shown in UI | “ledger balance” on My Meters | “Live balance (ThingsBoard)” after Check Units |
| Updates when | Load/share delivery succeeds | Device consumption, TB sync, manual TB edits |

They **will differ** when the customer has used power since the last credit. Notifications and Check Units should prefer **live ThingsBoard** when reachable.

---

## 7. Share notifications (email)

After a successful AMI share (web or USSD):

| Recipient | Email subject (approx.) | Contents |
|-----------|-------------------------|----------|
| **Receiver** | Units received on your meter | Sender **name**, email, phone, sender meter, units applied, live TB balance |
| **Sender** | Share confirmation | Recipient name/contact, units shared, wallet remaining |

Ensure users have **first + last name** in gPAWA for readable “Shared by” lines.

Implementation: `backend/share/notifications.py`, `backend/accounts/tasks.py` (`handle_send_wallet_update`).

---

## 8. Celery & Redis (production)

With `CELERY_TASK_ALWAYS_EAGER=False`:

```bash
sudo apt install redis-server
sudo systemctl enable redis-server

cd /path/to/gpawa/backend
source venv/bin/activate
celery -A backend worker -l info &
celery -A backend beat -l info &
```

Or systemd units for worker/beat. Beat tasks include:

| Task | Interval | Purpose |
|------|----------|---------|
| `retry_pending_ami_deliveries` | 5 min | Deliver queued kWh when TB was offline |
| `poll_ami_low_units` | 2 s (configurable) | Low-units notifications |
| `snapshot_ami_meter_balances` | 6 h | Usage analytics |

See [`PLATFORM_ALIGNMENT.md`](./PLATFORM_ALIGNMENT.md).

---

## 9. ThingsBoard on a different host

1. **DNS (long-term):** `iot.energy-share.sun.ac.ug` → ThingsBoard server IP  
2. **Short-term:** `/etc/hosts` on app server  
3. **Or:** `THINGSBOARD_BASE_URL=http://<TB_IP>:8080`

Webhook URL for TB rule chains must be **publicly reachable from TB**, e.g. `https://energy-share.sun.ac.ug/webhooks/thingsboard/low-units` — not `localhost`.

---

## 10. TLS / self-signed certificates

```env
THINGSBOARD_VERIFY_SSL=false
```

Only for self-signed certs on internal URLs. Prefer `http://127.0.0.1:9090` on localhost.

---

## 11. Post-deploy checklist

- [ ] `docker ps` shows `thingsboard-ce` Up  
- [ ] `curl http://127.0.0.1:9090` → HTTP 200  
- [ ] `grep THINGSBOARD backend/.env` shows internal URL 9090  
- [ ] `AMI_GATEWAY=...ThingsBoardAMIGateway`  
- [ ] `sudo systemctl restart gpawa` after `.env` edits  
- [ ] `GET /meter/thingsboard-health/` → success  
- [ ] Web **Check Units** shows live kWh  
- [ ] **Load Units** on AMI meter → telemetry in TB UI  
- [ ] Share AMI → receiver + sender emails (if SMTP configured)  
- [ ] Celery worker + beat running (if not `ALWAYS_EAGER`)  
- [ ] Migrations applied (`python manage.py migrate`)

---

## 12. Meter numbers

Meter numbers are free-form text (letters, numbers, symbols) with no fixed length, up to **100 characters** (database limit). Examples: `EM_SRT002`, `04123456789`. Validation: `backend/meter/validators.py`.

---

*This guide reflects production troubleshooting on `energy-system-set`: DNS missing for `iot.energy-share.sun.ac.ug`, ThingsBoard on Docker port 9090, and gPAWA Check Units fixed via `THINGSBOARD_INTERNAL_BASE_URL` + gunicorn restart.*
