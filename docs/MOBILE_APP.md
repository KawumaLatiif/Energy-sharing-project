# gPawa Android App — Documentation

Native Android client for the gPawa energy-sharing platform. The app uses the same Django REST API as the web portal and USSD channel.

**Project folder:** `mobile/`  
**Package name:** `com.gpawa.app`  
**Stack:** Expo SDK 56, React Native, TypeScript, expo-router

---

## Table of contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Local development](#3-local-development)
4. [Building and installing the APK](#4-building-and-installing-the-apk)
5. [Hosted / production setup](#5-hosted--production-setup)
6. [Using the app (end-user guide)](#6-using-the-app-end-user-guide)
7. [Authentication and security](#7-authentication-and-security)
8. [Troubleshooting](#8-troubleshooting)
9. [Release checklist](#9-release-checklist)

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
| **Account** | Profile info, API endpoint display, sign out |

### What is not in v1 yet

- Share units (OTP flow)
- Full loan apply / disburse / MoMo repay (use web portal for now)
- Push notifications
- Deep links for email verification and password reset
- Admin portal

### Related documentation

| Document | Purpose |
|----------|---------|
| [`mobile/README.md`](../mobile/README.md) | Quick reference for developers |
| [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) | Run backend + web locally |
| [`API_ROUTE_CATALOG.md`](../API_ROUTE_CATALOG.md) | Full API reference |
| [`USSD_INTEGRATION.md`](../USSD_INTEGRATION.md) | USSD feature parity checklist |

---

## 2. Architecture

```
┌─────────────────┐     HTTPS/HTTP      ┌──────────────────────────┐
│  gPawa Android  │ ──────────────────► │  Django API /api/v1      │
│  (Expo/RN)      │   Authorization:    │  JWT, MoMo, ERA billing  │
│                 │   Bearer <token>    │  ThingsBoard (server-side)│
└─────────────────┘                     └──────────────────────────┘
```

- The app is a **thin client** — all billing, MoMo, and meter logic runs on the backend.
- Auth uses **JWT Bearer tokens** (not cookies). Tokens are stored in **expo-secure-store** (Android Keystore-backed).
- The API URL is **baked in at build time** via `EXPO_PUBLIC_API_URL` in `mobile/.env`.
- Native Android apps are **not subject to browser CORS**; they only need a reachable API URL and valid TLS in production.

### Project structure

```
mobile/
  app/
    (auth)/           login, register
    (app)/(tabs)/     home, buy-units, tokens, loans, account
  lib/                API client, auth, meter, dashboard helpers
  context/            AuthProvider (session state)
  components/         Shared UI
  constants/config.ts API_URL, app name
  android/            Native project (after `expo prebuild`)
  dist/               Built APK copy (gpawa-debug.apk)
```

---

## 3. Local development

### 3.1 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | Same as frontend |
| npm | latest | Comes with Node |
| Android Studio | latest | Emulator or physical device via USB |
| Django backend | running | See [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md) |
| Java JDK | 17+ | Used by Gradle for APK builds |

Optional for live reload during development:

- **Expo Go** app on a physical phone, or
- **Android emulator** from Android Studio

### 3.2 One-time setup

From the project root:

```powershell
cd mobile
cp .env.example .env
npm install
```

Edit `mobile/.env` for your target:

```env
# Android emulator → host machine localhost
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api/v1

# Physical phone on same Wi‑Fi → your PC's LAN IP (run `ipconfig`)
# EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1
```

### 3.3 Start the backend (required)

The mobile app cannot run without the API.

**Terminal 1 — Django:**

```powershell
cd backend
.\venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000
```

Use `0.0.0.0:8000` (not `127.0.0.1`) when testing on a **physical phone** on the same network.

Quick check: open http://localhost:8000/swagger/ in a browser.

### 3.4 Run the app in development mode

**Option A — Android emulator (recommended for dev)**

1. Start an emulator in Android Studio.
2. Ensure `mobile/.env` uses `http://10.0.2.2:8000/api/v1`.
3. Run:

```powershell
cd mobile
npm run android
```

This compiles and launches the app on the emulator with hot reload.

**Option B — Physical device on Wi‑Fi**

1. Find your PC's IP: `ipconfig` → e.g. `192.168.1.42`.
2. Set `EXPO_PUBLIC_API_URL=http://192.168.1.42:8000/api/v1` in `mobile/.env`.
3. Restart the dev server (`npm run android` or `npx expo start` then scan QR with Expo Go).
4. Phone and PC must be on the **same Wi‑Fi**; allow port **8000** through Windows Firewall if requests fail.

**Option C — USB debugging**

```powershell
adb devices
cd mobile
npm run android
```

### 3.5 Test accounts (local)

If you loaded the sample database dump (see [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md)):

| Email | Password | Notes |
|-------|----------|-------|
| `jane@powercred.local` | `Pass1234!` | Normal user |
| `john@powercred.local` | `Pass1234!` | Normal user |
| `admin@powercred.local` | `Pass1234!` | Admin (use web for admin tasks) |

Or register a new account in the app; verify email via the link sent to your inbox (requires SMTP in `backend/.env`).

---

## 4. Building and installing the APK

### 4.1 Debug APK (testing)

A debug APK is suitable for internal testing. It is **not** signed for the Play Store.

**Before building:** set the correct `EXPO_PUBLIC_API_URL` in `mobile/.env`. The URL is embedded at build time and cannot be changed without rebuilding.

```powershell
cd mobile
npm run prebuild:android    # generates android/ (first time or after native config changes)
npm run apk:debug           # builds APK (~15–75 min first time)
```

**Output locations:**

| Path | Description |
|------|-------------|
| `mobile/android/app/build/outputs/apk/debug/app-debug.apk` | Gradle output |
| `mobile/dist/gpawa-debug.apk` | Copy for easy sharing (create manually after build) |

Copy to `dist/` after a successful build:

```powershell
New-Item -ItemType Directory -Force -Path dist
Copy-Item android\app\build\outputs\apk\debug\app-debug.apk dist\gpawa-debug.apk
```

### 4.2 Install on a device

**Via USB (ADB):**

```powershell
adb install dist\gpawa-debug.apk
```

**Via file transfer:**

1. Copy `gpawa-debug.apk` to the phone (USB, email, Google Drive, etc.).
2. Open the file on the phone.
3. Allow **Install unknown apps** for your file manager if prompted.

### 4.3 Which API URL to use when building

| Where you run the app | Set in `mobile/.env` before build |
|-----------------------|-----------------------------------|
| Android emulator | `http://10.0.2.2:8000/api/v1` |
| Physical phone + local backend | `http://<YOUR_PC_IP>:8000/api/v1` |
| Physical phone + hosted API | `https://energy-share.sun.ac.ug/api/v1` (or your production URL) |

---

## 5. Hosted / production setup

### 5.1 Production API URL

For an APK that talks to your **hosted** backend, set:

```env
EXPO_PUBLIC_API_URL=https://energy-share.sun.ac.ug/api/v1
```

Replace with your actual API domain. Rebuild the APK after changing this value.

### 5.2 Backend requirements (hosted)

Ensure your server `.env` includes (see `backend/.env.production.example`):

```env
DEBUG=False
BASE_URL=https://energy-share.sun.ac.ug/api/v1
FRONTEND_URL=https://energy-share.sun.ac.ug
PRODUCTION_ORIGIN=https://energy-share.sun.ac.ug
EXTRA_ALLOWED_HOSTS=energy-share.sun.ac.ug
```

The mobile app uses **HTTPS** in production. Your API must serve a **valid TLS certificate** (Let's Encrypt, etc.).

**Note:** CORS settings apply to browsers only. The Android app uses direct HTTP requests with JWT and does not need CORS entries — but the API must be reachable at the URL baked into the APK.

### 5.3 Network and firewall

| Requirement | Details |
|-------------|---------|
| API reachable | `https://your-domain/api/v1/auth/login/` must respond from the internet (or your VPN) |
| MoMo callbacks | MTN MoMo webhooks must reach your backend (server-side; not the app) |
| Email | SMTP configured for registration verification and password reset |

### 5.4 Building a production release APK

**Option A — Local release build (manual signing required)**

```powershell
cd mobile
npm run prebuild:android
cd android
.\gradlew.bat assembleRelease
```

Release APK: `android/app/build/outputs/apk/release/app-release.apk`

You must configure signing in `android/app/build.gradle` with a keystore. Do not commit keystore files.

**Option B — EAS Build (recommended for Play Store)**

```powershell
npm install -g eas-cli
eas login
cd mobile
eas build:configure
eas build --platform android --profile production
```

EAS handles signing and produces an `.aab` for Google Play.

### 5.5 Environment matrix

| Environment | `EXPO_PUBLIC_API_URL` | Backend command | Who uses it |
|-------------|----------------------|-----------------|-------------|
| Local emulator | `http://10.0.2.2:8000/api/v1` | `runserver` on PC | Developers |
| Local phone (LAN) | `http://192.168.x.x:8000/api/v1` | `runserver 0.0.0.0:8000` | QA / demos |
| Staging | `https://staging.example.com/api/v1` | Hosted staging | Pre-release testing |
| Production | `https://energy-share.sun.ac.ug/api/v1` | Hosted production | End users |

Build **separate APKs** per environment, or use a single production APK for all end users.

### 5.6 Distributing to users

| Method | Use case |
|--------|----------|
| Direct APK download | Pilot / internal users; host `gpawa-release.apk` on your site |
| Google Play Store | Public release; requires signed AAB via EAS |
| MDM / enterprise | Push APK via device management |

---

## 6. Using the app (end-user guide)

### 6.1 First-time setup

1. **Install** the APK (see [§4.2](#42-install-on-a-device)).
2. **Open gPawa** — you will see the sign-in screen.
3. **Create an account** (Register) or **Sign in** with existing credentials.
4. **Verify your email** — check inbox for the verification link (open on phone or desktop). You cannot log in until email is verified, unless an admin has verified you.
5. **Register a meter** — if you have no meter yet, use the web portal (`/dashboard`) or contact support; meter registration from mobile is planned for a future release.

### 6.2 Home tab

Shows:

- **Meter number** and type (**STS** = keypad token meter, **AMI** = smart/network meter)
- **Balance** in kWh
- **Pending units** (STS wallet — units bought but not yet converted to a token)
- **Wallet** unit balance and **loan outstanding** (UGX)

Pull down to refresh.

### 6.3 Buy Units tab

1. Enter amount in **UGX** (minimum ~UGX 4,000 for first purchase of the month due to ERA service charge + VAT; smaller amounts work for top-ups later in the month).
2. Review the **estimate** (kWh, service charge, VAT).
3. Enter your **MTN Mobile Money** number (`+256…`).
4. Tap **Review & Pay**.
5. **Approve the MoMo prompt** on your phone.
6. Wait for confirmation — the app polls until payment succeeds or fails.
7. For **STS meters**, go to the **Tokens** tab to generate a keypad token from credited units.

### 6.4 Tokens tab (STS meters)

1. View **unused tokens** already generated.
2. Enter **kWh** from your wallet balance.
3. Tap **Generate Token**.
4. **Enter the token on your physical meter keypad** (same as UEDCL/STS prepaid flow).

### 6.5 Loans tab

View:

- Pending loan applications
- Active loans
- Outstanding balance

Full apply / disburse / repay flows are available on the **web portal** until the next mobile release.

### 6.6 Account tab

- View name, email, role
- See which **API server** the app is connected to (useful for support)
- **Sign out**

---

## 7. Authentication and security

| Topic | Behaviour |
|-------|-----------|
| Login | `POST /api/v1/auth/login/` with email + password |
| Tokens | `access` (30 min) + `refresh` (1 day) stored in SecureStore |
| API calls | Header: `Authorization: Bearer <access_token>` |
| Token refresh | Automatic on 401 via `POST /api/v1/auth/refresh/token/` |
| Logout | Clears tokens locally; no server revoke in v1 |
| Staff 2FA | Not supported in mobile v1 — use web admin portal |

Password reset: use the **web portal** forgot-password flow until mobile deep links are added.

---

## 8. Troubleshooting

### "Network error" or login fails on phone

| Check | Action |
|-------|--------|
| Wrong API URL in APK | Rebuild with correct `EXPO_PUBLIC_API_URL` in `.env` |
| Local backend not reachable | Use `runserver 0.0.0.0:8000`; check firewall allows port 8000 |
| Emulator vs physical | Emulator uses `10.0.2.2`; physical device uses PC LAN IP |
| Hosted HTTPS | Certificate must be valid; no self-signed unless you trust it on device |

### "Wrong credentials" after password reset

Ensure email is verified. Password reset via web now marks email verified; try reset again if needed.

### Buy Units shows 0 kWh for small amounts

ERA domestic tariff includes a **monthly service charge (UGX 3,360) + 18% VAT** on the first purchase each month. Amounts under ~UGX 4,000 may yield 0 kWh. See Buy Units warning in the app.

### APK install blocked

Enable **Install unknown apps** for your browser or file manager in Android settings.

### Build takes over an hour

First Gradle build downloads SDK/NDK components. Subsequent builds are much faster.

### `adb: device unauthorized`

Enable **USB debugging** on the phone and accept the RSA fingerprint prompt.

---

## 9. Release checklist

Before giving an APK to real users:

- [ ] Set `EXPO_PUBLIC_API_URL` to production HTTPS URL
- [ ] Rebuild APK after any `.env` change
- [ ] Backend `DEBUG=False`, valid TLS, MoMo production credentials (if live payments)
- [ ] Test login, buy units, STS token generation on a real device
- [ ] Test on slow network; confirm MoMo polling completes
- [ ] Sign release APK / upload AAB to Play Console
- [ ] Document support contact for users

---

## Quick command reference

```powershell
# Dev (emulator)
cd mobile && npm run android

# Build debug APK
cd mobile
npm run prebuild:android
npm run apk:debug

# Install
adb install dist\gpawa-debug.apk

# Find PC IP (physical device + local API)
ipconfig
```

For backend and web setup, continue with [`LOCAL_DEVELOPMENT.md`](LOCAL_DEVELOPMENT.md).
