# gPawa Android App — Complete Guide

Native Android client for the gPawa energy-sharing platform. The app uses the same Django REST API as the web portal and USSD channel.

**Project folder:** `mobile/`  
**Package name:** `com.gpawa.app`  
**Stack:** Expo SDK 56, React Native, TypeScript, expo-router  
**APK (debug):** `mobile/dist/gpawa-debug.apk`

---

## Table of contents

1. [Overview](#1-overview)
2. [Do I need my PC running?](#2-do-i-need-my-pc-running)
3. [Step-by-step: Phone + local PC backend](#3-step-by-step-phone--local-pc-backend)
4. [Step-by-step: Phone + hosted (production) server](#4-step-by-step-phone--hosted-production-server)
5. [Architecture](#5-architecture)
6. [Developer setup (emulator & dev mode)](#6-developer-setup-emulator--dev-mode)
7. [Building and installing the APK](#7-building-and-installing-the-apk)
8. [Using the app (end-user guide)](#8-using-the-app-end-user-guide)
9. [Authentication and security](#9-authentication-and-security)
10. [Troubleshooting](#10-troubleshooting)
11. [Release checklist](#11-release-checklist)
12. [Quick command reference](#12-quick-command-reference)

---

## 1. Overview

### What the app does

| Feature | Description |
|---------|-------------|
| **Register / Login** | Email + password; JWT stored securely on device |
| **Dashboard** | Meter balance, STS/AMI type, wallet, loan summary |
| **Buy Units** | Pay with MTN Mobile Money; ERA tariff estimate; payment polling |
| **STS Tokens** | List unused tokens; generate token from wallet for meter keypad |
| **Loans** | View pending/active loans and outstanding balance |
| **Account** | Profile info, **API endpoint display**, sign out |

### What is not in v1 yet

- Share units (OTP flow)
- Full loan apply / disburse / MoMo repay (use web portal for now)
- Push notifications
- Deep links for email verification and password reset
- Admin portal

### Related documentation

| Document | Purpose |
|----------|---------|
| [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) | Run backend + web locally |
| [`API_ROUTE_CATALOG.md`](../API_ROUTE_CATALOG.md) | Full API reference |
| [`USSD_INTEGRATION.md`](../USSD_INTEGRATION.md) | USSD feature parity checklist |

---

## 2. Do I need my PC running?

| APK built for… | PC must run Django? | Phone network |
|----------------|---------------------|---------------|
| **Your PC’s IP** (`http://192.168.x.x:8000/...`) | **Yes** — every time you use the app | Same Wi‑Fi as PC |
| **Production URL** (`https://energy-share.sun.ac.ug/...`) | **No** | Wi‑Fi or mobile data |

The APK is only the **UI**. Login, buy units, tokens, and loans all call the API over the network. Your phone does not run Django.

**Important:** The API URL is **baked into the APK at build time** (`mobile/.env` → `EXPO_PUBLIC_API_URL`). You cannot change it after install without rebuilding and reinstalling.

---

## 3. Step-by-step: Phone + local PC backend

Follow this when you install `gpawa-debug.apk` and want the app to talk to Django on your development PC.

### Step 1 — Connect phone and PC to the same Wi‑Fi

- PC and phone must be on the **same home/office Wi‑Fi**.
- On the phone, use **Wi‑Fi** (not mobile data only).
- The PC must not be on a guest network that blocks device-to-device traffic.

### Step 2 — Find your PC’s Wi‑Fi IP (`ipconfig`)

Open PowerShell and run:

```powershell
ipconfig
```

Find **Wireless LAN adapter Wi‑Fi** (or your active Ethernet adapter if wired):

```
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 192.168.1.130   ← USE THIS
   Default Gateway . . . . . . . . . : 192.168.1.1
```

**Use the Wi‑Fi IPv4 address** — e.g. `192.168.1.130`.

**Do not use these** (they are virtual adapters, not your home network):

| Address | Adapter | Why not |
|---------|---------|---------|
| `192.168.189.1` | VMware VMnet1 | Virtual; phone cannot reach your PC |
| `192.168.79.1` | VMware VMnet8 | Virtual; phone cannot reach your PC |
| `10.0.2.2` | Android emulator only | Means “host PC” inside emulator, not on a real phone |

Your API URL will be:

```text
http://<YOUR_WIFI_IP>:8000/api/v1
```

Example: `http://192.168.1.130:8000/api/v1`

### Step 3 — Set the API URL in `mobile/.env`

Edit `D:\Energy-sharing-project\mobile\.env`:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.130:8000/api/v1
```

Replace `192.168.1.130` with **your** Wi‑Fi IPv4 from Step 2.

Copy from template if needed:

```powershell
cd D:\Energy-sharing-project\mobile
copy .env.example .env
# then edit .env
```

### Step 4 — Start the backend on your PC

Open PowerShell and leave this running while you use the app:

```powershell
cd D:\Energy-sharing-project\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000
```

Use **`0.0.0.0:8000`**, not `127.0.0.1:8000`, so your phone can reach the server on the network.

**Verify on your PC** — you should get a response (even an error JSON), not “connection refused”:

```powershell
Invoke-WebRequest -Uri "http://192.168.1.130:8000/api/v1/auth/login/" -Method POST -ContentType "application/json" -Body '{"email":"test@test.com","password":"test"}' -UseBasicParsing
```

HTTP **400** = API is reachable (bad credentials is OK for this test).

### Step 5 — Allow Windows Firewall (if the phone still cannot connect)

1. Windows Search → **“Allow an app through firewall”**
2. Allow **Python** on **Private** networks  
   — or add an inbound rule for **TCP port 8000** on Private networks.

### Step 6 — Rebuild the APK

The URL in `.env` is embedded when the APK is built. **Changing `.env` alone does not update an already-installed app.**

```powershell
cd D:\Energy-sharing-project\mobile
npm run prebuild:android    # first time only (or after native config changes)
cd android
.\gradlew.bat assembleDebug
```

First build can take **30–75 minutes** (downloads SDK/NDK). Later builds are often **2–5 minutes**.

If the app still shows the wrong API URL after install, force a clean rebuild:

```powershell
cd D:\Energy-sharing-project\mobile\android
.\gradlew.bat clean assembleDebug
```

**Output APK:**

| Path | Purpose |
|------|---------|
| `mobile/android/app/build/outputs/apk/debug/app-debug.apk` | Gradle output |
| `mobile/dist/gpawa-debug.apk` | Copy for easy sharing |

Copy to `dist/`:

```powershell
New-Item -ItemType Directory -Force -Path D:\Energy-sharing-project\mobile\dist
Copy-Item D:\Energy-sharing-project\mobile\android\app\build\outputs\apk\debug\app-debug.apk `
  D:\Energy-sharing-project\mobile\dist\gpawa-debug.apk -Force
```

### Step 7 — Install on your phone

**Option A — File transfer**

1. Copy `gpawa-debug.apk` to the phone (USB, WhatsApp, Google Drive, etc.).
2. Open the file on the phone.
3. Allow **Install unknown apps** if Android prompts.
4. Uninstall any **old** gPawa APK first if you previously installed one built for the emulator (`10.0.2.2`).

**Option B — USB (ADB)**

```powershell
adb install D:\Energy-sharing-project\mobile\dist\gpawa-debug.apk
```

### Step 8 — Verify and sign in

1. Ensure Step 4 is still running (`runserver 0.0.0.0:8000`).
2. Open **gPawa** on the phone.
3. Go to the **Account** tab.
4. Confirm the API endpoint shows your PC IP, e.g.  
   `http://192.168.1.130:8000/api/v1`
5. **Sign in** or **Register**.

If the Account tab still shows `http://10.0.2.2:8000/api/v1`, the old APK is installed — repeat Steps 6–7 with a clean rebuild.

### Daily workflow (phone + local PC)

```text
1. PC:  python manage.py runserver 0.0.0.0:8000
2. Phone: same Wi‑Fi as PC
3. Open gPawa app
```

You do **not** need the Next.js frontend (`npm run dev`) for the Android app — only Django.

---

## 4. Step-by-step: Phone + hosted (production) server

Use this when the app should work **without** your PC running (pilot users, demos on production).

### Step 1 — Set production API URL

Edit `mobile/.env`:

```env
EXPO_PUBLIC_API_URL=https://energy-share.sun.ac.ug/api/v1
```

Replace with your actual hosted API domain.

### Step 2 — Rebuild and install the APK

Same as [§7](#7-building-and-installing-the-apk) — `assembleDebug` or a signed release build.

### Step 3 — Use the app

- PC does **not** need to run Django.
- Phone can use **Wi‑Fi or mobile data**.
- Backend must be deployed, HTTPS valid, MoMo/email configured on the server.

Server `.env` should include (see `backend/.env.production.example`):

```env
DEBUG=False
BASE_URL=https://energy-share.sun.ac.ug/api/v1
FRONTEND_URL=https://energy-share.sun.ac.ug
PRODUCTION_ORIGIN=https://energy-share.sun.ac.ug
EXTRA_ALLOWED_HOSTS=energy-share.sun.ac.ug
```

---

## 5. Architecture

```
┌─────────────────┐     HTTP/HTTPS        ┌──────────────────────────┐
│  gPawa Android  │ ───────────────────► │  Django API /api/v1      │
│  (Expo/RN)      │   Authorization:     │  JWT, MoMo, ERA billing  │
│                 │   Bearer <token>     │  ThingsBoard (server-side)│
└─────────────────┘                      └──────────────────────────┘
```

- Thin client — billing, MoMo, and meter logic stay on the backend.
- JWT Bearer tokens (not cookies); stored in **expo-secure-store**.
- API URL from `EXPO_PUBLIC_API_URL` in `mobile/.env` at **build time**.
- Native apps are not blocked by browser CORS.

### Project structure

```
mobile/
  app/(auth)/         login, register
  app/(app)/(tabs)/   home, buy-units, tokens, loans, account
  lib/                API client, auth, meter, dashboard
  context/            AuthProvider
  constants/config.ts fallback API_URL
  android/            native project (after prebuild)
  dist/               gpawa-debug.apk
```

### API URL reference

| Target | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical phone + local PC | `http://<WIFI_IP>:8000/api/v1` |
| Production | `https://energy-share.sun.ac.ug/api/v1` |

---

## 6. Developer setup (emulator & dev mode)

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Android Studio | latest (emulator or USB) |
| Django backend | running |
| Java JDK | 17+ |

### One-time setup

```powershell
cd D:\Energy-sharing-project\mobile
copy .env.example .env
npm install
npm run prebuild:android   # first time
```

### Emulator

1. Set `.env`: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1`
2. Start backend: `python manage.py runserver` (localhost is fine for emulator)
3. Run: `npm run android`

### Test accounts (local DB)

If you loaded the sample dump (see [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md)):

| Email | Password |
|-------|----------|
| `jane@powercred.local` | `Pass1234!` |
| `john@powercred.local` | `Pass1234!` |

Or register in the app and verify email (SMTP required in `backend/.env`).

---

## 7. Building and installing the APK

### Debug APK (internal testing)

**Always set `mobile/.env` before building.**

```powershell
cd D:\Energy-sharing-project\mobile
npm run prebuild:android    # if android/ missing
cd android
.\gradlew.bat assembleDebug
```

Or from `mobile/`:

```powershell
npm run apk:debug
```

### Install

```powershell
adb install dist\gpawa-debug.apk
```

Or copy the APK to the phone and open it (enable unknown sources).

### Production release

**Local release:**

```powershell
cd mobile\android
.\gradlew.bat assembleRelease
```

Requires signing config in `android/app/build.gradle`.

**EAS Build (Play Store):**

```powershell
npm install -g eas-cli
eas login
cd mobile
eas build:configure
eas build --platform android --profile production
```

---

## 8. Using the app (end-user guide)

### First-time setup

1. Install the APK ([§3 Step 7](#step-7--install-on-your-phone)).
2. Open gPawa → **Register** or **Sign in**.
3. **Verify email** from the link in your inbox.
4. Register a meter via the **web portal** if you do not have one yet.

### Home tab

Meter number, STS/AMI type, kWh balance, pending STS units, wallet, loan outstanding. Pull to refresh.

### Buy Units tab

1. Enter amount (UGX). First purchase each month needs ~**UGX 4,000+** (ERA service charge + VAT).
2. Review estimate (kWh, charges).
3. Enter MTN MoMo number (`+256…`).
4. Tap **Review & Pay** and approve on your phone.
5. For STS meters, generate a token under **Tokens**.

### Tokens tab (STS)

Generate a keypad token from wallet kWh; enter it on the physical meter.

### Loans tab

View stats; full apply/repay on web portal for now.

### Account tab

Shows name, email, **connected API URL**, and sign out.

---

## 9. Authentication and security

| Topic | Behaviour |
|-------|-----------|
| Login | `POST /api/v1/auth/login/` |
| Storage | JWT in SecureStore (Android Keystore) |
| API calls | `Authorization: Bearer <access>` |
| Refresh | Auto on 401 via `/api/v1/auth/refresh/token/` |
| Password reset | Web portal forgot-password (for now) |
| Staff 2FA | Web admin only |

---

## 10. Troubleshooting

### White screen on launch (nothing shows)

| Cause | Fix |
|-------|-----|
| **HTTP blocked on Android** | Local API uses `http://192.168.x.x` — Android blocks cleartext unless `usesCleartextTraffic` is enabled (fixed in `app.json` + `AndroidManifest.xml`). **Rebuild APK** after this fix. |
| Old APK / wrong bundle | Uninstall app → `gradlew clean assembleDebug` → reinstall |
| Stuck on auth check | Should show “Starting gPawa…” then login; if stuck >8s, force-close and reopen |
| Backend not running | White screen is usually not backend-related at launch — but login will fail after |

After code fixes, rebuild:

```powershell
cd D:\Energy-sharing-project\mobile\android
.\gradlew.bat clean assembleDebug
Copy-Item app\build\outputs\apk\debug\app-debug.apk ..\dist\gpawa-debug.apk -Force
```

### “Network error” on phone

| Check | Action |
|-------|--------|
| Backend not running | `python manage.py runserver 0.0.0.0:8000` |
| Wrong IP in APK | Rebuild after editing `mobile/.env` |
| Wrong IP from `ipconfig` | Use **Wi‑Fi** adapter only, not VMware |
| Firewall | Allow Python / port 8000 on Private network |
| Phone on mobile data | Connect to same Wi‑Fi as PC |
| Old APK | Uninstall; install newly built APK |
| Account tab shows `10.0.2.2` | APK built for emulator — rebuild with LAN IP |

### “Wrong credentials”

- Check email/password.
- Email must be verified (or reset password via web — that also verifies email).

### Buy Units shows 0 kWh for small amounts

ERA tariff: first purchase each month includes **UGX 3,360 service charge + 18% VAT**. Under ~UGX 4,000 may show 0 kWh on first purchase; top-ups later in the month can be smaller.

### APK install blocked

Settings → allow **Install unknown apps** for your file manager.

### Gradle build very slow first time

Normal (SDK/NDK download). Later builds ~2–5 minutes.

### Env change not in APK after rebuild

Run `.\gradlew.bat clean assembleDebug` in `mobile/android`.

---

## 11. Release checklist

- [ ] `EXPO_PUBLIC_API_URL` set correctly in `mobile/.env`
- [ ] APK rebuilt after any `.env` change
- [ ] Account tab shows expected API URL on a real device
- [ ] Login, buy units, STS token tested on device
- [ ] Production: HTTPS, `DEBUG=False`, MoMo live credentials
- [ ] Signed release / Play Store AAB if public distribution

---

## 12. Quick command reference

```powershell
# Find PC Wi-Fi IP
ipconfig

# Start backend (phone on same Wi-Fi)
cd D:\Energy-sharing-project\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver 0.0.0.0:8000

# Edit API URL then rebuild APK
cd D:\Energy-sharing-project\mobile
# edit .env → EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api/v1
cd android
.\gradlew.bat assembleDebug

# Copy & install
Copy-Item app\build\outputs\apk\debug\app-debug.apk ..\dist\gpawa-debug.apk -Force
adb install ..\dist\gpawa-debug.apk

# Dev emulator
cd mobile
npm run android
```

For backend and web portal setup, see [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md).
