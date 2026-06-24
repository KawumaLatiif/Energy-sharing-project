# Server Configuration Guide — ThingsBoard & AMI (Check Units)

**Audience:** Operators deploying gPAWA on `energy-share.sun.ac.ug`  
**Last updated:** June 2026  
**Related:** [`THINGSBOARD_INTEGRATION_REPORT.md`](./THINGSBOARD_INTEGRATION_REPORT.md), [`backend/.env.production.example`](../backend/.env.production.example)

---

## 1. What “Check Units” needs

For **AMI meters**, the web app’s **Check Units** button calls the Django backend, which then calls **ThingsBoard** to read the live `remaining_units` balance.

```
Browser  →  energy-share.sun.ac.ug (Django)  →  ThingsBoard (iot host)  →  physical meter
```

If the backend cannot reach ThingsBoard, the UI shows an error such as:

- `ThingsBoard request failed: ConnectionError`
- `Could not resolve host: iot.energy-share.sun.ac.ug`

The meter can still show **Device token: Configured** in gPAWA — that only means the token is stored in the database. **Check Units** still requires a working network path from the **application server** to ThingsBoard.

---

## 2. Diagnose from the server (SSH)

Log in to the host that runs Django (e.g. `energy-system-set`) and run:

```bash
curl -v --connect-timeout 10 https://iot.energy-share.sun.ac.ug/api/v1/telemetry
```

### Result A — DNS failure (common on pilot VMs)

```text
curl: (6) Could not resolve host: iot.energy-share.sun.ac.ug
```

**Meaning:** The hostname `iot.energy-share.sun.ac.ug` is not in DNS (or not visible from this server). The public web app at `energy-share.sun.ac.ug` can work while the `iot.` subdomain does not exist.

**Fix:** Use one of the options in [Section 3](#3-fix-options) below.

### Result B — Connection refused / timeout

DNS works but nothing is listening (ThingsBoard stopped, wrong port, firewall).

**Fix:** Start ThingsBoard or open the firewall; confirm the port with [Section 4](#4-find-thingsboard-on-the-server).

### Result C — HTTP response (200, 401, 405, etc.)

ThingsBoard is reachable. If Check Units still fails, check:

- `AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway` in `backend/.env`
- Meter `iot_device_token` matches the device in ThingsBoard
- Device has `remaining_units` attribute or telemetry

---

## 3. Fix options

### Option A — ThingsBoard on the **same server** as Django (recommended for single-VM pilots)

Django should call ThingsBoard via **localhost**, not the public `iot.` hostname.

**Step 1 — Find the local port**

```bash
ss -tlnp | grep -E '8080|9090'

# If ThingsBoard runs in Docker
docker ps | grep -i things

# Probe common ports
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9090
```

A response code other than `000` (and not “connection refused”) means something is listening.

**Step 2 — Edit `backend/.env` on the server**

```env
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug
THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:8080
THINGSBOARD_TIMEOUT_SECONDS=15
THINGSBOARD_VERIFY_SSL=true
AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway
```

Replace `8080` with the port that responded in Step 1.

`THINGSBOARD_INTERNAL_BASE_URL` is used for **all server→ThingsBoard HTTP calls** and bypasses DNS for the `iot.` subdomain.

**Step 3 — Restart Django**

```bash
# Example — use your actual service name
sudo systemctl restart gunicorn
# or
sudo systemctl restart gpawa-backend
```

**Step 4 — Verify**

```bash
curl -v --connect-timeout 10 http://127.0.0.1:8080/api/v1/telemetry
```

Then use **Check Units** in the web app.

---

### Option B — ThingsBoard on a **different machine**

**Long-term (DNS):** Ask your DNS administrator to add an **A record**:

```text
iot.energy-share.sun.ac.ug  →  <ThingsBoard server IP>
```

Wait for propagation, then:

```bash
curl -v --connect-timeout 10 https://iot.energy-share.sun.ac.ug/api/v1/telemetry
```

**Short-term (`/etc/hosts` on the app server):**

```bash
echo "<TB_SERVER_IP>  iot.energy-share.sun.ac.ug" | sudo tee -a /etc/hosts
```

**Direct IP in `.env` (if you prefer not to use hosts):**

```env
THINGSBOARD_BASE_URL=http://<TB_SERVER_IP>:8080
```

Use `http` or `https` and the port ThingsBoard actually exposes.

---

### Option C — ThingsBoard **not installed**

If nothing listens on `8080` / `9090` and there is no separate ThingsBoard host:

1. Install and run [ThingsBoard](https://thingsboard.io/docs/) (Docker or bare metal).
2. Create devices and copy each **device access token** into gPAWA when users register AMI meters.
3. Apply Option A or B so Django can reach the new instance.

Until ThingsBoard is running, **Check Units**, **Load Units** (AMI delivery), and low-units polling will not work against real devices.

---

## 4. Find ThingsBoard on the server

| Check | Command |
|--------|---------|
| Listening ports | `ss -tlnp \| grep -E '8080\|9090\|1883'` |
| Docker containers | `docker ps` |
| Local HTTP | `curl -I http://127.0.0.1:8080` |
| Process | `ps aux \| grep -i thingsboard` |
| Nginx vhost for `iot.` | `grep -r iot /etc/nginx/sites-enabled/` |

Default ThingsBoard HTTP port is often **8080** (HTTPS **443** when behind nginx).

---

## 5. Production `.env` checklist (AMI / ThingsBoard)

Copy from [`backend/.env.production.example`](../backend/.env.production.example) and set at minimum:

| Variable | Purpose |
|----------|---------|
| `THINGSBOARD_BASE_URL` | Public ThingsBoard URL (docs, webhooks, emails) |
| `THINGSBOARD_INTERNAL_BASE_URL` | **Server-to-server URL** when TB is on same host (e.g. `http://127.0.0.1:8080`) |
| `THINGSBOARD_TIMEOUT_SECONDS` | HTTP timeout (default `15`) |
| `THINGSBOARD_VERIFY_SSL` | `true` in production; `false` only for self-signed TLS on internal URL |
| `THINGSBOARD_WEBHOOK_SECRET` | Shared secret for inbound ThingsBoard webhooks |
| `THINGSBOARD_TENANT_USERNAME` / `PASSWORD` | Tenant login — required to **write** `remaining_units` after load/share |
| `AMI_GATEWAY` | Must be `utils.ami_gateway.ThingsBoardAMIGateway` for real AMI meters |
| `CELERY_TASK_ALWAYS_EAGER` | `False` in production if using pending-delivery retry and low-units polling |

**Do not commit** the real `.env` file to git.

---

## 6. TLS / self-signed certificates

If `THINGSBOARD_INTERNAL_BASE_URL` uses HTTPS with a self-signed cert:

```env
THINGSBOARD_VERIFY_SSL=false
```

Use only on trusted internal networks. Prefer proper TLS or plain `http://127.0.0.1:PORT` on localhost.

---

## 7. Smoke tests after configuration

Run on the **application server**:

```bash
# 1. Local ThingsBoard (if using internal URL)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080

# 2. Read attributes for a real device token (replace TOKEN)
curl -s "http://127.0.0.1:8080/api/v1/TOKEN/attributes?sharedKeys=remaining_units"

# 3. Django check-units (replace JWT and meter_no)
curl -s -H "Authorization: Bearer <access_token>" \
  "https://energy-share.sun.ac.ug/api/v1/meter/check-units/?meter_no=EM_SRT002"
```

Expected check-units JSON when healthy:

```json
{
  "success": true,
  "meter_no": "EM_SRT002",
  "units_kwh": 12.5,
  "source": "thingsboard"
}
```

---

## 8. Architecture reminder

| Component | Host (pilot) |
|-----------|----------------|
| Web frontend | `https://energy-share.sun.ac.ug` |
| Django API | Same server (or behind same nginx) |
| ThingsBoard | `https://iot.energy-share.sun.ac.ug` **or** `http://127.0.0.1:8080` via internal URL |

The `iot.` subdomain is **optional for backend traffic** when `THINGSBOARD_INTERNAL_BASE_URL` is set. It is still useful for operators and external webhooks once DNS is configured.

---

## 9. Quick troubleshooting matrix

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| `Could not resolve host: iot.energy-share...` | No DNS for `iot.` subdomain | Set `THINGSBOARD_INTERNAL_BASE_URL` or fix DNS / `/etc/hosts` |
| `Connection refused` on localhost:8080 | ThingsBoard not running | Start TB service or Docker container |
| `ConnectionError` on public URL | Firewall or wrong host | Use internal URL or open firewall |
| `SSLError` | Self-signed cert | `THINGSBOARD_VERIFY_SSL=false` or fix cert |
| `Meter has no ThingsBoard device token` | Registration incomplete | Re-register AMI meter with device token |
| `no remaining_units attribute` | Device not provisioned in TB | Set shared attribute in ThingsBoard rule chain |
| Check Units works; Load fails | `AMI_GATEWAY` still mock | Set `ThingsBoardAMIGateway` in `.env` |

---

## 10. Related documentation

- [`THINGSBOARD_INTEGRATION_REPORT.md`](./THINGSBOARD_INTEGRATION_REPORT.md) — product behaviour and flows  
- [`THINGSBOARD_INTEGRATION_GUIDE.md`](./THINGSBOARD_INTEGRATION_GUIDE.md) — developer integration and API payloads  
- [`THINGSBOARD_WEBHOOK.md`](./THINGSBOARD_WEBHOOK.md) — inbound webhooks from ThingsBoard  
- [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md) — local `.env` for developers  

---

*Document created from production troubleshooting on `energy-system-set` where `iot.energy-share.sun.ac.ug` did not resolve in DNS while the main app at `energy-share.sun.ac.ug` was already live.*
