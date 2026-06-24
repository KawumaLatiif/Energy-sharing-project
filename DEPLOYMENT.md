# Deployment Guide — gPawa Energy Sharing Platform

**Target:** `https://energy-share.sun.ac.ug`  
**Audience:** Anyone setting up the server for the first time, no DevOps background required.  
**Pilot scope:** Small stakeholder audience, domestic users only. Designed to be lean.

---

## Before you start — what you need

- A Linux server (Ubuntu 22.04 recommended) reachable at `energy-share.sun.ac.ug`
- SSH access to that server
- The university IT team to confirm whether SSL/HTTPS is already provided for `.sun.ac.ug` subdomains — ask before setting up your own certificates
- A Gmail account with an App Password created (see Step 6)
- Python 3.13 installed on the server (`python3 --version`)

---

## Step 1 — Install system dependencies

SSH into the server, then:

```bash
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3-pip postgresql postgresql-contrib nginx git
```

**What this does:** Installs Python 3.13, PostgreSQL (database), Nginx (web server), and Git.

**How to confirm it worked:**
```bash
python3.13 --version    # should print Python 3.13.x
psql --version          # should print psql 14.x or similar
nginx -v                # should print nginx version
```

---

## Step 2 — Create a dedicated database role and database

PostgreSQL comes with a superuser called `postgres`. For security, create a separate role for the app:

```bash
sudo -u postgres psql
```

Inside the psql prompt, run these commands one by one:

```sql
CREATE USER gpawa_app WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE metering OWNER gpawa_app;
\c metering
CREATE SCHEMA IF NOT EXISTS custom AUTHORIZATION gpawa_app;
GRANT ALL ON SCHEMA custom TO gpawa_app;
\q
```

**What this does:** Creates a user `gpawa_app` that can only access the `metering` database, in the `custom` schema. The app will connect as this user instead of the `postgres` superuser.

---

## Step 3 — Clone the project

```bash
cd /home/ubuntu          # or wherever you keep apps
git clone https://github.com/KawumaLatiif/Energy-sharing-project.git gpawa
cd gpawa/backend
```

---

## Step 4 — Create a virtual environment and install dependencies

```bash
python3.13 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Convert requirements file to UTF-8 if needed (the repo file may have a BOM):
python3 -c "
import pathlib
content = pathlib.Path('requirements.txt').read_text('utf-16', errors='replace')
lines = [l for l in content.splitlines() if l.strip() and l[0].isalpha()]
pathlib.Path('requirements_utf8.txt').write_text('\n'.join(lines))
"
pip install -r requirements_utf8.txt
pip install pyotp gunicorn   # not in the requirements file
```

**How to confirm:** `python -c "import django; print(django.__version__)"` should print `5.2`.

---

## Step 5 — Fill in the environment file

```bash
cp .env.production.example .env
nano .env
```

Fill in every `REPLACE_WITH_...` value:

| Variable | What to put |
|---|---|
| `SECRET_KEY` | Run `python -c "import secrets; print(secrets.token_urlsafe(60))"` and paste the output |
| `DB_USER` | `gpawa_app` |
| `DB_PASSWORD` | The password you set in Step 2 |
| `EMAIL_HOST_PASSWORD` | Your Gmail App Password (see Step 6) |
| Everything else | Use the defaults in the example file |

Save and close (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

**Confirm the file is not world-readable:**
```bash
chmod 600 .env
```

---

## Step 6 — Gmail App Password

The app sends verification emails via Gmail SMTP. If you haven't already:

1. Go to your Google Account → Security → 2-Step Verification (turn it ON if not already)
2. Go to Security → App Passwords
3. Click "Create App Password" → choose "Mail" → copy the 16-character password
4. Paste it into `.env` as `EMAIL_HOST_PASSWORD` (include the spaces — they're part of the password)

---

## Step 7 — Run database migrations and seed data

```bash
source venv/bin/activate   # activate the venv if not already active
python manage.py migrate
python manage.py seed_era_tariff   # loads ERA domestic tariff (Code 10.1) rates
```

**What "migrate" does:** Creates all the database tables the app needs.  
**What "seed_era_tariff" does:** Loads the current electricity pricing blocks into the database.

**How to confirm:** Both commands should finish with no errors. `migrate` will print a list of applied migrations; `seed_era_tariff` will print the four tariff blocks.

---

## Step 8 — Create the admin account

```bash
python manage.py shell -c "
from accounts.models import User
from accounts.models import Profile
u = User.objects.create_superuser(
    email='admin@gpawa.com',
    password='REPLACE_WITH_STRONG_ADMIN_PASSWORD',
    first_name='Admin',
    last_name='gPawa',
    user_role='ADMIN'
)
Profile.objects.update_or_create(user=u, defaults={'email_verified': True})
print('Admin created:', u.email)
"
```

---

## Step 9 — Collect static files

```bash
python manage.py collectstatic --noinput
```

**What this does:** Copies CSS/JS/image files to `staticfiles/` so Nginx can serve them.

---

## Step 10 — Run the application

### Simple option (pilot / low traffic)

The simplest way to run the app is with Gunicorn directly. Create a systemd service so it starts automatically:

```bash
sudo nano /etc/systemd/system/gpawa.service
```

Paste:

```ini
[Unit]
Description=gPawa Energy Sharing Django App
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/gpawa/backend
ExecStart=/home/ubuntu/gpawa/backend/venv/bin/gunicorn backend.wsgi:application \
    --bind 127.0.0.1:8000 \
    --workers 3
Restart=always
EnvironmentFile=/home/ubuntu/gpawa/backend/.env

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable gpawa
sudo systemctl start gpawa
sudo systemctl status gpawa   # should say "active (running)"
```

---

## Step 11 — Configure Nginx as a reverse proxy

```bash
sudo nano /etc/nginx/sites-available/gpawa
```

Paste:

```nginx
server {
    listen 80;
    server_name energy-share.sun.ac.ug;

    location /static/ {
        alias /home/ubuntu/gpawa/backend/staticfiles/;
    }

    location /media/ {
        alias /home/ubuntu/gpawa/backend/mediafiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/gpawa /etc/nginx/sites-enabled/
sudo nginx -t          # should say "syntax is ok"
sudo systemctl reload nginx
```

**How to confirm:** Visit `http://energy-share.sun.ac.ug` — you should see the API welcome message.

---

## Step 12 — HTTPS (SSL)

**Ask the university IT team first.** Stellenbosch University may already provision SSL certificates for `*.sun.ac.ug` subdomains. If they do, they will give you a certificate file and a key file — Nginx can use them directly.

If the university does NOT provide certificates, use Let's Encrypt (free):

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d energy-share.sun.ac.ug
```

Certbot will ask for your email and automatically update the Nginx config for HTTPS.

**How to confirm:** Visit `https://energy-share.sun.ac.ug` — the padlock should appear.

---

## Step 13 — Deploy the frontend

The frontend (Next.js) is a separate process. On the same server or a different one:

```bash
cd /home/ubuntu/gpawa/frontend
npm install
npm run build
npm start -- -p 3000 &    # or use PM2 for a proper process manager
```

Or with PM2 (recommended):
```bash
npm install -g pm2
pm2 start "npm start -- -p 3000" --name gpawa-frontend
pm2 save
pm2 startup
```

Add a second Nginx server block (or a `location /` block) pointing to port 3000 for the frontend.

---

## Step 14 — Confirm end-to-end email verification

1. Register a new account at `https://energy-share.sun.ac.ug/auth/register`
2. Check the inbox for the registration email — the link inside should point to `https://energy-share.sun.ac.ug/auth/verify-email?uid=...&token=...`
3. Click the link — the account should be marked verified and login should work

If the email doesn't arrive, check the Django logs:
```bash
sudo journalctl -u gpawa -f
```

---

## Step 15 — ThingsBoard & AMI meters (production)

Required when using **real networked (AMI) meters** on the hosted server. Full guide: [`docs/SERVER_THINGSBOARD_CONFIGURATION.md`](docs/SERVER_THINGSBOARD_CONFIGURATION.md).

### 15.1 Confirm ThingsBoard is running

On `energy-system-set`, ThingsBoard runs in Docker:

```bash
docker ps | grep thingsboard
# Expect: 127.0.0.1:9090->8080/tcp
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:9090
# Expect: 200
```

### 15.2 Configure `backend/.env`

```env
# Public URL (optional for backend if INTERNAL is set)
THINGSBOARD_BASE_URL=https://iot.energy-share.sun.ac.ug

# REQUIRED when Django and TB are on the same VM (no DNS for iot.*)
THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:9090

THINGSBOARD_TIMEOUT_SECONDS=15
THINGSBOARD_VERIFY_SSL=true
THINGSBOARD_WEBHOOK_SECRET=<long-random-secret>
THINGSBOARD_TENANT_USERNAME=<tenant@tenant>
THINGSBOARD_TENANT_PASSWORD=<password>

AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway

CELERY_TASK_ALWAYS_EAGER=False
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
```

Restart after editing:

```bash
sudo systemctl restart gpawa
```

### 15.3 Celery worker + beat (AMI retry & low-units)

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server

cd /home/ubuntu/gpawa/backend
source venv/bin/activate
celery -A backend worker -l info &
celery -A backend beat -l info &
```

Use systemd units or PM2 for production persistence.

### 15.4 Verify Check Units

1. Register an AMI meter with `iot_device_token` from ThingsBoard.
2. Log in at `https://energy-share.sun.ac.ug` → **My Meters** → **Check Units**.
3. Or API: `GET /api/v1/meter/thingsboard-health/` (JWT) → `"success": true`.
4. Or SSH: `curl -s "http://127.0.0.1:9090/api/v1/<TOKEN>/attributes?sharedKeys=remaining_units"`.

### 15.5 Optional: low-units webhook from ThingsBoard

Expose to TB: `POST https://energy-share.sun.ac.ug/webhooks/thingsboard/low-units` — see [`docs/THINGSBOARD_WEBHOOK.md`](docs/THINGSBOARD_WEBHOOK.md). gPAWA also **polls** ThingsBoard every 2 seconds via Celery beat when worker is running.

---

## Optional hardening (do after the pilot works)

These are good to do but not required for the pilot to function:

- **Switch to a Celery worker** for background email and AMI tasks (set `CELERY_TASK_ALWAYS_EAGER=False` and run `celery -A backend worker -l info` + `celery -A backend beat -l info`). Install and start Redis first: `sudo apt install redis-server`.
- **Switch MTN MoMo** from `sandbox` to production credentials once real payments are needed.
- **Database backups**: `pg_dump metering | gzip > backup.sql.gz` — set up a cron job.
- **Firewall**: `sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`

ThingsBoard and AMI gateway configuration is covered in **Step 15** above (not optional when using real AMI meters).

---

## Quarterly tariff update

When ERA publishes new rates, update the database without touching code:

1. Close the current tariff's `effective_to` date in the admin or via Django shell
2. Run `python manage.py seed_era_tariff` after editing the rates in `loan/management/commands/seed_era_tariff.py`

---

## Troubleshooting

| Symptom | Check |
|---|---|
| 502 Bad Gateway | `sudo systemctl status gpawa` — is Gunicorn running? |
| Email not arriving | `sudo journalctl -u gpawa -f` — look for SMTP errors |
| Database connection error | Check `DB_*` vars in `.env` match the PostgreSQL user/db you created |
| `Invalid HTTP_HOST header` | Add the domain to `EXTRA_ALLOWED_HOSTS` in `.env` |
| Verification link goes to localhost | Check `FRONTEND_URL` in `.env` is set to the production domain |
| Check Units: `ConnectionError` / `Could not resolve host` | Set `THINGSBOARD_INTERNAL_BASE_URL=http://127.0.0.1:9090`; restart `gpawa` — see [`docs/SERVER_THINGSBOARD_CONFIGURATION.md`](docs/SERVER_THINGSBOARD_CONFIGURATION.md) |
| Check Units works in SSH curl but not in app | `.env` not loaded by systemd — check `EnvironmentFile=` in gunicorn unit |
| Load/Share AMI: no meter update | `AMI_GATEWAY=utils.ami_gateway.ThingsBoardAMIGateway` in `.env` |
| `thingsboard-health` fails | `docker ps` — is TB container up? `curl http://127.0.0.1:9090` → 200 |
| Pending AMI delivery never clears | Celery worker + beat running; `CELERY_TASK_ALWAYS_EAGER=False` |
